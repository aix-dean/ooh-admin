"use client"
import type { ContentCategory } from "@/types/content-category"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  AlertCircle,
  Edit,
  Trash,
  Trash2,
  RotateCcw,
  Star,
  StarOff,
  Eye,
  EyeOff,
  FileText,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useRouter } from "next/navigation"

interface CategoryListProps {
  categories: ContentCategory[]
  loading: boolean
  error: string | null
  onEdit: (category: ContentCategory) => void
  onDelete: (category: ContentCategory) => void
  onRestore?: (category: ContentCategory) => void
  onToggleFeatured?: (category: ContentCategory) => void
  onToggleActive?: (category: ContentCategory) => void
  showRestore: boolean
  showHardDelete: boolean
}

export function CategoryList({
  categories,
  loading,
  error,
  onEdit,
  onDelete,
  onRestore,
  onToggleFeatured,
  onToggleActive,
  showRestore,
  showHardDelete,
}: CategoryListProps) {
  const { toast } = useToast()
  const router = useRouter()

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

  if (categories.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <p className="text-muted-foreground mb-4">No content categories found</p>
          <p className="text-sm text-muted-foreground">
            {showRestore ? "The trash is empty." : "Create a new content category to get started."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleToggleFeatured = (category: ContentCategory) => {
    if (onToggleFeatured) {
      onToggleFeatured(category)
      toast({
        title: category.featured ? "Removed from featured" : "Added to featured",
        description: `${category.name} has been ${category.featured ? "removed from" : "added to"} featured categories.`,
      })
    }
  }

  const handleToggleActive = (category: ContentCategory) => {
    if (onToggleActive) {
      onToggleActive(category)
      toast({
        title: category.active ? "Deactivated" : "Activated",
        description: `${category.name} has been ${category.active ? "deactivated" : "activated"}.`,
      })
    }
  }

  const navigateToMedia = (categoryId: string, categoryName: string) => {
    router.push(`/dashboard/content/media?category=${categoryId}&categoryName=${encodeURIComponent(categoryName)}`)
  }

  return (
    <div className="space-y-5">
      {categories.map((category) => (
        <Card
          key={category.id}
          className={`overflow-hidden transition-all duration-200 hover:shadow-md ${category.deleted ? "opacity-80" : ""}`}
        >
          <div className="p-5 sm:p-6">
            <div className="flex flex-col lg:flex-row lg:items-start gap-5">
              {/* Left section: Logo and basic info */}
              <div className="flex items-start gap-4 lg:w-1/2">
                {category.logo ? (
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0 shadow-sm">
                    <Image
                      src={category.logo || "/placeholder.svg"}
                      alt={category.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative h-20 w-20 rounded-lg overflow-hidden border bg-gray-50 flex-shrink-0 shadow-sm flex items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <h3
                      className={`font-semibold text-lg truncate hover:text-primary hover:underline cursor-pointer ${category.deleted ? "text-muted-foreground" : ""}`}
                      onClick={() => !category.deleted && navigateToMedia(category.id, category.name)}
                      title={
                        category.deleted ? "Deleted categories cannot be viewed" : `View media in ${category.name}`
                      }
                    >
                      {category.name}
                    </h3>
                    {category.deleted && (
                      <Badge variant="destructive" className="font-medium">
                        Deleted
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 mb-2">
                    <Badge variant="outline" className="font-normal">
                      {category.type}
                    </Badge>
                    {category.featured && (
                      <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200 font-normal">
                        <Star className="h-3 w-3 mr-1 fill-yellow-500 stroke-yellow-600" />
                        Featured
                      </Badge>
                    )}
                    <Badge
                      className={
                        category.active
                          ? "bg-green-100 text-green-800 hover:bg-green-200 border-green-200 font-normal"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200 font-normal"
                      }
                    >
                      {category.active ? (
                        <>
                          <Eye className="h-3 w-3 mr-1" /> Active
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3 w-3 mr-1" /> Inactive
                        </>
                      )}
                    </Badge>
                  </div>

                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {category.description || "No description provided"}
                  </p>
                </div>
              </div>

              {/* Right section: Actions and metadata */}
              <div className="flex flex-col gap-4 lg:w-1/2">
                {/* Metadata section */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-sm bg-muted/30 p-3 rounded-lg">
                  <div className="hidden">
                    <p className="text-muted-foreground text-xs uppercase font-medium">Position</p>
                    <p className="font-medium">{category.position}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium">Pinned Content</p>
                    <p className="font-medium">{category.pinned_content ? "Yes" : "No"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium">Pinned Items</p>
                    <p className="font-medium">{category.pinned_contents?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase font-medium">Created</p>
                    <p className="font-medium">{format(new Date(category.created), "MMM d, yyyy")}</p>
                  </div>
                </div>

                {/* Actions section */}
                <div className="flex flex-wrap gap-2">
                  <TooltipProvider>
                    {!category.deleted && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => navigateToMedia(category.id, category.name)}
                            className="flex-1 sm:flex-none"
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            View Media
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View media in this category</TooltipContent>
                      </Tooltip>
                    )}

                    {!category.deleted && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(category)}
                            className="flex-1 sm:flex-none"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit this category</TooltipContent>
                      </Tooltip>
                    )}

                    {!category.deleted && onToggleFeatured && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleFeatured(category)}
                            className={
                              category.featured
                                ? "border-yellow-200 bg-yellow-50 text-yellow-800 hover:bg-yellow-100"
                                : ""
                            }
                          >
                            {category.featured ? (
                              <>
                                <StarOff className="h-4 w-4 mr-2" /> Unfeature
                              </>
                            ) : (
                              <>
                                <Star className="h-4 w-4 mr-2" /> Feature
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {category.featured ? "Remove from featured" : "Add to featured"}
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {!category.deleted && onToggleActive && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(category)}
                            className={
                              category.active ? "border-green-200 bg-green-50 text-green-800 hover:bg-green-100" : ""
                            }
                          >
                            {category.active ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" /> Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" /> Activate
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{category.active ? "Deactivate category" : "Activate category"}</TooltipContent>
                      </Tooltip>
                    )}

                    {showRestore && onRestore && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onRestore(category)}
                            className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Restore this category</TooltipContent>
                      </Tooltip>
                    )}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`text-destructive hover:text-destructive hover:bg-red-50 ${showHardDelete ? "bg-red-50 border-red-200" : ""}`}
                          onClick={() => onDelete(category)}
                        >
                          {showHardDelete ? (
                            <>
                              <Trash2 className="h-4 w-4 mr-2" /> Delete Permanently
                            </>
                          ) : (
                            <>
                              <Trash className="h-4 w-4 mr-2" /> Delete
                            </>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {showHardDelete ? "Permanently delete this category" : "Move to trash"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
