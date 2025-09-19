import { MembersManager } from "@/components/members/members-manager"

export const metadata = {
  title: "Immigration Members",
  description: "Manage immigration members and their applications",
}

export default function ImmigrationMembersPage() {
  return (
    <div className="h-full overflow-hidden">
      <div className="p-6 pb-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Immigration Members</h1>
            <p className="text-muted-foreground mt-1">Manage members with immigration services and applications</p>
          </div>
        </div>
      </div>
      <div className="p-6 pt-4">
        <MembersManager />
      </div>
    </div>
  )
}
