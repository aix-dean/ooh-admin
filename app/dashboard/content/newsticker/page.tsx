"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { NewstickerList } from "@/components/newsticker/newsticker-list"
import { NewstickerForm } from "@/components/newsticker/newsticker-form"
import { DeleteDialog } from "@/components/newsticker/delete-dialog"
import { getNewstickers, softDeleteNewsticker, hardDeleteNewsticker, restoreNewsticker } from "@/lib/newsticker"
import type { Newsticker, NewstickerFilter } from "@/types/newsticker"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export default function NewsTickerPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const [navigationInProgress, setNavigationInProgress] = useState(false)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const previousUrl = useRef<string | null>(null)

  const [newstickers, setNewstickers] = useState<Newsticker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNewsticker, setSelectedNewsticker] = useState<Newsticker | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isHardDelete, setIsHardDelete] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("all")
  const [filter, setFilter] = useState<NewstickerFilter>({
    status: undefined,
    showDeleted: false,
    searchQuery: "",
  })
  const [redirectSuccess, setRedirectSuccess] = useState<string | null>(null)
  const [enableInlineEdit, setEnableInlineEdit] = useState(true)

  // Check if we're in edit mode
  const editId = searchParams.get("edit")
  const isEditMode = !!editId

  // Check for success redirect parameter
  const successId = searchParams.get("success")

  // Disable body scroll when in edit mode
  useEffect(() => {
    if (isEditMode) {
      // Save the current overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow
      // Prevent scrolling on the body
      document.body.style.overflow = "hidden"

      // Restore original overflow style when component unmounts or edit mode changes
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isEditMode])

  // Clear any existing navigation timeout on component unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // Store the previous URL for back navigation
  useEffect(() => {
    // Only store the URL if it's not an edit page and not already navigating
    if (!isEditMode && !navigationInProgress) {
      // Store the current tab and search query
      const params = new URLSearchParams(searchParams.toString())

      // Add the active tab as a parameter if it's not "all"
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      } else {
        params.delete("tab")
      }

      // Add search query if it exists
      if (filter.searchQuery) {
        params.set("search", filter.searchQuery)
      }

      // Store the URL with the current filters
      previousUrl.current = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`
    }
  }, [pathname, searchParams, isEditMode, activeTab, filter.searchQuery, navigationInProgress])

  // Restore the active tab from URL parameters
  useEffect(() => {
    if (!isEditMode) {
      const tabParam = searchParams.get("tab")
      if (tabParam && ["all", "published", "draft"].includes(tabParam)) {
        setActiveTab(tabParam)
      }
    }
  }, [searchParams, isEditMode])

  // Restore search parameters from URL
  useEffect(() => {
    if (!isEditMode) {
      const searchQuery = searchParams.get("search")
      if (searchQuery) {
        setFilter((prev) => ({ ...prev, searchQuery }))
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
        description: "Newsticker has been saved successfully",
        variant: "default",
      })

      // Clear success message after a delay
      const timer = setTimeout(() => {
        setRedirectSuccess(null)
      }, 3000)

      return () => clearTimeout(timer)
    }
  }, [successId, toast, searchParams, pathname])

  // Reset navigation flag when URL changes
  useEffect(() => {
    setNavigationInProgress(false)

    // Also set a safety timeout to ensure the flag is reset
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current)
    }
  }, [searchParams])

  // Safety mechanism to ensure navigation flag is reset
  useEffect(() => {
    if (navigationInProgress) {
      navigationTimeoutRef.current = setTimeout(() => {
        setNavigationInProgress(false)
      }, 2000) // 2 seconds safety timeout
    }

    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [navigationInProgress])

  // Load newstickers
  const loadNewstickers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Determine filter based on active tab
      const currentFilter: NewstickerFilter = { ...filter }
      if (activeTab === "published") {
        currentFilter.status = "published"
      } else if (activeTab === "draft") {
        currentFilter.status = "draft"
      } else if (activeTab === "deleted") {
        currentFilter.showDeleted = true
      } else {
        // "all" tab
        currentFilter.status = undefined
      }

      const data = await getNewstickers(currentFilter)
      setNewstickers(data)
    } catch (err) {
      setError("Failed to load newstickers. Please try again.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [activeTab, filter])

  // Load data on initial render and when filter changes
  useEffect(() => {
    loadNewstickers()
  }, [activeTab, filter.searchQuery, filter.showDeleted, loadNewstickers])

  // Handle edit
  const handleEdit = useCallback(
    (newsticker: Newsticker) => {
      if (enableInlineEdit) {
        // If inline editing is enabled, we don't need to navigate
        // The NewstickerList component will handle showing the inline form
        return
      }

      // Prevent multiple navigations
      if (navigationInProgress) return
      setNavigationInProgress(true)

      // Navigate to edit page
      const params = new URLSearchParams(searchParams.toString())
      params.set("edit", newsticker.id)

      // Preserve the active tab
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      router.push(`${pathname}?${params.toString()}`)
    },
    [enableInlineEdit, router, searchParams, pathname, activeTab, navigationInProgress],
  )

  // Handle form success (creation or update)
  const handleFormSuccess = useCallback(
    (id?: string) => {
      // Prevent multiple navigations
      if (navigationInProgress) return
      setNavigationInProgress(true)

      // Refresh the data
      loadNewstickers()

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
    [router, loadNewstickers, pathname, activeTab, navigationInProgress],
  )

  // Handle back button click - go back to previous URL or to list view
  const handleBack = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // If we have a stored previous URL, use it
    if (previousUrl.current) {
      router.push(previousUrl.current)
    } else {
      // Otherwise, go to the default list view with the current tab
      const params = new URLSearchParams()

      // Add tab parameter if not "all"
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    }
  }, [router, pathname, activeTab, navigationInProgress])

  // Handle cancel button click - go to list view
  const handleCancel = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // If we have a stored previous URL, use it to preserve context
    if (previousUrl.current) {
      router.push(previousUrl.current)
    } else {
      // Otherwise, go to the default list view with the current tab
      const params = new URLSearchParams()

      // Add tab parameter if not "all"
      if (activeTab !== "all") {
        params.set("tab", activeTab)
      }

      // Add any search query if it exists
      if (filter.searchQuery) {
        params.set("search", filter.searchQuery)
      }

      router.push(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    }
  }, [router, pathname, activeTab, filter.searchQuery, navigationInProgress])

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
  const handleDeleteClick = useCallback((newsticker: Newsticker, isHard = false) => {
    setSelectedNewsticker(newsticker)
    setIsHardDelete(isHard)
    setIsDeleteDialogOpen(true)
  }, [])

  // Handle restore
  const handleRestore = useCallback(
    async (newsticker: Newsticker) => {
      try {
        await restoreNewsticker(newsticker.id)
        toast({
          title: "Restored",
          description: `"${newsticker.title}" has been restored.`,
        })
        loadNewstickers()
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to restore the newsticker. Please try again.",
          variant: "destructive",
        })
      }
    },
    [toast, loadNewstickers],
  )

  // Handle inline update
  const handleInlineUpdate = useCallback((updatedNewsticker: Newsticker) => {
    // Update the newsticker in the local state
    setNewstickers((prev) => prev.map((item) => (item.id === updatedNewsticker.id ? updatedNewsticker : item)))
  }, [])

  // Confirm delete
  const confirmDelete = useCallback(async () => {
    if (!selectedNewsticker) return

    try {
      if (isHardDelete) {
        await hardDeleteNewsticker(selectedNewsticker.id)
        toast({
          title: "Permanently deleted",
          description: `"${selectedNewsticker.title}" has been permanently removed.`,
        })
      } else {
        await softDeleteNewsticker(selectedNewsticker.id)
        toast({
          title: "Moved to trash",
          description: `"${selectedNewsticker.title}" has been moved to trash.`,
        })
      }

      // Return a resolved promise to signal completion
      return Promise.resolve()
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete the newsticker. Please try again.",
        variant: "destructive",
      })

      // Rethrow to signal failure
      throw err
    } finally {
      // Refresh the list after deletion
      loadNewstickers()
      setIsDeleteDialogOpen(false)
      setSelectedNewsticker(null)
    }
  }, [selectedNewsticker, isHardDelete, toast, loadNewstickers])

  // Handle search
  const handleSearch = useCallback((query: string) => {
    setFilter((prev) => ({ ...prev, searchQuery: query }))
  }, [])

  // Handle add new newsticker
  const handleAddNewsticker = useCallback(() => {
    // Prevent multiple navigations
    if (navigationInProgress) return
    setNavigationInProgress(true)

    // Preserve the active tab when adding a new ticker
    const params = new URLSearchParams()
    params.set("edit", "new")

    // Add tab parameter if not "all"
    if (activeTab !== "all") {
      params.set("tab", activeTab)
    }

    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, activeTab, navigationInProgress])

  return (
    <div className={`space-y-6 ${isEditMode ? "h-screen overflow-hidden" : ""}`}>
      <div>
        <h1 className="text-3xl font-bold">News Ticker Management</h1>
        <p className="text-muted-foreground">Create, edit, and manage news ticker content</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          News tickers appear as scrolling announcements on your website. They can be scheduled to appear during
          specific time periods.
        </AlertDescription>
      </Alert>

      {redirectSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <InfoIcon className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-green-700">
            Newsticker has been successfully {redirectSuccess === "new" ? "created" : "updated"}.
          </AlertDescription>
        </Alert>
      )}

      {isEditMode ? (
        <Card className="h-[calc(100vh-200px)] flex flex-col hide-scrollbar-container">
          <CardHeader>
            <CardTitle>{editId !== "new" ? "Edit News Ticker" : "Create News Ticker"}</CardTitle>
            <CardDescription>
              {editId !== "new"
                ? "Update the details of an existing news ticker"
                : "Create a new news ticker announcement"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <NewstickerForm id={editId} onSuccess={handleFormSuccess} onCancel={handleCancel} onBack={handleBack} />
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search news tickers..."
                className="pl-8"
                value={filter.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                aria-label="Search news tickers"
              />
            </div>
            <div className="flex items-center gap-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleAddNewsticker()
                      }}
                      disabled={navigationInProgress}
                      className="focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                      aria-label="Add a new news ticker"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add News Ticker
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create a new news ticker announcement</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="published">Ongoing</TabsTrigger>
              <TabsTrigger value="draft">Drafts</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-0">
              <NewstickerList
                newstickers={newstickers}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onInlineUpdate={handleInlineUpdate}
                showRestore={false}
                showHardDelete={false}
                enableInlineEdit={enableInlineEdit}
              />
            </TabsContent>

            <TabsContent value="published" className="mt-0">
              <NewstickerList
                newstickers={newstickers}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onInlineUpdate={handleInlineUpdate}
                showRestore={false}
                showHardDelete={false}
                enableInlineEdit={enableInlineEdit}
              />
            </TabsContent>

            <TabsContent value="draft" className="mt-0">
              <NewstickerList
                newstickers={newstickers}
                loading={loading}
                error={error}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onInlineUpdate={handleInlineUpdate}
                showRestore={false}
                showHardDelete={false}
                enableInlineEdit={enableInlineEdit}
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <DeleteDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
        title={isHardDelete ? "Permanently Delete News Ticker" : "Delete"}
        description={
          isHardDelete
            ? "This action cannot be undone. This will permanently delete the news ticker."
            : "This will move the news ticker to trash. You can restore it later if needed."
        }
        confirmText={isHardDelete ? "Permanently Delete" : "Delete"}
      />
    </div>
  )
}
