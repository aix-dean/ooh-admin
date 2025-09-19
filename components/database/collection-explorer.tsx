"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  listFirestoreCollections,
  testFirestoreConnectivity,
  type ListCollectionsResult,
  type ListCollectionsOptions,
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
import {
  Database,
  RefreshCw,
  Search,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Folder,
  FolderOpen,
  FileText,
  Zap,
  ExternalLink,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

export function CollectionExplorer() {
  const router = useRouter()
  const [result, setResult] = useState<ListCollectionsResult | null>(null)
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

  // Test connectivity on mount
  useEffect(() => {
    testConnectivity()
  }, [])

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

  const handleCollectionClick = (collectionPath: string) => {
    // Encode the collection path for URL safety
    const encodedPath = encodeURIComponent(collectionPath)
    router.push(`/dashboard/products/collections/${encodedPath}`)
  }

  const filteredCollections =
    result?.collections.filter(
      (collection) =>
        collection.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        collection.path.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Collection Explorer</h2>
          <p className="text-muted-foreground">Discover and analyze Firestore collections in your database</p>
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

      <Tabs defaultValue="collections" className="space-y-4">
        <TabsList>
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>

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
                  placeholder="_temp*&#10;cache*&#10;*.backup"
                  value={excludePatternsText}
                  onChange={(e) => setExcludePatternsText(e.target.value)}
                  rows={4}
                />
                <p className="text-sm text-muted-foreground">
                  Use * for wildcards. Example: "temp*" excludes collections starting with "temp"
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="collections" className="space-y-4">
          {result && (
            <>
              {/* Search and Stats */}
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search collections..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <Database className="h-4 w-4 mr-1" />
                    {filteredCollections.length} collections
                  </span>
                  <span className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {result.executionTime}ms
                  </span>
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

              {/* Warning Messages */}
              {result.warnings.length > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warnings:</strong>
                    <ul className="mt-2 space-y-1">
                      {result.warnings.map((warning, index) => (
                        <li key={index} className="text-sm">
                          • {warning}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Collections List */}
              <div className="grid gap-4">
                {filteredCollections.length === 0 ? (
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
                ) : (
                  filteredCollections.map((collection, index) => (
                    <Card
                      key={index}
                      className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-blue-500 hover:border-l-blue-600"
                      onClick={() => handleCollectionClick(collection.path)}
                    >
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            {collection.isSubcollection ? (
                              <FolderOpen className="h-5 w-5 text-blue-500 mt-0.5" />
                            ) : (
                              <Folder className="h-5 w-5 text-green-500 mt-0.5" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <h3 className="font-semibold text-blue-600 hover:text-blue-700 transition-colors">
                                  {collection.name}
                                </h3>
                                <ExternalLink className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <p className="text-sm text-muted-foreground break-all">{collection.path}</p>
                              {collection.parentPath && (
                                <p className="text-xs text-muted-foreground mt-1">Parent: {collection.parentPath}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            {collection.isSubcollection && <Badge variant="secondary">Subcollection</Badge>}
                            {typeof collection.documentCount === "number" && (
                              <Badge variant="outline">
                                <FileText className="h-3 w-3 mr-1" />
                                {collection.documentCount === -1 ? "Has docs" : `${collection.documentCount} docs`}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {collection.estimatedSize && (
                          <div className="mt-2 text-xs text-muted-foreground">Size: {collection.estimatedSize}</div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
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
