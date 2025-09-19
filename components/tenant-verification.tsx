"use client"

import { useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { verifyTenantConfiguration, tenantConfig } from "@/lib/tenant-service"
import { CheckCircle, AlertCircle } from "lucide-react"

export function TenantVerification() {
  const [isVerified, setIsVerified] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function checkTenant() {
      try {
        const verified = await verifyTenantConfiguration()
        setIsVerified(verified)
      } catch (error) {
        console.error("Error verifying tenant:", error)
        setIsVerified(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkTenant()
  }, [])

  if (isLoading) {
    return (
      <Alert>
        <AlertTitle>Verifying tenant configuration...</AlertTitle>
        <AlertDescription>Checking connection to tenant: {tenantConfig.tenantId}</AlertDescription>
      </Alert>
    )
  }

  if (isVerified) {
    return (
      <Alert className="bg-green-50 border-green-200">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-800">Tenant Verified</AlertTitle>
        <AlertDescription className="text-green-700">
          Successfully connected to tenant: {tenantConfig.tenantId}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Alert className="bg-red-50 border-red-200">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertTitle className="text-red-800">Tenant Verification Failed</AlertTitle>
      <AlertDescription className="text-red-700">
        Could not connect to tenant: {tenantConfig.tenantId}. Please check your configuration.
      </AlertDescription>
    </Alert>
  )
}
