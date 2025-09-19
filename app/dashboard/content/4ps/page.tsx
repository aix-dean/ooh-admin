"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { CategoryList } from "@/components/content-category/category-list"
import { CategoryForm } from "@/components/content-category/category-form"
import { DeleteDialog } from "@/components/content-category/delete-dialog"
import {
  getContentCategories,
  softDeleteContentCategory,
  hardDeleteContentCategory,
  restoreContentCategory,
  updateContentCategory,
  getContentTypes,
} from "@/lib/content-category"
import type { ContentCategory, ContentCategoryFilter } from "@/types/content-category"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function FourPsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [navigationInProgress, setNavigationInProgress] = useState(false)

  const [categories, setCategories] = useState<ContentCategory[]>([])
  const [contentTypes, setContentTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<ContentCategory | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHardDelete, setIsHardDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [filter, setFilter] = useState<ContentCategoryFilter>({
    type: undefined,
    showDeleted: false,
    searchQuery: "",
    featured: undefined,
    active: undefined,
  })
  const [redirectSuccess, setRedirectSuccess] = useState<string | null>(null)

  // Check if we're in edit mode
  const editId = searchParams.get("edit")
  const isEditMode = !!editId

  // Check for success redirect parameter
  const successId = searchParams.get("success")

  // Restore the active tab from URL parameters
  useEffect(() => {
    if (!isEditMode) {
      const tabParam = searchParams.get("tab")
      if (tabParam && ["all", "featured", "active", "inactive", "deleted"].includes(tabParam)) {
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

  // Handle success redirect parameter
  useEffect(() => {
    if (successId) {
      setRedirectSuccess(successId)

      // Clear the success parameter from URL without refreshing the page
      // but preserve other parameters like tab
      const params = new URLSearchParams(searchParams.toString())
      params.delete("success")

      const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
      window.history.replaceState({}, "", newUrl)

      // Show success toast
      toast({
        title: "Success",
        description: "Content category has been saved successfully",
        variant: "default",
      })

      // Clear success message after a delay
      const timer = setTimeout(() => {
        setRedirectSuccess(null)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [successId, toast, searchParams, pathname])

  // Load content types for filtering
  useEffect(() => {
    const loadContentTypes = async () => {
      try {
        const types = await getContentTypes()
        setContentTypes(types)
      } catch (error) {
        console.error("Error loading content types:", error)
      }
    }

    loadContentTypes()
  }, [])

  // Load categories
  const loadCategories = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Determine filter based on active tab
      const currentFilter: ContentCategoryFilter = { ...filter }

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
      } else if (activeTab === "all") {
        // "all" tab
        currentFilter.featured = undefined
        currentFilter.active = undefined
      }

      const data = await getContentCategories(currentFilter)
      setCategories(data)
    } catch (err) {
      setError("Failed to load content categories. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, filter])

  // Load data on initial render and when filter changes
  useEffect(() => {
    loadCategories()
  }, [activeTab, filter.searchQuery, filter.showDeleted, filter.type, filter.featured, filter.active, loadCategories])

  // Handle edit
  const handleEdit = useCallback(
    (category: ContentCategory) => {
      // Prevent multiple navigations
      if (navigationInProgress) return
      setNavigationInProgress(true)

      // Navigate to edit page
      const params = new URLSearchParams(searchParams.toString())
      params.set("edit", category.id)

      // Preserve the active tab
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [router, searchParams, pathname, activeTab, navigationInProgress],
  )

  // Handle form success (creation or update)
  const handleFormSuccess = useCallback(
    (id?: string) => {
      // Prevent multiple navigations
      if (navigationInProgress) return
      setNavigationInProgress(true)

      // Refresh the data
      loadCategories()

      // Preserve the active tab when redirecting
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

      // Redirect with parameters
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, loadCategories, pathname, activeTab, navigationInProgress],
  )

  // Handle back button click - go back to list view
  const handleBack = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // Go to the default list view with the current tab
    const params = new URLSearchParams()

    // Add tab parameter if not "all"
    if (activeTab !== "all") {
      params.set("tab", activeTab)
    }

    router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
  }, [router, pathname, activeTab, navigationInProgress])

  // Handle cancel button click - go to list view
  const handleCancel = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    console.log("Executing handleCancel, navigating back to list view")

    try {
      // Go to the default list view with the current tab
      const params = new URLSearchParams()

      // Add tab parameter if not "all"
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      // Add any search query if it exists
      if (filter.searchQuery) {
        params.set("search", filter.searchQuery)
      }

      // Add type filter if it exists
      if (filter.type) {
        params.set("type", filter.type)
      }

      const url = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
      console.log("Navigating to:", url)

      // Use router.push with a callback to handle navigation completion
      router.push(url, undefined, { shallow: true })

      // Reset navigation flag after a short delay to ensure the navigation has started
      setTimeout(() => {
        setNavigationInProgress(false)
      }, 500)
    } catch (error) {
      console.error("Navigation error:", error)
      // Reset navigation flag on error
      setNavigationInProgress(false)
      // Force a simple navigation as fallback
      window.location.href = pathname
    }
  }, [router, pathname, activeTab, filter.searchQuery, filter.type, navigationInProgress])

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

        const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
        window.history.pushState({}, "", newUrl)
      }
    },
    [searchParams, pathname, isEditMode],
  )

  // Handle delete
  const handleDeleteClick = useCallback((category: ContentCategory, isHard = false) => {
    setSelectedCategory(category)
    setIsHardDelete(isHard)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handle restore
  const handleRestore = useCallback(
    async (category: ContentCategory) => {
      try {
        await restoreContentCategory(category.id)
        toast({
          title: "Restored",
          description: `"${category.name}" has been restored.`,
        })
        loadCategories()
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to restore the content category. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast, loadCategories],
  )

  // Handle toggle featured
  const handleToggleFeatured = useCallback(
    async (category: ContentCategory) => {
      try {
        await updateContentCategory(category.id, {
          featured: !category.featured,
        })
        loadCategories()
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to update the content category. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast, loadCategories],
  )

  // Handle toggle active
  const handleToggleActive = useCallback(
    async (category: ContentCategory) => {
      try {
        await updateContentCategory(category.id, {
          active: !category.active,
        })
        loadCategories()
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to update the content category. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast, loadCategories],
  )

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (!selectedCategory) return

    try {
      if (isHardDelete) {
        await hardDeleteContentCategory(selectedCategory.id)
        toast({
          title: "Permanently deleted",
          description: `"${selectedCategory.name}" has been permanently removed.`,
        })
      } else {
        await softDeleteContentCategory(selectedCategory.id)
        toast({
          title: "Moved to trash",
          description: `"${selectedCategory.name}" has been moved to trash.`,
        })
      }

      // Return a resolved promise to signal completion
      return Promise.resolve()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete the content category. Please try again.",
        variant: "destructive",
      })

      // Rethrow to signal failure
      throw err
    } finally {
      // Refresh the list after deletion
      loadCategories()
      setIsDeleteDialogOpen(false)
      setSelectedCategory(null)
    }
  }, [selectedCategory, isHardDelete, toast, loadCategories])

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setFilter((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  // Handle type filter
  const handleTypeFilter = useCallback((type: string | undefined) => {
    setFilter((prev) => ({ ...prev, type }))
  }, [])

  // Handle add new category
  const handleAddCategory = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // Preserve the active tab when adding a new category
    const params = new URLSearchParams()
    params.set("edit", "new")

    // Add tab parameter if not "all"
    if (activeTab !== "all") {
      params.set("tab", activeTab)
    }

    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, activeTab, navigationInProgress])

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilter({
      type: undefined,
      showDeleted: activeTab === "deleted", // Keep showDeleted true only for the Trash tab
      searchQuery: "",
      featured: undefined,
      active: undefined,
    })

    // Update URL to remove filter parameters
    const params = new URLSearchParams(searchParams.toString())
    params.delete("search")
    params.delete("type")

    const newUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
    window.history.pushState({}, "", newUrl)
  }, [searchParams, pathname, activeTab])

  // Reset navigation flag when URL changes
  useEffect(() => {
    console.log("URL changed, resetting navigation flag")
    setNavigationInProgress(false)
  }, [pathname, searchParams])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">4Ps Marketing Categories</h1>
        <p className="text-muted-foreground">Manage content categories for your 4Ps marketing strategy</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Content categories help organize your 4Ps marketing content (Product, Price, Place, Promotion) and make it
          easier for users to find what they're looking for.
        </AlertDescription>
      </Alert>

      {redirectSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <InfoIcon className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700">
            Content category has been successfully {redirectSuccess === "new" ? "created" : "updated"}.
          </AlertDescription>
        </Alert>
      )}

      {isEditMode ? (
        <Card>
          <CardHeader>
            <CardTitle>{editId !== "new" ? "Edit Content Category" : "Create Content Category"}</CardTitle>
            <CardDescription>
              {editId !== "new"
                ? "Update the details of an existing content category"
                : "Create a new content category for your 4Ps marketing"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryForm id={editId} onSuccess={handleFormSuccess} onCancel={handleCancel} onBack={handleBack} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search categories..."
                  className="pl-9 h-10"
                  value={filter.searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  aria-label="Search categories"
                />
              </div>

              <Select
                value={filter.type || "all_types"}
                onValueChange={(value) => handleTypeFilter(value === "all_types" ? undefined : value)}
              >
                <SelectTrigger className="w-full sm:w-48 h-10">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_types">All Types</SelectItem>
                  {contentTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {(filter.searchQuery || filter.type) && (
                <Button variant="outline" onClick={resetFilters} className="whitespace-nowrap h-10">
                  Clear Filters
                </Button>
              )}
            </div>

            <div className="flex items-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAddCategory()
                      }}
                      disabled={navigationInProgress}
                      className="focus:ring-2 focus:ring-primary/50 transition-all duration-200 h-10 w-full sm:w-auto"
                      aria-label="Add a new content category"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Category
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new content category</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="mb-6 w-full sm:w-auto grid grid-cols-5 h-auto p-1">
              <TabsTrigger value="all" className="py-2">
                All
              </TabsTrigger>
              <TabsTrigger value="featured" className="py-2">
                Featured
              </TabsTrigger>
              <TabsTrigger value="active" className="py-2">
                Active
              </TabsTrigger>
              <TabsTrigger value="inactive" className="py-2">
                Inactive
              </TabsTrigger>
              <TabsTrigger value="deleted" className="py-2">
                Trash
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <CategoryList
                categories={categories}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleFeatured={handleToggleFeatured}
                onToggleActive={handleToggleActive}
                showRestore={false}
                showHardDelete={false}
              />
            </TabsContent>

            <TabsContent value="featured" className="mt-0">
              <CategoryList
                categories={categories}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleFeatured={handleToggleFeatured}
                onToggleActive={handleToggleActive}
                showRestore={false}
                showHardDelete={false}
              />
            </TabsContent>

            <TabsContent value="active" className="mt-0">
              <CategoryList
                categories={categories}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleFeatured={handleToggleFeatured}
                onToggleActive={handleToggleActive}
                showRestore={false}
                showHardDelete={false}
              />
            </TabsContent>

            <TabsContent value="inactive" className="mt-0">
              <CategoryList
                categories={categories}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleFeatured={handleToggleFeatured}
                onToggleActive={handleToggleActive}
                showRestore={false}
                showHardDelete={false}
              />
            </TabsContent>

            <TabsContent value="deleted" className="mt-0">
              <CategoryList
                categories={categories}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={(category) => handleDeleteClick(category, true)}
                onRestore={handleRestore}
                onToggleFeatured={handleToggleFeatured}
                onToggleActive={handleToggleActive}
                showRestore={true}
                showHardDelete={true}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title={isHardDelete ? "Permanently Delete Category" : "Delete"}
        description={
          isHardDelete
            ? "This action cannot be undone. This will permanently delete the content category."
            : "This will move the content category to trash. You can restore it later if needed."
        }
        confirmText={isHardDelete ? "Permanently Delete" : "Delete"}
      />
    </div>
  )
}
