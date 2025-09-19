"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Upload, Video, AlertTriangle, Loader2, X, ImageIcon, RefreshCw, PauseCircle, PlayCircle } from "lucide-react"
import { storage } from "@/lib/firebase"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"

interface EnhancedVideoUploaderProps {
  onStatusChange: (status: "idle" | "uploading" | "processing" | "success" | "error") => void
  onProgress: (progress: number) => void
  onComplete: (url: string, metadata: any) => void
  onError: (error: string) => void
  onThumbnailGenerated?: (url: string) => void
  userId: string
  currentVideoUrl?: string | null
  contentMedia?: { media?: Array<{ url: string; description?: string; id?: string }> }
  disabled?: boolean
  maxSize?: number // in MB
  supportedFormats?: string[]
}

export function EnhancedVideoUploader({
  onStatusChange,
  onProgress,
  onComplete,
  onError,
  onThumbnailGenerated,
  userId,
  currentVideoUrl = null,
  contentMedia,
  disabled = false,
  maxSize = 2048, // Updated from 100MB to 2048MB (2GB) default
  supportedFormats = ["mp4", "webm", "mov", "avi"],
}: EnhancedVideoUploaderProps) {
  // File selection and reference
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<string | null>(null)
  const [fileType, setFileType] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Upload status
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [uploadTask, setUploadTask] = useState<any>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(() => {
    // First check if there's a direct currentVideoUrl provided
    if (currentVideoUrl) return currentVideoUrl

    // Then check if there's a video URL in the contentMedia.media array
    if (contentMedia?.media && contentMedia.media.length > 0) {
      // Look for video URLs with common video extensions
      const videoFromMedia = contentMedia.media.find(
        (item) =>
          item.url &&
          typeof item.url === "string" &&
          (item.url.toLowerCase().endsWith(".mp4") ||
            item.url.toLowerCase().endsWith(".webm") ||
            item.url.toLowerCase().endsWith(".mov") ||
            item.url.toLowerCase().endsWith(".avi") ||
            item.url.includes("video") ||
            (item.url.includes("firebase") &&
              !item.url.toLowerCase().endsWith(".jpg") &&
              !item.url.toLowerCase().endsWith(".png") &&
              !item.url.toLowerCase().endsWith(".gif"))),
      )
      return videoFromMedia?.url || null
    }

    return null
  })

  // Video processing
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingProgress, setProcessingProgress] = useState(0)
  const [videoMetadata, setVideoMetadata] = useState<any>({})
  const [generateThumbnail, setGenerateThumbnail] = useState(true)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  // Validation and feedback
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const maxFileSizeBytes = maxSize * 1024 * 1024

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Get file extension
  const getFileExtension = (filename: string): string => {
    return filename.split(".").pop()?.toLowerCase() || ""
  }

  // Validate file
  const validateFile = (file: File): string[] => {
    const errors: string[] = []

    // Check file size
    if (file.size > maxFileSizeBytes) {
      errors.push(`File is too large. Maximum size is ${maxSize}MB.`)
    }

    // Check file type
    const extension = getFileExtension(file.name)
    if (!supportedFormats.includes(extension)) {
      errors.push(`File type '${extension}' is not supported. Supported formats: ${supportedFormats.join(", ")}.`)
    }

    return errors
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Reset states
    setFile(null)
    setFileName(null)
    setFileSize(null)
    setFileType(null)
    setUploadProgress(0)
    setUploadError(null)
    setValidationErrors([])

    // Validate file
    const errors = validateFile(selectedFile)
    if (errors.length > 0) {
      setValidationErrors(errors)
      onError(errors.join(" "))
      onStatusChange("error")
      return
    }

    // Set file info
    setFile(selectedFile)
    setFileName(selectedFile.name)
    setFileSize(formatFileSize(selectedFile.size))
    setFileType(selectedFile.type)

    // Reset status
    onStatusChange("idle")
  }

  // Handle file drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    if (disabled || isUploading) return

    const droppedFile = e.dataTransfer.files?.[0]
    if (!droppedFile) return

    // Reset states
    setFile(null)
    setFileName(null)
    setFileSize(null)
    setFileType(null)
    setUploadProgress(0)
    setUploadError(null)
    setValidationErrors([])

    // Validate file
    const errors = validateFile(droppedFile)
    if (errors.length > 0) {
      setValidationErrors(errors)
      onError(errors.join(" "))
      onStatusChange("error")
      return
    }

    // Set file info
    setFile(droppedFile)
    setFileName(droppedFile.name)
    setFileSize(formatFileSize(droppedFile.size))
    setFileType(droppedFile.type)

    // Reset status
    onStatusChange("idle")
  }

  // Prevent default behavior for drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // Clear file selection
  const clearFile = () => {
    if (isUploading) return

    setFile(null)
    setFileName(null)
    setFileSize(null)
    setFileType(null)
    setUploadProgress(0)
    setUploadError(null)
    setValidationErrors([])

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }

    onStatusChange("idle")
  }

  // Start upload process
  const startUpload = async () => {
    if (!file || isUploading) return

    try {
      setIsUploading(true)
      setUploadProgress(0)
      setUploadError(null)
      setVideoUrl(null)
      onStatusChange("uploading")

      // Create unique file path
      const timestamp = Date.now()
      const extension = getFileExtension(file.name)
      const safeFileName = file.name
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase()
        .substring(0, 50)

      const fileName = `${timestamp}_${safeFileName}.${extension}`
      const storagePath = `videos/${userId}/${fileName}`

      // Create storage reference
      const storageRef = ref(storage, storagePath)

      // Create upload task with metadata
      const metadata = {
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          uploadedBy: userId,
          uploadTime: new Date().toISOString(),
        },
      }

      const task = uploadBytesResumable(storageRef, file, metadata)
      setUploadTask(task)

      // Listen for state changes
      task.on(
        "state_changed",
        (snapshot) => {
          // Track progress
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          setUploadProgress(progress)
          onProgress(progress)

          // Log state changes
          switch (snapshot.state) {
            case "paused":
              console.log("Upload paused")
              setIsPaused(true)
              break
            case "running":
              console.log("Upload running")
              setIsPaused(false)
              break
          }
        },
        (error) => {
          // Handle upload errors
          console.error("Upload error:", error)
          setUploadError("Failed to upload video. Please try again.")
          setIsUploading(false)
          onError("Failed to upload video. Please try again.")
          onStatusChange("error")
        },
        async () => {
          // Handle successful upload completion
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(task.snapshot.ref)
            setVideoUrl(downloadURL)

            // Start processing video
            setIsProcessing(true)
            onStatusChange("processing")

            // Simulate video processing
            // In a real implementation, you would call a server API to process the video
            await simulateVideoProcessing()

            // Generate thumbnail if needed
            let thumbnailURL = null
            if (generateThumbnail) {
              thumbnailURL = await generateVideoThumbnail(downloadURL)
              setThumbnailUrl(thumbnailURL)
              if (onThumbnailGenerated && thumbnailURL) {
                onThumbnailGenerated(thumbnailURL)
              }
            }

            // Create metadata object
            const videoMetadata = {
              fileName: file.name,
              fileSize: file.size,
              fileType: file.type,
              duration: "00:00:00", // This would be determined during processing
              resolution: "1280x720", // This would be determined during processing
              thumbnailUrl: thumbnailURL,
              uploadTime: new Date().toISOString(),
            }

            setVideoMetadata(videoMetadata)
            setIsUploading(false)
            setIsProcessing(false)
            onStatusChange("success")
            onComplete(downloadURL, videoMetadata)
          } catch (error) {
            console.error("Error finalizing video:", error)
            setUploadError("Upload completed, but processing failed. Please try again.")
            setIsUploading(false)
            setIsProcessing(false)
            onError("Upload completed, but processing failed. Please try again.")
            onStatusChange("error")
          }
        },
      )
    } catch (error) {
      console.error("Upload setup error:", error)
      setUploadError("Failed to start upload. Please try again.")
      setIsUploading(false)
      onError("Failed to start upload. Please try again.")
      onStatusChange("error")
    }
  }

  // Pause or resume upload
  const togglePauseUpload = () => {
    if (!uploadTask) return

    if (isPaused) {
      uploadTask.resume()
      setIsPaused(false)
    } else {
      uploadTask.pause()
      setIsPaused(true)
    }
  }

  // Cancel upload
  const cancelUpload = () => {
    if (!uploadTask) return

    uploadTask.cancel()
    setIsUploading(false)
    setUploadProgress(0)
    setIsPaused(false)
    onStatusChange("idle")
  }

  // Retry upload
  const retryUpload = () => {
    setUploadError(null)
    setValidationErrors([])
    startUpload()
  }

  // Simulate video processing with progress updates
  const simulateVideoProcessing = async () => {
    return new Promise<void>((resolve) => {
      let progress = 0
      const interval = setInterval(() => {
        progress += 5
        setProcessingProgress(progress)

        if (progress >= 100) {
          clearInterval(interval)
          resolve()
        }
      }, 200)
    })
  }

  // Generate a thumbnail from the video
  // In a real implementation, this would be handled by a server-side process
  const generateVideoThumbnail = async (videoUrl: string): Promise<string | null> => {
    // In a real application, you would call an API to generate the thumbnail
    // For this example, we'll simulate the process
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Return a placeholder thumbnail for now
    // In a real application, this would be generated from the video
    return `https://placeholder.svg?height=360&width=640&text=Thumbnail`
  }

  useEffect(() => {
    // Clean up on unmount
    return () => {
      if (uploadTask) {
        uploadTask.cancel()
      }
    }
  }, [uploadTask])

  useEffect(() => {
    // Set initial video URL from props or contentMedia
    if (currentVideoUrl) {
      setVideoUrl(currentVideoUrl)
      onStatusChange("success")
    } else if (contentMedia?.media && contentMedia.media.length > 0) {
      // Look for video URLs with common video extensions
      const videoFromMedia = contentMedia.media.find(
        (item) =>
          item.url &&
          typeof item.url === "string" &&
          (item.url.toLowerCase().endsWith(".mp4") ||
            item.url.toLowerCase().endsWith(".webm") ||
            item.url.toLowerCase().endsWith(".mov") ||
            item.url.toLowerCase().endsWith(".avi") ||
            item.url.includes("video") ||
            (item.url.includes("firebase") &&
              !item.url.toLowerCase().endsWith(".jpg") &&
              !item.url.toLowerCase().endsWith(".png") &&
              !item.url.toLowerCase().endsWith(".gif"))),
      )

      if (videoFromMedia?.url) {
        setVideoUrl(videoFromMedia.url)
        onStatusChange("success")
      }
    }
  }, [currentVideoUrl, contentMedia, onStatusChange])

  return (
    <div className="space-y-4">
      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Video already exists */}
      {videoUrl && !isUploading && !file && (
        <Alert className="bg-blue-50 border-blue-200">
          <Video className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-blue-700 flex justify-between items-center">
            <div>A video has already been uploaded. You can keep it or upload a new one.</div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setVideoUrl(null)
                onStatusChange("idle")
              }}
              className="ml-2"
              disabled={disabled}
            >
              Replace Video
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Drag and drop area or file info */}
      {!videoUrl && !isUploading && !file ? (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${disabled ? "bg-gray-100 border-gray-300 cursor-not-allowed" : "hover:bg-gray-50 border-gray-300 cursor-pointer"}`}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={!disabled ? handleDrop : undefined}
        >
          <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
          <h3 className="text-lg font-medium mb-1">Upload your video</h3>
          <p className="text-sm text-gray-500 mb-2">Drag and drop or click to select a video file</p>
          <p className="text-xs text-gray-400">
            Supported formats: {supportedFormats.join(", ")} | Max size: {maxSize}MB
          </p>

          {validationErrors.length > 0 && (
            <div className="mt-4 text-left">
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc pl-4 space-y-1 text-xs">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      ) : (
        !videoUrl && (
          <Card>
            <CardContent className="p-4">
              {/* File info */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start space-x-3">
                  <div className="p-2 bg-blue-50 rounded-md text-blue-500 flex-shrink-0">
                    <Video className="h-6 w-6" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="font-medium text-sm truncate max-w-[250px]">{fileName}</p>
                    <p className="text-xs text-gray-500 mt-1">{fileSize}</p>
                    {fileType && (
                      <Badge variant="outline" className="mt-1 text-xs">
                        {fileType.split("/")[1].toUpperCase()}
                      </Badge>
                    )}
                  </div>
                </div>

                {!isUploading && !isProcessing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    className="h-8 w-8 p-0 rounded-full"
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Remove file</span>
                  </Button>
                )}
              </div>

              {/* Upload controls */}
              {!isUploading && !isProcessing && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="generate-thumbnail"
                      checked={generateThumbnail}
                      onCheckedChange={setGenerateThumbnail}
                      disabled={disabled}
                    />
                    <Label htmlFor="generate-thumbnail">Auto-generate thumbnail</Label>
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm" onClick={clearFile} disabled={disabled}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={startUpload} disabled={disabled || !!uploadError}>
                      Upload Video
                    </Button>
                  </div>
                </div>
              )}

              {/* Upload progress */}
              {isUploading && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      <span>{isPaused ? "Upload paused" : "Uploading..."}</span>
                    </div>
                    <span className="font-medium">{Math.round(uploadProgress)}%</span>
                  </div>

                  <Progress value={uploadProgress} className="h-2" />

                  <div className="flex justify-end space-x-2">
                    <Button variant="outline" size="sm" onClick={cancelUpload} disabled={disabled}>
                      Cancel
                    </Button>
                    <Button variant="outline" size="sm" onClick={togglePauseUpload} disabled={disabled}>
                      {isPaused ? (
                        <>
                          <PlayCircle className="h-4 w-4 mr-1" />
                          Resume
                        </>
                      ) : (
                        <>
                          <PauseCircle className="h-4 w-4 mr-1" />
                          Pause
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Processing status */}
              {isProcessing && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      <span>Processing video...</span>
                    </div>
                    <span className="font-medium">{Math.round(processingProgress)}%</span>
                  </div>

                  <Progress value={processingProgress} className="h-2" />

                  <div className="text-xs text-gray-500">
                    This may take a few moments. We're optimizing your video for playback.
                  </div>
                </div>
              )}

              {/* Error state */}
              {uploadError && (
                <div className="mt-3">
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{uploadError}</AlertDescription>
                  </Alert>

                  <div className="flex justify-end mt-3">
                    <Button size="sm" onClick={retryUpload} disabled={disabled}>
                      Retry Upload
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )
      )}

      {/* Generated thumbnail preview (if available) */}
      {thumbnailUrl && !isUploading && !isProcessing && (
        <div className="mt-4">
          <h4 className="text-sm font-medium mb-2">Generated Thumbnail:</h4>
          <div className="relative w-full aspect-video rounded overflow-hidden border bg-gray-100">
            <img
              src={thumbnailUrl || "/placeholder.svg"}
              alt="Video thumbnail"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex justify-end mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                // In a real app, this would open a thumbnail editor
                // For now, just simulate regenerating
                generateVideoThumbnail(videoUrl || "").then((url) => {
                  if (url) {
                    setThumbnailUrl(url)
                    if (onThumbnailGenerated) {
                      onThumbnailGenerated(url)
                    }
                  }
                })
              }}
              disabled={disabled}
            >
              <ImageIcon className="h-4 w-4 mr-1" />
              Regenerate Thumbnail
            </Button>
          </div>
        </div>
      )}

      {/* Video requirements */}
      <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
        <p className="text-sm font-medium mb-1">Video requirements:</p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Supported formats: {supportedFormats.join(", ").toUpperCase()}</li>
          <li>• Maximum file size: {maxSize} MB</li>
          <li>• Recommended resolution: 1280×720 (720p) or higher</li>
          <li>• Aspect ratio: 16:9 (widescreen)</li>
        </ul>
      </div>
    </div>
  )
}
