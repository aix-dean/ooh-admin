"use client"

import { MigrationLayout } from "@/components/migration-layout"
import { MigrationHistoryDashboard } from "@/components/migration-history-dashboard"

export default function MigrationHistoryPage() {
  return (
    <MigrationLayout>
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Migration History</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Track and analyze historical migration data, performance trends, and system insights.
          </p>
        </div>

        <MigrationHistoryDashboard />
      </div>
    </MigrationLayout>
  )
}
