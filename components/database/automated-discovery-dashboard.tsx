"use client"

import { useState } from "react"
import { useCollectionDiscovery } from "@/hooks/use-collection-discovery"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  RefreshCw,
  Database,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Settings,
  Users,
  ShoppingCart,
  FileText,
  MessageSquare,
  BarChart3,
  Package,
  TestTube,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AutomatedDiscoveryDashboardProps {
  onCollectionSelect?: (collection: string) => void
}

export function AutomatedDiscoveryDashboard({ onCollectionSelect }: AutomatedDiscoveryDashboardProps) {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(5)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const { collections, result, loading, error, statistics, discover, refreshCollection, clearCache } =
    useCollectionDiscovery({
      autoDiscover: true,
      enableRealTime: autoRefresh,
      refreshInterval: refreshInterval * 60 * 1000,
    })

  const filteredCollections = collections.filter((collection) => {
    const matchesSearch =
      collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.category.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || collection.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(collections.map((c) => c.category)))

  const getCategoryIcon = (category: string) => {
    const icons = {
      "User Management": Users,
      "E-commerce": ShoppingCart,
      "Content & Media": FileText,
      Communication: MessageSquare,
      "Analytics & Tracking": BarChart3,
      Configuration: Settings2,
      Testing: TestTube,
      Other: Package,
    }
    return icons[category as keyof typeof icons] || Package
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200"
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "low":
        return "text-green-600 bg-green-50 border-green-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  const formatLastDiscovery = (date: Date | null) => {
    if (!date) return "Never"
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`

    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Automated Collection Discovery</h2>
          <p className="text-muted-foreground">Real-time collection monitoring and automatic discovery</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => discover(true)} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Force Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={clearCache}>
            Clear Cache
          </Button>
        </div>
      </div>

      {/* Status Alert */}
      {error && (
        <Alert className="border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Discovery Error:</strong> {error}
          </AlertDescription>
        </Alert>
      )}

      {result && result.cacheHit && (
        <Alert className="border-blue-200">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Using cached data from {formatLastDiscovery(result.lastUpdated)}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
      <div className="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Collections</p>
                <p className="text-2xl font-bold">{statistics.totalCollections}</p>
              </div>
              <Database className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Accessible</p>
                <p className="text-2xl font-bold text-green-600">{statistics.accessibleCollections}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Discovery</p>
                <p className="text-lg font-bold">{formatLastDiscovery(statistics.lastDiscovery)}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cache Size</p>
                <p className="text-2xl font-bold">{statistics.cacheSize}</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discovery Progress */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Discovering collections...</p>
                <Zap className="h-4 w-4 animate-pulse text-blue-500" />
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="collections" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Search collections..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedCategory === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory("all")}
              >
                All ({collections.length})
              </Button>
              {categories.map((category) => (
                <Button
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                >
                  {category} ({statistics.categoryCounts[category] || 0})
                </Button>
              ))}
            </div>
          </div>

          {/* Collections Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCollections.map((collection) => {
              const Icon = getCategoryIcon(collection.category)
              return (
                <Card
                  key={collection.name}
                  className="cursor-pointer hover:shadow-md transition-all duration-200"
                  onClick={() => onCollectionSelect?.(collection.name)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-50">
                          <Icon className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{collection.name}</CardTitle>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className={getPriorityColor(collection.priority)}>
                              {collection.priority}
                            </Badge>
                            {!collection.isAccessible && <Badge variant="destructive">No Access</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Documents:</span>
                        <Badge variant="secondary">{collection.documentCount.toLocaleString()}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Size:</span>
                        <span>{collection.estimatedSize}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Category:</span>
                        <span>{collection.category}</span>
                      </div>
                      {collection.schema && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Fields:</span>
                          <span>{collection.schema.fields.length}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredCollections.length === 0 && !loading && (
            <Card>
              <CardContent className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm ? "No collections match your search" : "No collections discovered yet"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Category Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statistics.categoryCounts).map(([category, count]) => {
                    const Icon = getCategoryIcon(category)
                    const percentage = (count / statistics.totalCollections) * 100
                    return (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{category}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Priority Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Priority Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(statistics.priorityCounts).map(([priority, count]) => {
                    const percentage = (count / statistics.totalCollections) * 100
                    return (
                      <div key={priority} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm capitalize">{priority} Priority</span>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Discovery Settings
              </CardTitle>
              <CardDescription>Configure automated collection discovery behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-refresh">Auto Refresh</Label>
                  <p className="text-sm text-muted-foreground">Automatically refresh collection data</p>
                </div>
                <Switch id="auto-refresh" checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh-interval">Refresh Interval (minutes)</Label>
                <Input
                  id="refresh-interval"
                  type="number"
                  min="1"
                  max="60"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Number(e.target.value) || 5)}
                  disabled={!autoRefresh}
                />
              </div>

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-2">Discovery Information</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Collections are discovered automatically on page load</p>
                  <p>• Real-time updates monitor high-priority collections</p>
                  <p>• Cache is used to improve performance</p>
                  <p>• Permission checks ensure secure access</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
