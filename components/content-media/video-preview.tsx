"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Loader2, X, Upload, Maximize2 } from "lucide-react"

interface VideoPreviewProps {
  src: string | null
  mimeType?: string
  fileName?: string
  allowFullScreen?: boolean
  onError?: (error: string) => void
}

export function VideoPreview({
  src,
  mimeType = "video/mp4",
  fileName,
  allowFullScreen = true,
  onError,
}: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [videoInfo, setVideoInfo] = useState<{
    width: number
    height: number
    aspectRatio: string
  }>({ width: 0, height: 0, aspectRatio: "16:9" })

  // Format time to MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  // Toggle play/pause
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  // Toggle mute
  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
    setIsMuted(!isMuted)
  }

  // Handle volume change
  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0] / 100
    const video = videoRef.current
    if (!video) return

    video.volume = newVolume
    setVolume(newVolume)
    setIsMuted(newVolume === 0)
  }

  // Handle timeline click
  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current
    if (!video) return

    const progressBar = e.currentTarget
    const rect = progressBar.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width

    video.currentTime = pos * video.duration
  }

  // Toggle fullscreen
  const toggleFullScreen = () => {
    const video = videoRef.current
    if (!video) return

    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      video.requestFullscreen()
    }
  }

  // Set up event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setLoading(false)

      // Get video dimensions
      const width = video.videoWidth
      const height = video.videoHeight
      const ratio = `${width}:${height}`

      setVideoInfo({
        width,
        height,
        aspectRatio: width && height ? ratio : "16:9",
      })
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      setProgress((video.currentTime / video.duration) * 100)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    const handleError = (e: any) => {
      console.error("Video error:", e)
      const errorMsg = "There was an error loading the video. The format may not be supported."
      setError(errorMsg)
      setLoading(false)
      if (onError) onError(errorMsg)
    }

    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)

    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
    }
  }, [src, onError])

  return (
    <Card className="overflow-hidden">
      <div className="relative w-full bg-black rounded-md overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-75 z-10 p-4">
            <div className="text-red-400 mb-2">
              <X className="h-10 w-10 mx-auto" />
            </div>
            <p className="text-white text-center text-sm">{error}</p>
          </div>
        )}

        <div className="aspect-video w-full">
          {src ? (
            <video ref={videoRef} className="w-full h-full object-contain" style={{ maxHeight: "100%" }} playsInline>
              <source src={src} type={mimeType} />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-48 flex flex-col items-center justify-center text-white bg-gray-800">
              <Upload className="h-10 w-10 mb-2 text-gray-400" />
              <p className="text-sm text-gray-400">No video available</p>
            </div>
          )}
        </div>

        {src && (
          <CardContent className="p-2 bg-gray-900">
            <div className="space-y-2">
              {/* Video info badges */}
              {fileName && (
                <div className="flex justify-between items-center">
                  <div className="flex gap-2">
                    {videoInfo.width > 0 && (
                      <Badge variant="outline" className="text-xs text-gray-400 border-gray-700">
                        {videoInfo.width}×{videoInfo.height}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs text-gray-400 border-gray-700">
                      {mimeType.split("/")[1].toUpperCase()}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-400 truncate max-w-[150px]">{fileName}</span>
                </div>
              )}

              {/* Progress bar - clickable for seeking */}
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden cursor-pointer" onClick={seekTo}>
                <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="h-8 w-8 text-white hover:bg-gray-800"
                  >
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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

                    <div className="w-20 hidden sm:block">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[isMuted ? 0 : volume * 100]}
                        onValueChange={handleVolumeChange}
                        className="w-full [&>span:first-child]:h-1 [&>span:first-child]:bg-gray-700 [&_[role=slider]]:bg-white [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <div className="text-xs text-white">
                    <span>{formatTime(currentTime)}</span>
                    <span className="mx-1">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>

                  {allowFullScreen && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={toggleFullScreen}
                      className="h-8 w-8 text-white hover:bg-gray-800"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </div>
    </Card>
  )
}
