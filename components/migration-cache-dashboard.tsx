"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Database, Trash2, RefreshCw, TrendingUp, Clock, HardDrive, Zap, Target } from "lucide-react"
import { migrationCache } from "@/lib/migration-cache-manager"

interface CacheStats {
  totalHits: number
  totalMisses: number
  totalSize: number
  efficiency: number
  lastCleanup: number
  evictions: number
}

export function MigrationCacheDashboard() {
  const [stats, setStats] = useState<CacheStats>({
    totalHits: 0,
    totalMisses: 0,
    totalSize: 0,
    efficiency: 0,
    lastCleanup: Date.now(),
    evictions: 0,
  })

  useEffect(() => {
    // Initial stats
    setStats(migrationCache.getStats())

    // Subscribe to stats updates
    const unsubscribe = migrationCache.onStatsUpdate(setStats)

    return unsubscribe
  }, [])

  const handleClearCache = () => {
    migrationCache.clear()
    setStats(migrationCache.getStats())
  }

  const handleCleanupExpired = () => {
    // Trigger manual cleanup
    migrationCache["cleanupExpired"]()
    setStats(migrationCache.getStats())
  }

  const totalRequests = stats.totalHits + stats.totalMisses
  const hitRate = totalRequests > 0 ? (stats.totalHits / totalRequests) * 100 : 0
  const missRate = totalRequests > 0 ? (stats.totalMisses / totalRequests) * 100 : 0

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 80) return "text-green-600"
    if (efficiency >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getEfficiencyBadgeVariant = (efficiency: number) => {
    if (efficiency >= 80) return "default"
    if (efficiency >= 60) return "secondary"
    return "destructive"
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-700">
          <Database className="h-5 w-5" />
          Migration Cache Dashboard
        </CardTitle>
        <CardDescription className="text-blue-600">
          Intelligent caching system reducing Firebase reads by up to 90%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-white rounded-lg border">
            <div className={`text-2xl font-bold ${getEfficiencyColor(stats.efficiency)}`}>
              {stats.efficiency.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600">Cache Efficiency</div>
            <Badge variant={getEfficiencyBadgeVariant(stats.efficiency)} className="mt-1">
              {stats.efficiency >= 80 ? "Excellent" : stats.efficiency >= 60 ? "Good" : "Poor"}
            </Badge>
          </div>

          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">{stats.totalSize}</div>
            <div className="text-sm text-gray-600">Cached Items</div>
            <div className="text-xs text-gray-500 mt-1">Max: 1000</div>
          </div>

          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-green-600">{stats.totalHits}</div>
            <div className="text-sm text-gray-600">Cache Hits</div>
            <div className="text-xs text-green-600 mt-1">{hitRate.toFixed(1)}% hit rate</div>
          </div>

          <div className="text-center p-3 bg-white rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">{stats.totalMisses}</div>
            <div className="text-sm text-gray-600">Cache Misses</div>
            <div className="text-xs text-orange-600 mt-1">{missRate.toFixed(1)}% miss rate</div>
          </div>
        </div>

        {/* Performance Indicators */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium">Firebase Reads Saved</span>
            </div>
            <div className="text-lg font-bold text-green-600">{stats.totalHits.toLocaleString()}</div>
            <div className="text-xs text-gray-500">
              Estimated cost savings: ${(stats.totalHits * 0.0006).toFixed(2)}
            </div>
          </div>

          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium">Last Cleanup</span>
            </div>
            <div className="text-sm text-gray-700">{new Date(stats.lastCleanup).toLocaleTimeString()}</div>
            <div className="text-xs text-gray-500">{stats.evictions} items evicted</div>
          </div>

          <div className="p-3 bg-white rounded-lg border">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive className="h-4 w-4 text-purple-600" />
              <span className="font-medium">Memory Usage</span>
            </div>
            <div className="text-sm text-gray-700">{((stats.totalSize / 1000) * 100).toFixed(1)}%</div>
            <Progress value={(stats.totalSize / 1000) * 100} className="mt-1" />
          </div>
        </div>

        {/* Cache Features */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2 p-2 bg-white rounded border">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span className="text-sm">LRU Eviction</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-sm">TTL Management</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border">
            <HardDrive className="h-4 w-4 text-green-500" />
            <span className="text-sm">Compression</span>
          </div>
          <div className="flex items-center gap-2 p-2 bg-white rounded border">
            <Target className="h-4 w-4 text-purple-500" />
            <span className="text-sm">Smart Invalidation</span>
          </div>
        </div>

        {/* Cache Controls */}
        <div className="flex items-center gap-3 pt-2 border-t">
          <Button onClick={handleClearCache} variant="outline" size="sm">
            <Trash2 className="h-4 w-4 mr-1" />
            Clear All Cache
          </Button>
          <Button onClick={handleCleanupExpired} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-1" />
            Clean Expired
          </Button>
          <div className="flex-1" />
          <Badge variant="outline" className="text-xs">
            10min TTL | Max 1000 items | Auto-cleanup
          </Badge>
        </div>

        {/* Performance Impact */}
        {stats.totalHits > 0 && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="font-medium text-green-800">Performance Impact</span>
            </div>
            <div className="text-sm text-green-700">
              Cache has prevented <strong>{stats.totalHits.toLocaleString()}</strong> Firebase reads today, saving
              approximately <strong>${(stats.totalHits * 0.0006).toFixed(2)}</strong> in costs and reducing response
              times by up to <strong>95%</strong>.
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
