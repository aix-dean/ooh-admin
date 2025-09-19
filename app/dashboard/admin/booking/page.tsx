"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Search,
  Calendar,
  User,
  Building2,
  CreditCard,
  Package,
  Star,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  ExternalLink,
  LayoutGrid,
  List,
  Copy,
} from "lucide-react"
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  where,
  getCountFromServer,
  doc,
  getDoc,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Booking {
  id: string
  cancel_reason: string
  company_id: string
  cost: number
  created: any
  media_order: string
  payment_method: string
  product_id: string
  product_owner: string
  quantity: number
  rated: boolean
  seller_id: string
  status: string
  total_cost: number
  type: string
  user_id: string
  username: string
}

const ITEMS_PER_PAGE = 12

const statusConfig = {
  COMPLETED: { color: "bg-green-100 text-green-800" },
  PENDING: { color: "bg-yellow-100 text-yellow-800" },
  CANCELLED: { color: "bg-red-100 text-red-800" },
  PROCESSING: { color: "bg-blue-100 text-blue-800" },
  CONFIRMED: { color: "bg-emerald-100 text-emerald-800" },
  "FOR CONTRACT": { color: "bg-purple-100 text-purple-800" },
}

const typeConfig = {
  MERCHANDISE: { color: "bg-purple-100 text-purple-800" },
  SERVICE: { color: "bg-indigo-100 text-indigo-800" },
  CONSULTATION: { color: "bg-orange-100 text-orange-800" },
  RENTAL: { color: "bg-teal-100 text-teal-800" },
}

