"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle, ArrowLeft } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createNewsticker, getNewstickerById, updateNewsticker } from "@/lib/newsticker"
import { format } from "date-fns"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Form schema
const formSchema = z
  .object({
    title: z.string().min(3, { message: "Title must be at least 3 characters" }).max(100),
    content: z.string().min(5, { message: "Content must be at least 5 characters" }).max(500),
    start_time: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Please enter a valid start date",
    }),
    end_time: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "Please enter a valid end date",
    }),
    position: z.coerce.number().int().min(0),
    status: z.enum(["draft", "published", "archived"]),
  })
  .refine(
    (data) => {
      const start = new Date(data.start_time)
      const end = new Date(data.end_time)
      return end > start
    },
    {
      message: "End date must be after start date",
      path: ["end_time"],
    },
  )

type FormValues = z.infer<typeof formSchema>

interface NewstickerFormProps {
  id?: string
  onSuccess: (id?: string) => void
  onCancel: () => void
  onBack: () => void
}

export function NewstickerForm({ id, onSuccess, onCancel, onBack }: NewstickerFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!id && id !== "new")
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] = useState(false)
  const [formInitialized, setFormInitialized] = useState(false)
  const formSubmitAttempted = useRef(false)
  const [cancelLoading, setCancelLoading] = useState(false)
  const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      content: "",
      start_time: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      position: 0,
      status: "draft",
    },
    mode: "onChange",
  })

  // Clear any existing navigation timeout on component unmount
  useEffect(() => {
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }
    }
  }, [])

  // Load existing newsticker data if editing
  useEffect(() => {
    const loadNewsticker = async () => {
      if (id && id !== "new") {
        try {
          setInitialLoading(true)
          console.log(`Loading newsticker data for ID: ${id}`)
          const newsticker = await getNewstickerById(id)

          if (newsticker) {
            console.log("Newsticker data loaded successfully:", newsticker)
            form.reset({
              title: newsticker.title,
              content: newsticker.content,
              start_time: format(new Date(newsticker.start_time), "yyyy-MM-dd'T'HH:mm"),
              end_time: format(new Date(newsticker.end_time), "yyyy-MM-dd'T'HH:mm"),
              position: newsticker.position,
              status: newsticker.status,
            })
            setFormInitialized(true)
          } else {
            console.error("Newsticker not found for ID:", id)
            toast({
              title: "Error",
              description: "Newsticker not found",
              variant: "destructive",
            })
            // Redirect back if the newsticker doesn't exist
            onBack()
          }
        } catch (error) {
          console.error("Error loading newsticker:", error)
          toast({
            title: "Error",
            description: "Failed to load newsticker data",
            variant: "destructive",
          })
          // Redirect back on error
          onBack()
        } finally {
          console.log("Setting initialLoading to false")
          setInitialLoading(false)
        }
      } else {
        // If it's a new newsticker, ensure we're not in loading state
        setInitialLoading(false)
        setFormInitialized(true)
      }
    }

    loadNewsticker()
  }, [id, toast, onBack, form])

  // Form submission handler
  const onSubmit = async (values: FormValues) => {
    try {
      formSubmitAttempted.current = true
      setLoading(true)
      setSaveSuccess(false)

      let newstickerId: string | undefined

      if (id && id !== "new") {
        // Update existing newsticker
        await updateNewsticker(id, values)
        newstickerId = id
        toast({
          title: "Success",
          description: "Newsticker updated successfully",
        })
      } else {
        // Create new newsticker
        newstickerId = await createNewsticker(values)
        toast({
          title: "Success",
          description: "Newsticker created successfully",
        })
      }

      // Set success state
      setSaveSuccess(true)
      form.reset(values) // Reset form to mark it as "not dirty"

      // Start redirection process
      setRedirecting(true)

      // Delay redirection slightly to show success state
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current)
      }

      navigationTimeoutRef.current = setTimeout(() => {
        onSuccess(newstickerId)
      }, 1000)
    } catch (error) {
      console.error("Error saving newsticker:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to save newsticker"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setRedirecting(false)
      formSubmitAttempted.current = false
    } finally {
      setLoading(false)
    }
  }

  // Handle return button click
  const handleReturn = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (loading || redirecting || cancelLoading) return

    setCancelLoading(true)

    // Use a timeout to ensure the button shows loading state
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current)
    }

    navigationTimeoutRef.current = setTimeout(() => {
      onCancel()
    }, 100)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape key to return to list
      if (e.key === "Escape" && !showUnsavedChangesDialog) {
        e.preventDefault()
        if (!loading && !redirecting && !cancelLoading) {
          setCancelLoading(true)

          if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current)
          }

          navigationTimeoutRef.current = setTimeout(() => {
            onCancel()
          }, 100)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [loading, redirecting, cancelLoading, showUnsavedChangesDialog, onCancel])

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 h-full overflow-y-auto hide-scrollbar">
          {saveSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center">
              <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
              <div>
                <p className="text-green-800 font-medium">
                  {id && id !== "new" ? "Newsticker updated" : "Newsticker created"}
                </p>
                <p className="text-green-700 text-sm">
                  {redirecting ? "Redirecting to newsticker list..." : "Processing your request..."}
                </p>
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter news ticker title" {...field} disabled={loading || redirecting} />
                </FormControl>
                <FormDescription>The title will be displayed prominently in the news ticker.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="content"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Content</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter news ticker content"
                    rows={3}
                    {...field}
                    disabled={loading || redirecting}
                  />
                </FormControl>
                <FormDescription>The main content of the news ticker announcement.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="start_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Start Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} disabled={loading || redirecting} />
                  </FormControl>
                  <FormDescription>When the news ticker should start displaying.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="end_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>End Date & Time</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} disabled={loading || redirecting} />
                  </FormControl>
                  <FormDescription>When the news ticker should stop displaying.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Display Position</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} disabled={loading || redirecting} />
                  </FormControl>
                  <FormDescription>Lower numbers appear first in the sequence.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading || redirecting}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>Only published items will be displayed.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-between items-center pt-4 border-t mt-6">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleReturn}
                    disabled={loading || redirecting || cancelLoading}
                    className="focus:ring-2 focus:ring-primary/50 border-gray-300 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200"
                    aria-label="Return to news ticker list"
                  >
                    {cancelLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowLeft className="mr-2 h-4 w-4" />
                    )}
                    Return
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Return to the news ticker list (Esc)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              type="submit"
              disabled={loading || redirecting || !form.formState.isValid || cancelLoading}
              className="px-8 py-2 transition-all duration-200 focus:ring-2 focus:ring-primary/50"
              aria-label={id && id !== "new" ? "Update news ticker" : "Create news ticker"}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {redirecting && <CheckCircle className="mr-2 h-4 w-4" />}
              {id && id !== "new" ? "Update" : "Create"} News Ticker
            </Button>
          </div>
        </form>
      </Form>
    </>
  )
}
