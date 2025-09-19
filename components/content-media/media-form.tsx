"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, CheckCircle, X, Play, Pause, Volume2, VolumeX, AlertCircle, FileVideo, ImageIcon } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getContentCategories } from "@/lib/content-category"
import type { ContentCategory } from "@/types/content-category"
import { useAuth } from "@/contexts/auth-context"
import { getContentMediaById, createContentMedia, updateContentMedia } from "@/lib/content-media"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { EnhancedUrlReferencesField } from "@/components/content-media/enhanced-url-references-field"
import { ArticleMediaField, type ArticleMediaItem } from "@/components/content-media/article-media-field"
import type { ContentMedia } from "@/types/content-media"
import { Switch } from "@/components/ui/switch"

// Form schema
const formSchema = z.object({
  title: z.string().min(2, { message: "Title must be at least 2 characters" }).max(100),
  description: z.string().max(500, { message: "Description must be less than 500 characters" }).optional(),
  type: z.enum(["HPV", "Article", "Video"], {
    required_error: "Media type is required",
  }),
  category_id: z.string().min(1, { message: "Category is required" }),
  author: z.string().min(1, { message: "Author is required" }),
  active: z.boolean(),
  featured: z.boolean(),
  position: z.coerce.number().int().min(0),
  public: z.boolean(),
  thumbnail: z.any().optional(),
  mediaFile: z.any().optional(),
  videoFile: z.any().optional(),
  video_url: z.string().optional().nullable(), // Allow null values
  // HPV specific fields
  hpv: z.string().optional(),
  // Article specific fields
  synopsis: z.string().max(1000).optional(),
  articleMedia: z
    .array(
      z.object({
        imageUrl: z.string(),
        description: z.string(),
        id: z.string(),
      }),
    )
    .optional(),
  // Video specific fields
  body: z.string().max(2000).optional(),
  urlReferences: z
    .array(
      z.object({
        url: z.string().url("Please enter a valid URL").min(1, "URL is required"),
        label: z.string().min(1, "Label is required").max(100, "Label must be less than 100 characters"),
      }),
    )
    .optional(),
  placement: z.string().optional(),
  // Common date fields
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  episode_number: z.coerce.number().int().min(0).optional(),
  orientation: z.coerce.number().min(0).max(100).default(0),
  pin_to_lobby: z.boolean().default(false),
})

type FormValues = z.infer<typeof formSchema>

interface MediaFormProps {
  id?: string
  categoryId?: string
  categoryName?: string
  contentMedia?: ContentMedia | null
  onSuccess: (id?: string) => void
  onCancel: () => void
  onBack: () => void
}

