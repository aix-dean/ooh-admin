"use client"

import { useState, useEffect, useRef } from "react"
import { Star } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { ContentMedia } from "@/types/content-media"

interface FeatureStatusProps {
  item: ContentMedia
  onFeatureStatusChange: (item: ContentMedia) => void
  disabled?: boolean
  showBadge?: boolean
}

export function FeatureStatus({ item, onFeatureStatusChange, disabled = false, showBadge = true }: FeatureStatusProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [currentFeatured, setCurrentFeatured] = useState(item.featured)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const starRef = useRef<HTMLDivElement>(null)

  // Update local state when prop changes
  useEffect(() => {
    setCurrentFeatured(item.featured)
    setIsLoading(false)
  }, [item.featured])

  const handleToggleFeatured = async () => {
    if (disabled || isLoading) return

    // Set loading state
    setIsLoading(true)

    // Create a copy of the item with the toggled featured state
    const updatedItem = {
      ...item,
      featured: !currentFeatured,
    }

    // Update local state immediately for responsive UI
    setCurrentFeatured(!currentFeatured)

    // Trigger animation
    setIsAnimating(true)
    setTimeout(() => setIsAnimating(false), 500)

    try {
      // Call the parent handler with the updated item
      await onFeatureStatusChange(updatedItem)
    } catch (error) {
      // If there's an error, revert the local state
      console.error("Error toggling featured status:", error)
      setCurrentFeatured(currentFeatured)
      setIsLoading(false)
    }
  }

  // Handle mouse events
  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => setIsHovered(false)

  if (!item) return null

  return (
    <div className="flex items-center gap-2">
      {showBadge && currentFeatured && (
        <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200">
          Featured
        </Badge>
      )}

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`h-10 w-10 rounded-full transition-all duration-200 ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              } ${
                currentFeatured
                  ? "bg-amber-100 text-amber-600 hover:bg-amber-200 hover:text-amber-700 shadow-sm star-button-featured"
                  : "bg-gray-200 text-gray-600 hover:bg-amber-50 hover:text-amber-600 border-2 border-dashed border-gray-400"
              }`}
              disabled={disabled || isLoading}
              onClick={handleToggleFeatured}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              aria-label={currentFeatured ? "Unfeature content" : "Feature content"}
            >
              <div ref={starRef} className={`relative ${isAnimating ? "star-featured" : ""}`}>
                {isLoading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
                {!isLoading && !currentFeatured && !isHovered && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-tight">Pin</span>
                  </div>
                )}
                {!isLoading && (
                  <Star
                    className={`h-6 w-6 transition-all duration-200 ${isLoading ? "opacity-0" : ""} ${
                      currentFeatured
                        ? "fill-amber-500 stroke-amber-600"
                        : isHovered
                          ? "fill-amber-100 stroke-amber-500"
                          : "fill-transparent stroke-gray-500 stroke-[1.5px] opacity-80"
                    }`}
                  />
                )}
              </div>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{isLoading ? "Updating..." : currentFeatured ? "Unpin featured content" : "Pin as featured"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
