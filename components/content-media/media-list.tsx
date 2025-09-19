"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import type { ContentMedia } from "@/types/content-media"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Edit, Trash2, RefreshCw, Clock, CalendarClock, FileText, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
// Import the FeatureStatus component
import { FeatureStatus } from "./feature-status"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

import { ChevronDown, ChevronUp } from "lucide-react"

// Collapsible Text Component for truncating and expanding text
interface CollapsibleTextProps {
  text: string
  maxLength: number
  className?: string
}

const CollapsibleText = ({ text, maxLength, className = "" }: CollapsibleTextProps) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const needsCollapse = text.length > maxLength

  const toggleExpand = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={`relative ${className}`}>
      <p className={`text-sm ${!isExpanded && needsCollapse ? "line-clamp-3" : ""}`}>{text}</p>
      {needsCollapse && (
        <button
          onClick={toggleExpand}
          className="text-xs flex items-center text-primary hover:text-primary/80 mt-1 font-medium"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3 w-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3 mr-1" />
              Read more
            </>
          )}
        </button>
      )}
    </div>
  )
}

interface MediaListProps {
  media: ContentMedia[]
  loading: boolean
  error: string | null
  onEdit: (item: ContentMedia) => void
  onDelete: (item: ContentMedia) => void
  onRestore?: (item: ContentMedia) => void
  onToggleFeatured?: (item: ContentMedia) => void
  onToggleActive?: (item: ContentMedia) => void
  showRestore: boolean
  showHardDelete: boolean
}

// Add a function to format dates for display
const formatScheduleDate = (dateString?: string) => {
  if (!dateString) return "Not set"
  try {
    const date = new Date(dateString)
    return format(date, "MMM d, yyyy h:mm a")
  } catch (e) {
    return "Invalid date"
  }
}

// Format relative time (e.g., "2 hours ago")
const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return "Unknown time"
  try {
    const date = new Date(dateString)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (e) {
    return "Unknown time"
  }
}

// Add a new function to determine if a media item is currently scheduled
const getScheduleStatus = (
  startDate?: string,
  endDate?: string,
): { status: string; variant: "default" | "secondary" | "outline" | "destructive" } => {
  if (!startDate && !endDate) {
    return { status: "No schedule", variant: "outline" }
  }

  const now = new Date()
  const start = startDate ? new Date(startDate) : null
  const end = endDate ? new Date(endDate) : null

  if (start && end) {
    if (now < start) {
      return { status: "Scheduled", variant: "secondary" }
    } else if (now >= start && now <= end) {
      return { status: "Active now", variant: "default" }
    } else {
      return { status: "Expired", variant: "destructive" }
    }
  } else if (start && !end) {
    if (now < start) {
      return { status: "Starts soon", variant: "secondary" }
    } else {
      return { status: "Started", variant: "default" }
    }
  } else if (!start && end) {
    if (now <= end) {
      return { status: "Ends soon", variant: "default" }
    } else {
      return { status: "Ended", variant: "destructive" }
    }
  }

  return { status: "Unknown", variant: "outline" }
}

