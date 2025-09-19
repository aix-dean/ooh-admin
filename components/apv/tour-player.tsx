"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface TourPlayerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  videoLink: string | null
  title?: string
}

export function TourPlayer({ open, onOpenChange, videoLink, title = "Tour Player" }: TourPlayerProps) {
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(Date.now())

  // Reset loading state and iframe when dialog opens or videoLink changes
  useEffect(() => {
    if (open) {
      setLoading(true)
      setIframeKey(Date.now()) // Force iframe reload
    }
  }, [open, videoLink])

  // Proper cleanup when dialog closes
  const handleCloseDialog = () => {
    // First, clear the iframe src to stop any running content
    if (iframeRef.current) {
      try {
        // Try to access the iframe's window to stop any running scripts
        const iframeWindow = iframeRef.current.contentWindow
        if (iframeWindow) {
          // Remove event listeners or perform other cleanup if needed
        }
      } catch (e) {
        // Ignore cross-origin errors
        console.log("Cleaning up iframe")
      }
    }

    // Then notify parent about the close
    onOpenChange(false)

    // Reset state after a short delay to ensure animations complete
    setTimeout(() => {
      setLoading(true)
    }, 300)
  }

  // Construct the URL with the videoLink parameter
  const playerUrl = videoLink
    ? `https://apv-player-dot-oh-app-bcf24.as.r.appspot.com?videoLink=${encodeURIComponent(videoLink)}`
    : "https://apv-player-dot-oh-app-bcf24.as.r.appspot.com"

  return (
    <Dialog
      open={open}
      onOpenChange={(newOpen) => {
        if (!newOpen) handleCloseDialog()
        else onOpenChange(true)
      }}
      key={`tour-player-${iframeKey}`}
    >
      <DialogContent
        className="sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw] max-h-[90vh] p-0 gap-0"
        onInteractOutside={(e) => {
          // Prevent interaction with the background when dialog is open
          if (open) e.preventDefault()
        }}
        onEscapeKeyDown={handleCloseDialog}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <DialogTitle>{title}</DialogTitle>
          <Button variant="ghost" size="icon" onClick={handleCloseDialog} className="h-8 w-8 rounded-full">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <div className="relative w-full" style={{ height: "calc(90vh - 60px)" }}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
          {open && ( // Only render iframe when dialog is open
            <iframe
              ref={iframeRef}
              key={iframeKey}
              src={playerUrl}
              className="w-full h-full"
              onLoad={() => setLoading(false)}
              style={{ border: "none" }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
