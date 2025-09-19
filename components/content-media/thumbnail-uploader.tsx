"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Upload, X, Loader2, ImageIcon, AlertCircle, CheckCircle } from "lucide-react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { storage } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ThumbnailUploaderProps {
  onComplete: (url: string) => void
  onError: (error: string) => void
  userId: string
  disabled?: boolean
}

export function ThumbnailUploader({ onComplete, onError, userId, disabled }: ThumbnailUploaderProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Clear previous messages
    setError(null)
    setSuccess(null)

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file")
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB")
      return
    }

    setSelectedFile(file)

    // Create preview URL
    const preview = URL.createObjectURL(file)
    setPreviewUrl(preview)

    // Automatically start upload
    await uploadThumbnail(file)
  }

  const uploadThumbnail = async (file: File) => {
    try {
      setIsUploading(true)
      setError(null)
      setSuccess(null)

      // Create unique filename
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 9)
      const fileExtension = file.name.split(".").pop()
      const fileName = `thumbnail_${timestamp}_${randomId}.${fileExtension}`

      // Create storage reference
      const storageRef = ref(storage, `content_media/thumbnails/${userId}/${fileName}`)

      // Upload file
      const snapshot = await uploadBytes(storageRef, file)
      const downloadURL = await getDownloadURL(snapshot.ref)

      // Show success message
      setSuccess("Thumbnail uploaded successfully")

      onComplete(downloadURL)
    } catch (err) {
      console.error("Error uploading thumbnail:", err)
      const errorMessage = err instanceof Error ? err.message : "Failed to upload thumbnail"
      setError(errorMessage)
      onError(errorMessage)
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setError(null)
    setSuccess(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
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

      {previewUrl ? (
        <div className="space-y-4">
          <div className="relative aspect-video w-full max-w-lg mx-auto overflow-hidden rounded-lg border bg-gray-50 shadow-sm">
            <img
              src={previewUrl || "/placeholder.svg"}
              alt="Thumbnail preview"
              className="h-full w-full object-cover"
            />
            {isUploading && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-4 flex items-center space-x-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-sm font-medium">Uploading thumbnail...</span>
                </div>
              </div>
            )}
          </div>

          {selectedFile && (
            <div className="text-center space-y-2">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{selectedFile.name}</span>
              </div>
              <div className="text-xs text-gray-500">
                {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type.split("/")[1].toUpperCase()}
              </div>
            </div>
          )}

          {!isUploading && (
            <div className="flex justify-center space-x-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClick}
                disabled={disabled}
                className="flex items-center space-x-2 bg-transparent"
              >
                <Upload className="h-4 w-4" />
                <span>Change Thumbnail</span>
              </Button>
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
                <ImageIcon className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900">{isUploading ? "Uploading..." : "Upload Thumbnail"}</h3>
              <p className="text-sm text-gray-500">
                {isUploading
                  ? "Please wait while your thumbnail is being uploaded"
                  : "Click to select an image file or drag and drop"}
              </p>
              <p className="text-xs text-gray-400">Supports: JPG, PNG, GIF, WebP (max 10MB)</p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <div className="text-xs text-gray-500 space-y-1">
        <p className="font-medium">Thumbnail requirements:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Supported formats: JPG, JPEG, PNG, WEBP, GIF</li>
          <li>Maximum file size: 10MB</li>
          <li>Recommended aspect ratio: 16:9</li>
          <li>Minimum resolution: 640x360px</li>
        </ul>
      </div>
    </div>
  )
}
