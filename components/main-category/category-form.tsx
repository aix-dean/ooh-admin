"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Upload, X, ArrowLeft, CheckCircle2 } from "lucide-react"
import Image from "next/image"
import {
  createMainCategory,
  updateMainCategory,
  uploadMainCategoryPhoto,
  getMainCategoryById,
  getNextMainCategoryPosition,
} from "@/lib/main-category"

// Form schema with validation
const formSchema = z.object({
  name: z
    .string()
    .min(2, { message: "Name must be at least 2 characters" })
    .max(100, { message: "Name must be less than 100 characters" }),
  description: z.string().max(1000, { message: "Description must be less than 1000 characters" }).optional(),
  photo_url: z.string().optional(),
  active: z.boolean().default(true),
  featured: z.boolean().default(false),
  position: z.number().int().nonnegative(),
})

type FormValues = z.infer<typeof formSchema>

interface CategoryFormProps {
  categoryId?: string
  onSuccess: () => void
  onCancel: () => void
}

export function CategoryForm({ categoryId, onSuccess, onCancel }: CategoryFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!categoryId && categoryId !== "new")
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const { toast } = useToast()

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      photo_url: "",
      active: true,
      featured: false,
      position: 0,
    },
  })

  // Memoize the onCancel function to prevent it from causing re-renders
  const handleCancel = useCallback(() => {
    onCancel()
  }, [onCancel])

  // Load category data if editing - Fixed dependencies to prevent infinite loop
  useEffect(() => {
    const loadCategory = async () => {
      if (categoryId && categoryId !== "new") {
        try {
          setInitialLoading(true)
          const category = await getMainCategoryById(categoryId)

          if (category) {
            // Use form.reset to update all form values at once
            form.reset({
              name: category.name,
              description: category.description,
              photo_url: category.photo_url,
              active: category.active,
              featured: category.featured,
              position: category.position,
            })

            if (category.photo_url) {
              setPhotoPreview(category.photo_url)
            }
          } else {
            toast({
              title: "Error",
              description: "Category not found",
              variant: "destructive",
            })
            handleCancel()
          }
        } catch (error) {
          console.error("Error loading category:", error)
          toast({
            title: "Error",
            description: "Failed to load category data",
            variant: "destructive",
          })
        } finally {
          setInitialLoading(false)
        }
      } else if (!categoryId || categoryId === "new") {
        // For new category, get the next position
        try {
          const nextPosition = await getNextMainCategoryPosition()
          form.setValue("position", nextPosition)
        } catch (error) {
          console.error("Error getting next position:", error)
        }
        setInitialLoading(false)
      }
    }

    loadCategory()
    // Only depend on categoryId to prevent infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  // Handle photo upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const url = await uploadMainCategoryPhoto(file)
      form.setValue("photo_url", url)
      setPhotoPreview(url)
      toast({
        title: "Photo uploaded",
        description: "The photo has been uploaded successfully",
      })
    } catch (error) {
      console.error("Error uploading photo:", error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload photo",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  // Clear photo
  const handleClearPhoto = () => {
    form.setValue("photo_url", "")
    setPhotoPreview(null)
  }

  // Form submission
  const onSubmit = async (values: FormValues) => {
    setIsLoading(true)
    setSaveSuccess(false)

    try {
      if (categoryId && categoryId !== "new") {
        // Update existing category
        await updateMainCategory(categoryId, values)
        toast({
          title: "Category updated",
          description: "The category has been updated successfully",
        })
      } else {
        // Create new category
        await createMainCategory(values)
        toast({
          title: "Category created",
          description: "The category has been created successfully",
        })
      }

      setSaveSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1000) // Short delay to show success state
    } catch (error) {
      console.error("Error saving category:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save category",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <Card className="shadow-sm flex-1 flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-xl">
            {categoryId && categoryId !== "new" ? "Edit Category" : "Create New Category"}
          </CardTitle>
          <CardDescription className="text-sm">
            {categoryId && categoryId !== "new"
              ? "Update the details of an existing category"
              : "Create a new category for your content"}
          </CardDescription>
        </CardHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col overflow-hidden">
            <CardContent className="flex-1 overflow-hidden py-4">
              {saveSuccess && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 flex items-center mb-4">
                  <CheckCircle2 className="h-4 w-4 text-green-500 mr-2" />
                  <div>
                    <p className="text-green-800 font-medium text-sm">
                      {categoryId && categoryId !== "new" ? "Category updated" : "Category created"}
                    </p>
                    <p className="text-green-700 text-xs">Redirecting to category list...</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-y-auto">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter category name" {...field} className="h-9" />
                        </FormControl>
                        <FormDescription className="text-xs">
                          The name of the category as it will appear to users.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter category description"
                            className="resize-none h-20"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          A brief description of the category (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Position</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="h-9"
                            {...field}
                            onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 0)}
                            value={field.value}
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          The display order of the category (lower numbers appear first).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="photo_url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Category Photo</FormLabel>
                        <div className="space-y-3">
                          {photoPreview ? (
                            <div className="relative w-full h-32 border rounded-md overflow-hidden bg-muted">
                              <Image
                                src={photoPreview || "/placeholder.svg"}
                                alt="Category photo"
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 50vw"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="icon"
                                className="absolute top-1 right-1 h-6 w-6"
                                onClick={handleClearPhoto}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="w-full h-32 border rounded-md flex items-center justify-center bg-muted">
                              <p className="text-muted-foreground text-xs">No photo uploaded</p>
                            </div>
                          )}
                          <div className="flex items-center justify-center w-full">
                            <label
                              htmlFor="photo-upload"
                              className="flex items-center justify-center w-full h-8 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none cursor-pointer"
                            >
                              {isUploading ? (
                                <>
                                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="mr-1 h-3 w-3" />
                                  {photoPreview ? "Change Photo" : "Upload Photo"}
                                </>
                              )}
                              <input
                                id="photo-upload"
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={handlePhotoUpload}
                                disabled={isUploading}
                              />
                            </label>
                          </div>
                          <FormControl>
                            <input type="hidden" {...field} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Upload a photo for the category (recommended size: 800x600px).
                          </FormDescription>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 gap-3">
                    <FormField
                      control={form.control}
                      name="active"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                          <div className="space-y-0.5">
                            <FormLabel className="text-sm">Active</FormLabel>
                            <FormDescription className="text-xs">Make this category visible to users.</FormDescription>
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
                            <FormLabel className="text-sm">Featured</FormLabel>
                            <FormDescription className="text-xs">
                              Highlight this category in featured sections.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t pt-4 flex-shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading || saveSuccess}
                size="sm"
              >
                <ArrowLeft className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || saveSuccess} size="sm">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    {categoryId && categoryId !== "new" ? "Updating..." : "Creating..."}
                  </>
                ) : saveSuccess ? (
                  <>
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {categoryId && categoryId !== "new" ? "Updated" : "Created"}
                  </>
                ) : categoryId && categoryId !== "new" ? (
                  "Update Category"
                ) : (
                  "Create Category"
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  )
}
