"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  AutomatedCollectionDiscovery,
  type DiscoveryResult,
  type CollectionMetadata,
  type DiscoveryEvent,
  type DiscoveryConfig,
} from "@/lib/automated-collection-discovery"

interface UseCollectionDiscoveryOptions {
  autoDiscover?: boolean
  enableRealTime?: boolean
  refreshInterval?: number
  config?: Partial<DiscoveryConfig>
}

interface UseCollectionDiscoveryReturn {
  collections: CollectionMetadata[]
  result: DiscoveryResult | null
  loading: boolean
  error: string | null
  statistics: ReturnType<AutomatedCollectionDiscovery["getStatistics"]>
  discover: (forceRefresh?: boolean) => Promise<void>
  refreshCollection: (name: string) => Promise<void>
  getCollection: (name: string) => CollectionMetadata | null
  clearCache: () => void
}

export function useCollectionDiscovery(options: UseCollectionDiscoveryOptions = {}): UseCollectionDiscoveryReturn {
  const {
    autoDiscover = true,
    enableRealTime = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    config = {},
  } = options

  const [collections, setCollections] = useState<CollectionMetadata[]>([])
  const [result, setResult] = useState<DiscoveryResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState(() => AutomatedCollectionDiscovery.getInstance(config).getStatistics())

  const discoveryService = useRef(AutomatedCollectionDiscovery.getInstance(config))
  const refreshIntervalRef = useRef<NodeJS.Timeout>()

  // Update statistics
  const updateStatistics = useCallback(() => {
    setStatistics(discoveryService.current.getStatistics())
  }, [])

  // Discover collections
  const discover = useCallback(
    async (forceRefresh = false) => {
      setLoading(true)
      setError(null)

      try {
        const discoveryResult = await discoveryService.current.discoverCollections(forceRefresh)
        setResult(discoveryResult)
        setCollections(discoveryResult.collections)
        updateStatistics()
      } catch (err: any) {
        setError(err.message)
        console.error("Collection discovery failed:", err)
      } finally {
        setLoading(false)
      }
    },
    [updateStatistics],
  )

  // Refresh specific collection
  const refreshCollection = useCallback(
    async (name: string) => {
      try {
        await discoveryService.current.refreshCollection(name)
        setCollections(discoveryService.current.getAllCollections())
        updateStatistics()
      } catch (err: any) {
        console.error(`Failed to refresh collection ${name}:`, err)
      }
    },
    [updateStatistics],
  )

  // Get specific collection
  const getCollection = useCallback((name: string) => {
    return discoveryService.current.getCollection(name)
  }, [])

  // Clear cache
  const clearCache = useCallback(() => {
    discoveryService.current.cleanup()
    setCollections([])
    setResult(null)
    updateStatistics()
  }, [updateStatistics])

  // Setup event listeners for real-time updates
  useEffect(() => {
    if (!enableRealTime) return

    const handleCollectionUpdate = (event: DiscoveryEvent) => {
      if (event.collection) {
        setCollections((prev) => {
          const updated = [...prev]
          const index = updated.findIndex((c) => c.name === event.collection!.name)
          if (index >= 0) {
            updated[index] = event.collection!
          } else {
            updated.push(event.collection!)
          }
          return updated
        })
        updateStatistics()
      }
    }

    const handleCollectionAdded = (event: DiscoveryEvent) => {
      if (event.collection) {
        setCollections((prev) => {
          if (!prev.find((c) => c.name === event.collection!.name)) {
            return [...prev, event.collection!]
          }
          return prev
        })
        updateStatistics()
      }
    }

    const handleDiscoveryComplete = () => {
      setCollections(discoveryService.current.getAllCollections())
      updateStatistics()
    }

    const handleDiscoveryError = (event: DiscoveryEvent) => {
      if (event.error) {
        setError(event.error.message)
      }
    }

    discoveryService.current.addEventListener("collection-updated", handleCollectionUpdate)
    discoveryService.current.addEventListener("collection-added", handleCollectionAdded)
    discoveryService.current.addEventListener("discovery-complete", handleDiscoveryComplete)
    discoveryService.current.addEventListener("discovery-error", handleDiscoveryError)

    return () => {
      discoveryService.current.removeEventListener("collection-updated", handleCollectionUpdate)
      discoveryService.current.removeEventListener("collection-added", handleCollectionAdded)
      discoveryService.current.removeEventListener("discovery-complete", handleDiscoveryComplete)
      discoveryService.current.removeEventListener("discovery-error", handleDiscoveryError)
    }
  }, [enableRealTime, updateStatistics])

  // Auto-discover on mount
  useEffect(() => {
    if (autoDiscover) {
      discover()
    }
  }, [autoDiscover, discover])

  // Setup refresh interval
  useEffect(() => {
    if (refreshInterval > 0) {
      refreshIntervalRef.current = setInterval(() => {
        discover(false) // Use cache if valid
      }, refreshInterval)

      return () => {
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current)
        }
      }
    }
  }, [refreshInterval, discover])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [])

  return {
    collections,
    result,
    loading,
    error,
    statistics,
    discover,
    refreshCollection,
    getCollection,
    clearCache,
  }
}
