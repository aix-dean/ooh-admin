"use client"

import { useState, useEffect } from "react"
import { Package, Search, Filter, MapPin, Calendar, Star, List, Grid3X3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { ProductService, type PaginatedResult } from "@/lib/product-service"
import type { Product, ProductFilters } from "@/types/product"
import { Skeleton } from "@/components/ui/skeleton"
import { ProductDetailsDialog } from "@/components/products/product-details-dialog"

export default function AdminProductsPage() {
  const [products, setProducts] = useState<PaginatedResult<Product>>({
    data: [],
    totalCount: 0,
    hasNextPage: false,
    hasPreviousPage: false,
    currentPage: 1,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [filters, setFilters] = useState<ProductFilters>({})
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const pageSize = 12
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)

  // Safe display function for fallback values
  const safeDisplay = (value: any, fallback = "-"): string => {
    if (
      value === null ||
      value === undefined ||
      value === "" ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return fallback
    }
    return String(value)
  }

  // Fetch products
  const fetchProducts = async (page = 1, currentFilters: ProductFilters = {}) => {
    try {
      setLoading(true)
      setError(null)
      const result = await ProductService.getProductsPaginated(currentFilters, page, pageSize)
      setProducts(result)
    } catch (err) {
      console.error("Error fetching products:", err)
      setError("Failed to load products. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Initial load
  useEffect(() => {
    fetchProducts(1, filters)
  }, [])

  // Handle search
  const handleSearch = () => {
    const newFilters = { ...filters, search: searchTerm }
    setFilters(newFilters)
    setCurrentPage(1)
    fetchProducts(1, newFilters)
  }

  // Handle filter changes
  const handleFilterChange = (key: keyof ProductFilters, value: any) => {
    const newFilters = { ...filters, [key]: value === "ALL" ? undefined : value }
    setFilters(newFilters)
    setCurrentPage(1)
    fetchProducts(1, newFilters)
  }

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchProducts(page, filters)
  }

  // Format date with fallback
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-"
    try {
      const d = typeof date === "string" ? new Date(date) : date
      if (isNaN(d.getTime())) return "-"
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return "-"
    }
  }

  // Format price with fallback
  const formatPrice = (price: number | null | undefined) => {
    if (price === null || price === undefined || isNaN(price)) return "-"
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 0,
      }).format(price)
    } catch {
      return "-"
    }
  }

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setDetailsDialogOpen(true)
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header Section */}
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Admin - Products Management</h2>
          <p className="text-muted-foreground">Manage products, services, and packages from admin panel</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.totalCount || 0}</div>
            <p className="text-xs text-muted-foreground">{products.totalPages || 0} pages available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Products</CardTitle>
            <Badge variant="secondary" className="h-4 w-4 rounded-full p-0" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.data.filter((p) => p.active).length || 0}</div>
            <p className="text-xs text-muted-foreground">Currently available</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approval</CardTitle>
            <Filter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.data.filter((p) => p.status === "PENDING").length || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting review</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className="text-xl font-bold text-green-600 truncate"
              title={formatPrice(products.data.reduce((sum, p) => sum + (p.price || 0), 0))}
            >
              {products.data.reduce((sum, p) => sum + (p.price || 0), 0) > 999999
                ? `₱${(products.data.reduce((sum, p) => sum + (p.price || 0), 0) / 1000000).toFixed(1)}M`
                : products.data.reduce((sum, p) => sum + (p.price || 0), 0) > 999
                  ? `₱${(products.data.reduce((sum, p) => sum + (p.price || 0), 0) / 1000).toFixed(1)}K`
                  : formatPrice(products.data.reduce((sum, p) => sum + (p.price || 0), 0))}
            </div>
            <p className="text-xs text-muted-foreground">Current page total</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <div className="flex-1">
            <div className="flex gap-2">
              <Input
                placeholder="Search products, sellers, locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
              />
              <Button onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={filters.status || "ALL"} onValueChange={(value) => handleFilterChange("status", value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.type || "ALL"} onValueChange={(value) => handleFilterChange("type", value)}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="Rental">Rental</SelectItem>
                <SelectItem value="Sale">Sale</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.active === undefined ? "ALL" : filters.active.toString()}
              onValueChange={(value) => handleFilterChange("active", value === "ALL" ? undefined : value === "true")}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Active" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="true">Active</SelectItem>
                <SelectItem value="false">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
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

      {/* Error State */}
      {error && (
        <Card className="border-red-200">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p>{error}</p>
              <Button variant="outline" onClick={() => fetchProducts(currentPage, filters)} className="mt-2">
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Display */}
      {loading ? (
        viewMode === "list" ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Updated</TableHead>
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
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: pageSize }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : products.data.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-semibold">No products found</h3>
              <p className="mt-2 text-sm text-gray-500">
                {Object.keys(filters).length > 0 || searchTerm
                  ? "Try adjusting your search or filters"
                  : "Get started by adding your first product"}
              </p>
              {/* Empty state with hyphen placeholders */}
              <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-600">Product Name</div>
                    <div className="text-gray-400">-</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-600">Seller</div>
                    <div className="text-gray-400">-</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-600">Price</div>
                    <div className="text-gray-400">-</div>
                  </div>
                  <div>
                    <div className="font-medium text-gray-600">Location</div>
                    <div className="text-gray-400">-</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : viewMode === "list" ? (
        <div className="rounded-md border bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Product
                  </div>
                </TableHead>
                <TableHead className="font-semibold">Seller</TableHead>
                <TableHead className="font-semibold">Price</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Location</TableHead>
                <TableHead className="font-semibold">Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.data.map((product) => (
                <TableRow key={product.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {product.media && product.media.length > 0 ? (
                        <img
                          src={product.media[0].url || "/placeholder.svg"}
                          alt={safeDisplay(product.name)}
                          className="w-10 h-10 rounded object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg?height=40&width=40"
                          }}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                          -
                        </div>
                      )}
                      <div>
                        <div
                          className="font-medium line-clamp-1 cursor-pointer hover:text-primary hover:underline"
                          onClick={() => handleProductSelect(product)}
                        >
                          {safeDisplay(product.name)}
                        </div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {safeDisplay(product.description?.substring(0, 50) + "...")}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{safeDisplay(product.seller_name)}</div>
                      <div className="text-xs text-muted-foreground">{safeDisplay(product.company_id)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-green-600">{formatPrice(product.price)}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(safeDisplay(product.status))}>
                        {safeDisplay(product.status)}
                      </Badge>
                      {product.active && (
                        <Badge variant="outline" className="text-xs">
                          Active
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{safeDisplay(product.type)}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      {product.specs_rental?.location ? (
                        <>
                          <MapPin className="h-3 w-3 mr-1 text-muted-foreground" />
                          <span className="line-clamp-1 max-w-[150px]">
                            {safeDisplay(product.specs_rental.location)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{formatDate(product.updated)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.data.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle
                      className="text-lg line-clamp-1 cursor-pointer hover:text-primary hover:underline"
                      onClick={() => handleProductSelect(product)}
                    >
                      {safeDisplay(product.name)}
                    </CardTitle>
                    <CardDescription className="text-sm">
                      <div>by {safeDisplay(product.seller_name)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Company: {safeDisplay(product.company_id)}
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={getStatusColor(safeDisplay(product.status))}>{safeDisplay(product.status)}</Badge>
                    {product.active && (
                      <Badge variant="outline" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Product Image */}
                {product.media && product.media.length > 0 ? (
                  <div className="aspect-video bg-gray-100 rounded-md overflow-hidden">
                    <img
                      src={product.media[0].url || "/placeholder.svg"}
                      alt={safeDisplay(product.name)}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = "/placeholder.svg?height=120&width=200"
                      }}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
                    <span className="text-2xl">-</span>
                  </div>
                )}

                {/* Description */}
                <p className="text-sm text-gray-600 line-clamp-2">{safeDisplay(product.description)}</p>

                {/* Price and Type */}
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-green-600">{formatPrice(product.price)}</div>
                  <Badge variant="secondary">{safeDisplay(product.type)}</Badge>
                </div>

                {/* Location */}
                <div className="flex items-center text-sm">
                  {product.specs_rental?.location ? (
                    <>
                      <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                      <span className="line-clamp-1">{safeDisplay(product.specs_rental.location)}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>

                {/* Tags */}
                {product.ai_text_tags && product.ai_text_tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {product.ai_text_tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {safeDisplay(tag)}
                      </Badge>
                    ))}
                    {product.ai_text_tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{product.ai_text_tags.length - 3}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Tags: -</div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t">
                  <div className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {formatDate(product.updated)}
                  </div>
                  <div className="flex items-center">
                    <Star className="h-3 w-3 mr-1" />
                    {safeDisplay(product.rating?.toString(), "0")}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {products.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, products.totalCount)} of{" "}
            {products.totalCount} products
          </div>
          <Pagination>
            <PaginationContent>
              {products.hasPreviousPage && (
                <PaginationItem>
                  <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} className="cursor-pointer" />
                </PaginationItem>
              )}

              {/* Page numbers */}
              {Array.from({ length: Math.min(5, products.totalPages) }, (_, i) => {
                const pageNum = Math.max(1, Math.min(products.totalPages - 4, currentPage - 2)) + i
                if (pageNum <= products.totalPages) {
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => handlePageChange(pageNum)}
                        isActive={pageNum === currentPage}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  )
                }
                return null
              })}

              {products.hasNextPage && (
                <PaginationItem>
                  <PaginationNext onClick={() => handlePageChange(currentPage + 1)} className="cursor-pointer" />
                </PaginationItem>
              )}
            </PaginationContent>
          </Pagination>
        </div>
      )}
      {/* Product Details Dialog */}
      <ProductDetailsDialog
        product={selectedProduct}
        isOpen={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
      />
    </div>
  )
}
