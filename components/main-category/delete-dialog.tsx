"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertTriangle, Trash2 } from "lucide-react"
import { softDeleteMainCategory, hardDeleteMainCategory, restoreMainCategory } from "@/lib/main-category"

interface DeleteDialogProps {
  categoryId: string
  categoryName: string
  isOpen: boolean
  isDeleted: boolean
  onClose: () => void
  onSuccess: () => void
}

export function DeleteDialog({ categoryId, categoryName, isOpen, isDeleted, onClose, onSuccess }: DeleteDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleSoftDelete = async () => {
    setIsLoading(true)
    try {
      await softDeleteMainCategory(categoryId)
      toast({
        title: "Category moved to trash",
        description: `"${categoryName}" has been moved to trash.`,
      })
      onSuccess()
    } catch (error) {
      console.error("Error soft deleting category:", error)
      toast({
        title: "Error",
        description: "Failed to move category to trash. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      onClose()
    }
  }

  const handleHardDelete = async () => {
    setIsLoading(true)
    try {
      await hardDeleteMainCategory(categoryId)
      toast({
        title: "Category permanently deleted",
        description: `"${categoryName}" has been permanently deleted.`,
      })
      onSuccess()
    } catch (error) {
      console.error("Error hard deleting category:", error)
      toast({
        title: "Error",
        description: "Failed to delete category permanently. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      onClose()
    }
  }

  const handleRestore = async () => {
    setIsLoading(true)
    try {
      await restoreMainCategory(categoryId)
      toast({
        title: "Category restored",
        description: `"${categoryName}" has been restored.`,
      })
      onSuccess()
    } catch (error) {
      console.error("Error restoring category:", error)
      toast({
        title: "Error",
        description: "Failed to restore category. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
            {isDeleted ? "Permanently Delete Category?" : "Delete Category?"}
          </DialogTitle>
          <DialogDescription>
            {isDeleted
              ? `Are you sure you want to permanently delete "${categoryName}"? This action cannot be undone.`
              : `Are you sure you want to delete "${categoryName}"? You can restore it later from the trash.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <div className="flex space-x-2">
            {isDeleted ? (
              <>
                <Button variant="outline" onClick={handleRestore} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Restore
                </Button>
                <Button variant="destructive" onClick={handleHardDelete} disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete Permanently
                </Button>
              </>
            ) : (
              <Button variant="destructive" onClick={handleSoftDelete} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
