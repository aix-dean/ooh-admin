"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  getCategories,
  incrementCategoryClicks,
  createCategory,
  updateCategory,
  softDeleteCategory,
  uploadCategoryPhoto,
  toggleCategoryFeatured,
} from "@/lib/category"
import { getMainCategoryById } from "@/lib/main-category"
import type { Category } from "@/types/category"
import type { MainCategory } from "@/types/main-category"
import {
  Loader2,
  Search,
  Star,
  Eye,
  RefreshCw,
  ArrowLeft,
  FolderOpen,
  AlertTriangle,
  Edit,
  Trash2,
  Plus,
  Save,
} from "lucide-react"
import Image from "next/image"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Switch } from "@/components/ui/switch"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SubcategoriesPageProps {
  params: {
    mainCategoryId: string
  }
}

const subcategoryFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  photo_url: z.string().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  position: z.number().min(0, "Position must be non-negative"),
  type: z.string().min(1, "Type is required"),
})

type SubcategoryFormData = z.infer<typeof subcategoryFormSchema>

export default function SubcategoriesPage({ params }: SubcategoriesPageProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [subcategories, setSubcategories] = useState<Category[]>([])
  const [mainCategory, setMainCategory] = useState<MainCategory | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredSubcategories, setFilteredSubcategories] = useState<Category[]>([])

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [selectedSubcategory, setSelectedSubcategory] = useState<Category | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

  // Load main category and subcategories
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load main category details
      const mainCat = await getMainCategoryById(params.mainCategoryId)
      if (!mainCat) {
        setError("Main category not found.")
        return
      }
      setMainCategory(mainCat)

      // Load subcategories
      const result = await getCategories({
        mainCategoryId: params.mainCategoryId,
        active: true,
        showDeleted: false,
        sortBy: "position",
        sortDirection: "asc",
        limit: 50,
      })

      setSubcategories(result.categories)
      setFilteredSubcategories(result.categories)
    } catch (error) {
      console.error("Error loading data:", error)
      setError("Failed to load subcategories. Please try again.")
      toast({
        title: "Error",
        description: "Failed to load subcategories. Please try again.",
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
      setFilteredSubcategories(subcategories)
    } else {
      const filtered = subcategories.filter(
        (category) =>
          category.name.toLowerCase().includes(term.toLowerCase()) ||
          category.type.toLowerCase().includes(term.toLowerCase()),
      )
      setFilteredSubcategories(filtered)
    }
  }

  // Handle subcategory click
  const handleSubcategoryClick = async (subcategory: Category) => {
    try {
      // Increment click count
      await incrementCategoryClicks(subcategory.id)

      // You can navigate to a detailed view or perform other actions
      toast({
        title: "Subcategory Selected",
        description: `You clicked on "${subcategory.name}"`,
      })
    } catch (error) {
      console.error("Error handling subcategory click:", error)
    }
  }

  // Handle back navigation
  const handleBack = () => {
    window.history.back()
  }

  // Handle create subcategory
  const handleCreateSubcategory = async (data: SubcategoryFormData) => {
    try {
      setIsSubmitting(true)
      await createCategory({
        ...data,
        main_category_id: [params.mainCategoryId],
      })
      toast({
        title: "Success",
        description: "Subcategory created successfully.",
      })
      setIsCreateDialogOpen(false)
      loadData()
    } catch (error) {
      console.error("Error creating subcategory:", error)
      toast({
        title: "Error",
        description: "Failed to create subcategory. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle update subcategory
  const handleUpdateSubcategory = async (data: SubcategoryFormData) => {
    if (!selectedSubcategory) return

    try {
      setIsSubmitting(true)
      await updateCategory(selectedSubcategory.id, data)
      toast({
        title: "Success",
        description: "Subcategory updated successfully.",
      })
      setIsEditDialogOpen(false)
      setSelectedSubcategory(null)
      loadData()
    } catch (error) {
      console.error("Error updating subcategory:", error)
      toast({
        title: "Error",
        description: "Failed to update subcategory. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete subcategory
  const handleDeleteSubcategory = async () => {
    if (!selectedSubcategory) return

    try {
      setIsSubmitting(true)
      await softDeleteCategory(selectedSubcategory.id)
      toast({
        title: "Success",
        description: "Subcategory deleted successfully.",
      })
      setIsDeleteDialogOpen(false)
      setSelectedSubcategory(null)
      loadData()
    } catch (error) {
      console.error("Error deleting subcategory:", error)
      toast({
        title: "Error",
        description: "Failed to delete subcategory. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle toggle featured status
  const handleToggleFeatured = async (subcategory: Category) => {
    try {
      setIsActionLoading(subcategory.id)
      await toggleCategoryFeatured(subcategory.id)

      // Update local state
      const updatedSubcategories = subcategories.map((cat) =>
        cat.id === subcategory.id ? { ...cat, featured: !cat.featured } : cat,
      )
      setSubcategories(updatedSubcategories)
      setFilteredSubcategories(
        searchTerm.trim() === ""
          ? updatedSubcategories
          : updatedSubcategories.filter(
              (category) =>
                category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                category.type.toLowerCase().includes(searchTerm.toLowerCase()),
            ),
      )

      toast({
        title: subcategory.featured ? "Category unfeatured" : "Category featured",
        description: `"${subcategory.name}" has been ${subcategory.featured ? "removed from" : "added to"} featured categories.`,
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

  // Handle photo upload
  const handlePhotoUpload = async (file: File): Promise<string> => {
    try {
      setUploadingPhoto(true)
      const photoUrl = await uploadCategoryPhoto(file)
      return photoUrl
    } catch (error) {
      console.error("Error uploading photo:", error)
      toast({
        title: "Error",
        description: "Failed to upload photo. Please try again.",
        variant: "destructive",
      })
      throw error
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Load data on component mount
  useEffect(() => {
    loadData()
  }, [params.mainCategoryId])

  return (
    <div className="space-y-6">
      <div>
        <div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Return
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{mainCategory?.name || "Subcategories"}</h1>
              <p className="text-muted-foreground">{mainCategory?.description || "Browse subcategories"}</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>
              {mainCategory ? `Explore subcategories in "${mainCategory.name}"` : "Loading subcategories..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Search and Controls */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search subcategories..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Category
                  </Button>
                  <Button variant="outline" size="icon" onClick={loadData} disabled={isLoading} title="Refresh">
                    <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>

              {/* Subcategories Grid */}
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-destructive mb-4">{error}</p>
                  <Button onClick={loadData} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </div>
              ) : filteredSubcategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-muted-foreground mb-4">
                    {searchTerm
                      ? "No subcategories found matching your search."
                      : "No subcategories available in this category."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredSubcategories.map((subcategory) => (
                    <Card
                      key={subcategory.id}
                      className="group transition-all duration-200 hover:shadow-lg border-2 hover:border-primary/20"
                    >
                      <CardContent className="p-4">
                        <div className="space-y-3">
                          {/* Subcategory Image */}
                          <div className="relative aspect-square rounded-lg overflow-hidden bg-muted">
                            {subcategory.photo_url ? (
                              <Image
                                src={subcategory.photo_url || "/placeholder.svg"}
                                alt={subcategory.name}
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
                            {subcategory.featured && (
                              <div className="absolute top-2 right-2">
                                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-200">
                                  <Star className="h-3 w-3 mr-1 fill-yellow-400 text-yellow-400" />
                                  Featured
                                </Badge>
                              </div>
                            )}

                            {/* Click Count */}
                            {subcategory.clicked > 0 && (
                              <div className="absolute bottom-2 left-2">
                                <Badge variant="secondary" className="text-xs">
                                  {subcategory.clicked} clicks
                                </Badge>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant={subcategory.featured ? "default" : "secondary"}
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleToggleFeatured(subcategory)
                                  }}
                                  disabled={isActionLoading === subcategory.id}
                                  title={subcategory.featured ? "Remove from featured" : "Add to featured"}
                                >
                                  {isActionLoading === subcategory.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Star
                                      className={`h-3 w-3 ${subcategory.featured ? "fill-yellow-400 text-yellow-400" : ""}`}
                                    />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedSubcategory(subcategory)
                                    setIsEditDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedSubcategory(subcategory)
                                    setIsDeleteDialogOpen(true)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Subcategory Info */}
                          <div className="space-y-2 cursor-pointer" onClick={() => handleSubcategoryClick(subcategory)}>
                            <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                              {subcategory.name}
                            </h3>

                            {/* Type and Status */}
                            <div className="flex items-center gap-2 flex-wrap">
                              {subcategory.type && (
                                <Badge variant="outline" className="text-xs">
                                  {subcategory.type}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                <Eye className="h-3 w-3 mr-1" />
                                {subcategory.active ? "Active" : "Inactive"}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                #{subcategory.position}
                              </Badge>
                            </div>
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
                      Showing {filteredSubcategories.length} of {subcategories.length} subcategories
                    </>
                  ) : (
                    <>Showing {subcategories.length} subcategories</>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Create Subcategory Dialog */}
        <SubcategoryFormDialog
          isOpen={isCreateDialogOpen}
          onClose={() => setIsCreateDialogOpen(false)}
          onSubmit={handleCreateSubcategory}
          onPhotoUpload={handlePhotoUpload}
          isSubmitting={isSubmitting}
          uploadingPhoto={uploadingPhoto}
          title="Create New Subcategory"
          submitText="Create Subcategory"
        />

        {/* Edit Subcategory Dialog */}
        {selectedSubcategory && (
          <SubcategoryFormDialog
            isOpen={isEditDialogOpen}
            onClose={() => {
              setIsEditDialogOpen(false)
              setSelectedSubcategory(null)
            }}
            onSubmit={handleUpdateSubcategory}
            onPhotoUpload={handlePhotoUpload}
            isSubmitting={isSubmitting}
            uploadingPhoto={uploadingPhoto}
            title="Edit Subcategory"
            submitText="Update Subcategory"
            defaultValues={{
              name: selectedSubcategory.name,
              photo_url: selectedSubcategory.photo_url,
              active: selectedSubcategory.active,
              featured: selectedSubcategory.featured,
              position: selectedSubcategory.position,
              type: selectedSubcategory.type,
            }}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-amber-500 mr-2" />
                Delete Subcategory?
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedSubcategory?.name}"? This action can be undone later.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteSubcategory} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Subcategory Form Dialog Component
interface SubcategoryFormDialogProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: SubcategoryFormData) => void
  onPhotoUpload: (file: File) => Promise<string>
  isSubmitting: boolean
  uploadingPhoto: boolean
  title: string
  submitText: string
  defaultValues?: Partial<SubcategoryFormData>
}

function SubcategoryFormDialog({
  isOpen,
  onClose,
  onSubmit,
  onPhotoUpload,
  isSubmitting,
  uploadingPhoto,
  title,
  submitText,
  defaultValues,
}: SubcategoryFormDialogProps) {
  const form = useForm<SubcategoryFormData>({
    resolver: zodResolver(subcategoryFormSchema),
    defaultValues: {
      name: defaultValues?.name || "",
      photo_url: defaultValues?.photo_url || "",
      active: defaultValues?.active ?? true,
      featured: defaultValues?.featured ?? false,
      position: defaultValues?.position || 0,
      type: defaultValues?.type || "",
    },
  })

  const handleSubmit = (data: SubcategoryFormData) => {
    onSubmit(data)
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        const photoUrl = await onPhotoUpload(file)
        form.setValue("photo_url", photoUrl)
      } catch (error) {
        // Error is handled in the parent component
      }
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Fill in the details for the subcategory.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter subcategory name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="RENTAL">RENTAL</SelectItem>
                        <SelectItem value="MERCHANDISE">MERCHANDISE</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>Display order position</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription>Make this subcategory visible</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="featured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Featured</FormLabel>
                        <FormDescription>Mark as featured subcategory</FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <FormField
              control={form.control}
              name="photo_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Photo</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleFileUpload}
                          disabled={uploadingPhoto}
                          className="flex-1"
                        />
                        {uploadingPhoto && <Loader2 className="h-4 w-4 animate-spin" />}
                      </div>
                      {field.value && (
                        <div className="relative w-32 h-32 rounded-lg overflow-hidden border">
                          <Image src={field.value || "/placeholder.svg"} alt="Preview" fill className="object-cover" />
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormDescription>Upload an image for the subcategory</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || uploadingPhoto}>
                {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {submitText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
