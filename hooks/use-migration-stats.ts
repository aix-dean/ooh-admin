"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, where, getCountFromServer } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface MigrationStats {
  totalItems: number
  processedItems: number
  successfulItems: number
  errorItems: number
  skippedItems: number
  progressPercentage: number
  isLoading: boolean
  lastUpdated?: Date
}

interface UseMigrationStatsOptions {
  collectionName: string
  companyIdField?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function useMigrationStats({
  collectionName,
  companyIdField = "company_id",
  autoRefresh = false,
  refreshInterval = 5000,
}: UseMigrationStatsOptions) {
  const [stats, setStats] = useState<MigrationStats>({
    totalItems: 0,
    processedItems: 0,
    successfulItems: 0,
    errorItems: 0,
    skippedItems: 0,
    progressPercentage: 0,
    isLoading: false,
  })

  const [isRunning, setIsRunning] = useState(false)

  const fetchStats = useCallback(async () => {
    setStats((prev) => ({ ...prev, isLoading: true }))

    try {
      // Get total count
      const totalQuery = query(collection(db, collectionName))
      const totalSnapshot = await getCountFromServer(totalQuery)
      const totalItems = totalSnapshot.data().count

      // Get items with company_id (successful)
      const successfulQuery = query(collection(db, collectionName), where(companyIdField, "!=", null))
      const successfulSnapshot = await getCountFromServer(successfulQuery)
      const successfulItems = successfulSnapshot.data().count

      // Calculate other metrics
      const processedItems = successfulItems // For now, processed = successful
      const errorItems = 0 // Would need error tracking in documents
      const skippedItems = totalItems - successfulItems
      const progressPercentage = totalItems > 0 ? (successfulItems / totalItems) * 100 : 0

      setStats({
        totalItems,
        processedItems,
        successfulItems,
        errorItems,
        skippedItems,
        progressPercentage,
        isLoading: false,
        lastUpdated: new Date(),
      })
    } catch (error) {
      console.error("Error fetching migration stats:", error)
      setStats((prev) => ({ ...prev, isLoading: false }))
    }
  }, [collectionName, companyIdField])

  const updateStats = useCallback((updates: Partial<MigrationStats>) => {
    setStats((prev) => ({
      ...prev,
      ...updates,
      lastUpdated: new Date(),
    }))
  }, [])

  const refresh = useCallback(() => {
    fetchStats()
  }, [fetchStats])

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh && isRunning) {
      const interval = setInterval(fetchStats, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, isRunning, refreshInterval, fetchStats])

  // Initial fetch
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return {
    stats,
    refresh,
    updateStats,
    setRunning: setIsRunning,
    isRunning,
  }
}
