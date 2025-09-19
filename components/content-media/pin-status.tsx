"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pin, PinOff, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ContentMedia } from "@/types/content-media"
import { togglePinStatus } from "@/lib/content-media"

interface PinStatusProps {
  item: ContentMedia
  onPinStatusChange: (item: ContentMedia) => void
  disabled?: boolean
  showBadge?: boolean
}

export function PinStatus({ item, onPinStatusChange, disabled = false, showBadge = true }: PinStatusProps) {
  // IMPORTANT: All hooks must be called at the top level, before any conditional logic
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Initialize with a safe default that has the expected properties
  const [currentItem, setCurrentItem] = useState<ContentMedia | null>(null)

  // Safely update currentItem when item prop changes
  useEffect(() => {
    if (item) {
      setCurrentItem(item)
    }
  }, [item])

  // Update when pinned status changes
  useEffect(() => {
    if (item && currentItem && item.id === currentItem.id && item.pinned !== currentItem.pinned && !isLoading) {
      setCurrentItem(item)
    }
  }, [item, currentItem, isLoading])

  // If we don't have a valid item, render nothing
  if (!item || !currentItem) {
    return null
  }

  const handleTogglePin = async () => {
    try {
      setIsLoading(true)

      // Optimistically update the UI
      const optimisticItem = {
        ...currentItem,
        pinned: !currentItem.pinned,
      }
      setCurrentItem(optimisticItem)

      // Update in Firestore with transaction
      const updatedItem = await togglePinStatus(currentItem)

      // Update with the actual result from Firestore
      setCurrentItem(updatedItem)

      // Notify parent component
      onPinStatusChange(updatedItem)

      // Show success toast
      toast({
        title: updatedItem.pinned ? "Content pinned" : "Content unpinned",
        description: updatedItem.pinned
          ? `"${updatedItem.title}" has been added to pinned content.`
          : `"${updatedItem.title}" has been removed from pinned content.`,
      })
    } catch (error) {
      console.error("Pin toggle error:", error)

      // Revert optimistic update on error
      setCurrentItem(currentItem)

      // Show error toast
      toast({
        title: "Error",
        description: `Failed to ${currentItem.pinned ? "unpin" : "pin"} content. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Safe access to pinned property with fallback
  const isPinned = currentItem?.pinned || false

  return (
    <div className="flex items-center gap-2">
      {showBadge && isPinned && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">Pinned</Badge>}
      <Button
        variant="outline"
        size="sm"
        onClick={handleTogglePin}
        disabled={disabled || isLoading}
        aria-label={isPinned ? "Unpin content" : "Pin content"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : isPinned ? (
          <PinOff className="h-4 w-4 mr-1" />
        ) : (
          <Pin className="h-4 w-4 mr-1" />
        )}
        {isPinned ? "Unpin" : "Pin"}
      </Button>
    </div>
  )
}
