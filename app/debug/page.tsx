"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FirebaseDiagnostics } from "@/components/firebase-diagnostics"
import { useNetworkStatus } from "@/lib/network-status"
import { checkFirestoreConnection, toggleNetworkMode } from "@/lib/auth"

export default function DebugPage() {
  const [logs, setLogs] = useState<string[]>([])
  const isNetworkOnline = useNetworkStatus()

  const addLog = (message: string) => {
    const timestamp = new Date().toISOString()
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev])
  }

  const clearLogs = () => {
    setLogs([])
  }

  const testFirestoreConnection = async () => {
    addLog("Testing Firestore connection...")
    try {
      const isConnected = await checkFirestoreConnection()
      addLog(`Firestore connection test: ${isConnected ? "SUCCESS" : "FAILED"}`)
    } catch (error: any) {
      addLog(`Firestore connection error: ${error.message}`)
    }
  }

  const toggleFirestoreNetwork = async (enable: boolean) => {
    addLog(`${enable ? "Enabling" : "Disabling"} Firestore network...`)
    try {
      await toggleNetworkMode(enable)
      addLog(`Firestore network ${enable ? "enabled" : "disabled"} successfully`)
    } catch (error: any) {
      addLog(`Error toggling Firestore network: ${error.message}`)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="flex items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <h1 className="text-3xl font-bold mb-6">Firebase Debug Tools</h1>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Network Status</h2>
          <div
            className={`p-4 rounded-lg ${isNetworkOnline ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
          >
            <p className={`font-medium ${isNetworkOnline ? "text-green-700" : "text-red-700"}`}>
              {isNetworkOnline ? "Online" : "Offline"}
            </p>
            <p className="text-sm mt-1">
              {isNetworkOnline
                ? "Your device is connected to the internet."
                : "Your device is not connected to the internet. Some features may not work."}
            </p>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">Firestore Tests</h2>
            <div className="flex space-x-2">
              <Button onClick={testFirestoreConnection} variant="outline">
                Test Connection
              </Button>
              <Button
                onClick={() => toggleFirestoreNetwork(true)}
                variant="outline"
                className="bg-green-50 hover:bg-green-100"
              >
                Enable Network
              </Button>
              <Button
                onClick={() => toggleFirestoreNetwork(false)}
                variant="outline"
                className="bg-red-50 hover:bg-red-100"
              >
                Disable Network
              </Button>
            </div>
          </div>

          <FirebaseDiagnostics />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Debug Logs</h2>
            <Button onClick={clearLogs} variant="outline" size="sm">
              Clear Logs
            </Button>
          </div>

          <div className="h-[500px] overflow-y-auto border rounded-lg p-4 bg-gray-50 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet. Run some tests to see logs here.</p>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="py-1 border-b border-gray-200 last:border-0">
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
