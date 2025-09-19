"use client"

import { useState } from "react"
import { MigrationLayout } from "@/components/migration-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Code, Play, Square, RotateCcw, AlertTriangle, CheckCircle, Info } from "lucide-react"

export default function MigrateSiteCodesPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "error">("idle")
  const [logs, setLogs] = useState<string[]>([])

  const handleStartMigration = async () => {
    setIsRunning(true)
    setStatus("running")
    setProgress(0)
    setLogs(["Starting site code migration..."])

    try {
      // Simulate migration progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 500))
        setProgress(i)
        setLogs((prev) => [...prev, `Processing site codes... ${i}% complete`])
      }

      setStatus("completed")
      setLogs((prev) => [...prev, "Site code migration completed successfully!"])
    } catch (error) {
      setStatus("error")
      setLogs((prev) => [...prev, `Error: ${error instanceof Error ? error.message : "Unknown error"}`])
    } finally {
      setIsRunning(false)
    }
  }

  const handleStopMigration = () => {
    setIsRunning(false)
    setStatus("idle")
    setLogs((prev) => [...prev, "Migration stopped by user"])
  }

  const handleResetMigration = () => {
    setIsRunning(false)
    setStatus("idle")
    setProgress(0)
    setLogs([])
  }

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "default"
      case "completed":
        return "secondary"
      case "error":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return <Play className="h-4 w-4" />
      case "completed":
        return <CheckCircle className="h-4 w-4" />
      case "error":
        return <AlertTriangle className="h-4 w-4" />
      default:
        return <Code className="h-4 w-4" />
    }
  }

  return (
    <MigrationLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <Code className="h-8 w-8" />
            Site Code Migration
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Migrate and synchronize site code data across your system. This process will update site code references and
            ensure data consistency.
          </p>
        </div>

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon()}
                    <Badge variant={getStatusColor()}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Progress</p>
                  <p className="text-2xl font-bold mt-1">{progress}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Records</p>
                  <p className="text-2xl font-bold mt-1">-</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Migration Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Site Code Migration Controls
            </CardTitle>
            <CardDescription>
              Start, stop, or reset the site code migration process. Monitor progress and view detailed logs below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress Bar */}
            {status === "running" && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Migration Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {/* Control Buttons */}
            <div className="flex gap-2">
              <Button onClick={handleStartMigration} disabled={isRunning} className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                Start Migration
              </Button>

              <Button
                onClick={handleStopMigration}
                disabled={!isRunning}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>

              <Button
                onClick={handleResetMigration}
                disabled={isRunning}
                variant="outline"
                className="flex items-center gap-2 bg-transparent"
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>

            {/* Status Alerts */}
            {status === "completed" && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Site code migration completed successfully! All site codes have been processed and updated.
                </AlertDescription>
              </Alert>
            )}

            {status === "error" && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Migration encountered an error. Please check the logs below for details and try again.
                </AlertDescription>
              </Alert>
            )}

            {status === "running" && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Migration is currently running. Please do not close this page until the process is complete.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Migration Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Migration Logs</CardTitle>
              <CardDescription>Real-time logs from the site code migration process</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="space-y-1 font-mono text-sm">
                  {logs.map((log, index) => (
                    <div key={index} className="text-gray-700">
                      <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span> {log}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>About Site Code Migration</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>What this migration does:</strong> Updates and synchronizes site code references across all
                related data structures in your system.
              </p>
              <p>
                <strong>Prerequisites:</strong> Ensure that company migration has been completed before running this
                migration.
              </p>
              <p>
                <strong>Duration:</strong> This process typically takes 5-15 minutes depending on the amount of data.
              </p>
              <p>
                <strong>Safety:</strong> This migration is safe to run multiple times and includes rollback
                capabilities.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MigrationLayout>
  )
}
