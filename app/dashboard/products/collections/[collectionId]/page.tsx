"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { collection, getDocs, query, orderBy, limit, startAfter, type DocumentSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  ArrowLeft,
  Search,
  Download,
  RefreshCw,
  FileText,
  Database,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Edit,
  MoreHorizontal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { BulkEditDialog } from "@/components/database/bulk-edit-dialog"
import { SelectionStatus } from "@/components/database/selection-status"

interface DocumentData {
  id: string
  data: Record<string, any>
  createdAt?: Date
  updatedAt?: Date
  size: number
}

interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalDocuments: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  pageSize: number
}

const PAGE_SIZES = [10, 25, 50, 100]

export default function CollectionDocumentsPage() {
  const params = useParams()
  const router = useRouter()
  const collectionId = decodeURIComponent(params.collectionId as string)

  const [documents, setDocuments] = useState<DocumentData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<string>("id")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [pageSize, setPageSize] = useState(25)
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalDocuments: 0,
    hasNextPage: false,
    hasPreviousPage: false,
    pageSize: 25,
  })
  const [lastVisible, setLastVisible] = useState<DocumentSnapshot | null>(null)
  const [firstVisible, setFirstVisible] = useState<DocumentSnapshot | null>(null)
  const [pageHistory, setPageHistory] = useState<DocumentSnapshot[]>([])

  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(false)
  const [selectAllDocuments, setSelectAllDocuments] = useState(false) // New: Select all in dataset
  const [totalDocumentsCount, setTotalDocumentsCount] = useState<number | null>(null) // New: Total count
  const [isLoadingCount, setIsLoadingCount] = useState(false) // New: Loading state for count
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  const handleSelectDocument = (documentId: string, selected: boolean) => {
    if (selected) {
      setSelectedDocuments((prev) => [...prev, documentId])
    } else {
      setSelectedDocuments((prev) => prev.filter((id) => id !== documentId))
    }
  }

  const handleSelectAll = async (selected: boolean) => {
    setSelectAll(selected)

    if (selected) {
      // First select current page documents
      setSelectedDocuments(filteredDocuments.map((doc) => doc.id))

      // If we have more documents than current page, show option to select all
      if (pagination.hasNextPage || pagination.currentPage > 1) {
        // Don't automatically select all documents, just current page
        setSelectAllDocuments(false)
      }
    } else {
      setSelectedDocuments([])
      setSelectAllDocuments(false)
    }
  }

  const handleSelectAllDocuments = async () => {
    if (selectAllDocuments) {
      // Deselect all documents
      setSelectAllDocuments(false)
      setSelectedDocuments([])
      setSelectAll(false)
      return
    }

    setIsLoadingCount(true)
    try {
      // Get total count and all document IDs efficiently
      const { documentIds, totalCount } = await getAllDocumentIds()

      setSelectedDocuments(documentIds)
      setSelectAllDocuments(true)
      setSelectAll(true)
      setTotalDocumentsCount(totalCount)
    } catch (error) {
      console.error("Error selecting all documents:", error)
      setError("Failed to select all documents")
    } finally {
      setIsLoadingCount(false)
    }
  }

  const getAllDocumentIds = async (): Promise<{ documentIds: string[]; totalCount: number }> => {
    const collectionRef = collection(db, collectionId)
    const documentIds: string[] = []
    let totalCount = 0

    // Use pagination to efficiently get all document IDs
    let lastDoc: DocumentSnapshot | null = null
    const batchSize = 1000 // Firestore limit

    do {
      let q = query(collectionRef, limit(batchSize))
      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      }

      const snapshot = await getDocs(q)

      snapshot.docs.forEach((doc) => {
        documentIds.push(doc.id)
        totalCount++
      })

      lastDoc = snapshot.docs[snapshot.docs.length - 1] || null

      // Break if we got fewer documents than batch size (end of collection)
      if (snapshot.docs.length < batchSize) {
        break
      }

      // Safety check to prevent infinite loops with very large collections
      if (totalCount > 100000) {
        throw new Error("Collection too large for bulk selection (>100k documents)")
      }
    } while (lastDoc)

    return { documentIds, totalCount }
  }

  const handleBulkEditComplete = (result: any) => {
    setSelectedDocuments([])
    setSelectAll(false)
    setSelectAllDocuments(false) // New: Reset all documents selection
    setShowBulkEdit(false)
    loadDocuments("first") // Refresh the list
  }

  useEffect(() => {
    loadDocuments()
  }, [collectionId, sortField, sortDirection, pageSize])

  const loadDocuments = async (direction: "next" | "prev" | "first" = "first") => {
    setLoading(true)
    setError(null)

    try {
      const collectionRef = collection(db, collectionId)
      let q = query(collectionRef, limit(pageSize))

      // Add sorting if specified
      if (sortField && sortField !== "id") {
        q = query(q, orderBy(sortField, sortDirection))
      }

      // Handle pagination
      if (direction === "next" && lastVisible) {
        q = query(q, startAfter(lastVisible))
      } else if (direction === "prev" && pageHistory.length > 0) {
        const prevDoc = pageHistory[pageHistory.length - 2]
        if (prevDoc) {
          q = query(q, startAfter(prevDoc))
        } else {
          // Go to first page
          direction = "first"
        }
      }

      const snapshot = await getDocs(q)

      if (snapshot.empty && direction === "first") {
        setDocuments([])
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalDocuments: 0,
          hasNextPage: false,
          hasPreviousPage: false,
          pageSize,
        })
        return
      }

      const docs: DocumentData[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        data: doc.data(),
        size: JSON.stringify(doc.data()).length,
      }))

      setDocuments(docs)

      // Update pagination info
      const newFirstVisible = snapshot.docs[0]
      const newLastVisible = snapshot.docs[snapshot.docs.length - 1]

      setFirstVisible(newFirstVisible)
      setLastVisible(newLastVisible)

      // Update page history for pagination
      if (direction === "next") {
        setPageHistory((prev) => [...prev, firstVisible].filter(Boolean) as DocumentSnapshot[])
        setPagination((prev) => ({
          ...prev,
          currentPage: prev.currentPage + 1,
          hasNextPage: snapshot.docs.length === pageSize,
          hasPreviousPage: true,
        }))
      } else if (direction === "prev") {
        setPageHistory((prev) => prev.slice(0, -1))
        setPagination((prev) => ({
          ...prev,
          currentPage: Math.max(1, prev.currentPage - 1),
          hasNextPage: true,
          hasPreviousPage: prev.currentPage > 2,
        }))
      } else {
        setPageHistory([])
        setPagination({
          currentPage: 1,
          totalPages: 1,
          totalDocuments: docs.length,
          hasNextPage: snapshot.docs.length === pageSize,
          hasPreviousPage: false,
          pageSize,
        })
      }
    } catch (err: any) {
      console.error("Error loading documents:", err)
      setError(formatFirestoreError(err))
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      loadDocuments("first")
      return
    }

    setLoading(true)
    try {
      const collectionRef = collection(db, collectionId)
      // Note: This is a simple search implementation
      // For production, consider using Algolia or similar for full-text search
      const q = query(collectionRef, limit(100))
      const snapshot = await getDocs(q)

      const filteredDocs = snapshot.docs
        .filter((doc) => {
          const docData = doc.data()
          const searchLower = searchTerm.toLowerCase()

          // Search in document ID
          if (doc.id.toLowerCase().includes(searchLower)) return true

          // Search in document fields
          return Object.values(docData).some((value) => String(value).toLowerCase().includes(searchLower))
        })
        .slice(0, pageSize)
        .map((doc) => ({
          id: doc.id,
          data: doc.data(),
          size: JSON.stringify(doc.data()).length,
        }))

      setDocuments(filteredDocs)
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalDocuments: filteredDocs.length,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize,
      })
    } catch (err: any) {
      setError(formatFirestoreError(err))
    } finally {
      setLoading(false)
    }
  }

  const formatFirestoreError = (error: any): string => {
    const errorMap: Record<string, string> = {
      "permission-denied": "You don't have permission to access this collection.",
      "not-found": "Collection not found or doesn't exist.",
      unavailable: "Firestore service is temporarily unavailable.",
      unauthenticated: "Please sign in to access this collection.",
    }

    return errorMap[error.code] || `Error: ${error.message}`
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

  const filteredDocuments = documents.filter((doc) => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      doc.id.toLowerCase().includes(searchLower) ||
      Object.values(doc.data).some((value) => String(value).toLowerCase().includes(searchLower))
    )
  })

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
            <BreadcrumbPage>{collectionId}</BreadcrumbPage>
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
              <Database className="h-8 w-8 mr-3 text-blue-600" />
              {collectionId}
            </h1>
            <p className="text-muted-foreground">Collection documents • {pagination.totalDocuments} items</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => loadDocuments("first")} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {selectedDocuments.length > 0 && (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l">
              <Badge
                variant="secondary"
                className={cn(selectAllDocuments && "bg-blue-100 text-blue-800 border-blue-300")}
              >
                {selectAllDocuments ? (
                  <>
                    <Database className="h-3 w-3 mr-1" />
                    All {totalDocumentsCount?.toLocaleString() || selectedDocuments.length} selected
                  </>
                ) : (
                  `${selectedDocuments.length} selected`
                )}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setShowBulkEdit(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Bulk Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedDocuments([])
                  setSelectAll(false)
                  setSelectAllDocuments(false)
                }}
              >
                Clear Selection
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert className="border-red-200">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search documents by ID or content..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={sortField} onValueChange={setSortField}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="id">Document ID</SelectItem>
                  <SelectItem value="createdAt">Created Date</SelectItem>
                  <SelectItem value="updatedAt">Updated Date</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sortDirection} onValueChange={(value: "asc" | "desc") => setSortDirection(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(Number.parseInt(value))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={selectAll}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label className="text-sm">Select Page ({filteredDocuments.length})</Label>
              </div>
              <CardTitle>Documents</CardTitle>
            </div>
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>Page {pagination.currentPage}</span>
              <span>•</span>
              <span>{filteredDocuments.length} documents</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <SelectionStatus
            selectedCount={selectedDocuments.length}
            totalVisible={filteredDocuments.length}
            isAllDocumentsSelected={selectAllDocuments}
            totalDocumentsCount={totalDocumentsCount}
            isLoadingCount={isLoadingCount}
            hasMorePages={pagination.hasNextPage || pagination.currentPage > 1}
            onSelectAllDocuments={handleSelectAllDocuments}
            onClearSelection={() => {
              setSelectedDocuments([])
              setSelectAll(false)
              setSelectAllDocuments(false)
            }}
          />

          {loading ? (
            <div className="space-y-4">
              {[...Array(pageSize)].map((_, i) => (
                <div key={i} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-5 w-20" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Documents Found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "No documents match your search criteria." : "This collection is empty."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDocuments.map((doc) => (
                <Card key={doc.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-blue-600" />
                        <div>
                          <h3 className="font-semibold text-lg">{doc.id}</h3>
                          <p className="text-sm text-muted-foreground">
                            {Object.keys(doc.data).length} fields • {doc.size} bytes
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.includes(doc.id)}
                          onChange={(e) => handleSelectDocument(doc.id, e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            router.push(
                              `/dashboard/products/collections/${encodeURIComponent(collectionId)}/${encodeURIComponent(doc.id)}`,
                            )
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            router.push(
                              `/dashboard/products/collections/${encodeURIComponent(collectionId)}/${encodeURIComponent(doc.id)}`,
                            )
                          }
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <Tabs defaultValue="formatted" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="formatted">Formatted View</TabsTrigger>
                        <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                      </TabsList>

                      <TabsContent value="formatted" className="mt-4">
                        <div className="space-y-3">
                          {Object.entries(doc.data).map(([key, value]) => (
                            <div key={key} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center space-x-2 mb-1">
                                  <span className="font-medium text-sm">{key}</span>
                                  <Badge
                                    variant="secondary"
                                    className={cn("text-xs", getTypeColor(getValueType(value)))}
                                  >
                                    {getValueType(value)}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground break-all">{formatValue(value)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </TabsContent>

                      <TabsContent value="raw" className="mt-4">
                        <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                          {JSON.stringify(doc.data, null, 2)}
                        </pre>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && filteredDocuments.length > 0 && (
            <div className="flex items-center justify-between mt-6 pt-6 border-t">
              <div className="text-sm text-muted-foreground">Showing {filteredDocuments.length} documents</div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadDocuments("prev")}
                  disabled={!pagination.hasPreviousPage || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-3">Page {pagination.currentPage}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadDocuments("next")}
                  disabled={!pagination.hasNextPage || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <BulkEditDialog
        open={showBulkEdit}
        onOpenChange={setShowBulkEdit}
        collectionPath={collectionId}
        selectedDocuments={selectedDocuments}
        onComplete={handleBulkEditComplete}
      />
    </div>
  )
}
