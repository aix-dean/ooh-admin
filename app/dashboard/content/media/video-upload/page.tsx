"use client"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EnhancedMediaForm } from "@/components/content-media/enhanced-media-form"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"

export default function VideoUploadPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Get parameters from URL
  const id = searchParams.get("id")
  const categoryId = searchParams.get("category")
  const categoryName = searchParams.get("categoryName")

  // Handle form success
  const handleSuccess = (mediaId?: string) => {
    // Redirect back to media list with success message
    const params = new URLSearchParams()

    if (mediaId) {
      params.set("success", mediaId)
    }

    if (categoryId) {
      params.set("category", categoryId)
    }

    if (categoryName) {
      params.set("categoryName", categoryName)
    }

    router.push(`/dashboard/content/media?${params.toString()}`)
  }

  // Handle form cancel
  const handleCancel = () => {
    // Redirect back to media list
    const params = new URLSearchParams()

    if (categoryId) {
      params.set("category", categoryId)
    }

    if (categoryName) {
      params.set("categoryName", categoryName)
    }

    router.push(`/dashboard/content/media?${params.toString()}`)
  }

  // Handle back navigation
  const handleBack = () => {
    // Redirect to media list
    router.push("/dashboard/content/media")
  }

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/content/4ps">4Ps Categories</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/content/media">
                {categoryName ? decodeURIComponent(categoryName) : "Media"}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{id && id !== "new" ? "Edit Video" : "Upload Video"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{id && id !== "new" ? "Edit Video" : "Upload New Video"}</h1>
            <p className="text-muted-foreground">
              {id && id !== "new" ? "Edit video details and preview" : "Upload and configure a new video"}
            </p>
          </div>
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Media
          </Button>
        </div>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          {id && id !== "new"
            ? "You can edit video details and preview the video below."
            : "Upload a video file to preview it before saving. You can also generate a thumbnail automatically."}
        </AlertDescription>
      </Alert>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle>{id && id !== "new" ? "Edit Video" : "Upload New Video"}</CardTitle>
          <CardDescription>
            {id && id !== "new"
              ? "Update the details of an existing video"
              : `Upload a new video${categoryName ? ` for ${decodeURIComponent(categoryName)}` : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <EnhancedMediaForm
            id={id || undefined}
            categoryId={categoryId || undefined}
            categoryName={categoryName ? decodeURIComponent(categoryName) : undefined}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
            onBack={handleBack}
          />
        </CardContent>
      </Card>
    </div>
  )
}
