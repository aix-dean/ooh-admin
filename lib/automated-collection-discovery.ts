import { collection, getDocs, query, limit, onSnapshot } from "firebase/firestore"
import { db } from "./firebase"

/**
 * Automated Collection Discovery Service
 * Provides real-time collection discovery with caching and automatic updates
 */

export interface CollectionMetadata {
  name: string
  path: string
  documentCount: number
  lastAccessed: Date
  isAccessible: boolean
  hasSubcollections: boolean
  estimatedSize: string
  category: string
  priority: "high" | "medium" | "low"
  permissions: {
    read: boolean
    write: boolean
    delete: boolean
  }
  schema?: {
    fields: string[]
    types: Record<string, string>
  }
}

export interface DiscoveryConfig {
  enableRealTimeUpdates: boolean
  cacheDuration: number // in milliseconds
  maxConcurrentRequests: number
  retryAttempts: number
  retryDelay: number
  enableSchemaDetection: boolean
  enablePermissionCheck: boolean
  excludePatterns: string[]
  includeTestCollections: boolean
}

export interface DiscoveryResult {
  collections: CollectionMetadata[]
  totalCount: number
  accessibleCount: number
  lastUpdated: Date
  discoveryTime: number
  errors: DiscoveryError[]
  warnings: string[]
  cacheHit: boolean
}

export interface DiscoveryError {
  collection?: string
  code: string
  message: string
  severity: "low" | "medium" | "high"
  timestamp: Date
}

export type DiscoveryEventType =
  | "collection-added"
  | "collection-removed"
  | "collection-updated"
  | "discovery-complete"
  | "discovery-error"

export interface DiscoveryEvent {
  type: DiscoveryEventType
  collection?: CollectionMetadata
  error?: DiscoveryError
  timestamp: Date
}

/**
 * Automated Collection Discovery Manager
 */
export class AutomatedCollectionDiscovery {
  private static instance: AutomatedCollectionDiscovery
  private cache: Map<string, CollectionMetadata> = new Map()
  private lastDiscovery: Date | null = null
  private discoveryInProgress = false
  private eventListeners: Map<string, ((event: DiscoveryEvent) => void)[]> = new Map()
  private realTimeUnsubscribers: (() => void)[] = []
  private config: DiscoveryConfig

  private constructor(config: Partial<DiscoveryConfig> = {}) {
    this.config = {
      enableRealTimeUpdates: true,
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      maxConcurrentRequests: 5,
      retryAttempts: 3,
      retryDelay: 1000,
      enableSchemaDetection: true,
      enablePermissionCheck: true,
      excludePatterns: ["__*", "*_temp", "*_cache"],
      includeTestCollections: false,
      ...config,
    }
  }

  public static getInstance(config?: Partial<DiscoveryConfig>): AutomatedCollectionDiscovery {
    if (!AutomatedCollectionDiscovery.instance) {
      AutomatedCollectionDiscovery.instance = new AutomatedCollectionDiscovery(config)
    }
    return AutomatedCollectionDiscovery.instance
  }

  /**
   * Discover all collections with automatic caching and real-time updates
   */
  public async discoverCollections(forceRefresh = false): Promise<DiscoveryResult> {
    const startTime = Date.now()

    // Check cache first
    if (!forceRefresh && this.isCacheValid()) {
      return this.getCachedResult()
    }

    // Prevent concurrent discoveries
    if (this.discoveryInProgress) {
      throw new Error("Collection discovery already in progress")
    }

    this.discoveryInProgress = true

    try {
      const result = await this.performDiscovery()
      this.lastDiscovery = new Date()

      // Setup real-time updates if enabled
      if (this.config.enableRealTimeUpdates) {
        this.setupRealTimeUpdates()
      }

      this.emitEvent({
        type: "discovery-complete",
        timestamp: new Date(),
      })

      return {
        ...result,
        discoveryTime: Date.now() - startTime,
        cacheHit: false,
      }
    } catch (error: any) {
      const discoveryError: DiscoveryError = {
        code: error.code || "unknown",
        message: error.message,
        severity: "high",
        timestamp: new Date(),
      }

      this.emitEvent({
        type: "discovery-error",
        error: discoveryError,
        timestamp: new Date(),
      })

      throw error
    } finally {
      this.discoveryInProgress = false
    }
  }

