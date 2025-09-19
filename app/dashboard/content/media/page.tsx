"use client"

import { TabsContent } from "@/components/ui/tabs"

import { TabsTrigger } from "@/components/ui/tabs"

import { TabsList } from "@/components/ui/tabs"

import { Tabs } from "@/components/ui/tabs"

import { BreadcrumbPage } from "@/components/ui/breadcrumb"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, Search, ArrowLeft, Plus, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { DeleteDialog } from "@/components/content-media/delete-dialog"
import {
  getContentMedia,
  softDeleteContentMedia,
  hardDeleteContentMedia,
  restoreContentMedia,
  updateContentMedia,
  getContentMediaTypes,
  getContentMediaById,
  toggleFeatureStatus, // Add this import
} from "@/lib/content-media"
import type { ContentMedia, ContentMediaFilter } from "@/types/content-media"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { EnhancedMediaForm as MediaForm } from "@/components/content-media/enhanced-media-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MediaList } from "@/components/content-media/media-list"
import { Skeleton } from "@/components/ui/skeleton"

export default function ContentMediaPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [navigationInProgress, setNavigationInProgress] = useState(false)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [operationLoading, setOperationLoading] = useState(false)

  // Get category filter from URL
  const categoryId = searchParams.get("category")
  const categoryName = searchParams.get("categoryName")

  const [media, setMedia] = useState<ContentMedia[]>([])
  const [mediaTypes, setMediaTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMedia, setSelectedMedia] = useState<ContentMedia | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHardDelete, setIsHardDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [filter, setFilter] = useState<ContentMediaFilter>({
    category_id: categoryId || undefined,
    type: undefined,
    showDeleted: false,
    searchQuery: "",
    featured: undefined,
    active: undefined,
    pinned: undefined,
  })

  // Check if we're in edit mode
  const editId = searchParams.get("edit")
  const isEditMode = !!editId
  const [mediaItem, setMediaItem] = useState<ContentMedia | null>(null)

  // Clear navigation timeout on component unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
        navigationTimeoutRef.current = null
      }
    }
  }, [])

  // Reset navigation state when URL changes
  useEffect(() => {
    setNavigationInProgress(false)

    // Clear any pending navigation timeout
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current)
      navigationTimeoutRef.current = null
    }
  }, [pathname, searchParams])

  // Restore the active tab from URL parameters
  useEffect(() => {
    if (!isEditMode) {
      const tabParam = searchParams.get("tab")
      if (tabParam && ["all", "featured", "active", "inactive", "deleted", "pinned"].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    }
  }, [searchParams, isEditMode])

  // Restore search parameters from URL
  useEffect(() => {
    if (!isEditMode) {
      const searchQuery = searchParams.get("search")
      const typeFilter = searchParams.get("type")

      if (searchQuery) {
        setFilter((prev) => ({ ...prev, searchQuery }))
      }

      if (typeFilter) {
        setFilter((prev) => ({ ...prev, type: typeFilter }))
      }
    }
  }, [searchParams, isEditMode])

  // Load media types for filtering
  useEffect(() => {
    const loadMediaTypes = async () => {
      try {
        const types = await getContentMediaTypes()
        setMediaTypes(types)
      } catch (error) {
        console.error("Error loading media types:", error)
      }
    }

    loadMediaTypes()
  }, [])

  // Load media
  const loadMedia = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Determine filter based on active tab
      const currentFilter: ContentMediaFilter = { ...filter }

      // Explicitly set showDeleted to false for all tabs except "deleted"
      if (activeTab === "deleted") {
        currentFilter.showDeleted = true
      } else {
        currentFilter.showDeleted = false
      }

      if (activeTab === "featured") {
        currentFilter.featured = true
      } else if (activeTab === "active") {
        currentFilter.active = true
      } else if (activeTab === "inactive") {
        currentFilter.active = false
      } else if (activeTab === "pinned") {
        currentFilter.pinned = true
      } else if (activeTab === "all") {
        // "all" tab
        currentFilter.featured = undefined
        currentFilter.active = undefined
        currentFilter.pinned = undefined
      }

      const data = await getContentMedia(currentFilter)
      setMedia(data)
    } catch (err) {
      setError("Failed to load content media. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, filter])

  // Load data on initial render and when filter changes
  useEffect(() => {
    // Call loadMedia without returning its result
    loadMedia()
  }, [
    activeTab,
    filter.searchQuery,
    filter.showDeleted,
    filter.type,
    filter.featured,
    filter.active,
    filter.pinned,
    filter.category_id,
    loadMedia,
  ])

  // Handle edit
  const handleEdit = useCallback(
    (item: ContentMedia) => {
      // Prevent multiple navigations
      if (navigationInProgress) return
      setNavigationInProgress(true)

      // Navigate to edit page
      const params = new URLSearchParams(searchParams.toString())
      params.set("edit", item.id)

      // Preserve the active tab
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [router, searchParams, pathname, activeTab, navigationInProgress],
  )

  // Handle tab change
  const handleTabChange = useCallback(
    (value: string) => {
      setActiveTab(value)

      // Update URL to reflect the current tab without full page reload
      if (!isEditMode) {
        const params = new URLSearchParams(searchParams.toString())

        if (value !== "all") {
          params.set("tab", value)
        } else {
          params.delete("tab")
        }

        // Preserve category filter
        if (categoryId) {
          params.set("category", categoryId)
        }
        if (categoryName) {
          params.set("categoryName", categoryName)
        }

        const newUrl = `${pathname}?${params.toString()}`
        window.history.pushState({}, "", newUrl)
      }
    },
    [searchParams, pathname, isEditMode, categoryId, categoryName],
  )

  // Handle delete
  const handleDeleteClick = useCallback((item: ContentMedia, isHard = false) => {
    setSelectedMedia(item)
    setIsHardDelete(isHard)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handle restore
  const handleRestore = useCallback(
    async (item: ContentMedia) => {
      try {
        await restoreContentMedia(item.id)
        toast({
          title: "Restored",
          description: `"${item.title}" has been restored.`,
        })
        loadMedia()
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to restore the content media. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast, loadMedia],
  )

  // Handle toggle active
  const handleToggleActive = useCallback(
    async (item: ContentMedia) => {
      try {
        await updateContentMedia(item.id, {
          active: !item.active,
        })

        // Update local state immediately for responsive UI
        setMedia((prevMedia) =>
          prevMedia.map((mediaItem) =>
            mediaItem.id === item.id ? { ...mediaItem, active: !mediaItem.active } : mediaItem,
          ),
        )
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to update the content media. Please try again.",
          variant: "destructive",
        })
        // Refresh from server on error
        loadMedia()
      }
    },
    [toast, loadMedia],
  )

  // Handle toggle pinned - updated to use local state management
  const handleTogglePinned = useCallback(
    (updatedItem: ContentMedia) => {
      // The updated item already has the new pinned state from the PinStatus component
      // Just update our local state to match
      setMedia((prevMedia) => prevMedia.map((item) => (item.id === updatedItem.id ? updatedItem : item)))

      // If we're on the pinned tab and an item was unpinned, it should be removed from the list
      if (activeTab === "pinned" && !updatedItem.pinned) {
        setMedia((prevMedia) => prevMedia.filter((item) => item.id !== updatedItem.id))
      }
    },
    [activeTab],
  )

  // Add a handler for toggling featured status
  // Look for the handleTogglePinned function and add this function after it:

  const handleToggleFeatured = useCallback(
    async (item: ContentMedia) => {
      if (operationLoading) return

      try {
        setOperationLoading(true)
        console.log(
          "Toggle featured called for item:",
          item.id,
          "Current state:",
          item.featured,
          "New state:",
          !item.featured,
        )

        // Call the toggleFeatureStatus function with the item
        // This will now also update the category's pinned_contents array
        const updatedItem = await toggleFeatureStatus(item)
        console.log(
          "Received updated item from toggleFeatureStatus:",
          updatedItem.id,
          "Featured:",
          updatedItem.featured,
        )

        // Update local state immediately for responsive UI
        setMedia((prevMedia) =>
          prevMedia.map((mediaItem) => (mediaItem.id === updatedItem.id ? updatedItem : mediaItem)),
        )

        // If we're on the featured tab and an item was unfeatured, it should be removed from the list
        if (activeTab === "featured" && !updatedItem.featured) {
          setMedia((prevMedia) => prevMedia.filter((item) => item.id !== updatedItem.id))
        }

        // Show success toast
        toast({
          title: updatedItem.featured ? "Added to featured" : "Removed from featured",
          description: `"${item.title}" has been ${updatedItem.featured ? "added to" : "removed from"} featured content.`,
        })
      } catch (err) {
        console.error("Error toggling featured status:", err)

        toast({
          title: "Error",
          description: "Failed to update the featured status. Please try again.",
          variant: "destructive",
        })

        // Refresh from server on error
        loadMedia()
      } finally {
        setOperationLoading(false)
      }
    },
    [toast, loadMedia, activeTab, operationLoading],
  )

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (!selectedMedia) return

    try {
      if (isHardDelete) {
        await hardDeleteContentMedia(selectedMedia.id)
        toast({
          title: "Permanently deleted",
          description: `"${selectedMedia.title}" has been permanently removed.`,
        })
      } else {
        await softDeleteContentMedia(selectedMedia.id)
        toast({
          title: "Moved to trash",
          description: `"${selectedMedia.title}" has been moved to trash.`,
        })
      }

      // Update local state immediately
      setMedia((prevMedia) => prevMedia.filter((item) => item.id !== selectedMedia.id))

      // Return a resolved promise to signal completion
      return Promise.resolve()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete the content media. Please try again.",
        variant: "destructive",
      })

      // Rethrow to signal failure
      throw err
    } finally {
      setIsDeleteDialogOpen(false)
      setSelectedMedia(null)
    }
  }, [selectedMedia, isHardDelete, toast])

  // Handle form success (creation or update)
  const handleFormSuccess = useCallback(
    (id?: string) => {
      // Prevent multiple navigations
      if (navigationInProgress) return
      setNavigationInProgress(true)

      // Refresh the data
      loadMedia()

      // Construct the URL with the appropriate parameters
      const params = new URLSearchParams()

      // Add success parameter
      if (id) {
        params.set("success", id)
      } else {
        params.set("success", "new")
      }

      // Add tab parameter if not "all"
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      // Add category parameter if it exists
      if (categoryId) {
        params.set("category", categoryId)
      }
      if (categoryName) {
        params.set("categoryName", categoryName)
      }

      const newUrl = `${pathname}?${params.toString()}`

      // Set a timeout to reset navigation state in case the navigation doesn't complete
      navigationTimeoutRef.current = setTimeout(() => {
        setNavigationInProgress(false)
      }, 1000)

      // Push the new URL to the history stack
      router.push(newUrl)
    },
    [router, loadMedia, pathname, activeTab, categoryId, categoryName, navigationInProgress],
  )

  // Handle cancel button click - go to list view
  const handleCancel = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // Go to the default list view with the current tab and category
    const params = new URLSearchParams()

    // Add tab parameter if not "all"
    if (activeTab !== "all") {
      params.set("tab", activeTab)
    }

    // Add category parameter if it exists
    if (categoryId) {
      params.set("category", categoryId)
    }
    if (categoryName) {
      params.set("categoryName", categoryName)
    }

    // Add any search query if it exists
    if (filter.searchQuery) {
      params.set("search", filter.searchQuery)
    }

    // Add type filter if it exists
    if (filter.type) {
      params.set("type", filter.type)
    }

    // Set a timeout to reset navigation state in case the navigation doesn't complete
    navigationTimeoutRef.current = setTimeout(() => {
      setNavigationInProgress(false)
    }, 1000)

    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, activeTab, categoryId, categoryName, filter.searchQuery, filter.type, navigationInProgress])

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setFilter((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  // Handle type filter
  const handleTypeFilter = useCallback((type: string | undefined) => {
    setFilter((prev) => ({ ...prev, type }))
  }, [])

  // Reset all filters except category
  const resetFilters = useCallback(() => {
    setFilter({
      category_id: categoryId || undefined,
      type: undefined,
      showDeleted: activeTab === "deleted",
      searchQuery: "",
      featured: undefined,
      active: undefined,
      pinned: undefined,
    })

    // Update URL to remove filter parameters
    const params = new URLSearchParams(searchParams.toString())
    params.delete("search")
    params.delete("type")

    // Preserve category filter
    if (categoryId) {
      params.set("category", categoryId)
    }
    if (categoryName) {
      params.set("categoryName", categoryName)
    }

    const newUrl = `${pathname}?${params.toString()}`
    window.history.pushState({}, "", newUrl)
  }, [searchParams, pathname, activeTab, categoryId, categoryName])

  // Handle add new media
  const handleAddMedia = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // Preserve the category filter when adding new media
    const params = new URLSearchParams()
    params.set("edit", "new")

    // Add category parameter if it exists
    if (categoryId) {
      params.set("category", categoryId)
    }
    if (categoryName) {
      params.set("categoryName", categoryName)
    }

    // Add tab parameter if not "all"
    if (activeTab !== "all") {
      params.set("tab", activeTab)
    }

    // Set a timeout to reset navigation state in case the navigation doesn't complete
    navigationTimeoutRef.current = setTimeout(() => {
      setNavigationInProgress(false)
    }, 1000)

    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, activeTab, categoryId, categoryName, navigationInProgress])

  // Navigate back to categories
  const navigateToCategories = useCallback(() => {
    // Set a timeout to reset navigation state in case the navigation doesn't complete
    navigationTimeoutRef.current = setTimeout(() => {
      setNavigationInProgress(false)
    }, 1000)

    router.push("/dashboard/content/4ps")
  }, [router])

  // Load media item if editing
  useEffect(() => {
    const loadMediaItem = async () => {
      if (editId && editId !== "new") {
        setLoading(true)
        try {
          const item = await getContentMediaById(editId)
          setMediaItem(item)
        } catch (error) {
          console.error("Error loading media item:", error)
        } finally {
          setLoading(false)
        }
      } else if (editId === "new") {
        setMediaItem(null)
        setLoading(false)
      } else {
        setMediaItem(null)
      }
    }

    loadMediaItem()
  }, [editId])

  // Handle form success
  const handleFormSuccessNew = useCallback(() => {
    // Clear the edit parameter from the URL
    const url = new URL(window.location.href)
    url.searchParams.delete("edit")
    window.history.pushState({}, "", url.toString())

    // Reset the media item
    setMediaItem(null)
    loadMedia()

    // Reset navigation state
    setNavigationInProgress(false)
  }, [loadMedia])

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    // Clear the edit parameter from the URL
    const url = new URL(window.location.href)
    url.searchParams.delete("edit")
    window.history.pushState({}, "", url.toString())

    // Reset the media item
    setMediaItem(null)

    // Reset navigation state
    setNavigationInProgress(false)
  }, [])

  // If we're editing, show the form
  if (editId || loading) {
    return (
      <div className="space-y-6">
        <div>
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/content/4ps">4Ps Categories</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{categoryName ? decodeURIComponent(categoryName) : "All Media"}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">
                {categoryName ? `${decodeURIComponent(categoryName)} Media` : "Content Media"}
              </h1>
              <p className="text-muted-foreground">
                {categoryName
                  ? `Manage media content for the ${decodeURIComponent(categoryName)} category`
                  : "Manage all media content"}
              </p>
            </div>
            <Button variant="outline" onClick={navigateToCategories}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Categories
            </Button>
          </div>
        </div>
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle>{editId !== "new" ? "Edit Media" : "Create New Media"}</CardTitle>
            <CardDescription>
              {editId !== "new"
                ? "Update the details of an existing media item"
                : `Create a new media item${categoryName ? ` for ${decodeURIComponent(categoryName)}` : ""}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <MediaForm
                id={editId}
                categoryId={categoryId || undefined}
                categoryName={categoryName ? decodeURIComponent(categoryName) : undefined}
                contentMedia={mediaItem}
                onSuccess={handleFormSuccessNew}
                onCancel={handleFormCancel}
                onBack={navigateToCategories}
              />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/content/4ps">4Ps Categories</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{categoryName ? decodeURIComponent(categoryName) : "All Media"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              {categoryName ? `${decodeURIComponent(categoryName)} Media` : "Content Media"}
            </h1>
            <p className="text-muted-foreground">
              {categoryName
                ? `Manage media content for the ${decodeURIComponent(categoryName)} category`
                : "Manage all media content"}
            </p>
          </div>
          <Button variant="outline" onClick={navigateToCategories}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Categories
          </Button>
        </div>
      </div>

      <>
        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertDescription>
            {categoryName
              ? `Viewing media content for the ${decodeURIComponent(categoryName)} category. You can filter, search, and manage media items.`
              : "View and manage all media content. You can filter by category, type, and other attributes."}
          </AlertDescription>
        </Alert>

        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search media..."
                className="pl-8"
                value={filter.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                aria-label="Search media"
              />
            </div>

            <Select
              value={filter.type || "all_types"}
              onValueChange={(value) => handleTypeFilter(value === "all_types" ? undefined : value)}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all_types">All Types</SelectItem>
                {mediaTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(filter.searchQuery || filter.type) && (
              <Button variant="outline" onClick={resetFilters} className="whitespace-nowrap">
                Clear Filters
              </Button>
            )}
          </div>

          {/* Add the Create New Media button here */}
          <div className="flex items-center gap-4">
            <Button
              onClick={handleAddMedia}
              disabled={navigationInProgress}
              className="focus:ring-2 focus:ring-primary/50 transition-all duration-200"
              aria-label="Create new media"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Media
            </Button>
          </div>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="featured">Featured</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
            <TabsTrigger value="deleted">Trash</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <MediaList
              media={media}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleFeatured={handleToggleFeatured}
              onToggleActive={handleToggleActive}
              onTogglePinned={handleTogglePinned}
              showRestore={false}
              showHardDelete={false}
            />
          </TabsContent>

          <TabsContent value="featured" className="mt-0">
            <MediaList
              media={media}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleFeatured={handleToggleFeatured}
              onToggleActive={handleToggleActive}
              onTogglePinned={handleTogglePinned}
              showRestore={false}
              showHardDelete={false}
            />
          </TabsContent>

          <TabsContent value="active" className="mt-0">
            <MediaList
              media={media}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleFeatured={handleToggleFeatured}
              onToggleActive={handleToggleActive}
              onTogglePinned={handleTogglePinned}
              showRestore={false}
              showHardDelete={false}
            />
          </TabsContent>

          <TabsContent value="inactive" className="mt-0">
            <MediaList
              media={media}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleFeatured={handleToggleFeatured}
              onToggleActive={handleToggleActive}
              onTogglePinned={handleTogglePinned}
              showRestore={false}
              showHardDelete={false}
            />
          </TabsContent>

          <TabsContent value="deleted" className="mt-0">
            <MediaList
              media={media}
              loading={loading}
              error={error}
              onEdit={handleEdit}
              onDelete={(item) => handleDeleteClick(item, true)}
              onRestore={handleRestore}
              onToggleFeatured={handleToggleFeatured}
              onToggleActive={handleToggleActive}
              onTogglePinned={handleTogglePinned}
              showRestore={true}
              showHardDelete={true}
            />
          </TabsContent>
        </Tabs>
      </>

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title={isHardDelete ? "Permanently Delete Media" : "Delete"}
        description={
          isHardDelete
            ? "This action cannot be undone. This will permanently delete the content media."
            : "This will move the content media to trash. You can restore it later if needed."
        }
        confirmText={isHardDelete ? "Permanently Delete" : "Delete"}
      />
    </div>
  )
}

function MediaListSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="p-4 border rounded-md">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-md" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
