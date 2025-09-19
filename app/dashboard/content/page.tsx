"use client"

import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { InfoIcon, ShoppingBag, Newspaper, Database } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ContentPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Content Management</h1>
        <p className="text-muted-foreground">Manage your content and publications</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          Welcome to the Content Management dashboard. From here, you can access all content management sections.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <ShoppingBag className="mr-2 h-5 w-5" />
              4Ps Marketing
            </CardTitle>
            <CardDescription>Manage Product, Price, Place, Promotion content</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create and manage content related to the 4Ps marketing model. Update product information, pricing details,
              distribution channels, and promotional materials.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard/content/4ps">Manage 4Ps Content</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <Newspaper className="mr-2 h-5 w-5" />
              News Ticker
            </CardTitle>
            <CardDescription>Manage scrolling news announcements</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create, edit, and manage news ticker content that appears on your website. Add important announcements,
              promotions, and updates for your users.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard/content/newsticker">Manage News Ticker</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              APV
            </CardTitle>
            <CardDescription>Manage APV content</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Update and manage APV-related content and settings. Configure APV parameters and view related analytics.
            </p>
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full">
              <Link href="/dashboard/content/apv">Manage APV</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
