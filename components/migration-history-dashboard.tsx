"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import {
  History,
  TrendingUp,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
} from "lucide-react"
import { MigrationHistoryService } from "@/lib/migration-history-service"
import type { MigrationHistoryEntry, MigrationSummary, MigrationTrend } from "@/types/migration-history"
import { formatDistanceToNow, format } from "date-fns"

export function MigrationHistoryDashboard() {
  const [history, setHistory] = useState<MigrationHistoryEntry[]>([])
  const [summary, setSummary] = useState<MigrationSummary | null>(null)
  const [trends, setTrends] = useState<MigrationTrend[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedType, setSelectedType] = useState<string>("all")

  const loadData = async () => {
    setLoading(true)
    try {
      const [historyData, summaryData, trendsData] = await Promise.all([
        MigrationHistoryService.getMigrationHistory(100, selectedType === "all" ? undefined : selectedType),
        MigrationHistoryService.getMigrationSummary(),
        MigrationHistoryService.getMigrationTrends(),
      ])

      setHistory(historyData)
      setSummary(summaryData)
      setTrends(trendsData)
    } catch (error) {
      console.error("Error loading migration history:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [selectedType])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "running":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "cancelled":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: "default" as const,
      failed: "destructive" as const,
      running: "secondary" as const,
      cancelled: "outline" as const,
    }
    return <Badge variant={variants[status as keyof typeof variants] || "outline"}>{status}</Badge>
  }

  const formatDuration = (startTime: Date, endTime?: Date) => {
    if (!endTime) return "In progress"
    const duration = endTime.getTime() - startTime.getTime()
    const minutes = Math.floor(duration / 60000)
    const seconds = Math.floor((duration % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  const exportHistory = () => {
    const csv = [
      [
        "Migration Type",
        "Name",
        "Start Time",
        "End Time",
        "Status",
        "Total Items",
        "Successful",
        "Errors",
        "Skipped",
        "Duration",
      ].join(","),
      ...history.map((entry) =>
        [
          entry.migrationType,
          entry.migrationName,
          entry.startTime.toISOString(),
          entry.endTime?.toISOString() || "",
          entry.status,
          entry.totalItems,
          entry.successfulItems,
          entry.errorItems,
          entry.skippedItems,
          formatDuration(entry.startTime, entry.endTime),
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `migration-history-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Migrations</p>
                  <p className="text-2xl font-bold">{summary.totalMigrations}</p>
                </div>
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {summary.totalMigrations > 0
                      ? Math.round((summary.successfulMigrations / summary.totalMigrations) * 100)
                      : 0}
                    %
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Items Processed</p>
                  <p className="text-2xl font-bold">{summary.totalItemsProcessed.toLocaleString()}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg. Rate</p>
                  <p className="text-2xl font-bold">{summary.averageProcessingRate.toFixed(1)}/s</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="history" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="history">Migration History</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportHistory}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <TabsContent value="history" className="space-y-4">
          {/* Filter */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium">Filter by type:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="px-3 py-1 border rounded-md"
                >
                  <option value="all">All Types</option>
                  <option value="companies">Companies</option>
                  <option value="products">Products</option>
                  <option value="bookings">Bookings</option>
                  <option value="quotations">Quotations</option>
                  <option value="followers">Followers</option>
                  <option value="chats">Chats</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* History List */}
          <div className="space-y-4">
            {history.map((entry) => (
              <Card key={entry.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(entry.status)}
                      <div>
                        <h3 className="font-semibold">{entry.migrationName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {format(entry.startTime, "PPp")} • {formatDistanceToNow(entry.startTime, { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.status)}
                      <Badge variant="outline">{entry.migrationType}</Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Items</p>
                      <p className="font-semibold">{entry.totalItems.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Successful</p>
                      <p className="font-semibold text-green-600">{entry.successfulItems.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Errors</p>
                      <p className="font-semibold text-red-600">{entry.errorItems.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Skipped</p>
                      <p className="font-semibold text-yellow-600">{entry.skippedItems.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-semibold">{formatDuration(entry.startTime, entry.endTime)}</p>
                    </div>
                  </div>

                  {entry.status === "completed" && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Success Rate</span>
                        <span>{Math.round((entry.successfulItems / entry.totalItems) * 100)}%</span>
                      </div>
                      <Progress value={(entry.successfulItems / entry.totalItems) * 100} className="h-2" />
                    </div>
                  )}

                  {entry.processingRate && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Processing rate: {entry.processingRate.toFixed(1)} items/second
                    </p>
                  )}

                  {entry.errorDetails && entry.errorDetails.length > 0 && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-medium text-red-800 mb-2">Error Details:</p>
                      <ul className="text-sm text-red-700 space-y-1">
                        {entry.errorDetails.slice(0, 3).map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                        {entry.errorDetails.length > 3 && (
                          <li>• ... and {entry.errorDetails.length - 3} more errors</li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {history.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Migration History</h3>
                  <p className="text-muted-foreground">
                    No migrations have been run yet. Start your first migration to see history here.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Migration Trends (Last 30 Days)</CardTitle>
              <CardDescription>Daily migration activity and performance metrics</CardDescription>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <div className="space-y-4">
                  {trends.map((trend, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{format(new Date(trend.date), "MMM dd, yyyy")}</p>
                        <p className="text-sm text-muted-foreground">
                          {trend.migrations} migrations • {trend.itemsProcessed.toLocaleString()} items
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{trend.successRate.toFixed(1)}% success</p>
                        <p className="text-sm text-muted-foreground">{trend.averageRate.toFixed(1)} items/sec avg</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No trend data available for the last 30 days</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Migrations by Type</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(summary.migrationsByType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <span className="capitalize">{type}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Migrations by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(summary.migrationsByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(status)}
                          <span className="capitalize">{status}</span>
                        </div>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
