import { TenantVerification } from "@/components/tenant-verification"
import { tenantConfig } from "@/lib/tenant-service"

export default function TenantAdminPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Tenant Administration</h1>

      <div className="mb-6">
        <TenantVerification />
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">Tenant Configuration</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Tenant ID</p>
            <p className="text-base">{tenantConfig.tenantId}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Display Name</p>
            <p className="text-base">{tenantConfig.displayName}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Environment</p>
            <p className="text-base">{tenantConfig.environment}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Region</p>
            <p className="text-base">{tenantConfig.region}</p>
          </div>

          <div className="md:col-span-2">
            <p className="text-sm font-medium text-gray-500">Parent Resource</p>
            <p className="text-base">{tenantConfig.parentResource}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
