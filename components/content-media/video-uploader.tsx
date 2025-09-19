"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X, Upload, FileVideo, AlertCircle, CheckCircle } from "lucide-react"
import { storage } from "@/lib/firebase"
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage"
import { useToast } from "@/hooks/use-toast"

interface VideoUploaderProps {
  onUploadComplete: (url: string) => void
  onUploadError: (error: string) => void
  onFileSelected: (file: File) => void
  disabled?: boolean
  maxSize?: number // in bytes
  userId?: string
}

export function VideoUploader({
  onUploadComplete,
  onUploadError,
  onFileSelected,
  disabled = false,
  maxSize = 2 * 1024 * 1024 * 1024, // Updated from 100MB to 2GB default
  userId = "anonymous",
}: VideoUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    // Reset states
    setUploadError(null)
    setUploadSuccess(false)

    // Validate file type
    if (!selectedFile.type.startsWith("video/")) {
      setUploadError("Invalid file type. Please upload a video file (MP4, WebM, etc.)")
      toast({
        title: "Invalid file type",
        description: "Please upload a video file (MP4, WebM, etc.)",
        variant: "destructive",
      })
      return
    }

    // Validate file size
    if (selectedFile.size > maxSize) {
      setUploadError(
        `File too large (${formatFileSize(selectedFile.size)}). Maximum size is ${formatFileSize(maxSize)}.`,
      )
      toast({
        title: "File too large",
        description: `Maximum file size is ${formatFileSize(maxSize)}`, // Updated to use dynamic maxSize
        variant: "destructive",
      })
      return
    }

    // Set file info
    setFile(selectedFile)
    setFileName(selectedFile.name)
    setFileSize(formatFileSize(selectedFile.size))

    // Notify parent component
    onFileSelected(selectedFile)
  }

  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click()
    }
  }

  // Clear selected file
  const clearFile = () => {
    if (isUploading) return

    setFile(null)
    setFileName(null)
    setFileSize(null)
    setUploadError(null)
    setUploadSuccess(false)
    setUploadProgress(0)

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Start upload process
  const startUpload = async () => {
    if (!file || isUploading) return

    try {
      setIsUploading(true)
      setUploadProgress(0)
      setUploadError(null)

      // Create unique file path
      const timestamp = Date.now()
      const fileExtension = file.name.split(".").pop()
      const uniqueFileName = `${timestamp}_${file.name}`
      const storagePath = `videos/${userId}/${uniqueFileName}`

      // Create storage reference
      const storageRef = ref(storage, storagePath)

      // Create upload task with metadata
      const metadata = {
        contentType: file.type,
      }

      const uploadTask = uploadBytesResumable(storageRef, file, metadata)

      // Listen for state changes
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          // Calculate and update progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          setUploadProgress(progress)

          // Log state changes
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
          setUploadError("Failed to upload video. Please try again.")
          setIsUploading(false)

          // Notify parent component
          onUploadError("Failed to upload video. Please try again.")

          // Show error toast
          toast({
            title: "Upload failed",
            description: "There was an error uploading your video. Please try again.",
            variant: "destructive",
          })
        },
        async () => {
          // Handle successful upload
          try {
            // Get download URL
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

            // Update states
            setUploadSuccess(true)
            setIsUploading(false)

            // Notify parent component
            onUploadComplete(downloadURL)

            // Show success toast
            toast({
              title: "Upload complete",
              description: "Your video has been successfully uploaded.",
            })
          } catch (error) {
            console.error("Error getting download URL:", error)
            setUploadError("Upload completed, but couldn't retrieve the video URL.")
            setIsUploading(false)

            // Notify parent component
            onUploadError("Upload completed, but couldn't retrieve the video URL.")
          }
        },
      )
    } catch (error) {
      console.error("Upload setup error:", error)
      setUploadError("Failed to start upload. Please try again.")
      setIsUploading(false)

      // Notify parent component
      onUploadError("Failed to start upload. Please try again.")
    }
  }

  // Retry upload if there was an error
  const retryUpload = () => {
    setUploadError(null)
    startUpload()
  }

  return (
    <div className="space-y-4">
      {/* File input (hidden) */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="video/*"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />

      {/* File upload interface */}
      {!file ? (
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors cursor-pointer"
          onClick={triggerFileInput}
        >
          <Upload className="h-10 w-10 mx-auto mb-3 text-gray-400" />
          <p className="text-sm font-medium mb-1">Click to upload video</p>
          <p className="text-xs text-gray-500">MP4, WebM, MOV up to {formatFileSize(maxSize)}</p>
        </div>
      ) : (
        <div className="border rounded-lg p-4 bg-gray-50">
          {/* File info */}
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-blue-50 rounded-md text-blue-500">
                <FileVideo className="h-6 w-6" />
              </div>
              <div>
                <p className="font-medium text-sm truncate max-w-[200px]">{fileName}</p>
                <p className="text-xs text-gray-500">{fileSize}</p>
              </div>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFile}
                className="h-7 w-7 p-0 rounded-full"
                disabled={disabled}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Remove file</span>
              </Button>
            )}
          </div>

          {/* Upload progress */}
          {isUploading && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Uploading...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-1" />
            </div>
          )}

          {/* Upload success/error states */}
          {uploadSuccess && (
            <div className="mt-3 flex items-center gap-1.5 text-green-600 text-xs">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>Upload complete</span>
            </div>
          )}

          {uploadError && (
            <Alert variant="destructive" className="mt-3">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">{uploadError}</AlertDescription>
            </Alert>
          )}

          {/* Action buttons */}
          {!isUploading && !uploadSuccess && (
            <div className="mt-3 flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={clearFile} disabled={disabled}>
                Cancel
              </Button>
              <Button size="sm" onClick={startUpload} disabled={disabled || !!uploadError}>
                Upload video
              </Button>
            </div>
          )}

          {uploadError && !isUploading && (
            <div className="mt-3 flex justify-end space-x-2">
              <Button size="sm" onClick={retryUpload} disabled={disabled}>
                Retry upload
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Requirements note */}
      <div className="rounded-md bg-gray-50 p-3 border border-gray-200">
        <p className="text-sm font-medium mb-1">Video requirements:</p>
        <ul className="text-xs text-gray-600 space-y-1">
          <li>• Supported formats: MP4, WebM, MOV</li>
          <li>• Maximum file size: {formatFileSize(maxSize)}</li> {/* Updated to use dynamic maxSize */}
          <li>• Recommended resolution: 1280×720 (720p) or higher</li>
          <li>• Aspect ratio: 16:9 (widescreen)</li>
        </ul>
      </div>
    </div>
  )
}
