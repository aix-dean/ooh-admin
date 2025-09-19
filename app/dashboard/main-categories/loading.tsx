import { Skeleton } from "@/components/ui/skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function Loading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard/content">Content</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Main Categories</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <h1 className="text-3xl font-bold tracking-tight">Main Categories</h1>
        <p className="text-muted-foreground">
          Manage the main categories for your content. These categories are used to organize content throughout the
          application.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>

        <div className="space-y-2">
          <div className="flex space-x-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>

          <div className="border rounded-md">
            <div className="p-4">
              <div className="grid grid-cols-8 gap-4">
                <Skeleton className="h-6 w-full col-span-1" />
                <Skeleton className="h-6 w-full col-span-1" />
                <Skeleton className="h-6 w-full col-span-2" />
                <Skeleton className="h-6 w-full col-span-1" />
                <Skeleton className="h-6 w-full col-span-1" />
                <Skeleton className="h-6 w-full col-span-1" />
                <Skeleton className="h-6 w-full col-span-1" />
              </div>
            </div>

            {[...Array(5)].map((_, i) => (
              <div key={i} className="border-t p-4">
                <div className="grid grid-cols-8 gap-4">
                  <Skeleton className="h-10 w-full col-span-1" />
                  <Skeleton className="h-10 w-full col-span-1" />
                  <Skeleton className="h-10 w-full col-span-2" />
                  <Skeleton className="h-10 w-full col-span-1" />
                  <Skeleton className="h-10 w-full col-span-1" />
                  <Skeleton className="h-10 w-full col-span-1" />
                  <Skeleton className="h-10 w-full col-span-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
