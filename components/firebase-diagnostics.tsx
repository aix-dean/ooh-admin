"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle, WifiOff } from "lucide-react"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, enableNetwork, disableNetwork } from "firebase/firestore"
import { useNetworkStatus } from "@/lib/network-status"

export function FirebaseDiagnostics() {
  const [isRunningTests, setIsRunningTests] = useState(false)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})
  const [isNetworkEnabled, setIsNetworkEnabled] = useState(true)
  const isOnline = useNetworkStatus()

  const runDiagnostics = async () => {
    setIsRunningTests(true)
    setTestResults({})

    // Test 1: Check network connectivity
    const networkOnline = isOnline()
    setTestResults((prev) => ({
      ...prev,
      network: {
        success: networkOnline,
        message: networkOnline ? "Network is online" : "Network is offline",
      },
    }))

    if (!networkOnline) {
      setIsRunningTests(false)
      return
    }

    // Test 2: Try to read from Firestore
    try {
      const testDocRef = doc(db, "system", "diagnostics")
      const startTime = Date.now()

      try {
        const docSnap = await getDoc(testDocRef)
        const endTime = Date.now()
        const latency = endTime - startTime

        setTestResults((prev) => ({
          ...prev,
          read: {
            success: true,
            message: `Read successful (${latency}ms)`,
          },
        }))
      } catch (error: any) {
        // Check if the error is specifically about being offline
        if (
          error.code === "failed-precondition" ||
          error.message?.includes("offline") ||
          error.message?.includes("network")
        ) {
          setTestResults((prev) => ({
            ...prev,
            read: {
              success: false,
              message: `Read failed: Client is offline`,
            },
          }))
        } else {
          setTestResults((prev) => ({
            ...prev,
            read: {
              success: false,
              message: `Read failed: ${error.message}`,
            },
          }))
        }
      }
    } catch (error: any) {
      setTestResults((prev) => ({
        ...prev,
        read: {
          success: false,
          message: `Read test error: ${error.message}`,
        },
      }))
    }

    // Only attempt write if read was successful
    if (testResults.read?.success) {
      // Test 3: Try to write to Firestore
      try {
        const testDocRef = doc(db, "system", "diagnostics")
        const startTime = Date.now()

        try {
          await setDoc(testDocRef, {
            timestamp: new Date(),
            testId: Math.random().toString(36).substring(2, 15),
          })
          const endTime = Date.now()
          const latency = endTime - startTime

          setTestResults((prev) => ({
            ...prev,
            write: {
              success: true,
              message: `Write successful (${latency}ms)`,
            },
          }))
        } catch (error: any) {
          // Check if the error is specifically about being offline
          if (
            error.code === "failed-precondition" ||
            error.message?.includes("offline") ||
            error.message?.includes("network")
          ) {
            setTestResults((prev) => ({
              ...prev,
              write: {
                success: false,
                message: `Write failed: Client is offline`,
              },
            }))
          } else {
            setTestResults((prev) => ({
              ...prev,
              write: {
                success: false,
                message: `Write failed: ${error.message}`,
              },
            }))
          }
        }
      } catch (error: any) {
        setTestResults((prev) => ({
          ...prev,
          write: {
            success: false,
            message: `Write test error: ${error.message}`,
          },
        }))
      }
    }

    setIsRunningTests(false)
  }

  const toggleNetwork = async () => {
    setIsRunningTests(true)
    try {
      if (isNetworkEnabled) {
        await disableNetwork(db)
        setIsNetworkEnabled(false)
      } else {
        await enableNetwork(db)
        setIsNetworkEnabled(true)
      }
    } catch (error: any) {
      console.error("Error toggling network:", error)
    } finally {
      setIsRunningTests(false)
    }
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <h2 className="text-lg font-semibold">Firebase Diagnostics</h2>

      <div className="flex space-x-2">
        <Button onClick={runDiagnostics} disabled={isRunningTests} variant="outline">
          {isRunningTests ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running Tests...
            </>
          ) : (
            "Run Diagnostics"
          )}
        </Button>

        <Button
          onClick={toggleNetwork}
          disabled={isRunningTests}
          variant={isNetworkEnabled ? "destructive" : "default"}
        >
          {isRunningTests ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : isNetworkEnabled ? (
            "Disable Network"
          ) : (
            "Enable Network"
          )}
        </Button>
      </div>

      {Object.entries(testResults).map(([test, result]) => (
        <Alert
          key={test}
          variant={result.success ? "default" : "destructive"}
          className={result.success ? "border-green-500 bg-green-50" : ""}
        >
          {result.success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : test === "network" ? (
            <WifiOff className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription className={result.success ? "text-green-700" : ""}>
            <span className="font-semibold capitalize">{test}:</span> {result.message}
          </AlertDescription>
        </Alert>
      ))}

      {!isNetworkEnabled && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-500">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-600">
            Firebase network is currently disabled. This will simulate offline mode.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
