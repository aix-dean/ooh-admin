"use client"

import { useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle, X } from "lucide-react"
import { updateNewsticker } from "@/lib/newsticker"
import { format } from "date-fns"
import type { Newsticker } from "@/types/newsticker"

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

interface InlineEditFormProps {
  newsticker: Newsticker
  onSave: (updatedNewsticker: Newsticker) => void
  onCancel: () => void
}

export function InlineEditForm({ newsticker, onSave, onCancel }: InlineEditFormProps) {
  const [loading, setLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Initialize form with newsticker data
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: newsticker.title,
      content: newsticker.content,
      start_time: format(new Date(newsticker.start_time), "yyyy-MM-dd'T'HH:mm"),
      end_time: format(new Date(newsticker.end_time), "yyyy-MM-dd'T'HH:mm"),
      position: newsticker.position,
      status: newsticker.status,
    },
  })

  // Form submission handler
  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true)

      // Update the newsticker
      await updateNewsticker(newsticker.id, values)

      // Create an updated newsticker object to pass back
      const updatedNewsticker: Newsticker = {
        ...newsticker,
        title: values.title,
        content: values.content,
        start_time: new Date(values.start_time),
        end_time: new Date(values.end_time),
        position: values.position,
        status: values.status,
        updated: new Date(),
      }

      // Show success state briefly
      setSaveSuccess(true)
      setTimeout(() => {
        onSave(updatedNewsticker)
      }, 500)
    } catch (error) {
      console.error("Error updating newsticker:", error)
      // Error handling will be done in the parent component
      onCancel()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 p-4 bg-muted/20 rounded-md border">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-medium">Editing News Ticker</h3>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCancel()
            }}
            className="h-8 w-8 p-0 focus:ring-2 focus:ring-primary/50"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cancel</span>
          </Button>
        </div>

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter title" {...field} disabled={loading} />
              </FormControl>
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
                <Textarea placeholder="Enter content" rows={2} {...field} disabled={loading} />
              </FormControl>
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
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} disabled={loading} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Date</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} disabled={loading} />
                </FormControl>
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
                <FormLabel>Position</FormLabel>
                <FormControl>
                  <Input type="number" min="0" {...field} disabled={loading} />
                </FormControl>
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
                <Select onValueChange={field.onChange} defaultValue={field.value} disabled={loading}>
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
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end space-x-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onCancel()
            }}
            disabled={loading}
            className="focus:ring-2 focus:ring-primary/50"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={loading}
            className={`focus:ring-2 focus:ring-primary/50 ${saveSuccess ? "bg-green-600 hover:bg-green-700" : ""}`}
          >
            {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            {saveSuccess && <CheckCircle className="mr-2 h-3 w-3" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  )
}
