"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react"

interface MigrationStats {
  totalItems: number
  processedItems: number
  successfulItems: number
  errorItems: number
  skippedItems: number
  progressPercentage: number
  isLoading: boolean
  lastUpdated?: Date
}

interface MigrationStatsCardProps {
  title: string
  description: string
  stats: MigrationStats
  onRefresh?: () => void
}

export function MigrationStatsCard({ title, description, stats, onRefresh }: MigrationStatsCardProps) {
  const successRate = stats.processedItems > 0 ? (stats.successfulItems / stats.processedItems) * 100 : 0
  const errorRate = stats.processedItems > 0 ? (stats.errorItems / stats.processedItems) * 100 : 0

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={stats.isLoading} className="h-8 w-8 p-0">
          <RefreshCw className={`h-4 w-4 ${stats.isLoading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Overall Progress</span>
            <span>{stats.progressPercentage}%</span>
          </div>
          <Progress value={stats.progressPercentage} className="h-2" />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Total Items</p>
            <p className="text-2xl font-bold text-blue-600">{stats.totalItems.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Successful</p>
            <p className="text-2xl font-bold text-green-600">{stats.successfulItems.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Errors</p>
            <p className="text-2xl font-bold text-red-600">{stats.errorItems.toLocaleString()}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Skipped</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.skippedItems.toLocaleString()}</p>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          {stats.progressPercentage === 100 && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
          {stats.progressPercentage > 0 && stats.progressPercentage < 100 && (
            <Badge variant="default" className="bg-blue-100 text-blue-800">
              In Progress
            </Badge>
          )}
          {errorRate > 10 && (
            <Badge variant="destructive">
              <AlertTriangle className="h-3 w-3 mr-1" />
              High Error Rate
            </Badge>
          )}
          {successRate > 90 && stats.processedItems > 0 && (
            <Badge variant="default" className="bg-green-100 text-green-800">
              <TrendingUp className="h-3 w-3 mr-1" />
              High Success Rate
            </Badge>
          )}
        </div>

        {/* Additional Metrics */}
        {stats.processedItems > 0 && (
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
              <p className="text-lg font-semibold text-green-600">{successRate.toFixed(1)}%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Error Rate</p>
              <p className="text-lg font-semibold text-red-600">{errorRate.toFixed(1)}%</p>
            </div>
          </div>
        )}

        {/* Last Updated */}
        {stats.lastUpdated && (
          <p className="text-xs text-muted-foreground">Last updated: {stats.lastUpdated.toLocaleTimeString()}</p>
        )}
      </CardContent>
    </Card>
  )
}
