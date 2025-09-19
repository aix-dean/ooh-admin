"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { getDocument } from "@/lib/document-operations"
import { DocumentEditor } from "@/components/database/document-editor"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { ArrowLeft, Edit, Eye, FileText, AlertCircle, RefreshCw, Download } from "lucide-react"
import { cn } from "@/lib/utils"

export default function DocumentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const collectionId = decodeURIComponent(params.collectionId as string)
  const documentId = decodeURIComponent(params.documentId as string)

  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    loadDocument()
  }, [collectionId, documentId])

  const loadDocument = async () => {
    setLoading(true)
    setError(null)
    try {
      const doc = await getDocument(collectionId, documentId)
      if (doc) {
        setDocument(doc)
      } else {
        setError("Document not found")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDocumentUpdated = () => {
    loadDocument()
  }

  const formatValue = (value: any): string => {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (typeof value === "object") {
      if (value.toDate && typeof value.toDate === "function") {
        return value.toDate().toLocaleString()
      }
      return JSON.stringify(value, null, 2)
    }
    return String(value)
  }

  const getValueType = (value: any): string => {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (value && value.toDate && typeof value.toDate === "function") return "timestamp"
    if (Array.isArray(value)) return "array"
    return typeof value
  }

  const getTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      string: "bg-blue-100 text-blue-800",
      number: "bg-green-100 text-green-800",
      boolean: "bg-purple-100 text-purple-800",
      object: "bg-orange-100 text-orange-800",
      array: "bg-pink-100 text-pink-800",
      timestamp: "bg-indigo-100 text-indigo-800",
      null: "bg-gray-100 text-gray-800",
      undefined: "bg-gray-100 text-gray-800",
    }
    return colors[type] || "bg-gray-100 text-gray-800"
  }

  const exportDocument = () => {
    const dataStr = JSON.stringify(document, null, 2)
    const dataBlob = new Blob([dataStr], { type: "application/json" })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${documentId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" />
            Loading document...
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => router.push("/dashboard")}>Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink onClick={() => router.push("/dashboard/products")}>Database Controls</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => router.push(`/dashboard/products/collections/${encodeURIComponent(collectionId)}`)}
            >
              {collectionId}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{documentId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center">
              <FileText className="h-8 w-8 mr-3 text-blue-600" />
              {documentId}
            </h1>
            <p className="text-muted-foreground">
              Document in {collectionId} • {Object.keys(document || {}).filter((k) => !k.startsWith("_")).length} fields
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? (
              <>
                <Eye className="h-4 w-4 mr-2" />
                View Mode
              </>
            ) : (
              <>
                <Edit className="h-4 w-4 mr-2" />
                Edit Mode
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" onClick={exportDocument}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadDocument}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <DocumentEditor
          collectionPath={collectionId}
          documentId={documentId}
          onDocumentUpdated={handleDocumentUpdated}
        />
      ) : (
        <Tabs defaultValue="formatted" className="space-y-4">
          <TabsList>
            <TabsTrigger value="formatted">Formatted View</TabsTrigger>
            <TabsTrigger value="raw">Raw JSON</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="formatted">
            <Card>
              <CardHeader>
                <CardTitle>Document Fields</CardTitle>
                <CardDescription>Structured view of document data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {Object.entries(document || {})
                    .filter(([key]) => !key.startsWith("_"))
                    .map(([key, value]) => (
                      <div key={key} className="border rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="font-semibold">{key}</span>
                          <Badge variant="secondary" className={cn("text-xs", getTypeColor(getValueType(value)))}>
                            {getValueType(value)}
                          </Badge>
                        </div>
                        <div className="bg-muted/50 rounded p-3">
                          <pre className="text-sm whitespace-pre-wrap break-words">{formatValue(value)}</pre>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw">
            <Card>
              <CardHeader>
                <CardTitle>Raw JSON</CardTitle>
                <CardDescription>Complete document data in JSON format</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                  {JSON.stringify(document, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metadata">
            <Card>
              <CardHeader>
                <CardTitle>Document Metadata</CardTitle>
                <CardDescription>Technical information about the document</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Document ID</span>
                    <span className="text-muted-foreground">{documentId}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Collection Path</span>
                    <span className="text-muted-foreground">{collectionId}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Field Count</span>
                    <span className="text-muted-foreground">
                      {Object.keys(document || {}).filter((k) => !k.startsWith("_")).length}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="font-medium">Data Size</span>
                    <span className="text-muted-foreground">{JSON.stringify(document).length} bytes</span>
                  </div>
                  {document?._metadata && (
                    <>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">From Cache</span>
                        <span className="text-muted-foreground">{document._metadata.fromCache ? "Yes" : "No"}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b">
                        <span className="font-medium">Pending Writes</span>
                        <span className="text-muted-foreground">
                          {document._metadata.hasPendingWrites ? "Yes" : "No"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