export default function AdminBookingPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [pageCache, setPageCache] = useState<Map<number, { data: Booking[]; lastDoc: any }>>(new Map())
  const [viewMode, setViewMode] = useState<"list" | "card">("list") // Default to list view
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false)
  const [userData, setUserData] = useState<Map<string, any>>(new Map())
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set())

  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    cancelled: 0,
  })

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(price)
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const safeDisplay = (value: any, formatter?: (val: any) => string): string => {
    if (value === undefined || value === null || value === "") {
      return "-"
    }
    return formatter ? formatter(value) : String(value)
  }

  const fetchUserData = async (userId: string) => {
    if (userData.has(userId) || loadingUsers.has(userId)) {
      return // Already fetched or currently fetching
    }

    setLoadingUsers((prev) => new Set(prev).add(userId))

    try {
      const userDoc = await getDoc(doc(db, "users", userId))
      if (userDoc.exists()) {
        const user = userDoc.data()
        setUserData((prev) =>
          new Map(prev).set(userId, {
            displayName:
              user.display_name || user.displayName || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
            email: user.email,
            firstName: user.first_name || user.firstName,
            lastName: user.last_name || user.lastName,
          }),
        )
      } else {
        // Try iboard_users collection if not found in users
        const iboardUserDoc = await getDoc(doc(db, "iboard_users", userId))
        if (iboardUserDoc.exists()) {
          const user = iboardUserDoc.data()
          setUserData((prev) =>
            new Map(prev).set(userId, {
              displayName:
                user.display_name || user.displayName || `${user.first_name || ""} ${user.last_name || ""}`.trim(),
              email: user.email,
              firstName: user.first_name || user.firstName,
              lastName: user.last_name || user.lastName,
            }),
          )
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    } finally {
      setLoadingUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const getUserDisplayName = (booking: Booking) => {
    const user = userData.get(booking.user_id)
    if (user) {
      return user.displayName || user.email || booking.username || "Unknown User"
    }
    return booking.username || "Loading..."
  }

  const fetchBookings = async (page = 1, useCache = true) => {
    try {
      setLoading(true)
      setError(null)

      // Check cache first
      if (useCache && pageCache.has(page)) {
        const cached = pageCache.get(page)!
        setBookings(cached.data)
        setLastDoc(cached.lastDoc)
        setLoading(false)
        return
      }

      const bookingsRef = collection(db, "booking")
      let bookingQuery = query(bookingsRef, orderBy("created", "desc"), limit(ITEMS_PER_PAGE))

      // Apply filters
      if (statusFilter !== "all") {
        bookingQuery = query(
          bookingsRef,
          where("status", "==", statusFilter),
          orderBy("created", "desc"),
          limit(ITEMS_PER_PAGE),
        )
      }

      if (typeFilter !== "all") {
        bookingQuery = query(
          bookingsRef,
          where("type", "==", typeFilter),
          orderBy("created", "desc"),
          limit(ITEMS_PER_PAGE),
        )
      }

      // Handle pagination
      if (page > 1) {
        const prevPageData = pageCache.get(page - 1)
        if (prevPageData?.lastDoc) {
          bookingQuery = query(
            bookingsRef,
            orderBy("created", "desc"),
            startAfter(prevPageData.lastDoc),
            limit(ITEMS_PER_PAGE),
          )
        }
      }

      const snapshot = await getDocs(bookingQuery)
      const bookingData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Booking[]

      const newLastDoc = snapshot.docs[snapshot.docs.length - 1]

      // Cache the results
      setPageCache((prev) => new Map(prev.set(page, { data: bookingData, lastDoc: newLastDoc })))

      setBookings(bookingData)
      setLastDoc(newLastDoc)

      // Get total count
      const countSnapshot = await getCountFromServer(collection(db, "booking"))
      setTotalCount(countSnapshot.data().count)
    } catch (err) {
      console.error("Error fetching bookings:", err)
      setError("Failed to load bookings. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const bookingsRef = collection(db, "booking")

      const [totalSnap, completedSnap, pendingSnap, cancelledSnap] = await Promise.all([
        getCountFromServer(bookingsRef),
        getCountFromServer(query(bookingsRef, where("status", "==", "COMPLETED"))),
        getCountFromServer(query(bookingsRef, where("status", "==", "PENDING"))),
        getCountFromServer(query(bookingsRef, where("status", "==", "CANCELLED"))),
      ])

      setStats({
        total: totalSnap.data().count,
        completed: completedSnap.data().count,
        pending: pendingSnap.data().count,
        cancelled: cancelledSnap.data().count,
      })
    } catch (err) {
      console.error("Error fetching stats:", err)
    }
  }

  useEffect(() => {
    fetchBookings(1, false)
    fetchStats()
  }, [statusFilter, typeFilter])

  useEffect(() => {
    fetchBookings(currentPage)
  }, [currentPage])

  useEffect(() => {
    // Fetch user data for all bookings using user_id (customer)
    bookings.forEach((booking) => {
      if (booking.user_id) {
        fetchUserData(booking.user_id)
      }
    })
  }, [bookings])

  const filteredBookings = bookings.filter((booking) => {
    const searchLower = searchTerm.toLowerCase()
    return (
      booking.username?.toLowerCase().includes(searchLower) ||
      booking.company_id?.toLowerCase().includes(searchLower) ||
      booking.product_owner?.toLowerCase().includes(searchLower) ||
      booking.payment_method?.toLowerCase().includes(searchLower) ||
      booking.seller_id?.toLowerCase().includes(searchLower) ||
      booking.product_id?.toLowerCase().includes(searchLower)
    )
  })

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleRetry = () => {
    setPageCache(new Map()) // Clear cache
    fetchBookings(1, false)
    fetchStats()
  }

  const toggleViewMode = () => {
    setViewMode(viewMode === "list" ? "card" : "list")
  }

  const openBookingDetails = (booking: Booking) => {
    setSelectedBooking(booking)
    setIsBookingDialogOpen(true)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h3 className="text-lg font-semibold">Error Loading Bookings</h3>
          <p className="text-muted-foreground text-center">{error}</p>
          <Button onClick={handleRetry} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin - Booking Management</h2>
          <p className="text-muted-foreground">Manage service bookings and reservations from admin panel</p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time bookings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.completed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Successfully completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.cancelled.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Cancelled bookings</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and View Toggle */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bookings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="PROCESSING">Processing</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="FOR CONTRACT">For Contract</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="MERCHANDISE">Merchandise</SelectItem>
              <SelectItem value="SERVICE">Service</SelectItem>
              <SelectItem value="CONSULTATION">Consultation</SelectItem>
              <SelectItem value="RENTAL">Rental</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon"
            onClick={toggleViewMode}
            className="flex-shrink-0"
            title={viewMode === "list" ? "Switch to card view" : "Switch to list view"}
          >
            {viewMode === "list" ? <LayoutGrid className="h-4 w-4" /> : <List className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Bookings Display */}
      {loading ? (
        viewMode === "list" ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-[150px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[100px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[80px]" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-[120px]" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 12 }).map((_, i) => (
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
      ) : filteredBookings.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Package className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">No bookings found</h3>
          <p className="text-muted-foreground text-center">
            {searchTerm || statusFilter !== "all" || typeFilter !== "all"
              ? "Try adjusting your search or filters"
              : "No bookings have been created yet"}
          </p>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-sm text-right font-medium">Status:</div>
            <div className="text-sm">-</div>
            <div className="text-sm text-right font-medium">Type:</div>
            <div className="text-sm">-</div>
            <div className="text-sm text-right font-medium">Customer:</div>
            <div className="text-sm">-</div>
            <div className="text-sm text-right font-medium">Total:</div>
            <div className="text-sm">-</div>
          </div>
        </div>
      ) : viewMode === "list" ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Media</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBookings.map((booking) => {
                return (
                  <TableRow key={booking.id} className="hover:bg-muted/50">
                    <TableCell>
                      <div>
                        <div
                          className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          onClick={() => openBookingDetails(booking)}
                        >
                          {getUserDisplayName(booking) || "-"}
                          {loadingUsers.has(booking.user_id) && (
                            <span className="ml-2 text-xs text-gray-400">(loading...)</span>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {userData.get(booking.user_id)?.email || booking.username || "-"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{booking.status || "-"}</TableCell>
                    <TableCell>{booking.type || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <Building2 className="h-3 w-3 mr-2 text-muted-foreground" />
                        {booking.company_id || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <CreditCard className="h-3 w-3 mr-2 text-muted-foreground" />
                        {booking.payment_method || "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {booking.total_cost ? formatPrice(booking.total_cost) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3 mr-1" />
                        {booking.created ? formatDate(booking.created) : "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {booking.media_order ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="text-xs p-0 h-auto text-blue-600 hover:text-blue-800"
                          onClick={() => window.open(booking.media_order, "_blank")}
                        >
                          View <ExternalLink className="h-3 w-3 ml-1 inline" />
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredBookings.map((booking) => {
            return (
              <Card key={booking.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-1">
                        {getUserDisplayName(booking) || "-"}
                        {loadingUsers.has(booking.user_id) && (
                          <span className="ml-2 text-xs text-gray-400">(loading...)</span>
                        )}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {userData.get(booking.user_id)?.email || `by ${booking.product_owner}` || "-"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-medium">
                        Status: <span>{booking.status || "-"}</span>
                      </div>
                      <div className="text-sm font-medium">
                        Type: <span>{booking.type || "-"}</span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Company Information */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Building2 className="h-3 w-3 mr-2 text-muted-foreground" />
                      <span className="truncate">{booking.company_id || "-"}</span>
                    </div>
                  </div>

                  {/* Payment & Cost Information */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <CreditCard className="h-3 w-3 mr-2 text-muted-foreground" />
                      <span className="truncate">{booking.payment_method || "-"}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Cost:</span>
                      <span className="font-semibold">
                        {booking.total_cost ? formatPrice(booking.total_cost) : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Quantity:</span>
                      <span className="font-medium">{booking.quantity || "-"}</span>
                    </div>
                  </div>

                  {/* Product Information */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm">
                      <Package className="h-3 w-3 mr-2 text-muted-foreground" />
                      <span className="truncate text-xs">{booking.product_id || "-"}</span>
                    </div>
                    {booking.media_order ? (
                      <Button
                        variant="link"
                        size="sm"
                        className="text-xs p-0 h-auto text-blue-600 hover:text-blue-800"
                        onClick={() => window.open(booking.media_order, "_blank")}
                      >
                        Media Order <ExternalLink className="h-3 w-3 ml-1 inline" />
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Rating & Additional Info */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm">
                      <Star className={`h-3 w-3 mr-1 ${booking.rated ? "text-yellow-500" : "text-muted-foreground"}`} />
                      <span className="text-xs">{booking.rated ? "Rated" : "Not Rated"}</span>
                    </div>
                    {booking.cancel_reason ? (
                      <div className="text-xs text-red-600 truncate max-w-[100px]" title={booking.cancel_reason}>
                        Cancelled: {booking.cancel_reason}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </div>

                  {/* Timestamps */}
                  <div className="pt-2 border-t">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      <span>Created: {booking.created ? formatDate(booking.created) : "-"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Booking Details Dialog */}
      {selectedBooking && (
        <Dialog open={isBookingDialogOpen} onOpenChange={setIsBookingDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                Booking Details - {safeDisplay(selectedBooking.username)}
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="booking" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="booking">Booking Info</TabsTrigger>
                <TabsTrigger value="customer">Customer</TabsTrigger>
                <TabsTrigger value="product">Product</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              </TabsList>

              <TabsContent value="booking" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <Package className="h-5 w-5 mr-2" />
                        Booking Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Booking ID:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{safeDisplay(selectedBooking.id)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedBooking.id || "")}
                            className="h-6 w-6 p-0"
                            disabled={!selectedBooking.id}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Status:</span>
                        <span className="text-sm font-medium">{selectedBooking.status || "-"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Type:</span>
                        <span className="text-sm font-medium">{selectedBooking.type || "-"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Quantity:</span>
                        <span className="text-sm">{safeDisplay(selectedBooking.quantity)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Unit Cost:</span>
                        <span className="text-sm font-semibold">{safeDisplay(selectedBooking.cost, formatPrice)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Total Cost:</span>
                        <span className="text-lg font-bold text-green-600">
                          {safeDisplay(selectedBooking.total_cost, formatPrice)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Rated:</span>
                        <div className="flex items-center">
                          <Star
                            className={`h-4 w-4 mr-1 ${selectedBooking.rated ? "text-yellow-500" : "text-gray-400"}`}
                          />
                          <span className="text-sm">{selectedBooking.rated ? "Yes" : "No"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center">
                        <CreditCard className="h-5 w-5 mr-2" />
                        Payment & Company
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Payment Method:</span>
                        <span className="text-sm">{safeDisplay(selectedBooking.payment_method)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Company ID:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{safeDisplay(selectedBooking.company_id)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedBooking.company_id || "")}
                            className="h-6 w-6 p-0"
                            disabled={!selectedBooking.company_id}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Seller ID:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono">{safeDisplay(selectedBooking.seller_id)}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(selectedBooking.seller_id || "")}
                            className="h-6 w-6 p-0"
                            disabled={!selectedBooking.seller_id}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {selectedBooking.cancel_reason && (
                        <div className="space-y-2">
                          <span className="text-sm font-medium text-red-600">Cancel Reason:</span>
                          <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{selectedBooking.cancel_reason}</p>
                        </div>
                      )}
                      {selectedBooking.media_order ? (
                        <div className="space-y-2">
                          <span className="text-sm font-medium">Media Order:</span>
                          <Button
                            variant="link"
                            size="sm"
                            className="text-blue-600 hover:text-blue-800 p-0 h-auto"
                            onClick={() => window.open(selectedBooking.media_order, "_blank")}
                          >
                            View Media Order <ExternalLink className="h-3 w-3 ml-1 inline" />
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <span className="text-sm font-medium">Media Order:</span>
                          <span className="text-sm text-gray-500">N/A</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="customer" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <User className="h-5 w-5 mr-2" />
                      Customer Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Customer Name:</span>
                      <span className="text-sm font-semibold">{safeDisplay(selectedBooking.username)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">User ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{safeDisplay(selectedBooking.user_id)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedBooking.user_id || "")}
                          className="h-6 w-6 p-0"
                          disabled={!selectedBooking.user_id}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Product Owner:</span>
                      <span className="text-sm">{safeDisplay(selectedBooking.product_owner)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">User Data:</span>
                      <span className="text-sm">
                        {userData.get(selectedBooking.user_id)
                          ? userData.get(selectedBooking.user_id).displayName || "No display name"
                          : "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="product" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Package className="h-5 w-5 mr-2" />
                      Product Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Product ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{safeDisplay(selectedBooking.product_id)}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(selectedBooking.product_id || "")}
                          className="h-6 w-6 p-0"
                          disabled={!selectedBooking.product_id}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Product Owner:</span>
                      <span className="text-sm">{safeDisplay(selectedBooking.product_owner)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Service Type:</span>
                      {selectedBooking.type ? (
                        <Badge
                          variant="outline"
                          className={
                            typeConfig[selectedBooking.type as keyof typeof typeConfig]?.color ||
                            "bg-gray-100 text-gray-800"
                          }
                        >
                          {selectedBooking.type}
                        </Badge>
                      ) : (
                        <span className="text-sm text-gray-500">N/A</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="timeline" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Calendar className="h-5 w-5 mr-2" />
                      Booking Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Booking Created</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedBooking.created ? formatDate(selectedBooking.created) : "N/A"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            selectedBooking.status === "COMPLETED"
                              ? "bg-green-500"
                              : selectedBooking.status === "PENDING"
                                ? "bg-yellow-500"
                                : selectedBooking.status === "CANCELLED"
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                          }`}
                        ></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium">Current Status: {selectedBooking.status}</p>
                          <p className="text-xs text-muted-foreground">
                            {selectedBooking.status === "COMPLETED"
                              ? "Booking has been completed successfully"
                              : selectedBooking.status === "PENDING"
                                ? "Booking is awaiting processing"
                                : selectedBooking.status === "CANCELLED"
                                  ? "Booking has been cancelled"
                                  : "Booking is being processed"}
                          </p>
                        </div>
                      </div>

                      {selectedBooking.rated && (
                        <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Service Rated</p>
                            <p className="text-xs text-muted-foreground">Customer has provided a rating</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of{" "}
            {totalCount} bookings
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1
              return (
                <Button
                  key={page}
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(page)}
                >
                  {page}
                </Button>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
