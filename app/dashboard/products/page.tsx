"use client"

import { AutomatedDiscoveryDashboard } from "@/components/database/automated-discovery-dashboard"
import { QuickAccessDashboard } from "@/components/database/quick-access-dashboard"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Activity, Shield, BarChart3 } from "lucide-react"
import { useRouter } from "next/navigation"

export default function DatabaseControlsPage() {
  const router = useRouter()

  const handleCollectionSelect = (collectionName: string) => {
    const encodedPath = encodeURIComponent(collectionName)
    router.push(`/dashboard/products/collections/${encodedPath}`)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Controls</h1>
          <p className="text-muted-foreground">Comprehensive Firestore database management and administration tools</p>
        </div>
        <div className="flex gap-2 hidden">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Database Settings
          </Button>
          <Button>
            <Activity className="h-4 w-4 mr-2" />
            Monitor Activity
          </Button>
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="automated" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="automated">Auto Discovery</TabsTrigger>
          <TabsTrigger value="quick-access">Quick Access</TabsTrigger>
          <TabsTrigger value="security">Security Rules</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="automated">
          <AutomatedDiscoveryDashboard onCollectionSelect={handleCollectionSelect} />
        </TabsContent>

        <TabsContent value="quick-access">
          <QuickAccessDashboard />
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Security Rules Management
              </CardTitle>
              <CardDescription>Configure and test Firestore security rules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Security Rules Interface</h3>
                <p className="text-muted-foreground mb-4">Security rules management interface coming soon</p>
                <Badge variant="outline">Under Development</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Performance Monitoring
              </CardTitle>
              <CardDescription>Monitor database performance and optimization metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <BarChart3 className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Performance Dashboard</h3>
                <p className="text-muted-foreground mb-4">Performance monitoring tools coming soon</p>
                <Badge variant="outline">Under Development</Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
