import { MembersManager } from "@/components/members/members-manager"
import { MembersAnalytics } from "@/components/members/members-analytics"

export const metadata = {
  title: "Members Management",
  description: "View and manage members across platforms",
}

export default function MembersPage() {
  return (
    <div className="min-h-screen overflow-y-auto overflow-x-hidden">
      {/* Page Container with proper scrolling */}
      <div className="max-w-full">
        {/* Page Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto">
              <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Members Management</h1>
              <p className="mt-2 text-sm text-gray-600 sm:text-base">View and manage members across all platforms</p>
            </div>
          </div>
        </div>

        {/* Analytics Section */}
        <div className="px-4 py-6 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <MembersAnalytics />
          </div>
        </div>

        {/* Main Content Section */}
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <MembersManager />
          </div>
        </div>
      </div>
    </div>
  )
}
