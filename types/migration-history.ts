export interface MigrationHistoryEntry {
  id: string
  migrationType: string
  migrationName: string
  startTime: Date
  endTime?: Date
  status: "running" | "completed" | "failed" | "cancelled"
  totalItems: number
  successfulItems: number
  errorItems: number
  skippedItems: number
  batchSize: number
  processingRate?: number // items per second
  duration?: number // in milliseconds
  errorDetails?: string[]
  userId?: string
  userEmail?: string
  metadata?: {
    collectionName?: string
    dateRange?: {
      start: Date
      end: Date
    }
    testMode?: boolean
    [key: string]: any
  }
}

export interface MigrationSummary {
  totalMigrations: number
  successfulMigrations: number
  failedMigrations: number
  totalItemsProcessed: number
  averageProcessingRate: number
  mostRecentMigration?: MigrationHistoryEntry
  migrationsByType: Record<string, number>
  migrationsByStatus: Record<string, number>
}

export interface MigrationTrend {
  date: string
  migrations: number
  itemsProcessed: number
  successRate: number
  averageRate: number
}