export function MediaForm({ id, categoryId, categoryName, contentMedia, onSuccess, onCancel, onBack }: MediaFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!!id && id !== "new" && !contentMedia)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [redirecting, setRedirecting] = useState(false)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)
  const [existingThumbnail, setExistingThumbnail] = useState<string | null>(null)
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaFileName, setMediaFileName] = useState<string | null>(null)
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoFileName, setVideoFileName] = useState<string | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [categories, setCategories] = useState<ContentCategory[]>([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const { user, userData } = useAuth()
  const [activeTab, setActiveTab] = useState("content")
  const videoPlayerRef = useRef<HTMLVideoElement>(null)
  const [articleMedia, setArticleMedia] = useState<ArticleMediaItem[]>([
    { imageUrl: "", description: "", id: `article-media-${Date.now()}` },
  ])
  const unmountedRef = useRef(false)
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Add state for video duration
  const [videoDuration, setVideoDuration] = useState("00:00:00")
  const [videoCurrentTime, setVideoCurrentTime] = useState("00:00:00")

  // Add these new states to the component
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [videoVolume, setVideoVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)
  const [isVideoLoading, setIsVideoLoading] = useState(false)
  const [videoFormat, setVideoFormat] = useState<string | null>(null)
  const [videoError, setVideoError] = useState<string | null>(null)

  // Video upload states
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [uploadedVideoUrl, setUploadedVideoUrl] = useState<string | null>(null)
  const [videoSize, setVideoSize] = useState<string | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<{
    width?: number
    height?: number
    duration?: number
  }>({})

  // URL references state
  const [urlReferences, setUrlReferences] = useState<{ url: string; label: string }[]>([{ url: "", label: "" }])

  // Track component mount state
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true

      // Clear any pending timeouts
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
        redirectTimeoutRef.current = null
      }
    }
  }, [])

  // Initialize form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "HPV", // Default type
      category_id: categoryId || "",
      author:
        userData?.first_name && userData?.last_name
          ? `${userData.first_name} ${userData.lastName}`
          : userData?.display_name || "",
      active: true,
      featured: false,
      position: 0,
      public: true,
      thumbnail: undefined,
      mediaFile: undefined,
      videoFile: undefined,
      // Default values for type-specific fields
      hpv: "",
      synopsis: "",
      body: "",
      urlReferences: [{ url: "", label: "" }],
      articleMedia: [{ imageUrl: "", description: "", id: `article-media-${Date.now()}` }],
      placement: "608", // Default placement
      start_time: "",
      end_time: "",
      start_date: "",
      end_date: "",
      episode_number: 0,
      orientation: 0,
      pin_to_lobby: false,
      video_url: "",
    },
    mode: "onChange",
  })

  // Add a watch function to observe the selected media type
  const mediaType = form.watch("type")
  const orientation = form.watch("orientation")
  const isPublic = form.watch("public")

  // Load content categories
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true)
        const categoriesData = await getContentCategories({
          showDeleted: false,
          searchQuery: "",
          active: true,
        })
        if (!unmountedRef.current) {
          setCategories(categoriesData)
        }
      } catch (error) {
        console.error("Error loading categories:", error)
        if (!unmountedRef.current) {
          toast({
            title: "Error",
            description: "Failed to load content categories",
            variant: "destructive",
          })
        }
      } finally {
        if (!unmountedRef.current) {
          setLoadingCategories(false)
        }
      }
    }

    loadCategories()
  }, [toast])

  // Load existing media data if editing
  useEffect(() => {
    const loadMedia = async () => {
      if (id && id !== "new" && !contentMedia) {
        try {
          setInitialLoading(true)
          const media = await getContentMediaById(id)

          if (media && !unmountedRef.current) {
            // Set thumbnail if it exists
            if (media.thumbnail) {
              setExistingThumbnail(media.thumbnail)
            }

            // Set video URL if it exists
            if (media.video_url) {
              setUploadedVideoUrl(media.video_url)
            }

            // Process URL references
            let processedUrlReferences = [{ url: "", label: "" }]

            // Handle urlReferences object array (new format)
            if (Array.isArray(media.urlReferences) && media.urlReferences.length > 0) {
              processedUrlReferences = media.urlReferences
            }
            // Handle link_ref array (old format)
            else if (Array.isArray(media.link_ref) && media.link_ref.length > 0) {
              processedUrlReferences = media.link_ref.map((url) => ({
                url,
                label: url.includes("://") ? new URL(url).hostname : url,
              }))
            }

            setUrlReferences(processedUrlReferences)

            // Set article media if it exists
            if (media.articleMedia && Array.isArray(media.articleMedia)) {
              setArticleMedia(media.articleMedia)
            }

            // Log media data for debugging
            console.log("Loaded media data:", media)

            // Add debug logging for media array
            if (media.media && Array.isArray(media.media)) {
              console.log("Media array content:", media.media)
            }

            form.reset({
              title: media.title,
              description: media.description || "",
              type: media.type,
              category_id: media.category_id,
              author: media.author,
              active: media.active,
              featured: media.featured,
              position: media.position,
              public: media.public,
              thumbnail: undefined,
              mediaFile: undefined,
              videoFile: undefined,
              hpv: media.hpv || "",
              synopsis: media.synopsis || "",
              body: media.body || "",
              urlReferences: processedUrlReferences,
              articleMedia: media.articleMedia || [
                { imageUrl: "", description: "", id: `article-media-${Date.now()}` },
              ],
              placement: media.placement || "608",
              start_time: media.start_time || "",
              end_time: media.end_time || "",
              start_date: media.start_date || "",
              end_date: media.end_date || "",
              episode_number: media.episode || 0,
              orientation: media.orientation ? Number.parseInt(media.orientation) : 0,
              pin_to_lobby: media.pinned || false,
              video_url: media.video_url || "",
            })

            // Update the active tab based on the content type
            if (media.type === "Article") {
              setActiveTab("content")
            } else if (media.type === "Video" || media.type === "HPV") {
              setActiveTab("media")
            }
          }

          if (!unmountedRef.current) {
            setInitialLoading(false)
          }
        } catch (error) {
          console.error("Error loading media:", error)
          if (!unmountedRef.current) {
            toast({
              title: "Error",
              description: "Failed to load media data",
              variant: "destructive",
            })
            // Redirect back on error
            onBack()
          }
        }
      } else if (contentMedia) {
        // If contentMedia is provided directly, use it
        if (contentMedia.thumbnail) {
          setExistingThumbnail(contentMedia.thumbnail)
        }

        if (contentMedia.video_url) {
          setUploadedVideoUrl(contentMedia.video_url)
        }

        // Process URL references
        let processedUrlReferences = [{ url: "", label: "" }]

        // Handle urlReferences object array (new format)
        if (Array.isArray(contentMedia.urlReferences) && contentMedia.urlReferences.length > 0) {
          processedUrlReferences = contentMedia.urlReferences
        }
        // Handle link_ref array (old format)
        else if (Array.isArray(contentMedia.link_ref) && contentMedia.link_ref.length > 0) {
          processedUrlReferences = contentMedia.link_ref.map((url) => ({
            url,
            label: url.includes("://") ? new URL(url).hostname : url,
          }))
        }

        setUrlReferences(processedUrlReferences)

        // Set article media if it exists
        if (contentMedia.articleMedia && Array.isArray(contentMedia.articleMedia)) {
          setArticleMedia(contentMedia.articleMedia)
        }

        form.reset({
          title: contentMedia.title,
          description: contentMedia.description || "",
          type: contentMedia.type,
          category_id: contentMedia.category_id,
          author: contentMedia.author,
          active: contentMedia.active,
          featured: contentMedia.featured,
          position: contentMedia.position,
          public: contentMedia.public,
          thumbnail: undefined,
          mediaFile: undefined,
          videoFile: undefined,
          hpv: contentMedia.hpv || "",
          synopsis: contentMedia.synopsis || "",
          body: contentMedia.body || "",
          urlReferences: processedUrlReferences,
          articleMedia: contentMedia.articleMedia || [
            { imageUrl: "", description: "", id: `article-media-${Date.now()}` },
          ],
          placement: contentMedia.placement || "608",
          start_time: contentMedia.start_time || "",
          end_time: contentMedia.end_time || "",
          start_date: contentMedia.start_date || "",
          end_date: contentMedia.end_date || "",
          episode_number: contentMedia.episode || 0,
          orientation: contentMedia.orientation ? Number.parseInt(contentMedia.orientation) : 0,
          pin_to_lobby: contentMedia.pinned || false,
          video_url: contentMedia.video_url || "",
        })

        // Update the active tab based on the content type
        if (contentMedia.type === "Article") {
          setActiveTab("content")
        } else if (contentMedia.type === "Video" || contentMedia.type === "HPV") {
          setActiveTab("media")
        }

        setInitialLoading(false)
      } else {
        // If it's a new media, ensure we're not in loading state
        setInitialLoading(false)
        form.setValue(
          "author",
          userData?.first_name && userData?.last_name
            ? `${userData.first_name} ${userData.lastName}`
            : userData?.display_name || "",
        )
      }
    }

    loadMedia()
  }, [id, categoryId, toast, onBack, form, userData, contentMedia])

  // Update form when article media changes
  useEffect(() => {
    form.setValue("articleMedia", articleMedia)
  }, [articleMedia, form])

  // Handle thumbnail file selection
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    // Clear any existing preview URL to prevent memory leaks
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl)
    }

    setThumbnailFile(file)
    form.setValue("thumbnail", file)

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setThumbnailPreviewUrl(previewUrl)
    setExistingThumbnail(null) // Clear existing thumbnail when a new one is selected
  }

  // Handle media file selection
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset video states
    setVideoError(null)
    setIsVideoLoading(true)
    setVideoFormat(file.type)

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, WebM, etc.)",
        variant: "destructive",
      })
      setVideoError("Invalid file type. Please upload a video file.")
      setIsVideoLoading(false)
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB",
        variant: "destructive",
      })
      setVideoError("File too large. Please upload a file smaller than 10MB.")
      setIsVideoLoading(false)
      return
    }

    // Clear any existing preview URL to prevent memory leaks
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
    }

    setMediaFile(file)
    setMediaFileName(file.name)
    form.setValue("mediaFile", file)

    // Create video preview URL for the APV player
    const previewUrl = URL.createObjectURL(file)
    setVideoPreviewUrl(previewUrl)

    // Reset the video file since we're using the media file for preview
    if (videoFile) {
      clearVideoFile()
    }
  }

  // Handle video file selection and upload
  const handleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset video states
    setVideoError(null)
    setUploadError(null)
    setUploadSuccess(false)
    setIsVideoLoading(true)
    setVideoFormat(file.type)
    setVideoSize(formatFileSize(file.size))

    // Validate file type
    if (!file.type.startsWith("video/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, WebM, etc.)",
        variant: "destructive",
      })
      setVideoError("Invalid file type. Please upload a video file.")
      setIsVideoLoading(false)
      return
    }

    // Validate file size (max 2GB)
    const maxSize = 2 * 1024 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: "Please upload a video smaller than 2GB",
        variant: "destructive",
      })
      setVideoError(
        `File too large (${formatFileSize(file.size)}). Please upload a file smaller than ${formatFileSize(maxSize)}.`,
      )
      setIsVideoLoading(false)
      return
    }

    // Clear any existing preview URL to prevent memory leaks
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
    }

    setVideoFile(file)
    setVideoFileName(file.name)
    form.setValue("videoFile", file)

    // Create video preview URL for local preview
    const previewUrl = URL.createObjectURL(file)
    setVideoPreviewUrl(previewUrl)

    // Start upload process
    await uploadVideo(file)
  }

  // Handle article media change
  const handleArticleMediaChange = (items: ArticleMediaItem[]) => {
    if (unmountedRef.current) return

    // Generate new IDs for any items without IDs
    const processedItems = items.map((item) => {
      if (!item.id) {
        return { ...item, id: `article-media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` }
      }
      return item
    })

    // Set local state
    setArticleMedia(processedItems)

    // Important: Also update the form value directly to ensure it's in sync
    form.setValue("articleMedia", processedItems, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    })

    // Log for debugging
    console.log("Article media updated:", processedItems)
  }

  // Add a function to clear video file
  const clearVideoFile = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
    }
    setVideoFile(null)
    setVideoFileName(null)
    setVideoPreviewUrl(null)
    form.setValue("videoFile", undefined)
  }

  // Clear thumbnail selection
  const clearThumbnail = () => {
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl)
    }
    setThumbnailFile(null)
    setThumbnailPreviewUrl(null)
    form.setValue("thumbnail", undefined)
  }

  // Clear existing thumbnail
  const clearExistingThumbnail = () => {
    setExistingThumbnail(null)
    form.setValue("thumbnail", undefined)
  }

  // Clear media file
  const clearMediaFile = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl)
      setVideoPreviewUrl(null)
    }
    setMediaFile(null)
    setMediaFileName(null)
    form.setValue("mediaFile", undefined)
  }

  // Upload video to Firebase Storage
  const uploadVideo = async (file: File) => {
    try {
      setIsUploading(true)
      setUploadProgress(0)

      // Determine storage path - using a unique path for each upload
      const timestamp = Date.now()
      const fileExtension = file.name.split(".").pop()
      const fileName = `${timestamp}_${file.name}`
      const storagePath = `media/${userData?.uid || "unknown"}/${fileName}`

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
          if (!unmountedRef.current) {
            setUploadProgress(progress)
          }

          // Update status based on state
          switch (snapshot.state) {
            case "paused":
              console.log("Upload paused")
              break
            case "running":
              console.log("Upload running")
              break
          }
        },
        (error) => {
          // Handle upload errors
          console.error("Upload error:", error)
          if (!unmountedRef.current) {
            setUploadError("Failed to upload video. Please try again.")
            setIsUploading(false)

            // Show error toast
            toast({
              title: "Upload failed",
              description: "There was an error uploading your video. Please try again.",
              variant: "destructive",
            })
          }
        },
        async () => {
          // Handle successful upload
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)
            if (!unmountedRef.current) {
              setUploadedVideoUrl(downloadURL)

              // Update form value
              form.setValue("video_url", downloadURL)

              // Show success message
              setUploadSuccess(true)
              setIsUploading(false)

              toast({
                title: "Upload complete",
                description: "Your video has been successfully uploaded.",
                variant: "default",
              })

              // Update video processing state
              setIsVideoLoading(false)
            }
          } catch (error) {
            console.error("Error getting download URL:", error)
            if (!unmountedRef.current) {
              setUploadError("Upload completed, but couldn't retrieve the video URL.")
              setIsUploading(false)
            }
          }
        },
      )
    } catch (error) {
      console.error("Upload setup error:", error)
      if (!unmountedRef.current) {
        setUploadError("Failed to start upload. Please try again.")
        setIsUploading(false)

        toast({
          title: "Upload failed",
          description: "There was an error setting up the upload. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Upload thumbnail to Firebase Storage
  const uploadThumbnail = async (file: File) => {
    try {
      // Determine storage path - using a unique path for each upload
      const timestamp = Date.now()
      const fileExtension = file.name.split(".").pop()
      const fileName = `${timestamp}_${file.name}`
      const storagePath = `thumbnails/${userData?.uid || "unknown"}/${fileName}`

      // Create storage reference
      const storageRef = ref(storage, storagePath)

      // Create upload task
      const uploadTask = uploadBytesResumable(storageRef, file)

      // Show loading toast
      toast({
        title: "Uploading thumbnail",
        description: "Please wait while we upload your thumbnail...",
      })

      // Listen for state changes, errors, and completion
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          console.log(`Thumbnail upload progress: ${progress}%`)
        },
        (error) => {
          // Handle upload errors
          console.error("Thumbnail upload error:", error)

          // Show error toast
          if (!unmountedRef.current) {
            toast({
              title: "Upload failed",
              description: "There was an error uploading your thumbnail. Please try again.",
              variant: "destructive",
            })
          }
        },
        async () => {
          // Handle successful upload
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

            if (!unmountedRef.current) {
              // Update form value
              form.setValue("thumbnail", downloadURL)
              setExistingThumbnail(downloadURL)

              // Clear the file input
              if (thumbnailPreviewUrl) {
                URL.revokeObjectURL(thumbnailPreviewUrl)
              }
              setThumbnailFile(null)
              setThumbnailPreviewUrl(null)

              // Show success toast
              toast({
                title: "Upload complete",
                description: "Your thumbnail has been successfully uploaded.",
                variant: "default",
              })
            }
          } catch (error) {
            console.error("Error getting thumbnail download URL:", error)

            if (!unmountedRef.current) {
              toast({
                title: "Upload issue",
                description: "Upload completed, but couldn't retrieve the thumbnail URL.",
                variant: "destructive",
              })
            }
          }
        },
      )
    } catch (error) {
      console.error("Thumbnail upload setup error:", error)

      if (!unmountedRef.current) {
        toast({
          title: "Upload failed",
          description: "There was an error setting up the thumbnail upload. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Handle URL references
  const handleAddUrlReference = () => {
    const newReferences = [...urlReferences, { url: "", label: "" }]
    setUrlReferences(newReferences)
    form.setValue("urlReferences", newReferences)
  }

  const handleRemoveUrlReference = (index: number) => {
    const newReferences = urlReferences.filter((_, i) => i !== index)
    setUrlReferences(newReferences)
    form.setValue("urlReferences", newReferences)
  }

  const handleUrlReferenceChange = (index: number, field: "url" | "label", value: string) => {
    const newReferences = [...urlReferences]
    newReferences[index][field] = value
    setUrlReferences(newReferences)
    form.setValue("urlReferences", newReferences)
  }

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"

    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Convert seconds to HH:MM:SS format
  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    return [hrs > 0 ? String(hrs).padStart(2, "0") : null, String(mins).padStart(2, "0"), String(secs).padStart(2, "0")]
      .filter(Boolean)
      .join(":")
  }

  // Form submission handler
  const onSubmit = async (values: FormValues) => {
    try {
      setLoading(true)
      setSaveSuccess(false)

      // Log the current form and component state
      console.log("Form submission - form values:", values)
      console.log("Form submission - articleMedia state:", articleMedia)

      // Ensure articleMedia from component state is synchronized with form
      if (values.type === "Article" && articleMedia.length > 0) {
        // Use the component state as the source of truth for article media
        values.articleMedia = [...articleMedia]
      }

      // Upload thumbnail if selected
      if (thumbnailFile) {
        await uploadThumbnail(thumbnailFile)
      }

      // Prepare data for submission
      const mediaData: any = {
        ...values,
        thumbnail: existingThumbnail || null,
        video_url: uploadedVideoUrl || values.video_url || null, // Ensure video_url is never undefined
        // Convert urlReferences to link_ref for backward compatibility
        link_ref: values.urlReferences?.map((ref) => ref.url) || [],
        // Filter out empty article media items
        articleMedia: values.articleMedia?.filter((item) => item.imageUrl.trim() !== "") || [],
        // Ensure category_id is set
        category_id: values.category_id || categoryId,
        // Set pinned from pin_to_lobby
        pinned: values.pin_to_lobby,
        // Explicitly include the type field
        type: values.type,
      }

      console.log("Submitting form with values:", mediaData)

      // Create or update content media
      if (id && id !== "new") {
        await updateContentMedia(id, mediaData)
      } else {
        id = await createContentMedia(mediaData)
      }

      // Set success state
      if (!unmountedRef.current) {
        setSaveSuccess(true)
        form.reset(values) // Reset form to mark it as "not dirty"

        // Start redirection process
        setRedirecting(true)

        // Delay redirection slightly to show success state
        redirectTimeoutRef.current = setTimeout(() => {
          if (!unmountedRef.current) {
            onSuccess(id)
          }
        }, 1000)
      }
    } catch (error) {
      console.error("Error saving media:", error)
      if (!unmountedRef.current) {
        const errorMessage = error instanceof Error ? error.message : "Failed to save media"
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        setRedirecting(false)
      }
    } finally {
      if (!unmountedRef.current) {
        setLoading(false)
      }
    }
  }

  // Revoke thumbnail and video URLs on unmount
  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl)
      }
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
    }
  }, [thumbnailPreviewUrl, videoPreviewUrl])

  // Handle return button click
  const handleReturn = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (loading || redirecting) return

    onCancel()
  }

  // Add these new video control functions
  const toggleVideoPlay = () => {
    const video = videoPlayerRef.current
    if (!video) return

    if (isVideoPlaying) {
      video.pause()
    } else {
      video.play()
    }
    setIsVideoPlaying(!isVideoPlaying)
  }

  const toggleMute = () => {
    const video = videoPlayerRef.current
    if (!video) return

    video.muted = !video.muted
    setIsMuted(!isMuted)
  }

  const handleVolumeChange = (value: number[]) => {
    const volume = value[0]
    const video = videoPlayerRef.current
    if (!video) return

    video.volume = volume / 100
    setVideoVolume(volume / 100)
    setIsMuted(volume === 0)
  }

  // Add a function to seek to position in video
  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoPlayerRef.current
    if (!video) return

    const progressBar = e.currentTarget
    const rect = progressBar.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width

    video.currentTime = pos * video.duration
  }

  // Enhanced effect to handle video metadata loading
  useEffect(() => {
    const videoElement = videoPlayerRef.current
    if (!videoElement) return

    const handleLoadedMetadata = () => {
      const duration = videoElement.duration
      const width = videoElement.videoWidth
      const height = videoElement.videoHeight

      // Save metadata
      if (!unmountedRef.current) {
        setVideoMetadata({
          width,
          height,
          duration,
        })

        // Format duration
        setVideoDuration(formatDuration(duration))
        setIsVideoLoading(false)
      }
    }

    const handleTimeUpdate = () => {
      const currentTime = videoElement.currentTime
      const duration = videoElement.duration
      if (!unmountedRef.current) {
        setVideoCurrentTime(formatDuration(currentTime))

        // Update progress
        if (duration) {
          setVideoProgress((currentTime / duration) * 100)
        }
      }
    }

    const handlePlay = () => {
      if (!unmountedRef.current) {
        setIsVideoPlaying(true)
      }
    }

    const handlePause = () => {
      if (!unmountedRef.current) {
        setIsVideoPlaying(false)
      }
    }

    const handleError = (e: any) => {
      console.error("Video error:", e)
      if (!unmountedRef.current) {
        setVideoError("There was an error loading the video. The format may not be supported.")
        setIsVideoLoading(false)
      }
    }

    videoElement.addEventListener("loadedmetadata", handleLoadedMetadata)
    videoElement.addEventListener("timeupdate", handleTimeUpdate)
    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("pause", handlePause)
    videoElement.addEventListener("error", handleError)

    return () => {
      videoElement.removeEventListener("loadedmetadata", handleLoadedMetadata)
      videoElement.removeEventListener("timeupdate", handleTimeUpdate)
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("pause", handlePause)
      videoElement.removeEventListener("error", handleError)
    }
  }, [videoPreviewUrl])

  // Add this useEffect to handle media type changes
  useEffect(() => {
    // Clear type-specific data when media type changes
    if (mediaType === "Article") {
      // Clear video data when switching to Article
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
      setVideoFile(null)
      setVideoFileName(null)
      setVideoPreviewUrl(null)
      setUploadedVideoUrl(null)
      form.setValue("videoFile", undefined)
      form.setValue("video_url", "")
    } else if (mediaType === "Video" || mediaType === "HPV") {
      // Reset article media when switching to Video or HPV
      setArticleMedia([{ imageUrl: "", description: "", id: `article-media-${Date.now()}` }])
      form.setValue("articleMedia", [{ imageUrl: "", description: "", id: `article-media-${Date.now()}` }])
    }
  }, [mediaType, form])

  // Add this useEffect after the other useEffect hooks
  useEffect(() => {
    // Clear video data when switching away from Video/HPV types
    if (mediaType !== "Video" && mediaType !== "HPV") {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl)
      }
      setVideoFile(null)
      setVideoFileName(null)
      setVideoPreviewUrl(null)
      setUploadedVideoUrl(null)
      form.setValue("videoFile", undefined)
      form.setValue("video_url", "")
    }

    // Update the active tab based on the selected media type
    if (mediaType === "Article") {
      setActiveTab("content")
    } else if (mediaType === "Video" || mediaType === "HPV") {
      setActiveTab("media")
    }
  }, [mediaType, form, videoPreviewUrl])

  if (initialLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {saveSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4 flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <div>
              <p className="text-green-800 font-medium">{id && id !== "new" ? "Media updated" : "Media created"}</p>
              <p className="text-green-700 text-sm">
                {redirecting ? "Redirecting to media list..." : "Processing your request..."}
              </p>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4">
            {/* Type selection */}
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Type:</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={loading || redirecting}>
                    <FormControl>
                      <SelectTrigger className="border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="HPV">HPV</SelectItem>
                      <SelectItem value="Article">Article</SelectItem>
                      <SelectItem value="Video">Video</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Content Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Content title:</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter content title"
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Synopsis (Lobby) */}
            <FormField
              control={form.control}
              name="synopsis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Synopsis (Lobby):</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter synopsis for lobby display"
                      rows={3}
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Body */}
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Body:</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter content body"
                      rows={3}
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* URL References - Only show for Video type */}
            {mediaType === "Video" && (
              <FormField
                control={form.control}
                name="urlReferences"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">URL References:</FormLabel>
                    <FormControl>
                      <EnhancedUrlReferencesField
                        value={field.value || [{ url: "", label: "" }]}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Two columns layout for Categories and Placement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Categories */}
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Categories:</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={loading || redirecting}>
                      <FormControl>
                        <SelectTrigger className="border-gray-300 focus:ring-blue-500 focus:border-blue-500">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Placement */}
              <FormField
                control={form.control}
                name="placement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Placement:</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter placement"
                        {...field}
                        disabled={loading || redirecting}
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="media" className="space-y-4">
            {/* Thumbnail Upload Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-700">Thumbnail</h3>

              {existingThumbnail ? (
                <div className="space-y-4">
                  <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-md border bg-muted">
                    <img
                      src={existingThumbnail || "/placeholder.svg"}
                      alt="Content thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearExistingThumbnail}
                      disabled={loading || redirecting}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Remove Thumbnail
                    </Button>
                  </div>
                </div>
              ) : thumbnailFile ? (
                <div className="space-y-4">
                  <div className="relative aspect-video w-full max-w-md mx-auto overflow-hidden rounded-md border bg-muted">
                    <img
                      src={thumbnailPreviewUrl || ""}
                      alt="Content thumbnail preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex justify-between">
                    <Button type="button" variant="outline" onClick={clearThumbnail} disabled={loading || redirecting}>
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:bg-gray-50 border-gray-300 cursor-pointer"
                  onClick={() => !loading && !redirecting && document.getElementById("thumbnail-upload")?.click()}
                >
                  <input
                    type="file"
                    id="thumbnail-upload"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    className="hidden"
                    disabled={loading || redirecting}
                  />
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <h3 className="text-lg font-medium mb-1">Upload a thumbnail</h3>
                  <p className="text-sm text-gray-500 mb-2">Drag and drop or click to select an image file</p>
                  <p className="text-xs text-gray-400">Supported formats: JPG, PNG, GIF, WEBP | Max size: 2MB</p>
                </div>
              )}
            </div>

            {/* Article Media Section - Only show for Article type */}
            {mediaType === "Article" && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-700">Article Images</h3>
                <FormField
                  control={form.control}
                  name="articleMedia"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <ArticleMediaField
                          value={articleMedia}
                          onChange={handleArticleMediaChange}
                          userId={userData?.uid || "unknown"}
                          disabled={loading || redirecting}
                        />
                      </FormControl>
                      <FormDescription>Add images with descriptions for your article</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* Video Upload Section - Only show for Video or HPV type */}
            {(mediaType === "Video" || mediaType === "HPV") && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-700">Video</h3>

                {uploadedVideoUrl ? (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-blue-50 rounded-md text-blue-500">
                            <FileVideo className="h-6 w-6" />
                          </div>
                          <div>
                            <p className="font-medium">Video uploaded successfully</p>
                            <Badge variant="outline" className="mt-1 text-xs">
                              Ready to use
                            </Badge>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setUploadedVideoUrl(null)
                            form.setValue("video_url", "")
                          }}
                          className="h-8 w-8 p-0 rounded-full"
                          disabled={loading || redirecting}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove video</span>
                        </Button>
                      </div>

                      <div className="aspect-video w-full bg-black rounded-md overflow-hidden">
                        <video
                          src={uploadedVideoUrl}
                          controls
                          className="w-full h-full"
                          poster={existingThumbnail || undefined}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </CardContent>
                  </Card>
                ) : videoFile ? (
                  <div className="space-y-4">
                    {/* Video file info */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start space-x-3">
                        <div className="p-2 bg-blue-50 rounded-md text-blue-500 flex-shrink-0">
                          <FileVideo className="h-6 w-6" />
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-medium text-sm truncate max-w-[250px]">{videoFileName}</p>
                          <p className="text-xs text-gray-500 mt-1">{videoSize}</p>
                          {videoFormat && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {videoFormat.split("/")[1].toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {!isUploading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearVideoFile}
                          className="h-8 w-8 p-0 rounded-full"
                          disabled={loading || redirecting}
                        >
                          <X className="h-4 w-4" />
                          <span className="sr-only">Remove file</span>
                        </Button>
                      )}
                    </div>

                    {/* Video Preview Player */}
                    <Card className="overflow-hidden">
                      <div className="relative w-full bg-black rounded-md overflow-hidden">
                        {isVideoLoading && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-white" />
                          </div>
                        )}

                        {videoError && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-10 p-4">
                            <div className="text-red-400 mb-2">
                              <X className="h-10 w-10 mx-auto" />
                            </div>
                            <p className="text-white text-center text-sm">{videoError}</p>
                          </div>
                        )}

                        <div className="aspect-video w-full">
                          <video
                            ref={videoPlayerRef}
                            className="w-full h-full object-contain"
                            style={{ maxHeight: "100%" }}
                          >
                            <source src={videoPreviewUrl || ""} type={videoFile?.type || "video/mp4"} />
                            Your browser does not support the video tag.
                          </video>
                        </div>

                        <CardContent className="p-2 bg-gray-900">
                          <div className="space-y-2">
                            {/* Video playback progress */}
                            <div
                              className="h-1 bg-gray-700 rounded-full overflow-hidden cursor-pointer"
                              onClick={seekTo}
                            >
                              <div className="h-full bg-blue-500" style={{ width: `${videoProgress}%` }}></div>
                            </div>

                            {/* Video controls */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={toggleVideoPlay}
                                  className="h-8 w-8 text-white hover:bg-gray-800"
                                >
                                  {isVideoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                                </Button>

                                <div className="flex items-center space-x-2">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={toggleMute}
                                    className="h-8 w-8 text-white hover:bg-gray-800"
                                  >
                                    {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                                  </Button>

                                  <div className="w-20">
                                    <Slider
                                      min={0}
                                      max={100}
                                      step={1}
                                      value={[isMuted ? 0 : videoVolume * 100]}
                                      onValueChange={handleVolumeChange}
                                      className="w-full [&>span:first-child]:h-1 [&>span:first-child]:bg-gray-700 [&_[role=slider]]:bg-white [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-blue-500"
                                    />
                                  </div>
                                </div>
                              </div>

                              <div className="text-xs text-white">
                                <span>{videoCurrentTime}</span>
                                <span className="mx-1">/</span>
                                <span>{videoDuration}</span>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </div>
                    </Card>

                    {/* Upload progress */}
                    {isUploading && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span>Uploading...</span>
                          </div>
                          <span className="font-medium">{Math.round(uploadProgress)}%</span>
                        </div>

                        <Progress value={uploadProgress} className="h-2" />
                      </div>
                    )}

                    {/* Upload error */}
                    {uploadError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{uploadError}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center transition-colors hover:bg-gray-50 border-gray-300 cursor-pointer"
                    onClick={() => !loading && !redirecting && document.getElementById("video-upload")?.click()}
                  >
                    <input
                      type="file"
                      id="video-upload"
                      accept="video/*"
                      onChange={handleVideoChange}
                      className="hidden"
                      disabled={loading || redirecting || isUploading}
                    />
                    <FileVideo className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                    <h3 className="text-lg font-medium mb-1">Upload your video</h3>
                    <p className="text-sm text-gray-500 mb-2">Drag and drop or click to select a video file</p>
                    <p className="text-xs text-gray-400">Supported formats: MP4, WebM, MOV | Max size: 100MB</p>
                  </div>
                )}
              </div>
            )}

            {/* Message when media type is not Video, HPV, or Article */}
            {mediaType !== "Video" && mediaType !== "HPV" && mediaType !== "Article" && (
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-center">
                <p className="text-gray-600">Media upload options depend on the selected content type.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Select a content type to see the appropriate media upload options.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {/* Two columns layout for Start/End Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Date */}
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Start Date:</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={loading || redirecting}
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">End Date:</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        disabled={loading || redirecting}
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Two columns layout for Start/End Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Start Time */}
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">Start Time:</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        disabled={loading || redirecting}
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Time */}
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-gray-700">End Time:</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        disabled={loading || redirecting}
                        className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Episode Number */}
            <FormField
              control={form.control}
              name="episode_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Episode Number:</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter episode number"
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Orientation */}
            <FormField
              control={form.control}
              name="orientation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Orientation:</FormLabel>
                  <FormControl>
                    <Slider
                      defaultValue={[field.value]}
                      max={100}
                      step={1}
                      onValueChange={(value) => field.onChange(value[0])}
                      disabled={loading || redirecting}
                    />
                  </FormControl>
                  <FormDescription>Set the orientation percentage</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pin to Lobby */}
            <FormField
              control={form.control}
              name="pin_to_lobby"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-gray-700">Pin to Lobby</FormLabel>
                    <FormDescription>Pin this content to the lobby</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={loading || redirecting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Author */}
            <FormField
              control={form.control}
              name="author"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Author:</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter author name"
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Description:</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter description"
                      rows={3}
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500 min-h-[80px]"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Active */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-gray-700">Active</FormLabel>
                    <FormDescription>Set content as active</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={loading || redirecting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Featured */}
            <FormField
              control={form.control}
              name="featured"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-gray-700">Featured</FormLabel>
                    <FormDescription>Set content as featured</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={loading || redirecting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Position */}
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-gray-700">Position:</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Enter position"
                      {...field}
                      disabled={loading || redirecting}
                      className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Public */}
            <FormField
              control={form.control}
              name="public"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-md border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm font-medium text-gray-700">Public</FormLabel>
                    <FormDescription>Set content as public</FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={loading || redirecting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="ghost" onClick={handleReturn} disabled={loading || redirecting}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading || redirecting}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      </form>
    </Form>
  )
}