// Add debug logging to help diagnose media display issues
export function MediaList({
  media: initialMedia,
  loading,
  error,
  onEdit,
  onDelete,
  onRestore,
  onToggleFeatured,
  onToggleActive,
  showRestore = false,
  showHardDelete = false,
}: MediaListProps) {
  // Use local state to track media items for immediate UI updates
  const [media, setMedia] = useState<ContentMedia[]>(initialMedia || [])
  const [isFeaturing, setIsFeaturing] = useState(false)
  const { toast } = useToast()
  const [debugItemId, setDebugItemId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>(null)

  // Add debug logging when media list is rendered
  useEffect(() => {
    if (initialMedia && initialMedia.length > 0) {
      console.log("Media list items:", initialMedia.length)
      console.log("First media item sample:", initialMedia[0])
    }
  }, [initialMedia])

  // Update local state when props change
  useEffect(() => {
    if (initialMedia) {
      setMedia(initialMedia)
    }
  }, [initialMedia])

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div>
          <h3 className="font-medium text-destructive">Error</h3>
          <p className="text-sm text-destructive-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!media || media.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6">
          <p className="text-muted-foreground mb-4">No media found</p>
          <p className="text-sm text-muted-foreground">
            {showRestore ? "The trash is empty." : "Create a new media to get started."}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Handle toggle featured
  const handleFeatureStatusChange = async (updatedItem: ContentMedia) => {
    if (isFeaturing || !updatedItem) return

    try {
      setIsFeaturing(true)
      console.log("Feature status change requested for item:", updatedItem.id, "New state:", updatedItem.featured)

      // Optimistically update the UI
      const updatedMedia = media.map((mediaItem) =>
        mediaItem && updatedItem && mediaItem.id === updatedItem.id ? updatedItem : mediaItem,
      )
      setMedia(updatedMedia)

      // Call the parent component's handler
      if (onToggleFeatured) {
        await onToggleFeatured(updatedItem)

        // Show success toast
        toast({
          title: updatedItem.featured ? "Added to featured" : "Removed from featured",
          description: `"${updatedItem.title}" has been ${updatedItem.featured ? "added to" : "removed from"} featured content.`,
        })

        // If we're on the featured tab and an item was unfeatured, it should be removed from the list
        if (activeTab === "featured" && !updatedItem.featured) {
          setMedia((prevMedia) => prevMedia.filter((item) => item.id !== updatedItem.id))
        }
      }
    } catch (error) {
      console.error("Error handling feature status change:", error)

      // Revert the optimistic update
      setMedia(initialMedia || [])

      // Show error toast
      toast({
        title: "Error",
        description: `Failed to update feature status. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setIsFeaturing(false)
    }
  }

  const handleToggleActive = (item: ContentMedia) => {
    if (onToggleActive && item) {
      onToggleActive(item)
    }
  }

  const handleRestore = (id: string) => {
    if (onRestore && id) {
      const itemToRestore = media.find((item) => item && item.id === id)
      if (itemToRestore) {
        onRestore(itemToRestore)
      }
    }
  }

  // Add a new handler for delete operations that also handles featured status and pinned content
  const handleDelete = async (item: ContentMedia) => {
    if (item.deleted) {
      // If already deleted, just restore
      handleRestore(item.id)
      return
    }

    try {
      // If the item is featured, unfeatured it first
      if (item.featured && onToggleFeatured) {
        // Create a copy with featured set to false for the toggle function
        const unfeaturedItem = { ...item, featured: false }
        await onToggleFeatured(unfeaturedItem)

        // Show toast notification
        toast({
          title: "Item unfeatured",
          description: `"${item.title}" has been removed from featured content.`,
        })
      }

      // If the item is pinned, we need to ensure it's unpinned
      // This is typically handled by the delete function in content-media.ts
      // but we're making it explicit here

      // Finally, proceed with the delete operation
      onDelete(item)
    } catch (error) {
      console.error("Error during delete operation:", error)
      toast({
        title: "Error",
        description: "Failed to delete item. Please try again.",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {media.map((item) => {
        // Skip rendering if item is undefined or missing required properties
        if (!item || !item.id) return null

        // Get the synopsis or fallback to description
        const synopsisText = item.synopsis || item.description || "No description available"

        return (
          <Card key={item.id} className="overflow-hidden flex flex-col h-full">
            <div className="relative">
              {/* Enhanced thumbnail/video preview with proper aspect ratio */}
              <div className="w-full aspect-video overflow-hidden bg-muted rounded-t-lg">
                {item.type === "Video" || item.type === "HPV" ? (
                  // For video content, show video player with thumbnail poster
                  <video
                    className="object-cover w-full h-full"
                    poster={item.thumbnail || "/placeholder.svg?height=180&width=320&text=Video"}
                    preload="metadata"
                    onError={(e) => {
                      // Fallback to thumbnail image if video fails
                      const target = e.currentTarget
                      target.style.display = "none"
                      const img = target.nextElementSibling as HTMLImageElement
                      if (img) {
                        img.style.display = "block"
                      }
                    }}
                  >
                    {/* Look for video URL in media array */}
                    {item.media?.find(
                      (mediaItem) =>
                        mediaItem.url &&
                        (mediaItem.url.toLowerCase().includes(".mp4") ||
                          mediaItem.url.toLowerCase().includes(".webm") ||
                          mediaItem.url.toLowerCase().includes(".mov") ||
                          mediaItem.url.toLowerCase().includes("video")),
                    )?.url && (
                      <source
                        src={
                          item.media.find(
                            (mediaItem) =>
                              mediaItem.url &&
                              (mediaItem.url.toLowerCase().includes(".mp4") ||
                                mediaItem.url.toLowerCase().includes(".webm") ||
                                mediaItem.url.toLowerCase().includes(".mov") ||
                                mediaItem.url.toLowerCase().includes("video")),
                          )?.url
                        }
                        type="video/mp4"
                      />
                    )}
                  </video>
                ) : null}

                {/* Fallback thumbnail image */}
                <Image
                  src={item.thumbnail || "/placeholder.svg?height=180&width=320&text=Media"}
                  alt={item.title || "Media item"}
                  fill
                  className={`object-cover ${item.type === "Video" || item.type === "HPV" ? "hidden" : ""}`}
                  style={{ display: item.type === "Video" || item.type === "HPV" ? "none" : "block" }}
                  onError={(e) => {
                    // Final fallback if thumbnail fails to load
                    e.currentTarget.src = "/placeholder.svg?height=180&width=320&text=Media"
                  }}
                />

                {/* Video play overlay for video content */}
                {(item.type === "Video" || item.type === "HPV") && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                    <div className="bg-white/90 rounded-full p-3 shadow-lg">
                      <Play className="h-6 w-6 text-gray-800 ml-1" />
                    </div>
                  </div>
                )}
              </div>

              {/* Featured star icon - now more prominent */}
              <div className="absolute top-2 right-2">
                <FeatureStatus
                  item={item}
                  onFeatureStatusChange={handleFeatureStatusChange}
                  disabled={isFeaturing || !!item.deleted}
                  showBadge={false}
                />
              </div>

              {/* Type badge */}
              <div className="absolute top-2 left-2">
                <Badge variant={item.type === "Video" ? "default" : item.type === "Article" ? "secondary" : "outline"}>
                  {item.type || "Unknown"}
                </Badge>
              </div>
            </div>

            <CardHeader className="pb-2">
              <CardTitle className="line-clamp-2 text-lg">{item.title || "Untitled"}</CardTitle>

              {/* Author and timestamp info */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <span className="line-clamp-1">{item.author || "Unknown author"}</span>
                <span className="text-xs">•</span>
                <span className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(item.updated || item.created || "")}
                </span>
              </div>

              {/* Synopsis as main description */}
              <div className="mt-1 border-l-2 border-primary/20 pl-3">
                <CollapsibleText text={synopsisText} maxLength={150} className="text-foreground/80" />
              </div>
            </CardHeader>

            <CardContent className="pb-2 space-y-4">
              {/* Additional Content Section - Only show if there's body content and it's different from synopsis */}
              {item.body && item.body !== synopsisText && (
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h4 className="text-sm font-medium">Content</h4>
                  </div>
                  <CollapsibleText text={item.body} maxLength={120} />
                </div>
              )}

              {/* Schedule information display */}
              {(item.start_date || item.end_date) && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center gap-1.5 text-xs">
                    <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-medium">Schedule:</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1 pl-5">
                    {item.start_date && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">From:</span>
                        <span>{formatScheduleDate(item.start_date)}</span>
                      </div>
                    )}

                    {item.end_date && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">To:</span>
                        <span>{formatScheduleDate(item.end_date)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status badges */}
              <div className="flex flex-wrap gap-2 pt-1">
                {item.active ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Inactive
                  </Badge>
                )}

                {item.featured && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    Featured
                  </Badge>
                )}

                {item.public ? (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Public
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Private
                  </Badge>
                )}
              </div>
            </CardContent>

            <CardFooter className="pt-2 mt-auto">
              <div className="flex justify-between w-full">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(item)}>
                        {item.deleted ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.deleted ? "Restore item" : "Move to trash"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button variant="outline" size="sm" onClick={() => onEdit(item)} disabled={!!item.deleted}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
