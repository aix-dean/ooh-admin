"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { DeleteDialog } from "./delete-dialog"
import {
  getMainCategories,
  getMoreMainCategories,
  toggleMainCategoryActive,
  toggleMainCategoryFeatured,
} from "@/lib/main-category"
import type { MainCategory, MainCategoryFilter } from "@/types/main-category"
import {
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import type { DocumentSnapshot } from "firebase/firestore"

export function CategoryList() {
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<MainCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("active")
  const [sortBy, setSortBy] = useState<"name" | "created">("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<MainCategory | null>(null)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

  // Load categories
  const loadCategories = async (resetPagination = true) => {
    try {
      setIsLoading(true)
      setError(null)

      const filter: MainCategoryFilter = {
        showDeleted: activeTab === "deleted",
        searchTerm,
        sortBy,
        sortDirection,
        limit: 10,
      }

      const result = await getMainCategories(filter)
      setCategories(result.categories)
      setLastDoc(result.lastDoc)
      setTotalCount(result.total)
      setHasMore(result.categories.length < result.total)
    } catch (error) {
      console.error("Error loading categories:", error)
      setError("Failed to load categories. Please try again.")
      toast({
        title: "Error",
        description: "Failed to load categories. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load more categories
  const loadMoreCategories = async () => {
    if (!lastDoc || isLoadingMore) return

    try {
      setIsLoadingMore(true)
      setError(null)

      const filter: MainCategoryFilter = {
        showDeleted: activeTab === "deleted",
        searchTerm,
        sortBy,
        sortDirection,
        limit: 10,
      }

      const result = await getMoreMainCategories(lastDoc, filter)
      setCategories((prev) => [...prev, ...result.categories])
      setLastDoc(result.lastDoc)
      setHasMore(!!result.lastDoc)
    } catch (error) {
      console.error("Error loading more categories:", error)
      toast({
        title: "Error",
        description: "Failed to load more categories. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Toggle sort direction
  const toggleSort = (field: "name" | "created") => {
    if (sortBy === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortDirection("asc")
    }
  }

  // Handle tab change
  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Handle edit
  const handleEdit = (category: MainCategory) => {
    router.push(`/dashboard/categories/${category.id}`)
  }

  // Handle delete
  const handleDelete = (category: MainCategory) => {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  // Toggle featured status
  const handleToggleFeatured = async (category: MainCategory) => {
    try {
      setIsActionLoading(category.id)
      await toggleMainCategoryFeatured(category.id)

      // Update local state
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, featured: !c.featured } : c)))

      toast({
        title: category.featured ? "Category unfeatured" : "Category featured",
        description: `"${category.name}" has been ${category.featured ? "removed from" : "added to"} featured categories.`,
      })
    } catch (error) {
      console.error("Error toggling featured status:", error)
      toast({
        title: "Error",
        description: "Failed to update featured status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(null)
    }
  }

  // Toggle active status
  const handleToggleActive = async (category: MainCategory) => {
    try {
      setIsActionLoading(category.id)
      await toggleMainCategoryActive(category.id)

      // Update local state
      setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, active: !c.active } : c)))

      toast({
        title: category.active ? "Category deactivated" : "Category activated",
        description: `"${category.name}" has been ${category.active ? "deactivated" : "activated"}.`,
      })
    } catch (error) {
      console.error("Error toggling active status:", error)
      toast({
        title: "Error",
        description: "Failed to update active status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsActionLoading(null)
    }
  }

  // Handle create new
  const handleCreateNew = () => {
    router.push("/dashboard/categories/new")
  }

  // Load categories when dependencies change
  useEffect(() => {
    loadCategories()
  }, [activeTab, sortBy, sortDirection])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCategories()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle>Categories</CardTitle>
              <CardDescription>Manage your content categories</CardDescription>
            </div>
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Category
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search categories..." className="pl-8" value={searchTerm} onChange={handleSearch} />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => loadCategories()}
                  disabled={isLoading}
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            <Tabs defaultValue="active" value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-2 hidden">
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="deleted">Deleted</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="pt-4">
                {renderCategoriesTable()}
              </TabsContent>

              <TabsContent value="deleted" className="pt-4">
                {renderCategoriesTable()}
              </TabsContent>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {categoryToDelete && (
        <DeleteDialog
          categoryId={categoryToDelete.id}
          categoryName={categoryToDelete.name}
          isOpen={deleteDialogOpen}
          isDeleted={activeTab === "deleted"}
          onClose={() => setDeleteDialogOpen(false)}
          onSuccess={() => {
            loadCategories()
            setDeleteDialogOpen(false)
            setCategoryToDelete(null)
          }}
        />
      )}
    </div>
  )

  function renderCategoriesTable() {
    if (isLoading) {
      return (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => loadCategories()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      )
    }

    if (categories.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-muted-foreground mb-4">
            {searchTerm
              ? "No categories found matching your search."
              : activeTab === "deleted"
                ? "No deleted categories found."
                : "No categories found. Create your first category!"}
          </p>
          {!searchTerm && activeTab !== "deleted" && (
            <Button onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Category
            </Button>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground">
          Showing {categories.length} of {totalCount} categories
        </div>

        <div className="rounded-md border">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-medium -ml-3 hover:bg-transparent"
                    onClick={() => toggleSort("name")}
                  >
                    <span>Name</span>
                    {sortBy === "name" && (
                      <span className="ml-2">
                        {sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </Button>
                </th>
                <th className="text-left p-2 hidden md:table-cell">Status</th>
                <th className="text-left p-2 hidden md:table-cell">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="font-medium -ml-3 hover:bg-transparent"
                    onClick={() => toggleSort("created")}
                  >
                    <span>Created</span>
                    {sortBy === "created" && (
                      <span className="ml-2">
                        {sortDirection === "asc" ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    )}
                  </Button>
                </th>
                <th className="text-right p-2 pr-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t hover:bg-muted/50">
                  <td className="p-2">
                    <div>
                      <div
                        className="font-medium cursor-pointer hover:text-primary transition-colors"
                        onClick={() => router.push(`/dashboard/categories-list/${category.id}/subcategories`)}
                      >
                        {category.name}
                      </div>
                      {category.featured && (
                        <Badge variant="outline" className="mt-1">
                          <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                          Featured
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="p-2 hidden md:table-cell">
                    <Badge variant={category.active ? "default" : "secondary"}>
                      {category.active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="p-2 text-muted-foreground text-sm hidden md:table-cell">
                    {category.created && category.created.toDate
                      ? formatDistanceToNow(category.created.toDate(), { addSuffix: true })
                      : "Unknown"}
                  </td>
                  <td className="p-2 pr-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleFeatured(category)}
                        disabled={!!isActionLoading}
                        title={category.featured ? "Remove from featured" : "Add to featured"}
                      >
                        {isActionLoading === category.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : category.featured ? (
                          <StarOff className="h-4 w-4" />
                        ) : (
                          <Star className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(category)}
                        disabled={!!isActionLoading}
                        title={category.active ? "Deactivate" : "Activate"}
                      >
                        {isActionLoading === category.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : category.active ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      {activeTab !== "deleted" && (
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(category)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(category)}
                        title={activeTab === "deleted" ? "Delete permanently" : "Delete"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button onClick={loadMoreCategories} disabled={isLoadingMore} variant="outline">
              {isLoadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </div>
    )
  }
}
