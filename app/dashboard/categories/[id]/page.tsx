"use client"

import { Suspense, useCallback } from "react"
import { CategoryForm } from "@/components/main-category/category-form"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Home, FolderOpen, Plus, Pencil } from "lucide-react"
import { useRouter } from "next/navigation"

interface CategoryPageProps {
  params: {
    id: string
  }
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const isNew = params.id === "new"
  const router = useRouter()

  // Memoize callback functions to prevent infinite loops
  const handleSuccess = useCallback(() => {
    router.push("/dashboard/categories")
  }, [router])

  const handleCancel = useCallback(() => {
    router.push("/dashboard/categories")
  }, [router])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 pb-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">
                <Home className="h-4 w-4 mr-1" />
                Dashboard
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/categories">
                <FolderOpen className="h-4 w-4 mr-1" />
                Categories
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <div className="flex items-center">
                {isNew ? (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    New Category
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-1" />
                    Edit Category
                  </>
                )}
              </div>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-2xl font-bold tracking-tight mt-2">{isNew ? "Create New Category" : "Edit Category"}</h1>
        <p className="text-muted-foreground text-sm">
          {isNew ? "Create a new category for your content" : "Edit the details of an existing category"}
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div>Loading...</div>}>
          <CategoryForm categoryId={params.id} onSuccess={handleSuccess} onCancel={handleCancel} />
        </Suspense>
      </div>
    </div>
  )
}
