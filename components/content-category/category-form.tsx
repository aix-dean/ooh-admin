"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Loader2, CheckCircle, ArrowLeft, Upload, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createContentCategory, getContentCategoryById, updateContentCategory } from "@/lib/content-category"
import Image from "next/image"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Form schema
const formSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }).max(100),
  type: z.string().min(1, { message: "Type is required" }),
  description: z.string().max(500, { message: "Description must be less than 500 characters" }).optional(),
  position: z.coerce.number().int().min(0),
  active: z.boolean(),
  pinned_content: z.boolean(),
  featured: z.boolean(),
  pinned_contents: z.array(z.string()),
})

type FormValues = z.infer<typeof formSchema>

interface CategoryFormProps {
  id?: string
  onSuccess: (id?: string) => void
  onCancel: () => void
  onBack: () => void
}

export function CategoryForm({ id, onSuccess, onCancel, onBack }: CategoryFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!id && id !== "new")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [existingLogo, setExistingLogo] = useState<string | null>(null)
  const [showPinnedContentToggle, setShowPinnedContentToggle] = useState(false) // Hide pinned content toggle by default
  const [hasLoaded, setHasLoaded] = useState(false)

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "4Ps", // Set default type to "4Ps"
      description: "",
      position: 0, // Default position to 0
      active: true,
      pinned_content: false,
      featured: false,
      pinned_contents: [], // Default to empty array
    },
    mode: "onChange",
  })

  // Load existing category data if editing
  useEffect(() => {
    const loadCategory = async () => {
      if (id && id !== "new" && !hasLoaded) {
        try {
          setInitialLoading(true)
          console.log(`Loading content category data for ID: ${id}`)
          const category = await getContentCategoryById(id)

          if (category) {
            console.log("Content category data loaded successfully:", category)
            form.reset({
              name: category.name,
              type: category.type,
              description: category.description,
              position: category.position,
              active: category.active,
              pinned_content: category.pinned_content,
              featured: category.featured,
              pinned_contents: category.pinned_contents || [],
            })

            // Set existing logo if available
            if (category.logo) {
              setExistingLogo(category.logo)
            }

            // Mark as loaded to prevent further fetches
            setHasLoaded(true)
          } else {
            console.error("Content category not found for ID:", id)
            toast({
              title: "Error",
              description: "Content category not found",
              variant: "destructive",
            })
            // Redirect back if the category doesn't exist
            onBack()
          }
        } catch (error) {
          console.error("Error loading content category:", error)
          toast({
            title: "Error",
            description: "Failed to load content category data",
            variant: "destructive",
          })
          // Redirect back on error
          onBack()
        } finally {
          setInitialLoading(false)
        }
      } else if (!id || id === "new") {
        // If it's a new category, ensure we're not in loading state
        setInitialLoading(false)
        setHasLoaded(true)
      }
    }

    // Only load data when the component mounts or when the ID changes
    let isMounted = true
    if (isMounted) {
      loadCategory()
    }

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, onBack])

  // Handle logo file selection
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      })
      return
    }

    // Use functional updates to prevent stale state
    setLogoFile(file)

    // Revoke any previous object URL to prevent memory leaks
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview)
    }

    // Create preview URL
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // Clear logo selection with proper cleanup
  const clearLogo = () => {
    // Revoke any object URL to prevent memory leaks
    if (logoPreview && logoPreview.startsWith("blob:")) {
      URL.revokeObjectURL(logoPreview)
    }

    setLogoFile(null)
    setLogoPreview(null)
  }

  // Clear existing logo
  const clearExistingLogo = () => {
    setExistingLogo(null)
  }

  // Form submission handler
  const onSubmit = async (values: FormValues) => {
    if (loading || redirecting) return // Prevent multiple submissions

    try {
      setLoading(true)
      setSaveSuccess(false)

      let categoryId: string | undefined

      if (id && id !== "new") {
        // Update existing category
        await updateContentCategory(id, {
          ...values,
          logo: logoFile,
        })
        categoryId = id
        toast({
          title: "Success",
          description: "Content category updated successfully",
        })
      } else {
        // Create new category
        categoryId = await createContentCategory({
          ...values,
          logo: logoFile,
        })
        toast({
          title: "Success",
          description: "Content category created successfully",
        })
      }

      // Set success state
      setSaveSuccess(true)

      // Only reset the form if we're not redirecting
      if (!redirecting) {
        form.reset(values) // Reset form to mark it as "not dirty"
      }

      // Start redirection process
      setRedirecting(true)

      // Delay redirection slightly to show success state
      setTimeout(() => {
        onSuccess(categoryId)
      }, 1000)
    } catch (error) {
      console.error("Error saving content category:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save content category"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setRedirecting(false)
      setLoading(false)
    }
  }

  // Handle return button click
  const handleReturn = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (loading || redirecting) return

    // Call the onCancel function passed from the parent component
    try {
      console.log("Return button clicked, executing onCancel")
      onCancel()
    } catch (error) {
      // If onCancel fails, use onBack as a fallback
      console.error("Error in onCancel, using onBack as fallback:", error)
      onBack()
    }
  }

  useEffect(() => {
    // Cleanup function to revoke any blob URLs when component unmounts
    return () => {
      if (logoPreview && logoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(logoPreview)
      }
    }
  }, [logoPreview])

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <div>
              <p className="text-green-800 font-medium">
                {id && id !== "new" ? "Content category updated" : "Content category created"}
              </p>
              <p className="text-green-700 text-sm">
                {redirecting ? "Redirecting to category list..." : "Processing your request..."}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter category name" {...field} disabled={loading || redirecting} />
                  </FormControl>
                  <FormDescription>The name of the content category.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter category description"
                      rows={3}
                      {...field}
                      disabled={loading || redirecting}
                    />
                  </FormControl>
                  <FormDescription>A brief description of the content category.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-6">
            <FormField
              control={form.control}
              name="logo"
              render={({ field }) => (
                <FormItem className="space-y-4">
                  <FormLabel>Logo</FormLabel>
                  <div className="flex items-center gap-4">
                    {(logoPreview || existingLogo) && (
                      <div className="relative h-24 w-24 rounded-md overflow-hidden border bg-gray-100">
                        <Image
                          src={logoPreview || existingLogo || ""}
                          alt="Logo preview"
                          fill
                          className="object-cover"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={logoPreview ? clearLogo : clearExistingLogo}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <div className="flex-1">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        disabled={loading || redirecting}
                        className="hidden"
                        id="logo-upload"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById("logo-upload")?.click()}
                        disabled={loading || redirecting}
                        className="w-full"
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        {logoPreview || existingLogo ? "Change Logo" : "Upload Logo"}
                      </Button>
                      <FormDescription className="mt-2">
                        Upload a logo image for this category (max 2MB, JPEG or PNG recommended).
                      </FormDescription>
                    </div>
                  </div>
                </FormItem>
              )}
            />

            <div className="space-y-4 pt-2">
              <FormField
                control={form.control}
                name="active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active</FormLabel>
                      <FormDescription>Activate or deactivate this content category.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={loading || redirecting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="featured"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Featured</FormLabel>
                      <FormDescription>Mark this category as featured to highlight it.</FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={loading || redirecting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {showPinnedContentToggle && (
                <FormField
                  control={form.control}
                  name="pinned_content"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Pinned Content</FormLabel>
                        <FormDescription>Enable pinned content for this category.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={loading || redirecting}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-4 border-t mt-6">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReturn}
                  disabled={loading || redirecting}
                  className="focus:ring-2 focus:ring-primary/50 border-gray-300 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Return
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Return to the category list</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            type="submit"
            disabled={loading || redirecting || !form.formState.isValid}
            className="px-8 py-2 transition-all duration-200 focus:ring-2 focus:ring-primary/50"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {redirecting && <CheckCircle className="mr-2 h-4 w-4" />}
            {id && id !== "new" ? "Update" : "Create"} Content Category
          </Button>
        </div>
      </form>
    </Form>
  )
}
