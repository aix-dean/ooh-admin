import { Suspense } from "react"
import { CategoryList } from "@/components/main-category/category-list"

export default function CategoriesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mt-2">Categories Management</h1>
        <p className="text-muted-foreground">Create, organize, and manage content categories for your application.</p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <CategoryList />
      </Suspense>
    </div>
  )
}
