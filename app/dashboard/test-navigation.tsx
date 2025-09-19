"use client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2 } from "lucide-react"

export default function TestNavigationPage() {
  const router = useRouter()

  // Function to test navigation to home
  const testHomeNavigation = () => {
    router.push("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Navigation Test</h1>
        <p className="text-muted-foreground">Verify navigation functionality</p>
      </div>

      <Alert className="border-green-500 bg-green-50">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-700">
          This page is used to test navigation. You can use the buttons below to verify that navigation works correctly.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Test Navigation</CardTitle>
          <CardDescription>Click the buttons to test navigation functionality</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Button onClick={testHomeNavigation} className="w-full">
              Navigate to Home Dashboard
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">
              This button will navigate to the main dashboard view, same as clicking the Home item in the sidebar.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>Navigation verification:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>The Home navigation item should direct you to /dashboard</li>
          <li>The OH! Monitoring item should direct you to /dashboard/monitoring</li>
          <li>The Content Management item should direct you to /dashboard/content</li>
          <li>The sidebar should toggle between full and icon-only modes when clicking the menu button</li>
          <li>In icon-only mode, only icons should be visible in the sidebar</li>
        </ul>
      </div>
    </div>
  )
}
