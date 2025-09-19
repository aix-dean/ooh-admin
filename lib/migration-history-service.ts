import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp,
  deleteDoc,
} from "firebase/firestore"
import type { MigrationHistoryEntry, MigrationSummary, MigrationTrend } from "@/types/migration-history"

const MIGRATION_HISTORY_COLLECTION = "migration_history"

export class MigrationHistoryService {
  // Start a new migration entry
  static async startMigration(
    migrationType: string,
    migrationName: string,
    totalItems: number,
    batchSize: number,
    metadata?: any,
  ): Promise<string> {
    try {
      const entry: Omit<MigrationHistoryEntry, "id"> = {
        migrationType,
        migrationName,
        startTime: new Date(),
        status: "running",
        totalItems,
        successfulItems: 0,
        errorItems: 0,
        skippedItems: 0,
        batchSize,
        metadata,
      }

      const docRef = await addDoc(collection(db, MIGRATION_HISTORY_COLLECTION), {
        ...entry,
        startTime: Timestamp.fromDate(entry.startTime),
      })

      return docRef.id
    } catch (error) {
      console.error("Error starting migration history:", error)
      throw error
    }
  }

  // Update migration progress
  static async updateMigrationProgress(
    migrationId: string,
    updates: Partial<Pick<MigrationHistoryEntry, "successfulItems" | "errorItems" | "skippedItems" | "processingRate">>,
  ): Promise<void> {
    try {
      const docRef = doc(db, MIGRATION_HISTORY_COLLECTION, migrationId)
      await updateDoc(docRef, updates)
    } catch (error) {
      console.error("Error updating migration progress:", error)
      throw error
    }
  }

  // Complete a migration
  static async completeMigration(
    migrationId: string,
    status: "completed" | "failed" | "cancelled",
    errorDetails?: string[],
  ): Promise<void> {
    try {
      const endTime = new Date()
      const docRef = doc(db, MIGRATION_HISTORY_COLLECTION, migrationId)

      const updates: any = {
        endTime: Timestamp.fromDate(endTime),
        status,
      }

      if (errorDetails) {
        updates.errorDetails = errorDetails
      }

      await updateDoc(docRef, updates)
    } catch (error) {
      console.error("Error completing migration:", error)
      throw error
    }
  }

  // Get migration history with pagination
  static async getMigrationHistory(limitCount = 50, migrationType?: string): Promise<MigrationHistoryEntry[]> {
    try {
      let q = query(collection(db, MIGRATION_HISTORY_COLLECTION), orderBy("startTime", "desc"), limit(limitCount))

      if (migrationType) {
        q = query(
          collection(db, MIGRATION_HISTORY_COLLECTION),
          where("migrationType", "==", migrationType),
          orderBy("startTime", "desc"),
          limit(limitCount),
        )
      }

      const snapshot = await getDocs(q)
      return snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate() || undefined,
        } as MigrationHistoryEntry
      })
    } catch (error) {
      console.error("Error getting migration history:", error)
      return []
    }
  }

  // Get migration summary statistics
  static async getMigrationSummary(): Promise<MigrationSummary> {
    try {
      const snapshot = await getDocs(collection(db, MIGRATION_HISTORY_COLLECTION))
      const migrations = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate() || undefined,
        } as MigrationHistoryEntry
      })

      const totalMigrations = migrations.length
      const successfulMigrations = migrations.filter((m) => m.status === "completed").length
      const failedMigrations = migrations.filter((m) => m.status === "failed").length
      const totalItemsProcessed = migrations.reduce((sum, m) => sum + m.totalItems, 0)

      const completedMigrations = migrations.filter((m) => m.status === "completed" && m.duration)
      const averageProcessingRate =
        completedMigrations.length > 0
          ? completedMigrations.reduce((sum, m) => sum + (m.processingRate || 0), 0) / completedMigrations.length
          : 0

      const mostRecentMigration =
        migrations.length > 0 ? migrations.sort((a, b) => b.startTime.getTime() - a.startTime.getTime())[0] : undefined

      const migrationsByType = migrations.reduce(
        (acc, m) => {
          acc[m.migrationType] = (acc[m.migrationType] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      const migrationsByStatus = migrations.reduce(
        (acc, m) => {
          acc[m.status] = (acc[m.status] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      return {
        totalMigrations,
        successfulMigrations,
        failedMigrations,
        totalItemsProcessed,
        averageProcessingRate,
        mostRecentMigration,
        migrationsByType,
        migrationsByStatus,
      }
    } catch (error) {
      console.error("Error getting migration summary:", error)
      return {
        totalMigrations: 0,
        successfulMigrations: 0,
        failedMigrations: 0,
        totalItemsProcessed: 0,
        averageProcessingRate: 0,
        migrationsByType: {},
        migrationsByStatus: {},
      }
    }
  }

  // Get migration trends (last 30 days)
  static async getMigrationTrends(): Promise<MigrationTrend[]> {
    try {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const q = query(
        collection(db, MIGRATION_HISTORY_COLLECTION),
        where("startTime", ">=", Timestamp.fromDate(thirtyDaysAgo)),
        orderBy("startTime", "asc"),
      )

      const snapshot = await getDocs(q)
      const migrations = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          startTime: data.startTime?.toDate() || new Date(),
          endTime: data.endTime?.toDate() || undefined,
        } as MigrationHistoryEntry
      })

      // Group by date
      const trendMap = new Map<
        string,
        {
          migrations: number
          itemsProcessed: number
          successful: number
          total: number
          totalRate: number
          rateCount: number
        }
      >()

      migrations.forEach((migration) => {
        const dateKey = migration.startTime.toISOString().split("T")[0]
        const existing = trendMap.get(dateKey) || {
          migrations: 0,
          itemsProcessed: 0,
          successful: 0,
          total: 0,
          totalRate: 0,
          rateCount: 0,
        }

        existing.migrations += 1
        existing.itemsProcessed += migration.totalItems
        existing.total += 1
        if (migration.status === "completed") {
          existing.successful += 1
        }
        if (migration.processingRate) {
          existing.totalRate += migration.processingRate
          existing.rateCount += 1
        }

        trendMap.set(dateKey, existing)
      })

      // Convert to array and calculate rates
      return Array.from(trendMap.entries()).map(([date, data]) => ({
        date,
        migrations: data.migrations,
        itemsProcessed: data.itemsProcessed,
        successRate: data.total > 0 ? (data.successful / data.total) * 100 : 0,
        averageRate: data.rateCount > 0 ? data.totalRate / data.rateCount : 0,
      }))
    } catch (error) {
      console.error("Error getting migration trends:", error)
      return []
    }
  }

  // Delete old migration history (older than specified days)
  static async cleanupOldHistory(daysToKeep = 90): Promise<number> {
    try {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const q = query(
        collection(db, MIGRATION_HISTORY_COLLECTION),
        where("startTime", "<", Timestamp.fromDate(cutoffDate)),
      )

      const snapshot = await getDocs(q)
      const deletePromises = snapshot.docs.map((doc) => deleteDoc(doc.ref))
      await Promise.all(deletePromises)

      return snapshot.docs.length
    } catch (error) {
      console.error("Error cleaning up migration history:", error)
      return 0
    }
  }
}
