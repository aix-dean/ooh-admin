"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Play, Pause, Volume2, VolumeX, Maximize2, SkipForward, SkipBack, Settings, AlertTriangle } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface AdvancedVideoPlayerProps {
  src: string
  poster?: string
  autoPlay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  metadata?: {
    width?: number
    height?: number
    duration?: string
    fileSize?: string
    fileType?: string
    fileName?: string
  }
}

export function AdvancedVideoPlayer({
  src,
  poster,
  autoPlay = false,
  loop = false,
  muted = false,
  controls = true,
  metadata = {},
}: AdvancedVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(muted)
  const [volume, setVolume] = useState(1)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showControls, setShowControls] = useState(true)
  const [bufferedProgress, setBufferedProgress] = useState(0)

  // Control visibility timer
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Format time to MM:SS or HH:MM:SS
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return "00:00"

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }

    return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
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
    const progressBar = progressRef.current
    if (!video || !progressBar) return

    const rect = progressBar.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width

    video.currentTime = pos * video.duration
  }

  // Toggle fullscreen
  const toggleFullscreen = () => {
    const container = containerRef.current
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Skip forward/backward
  const skip = (seconds: number) => {
    const video = videoRef.current
    if (!video) return

    video.currentTime += seconds
  }

  // Set playback rate
  const setSpeed = (rate: number) => {
    const video = videoRef.current
    if (!video) return

    video.playbackRate = rate
    setPlaybackRate(rate)
  }

  // Handle controls visibility
  const showControlsTemporarily = () => {
    setShowControls(true)

    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current)
    }

    controlsTimerRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false)
      }
    }, 3000)
  }

  // Set up video event listeners
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setDuration(video.duration)
      setLoading(false)
    }

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      const progressValue = (video.currentTime / video.duration) * 100
      setProgress(isNaN(progressValue) ? 0 : progressValue)
    }

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const bufferedEnd = video.buffered.end(video.buffered.length - 1)
        const bufferedProgress = (bufferedEnd / video.duration) * 100
        setBufferedProgress(isNaN(bufferedProgress) ? 0 : bufferedProgress)
      }
    }

    const handlePlay = () => {
      setIsPlaying(true)
      showControlsTemporarily()
    }

    const handlePause = () => {
      setIsPlaying(false)
      setShowControls(true)
    }

    const handleError = (e: any) => {
      console.error("Video error:", e)
      setError("There was an error loading the video. Please try again.")
      setLoading(false)
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    const handleRateChange = () => {
      setPlaybackRate(video.playbackRate)
    }

    // Add event listeners
    video.addEventListener("loadedmetadata", handleLoadedMetadata)
    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("progress", handleProgress)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)
    video.addEventListener("error", handleError)
    video.addEventListener("ratechange", handleRateChange)
    document.addEventListener("fullscreenchange", handleFullscreenChange)

    // Support for autoplay
    if (autoPlay) {
      video.play().catch((e) => {
        console.warn("Autoplay prevented:", e)
      })
    }

    // Clean up event listeners
    return () => {
      video.removeEventListener("loadedmetadata", handleLoadedMetadata)
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("progress", handleProgress)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
      video.removeEventListener("error", handleError)
      video.removeEventListener("ratechange", handleRateChange)
      document.removeEventListener("fullscreenchange", handleFullscreenChange)

      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current)
      }
    }
  }, [autoPlay])

  return (
    <Card className="overflow-hidden">
      <div
        ref={containerRef}
        className="relative w-full bg-black rounded-md overflow-hidden"
        onMouseMove={showControlsTemporarily}
        onMouseLeave={() => isPlaying && setShowControls(false)}
      >
        {/* Video element */}
        <div className="aspect-video w-full">
          <video
            ref={videoRef}
            src={src}
            poster={poster}
            muted={isMuted}
            loop={loop}
            playsInline
            className="w-full h-full object-contain"
          />
        </div>

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-20 p-4">
            <div className="text-red-400 mb-3">
              <AlertTriangle className="h-10 w-10 mx-auto" />
            </div>
            <p className="text-white text-center mb-3">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const video = videoRef.current
                if (video) {
                  setError(null)
                  video.load()
                }
              }}
              className="bg-white hover:bg-gray-100 text-black"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Controls overlay */}
        {controls && showControls && !error && (
          <div
            className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/50 to-transparent transition-opacity duration-300"
            style={{ opacity: showControls ? 1 : 0 }}
          >
            <CardContent className="p-2 text-white">
              {/* Progress bar */}
              <div
                ref={progressRef}
                className="relative h-2 w-full bg-gray-700 rounded-full mb-2 cursor-pointer group"
                onClick={seekTo}
              >
                {/* Buffered progress */}
                <div className="absolute h-full bg-gray-500 rounded-full" style={{ width: `${bufferedProgress}%` }} />

                {/* Playback progress */}
                <div className="absolute h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />

                {/* Hover preview dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-4 w-4 bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
                />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {/* Play/Pause */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={togglePlay}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>

                  {/* Skip backwards */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => skip(-10)}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <SkipBack className="h-5 w-5" />
                  </Button>

                  {/* Skip forwards */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => skip(10)}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>

                  {/* Volume control */}
                  <div className="flex items-center space-x-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={toggleMute}
                      className="h-8 w-8 text-white hover:bg-white/20"
                    >
                      {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </Button>

                    <div className="w-24 hidden sm:block">
                      <Slider
                        min={0}
                        max={100}
                        step={1}
                        value={[isMuted ? 0 : volume * 100]}
                        onValueChange={handleVolumeChange}
                        className="w-full [&>span:first-child]:h-1 [&>span:first-child]:bg-gray-600 [&_[role=slider]]:bg-white [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:border-0 [&>span:first-child_span]:bg-blue-500"
                      />
                    </div>
                  </div>

                  {/* Time display */}
                  <div className="text-xs font-medium">
                    <span>{formatTime(currentTime)}</span>
                    <span className="mx-1">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Playback speed */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20">
                        <Settings className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Playback Speed</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                        <DropdownMenuItem
                          key={rate}
                          onClick={() => setSpeed(rate)}
                          className={playbackRate === rate ? "bg-accent" : ""}
                        >
                          {rate === 1 ? "Normal" : `${rate}x`}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Fullscreen toggle */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleFullscreen}
                    className="h-8 w-8 text-white hover:bg-white/20"
                  >
                    <Maximize2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </div>
        )}
      </div>

      {/* Video metadata display */}
      {metadata && Object.keys(metadata).length > 0 && (
        <CardContent className="p-3 bg-gray-50">
          <div className="flex flex-wrap gap-2">
            {metadata.width && metadata.height && (
              <Badge variant="outline" className="text-xs">
                {metadata.width}×{metadata.height}
              </Badge>
            )}

            {metadata.fileType && (
              <Badge variant="outline" className="text-xs">
                {metadata.fileType}
              </Badge>
            )}

            {metadata.fileSize && (
              <Badge variant="outline" className="text-xs">
                {metadata.fileSize}
              </Badge>
            )}

            {metadata.duration && (
              <Badge variant="outline" className="text-xs">
                {metadata.duration}
              </Badge>
            )}
          </div>

          {metadata.fileName && <p className="text-xs text-gray-500 mt-2 truncate">{metadata.fileName}</p>}
        </CardContent>
      )}
    </Card>
  )
}