  /**
   * Get known collections from your database
   */
  private getKnownCollections(): string[] {
    return [
      "ai_chat",
      "analytics",
      "analytics_products",
      "announcements",
      "app_config",
      "app_preferences",
      "apv",
      "apv_history",
      "booking",
      "cancellation_policies",
      "cart",
      "categories",
      "chat",
      "chat_messages",
      "chats",
      "client",
      "client_db",
      "contacts",
      "content_category",
      "content_comment",
      "content_engagement",
      "content_media",
      "content_reactions",
      "content_views",
      "custom_field_definitions",
      "edited_products_history",
      "faq_categories",
      "faqs",
      "ff_push_notifications",
      "ff_user_push_notifications",
      "followers",
      "green_view",
      "green_view_categories",
      "iboard_user",
      "iboard_users",
      "icast_users",
      "immigration_history",
      "immigration_statistics",
      "lobby_promo",
      "main_categories",
      "messages",
      "news_ticker",
      "newstickers",
      "notifications",
      "payments",
      "policy",
      "prod_visitors",
      "products",
      "products_dm",
      "profile_history",
      "projects",
      "promo",
      "quotation_request",
      "resource",
      "reviews",
      "reviews_reply",
      "role",
      "search_history",
      "seller",
      "seller_dm",
      "service_assignments",
      "sites",
      "tags_dm",
      "tenant-metadata",
      "terminologies",
      "test_icast_users",
      "test_istation_users",
      "test_projects",
      "test_visitors",
      "testing_products",
      "thread",
      "threads",
      "transactions",
      "user_access",
      "users",
      "users_history",
      "views",
      "wallets",
      "wishlist",
    ]
  }

  /**
   * Perform the actual collection discovery
   */
  private async performDiscovery(): Promise<DiscoveryResult> {
    const collections: CollectionMetadata[] = []
    const errors: DiscoveryError[] = []
    const warnings: string[] = []

    const knownCollections = this.getKnownCollections()
    const filteredCollections = this.filterCollections(knownCollections)

    // Process collections in batches to avoid overwhelming Firestore
    const batches = this.createBatches(filteredCollections, this.config.maxConcurrentRequests)

    for (const batch of batches) {
      const batchPromises = batch.map((collectionName) =>
        this.analyzeCollection(collectionName).catch((error) => {
          errors.push({
            collection: collectionName,
            code: error.code || "unknown",
            message: error.message,
            severity: "medium",
            timestamp: new Date(),
          })
          return null
        }),
      )

      const batchResults = await Promise.all(batchPromises)
      const validResults = batchResults.filter((result) => result !== null) as CollectionMetadata[]
      collections.push(...validResults)
    }

    // Update cache
    this.updateCache(collections)

    return {
      collections,
      totalCount: collections.length,
      accessibleCount: collections.filter((c) => c.isAccessible).length,
      lastUpdated: new Date(),
      discoveryTime: 0, // Will be set by caller
      errors,
      warnings,
      cacheHit: false,
    }
  }

  /**
   * Analyze a single collection
   */
  private async analyzeCollection(collectionName: string): Promise<CollectionMetadata> {
    const metadata: CollectionMetadata = {
      name: collectionName,
      path: collectionName,
      documentCount: 0,
      lastAccessed: new Date(),
      isAccessible: false,
      hasSubcollections: false,
      estimatedSize: "0 B",
      category: this.categorizeCollection(collectionName),
      priority: this.determinePriority(collectionName),
      permissions: {
        read: false,
        write: false,
        delete: false,
      },
    }

    try {
      const collectionRef = collection(db, collectionName)

      // Test read permission and get document count
      const snapshot = await getDocs(collectionRef)
      metadata.isAccessible = true
      metadata.permissions.read = true
      metadata.documentCount = snapshot.size
      metadata.estimatedSize = this.estimateSize(snapshot.size)

      // Test write permission (if enabled)
      if (this.config.enablePermissionCheck) {
        metadata.permissions = await this.checkPermissions(collectionName)
      }

      // Detect schema (if enabled)
      if (this.config.enableSchemaDetection && snapshot.size > 0) {
        metadata.schema = this.detectSchema(snapshot)
      }

      // Check for subcollections (limited in client SDK)
      metadata.hasSubcollections = await this.hasSubcollections(collectionName)
    } catch (error: any) {
      // Collection might not exist or no permission
      if (error.code === "permission-denied") {
        metadata.isAccessible = false
      } else {
        throw error
      }
    }

    return metadata
  }

