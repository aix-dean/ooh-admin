"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  listFirestoreCollections,
  testFirestoreConnectivity,
  categorizeCollections,
  getCollectionInsights,
  type ListCollectionsResult,
  type ListCollectionsOptions,
  type CollectionInfo,
} from "@/lib/firestore-collections"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Database,
  RefreshCw,
  Search,
  Settings,
  AlertCircle,
  CheckCircle,
  Folder,
  FileText,
  Zap,
  ChevronRight,
  ChevronDown,
  BarChart3,
  Users,
  ShoppingCart,
  MessageSquare,
  Settings2,
  TestTube,
  Package,
  TrendingUp,
  SortAsc,
  SortDesc,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface CollectionInsights {
  totalCollections: number
  collectionsWithDocuments: number
  largestCollections: CollectionInfo[]
  recentlyModified: CollectionInfo[]
  categories: Record<string, number>
}

export default function EnhancedCollectionExplorer() {
  const router = useRouter()
  const [result, setResult] = useState<ListCollectionsResult | null>(null)
  const [insights, setInsights] = useState<CollectionInsights | null>(null)
  const [loading, setLoading] = useState(false)
  const [connectivity, setConnectivity] = useState<{
    isConnected: boolean
    latency?: number
    error?: string
  } | null>(null)

  // Options state
  const [options, setOptions] = useState<ListCollectionsOptions>({
    includeSubcollections: false,
    includeDocumentCount: true,
    includeMetadata: false,
    maxDepth: 2,
    excludePatterns: [],
    timeout: 30000,
  })

  const [searchTerm, setSearchTerm] = useState("")
  const [excludePatternsText, setExcludePatternsText] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<"name" | "documents" | "category">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [viewMode, setViewMode] = useState<"list" | "grid" | "category">("category")

  // Test connectivity on mount
  useEffect(() => {
    testConnectivity()
  }, [])

  useEffect(() => {
    if (result?.collections) {
      generateInsights()
    }
  }, [result])

  const testConnectivity = async () => {
    try {
      const result = await testFirestoreConnectivity()
      setConnectivity(result)
    } catch (error: any) {
      setConnectivity({
        isConnected: false,
        error: error.message,
      })
    }
  }

  const discoverCollections = async () => {
    setLoading(true)
    try {
      const updatedOptions = {
        ...options,
        excludePatterns: excludePatternsText
          .split("\n")
          .map((p) => p.trim())
          .filter((p) => p.length > 0),
      }

      const result = await listFirestoreCollections(updatedOptions)
      setResult(result)
    } catch (error: any) {
      setResult({
        collections: [],
        totalCount: 0,
        executionTime: 0,
        errors: [error.message],
        warnings: [],
      })
    } finally {
      setLoading(false)
    }
  }

  const generateInsights = async () => {
    if (!result?.collections) return

    try {
      const insights = await getCollectionInsights(result.collections)
      setInsights(insights)
    } catch (error) {
      console.error("Failed to generate insights:", error)
    }
  }

  const handleCollectionClick = (collectionPath: string) => {
    const encodedPath = encodeURIComponent(collectionPath)
    router.push(`/dashboard/products/collections/${encodedPath}`)
  }

  const getFilteredAndSortedCollections = () => {
    if (!result?.collections) return []

    let filtered = result.collections.filter(
      (collection) =>
        collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.path.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    if (selectedCategory !== "all") {
      const categorized = categorizeCollections(result.collections)
      filtered = categorized[selectedCategory] || []
    }

    // Sort collections
    filtered.sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name)
          break
        case "documents":
          comparison = (a.documentCount || 0) - (b.documentCount || 0)
          break
        case "category":
          // This would need category assignment logic
          comparison = a.name.localeCompare(b.name)
          break
      }

      return sortOrder === "asc" ? comparison : -comparison
    })

    return filtered
  }

  const getCategoryIcon = (categoryName: string) => {
    const icons = {
      "User Management": Users,
      "Content & Media": FileText,
      "E-commerce": ShoppingCart,
      Communication: MessageSquare,
      "Analytics & Tracking": BarChart3,
      Configuration: Settings2,
      Testing: TestTube,
      Other: Package,
    }
    return icons[categoryName as keyof typeof icons] || Package
  }

  const filteredCollections = getFilteredAndSortedCollections()
  const categorizedCollections = result ? categorizeCollections(result.collections) : {}

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Database Explorer</h2>
          <p className="text-muted-foreground">Manage and analyze your Firestore collections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={testConnectivity} disabled={loading}>
            <Zap className="h-4 w-4 mr-2" />
            Test Connection
          </Button>
          <Button onClick={discoverCollections} disabled={loading || !connectivity?.isConnected}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            {loading ? "Discovering..." : "Discover Collections"}
          </Button>
        </div>
      </div>

      {/* Connectivity Status */}
      <Alert className={connectivity?.isConnected ? "border-green-200" : "border-red-200"}>
        <div className="flex items-center">
          {connectivity?.isConnected ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className="ml-2">
            {connectivity?.isConnected ? (
              <span>
                Connected to Firestore
                {connectivity.latency && <span className="text-muted-foreground ml-2">({connectivity.latency}ms)</span>}
              </span>
            ) : (
              <span>Connection failed: {connectivity?.error || "Unknown error"}</span>
            )}
          </AlertDescription>
        </div>
      </Alert>

      {/* Insights Dashboard */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Collections</p>
                  <p className="text-2xl font-bold">{insights.totalCollections}</p>
                </div>
                <Database className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">With Documents</p>
                  <p className="text-2xl font-bold">{insights.collectionsWithDocuments}</p>
                </div>
                <FileText className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Categories</p>
                  <p className="text-2xl font-bold">{Object.keys(insights.categories).length}</p>
                </div>
                <Folder className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Largest Collection</p>
                  <p className="text-lg font-bold">{insights.largestCollections[0]?.documentCount || 0} docs</p>
                  <p className="text-xs text-muted-foreground">{insights.largestCollections[0]?.name || "N/A"}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          {insights && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Collections by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(insights.categories).map(([category, count]) => {
                      const Icon = getCategoryIcon(category)
                      return (
                        <div key={category} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Icon className="h-4 w-4" />
                            <span className="text-sm">{category}</span>
                          </div>
                          <Badge variant="secondary">{count}</Badge>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Largest Collections */}
              <Card>
                <CardHeader>
                  <CardTitle>Largest Collections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.largestCollections.map((collection, index) => (
                      <div key={collection.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium">#{index + 1}</span>
                          <span className="text-sm">{collection.name}</span>
                        </div>
                        <Badge variant="outline">{collection.documentCount} docs</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="options" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Discovery Options
              </CardTitle>
              <CardDescription>
                Configure how collections are discovered and what information to retrieve
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="subcollections"
                    checked={options.includeSubcollections}
                    onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeSubcollections: checked }))}
                  />
                  <Label htmlFor="subcollections">Include Subcollections</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="documentCount"
                    checked={options.includeDocumentCount}
                    onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeDocumentCount: checked }))}
                  />
                  <Label htmlFor="documentCount">Count Documents</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="metadata"
                    checked={options.includeMetadata}
                    onCheckedChange={(checked) => setOptions((prev) => ({ ...prev, includeMetadata: checked }))}
                  />
                  <Label htmlFor="metadata">Include Metadata</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDepth">Max Depth</Label>
                  <Input
                    id="maxDepth"
                    type="number"
                    min="1"
                    max="10"
                    value={options.maxDepth}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, maxDepth: Number.parseInt(e.target.value) || 2 }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    min="5000"
                    max="120000"
                    step="5000"
                    value={options.timeout}
                    onChange={(e) =>
                      setOptions((prev) => ({ ...prev, timeout: Number.parseInt(e.target.value) || 30000 }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="excludePatterns">Exclude Patterns (one per line)</Label>
                <Textarea
                  id="excludePatterns"
                  placeholder="test_*&#10;*_temp&#10;cache_*"
                  value={excludePatternsText}
                  onChange={(e) => setExcludePatternsText(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Use * for wildcards. Example: "test_*" excludes collections starting with "test_"
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          {result && (
            <>
              {/* Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search collections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <div className="flex gap-2">
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {Object.keys(categorizedCollections).map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value: "name" | "documents" | "category") => setSortBy(value)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="documents">Documents</SelectItem>
                      <SelectItem value="category">Category</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                  >
                    {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2">
                <Label>View:</Label>
                <div className="flex border rounded-lg">
                  <Button
                    variant={viewMode === "category" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("category")}
                  >
                    Category
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                  >
                    List
                  </Button>
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("grid")}
                  >
                    Grid
                  </Button>
                </div>
              </div>

              {/* Error Messages */}
              {result.errors.length > 0 && (
                <Alert className="border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Errors encountered:</strong>
                    <ul className="mt-2 space-y-1">
                      {result.errors.map((error, index) => (
                        <li key={index} className="text-sm">
                          • {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Collections Display */}
              {viewMode === "category" ? (
                <div className="space-y-4">
                  {Object.entries(categorizedCollections).map(([categoryName, collections]) => {
                    const Icon = getCategoryIcon(categoryName)
                    const categoryCollections = collections.filter((c) =>
                      c.name.toLowerCase().includes(searchTerm.toLowerCase()),
                    )

                    if (categoryCollections.length === 0) return null

                    return (
                      <Collapsible key={categoryName} defaultOpen>
                        <CollapsibleTrigger asChild>
                          <Card className="cursor-pointer hover:shadow-sm transition-shadow">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <Icon className="h-5 w-5 text-blue-600" />
                                  <CardTitle className="text-lg">{categoryName}</CardTitle>
                                  <Badge variant="secondary">{categoryCollections.length}</Badge>
                                </div>
                                <ChevronDown className="h-4 w-4" />
                              </div>
                            </CardHeader>
                          </Card>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="grid gap-3 mt-2">
                            {categoryCollections.map((collection, index) => (
                              <Card
                                key={index}
                                className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500 hover:border-l-blue-600"
                                onClick={() => handleCollectionClick(collection.path)}
                              >
                                <CardContent className="pt-4">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-3">
                                      <Folder className="h-4 w-4 text-green-500" />
                                      <div>
                                        <h4 className="font-medium text-blue-600 hover:text-blue-700">
                                          {collection.name}
                                        </h4>
                                        <p className="text-xs text-muted-foreground">{collection.path}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      {typeof collection.documentCount === "number" && (
                                        <Badge variant="outline">
                                          {collection.documentCount === -1
                                            ? "Has docs"
                                            : `${collection.documentCount} docs`}
                                        </Badge>
                                      )}
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                </div>
              ) : viewMode === "grid" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredCollections.map((collection, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => handleCollectionClick(collection.path)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-center space-x-3 mb-2">
                          <Folder className="h-5 w-5 text-blue-500" />
                          <h3 className="font-semibold text-blue-600 hover:text-blue-700">{collection.name}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{collection.path}</p>
                        {typeof collection.documentCount === "number" && (
                          <Badge variant="outline">
                            {collection.documentCount === -1 ? "Has docs" : `${collection.documentCount} docs`}
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCollections.map((collection, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => handleCollectionClick(collection.path)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Folder className="h-4 w-4 text-blue-500" />
                            <div>
                              <h4 className="font-medium text-blue-600 hover:text-blue-700">{collection.name}</h4>
                              <p className="text-xs text-muted-foreground">{collection.path}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {typeof collection.documentCount === "number" && (
                              <Badge variant="outline">
                                {collection.documentCount === -1 ? "Has docs" : `${collection.documentCount} docs`}
                              </Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {filteredCollections.length === 0 && (
                <Card>
                  <CardContent className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {searchTerm ? "No collections match your search" : "No collections found"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {!result && !loading && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Database className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Ready to Explore</h3>
                  <p className="text-muted-foreground mb-4">
                    Click "Discover Collections" to scan your Firestore database
                  </p>
                  <Button onClick={discoverCollections} disabled={!connectivity?.isConnected}>
                    <Database className="h-4 w-4 mr-2" />
                    Start Discovery
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
