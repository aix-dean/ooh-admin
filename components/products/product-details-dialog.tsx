"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar, MapPin, Star, Package, User, Tag, Clock, CheckCircle, XCircle } from "lucide-react"
import type { Product } from "@/types/product"

interface ProductDetailsDialogProps {
  product: Product | null
  isOpen: boolean
  onClose: () => void
}

export function ProductDetailsDialog({ product, isOpen, onClose }: ProductDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState("details")

  if (!product) return null

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

  // Format date with fallback
  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-"
    try {
      const d = typeof date === "string" ? new Date(date) : date
      if (isNaN(d.getTime())) return "-"
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
            <Package className="h-5 w-5" />
            {safeDisplay(product.name)}
          </DialogTitle>
          <DialogDescription>
            Product ID: <span className="font-mono">{safeDisplay(product.id)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 mt-2">
          <Badge className={getStatusColor(safeDisplay(product.status))}>{safeDisplay(product.status)}</Badge>
          {product.active ? (
            <Badge variant="outline" className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-1 bg-gray-100">
              <XCircle className="h-3 w-3" /> Inactive
            </Badge>
          )}
          <Badge variant="secondary">{safeDisplay(product.type)}</Badge>
        </div>

        <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="specs">Specifications</TabsTrigger>
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            {/* Basic Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Name</h4>
                    <p className="font-medium">{safeDisplay(product.name)}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Price</h4>
                    <p className="font-bold text-green-600">{formatPrice(product.price)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm">{safeDisplay(product.description)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Seller Information */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Seller Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Seller Name</h4>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <p>{safeDisplay(product.seller_name)}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Company ID</h4>
                    <p className="font-mono text-sm">{safeDisplay(product.company_id)}</p>
                  </div>
                  <div className="md:col-span-2">
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <p>{safeDisplay(product.specs_rental?.location)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Created</h4>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">{formatDate(product.created)}</p>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Last Updated</h4>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm">{formatDate(product.updated)}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="media" className="space-y-4 mt-4">
            {/* Media Gallery */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Media Gallery</CardTitle>
                <CardDescription>
                  {product.media && product.media.length > 0
                    ? `${product.media.length} media items`
                    : "No media available"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {product.media && product.media.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {product.media.map((item, index) => (
                      <div key={index} className="aspect-video bg-gray-100 rounded-md overflow-hidden">
                        <img
                          src={item.url || "/placeholder.svg"}
                          alt={`${safeDisplay(product.name)} - Image ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder.svg?height=120&width=200"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-4xl mb-2">-</div>
                    <p>No media available for this product</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="specs" className="space-y-4 mt-4">
            {/* Specifications */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Product Specifications</CardTitle>
              </CardHeader>
              <CardContent>
                {product.specs_rental ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Rental Specifications</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(product.specs_rental).map(([key, value]) => (
                          <div key={key} className="flex justify-between border-b pb-1">
                            <span className="text-sm font-medium capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="text-sm">{safeDisplay(value?.toString())}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <div className="text-4xl mb-2">-</div>
                    <p>No specifications available for this product</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metadata" className="space-y-4 mt-4">
            {/* Tags */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tags & Categories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {product.ai_text_tags && product.ai_text_tags.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Generated Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {product.ai_text_tags.map((tag, index) => (
                          <Badge key={index} variant="outline" className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {safeDisplay(tag)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground">
                      <div className="text-2xl mb-1">-</div>
                      <p>No tags available</p>
                    </div>
                  )}

                  <Separator />

                  {/* Rating */}
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2">Rating</h4>
                    <div className="flex items-center gap-1">
                      <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium">{safeDisplay(product.rating?.toString(), "0")}</span>
                      <span className="text-sm text-muted-foreground ml-1">
                        ({safeDisplay(product.rating_count?.toString(), "0")} reviews)
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Raw Data */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Raw Data</CardTitle>
                <CardDescription>Complete product data in JSON format</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-xs">
                  {JSON.stringify(product, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
