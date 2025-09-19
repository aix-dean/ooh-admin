"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"

interface WebViewProps {
  url: string
  title?: string
  className?: string
}

export function WebView({ url, title, className = "" }: WebViewProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const handleLoad = () => {
    setIsLoading(false)
    setHasError(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setHasError(true)
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm text-muted-foreground">Loading {title || "content"}...</p>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
          <div className="text-center">
            <p className="text-lg font-semibold text-destructive">Failed to load content</p>
            <p className="text-sm text-muted-foreground mt-2">Unable to load: {url}</p>
            <button
              onClick={() => {
                setHasError(false)
                setIsLoading(true)
                // Force iframe reload
                const iframe = document.querySelector("iframe")
                if (iframe) {
                  iframe.src = iframe.src
                }
              }}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      <iframe
        src={url}
        title={title || "Web Content"}
        className="w-full h-full border-0 overflow-auto"
        onLoad={handleLoad}
        onError={handleError}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
        style={{
          minHeight: "100%",
          overflow: "auto",
        }}
      />
    </div>
  )
}
