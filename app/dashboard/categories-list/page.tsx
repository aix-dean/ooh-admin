"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { getMainCategories, incrementCategoryClicks } from "@/lib/main-category"
import type { MainCategory } from "@/types/main-category"
import { Loader2, Search, Star, Eye, RefreshCw, ArrowRight } from "lucide-react"
import Image from "next/image"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Home, FolderOpen } from "lucide-react"

export default function CategoriesListPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [categories, setCategories] = useState<MainCategory[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredCategories, setFilteredCategories] = useState<MainCategory[]>([])

  // Load categories
  const loadCategories = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const result = await getMainCategories({
        active: true,
        showDeleted: false,
        sortBy: "position",
        sortDirection: "asc",
        limit: 50, // Load more categories for better UX
      })

      setCategories(result.categories)
      setFilteredCategories(result.categories)
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

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const term = e.target.value
    setSearchTerm(term)

    if (term.trim() === "") {
      setFilteredCategories(categories)
    } else {
      const filtered = categories.filter(
        (category) =>
          category.name.toLowerCase().includes(term.toLowerCase()) ||
          category.description.toLowerCase().includes(term.toLowerCase()),
      )
      setFilteredCategories(filtered)
    }
  }

  // Handle category click
  const handleCategoryClick = async (category: MainCategory) => {
    try {
      // Increment click count
      await incrementCategoryClicks(category.id)

      // Navigate to subcategories
      router.push(`/dashboard/categories-list/${category.id}/subcategories`)
    } catch (error) {
      console.error("Error handling category click:", error)
      // Still navigate even if click tracking fails
      router.push(`/dashboard/categories-list/${category.id}/subcategories`)
    }
  }

  // Load categories on component mount
  useEffect(() => {
    loadCategories()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/categories-list" className="flex items-center">
                <FolderOpen className="h-4 w-4 mr-1" />
                Categories
              </BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Categories</h1>
        <p className="text-muted-foreground">Browse and explore content categories</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Browse Categories</CardTitle>
          <CardDescription>Click on any category to view its subcategories</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Search and Controls */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search categories..." className="pl-8" value={searchTerm} onChange={handleSearch} />
              </div>
              <Button variant="outline" size="icon" onClick={loadCategories} disabled={isLoading} title="Refresh">
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Categories Grid */}
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={loadCategories} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  {searchTerm ? "No categories found matching your search." : "No categories available."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredCategories.map((category) => (
                  <Card
                    key={category.id}
                    className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105 border-2 hover:border-primary/20"
                    onClick={() => handleCategoryClick(category)}
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Category Image */}
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                          {category.photo_url ? (
                            <Image
                              src={category.photo_url || "/placeholder.svg"}
                              alt={category.name}
                              fill
                              className="object-cover transition-transform duration-200 group-hover:scale-110"
                              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <FolderOpen className="h-12 w-12 text-muted-foreground" />
                            </div>
                          )}

                          {/* Featured Badge */}
                          {category.featured && (
                            <div className="absolute top-2 right-2">
                              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                Featured
                              </Badge>
                            </div>
                          )}
                        </div>

                        {/* Category Info */}
                        <div className="space-y-2">
                          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                            {category.name}
                          </h3>

                          {category.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{category.description}</p>
                          )}

                          {/* Status Badges */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              <Eye className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              #{category.position}
                            </Badge>
                          </div>

                          {/* Navigation Button */}
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                            onClick={(e) => {
                              e.stopPropagation() // Prevent card click event
                              handleCategoryClick(category)
                            }}
                          >
                            View Subcategories
                            <ArrowRight className="h-3 w-3 ml-2" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Results Count */}
            {!isLoading && !error && (
              <div className="text-sm text-muted-foreground text-center">
                {searchTerm ? (
                  <>
                    Showing {filteredCategories.length} of {categories.length} categories
                  </>
                ) : (
                  <>Showing {categories.length} categories</>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
