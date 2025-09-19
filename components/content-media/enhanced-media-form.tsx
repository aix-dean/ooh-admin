"use client"

import { useEffect, useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Upload,
  Video,
  FileText,
  Calendar,
  Settings,
  Save,
  X,
  Loader2,
  ImageIcon,
  User,
  Link,
  Pin,
  Clock,
  ArrowLeft,
  Info,
  Eye,
  Database,
  ChevronRight,
} from "lucide-react"
import { format } from "date-fns"

import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { EnhancedUrlReferencesField } from "@/components/content-media/enhanced-url-references-field"
import { MediaField, type MediaItem } from "@/components/content-media/media-field"
import { ThumbnailUploader } from "@/components/content-media/thumbnail-uploader"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ContentMedia } from "@/types/content-media"
import { updateContentMedia, createContentMedia, getContentMediaById } from "@/lib/content-media"
import { isValidDate } from "@/lib/date-utils"
import { useAuth } from "@/contexts/auth-context"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import { VideoThumbnailUploader } from "@/components/content-media/video-thumbnail-uploader"

// Define the URL reference type
interface UrlReference {
  url: string
  label: string
}

// Define the enhanced media item type with created timestamp
export interface EnhancedMediaItem {
  url: string
  description: string
  id: string
  created: string | Date
}

// Form schema with validation
const formSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(100, "Title must be less than 100 characters"),
    synopsis: z.string().max(500, "Synopsis must be less than 500 characters").optional(),
    description: z.string().max(5000, "Description must be less than 5000 characters").optional(),
    author: z.string().optional(),
    urlReferences: z
      .array(
        z.object({
          url: z.string().url("Please enter a valid URL").min(1, "URL is required"),
          label: z.string().min(1, "Label is required").max(100, "Label must be less than 100 characters"),
        }),
      )
      .optional()
      .default([]),
    media: z
      .array(
        z.object({
          url: z.string(),
          description: z.string(),
          id: z.string(),
          created: z.any().optional(),
        }),
      )
      .optional(),
    start_date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Please enter a valid start date",
      })
      .optional(),
    end_date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), {
        message: "Please enter a valid end date",
      })
      .optional(),
    pinned: z.boolean().optional(),
    pinnedOrder: z.number().optional(),
    thumbnail: z.string().optional(),
    type: z.enum(["HPV", "Article", "Video"]).default("Article"),
    featured: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        const start = new Date(data.start_date)
        const end = new Date(data.end_date)
        return end > start
      }
      return true
    },
    {
      message: "End date must be after start date",
      path: ["end_date"],
    },
  )

type FormValues = z.infer<typeof formSchema>

interface EnhancedMediaFormProps {
  id?: string
  categoryId?: string
  categoryName?: string
  contentMedia?: ContentMedia | null
  onSuccess?: (id?: string) => void
  onCancel?: () => void
  onBack?: () => void
}

