"use client"

import React, { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { VideoUploader } from "./video-uploader"
import { VideoPreview } from "./video-preview"
import { FormField, FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form"

// This component shows how to integrate the video uploader in the media form
export function MediaVideoSection({ form, disabled = false }) {
  const { toast } = useToast()
  const { userData } = useAuth()
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(form.getValues("video_url") || null)
  const [videoMimeType, setVideoMimeType] = useState<string>("video/mp4")
  const [videoFileName, setVideoFileName] = useState<string | null>(null)

  // Handle file selection
  const handleFileSelected = (file: File) => {
    setSelectedVideoFile(file)
    setVideoMimeType(file.type)
    setVideoFileName(file.name)

    // Create local preview URL
    if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    const previewUrl = URL.createObjectURL(file)
    setVideoPreviewUrl(previewUrl)
  }

  // Handle upload complete
  const handleUploadComplete = (url: string) => {
    setVideoUrl(url)
    form.setValue("video_url", url, { shouldValidate: true })

    toast({
      title: "Video uploaded successfully",
      description: "The video has been uploaded and is ready to use.",
    })
  }

  // Handle upload error
  const handleUploadError = (error: string) => {
    toast({
      title: "Upload failed",
      description: error,
      variant: "destructive",
    })
  }

  // Handle video error
  const handleVideoError = (error: string) => {
    toast({
      title: "Video preview error",
      description: error,
      variant: "destructive",
    })
  }

  // Clean up preview URL when component unmounts
  React.useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  return (
    <div className="space-y-6">
      <FormField
        control={form.control}
        name="video_url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Upload Video</FormLabel>
            <FormControl>
              <VideoUploader
                onUploadComplete={handleUploadComplete}
                onUploadError={handleUploadError}
                onFileSelected={handleFileSelected}
                disabled={disabled}
                userId={userData?.uid}
              />
            </FormControl>
            <FormDescription>
              Upload a video for this content. The video will be processed and optimized for playback.
            </FormDescription>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="video_preview"
        render={() => (
          <FormItem>
            <FormLabel>Video Preview</FormLabel>
            <FormControl>
              <VideoPreview
                src={videoPreviewUrl || videoUrl}
                mimeType={videoMimeType}
                fileName={videoFileName}
                onError={handleVideoError}
              />
            </FormControl>
            <FormDescription>
              Preview your video before publishing. This is how it will appear to users.
            </FormDescription>
          </FormItem>
        )}
      />
    </div>
  )
}
