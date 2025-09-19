"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { X, Loader2, Video, AlertCircle, CheckCircle } from "lucide-react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface VideoThumbnailUploaderProps {
  onComplete: (videoUrl: string, thumbnailUrl?: string, metadata?: any) => void
  onError: (error: string) => void
  onThumbnailGenerated?: (url: string) => void
  userId: string
  disabled?: boolean
  currentVideoUrl?: string | null
  currentThumbnailUrl?: string | null
}

export function VideoThumbnailUploader({
  onComplete,
  onError,
  onThumbnailGenerated,
  userId,
  disabled,
  currentVideoUrl,
  currentThumbnailUrl,
}: VideoThumbnailUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(currentVideoUrl)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(currentThumbnailUrl)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [videoMetadata, setVideoMetadata] = useState<any>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    setVideoUrl(currentVideoUrl)
    setThumbnailUrl(currentThumbnailUrl)
  }, [currentVideoUrl, currentThumbnailUrl])

  // Auto-dismiss success message after 3 seconds
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (success) {
      timer = setTimeout(() => {
        setSuccess(null)
      }, 3000)
    }
    return () => {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }, [success])

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Clear previous messages
    setError(null)
    setSuccess(null)

    // Validate file type
    if (!file.type.startsWith("video/")) {
      setError("Please select a video file")
      return
    }

    // Validate file size (max 2GB)
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setError("File size must be less than 2GB")
      return
    }

    setSelectedFile(file)

    // Create preview URL
    const preview = URL.createObjectURL(file)
    setPreviewUrl(preview)

    // Extract video metadata
    await extractVideoMetadata(file, preview)

    // Automatically start upload
    await uploadVideo(file)
  }

  const extractVideoMetadata = async (file: File, videoUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"

      video.onloadedmetadata = () => {
        const metadata = {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          duration: video.duration,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          aspectRatio: video.videoWidth / video.videoHeight,
        }

        setVideoMetadata(metadata)
        resolve()
      }

      video.onerror = () => {
        console.warn("Could not extract video metadata")
        setVideoMetadata({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
        })
        resolve()
      }

      video.src = videoUrl
    })
  }

  const uploadVideo = async (file: File) => {
    try {
      setIsUploading(true)
      setError(null)
      setSuccess(null)
      setUploadProgress(0)

      // Create unique filename
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 9)
      const fileExtension = file.name.split(".").pop()
      const fileName = `video_${timestamp}_${randomId}.${fileExtension}`

      // Create storage reference
      const storageRef = ref(storage, `content_media/videos/${userId}/${fileName}`)

      // Upload file with progress tracking
      const uploadTask = await uploadBytes(storageRef, file)
      setUploadProgress(100)

      const downloadURL = await getDownloadURL(uploadTask.ref)
      setVideoUrl(downloadURL)

      // Show success message
      setSuccess("Video uploaded successfully")

      onComplete(downloadURL, undefined, videoMetadata)
    } catch (err) {
      console.error("Error uploading video:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to upload video"
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setSelectedFile(null)
    setVideoUrl(null)
    setThumbnailUrl(null)
    setVideoMetadata(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setError(null)
    setSuccess(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    onComplete("", undefined, null)
  }

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click()
    }
  }

  const dismissSuccess = () => {
    setSuccess(null)
  }

  const dismissError = () => {
    setError(null)
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive" className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={dismissError} className="h-auto p-1 hover:bg-red-100">
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-sm text-green-800 flex items-center justify-between">
            <span>{success}</span>
            <Button variant="ghost" size="sm" onClick={dismissSuccess} className="h-auto p-1 hover:bg-green-100">
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {videoUrl || previewUrl ? (
        <div className="space-y-4">
          {/* Video preview */}
          <Card>
            <CardContent className="p-4">
              <div className="relative aspect-video w-full max-w-2xl mx-auto overflow-hidden rounded-lg border bg-gray-50 shadow-sm">
                <video
                  ref={videoRef}
                  src={videoUrl || previewUrl || ""}
                  className="h-full w-full object-contain"
                  controls
                  poster={thumbnailUrl || undefined}
                />
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-4 flex flex-col items-center space-y-3">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                      <span className="text-sm font-medium">Uploading video...</span>
                      <Progress value={uploadProgress} className="w-48 h-2" />
                      <span className="text-xs text-gray-500">{uploadProgress}%</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Video metadata */}
              {videoMetadata && (
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-600">File:</span>
                    <p className="truncate">{videoMetadata.fileName}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Size:</span>
                    <p>{formatFileSize(videoMetadata.fileSize)}</p>
                  </div>
                  {videoMetadata.duration && (
                    <div>
                      <span className="font-medium text-gray-600">Duration:</span>
                      <p>{formatDuration(videoMetadata.duration)}</p>
                    </div>
                  )}
                  {videoMetadata.videoWidth && videoMetadata.videoHeight && (
                    <div>
                      <span className="font-medium text-gray-600">Resolution:</span>
                      <p>
                        {videoMetadata.videoWidth} × {videoMetadata.videoHeight}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          {!isUploading && (
            <div className="flex justify-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleRemove}
                disabled={disabled}
                className="flex items-center space-x-2 bg-transparent"
              >
                <X className="h-4 w-4" />
                <span>Remove</span>
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={handleClick}
          className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
            disabled || isUploading
              ? "border-gray-200 bg-gray-50 cursor-not-allowed"
              : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
          }`}
        >
          <div className="space-y-4">
            <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              ) : (
                <Video className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">{isUploading ? "Uploading..." : "Upload Video"}</h3>
              <p className="text-sm text-gray-500">
                {isUploading
                  ? "Please wait while your video is being uploaded"
                  : "Click to select a video file or drag and drop"}
              </p>
              <p className="text-xs text-gray-400">Supports: MP4, WebM, MOV, AVI (max 2GB)</p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div className="text-xs text-gray-500 space-y-1">
        <p className="font-medium">Video requirements:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Supported formats: MP4, WebM, MOV, AVI</li>
          <li>Maximum file size: 2GB</li>
          <li>Recommended resolution: 1280x720 (720p) or higher</li>
          <li>Recommended aspect ratio: 16:9</li>
        </ul>
      </div>
    </div>
  )
}
