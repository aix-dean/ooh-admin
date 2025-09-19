"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getTenantMetadata, updateTenantMetadata } from "@/lib/tenant-service"
import { useToast } from "@/hooks/use-toast"
import { Loader2 } from "lucide-react"

export function TenantAdminPanel() {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleServiceSync = async () => {
    setIsLoading(true)
    try {
      const metadata = await getTenantMetadata()

      // Update service status
      await updateTenantMetadata({
        status: {
          auth: true,
          firestore: true,
          storage: true,
          functions: true,
        },
        lastSyncedAt: new Date(),
      })

      toast({
        title: "Services synchronized",
        description: "All tenant services have been synchronized successfully.",
      })
    } catch (error) {
      console.error("Error syncing services:", error)
      toast({
        title: "Synchronization failed",
        description: "Failed to synchronize tenant services. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Tabs defaultValue="services" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="services">Services</TabsTrigger>
        <TabsTrigger value="access">Access Control</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="services">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Services</CardTitle>
            <CardDescription>Manage and monitor GCP services associated with this tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <ServiceStatusCard
                name="Authentication"
                status="Active"
                description="Firebase Authentication with tenant isolation"
              />
              <ServiceStatusCard name="Firestore" status="Active" description="Tenant-scoped Firestore collections" />
              <ServiceStatusCard name="Storage" status="Active" description="Tenant-specific Cloud Storage buckets" />
              <ServiceStatusCard
                name="Cloud Functions"
                status="Active"
                description="Tenant-aware serverless functions"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleServiceSync} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Synchronize Services
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>

      <TabsContent value="access">
        <Card>
          <CardHeader>
            <CardTitle>Access Control</CardTitle>
            <CardDescription>Manage tenant access controls and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configure who can access this tenant and what actions they can perform. Access controls are managed
              through IAM policies and Firebase Authentication.
            </p>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="settings">
        <Card>
          <CardHeader>
            <CardTitle>Tenant Settings</CardTitle>
            <CardDescription>Configure tenant-specific settings and properties</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Manage tenant configuration settings including display name, environment, region, and other
              tenant-specific properties.
            </p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}

interface ServiceStatusCardProps {
  name: string
  status: "Active" | "Inactive" | "Error"
  description: string
}

function ServiceStatusCard({ name, status, description }: ServiceStatusCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex justify-between items-start">
        <h3 className="font-medium">{name}</h3>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === "Active"
              ? "bg-green-100 text-green-800"
              : status === "Inactive"
                ? "bg-gray-100 text-gray-800"
                : "bg-red-100 text-red-800"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="text-sm text-muted-foreground mt-2">{description}</p>
    </div>
  )
}
