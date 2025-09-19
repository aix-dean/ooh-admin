"use client"

import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import type { ContentMedia } from "@/types/content-media"
import { togglePinStatus } from "@/lib/content-media"

export function usePinStatus(initialItem?: ContentMedia, onSuccess?: (updatedItem: ContentMedia) => void) {
  const [item, setItem] = useState<ContentMedia | undefined>(initialItem)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Update the item if the initialItem changes (e.g., from parent component)
  useEffect(() => {
    if (initialItem && (!item || initialItem.id === item.id) && initialItem.pinned !== item?.pinned) {
      setItem(initialItem)
    }
  }, [initialItem, item])

  const togglePin = async () => {
    if (!item) {
      console.error("Cannot toggle pin status: No item provided")
      return
    }

    try {
      setIsLoading(true)

      // Optimistically update the UI
      const optimisticItem = {
        ...item,
        pinned: !item.pinned,
      }
      setItem(optimisticItem)

      // Update in Firestore with transaction
      const updatedItem = await togglePinStatus(item)

      // Update with the actual result from Firestore
      setItem(updatedItem)

      // Notify parent component
      if (onSuccess) {
        onSuccess(updatedItem)
      }

      // Show success toast
      toast({
        title: updatedItem.pinned ? "Content pinned" : "Content unpinned",
        description: updatedItem.pinned
          ? `"${updatedItem.title}" has been added to pinned content.`
          : `"${updatedItem.title}" has been removed from pinned content.`,
      })
    } catch (error) {
      // Revert optimistic update on error
      setItem(item)

      // Show error toast
      toast({
        title: "Error",
        description: `Failed to ${item.pinned ? "unpin" : "pin"} content: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return {
    item,
    isLoading,
    togglePin,
    isPinning: isLoading,
    startPinning: () => setIsLoading(true),
    stopPinning: () => setIsLoading(false),
  }
}