  /**
   * Check permissions for a collection
   */
  private async checkPermissions(collectionName: string): Promise<CollectionMetadata["permissions"]> {
    const permissions = {
      read: false,
      write: false,
      delete: false,
    }

    try {
      // Test read
      const collectionRef = collection(db, collectionName)
      await getDocs(query(collectionRef, limit(1)))
      permissions.read = true

      // Note: Write and delete permissions are harder to test without actually performing operations
      // In a production environment, you might want to use Firebase Admin SDK or security rules simulation
      permissions.write = true // Assume true if read works
      permissions.delete = true // Assume true if read works
    } catch (error: any) {
      // Permission denied or other error
    }

    return permissions
  }

  /**
   * Detect schema from documents
   */
  private detectSchema(snapshot: any): CollectionMetadata["schema"] {
    const fields = new Set<string>()
    const types: Record<string, string> = {}

    // Sample first few documents to detect schema
    const sampleSize = Math.min(5, snapshot.size)
    const docs = snapshot.docs.slice(0, sampleSize)

    docs.forEach((doc: any) => {
      const data = doc.data()
      Object.keys(data).forEach((field) => {
        fields.add(field)
        if (!types[field]) {
          types[field] = typeof data[field]
        }
      })
    })

    return {
      fields: Array.from(fields),
      types,
    }
  }

  /**
   * Check if collection has subcollections
   */
  private async hasSubcollections(collectionName: string): Promise<boolean> {
    // Client SDK limitation: cannot directly list subcollections
    // This would require Admin SDK or known subcollection names
    return false
  }

  /**
   * Categorize collection based on name patterns
   */
  private categorizeCollection(name: string): string {
    const patterns = {
      "User Management": ["user", "profile", "account", "auth", "role", "access"],
      "E-commerce": ["product", "cart", "order", "payment", "transaction", "seller", "review"],
      "Content & Media": ["content", "media", "article", "post", "green_view", "apv"],
      Communication: ["chat", "message", "notification", "thread", "contact"],
      "Analytics & Tracking": ["analytics", "tracking", "view", "engagement", "statistics"],
      Configuration: ["config", "setting", "preference", "policy", "tenant"],
      Testing: ["test", "demo", "sample"],
    }

    const lowerName = name.toLowerCase()

    for (const [category, keywords] of Object.entries(patterns)) {
      if (keywords.some((keyword) => lowerName.includes(keyword))) {
        return category
      }
    }

    return "Other"
  }

  /**
   * Determine collection priority
   */
  private determinePriority(name: string): "high" | "medium" | "low" {
    const highPriority = ["users", "products", "orders", "payments", "content_media"]
    const mediumPriority = ["analytics", "categories", "reviews", "notifications"]

    if (highPriority.includes(name)) return "high"
    if (mediumPriority.includes(name)) return "medium"
    if (name.startsWith("test_")) return "low"

    return "medium"
  }

