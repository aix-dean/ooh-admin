"use client"

import { useState, useEffect } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

interface DebugFeatureStatusProps {
  mediaId: string
}

export function DebugFeatureStatus({ mediaId }: DebugFeatureStatusProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [featured, setFeatured] = useState<boolean | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  useEffect(() => {
    if (!mediaId || !showDebug) return

    setLoading(true)
    setError(null)

    const mediaRef = doc(db, "content_media", mediaId)

    const unsubscribe = onSnapshot(
      mediaRef,
      (doc) => {
        if (doc.exists()) {
          const data = doc.data()
          setFeatured(data.featured || false)
        } else {
          setError("Media item not found")
        }
        setLoading(false)
      },
      (err) => {
        console.error("Error getting media item:", err)
        setError(`Failed to get media item: ${err.message}`)
        setLoading(false)
      },
    )

    return () => unsubscribe()
  }, [mediaId, showDebug])

  if (!showDebug) {
    return (
      <Button variant="outline" size="sm" onClick={() => setShowDebug(true)} className="mt-2">
        Debug Feature Status
      </Button>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex justify-between">
          <span>Feature Status Debug</span>
          <Button variant="ghost" size="sm" onClick={() => setShowDebug(false)} className="h-6 px-2">
            Close
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <span>Loading...</span>
          </div>
        ) : error ? (
          <div className="text-destructive text-sm">{error}</div>
        ) : (
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Media ID:</span> {mediaId}
            </div>
            <div className="text-sm">
              <span className="font-medium">Featured Status in Firestore:</span>{" "}
              <span className={featured ? "text-green-600" : "text-red-600"}>
                {featured ? "Featured" : "Not Featured"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
