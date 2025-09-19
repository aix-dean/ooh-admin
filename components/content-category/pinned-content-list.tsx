"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, PinOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import type { ContentCategory } from "@/types/content-category"
import type { ContentMedia } from "@/types/content-media"
import { getContentMediaById, unpinContentMedia } from "@/lib/content-media"

interface PinnedContentListProps {
  category: ContentCategory
  onUpdate: () => void
}

export function PinnedContentList({ category, onUpdate }: PinnedContentListProps) {
  const [pinnedItems, setPinnedItems] = useState<ContentMedia[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    async function loadPinnedContent() {
      try {
        setLoading(true)
        setError(null)

        // If there are no pinned contents, skip loading
        if (!category.pinned_contents || category.pinned_contents.length === 0) {
          setPinnedItems([])
          return
        }

        // Load each pinned content item
        const items: ContentMedia[] = []
        for (const contentId of category.pinned_contents) {
          try {
            const item = await getContentMediaById(contentId)
            if (item && !item.deleted) {
              items.push(item)
            }
          } catch (itemError) {
            console.error(`Error loading pinned content ${contentId}:`, itemError)
            // Continue with other items
          }
        }

        setPinnedItems(items)
      } catch (error) {
        console.error("Error loading pinned content:", error)
        setError(`Failed to load pinned content: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setLoading(false)
      }
    }

    loadPinnedContent()
  }, [category.pinned_contents])

  const handleUnpin = async (item: ContentMedia) => {
    try {
      // Unpin the item
      await unpinContentMedia(item)

      // Remove from local state
      setPinnedItems((prev) => prev.filter((i) => i.id !== item.id))

      // Notify parent component to refresh
      onUpdate()

      // Show success toast
      toast({
        title: "Content unpinned",
        description: `"${item.title}" has been removed from pinned content.`,
        variant: "default",
      })
    } catch (error) {
      console.error("Error unpinning content:", error)

      // Show error toast
      toast({
        title: "Error",
        description: `Failed to unpin content: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pinned Content</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pinned Content</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-destructive/10 p-4 rounded-md flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <h3 className="font-medium text-destructive">Error</h3>
              <p className="text-sm text-destructive-foreground">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (pinnedItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pinned Content</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <p className="text-muted-foreground mb-4">No pinned content</p>
          <p className="text-sm text-muted-foreground">
            Pin content items to display them prominently in this category.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pinned Content ({pinnedItems.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pinnedItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium">{item.title}</h3>
                  <Badge variant="outline">{item.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleUnpin(item)}>
                <PinOff className="h-4 w-4 mr-1" />
                Unpin
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
