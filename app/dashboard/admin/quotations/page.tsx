"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Search,
  Building,
  Building2,
  Mail,
  Phone,
  FileText,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  Grid3X3,
  List,
} from "lucide-react"
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  where,
  type DocumentSnapshot,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatDistanceToNow } from "date-fns"
import { QuotationMemberDetailsDialog } from "@/components/quotations/quotation-member-details-dialog"

interface QuotationRequest {
  id: string
  break_date: any
  company: string
  company_address: string
  company_id: string
  contact_number: string
  created: any
  email_address: string
  end_date: any
  name: string
  position: string
  product_id: string
  product_ref: any
  start_date: any
  status: "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING"
}

const statusConfig = {
  PENDING: { color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock },
  APPROVED: { color: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle },
  REJECTED: { color: "bg-red-100 text-red-800 border-red-200", icon: XCircle },
  PROCESSING: { color: "bg-blue-100 text-blue-800 border-blue-200", icon: AlertCircle },
}

const formatDate = (timestamp: any) => {
  if (!timestamp) return "N/A"
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default function AdminQuotationsPage() {
  const [quotations, setQuotations] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [pageCache, setPageCache] = useState<
    Map<number, { docs: QuotationRequest[]; lastDoc: DocumentSnapshot | null; firstDoc: DocumentSnapshot | null }>
  >(new Map())

  const [selectedQuotation, setSelectedQuotation] = useState<QuotationRequest | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  const pageSize = 12

  const fetchQuotations = async (page = 1, useCache = true) => {
    try {
      setLoading(true)
      setError(null)

      // Check cache first
      if (useCache && pageCache.has(page)) {
        const cached = pageCache.get(page)!
        setQuotations(cached.docs)
        setCurrentPage(page)
        setLoading(false)
        return
      }

      const quotationsRef = collection(db, "quotation_request")
      let quotationsQuery = query(quotationsRef, orderBy("created", "desc"), limit(pageSize))

      // Add status filter if not 'all'
      if (statusFilter !== "all") {
        quotationsQuery = query(
          quotationsRef,
          where("status", "==", statusFilter.toUpperCase()),
          orderBy("created", "desc"),
          limit(pageSize),
        )
      }

      // Handle pagination
      if (page > 1) {
        const skipCount = (page - 1) * pageSize

        if (statusFilter !== "all") {
          quotationsQuery = query(
            quotationsRef,
            where("status", "==", statusFilter.toUpperCase()),
            orderBy("created", "desc"),
            limit(pageSize * page),
          )
        } else {
          quotationsQuery = query(quotationsRef, orderBy("created", "desc"), limit(pageSize * page))
        }

        const allSnapshot = await getDocs(quotationsQuery)
        const allDocs = allSnapshot.docs

        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const pageDocuments = allDocs.slice(startIndex, endIndex)

        const quotationsData = pageDocuments.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as QuotationRequest[]

        const filteredQuotations = searchTerm
          ? quotationsData.filter(
              (quotation) =>
                quotation.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quotation.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quotation.email_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quotation.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                quotation.company_id?.toLowerCase().includes(searchTerm.toLowerCase()),
            )
          : quotationsData

        setQuotations(filteredQuotations)
        setCurrentPage(page)
        setLoading(false)
        return
      }

      const snapshot = await getDocs(quotationsQuery)
      const quotationsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as QuotationRequest[]

      const filteredQuotations = searchTerm
        ? quotationsData.filter(
            (quotation) =>
              quotation.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quotation.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quotation.email_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quotation.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              quotation.company_id?.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        : quotationsData

      const newLastDoc = snapshot.docs[snapshot.docs.length - 1] || null
      const newFirstDoc = snapshot.docs[0] || null

      setPageCache(
        (prev) =>
          new Map(
            prev.set(page, {
              docs: filteredQuotations,
              lastDoc: newLastDoc,
              firstDoc: newFirstDoc,
            }),
          ),
      )

      setQuotations(filteredQuotations)
      setCurrentPage(page)

      if (page === 1) {
        const countQuery =
          statusFilter !== "all"
            ? query(quotationsRef, where("status", "==", statusFilter.toUpperCase()))
            : quotationsRef
        const countSnapshot = await getCountFromServer(countQuery)
        setTotalCount(countSnapshot.data().count)
      }
    } catch (err) {
      console.error("Error fetching quotations:", err)
      setError("Failed to load quotations. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setPageCache(new Map())
    fetchQuotations(1, false)
  }, [statusFilter])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (currentPage === 1) {
        fetchQuotations(1, false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  useEffect(() => {
    if (searchTerm) {
      setCurrentPage(1)
      setPageCache(new Map())
    }
  }, [searchTerm])

  const handlePageChange = (page: number) => {
    fetchQuotations(page)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const getStatusCounts = () => {
    const counts = {
      total: quotations.length,
      pending: quotations.filter((q) => q.status === "PENDING").length,
      approved: quotations.filter((q) => q.status === "APPROVED").length,
      processing: quotations.filter((q) => q.status === "PROCESSING").length,
    }
    return counts
  }

  const StatusBadge = ({ status }: { status: string }) => {
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING
    const Icon = config.icon

    return (
      <Badge variant="outline" className={`${config.color} border`}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    )
  }

  const handleMemberClick = (quotation: QuotationRequest) => {
    setSelectedQuotation(quotation)
    setDetailsDialogOpen(true)
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Quotations</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchQuotations(1, false)}>Try Again</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin - Quotations Management</h2>
          <p className="text-muted-foreground">Manage quotation requests from admin panel</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Quotations</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">All time requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatusCounts().pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatusCounts().processing}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatusCounts().approved}</div>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search quotations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")}>
            <List className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "card" ? "default" : "outline"} size="sm" onClick={() => setViewMode("card")}>
            <Grid3X3 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        viewMode === "list" ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: pageSize }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: pageSize }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : quotations.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No quotations found</h3>
          <p className="text-muted-foreground">
            {searchTerm || statusFilter !== "all"
              ? "Try adjusting your search or filter criteria."
              : "No quotation requests have been submitted yet."}
          </p>
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-md border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Name & Position
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Company
                  </div>
                </TableHead>
                <TableHead className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Contact
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Dates</TableHead>
                <TableHead className="font-semibold">Product ID</TableHead>
                <TableHead className="font-semibold">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotations.map((quotation) => (
                <TableRow key={quotation.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div
                      className="font-medium cursor-pointer hover:text-blue-600 hover:underline transition-colors"
                      onClick={() => handleMemberClick(quotation)}
                    >
                      {quotation.name}
                    </div>
                    <div className="text-sm text-muted-foreground">{quotation.position}</div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{quotation.company}</div>
                      <div className="text-xs text-muted-foreground">ID: {quotation.company_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Mail className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span className="truncate max-w-[200px]">{quotation.email_address}</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="h-3 w-3 mr-1 text-muted-foreground" />
                        <span>{quotation.contact_number}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={quotation.status} />
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      <div>Start: {formatDate(quotation.start_date)}</div>
                      <div>End: {formatDate(quotation.end_date)}</div>
                      {quotation.break_date && (
                        <div className="text-muted-foreground">Break: {formatDate(quotation.break_date)}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{quotation.product_id}</span>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {quotation.created && formatDistanceToNow(quotation.created.toDate(), { addSuffix: true })}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {quotations.map((quotation) => (
            <Card key={quotation.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg line-clamp-1">{quotation.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {quotation.position} at {quotation.company}
                    </CardDescription>
                    <CardDescription className="text-xs text-muted-foreground mt-1">
                      ID: {quotation.company_id}
                    </CardDescription>
                  </div>
                  <StatusBadge status={quotation.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Contact Information */}
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span className="truncate">{quotation.email_address}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Phone className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span>{quotation.contact_number}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Building className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span className="truncate">{quotation.company_address}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Building2 className="h-3 w-3 mr-2 text-muted-foreground" />
                    <span className="font-medium">Company ID: {quotation.company_id}</span>
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Start Date:</span>
                    <span className="font-medium">{formatDate(quotation.start_date)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">End Date:</span>
                    <span className="font-medium">{formatDate(quotation.end_date)}</span>
                  </div>
                  {quotation.break_date && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Break Date:</span>
                      <span className="font-medium">{formatDate(quotation.break_date)}</span>
                    </div>
                  )}
                </div>

                {/* Product Reference */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Product ID:</span>
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{quotation.product_id}</span>
                  </div>
                </div>

                {/* Created Date */}
                <div className="flex items-center justify-between text-xs pt-2 border-t">
                  <span className="text-muted-foreground">Submitted:</span>
                  <span className="font-medium">
                    {quotation.created && formatDistanceToNow(quotation.created.toDate(), { addSuffix: true })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount}{" "}
            quotations
          </div>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => currentPage > 1 && handlePageChange(currentPage - 1)}
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <PaginationItem key={`page-${pageNum}`}>
                    <PaginationLink
                      onClick={() => handlePageChange(pageNum)}
                      isActive={currentPage === pageNum}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                )
              })}

              <PaginationItem>
                <PaginationNext
                  onClick={() => currentPage < totalPages && handlePageChange(currentPage + 1)}
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
      {/* Member Details Dialog */}
      <QuotationMemberDetailsDialog
        quotation={selectedQuotation}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />
    </div>
  )
}
