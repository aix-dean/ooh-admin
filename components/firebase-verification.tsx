"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, AlertCircle, CheckCircle, WifiOff, Database, Shield } from "lucide-react"
import {
  isFirebaseInitialized,
  getInitializationError,
  checkFirestoreConnection,
  db,
  websiteInfo,
} from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useNetworkStatus } from "@/lib/network-status"

export function FirebaseVerification() {
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<Record<string, { success: boolean; message: string }>>(
    {},
  )
  const isOnline = useNetworkStatus()
  const [projectDetails, setProjectDetails] = useState<Record<string, string>>({})

  // Run initial verification on mount
  useEffect(() => {
    verifyFirebaseSetup()
  }, [])

  const verifyFirebaseSetup = async () => {
    setIsVerifying(true)
    setVerificationResults({})

    // Step 1: Check network connectivity
    const networkOnline = isOnline
    setVerificationResults((prev) => ({
      ...prev,
      network: {
        success: networkOnline,
        message: networkOnline ? "Network is online" : "Network is offline",
      },
    }))

    // Step 2: Check Firebase initialization
    const firebaseInit = isFirebaseInitialized()
    const initError = getInitializationError()
    setVerificationResults((prev) => ({
      ...prev,
      initialization: {
        success: firebaseInit,
        message: firebaseInit
          ? "Firebase initialized successfully"
          : `Firebase initialization failed: ${initError?.message || "Unknown error"}`,
      },
    }))

    // Get project details
    try {
      setProjectDetails({
        projectId: db?.app?.options?.projectId || "Unknown",
        authDomain: db?.app?.options?.authDomain || "Unknown",
        apiKey: "********" + (db?.app?.options?.apiKey?.slice(-6) || "Unknown"),
        websiteName: websiteInfo.name,
        supportEmail: websiteInfo.supportEmail,
        adminPortalName: websiteInfo.adminPortalName,
      })
    } catch (error) {
      console.error("Error getting project details:", error)
    }

    if (!networkOnline || !firebaseInit) {
      setIsVerifying(false)
      return
    }

    // Step 3: Check Firestore connection
    try {
      const firestoreConnected = await checkFirestoreConnection()
      setVerificationResults((prev) => ({
        ...prev,
        firestore: {
          success: firestoreConnected,
          message: firestoreConnected ? "Firestore connection successful" : "Firestore connection failed",
        },
      }))

      // Step 4: Test write to iboard_users collection
      if (firestoreConnected) {
        try {
          // Create a test document in a test collection
          const testDocRef = doc(db, "system", "verification_test")
          await setDoc(testDocRef, {
            timestamp: new Date(),
            test: "Firebase verification",
            success: true,
          })

          // Verify the document was written
          const docSnap = await getDoc(testDocRef)

          setVerificationResults((prev) => ({
            ...prev,
            write: {
              success: docSnap.exists(),
              message: docSnap.exists()
                ? "Write to Firestore successful"
                : "Write to Firestore failed: Document not found after write",
            },
          }))
        } catch (error: any) {
          setVerificationResults((prev) => ({
            ...prev,
            write: {
              success: false,
              message: `Write to Firestore failed: ${error.message}`,
            },
          }))
        }
      }
    } catch (error: any) {
      setVerificationResults((prev) => ({
        ...prev,
        firestore: {
          success: false,
          message: `Firestore connection check failed: ${error.message}`,
        },
      }))
    }

    setIsVerifying(false)
  }

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Firebase Configuration Verification</h2>
        <Button onClick={verifyFirebaseSetup} disabled={isVerifying} variant="outline" size="sm">
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify Setup"
          )}
        </Button>
      </div>

      {/* Project Details */}
      {Object.keys(projectDetails).length > 0 && (
        <div className="bg-gray-50 p-3 rounded-md text-sm">
          <h3 className="font-medium mb-2">Project Details</h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="font-medium">Project ID:</span> {projectDetails.projectId}
            </div>
            <div>
              <span className="font-medium">Auth Domain:</span> {projectDetails.authDomain}
            </div>
            <div>
              <span className="font-medium">API Key:</span> {projectDetails.apiKey}
            </div>
            <div>
              <span className="font-medium">Website Name:</span> {projectDetails.websiteName}
            </div>
            <div>
              <span className="font-medium">Support Email:</span> {projectDetails.supportEmail}
            </div>
            <div>
              <span className="font-medium">Admin Portal:</span> {projectDetails.adminPortalName}
            </div>
          </div>
        </div>
      )}

      {/* Verification Results */}
      <div className="space-y-2">
        {Object.entries(verificationResults).map(([test, result]) => (
          <Alert
            key={test}
            variant={result.success ? "default" : "destructive"}
            className={result.success ? "border-green-500 bg-green-50" : ""}
          >
            {result.success ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : test === "network" ? (
              <WifiOff className="h-4 w-4" />
            ) : test === "initialization" ? (
              <Shield className="h-4 w-4" />
            ) : test === "firestore" ? (
              <Database className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className={result.success ? "text-green-700" : ""}>
              <span className="font-semibold capitalize">{test}:</span> {result.message}
            </AlertDescription>
          </Alert>
        ))}

        {isVerifying && Object.keys(verificationResults).length === 0 && (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
            <span>Verifying Firebase configuration...</span>
          </div>
        )}
      </div>
    </div>
  )
}
