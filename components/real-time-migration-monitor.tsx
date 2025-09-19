"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Activity, Clock, Zap, RefreshCw, AlertTriangle, CheckCircle, Loader2, TrendingUp } from "lucide-react"
import { useEffect, useState } from "react"

interface RealTimeMigrationMonitorProps {
  migrationName: string
  isRunning: boolean
  totalItems: number
  processedItems: number
  successfulItems: number
  errorItems: number
  skippedItems: number
  processingRate?: number // items per second
  onRefresh?: () => void
}

export function RealTimeMigrationMonitor({
  migrationName,
  isRunning,
  totalItems,
  processedItems,
  successfulItems,
  errorItems,
  skippedItems,
  processingRate,
  onRefresh,
}: RealTimeMigrationMonitorProps) {
  const [elapsedTime, setElapsedTime] = useState(0)
  const [startTime, setStartTime] = useState<Date | null>(null)

  // Track elapsed time when migration is running
  useEffect(() => {
    if (isRunning && !startTime) {
      setStartTime(new Date())
      setElapsedTime(0)
    } else if (!isRunning && startTime) {
      setStartTime(null)
    }
  }, [isRunning, startTime])

  useEffect(() => {
    if (isRunning && startTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime.getTime()) / 1000))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [isRunning, startTime])

  const progressPercentage = totalItems > 0 ? (processedItems / totalItems) * 100 : 0
  const remainingItems = totalItems - processedItems
  const estimatedTimeRemaining =
    processingRate && processingRate > 0 ? Math.ceil(remainingItems / processingRate) : null

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-800">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Running
        </Badge>
      )
    }
    if (progressPercentage === 100) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      )
    }
    if (errorItems > 0) {
      return (
        <Badge variant="destructive">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Has Errors
        </Badge>
      )
    }
    return <Badge variant="secondary">Idle</Badge>
  }

  return (
    <Card className={`w-full ${isRunning ? "ring-2 ring-blue-500 ring-opacity-50" : ""}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${isRunning ? "text-blue-500 animate-pulse" : "text-muted-foreground"}`} />
            {migrationName}
          </CardTitle>
          <CardDescription>Real-time migration progress and statistics</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          <Button variant="outline" size="sm" onClick={onRefresh} className="h-8 w-8 p-0">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Migration Progress</span>
            <span>{progressPercentage.toFixed(1)}%</span>
          </div>
          <Progress value={progressPercentage} className={`h-3 ${isRunning ? "animate-pulse" : ""}`} />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {processedItems.toLocaleString()} of {totalItems.toLocaleString()} items
            </span>
            <span>{remainingItems.toLocaleString()} remaining</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalItems.toLocaleString()}</div>
            <div className="text-xs text-blue-600 font-medium">Total Items</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{successfulItems.toLocaleString()}</div>
            <div className="text-xs text-green-600 font-medium">Successful</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{errorItems.toLocaleString()}</div>
            <div className="text-xs text-red-600 font-medium">Errors</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{skippedItems.toLocaleString()}</div>
            <div className="text-xs text-yellow-600 font-medium">Skipped</div>
          </div>
        </div>

        {/* Performance Metrics */}
        {isRunning && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-sm font-medium">Elapsed Time</div>
                <div className="text-lg font-bold">{formatTime(elapsedTime)}</div>
              </div>
            </div>
            {processingRate && (
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Processing Rate</div>
                  <div className="text-lg font-bold">{processingRate.toFixed(1)}/sec</div>
                </div>
              </div>
            )}
            {estimatedTimeRemaining && (
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm font-medium">Est. Remaining</div>
                  <div className="text-lg font-bold">{formatTime(estimatedTimeRemaining)}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorItems > 0 && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">{errorItems} items encountered errors during migration</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