export function EnhancedMediaForm({
  id,
  categoryId,
  categoryName,
  contentMedia,
  onSuccess,
  onCancel,
  onBack,
}: EnhancedMediaFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState(false)
  const [isLoading, setIsLoading] = useState(id !== undefined && id !== "new" && !contentMedia)
  const [formProgress, setFormProgress] = useState(0)
  const formInitializedRef = useRef(false)
  const { userData } = useAuth()
  const unmountedRef = useRef(false)

  // Upload states
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<any>(null)
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "processing" | "success" | "error">("idle")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [activeTab, setActiveTab] = useState("details")
  const [media, setMedia] = useState<EnhancedMediaItem[]>([
    { url: "", description: "", id: `media-${Date.now()}`, created: new Date() },
  ])
  const [urlReferencesState, setUrlReferencesState] = useState<UrlReference[]>([{ url: "", label: "" }])

  // Define tab sequence
  const tabSequence = ["details", "media", "metadata", "settings", "preview"]

  // Initialize form with default values
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      synopsis: "",
      description: "",
      author: "",
      urlReferences: [{ url: "", label: "" }],
      media: [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }],
      start_date: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      end_date: format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm"),
      pinned: false,
      pinnedOrder: 0,
      thumbnail: undefined,
      type: "Article",
      featured: false,
    },
  })

  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
    }
  }, [])

  const calculateProgress = () => {
    const values = form.getValues()
    let completedFields = 0
    let totalFields = 0

    // Required fields
    if (values.title) completedFields++
    totalFields++

    // Optional fields that count when filled
    if (values.synopsis) completedFields++
    if (values.description) completedFields++
    if (values.author) completedFields++
    if (values.thumbnail) completedFields++
    if (values.urlReferences && values.urlReferences.some((ref) => ref.url && ref.label)) completedFields++
    if (values.media && values.media.some((item) => item.url)) completedFields++

    // Always count these fields
    totalFields += 6

    return Math.round((completedFields / totalFields) * 100)
  }

  // Update progress when form values change
  useEffect(() => {
    const subscription = form.watch(() => {
      setFormProgress(calculateProgress())
    })
    return () => subscription.unsubscribe()
  }, [form])

  // Helper function to get formatted author name from userData
  const getFormattedAuthorName = () => {
    if (!userData) return ""

    const firstName = userData.first_name || ""
    const lastName = userData.last_name || ""

    if (firstName && lastName) {
      return `${firstName} ${lastName}`.trim()
    } else if (firstName) {
      return firstName.trim()
    } else if (lastName) {
      return lastName.trim()
    } else if (userData.display_name) {
      return userData.display_name.trim()
    }

    return ""
  }

  // Set author name when creating a new item and userData is available
  useEffect(() => {
    if ((id === "new" || !id) && userData && !formInitializedRef.current) {
      const authorName = getFormattedAuthorName()
      if (authorName) {
        form.setValue("author", authorName)
      }
    }
  }, [userData, id, form])

  // Auto-resize textarea on component mount and when description changes
  useEffect(() => {
    const description = form.watch("description")
    if (description) {
      // Find the textarea and resize it
      setTimeout(() => {
        const textarea = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement
        if (textarea) {
          textarea.style.height = "auto"
          textarea.style.height = Math.min(textarea.scrollHeight, 600) + "px"
        }
      }, 100)
    }
  }, [form.watch("description")])

  // Fetch content media data if editing an existing item
  useEffect(() => {
    const fetchContentMedia = async () => {
      if (id && id !== "new" && !contentMedia) {
        try {
          setIsLoading(true)
          const data = await getContentMediaById(id)
          if (data && !unmountedRef.current) {
            if (data.thumbnail) {
              setThumbnailUrl(data.thumbnail)
            }

            if (data.video_url) {
              setVideoUrl(data.video_url)

              const videoExists = data.media?.some((item) => item.url === data.video_url)

              if (!videoExists) {
                setMedia((prevMedia) => [
                  ...prevMedia,
                  {
                    url: data.video_url,
                    description: "",
                    id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    created: data.updated || new Date(),
                  },
                ])
              }

              if (
                (data.type === "Video" || data.type === "HPV") &&
                !media.some((item) => item.url && item.url.trim() !== "")
              ) {
                setMedia([
                  {
                    url: data.video_url,
                    description: "",
                    id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                    created: data.updated || new Date(),
                  },
                ])
              }
            }

            if (data.media && Array.isArray(data.media)) {
              const enhancedMedia = data.media.map((item) => ({
                ...item,
                created: item.created || new Date(),
              }))
              setMedia(enhancedMedia)
            } else if (data.articleMedia && Array.isArray(data.articleMedia)) {
              const enhancedMedia = data.articleMedia.map((item) => ({
                ...item,
                url: item.url || item.imageUrl || "",
                created: item.created || new Date(),
              }))
              setMedia(enhancedMedia)
            }

            initializeFormWithData(data)
          } else if (!unmountedRef.current) {
            setError("Content media not found")
          }
        } catch (err) {
          if (!unmountedRef.current) {
            console.error("Error fetching content media:", err)
            setError("Failed to load content media data")
          }
        } finally {
          if (!unmountedRef.current) {
            setIsLoading(false)
          }
        }
      } else if (contentMedia && !formInitializedRef.current) {
        initializeFormWithData(contentMedia)

        if (contentMedia.thumbnail) {
          setThumbnailUrl(contentMedia.thumbnail)
        }

        if (contentMedia.video_url) {
          setVideoUrl(contentMedia.video_url)
        }

        if (contentMedia.media && Array.isArray(contentMedia.media)) {
          const enhancedMedia = contentMedia.media.map((item) => ({
            ...item,
            created: item.created || new Date(),
          }))
          setMedia(enhancedMedia)
        } else if (contentMedia.articleMedia && Array.isArray(contentMedia.articleMedia)) {
          const enhancedMedia = contentMedia.articleMedia.map((item) => ({
            ...item,
            url: item.url || item.imageUrl || "",
            created: item.created || new Date(),
          }))
          setMedia(enhancedMedia)
        }

        setIsLoading(false)
      } else {
        setIsLoading(false)
      }
    }

    fetchContentMedia()
  }, [id, contentMedia, form, media])

  // Helper function to initialize form with content media data
  const initializeFormWithData = (data: ContentMedia) => {
    if (formInitializedRef.current) return

    let startDate: Date | undefined = undefined
    let endDate: Date | undefined = undefined

    if (data.start_date) {
      if (typeof data.start_date === "string") {
        startDate = new Date(data.start_date)
      } else if (data.start_date instanceof Date) {
        startDate = data.start_date
      }
    }

    if (data.end_date) {
      if (typeof data.end_date === "string") {
        endDate = new Date(data.end_date)
      } else if (data.end_date instanceof Date) {
        endDate = data.end_date
      }
    }

    let urlReferences: UrlReference[] = [{ url: "", label: "" }]

    try {
      if (Array.isArray(data.link_ref) && data.link_ref.length > 0) {
        urlReferences = data.link_ref.map((url) => ({
          url: typeof url === "string" ? url : "",
          label:
            typeof url === "string" && url.includes("://") ? new URL(url).hostname : typeof url === "string" ? url : "",
        }))
      }

      if (Array.isArray(data.urlReferences) && data.urlReferences.length > 0) {
        urlReferences = data.urlReferences.map((ref) => ({
          url: typeof ref.url === "string" ? ref.url : "",
          label: typeof ref.label === "string" ? ref.label : "",
        }))
      }

      if (urlReferences.length === 0) {
        urlReferences = [{ url: "", label: "" }]
      }

      setUrlReferencesState(urlReferences)
    } catch (error) {
      console.error("Error processing URL references:", error)
      urlReferences = [{ url: "", label: "" }]
    }

    let mediaItems: EnhancedMediaItem[] = [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }]

    if (data.media && Array.isArray(data.media)) {
      mediaItems = data.media.map((item) => ({
        ...item,
        url: item.url || "",
        description: item.description || "",
        id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        created: item.created || new Date(),
      }))
    } else if (data.articleMedia && Array.isArray(data.articleMedia)) {
      mediaItems = data.articleMedia.map((item) => ({
        url: item.url || item.imageUrl || "",
        description: item.description || "",
        id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        created: item.created || new Date(),
      }))
    }

    if ((data.type === "Video" || data.type === "HPV") && data.video_url) {
      setVideoUrl(data.video_url)

      const videoExists = mediaItems.some((item) => item.url === data.video_url)

      if (!videoExists) {
        setMedia((prevMedia) => [
          ...prevMedia,
          {
            url: data.video_url,
            description: "",
            id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            created: data.updated || new Date(),
          },
        ])
      }

      if (
        (data.type === "Video" || data.type === "HPV") &&
        !mediaItems.some((item) => item.url && item.url.trim() !== "")
      ) {
        setMedia([
          {
            url: data.video_url,
            description: "",
            id: `video-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            created: data.updated || new Date(),
          },
        ])
      }
    }

    const formattedStartDate =
      startDate && isValidDate(startDate)
        ? format(startDate, "yyyy-MM-dd'T'HH:mm")
        : format(new Date(), "yyyy-MM-dd'T'HH:mm")

    const formattedEndDate =
      endDate && isValidDate(endDate)
        ? format(endDate, "yyyy-MM-dd'T'HH:mm")
        : format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")

    form.reset({
      title: data.title || "",
      synopsis: data.synopsis || "",
      description: data.body || data.description || "",
      author: data.author || "",
      urlReferences,
      media: mediaItems,
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      pinned: data.pinned || false,
      pinnedOrder: data.pinnedOrder || 0,
      thumbnail: data.thumbnail || undefined,
      type: (data.type as any) || "Article",
      featured: data.featured || false,
    })

    formInitializedRef.current = true
  }

  // Update form when thumbnail or video URL changes
  useEffect(() => {
    if (thumbnailUrl) {
      form.setValue("thumbnail", thumbnailUrl)
    }
  }, [thumbnailUrl, form])

  // Update form when media changes
  useEffect(() => {
    form.setValue("media", media)
  }, [media, form])

  // Add this function to handle media type changes
  const handleMediaTypeChange = (newType: string) => {
    const currentType = form.getValues("type")

    if (currentType === newType) return

    form.setValue("type", newType as "Article" | "Video" | "HPV")

    if (newType === "Article") {
      setVideoUrl(null)
      setVideoMetadata(null)
    } else if (newType === "Video" || newType === "HPV") {
      setMedia([{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }])
      form.setValue("media", [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }])
    }
  }

  // Update the existing useEffect that watches for media type changes
  useEffect(() => {
    const currentType = form.watch("type")
    if (currentType !== "Video" && currentType !== "HPV") {
      setVideoUrl(null)
      setVideoMetadata(null)
    }
  }, [form.watch("type"), form])

  // Handle thumbnail upload completion
  const handleThumbnailComplete = (url: string) => {
    if (unmountedRef.current) return
    setThumbnailUrl(url)
    form.setValue("thumbnail", url)
    setSuccess("Thumbnail uploaded successfully")
  }

  // Handle thumbnail upload error
  const handleThumbnailError = (error: string) => {
    if (unmountedRef.current) return
    setError(`Thumbnail upload error: ${error}`)
  }

  // Handle video upload status change
  const handleVideoStatusChange = (status: "idle" | "uploading" | "processing" | "success" | "error") => {
    if (unmountedRef.current) return
    setUploadStatus(status)
    if (status === "error") {
      setActiveTab("media")
    }
  }

  // Handle video upload progress
  const handleVideoProgress = (progress: number) => {
    if (unmountedRef.current) return
    setUploadProgress(progress)
  }

  const handleVideoThumbnailComplete = (videoUrl: string, thumbnailUrl?: string, metadata?: any) => {
    if (unmountedRef.current) return

    // Set video URL
    setVideoUrl(videoUrl)
    setVideoMetadata(metadata)

    // Set thumbnail URL if generated
    if (thumbnailUrl) {
      setThumbnailUrl(thumbnailUrl)
      form.setValue("thumbnail", thumbnailUrl)
    }

    // Add video to media array
    const videoMediaItem: EnhancedMediaItem = {
      url: videoUrl,
      description: metadata?.fileName || "Video content",
      id: `video-${Date.now()}`,
      created: new Date(),
    }

    const updatedMedia = [...media.filter((item) => item.url.trim() !== ""), videoMediaItem]
    setMedia(
      updatedMedia.length > 0
        ? updatedMedia
        : [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }],
    )
    form.setValue(
      "media",
      updatedMedia.length > 0
        ? updatedMedia
        : [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }],
    )

    setSuccess("Video and thumbnail uploaded successfully")
    setActiveTab("media")
  }

  const handleVideoThumbnailGenerated = (url: string) => {
    if (unmountedRef.current) return
    setThumbnailUrl(url)
    form.setValue("thumbnail", url)
    setSuccess("Video thumbnail generated successfully")
  }

  // Handle video upload completion
  const handleVideoComplete = (url: string, metadata: any) => {
    if (unmountedRef.current) return

    if (!url || url.trim() === "") {
      setVideoUrl(null)
      setVideoMetadata(null)
      // Remove video from media array
      const updatedMedia = media.filter((item) => !item.url.includes("video_"))
      setMedia(
        updatedMedia.length > 0
          ? updatedMedia
          : [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }],
      )
      form.setValue(
        "media",
        updatedMedia.length > 0
          ? updatedMedia
          : [{ url: "", description: "", id: `media-${Date.now()}`, created: new Date() }],
      )
      return
    }

    setVideoUrl(url)
    setVideoMetadata(metadata)

    const filteredMedia = media.filter((item) => !item.url.includes("video_") && item.url.trim() !== "")

    const videoMediaItem: EnhancedMediaItem = {
      url: url,
      description: metadata?.fileName || "Video content",
      id: `video-${Date.now()}`,
      created: new Date(),
    }

    const updatedMedia = [...filteredMedia, videoMediaItem]
    setMedia(updatedMedia)
    form.setValue("media", updatedMedia)

    setSuccess("Video uploaded successfully")
  }

  // Handle video upload error
  const handleVideoError = (error: string) => {
    if (unmountedRef.current) return
    setError(`Video upload error: ${error}`)
    setActiveTab("media")
  }

  // Handle media change
  const handleMediaChange = (items: MediaItem[]) => {
    if (unmountedRef.current) return

    const processedItems = items.map((item) => {
      if (!item.id) {
        return {
          ...item,
          id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          created: new Date(),
        }
      }
      const existingItem = media.find((m) => m.id === item.id)
      return {
        ...item,
        created: existingItem?.created || new Date(),
      }
    })

    setMedia(processedItems)

    form.setValue("media", processedItems, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  // Handle URL references change
  const handleUrlReferencesChange = (newReferences: UrlReference[]) => {
    if (unmountedRef.current) return

    setUrlReferencesState(newReferences)

    form.setValue("urlReferences", newReferences, {
      shouldValidate: false,
      shouldDirty: true,
      shouldTouch: true,
    })
  }

  // Get video metadata for the player
  const getVideoMetadata = () => {
    if (videoMetadata) {
      return {
        fileName: videoMetadata.fileName || "Uploaded video",
        fileSize: videoMetadata.fileSize ? formatFileSize(videoMetadata.fileSize) : undefined,
        fileType: videoMetadata.fileType || undefined,
        duration: videoMetadata.duration || undefined,
      }
    }

    return {
      fileName: "Video",
    }
  }

  // Format file size to human-readable format
  const formatFileSize = (bytes: number | string): string => {
    if (typeof bytes === "string") {
      return bytes
    }

    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Handle next button click
  const handleNext = () => {
    const currentIndex = tabSequence.indexOf(activeTab)
    if (currentIndex < tabSequence.length - 1) {
      setActiveTab(tabSequence[currentIndex + 1])
    }
  }

  // Handle form submission
  const onSubmit = async (data: FormValues) => {
    try {
      setIsSubmitting(true)
      setError(null)
      setSuccess(null)

      if ((data.type === "Video" || data.type === "HPV") && videoUrl) {
        // Make sure the current video URL is in the media array
        const hasCurrentVideo = data.media?.some((item) => item.url === videoUrl)

        if (!hasCurrentVideo) {
          const videoMediaItem: EnhancedMediaItem = {
            url: videoUrl,
            description: videoMetadata?.fileName || "Video content",
            id: `video-${Date.now()}`,
            created: new Date(),
          }
          data.media = [...(data.media || []), videoMediaItem]
        }
      }

      const urlReferences = urlReferencesState || []

      const filteredUrlReferences = urlReferences.filter(
        (ref) =>
          ref &&
          typeof ref.url === "string" &&
          ref.url.trim() !== "" &&
          typeof ref.label === "string" &&
          ref.label.trim() !== "",
      )

      const filteredMedia = (data.media?.filter((item) => item.url && item.url.trim() !== "") || []).map((item) => ({
        url: item.url,
        description: item.description || "",
        id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        created: item.created || new Date(),
      }))

      const startDate = data.start_date ? new Date(data.start_date) : undefined
      const endDate = data.end_date ? new Date(data.end_date) : undefined

      const mediaData = {
        ...data,
        start_date: startDate,
        end_date: endDate,
        urlReferences: filteredUrlReferences.length > 0 ? filteredUrlReferences : [],
        media: filteredMedia,
        body: data.description,
        link_ref: filteredUrlReferences.map((ref) => ref.url) || [],
        categoryId: categoryId || "",
        category_id: categoryId || "",
        categoryName: categoryName || "",
        thumbnail: thumbnailUrl || data.thumbnail || null,
        video_url: (data.type === "Video" || data.type === "HPV") && videoUrl ? videoUrl : null,
        type: data.type,
        author: data.author || getFormattedAuthorName() || "Unknown author",
        featured: data.featured !== undefined ? data.featured : false,
      }

      const updateCategoryPinnedContents = async (contentId: string, isPinned: boolean) => {
        if (!categoryId) return

        try {
          const categoryRef = doc(db, "content_category", categoryId)
          const categoryDoc = await getDoc(categoryRef)

          if (categoryDoc.exists()) {
            if (isPinned) {
              await updateDoc(categoryRef, {
                pinned_contents: arrayUnion(contentId),
                updated: serverTimestamp(),
              })
            } else {
              await updateDoc(categoryRef, {
                pinned_contents: arrayRemove(contentId),
                updated: serverTimestamp(),
              })
            }
          }
        } catch (error) {
          console.error("Error updating category pinned_contents:", error)
        }
      }

      if (id && id !== "new") {
        await updateContentMedia(id, mediaData)

        await updateCategoryPinnedContents(id, !!data.pinned)

        if (!unmountedRef.current) {
          setSuccess("Content updated successfully")

          setTimeout(() => {
            if (onSuccess && !unmountedRef.current) {
              onSuccess(id)
            }
          }, 500)
        }
      } else {
        const newId = await createContentMedia(mediaData)

        if (newId && data.pinned) {
          await updateCategoryPinnedContents(newId, true)
        }

        if (!unmountedRef.current) {
          setSuccess("Content created successfully")

          setTimeout(() => {
            if (onSuccess && !unmountedRef.current) {
              onSuccess(newId)
            }
          }, 500)
        }
      }
    } catch (err) {
      if (!unmountedRef.current) {
        console.error("Error submitting form:", err)
        setError(err instanceof Error ? err.message : "An unknown error occurred")
      }
    } finally {
      if (!unmountedRef.current) {
        setIsSubmitting(false)
      }
    }
  }

  // Handle cancel button click
  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen flex justify-center items-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-blue-200 rounded-full animate-spin border-t-blue-600 mx-auto"></div>
          <p className="text-gray-600">Loading content...</p>
        </div>
      </div>
    )
  }

  // Get content type icon and color
  const getContentTypeInfo = (type: string) => {
    switch (type) {
      case "Article":
        return { icon: <FileText className="h-4 w-4" />, color: "bg-emerald-500", textColor: "text-emerald-600" }
      case "Video":
        return { icon: <Video className="h-4 w-4" />, color: "bg-purple-500", textColor: "text-purple-600" }
      case "HPV":
        return { icon: <Video className="h-4 w-4" />, color: "bg-indigo-500", textColor: "text-indigo-600" }
      default:
        return { icon: <FileText className="h-4 w-4" />, color: "bg-gray-500", textColor: "text-gray-600" }
    }
  }

  const contentTypeInfo = getContentTypeInfo(form.watch("type"))

  // Check if we're on the last tab (preview)
  const isOnPreviewTab = activeTab === "preview"

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="h-9 w-9 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg ${contentTypeInfo.color} text-white shadow-sm`}>
                {contentTypeInfo.icon}
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  {id && id !== "new" ? "Edit Content" : "Create New Content"}
                </h1>
                <div className="flex items-center space-x-2 mt-1">
                  {categoryName && (
                    <Badge variant="secondary" className="text-xs">
                      {categoryName}
                    </Badge>
                  )}
                  <Badge variant="outline" className="flex items-center space-x-1 text-xs">
                    {contentTypeInfo.icon}
                    <span>{form.watch("type")}</span>
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="text-sm text-gray-500">Completion</div>
              <Progress value={formProgress} className="w-24 h-2" />
              <span className="text-sm font-medium text-gray-700 min-w-[3rem]">{formProgress}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex w-full">
              {/* Enhanced Tabs Navigation */}
              <div className="bg-white border-r border-gray-200 w-64 flex-shrink-0 shadow-sm">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Form Sections</h3>
                  <TabsList className="flex flex-col bg-transparent p-0 space-y-2 w-full h-auto">
                    <TabsTrigger
                      value="details"
                      className="flex items-center justify-start space-x-3 px-4 py-3 h-auto w-full rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent hover:bg-gray-50 transition-all"
                    >
                      <Info className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Media Details</div>
                        <div className="text-xs text-gray-500">Basic information & content</div>
                      </div>
                    </TabsTrigger>

                    <TabsTrigger
                      value="media"
                      className="flex items-center justify-start space-x-3 px-4 py-3 h-auto w-full rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent hover:bg-gray-50 transition-all"
                    >
                      <Upload className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Media Assets</div>
                        <div className="text-xs text-gray-500">Images, videos & thumbnails</div>
                      </div>
                    </TabsTrigger>

                    <TabsTrigger
                      value="metadata"
                      className="flex items-center justify-start space-x-3 px-4 py-3 h-auto w-full rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent hover:bg-gray-50 transition-all"
                    >
                      <Database className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Metadata</div>
                        <div className="text-xs text-gray-500">References & external links</div>
                      </div>
                    </TabsTrigger>

                    <TabsTrigger
                      value="settings"
                      className="flex items-center justify-start space-x-3 px-4 py-3 h-auto w-full rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent hover:bg-gray-50 transition-all"
                    >
                      <Settings className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Advanced Settings</div>
                        <div className="text-xs text-gray-500">Schedule & visibility options</div>
                      </div>
                    </TabsTrigger>

                    <TabsTrigger
                      value="preview"
                      className="flex items-center justify-start space-x-3 px-4 py-3 h-auto w-full rounded-lg data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm border border-transparent hover:bg-gray-50 transition-all"
                    >
                      <Eye className="h-4 w-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">Preview</div>
                        <div className="text-xs text-gray-500">Review before publishing</div>
                      </div>
                    </TabsTrigger>
                  </TabsList>
                </div>
              </div>

              {/* Main Content Area with Full Visibility */}
              <div className="flex-1 flex flex-col bg-gray-50">
                <div className="flex-1">
                  <div className="p-6">
                    {/* Media Details Tab */}
                    <TabsContent value="details" className="mt-0 space-y-6">
                      {/* Content Type Selection */}
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <FileText className="h-5 w-5" />
                            <span>Content Type</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <div className="grid grid-cols-3 gap-4">
                                    {["Article", "Video", "HPV"].map((type) => {
                                      const typeInfo = getContentTypeInfo(type)
                                      return (
                                        <div
                                          key={type}
                                          className={`cursor-pointer rounded-lg border-2 p-4 transition-all hover:shadow-md ${
                                            field.value === type
                                              ? `border-${type === "Article" ? "emerald" : type === "Video" ? "purple" : "indigo"}-300 bg-${type === "Article" ? "emerald" : "Video" ? "purple" : "indigo"}-50 shadow-sm`
                                              : "border-gray-200 hover:border-gray-300 bg-white"
                                          }`}
                                          onClick={() => {
                                            field.onChange(type)
                                            handleMediaTypeChange(type)
                                          }}
                                        >
                                          <div className="flex flex-col items-center space-y-2 text-center">
                                            <div
                                              className={`p-3 rounded-lg ${
                                                field.value === type
                                                  ? `${typeInfo.color} text-white`
                                                  : "bg-gray-100 text-gray-500"
                                              }`}
                                            >
                                              {typeInfo.icon}
                                            </div>
                                            <span className="text-sm font-medium">{type}</span>
                                            <span className="text-xs text-gray-500">
                                              {type === "Article" && "Text-based content with images"}
                                              {type === "Video" && "Video content with player"}
                                              {type === "HPV" && "High-priority video content"}
                                            </span>
                                          </div>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>

                      {/* Basic Information */}
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <User className="h-5 w-5" />
                            <span>Basic Information</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">
                                  Title <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Enter a compelling title"
                                    {...field}
                                    value={field.value || ""}
                                    className="h-11"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="author"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Author</FormLabel>
                                <FormControl>
                                  <Input
                                    placeholder="Content author name"
                                    {...field}
                                    value={field.value || ""}
                                    className="h-11"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="synopsis"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Synopsis</FormLabel>
                                <FormControl>
                                  <Textarea
                                    placeholder="Brief summary or excerpt..."
                                    className="min-h-[80px] resize-none"
                                    {...field}
                                    value={field.value || ""}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-sm font-medium">Main Content</FormLabel>
                                <FormControl>
                                  <div className="space-y-2">
                                    <Textarea
                                      placeholder="Write your main content here..."
                                      className="min-h-[120px] max-h-[600px] resize-none overflow-y-auto"
                                      {...field}
                                      value={field.value || ""}
                                      onChange={(e) => {
                                        field.onChange(e)
                                        // Auto-resize the textarea
                                        const target = e.target as HTMLTextAreaElement
                                        target.style.height = "auto"
                                        target.style.height = Math.min(target.scrollHeight, 600) + "px"
                                      }}
                                      onInput={(e) => {
                                        // Auto-resize on input as well
                                        const target = e.target as HTMLTextAreaElement
                                        target.style.height = "auto"
                                        target.style.height = Math.min(target.scrollHeight, 600) + "px"
                                      }}
                                      style={{
                                        height: field.value ? "auto" : "120px",
                                      }}
                                    />
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="text-gray-500">
                                        Content will auto-expand as you type (max height: 600px)
                                      </span>
                                      <span
                                        className={`font-medium ${
                                          (field.value?.length || 0) > 4500
                                            ? "text-red-600"
                                            : (field.value?.length || 0) > 4000
                                              ? "text-amber-600"
                                              : "text-gray-500"
                                        }`}
                                      >
                                        {field.value?.length || 0} / 5,000 characters
                                      </span>
                                    </div>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Media Assets Tab */}
                    <TabsContent value="media" className="mt-0 space-y-6">
                      {/* Thumbnail Section */}
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <ImageIcon className="h-5 w-5" />
                            <span>Thumbnail Image</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {thumbnailUrl ? (
                            <div className="space-y-4">
                              <div className="relative aspect-video w-full max-w-lg mx-auto overflow-hidden rounded-lg border bg-gray-50 shadow-sm">
                                <img
                                  src={thumbnailUrl || "/placeholder.svg"}
                                  alt="Thumbnail"
                                  className="h-full w-full object-cover"
                                />
                              </div>
                              <div className="flex justify-center">
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => {
                                    setThumbnailUrl(null)
                                    form.setValue("thumbnail", undefined)
                                  }}
                                  className="flex items-center space-x-2"
                                >
                                  <X className="h-4 w-4" />
                                  <span>Remove Thumbnail</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <ThumbnailUploader
                              onComplete={handleThumbnailComplete}
                              onError={handleThumbnailError}
                              userId={userData?.uid || "unknown"}
                              disabled={isSubmitting}
                            />
                          )}
                        </CardContent>
                      </Card>

                      {/* Enhanced Video Section for Video/HPV types */}
                      {(form.watch("type") === "Video" || form.watch("type") === "HPV") && (
                        <Card className="shadow-sm border-0">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center space-x-2">
                              <Video className="h-5 w-5" />
                              <span>Video Content & Thumbnail</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <VideoThumbnailUploader
                              onComplete={handleVideoThumbnailComplete}
                              onError={handleVideoError}
                              onThumbnailGenerated={handleVideoThumbnailGenerated}
                              userId={userData?.uid || "unknown"}
                              disabled={isSubmitting}
                              currentVideoUrl={videoUrl}
                              currentThumbnailUrl={thumbnailUrl}
                              autoGenerateThumbnail={true}
                            />
                          </CardContent>
                        </Card>
                      )}

                      {/* Article Images for Article type */}
                      {form.watch("type") === "Article" && (
                        <Card className="shadow-sm border-0">
                          <CardHeader className="pb-4">
                            <CardTitle className="text-lg flex items-center space-x-2">
                              <ImageIcon className="h-5 w-5" />
                              <span>Article Images</span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <FormField
                              control={form.control}
                              name="media"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <MediaField
                                      value={media}
                                      onChange={handleMediaChange}
                                      userId={userData?.uid || "unknown"}
                                      disabled={isSubmitting}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    {/* Metadata Tab */}
                    <TabsContent value="metadata" className="mt-0 space-y-6">
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Link className="h-5 w-5" />
                            <span>External References</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <FormField
                            control={form.control}
                            name="urlReferences"
                            render={() => (
                              <FormItem>
                                <FormControl>
                                  <EnhancedUrlReferencesField
                                    value={urlReferencesState}
                                    onChange={handleUrlReferencesChange}
                                    disabled={isSubmitting}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Advanced Settings Tab */}
                    <TabsContent value="settings" className="mt-0 space-y-6">
                      {/* Schedule Settings */}
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Calendar className="h-5 w-5" />
                            <span>Publishing Schedule</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="grid gap-6 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="start_date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">Start Date & Time</FormLabel>
                                  <FormControl>
                                    <Input type="datetime-local" {...field} disabled={isSubmitting} className="h-11" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="end_date"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel className="text-sm font-medium">End Date & Time</FormLabel>
                                  <FormControl>
                                    <Input type="datetime-local" {...field} disabled={isSubmitting} className="h-11" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Content Options */}
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Pin className="h-5 w-5" />
                            <span>Visibility Options</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="">
                          <FormField
                            control={form.control}
                            name="featured"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4 bg-gray-50">
                                <FormControl>
                                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                  <FormLabel className="text-sm font-medium cursor-pointer">
                                    Feature this content
                                  </FormLabel>
                                  <p className="text-sm text-gray-500">
                                    Featured content will be prominently displayed and given priority in listings
                                  </p>
                                </div>
                              </FormItem>
                            )}
                          />
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Preview Tab */}
                    <TabsContent value="preview" className="mt-0 space-y-6">
                      <Card className="shadow-sm border-0">
                        <CardHeader className="pb-4">
                          <CardTitle className="text-lg flex items-center space-x-2">
                            <Eye className="h-5 w-5" />
                            <span>Content Preview</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="border rounded-lg p-6 bg-white shadow-sm">
                            <div className="space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-2">
                                  <h3 className="text-xl font-semibold text-gray-900">
                                    {form.watch("title") || "Untitled Content"}
                                  </h3>
                                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                                    {form.watch("author") && (
                                      <span className="flex items-center space-x-1">
                                        <User className="h-3 w-3" />
                                        <span>{form.watch("author")}</span>
                                      </span>
                                    )}
                                    {form.watch("start_date") && (
                                      <span className="flex items-center space-x-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{new Date(form.watch("start_date")).toLocaleDateString()}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge variant="outline" className="flex items-center space-x-1">
                                    {contentTypeInfo.icon}
                                    <span>{form.watch("type")}</span>
                                  </Badge>
                                  {form.watch("pinned") && (
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                      <Pin className="h-3 w-3 mr-1" />
                                      Pinned
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {thumbnailUrl && (
                                <div className="aspect-video w-full max-w-md rounded-lg overflow-hidden border">
                                  <img
                                    src={thumbnailUrl || "/placeholder.svg"}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}

                              {form.watch("synopsis") && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-gray-700">Synopsis</h4>
                                  <p className="text-sm text-gray-600 leading-relaxed">{form.watch("synopsis")}</p>
                                </div>
                              )}

                              {form.watch("description") && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-gray-700">Content</h4>
                                  <div className="text-sm text-gray-600 leading-relaxed max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
                                    {form.watch("description")}
                                  </div>
                                </div>
                              )}

                              {urlReferencesState.some((ref) => ref.url && ref.label) && (
                                <div className="space-y-2">
                                  <h4 className="text-sm font-medium text-gray-700">External References</h4>
                                  <div className="space-y-1">
                                    {urlReferencesState
                                      .filter((ref) => ref.url && ref.label)
                                      .map((ref, index) => (
                                        <a
                                          key={index}
                                          href={ref.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
                                        >
                                          <Link className="h-3 w-3" />
                                          <span>{ref.label}</span>
                                        </a>
                                      ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </div>
                </div>

                {/* Enhanced Fixed Footer */}
                <div className="flex-shrink-0 border-t bg-white px-6 py-4 shadow-sm">
                  <div className="flex justify-between items-center">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSubmitting}
                      className="flex items-center space-x-2 bg-transparent"
                    >
                      <X className="h-4 w-4" />
                      <span>Cancel</span>
                    </Button>

                    <div className="flex items-center space-x-3">
                      {process.env.NODE_ENV === "development" && (
                        <Button type="button" variant="outline" onClick={() => setShowDebug(!showDebug)} size="sm">
                          Debug
                        </Button>
                      )}

                      {isOnPreviewTab ? (
                        <Button
                          type="submit"
                          disabled={isSubmitting}
                          className="flex items-center space-x-2 min-w-[120px]"
                        >
                          {isSubmitting ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              <span>{id !== "new" ? "Update Content" : "Create Content"}</span>
                            </>
                          )}
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          onClick={handleNext}
                          disabled={isSubmitting}
                          className="flex items-center space-x-2 min-w-[120px]"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Tabs>
          </form>
        </Form>
      </div>

      {/* Enhanced Debug Panel */}
      {showDebug && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl m-4 border-0 shadow-xl">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="font-semibold">Debug Information</div>
              <Button variant="outline" size="sm" onClick={() => setShowDebug(false)} className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="p-4 max-h-[60vh]">
              <pre className="text-xs bg-gray-50 p-4 rounded-lg border font-mono">
                {JSON.stringify(
                  {
                    values: form.getValues(),
                    errors: form.formState.errors,
                    isDirty: form.formState.isDirty,
                    dirtyFields: form.formState.dirtyFields,
                    urlReferencesState,
                    contentMedia,
                    thumbnailUrl,
                    videoUrl,
                    videoMetadata,
                    media,
                    userData: {
                      first_name: userData?.first_name,
                      last_name: userData?.last_name,
                      display_name: userData?.display_name,
                      uid: userData?.uid,
                    },
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