  /**
   * Estimate collection size
   */
  private estimateSize(documentCount: number): string {
    // Rough estimation: average 1KB per document
    const bytes = documentCount * 1024

    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`

    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  /**
   * Filter collections based on configuration
   */
  private filterCollections(collections: string[]): string[] {
    return collections.filter((name) => {
      // Exclude test collections if configured
      if (!this.config.includeTestCollections && name.startsWith("test_")) {
        return false
      }

      // Apply exclude patterns
      return !this.config.excludePatterns.some((pattern) => {
        const regex = new RegExp(pattern.replace(/\*/g, ".*"))
        return regex.test(name)
      })
    })
  }

  /**
   * Create batches for concurrent processing
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Setup real-time updates for collections
   */
  private setupRealTimeUpdates(): void {
    // Clean up existing listeners
    this.cleanupRealTimeUpdates()

    // Setup listeners for high-priority collections
    const highPriorityCollections = Array.from(this.cache.values())
      .filter((c) => c.priority === "high" && c.isAccessible)
      .slice(0, 5) // Limit to prevent too many listeners

    highPriorityCollections.forEach((collectionMeta) => {
      try {
        const collectionRef = collection(db, collectionMeta.name)
        const unsubscribe = onSnapshot(
          query(collectionRef, limit(1)),
          (snapshot) => {
            // Update cache
            const updatedMeta = { ...collectionMeta, lastAccessed: new Date() }
            this.cache.set(collectionMeta.name, updatedMeta)

            this.emitEvent({
              type: "collection-updated",
              collection: updatedMeta,
              timestamp: new Date(),
            })
          },
          (error) => {
            console.warn(`Real-time update failed for ${collectionMeta.name}:`, error)
          },
        )

        this.realTimeUnsubscribers.push(unsubscribe)
      } catch (error) {
        console.warn(`Failed to setup real-time updates for ${collectionMeta.name}:`, error)
      }
    })
  }

  /**
   * Clean up real-time update listeners
   */
  private cleanupRealTimeUpdates(): void {
    this.realTimeUnsubscribers.forEach((unsubscribe) => unsubscribe())
    this.realTimeUnsubscribers = []
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.lastDiscovery) return false

    const now = Date.now()
    const cacheAge = now - this.lastDiscovery.getTime()

    return cacheAge < this.config.cacheDuration
  }

  /**
   * Get cached result
   */
  private getCachedResult(): DiscoveryResult {
    const collections = Array.from(this.cache.values())

    return {
      collections,
      totalCount: collections.length,
      accessibleCount: collections.filter((c) => c.isAccessible).length,
      lastUpdated: this.lastDiscovery!,
      discoveryTime: 0,
      errors: [],
      warnings: ["Using cached data"],
      cacheHit: true,
    }
  }

  /**
   * Update cache with new collections
   */
  private updateCache(collections: CollectionMetadata[]): void {
    this.cache.clear()
    collections.forEach((collection) => {
      this.cache.set(collection.name, collection)
    })
  }

  /**
   * Event system for real-time updates
   */
  public addEventListener(eventType: DiscoveryEventType, callback: (event: DiscoveryEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    this.eventListeners.get(eventType)!.push(callback)
  }

  public removeEventListener(eventType: DiscoveryEventType, callback: (event: DiscoveryEvent) => void): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }

  private emitEvent(event: DiscoveryEvent): void {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event)
        } catch (error) {
          console.error("Error in discovery event listener:", error)
        }
      })
    }
  }

  /**
   * Get collection by name
   */
  public getCollection(name: string): CollectionMetadata | null {
    return this.cache.get(name) || null
  }

  /**
   * Get all cached collections
   */
  public getAllCollections(): CollectionMetadata[] {
    return Array.from(this.cache.values())
  }

  /**
   * Force refresh of a specific collection
   */
  public async refreshCollection(name: string): Promise<CollectionMetadata> {
    const metadata = await this.analyzeCollection(name)
    this.cache.set(name, metadata)

    this.emitEvent({
      type: "collection-updated",
      collection: metadata,
      timestamp: new Date(),
    })

    return metadata
  }

  /**
   * Clear cache and stop real-time updates
   */
  public cleanup(): void {
    this.cleanupRealTimeUpdates()
    this.cache.clear()
    this.eventListeners.clear()
    this.lastDiscovery = null
  }

  /**
   * Get discovery statistics
   */
  public getStatistics(): {
    totalCollections: number
    accessibleCollections: number
    categoryCounts: Record<string, number>
    priorityCounts: Record<string, number>
    lastDiscovery: Date | null
    cacheSize: number
  } {
    const collections = Array.from(this.cache.values())

    const categoryCounts: Record<string, number> = {}
    const priorityCounts: Record<string, number> = {}

    collections.forEach((collection) => {
      categoryCounts[collection.category] = (categoryCounts[collection.category] || 0) + 1
      priorityCounts[collection.priority] = (priorityCounts[collection.priority] || 0) + 1
    })

    return {
      totalCollections: collections.length,
      accessibleCollections: collections.filter((c) => c.isAccessible).length,
      categoryCounts,
      priorityCounts,
      lastDiscovery: this.lastDiscovery,
      cacheSize: this.cache.size,
    }
  }
}

/**
 * Convenience functions for easy usage
 */

export const discoveryService = AutomatedCollectionDiscovery.getInstance()

export async function discoverCollections(forceRefresh = false): Promise<DiscoveryResult> {
  return discoveryService.discoverCollections(forceRefresh)
}

export function getCollection(name: string): CollectionMetadata | null {
  return discoveryService.getCollection(name)
}

export function getAllCollections(): CollectionMetadata[] {
  return discoveryService.getAllCollections()
}

export function getDiscoveryStatistics() {
  return discoveryService.getStatistics()
}
