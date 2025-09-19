"use client"

import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

// Cache Entry Interface
interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  accessCount: number
  lastAccessed: number
  version: number
  tags: string[]
}

// Cache Statistics Interface
interface CacheStats {
  totalHits: number
  totalMisses: number
  totalSize: number
  efficiency: number
  lastCleanup: number
  evictions: number
}

// Cache Configuration
interface CacheConfig {
  defaultTTL: number
  maxSize: number
  cleanupInterval: number
  compressionEnabled: boolean
  persistToStorage: boolean
}

// Migration-specific cache types
type UserCacheKey = `user:${string}`
type ProductCacheKey = `products:${string}`
type BookingCacheKey = `bookings:${string}`
type QuotationCacheKey = `quotations:${string}`
type ChatCacheKey = `chats:${string}`
type FollowerCacheKey = `followers:${string}`

type CacheKey = UserCacheKey | ProductCacheKey | BookingCacheKey | QuotationCacheKey | ChatCacheKey | FollowerCacheKey

// Default configuration
const DEFAULT_CONFIG: CacheConfig = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxSize: 500, // Maximum cache entries
  cleanupInterval: 60 * 1000, // 1 minute
  compressionEnabled: true,
  persistToStorage: true,
}

// Cache tags for invalidation
const CACHE_TAGS = {
  USER: "user",
  PRODUCT: "product",
  BOOKING: "booking",
  QUOTATION: "quotation",
  CHAT: "chat",
  FOLLOWER: "follower",
  COMPANY: "company",
} as const

