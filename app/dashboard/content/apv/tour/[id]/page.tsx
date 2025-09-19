"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { WebView } from "@/components/webview/webview"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function TourPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [tourData, setTourData] = useState<any>(null)
  const [collection, setCollection] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchTourData()
    }
  }, [id])

  const fetchTourData = async () => {
    try {
      setLoading(true)

      // Try to fetch from APV collection first
      const apvRef = doc(db, "apv", id)
      let docSnap = await getDoc(apvRef)

      if (docSnap.exists()) {
        setTourData({
          id: docSnap.id,
          ...docSnap.data(),
        })
        setCollection("apv")
        setLoading(false)
        return
      }

      // If not found in APV, try Green View
      const greenViewRef = doc(db, "green_view", id)
      docSnap = await getDoc(greenViewRef)

      if (docSnap.exists()) {
        setTourData({
          id: docSnap.id,
          ...docSnap.data(),
        })
        setCollection("green_view")
        setLoading(false)
        return
      }

      // If not found in either collection
      toast({
        title: "Error",
        description: "Tour not found",
        variant: "destructive",
      })
      router.push("/dashboard/content/apv")
    } catch (error) {
      console.error("Error fetching tour data:", error)
      toast({
        title: "Error",
        description: "Failed to load tour data",
        variant: "destructive",
      })
      router.push("/dashboard/content/apv")
    }
  }

  const handleBackClick = () => {
    router.back()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!tourData || !tourData.dh) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={handleBackClick}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <div className="flex items-center justify-center h-[50vh] flex-col gap-4">
          <h1 className="text-2xl font-bold">Tour Not Available</h1>
          <p className="text-muted-foreground">This tour does not have a video link available.</p>
          <Button onClick={handleBackClick}>Return to List</Button>
        </div>
      </div>
    )
  }

  // Construct the URL with the videoLink parameter
  const playerUrl = `https://apv-player-dot-oh-app-bcf24.as.r.appspot.com?videoLink=${encodeURIComponent(tourData.dh)}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/dashboard/content/apv">APV Categories</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              {tourData.category_id && (
                <>
                  <BreadcrumbItem>
                    <BreadcrumbLink href={`/dashboard/content/apv/${tourData.category_id}`}>Category</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </>
              )}
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Tour</BreadcrumbLink>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <Button variant="outline" onClick={handleBackClick}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        <h1 className="text-3xl font-bold">
          {tourData.road} {tourData.version ? `- ${tourData.version}` : ""}
        </h1>
        <p className="text-muted-foreground">
          {collection === "apv" ? "APV Tour" : "Green View Tour"} • Position: {tourData.position} • Status:{" "}
          {tourData.active ? "Active" : "Inactive"}
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">Tour Viewer</h2>
        </div>
        <div className="p-0">
          <WebView url={playerUrl} height="calc(100vh - 250px)" className="rounded-none border-0" />
        </div>
      </div>
    </div>
  )
}
