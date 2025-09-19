"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Trash2, AlertTriangle } from "lucide-react"
import type { Product } from "@/types/product"

interface DeleteDialogProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function DeleteDialog({ product, open, onOpenChange, onConfirm, loading = false }: DeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    if (!product) return

    try {
      setIsDeleting(true)
      await onConfirm()
      onOpenChange(false)
    } catch (error) {
      console.error("Error deleting product:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Don't render if no product is provided
  if (!product) {
    return null
  }

  const isAlreadyDeleted = product.deleted === true

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {isAlreadyDeleted ? "Product Already Deleted" : "Delete Product"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3">
              {isAlreadyDeleted ? (
                <p className="text-muted-foreground">
                  This product has already been marked as deleted and is not visible to users.
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Are you sure you want to delete this product? This action will mark the product as deleted and hide it
                  from users. This action cannot be undone.
                </p>
              )}

              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="flex items-center gap-3">
                  {product.media && product.media.length > 0 ? (
                    <img
                      src={product.media[0].url || "/placeholder.svg"}
                      alt={product.name}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-muted">
                      <Trash2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{product.name}</div>
                    <div className="text-sm text-muted-foreground">{product.site_code}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={product.status === "APPROVED" ? "default" : "outline"}>{product.status}</Badge>
                      {product.active && <Badge variant="outline">Active</Badge>}
                      {isAlreadyDeleted && <Badge variant="destructive">Deleted</Badge>}
                    </div>
                  </div>
                </div>
              </div>

              {!isAlreadyDeleted && (
                <div className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded p-2">
                  <strong>Note:</strong> This will set the 'deleted' field to true. The product will be hidden from
                  users but remain in the database for record keeping.
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting || loading}>
            Cancel
          </Button>
          {!isAlreadyDeleted && (
            <Button variant="destructive" onClick={handleConfirm} disabled={isDeleting || loading}>
              {isDeleting || loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Product
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