export class MigrationCacheManager {
  private cache = new Map<string, CacheEntry<any>>()
  private stats: CacheStats = {
    totalHits: 0,
    totalMisses: 0,
    totalSize: 0,
    efficiency: 0,
    lastCleanup: Date.now(),
    evictions: 0,
  }
  private config: CacheConfig
  private cleanupTimer?: NodeJS.Timeout
  private compressionWorker?: Worker
  private listeners: Set<(stats: CacheStats) => void> = new Set()

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.initializeCache()
    this.startCleanupTimer()
  }

  private initializeCache() {
    if (this.config.persistToStorage && typeof window !== "undefined") {
      this.loadFromStorage()
    }
  }

  private startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired()
    }, this.config.cleanupInterval)
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem("migration-cache")
      if (stored) {
        const parsed = JSON.parse(stored)
        const now = Date.now()

        // Only load non-expired entries
        for (const [key, entry] of Object.entries(parsed)) {
          const cacheEntry = entry as CacheEntry<any>
          if (now - cacheEntry.timestamp < cacheEntry.ttl) {
            this.cache.set(key, cacheEntry)
          }
        }

        this.updateStats()
        console.log(`Loaded ${this.cache.size} cache entries from storage`)
      }
    } catch (error) {
      console.warn("Failed to load cache from storage:", error)
    }
  }

  private saveToStorage() {
    if (!this.config.persistToStorage || typeof window === "undefined") return

    try {
      const cacheObject = Object.fromEntries(this.cache.entries())
      localStorage.setItem("migration-cache", JSON.stringify(cacheObject))
    } catch (error) {
      console.warn("Failed to save cache to storage:", error)
    }
  }

  private updateStats() {
    this.stats.totalSize = this.cache.size
    const totalRequests = this.stats.totalHits + this.stats.totalMisses
    this.stats.efficiency = totalRequests > 0 ? (this.stats.totalHits / totalRequests) * 100 : 0

    // Notify listeners
    this.listeners.forEach((listener) => listener(this.stats))
  }

  private cleanupExpired() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.stats.lastCleanup = now
      this.updateStats()
      this.saveToStorage()
      console.log(`Cleaned ${cleanedCount} expired cache entries`)
    }
  }

  private evictLRU() {
    if (this.cache.size <= this.config.maxSize) return

    // Sort by last accessed time and remove oldest entries
    const entries = Array.from(this.cache.entries()).sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)

    const toRemove = entries.slice(0, this.cache.size - this.config.maxSize)

    for (const [key] of toRemove) {
      this.cache.delete(key)
      this.stats.evictions++
    }

    this.updateStats()
    console.log(`Evicted ${toRemove.length} LRU cache entries`)
  }

  private compressData(data: any): any {
    if (!this.config.compressionEnabled) return data

    try {
      // Simple compression for large objects
      if (typeof data === "object" && JSON.stringify(data).length > 1000) {
        return {
          __compressed: true,
          data: JSON.stringify(data),
        }
      }
    } catch (error) {
      console.warn("Compression failed:", error)
    }

    return data
  }

  private decompressData(data: any): any {
    if (data && data.__compressed) {
      try {
        return JSON.parse(data.data)
      } catch (error) {
        console.warn("Decompression failed:", error)
        return data
      }
    }
    return data
  }

  // Public API
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.totalMisses++
      this.updateStats()
      return undefined
    }

    const now = Date.now()

    // Check if expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      this.stats.totalMisses++
      this.updateStats()
      return undefined
    }

    // Update access statistics
    entry.accessCount++
    entry.lastAccessed = now
    this.stats.totalHits++
    this.updateStats()

    return this.decompressData(entry.data)
  }

  set<T>(key: string, data: T, ttl?: number, tags: string[] = []): void {
    this.cleanupExpired()
    this.evictLRU()

    const now = Date.now()
    const entry: CacheEntry<T> = {
      data: this.compressData(data),
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      accessCount: 1,
      lastAccessed: now,
      version: 1,
      tags,
    }

    this.cache.set(key, entry)
    this.updateStats()
    this.saveToStorage()
  }

  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      this.updateStats()
      this.saveToStorage()
    }
    return deleted
  }

  invalidateByTag(tag: string): number {
    let invalidated = 0

    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.includes(tag)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    if (invalidated > 0) {
      this.updateStats()
      this.saveToStorage()
    }

    return invalidated
  }

  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0

    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
        invalidated++
      }
    }

    if (invalidated > 0) {
      this.updateStats()
      this.saveToStorage()
    }

    return invalidated
  }

  clear(): void {
    this.cache.clear()
    this.stats = {
      totalHits: 0,
      totalMisses: 0,
      totalSize: 0,
      efficiency: 0,
      lastCleanup: Date.now(),
      evictions: 0,
    }
    this.updateStats()

    if (typeof window !== "undefined") {
      localStorage.removeItem("migration-cache")
    }
  }

  getStats(): CacheStats {
    return { ...this.stats }
  }

  onStatsUpdate(listener: (stats: CacheStats) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  // Migration-specific helper methods
  async getCachedUser(sellerId: string): Promise<any> {
    const key: UserCacheKey = `user:${sellerId}`
    let user = this.get(key)

    if (user === undefined) {
      try {
        const userDocRef = doc(db, "iboard_users", sellerId)
        const userDoc = await getDoc(userDocRef)

        user = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null
        this.set(key, user, undefined, [CACHE_TAGS.USER, CACHE_TAGS.COMPANY])
      } catch (error) {
        console.error("Error fetching user:", error)
        return null
      }
    }

    return user
  }

  async getCachedProducts(sellerId: string): Promise<any[]> {
    const key: ProductCacheKey = `products:${sellerId}`
    let products = this.get<any[]>(key)

    if (products === undefined) {
      try {
        const productsQuery = query(collection(db, "products"), where("seller_id", "==", sellerId))
        const snapshot = await getDocs(productsQuery)

        products = snapshot.docs.map((doc) => ({
          id: doc.id,
          seller_id: doc.data().seller_id,
          company_id: doc.data().company_id,
          name: doc.data().name,
          status: doc.data().status,
          created_at: doc.data().created_at,
          updated_at: doc.data().updated_at,
        }))

        this.set(key, products, undefined, [CACHE_TAGS.PRODUCT, CACHE_TAGS.COMPANY])
      } catch (error) {
        console.error("Error fetching products:", error)
        return []
      }
    }

    return products || []
  }

  async getCachedBookings(sellerId: string): Promise<any[]> {
    const key: BookingCacheKey = `bookings:${sellerId}`
    let bookings = this.get<any[]>(key)

    if (bookings === undefined) {
      try {
        const bookingsQuery = query(collection(db, "booking"), where("seller_id", "==", sellerId))
        const snapshot = await getDocs(bookingsQuery)

        bookings = snapshot.docs.map((doc) => ({
          id: doc.id,
          seller_id: doc.data().seller_id,
          company_id: doc.data().company_id,
          created_at: doc.data().created_at,
          updated_at: doc.data().updated_at,
        }))

        this.set(key, bookings, undefined, [CACHE_TAGS.BOOKING, CACHE_TAGS.COMPANY])
      } catch (error) {
        console.error("Error fetching bookings:", error)
        return []
      }
    }

    return bookings || []
  }

  async getCachedQuotations(sellerId: string): Promise<any[]> {
    const key: QuotationCacheKey = `quotations:${sellerId}`
    let quotations = this.get<any[]>(key)

    if (quotations === undefined) {
      try {
        const quotationsQuery = query(collection(db, "quotation_request"), where("seller_id", "==", sellerId))
        const snapshot = await getDocs(quotationsQuery)

        quotations = snapshot.docs.map((doc) => ({
          id: doc.id,
          seller_id: doc.data().seller_id,
          company_id: doc.data().company_id,
          created_at: doc.data().created_at,
          updated_at: doc.data().updated_at,
        }))

        this.set(key, quotations, undefined, [CACHE_TAGS.QUOTATION, CACHE_TAGS.COMPANY])
      } catch (error) {
        console.error("Error fetching quotations:", error)
        return []
      }
    }

    return quotations || []
  }

  async getCachedChats(userId: string): Promise<any[]> {
    const key: ChatCacheKey = `chats:${userId}`
    let chats = this.get<any[]>(key)

    if (chats === undefined) {
      try {
        const chatsQuery = query(collection(db, "chats"), where("users", "array-contains", userId))
        const snapshot = await getDocs(chatsQuery)

        chats = snapshot.docs.map((doc) => ({
          id: doc.id,
          users: doc.data().users,
          company_id: doc.data().company_id,
          created_at: doc.data().created_at,
          updated_at: doc.data().updated_at,
        }))

        this.set(key, chats, undefined, [CACHE_TAGS.CHAT, CACHE_TAGS.COMPANY])
      } catch (error) {
        console.error("Error fetching chats:", error)
        return []
      }
    }

    return chats || []
  }

  async getCachedFollowers(userId: string): Promise<any[]> {
    const key: FollowerCacheKey = `followers:${userId}`
    let followers = this.get<any[]>(key)

    if (followers === undefined) {
      try {
        const followersQuery = query(collection(db, "followers"), where("following_id", "==", userId))
        const snapshot = await getDocs(followersQuery)

        followers = snapshot.docs.map((doc) => ({
          id: doc.id,
          follower_id: doc.data().follower_id,
          following_id: doc.data().following_id,
          company_id: doc.data().company_id,
          created_at: doc.data().created_at,
        }))

        this.set(key, followers, undefined, [CACHE_TAGS.FOLLOWER, CACHE_TAGS.COMPANY])
      } catch (error) {
        console.error("Error fetching followers:", error)
        return []
      }
    }

    return followers || []
  }

  // Batch operations for efficiency
  async batchGetUsers(sellerIds: string[]): Promise<Map<string, any>> {
    const results = new Map<string, any>()
    const uncachedIds: string[] = []

    // Check cache first
    for (const sellerId of sellerIds) {
      const cached = this.get(`user:${sellerId}`)
      if (cached !== undefined) {
        results.set(sellerId, cached)
      } else {
        uncachedIds.push(sellerId)
      }
    }

    // Fetch uncached users
    if (uncachedIds.length > 0) {
      try {
        // Note: Firestore doesn't support batch gets with where clauses
        // We'll need to fetch individually or use a different strategy
        const promises = uncachedIds.map(async (sellerId) => {
          const userDocRef = doc(db, "iboard_users", sellerId)
          const userDoc = await getDoc(userDocRef)
          const userData = userDoc.exists() ? { id: userDoc.id, ...userDoc.data() } : null

          this.set(`user:${sellerId}`, userData, undefined, [CACHE_TAGS.USER, CACHE_TAGS.COMPANY])
          return [sellerId, userData] as const
        })

        const fetchedUsers = await Promise.all(promises)
        for (const [sellerId, userData] of fetchedUsers) {
          results.set(sellerId, userData)
        }
      } catch (error) {
        console.error("Error in batch user fetch:", error)
      }
    }

    return results
  }

  // Cache warming strategies
  async warmCache(sellerIds: string[]): Promise<void> {
    console.log(`Warming cache for ${sellerIds.length} sellers...`)

    const promises = sellerIds.map(async (sellerId) => {
      try {
        await Promise.all([
          this.getCachedUser(sellerId),
          this.getCachedProducts(sellerId),
          this.getCachedBookings(sellerId),
          this.getCachedQuotations(sellerId),
        ])
      } catch (error) {
        console.warn(`Failed to warm cache for seller ${sellerId}:`, error)
      }
    })

    await Promise.all(promises)
    console.log("Cache warming completed")
  }

  // Smart invalidation after updates
  invalidateAfterUpdate(sellerId: string, dataType: keyof typeof CACHE_TAGS): void {
    switch (dataType) {
      case "PRODUCT":
        this.invalidate(`products:${sellerId}`)
        break
      case "BOOKING":
        this.invalidate(`bookings:${sellerId}`)
        break
      case "QUOTATION":
        this.invalidate(`quotations:${sellerId}`)
        break
      case "CHAT":
        this.invalidateByPattern(new RegExp(`chats:.*${sellerId}.*`))
        break
      case "FOLLOWER":
        this.invalidate(`followers:${sellerId}`)
        break
      case "COMPANY":
        // Invalidate all data for this seller when company changes
        this.invalidateByPattern(new RegExp(`.*:${sellerId}`))
        break
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.clear()
    this.listeners.clear()
  }
}

// Global cache instance
export const migrationCache = new MigrationCacheManager({
  defaultTTL: 10 * 60 * 1000, // 10 minutes for migration data
  maxSize: 1000, // Larger cache for migration operations
  cleanupInterval: 2 * 60 * 1000, // 2 minutes cleanup
  compressionEnabled: true,
  persistToStorage: true,
})

// Cleanup on page unload
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    migrationCache.destroy()
  })
}
