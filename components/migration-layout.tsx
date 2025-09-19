"use client"

import type React from "react"
import { MigrationNavigation } from "./migration-navigation"
import { MigrationProgressTracker } from "./migration-progress-tracker"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface MigrationLayoutProps {
  children: React.ReactNode
  showProgressTracker?: boolean
}

export function MigrationLayout({ children, showProgressTracker = true }: MigrationLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <MigrationNavigation />

      <div className="container mx-auto px-6 py-6">
        {showProgressTracker ? (
          <Tabs defaultValue="migration" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="migration">Migration Tool</TabsTrigger>
              <TabsTrigger value="progress">Progress Overview</TabsTrigger>
            </TabsList>

            <TabsContent value="migration" className="space-y-6">
              {children}
            </TabsContent>

            <TabsContent value="progress" className="space-y-6">
              <MigrationProgressTracker />
            </TabsContent>
          </Tabs>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
