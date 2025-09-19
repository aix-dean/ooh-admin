"use client"

import { useState } from "react"
import { X, Plus, ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"

export interface MediaItem {
  url: string
  description: string
  id: string
  created?: string | Date
}

interface MediaFieldProps {
  value: MediaItem[]
  onChange: (value: MediaItem[]) => void
  userId: string
  disabled?: boolean
}

export function MediaField({ value, onChange, userId, disabled = false }: MediaFieldProps) {
  const { toast } = useToast()
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({})
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({})

  // Generate a unique ID for new items
  const generateId = () => `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Add a new empty item
  const handleAddItem = () => {
    const newItem: MediaItem = {
      url: "",
      description: "",
      id: generateId(),
      created: new Date(), // Always add creation timestamp
    }
    // Create a new array to ensure React detects the change
    const newItems = [...value, newItem]
    onChange(newItems)
  }

  // Remove an item by index
  const handleRemoveItem = (index: number) => {
    // Create a new array excluding the item at the specified index
    const newItems = value.filter((_, i) => i !== index)
    onChange(newItems)
  }

  // Update description for an item
  const handleDescriptionChange = (index: number, description: string) => {
    const newItems = [...value]
    newItems[index].description = description
    onChange(newItems)
  }

  // Handle image upload
  const handleImageUpload = async (index: number, file: File) => {
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

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    try {
      const itemId = value[index].id
      setIsUploading((prev) => ({ ...prev, [itemId]: true }))
      setUploadProgress((prev) => ({ ...prev, [itemId]: 0 }))

      // Determine storage path
      const timestamp = Date.now()
      const fileName = `${timestamp}_${file.name}`
      const storagePath = `media/${userId}/${fileName}`

      // Create storage reference
      const storageRef = ref(storage, storagePath)

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, file)

      // Listen for state changes, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress((prev) => ({ ...prev, [itemId]: progress }))
        },
        (error) => {
          // Handle upload errors
          console.error("Upload error:", error)
          setIsUploading((prev) => ({ ...prev, [itemId]: false }))
          toast({
            title: "Upload failed",
            description: "There was an error uploading your image. Please try again.",
            variant: "destructive",
          })
        },
        async () => {
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

            // Create a new array with the updated item
            const newItems = [...value]
            newItems[index].url = downloadURL

            // Always set or update the created timestamp
            newItems[index].created = new Date()

            // Update the component state and trigger the onChange callback
            onChange(newItems)

            toast({
              title: "Upload complete",
              description: "Your image has been successfully uploaded.",
              variant: "default",
            })
          } catch (error) {
            console.error("Error getting download URL:", error)
            toast({
              title: "Upload issue",
              description: "Upload completed, but couldn't retrieve the image URL.",
              variant: "destructive",
            })
          } finally {
            setIsUploading((prev) => ({ ...prev, [itemId]: false }))
          }
        },
      )
    } catch (error) {
      console.error("Upload setup error:", error)
      toast({
        title: "Upload failed",
        description: "There was an error setting up the upload. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Ensure we always have at least one item
  if (value.length === 0) {
    handleAddItem()
  }

  return (
    <div className="space-y-4">
      {value.map((item, index) => (
        <Card key={item.id} className="overflow-hidden">
          <CardContent className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-medium">Media #{index + 1}</h4>
              {value.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveItem(index)}
                  disabled={disabled}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove</span>
                </Button>
              )}
            </div>

            {/* Image Upload Section */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Image</label>
              {item.url ? (
                <div className="space-y-2">
                  <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-md border bg-muted">
                    <img
                      src={item.url || "/placeholder.svg"}
                      alt={`Media image ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newItems = [...value]
                        newItems[index].url = ""
                        onChange(newItems)
                      }}
                      disabled={disabled}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove Image
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  {/* This upload area stores the image URL as 'url' in the media list of the content_media collection */}
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center transition-colors hover:bg-gray-50 border-gray-300 cursor-pointer"
                    onClick={() => !disabled && document.getElementById(`media-image-${index}`)?.click()}
                  >
                    <input
                      type="file"
                      id={`media-image-${index}`}
                      accept="image/*"
                      onChange={(e) => e.target.files && handleImageUpload(index, e.target.files[0])}
                      className="hidden"
                      disabled={disabled || isUploading[item.id]}
                    />
                    {isUploading[item.id] ? (
                      <div className="flex flex-col items-center">
                        <Loader2 className="h-8 w-8 text-gray-400 animate-spin mb-2" />
                        <p className="text-sm text-gray-500">
                          Uploading... {Math.round(uploadProgress[item.id] || 0)}%
                        </p>
                      </div>
                    ) : (
                      <>
                        <ImageIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm font-medium mb-1">Upload an image</p>
                        <p className="text-xs text-gray-500">Click to select an image file</p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Description Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="Enter a description for this image"
                value={item.description}
                onChange={(e) => handleDescriptionChange(index, e.target.value)}
                disabled={disabled}
                className="min-h-[80px]"
              />
            </div>

            {/* Display creation timestamp if available */}
            {item.created && (
              <div className="text-xs text-gray-500">
                Created:{" "}
                {item.created instanceof Date
                  ? item.created.toLocaleString()
                  : typeof item.created === "string"
                    ? new Date(item.created).toLocaleString()
                    : "Unknown date"}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={handleAddItem} disabled={disabled} className="w-full">
        <Plus className="mr-2 h-4 w-4" />
        Add Another Image
      </Button>
    </div>
  )
}
