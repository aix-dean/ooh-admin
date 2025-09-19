"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import {
  Settings,
  Play,
  Square,
  RotateCcw,
  Info,
  Database,
  Users,
  Package,
  FileText,
  MessageSquare,
  Calendar,
  Building2,
  Code,
} from "lucide-react"

export default function ControlsPage() {
  const [activeOperation, setActiveOperation] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState<string[]>([])

  const controlOperations = [
    {
      id: "site_code_migration",
      title: "Site Code Migration",
      description: "Migrate and update site code references across the system",
      icon: Code,
      color: "bg-blue-500",
    },
    {
      id: "database_sync",
      title: "Database Sync",
      description: "Synchronize database records and ensure data consistency",
      icon: Database,
      color: "bg-green-500",
    },
    {
      id: "user_migration",
      title: "User Migration",
      description: "Migrate user accounts and associated data",
      icon: Users,
      color: "bg-purple-500",
    },
    {
      id: "product_sync",
      title: "Product Sync",
      description: "Synchronize product data across all platforms",
      icon: Package,
      color: "bg-orange-500",
    },
    {
      id: "document_migration",
      title: "Document Migration",
      description: "Migrate documents and file references",
      icon: FileText,
      color: "bg-red-500",
    },
    {
      id: "chat_migration",
      title: "Chat Migration",
      description: "Migrate chat history and message data",
      icon: MessageSquare,
      color: "bg-indigo-500",
    },
    {
      id: "booking_sync",
      title: "Booking Sync",
      description: "Synchronize booking data and schedules",
      icon: Calendar,
      color: "bg-teal-500",
    },
    {
      id: "company_migration",
      title: "Company Migration",
      description: "Migrate company data and associations",
      icon: Building2,
      color: "bg-yellow-500",
    },
  ]

  const handleStartOperation = async (operationId: string) => {
    setActiveOperation(operationId)
    setProgress(0)
    setLogs([`Starting ${operationId}...`])

    try {
      // Simulate operation progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise((resolve) => setTimeout(resolve, 300))
        setProgress(i)
        setLogs((prev) => [...prev, `Processing ${operationId}... ${i}% complete`])
      }

      setLogs((prev) => [...prev, `${operationId} completed successfully!`])
    } catch (error) {
      setLogs((prev) => [
        ...prev,
        `Error in ${operationId}: ${error instanceof Error ? error.message : "Unknown error"}`,
      ])
    } finally {
      setTimeout(() => {
        setActiveOperation(null)
        setProgress(0)
      }, 2000)
    }
  }

  const handleStopOperation = () => {
    if (activeOperation) {
      setLogs((prev) => [...prev, `${activeOperation} stopped by user`])
      setActiveOperation(null)
      setProgress(0)
    }
  }

  const handleResetLogs = () => {
    setLogs([])
    setProgress(0)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <Settings className="h-8 w-8" />
          System Controls
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Manage system operations, migrations, and data synchronization processes. Monitor progress and control various
          system functions from this central dashboard.
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Operation</p>
                <p className="text-lg font-bold mt-1">
                  {activeOperation ? activeOperation.replace(/_/g, " ").toUpperCase() : "None"}
                </p>
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
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <Badge variant={activeOperation ? "default" : "secondary"}>
                  {activeOperation ? "Running" : "Idle"}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Operations</p>
                <p className="text-2xl font-bold mt-1">{controlOperations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress Bar */}
      {activeOperation && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Operation Progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Control Operations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {controlOperations.map((operation) => {
          const Icon = operation.icon
          const isActive = activeOperation === operation.id

          return (
            <Card key={operation.id} className={`transition-all ${isActive ? "ring-2 ring-blue-500" : ""}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${operation.color} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{operation.title}</CardTitle>
                    {isActive && (
                      <Badge variant="default" className="mt-1">
                        Running
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription className="text-sm mb-4">{operation.description}</CardDescription>
                <Button
                  onClick={() => handleStartOperation(operation.id)}
                  disabled={!!activeOperation}
                  className="w-full"
                  size="sm"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {operation.title}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Global Controls
          </CardTitle>
          <CardDescription>System-wide controls for managing operations and monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={handleStopOperation}
              disabled={!activeOperation}
              variant="destructive"
              className="flex items-center gap-2"
            >
              <Square className="h-4 w-4" />
              Stop Current Operation
            </Button>

            <Button onClick={handleResetLogs} variant="outline" className="flex items-center gap-2 bg-transparent">
              <RotateCcw className="h-4 w-4" />
              Clear Logs
            </Button>

            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <Database className="h-4 w-4" />
              System Health Check
            </Button>

            <Button variant="outline" className="flex items-center gap-2 bg-transparent">
              <FileText className="h-4 w-4" />
              Export Logs
            </Button>
          </div>

          {/* Status Alerts */}
          {activeOperation && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Operation "{activeOperation.replace(/_/g, " ")}" is currently running. Please do not close this page
                until the process is complete.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Operation Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Operation Logs</CardTitle>
            <CardDescription>Real-time logs from system operations</CardDescription>
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
          <CardTitle>About System Controls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>Purpose:</strong> This control panel provides centralized management for system operations, data
              migrations, and synchronization processes.
            </p>
            <p>
              <strong>Safety:</strong> All operations include progress tracking, logging, and can be stopped at any
              time. Most operations are safe to run multiple times.
            </p>
            <p>
              <strong>Monitoring:</strong> Real-time progress tracking and detailed logging help you monitor the status
              of all operations.
            </p>
            <p>
              <strong>Best Practices:</strong> Run operations during low-traffic periods and ensure you have recent
              backups before starting major migrations.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
