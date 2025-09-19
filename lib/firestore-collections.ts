import { collection, getDocs, query, limit, enableNetwork, disableNetwork } from "firebase/firestore"
import { db } from "./firebase"

/**
 * Firebase Firestore Collections Service
 * Provides utilities for discovering and managing Firestore collections
 */

export interface CollectionInfo {
  name: string
  path: string
  documentCount?: number
  estimatedSize?: string
  lastModified?: Date
  isSubcollection: boolean
  parentPath?: string
}

export interface ListCollectionsOptions {
  includeSubcollections?: boolean
  includeDocumentCount?: boolean
  includeMetadata?: boolean
  maxDepth?: number
  excludePatterns?: string[]
  timeout?: number
}

export interface ListCollectionsResult {
  collections: CollectionInfo[]
  totalCount: number
  executionTime: number
  errors: string[]
  warnings: string[]
}

/**
 * Lists all collections in the Firestore database
 *
 * @param options - Configuration options for collection discovery
 * @returns Promise<ListCollectionsResult> - Result containing collections and metadata
 *
 * @example
 * \`\`\`typescript
 * // Basic usage - get all root collections
 * const result = await listFirestoreCollections()
 * console.log(result.collections.map(c => c.name))
 *
 * // Advanced usage with options
 * const result = await listFirestoreCollections({
 *   includeSubcollections: true,
 *   includeDocumentCount: true,
 *   maxDepth: 2,
 *   excludePatterns: ['_temp*', 'cache*']
 * })
 * \`\`\`
 *
 * @throws {Error} When database connection fails or permissions are insufficient
 */
export async function listFirestoreCollections(options: ListCollectionsOptions = {}): Promise<ListCollectionsResult> {
  const startTime = Date.now()
  const {
    includeSubcollections = false,
    includeDocumentCount = false,
    includeMetadata = false,
    maxDepth = 3,
    excludePatterns = [],
    timeout = 30000,
  } = options

  const result: ListCollectionsResult = {
    collections: [],
    totalCount: 0,
    executionTime: 0,
    errors: [],
    warnings: [],
  }

  try {
    // Validate database connection
    await validateFirestoreConnection()

    // Create timeout promise
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
    })

    // Get collections with timeout
    const collectionsPromise = discoverCollections(
      includeSubcollections,
      includeDocumentCount,
      includeMetadata,
      maxDepth,
      excludePatterns,
      result,
    )

    await Promise.race([collectionsPromise, timeoutPromise])

    result.totalCount = result.collections.length
    result.executionTime = Date.now() - startTime

    // Sort collections by name for consistent output
    result.collections.sort((a, b) => a.name.localeCompare(b.name))

    return result
  } catch (error: any) {
    result.errors.push(formatFirestoreError(error))
    result.executionTime = Date.now() - startTime

    // For critical errors, throw them up
    if (isCriticalError(error)) {
      throw new Error(`Failed to list Firestore collections: ${error.message}`)
    }

    return result
  }
}

/**
 * Discovers collections recursively or at root level
 */
async function discoverCollections(
  includeSubcollections: boolean,
  includeDocumentCount: boolean,
  includeMetadata: boolean,
  maxDepth: number,
  excludePatterns: string[],
  result: ListCollectionsResult,
  currentPath = "",
  currentDepth = 0,
): Promise<void> {
  try {
    if (currentDepth >= maxDepth) {
      result.warnings.push(`Max depth ${maxDepth} reached at path: ${currentPath}`)
      return
    }

    let collections: string[]

    if (currentPath === "") {
      // Get root collections using the known collections method
      collections = await getRootCollections()
    } else {
      // Get subcollections by scanning documents
      collections = await getSubcollections(currentPath)
    }

    for (const collectionName of collections) {
      // Skip if matches exclude patterns
      if (shouldExcludeCollection(collectionName, excludePatterns)) {
        continue
      }

      const fullPath = currentPath ? `${currentPath}/${collectionName}` : collectionName

      const collectionInfo: CollectionInfo = {
        name: collectionName,
        path: fullPath,
        isSubcollection: currentDepth > 0,
        parentPath: currentPath || undefined,
      }

      // Add document count if requested
      if (includeDocumentCount) {
        try {
          collectionInfo.documentCount = await getCollectionDocumentCount(fullPath)
        } catch (error: any) {
          result.warnings.push(`Could not get document count for ${fullPath}: ${error.message}`)
        }
      }

      // Add metadata if requested
      if (includeMetadata) {
        try {
          const metadata = await getCollectionMetadata(fullPath)
          collectionInfo.estimatedSize = metadata.estimatedSize
          collectionInfo.lastModified = metadata.lastModified
        } catch (error: any) {
          result.warnings.push(`Could not get metadata for ${fullPath}: ${error.message}`)
        }
      }

      result.collections.push(collectionInfo)

      // Recursively discover subcollections if enabled
      if (includeSubcollections && currentDepth < maxDepth - 1) {
        await discoverCollections(
          includeSubcollections,
          includeDocumentCount,
          includeMetadata,
          maxDepth,
          excludePatterns,
          result,
          fullPath,
          currentDepth + 1,
        )
      }
    }
  } catch (error: any) {
    result.errors.push(`Error discovering collections at ${currentPath}: ${error.message}`)
  }
}

/**
 * Gets root-level collections by attempting to access known collection names
 * This is a workaround since the client SDK doesn't have listCollections()
 */
async function getRootCollections(): Promise<string[]> {
  // Your actual collections from the Firebase database
  const actualCollections = [
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

  const existingCollections: string[] = []

  // Test each collection by trying to read from it
  const batchSize = 10 // Process in batches to avoid overwhelming Firestore
  for (let i = 0; i < actualCollections.length; i += batchSize) {
    const batch = actualCollections.slice(i, i + batchSize)

    const batchPromises = batch.map(async (collectionName) => {
      try {
        const collectionRef = collection(db, collectionName)
        const snapshot = await getDocs(query(collectionRef, limit(1)))

        // If we can read it and it has docs, or if it exists but is empty
        if (snapshot.metadata || snapshot.empty !== undefined) {
          return collectionName
        }
      } catch (error: any) {
        // Collection might not exist or we don't have permission
        // This is expected for some collections
        return null
      }
      return null
    })

    const batchResults = await Promise.all(batchPromises)
    const validCollections = batchResults.filter((name) => name !== null) as string[]
    existingCollections.push(...validCollections)
  }

  return existingCollections
}

/**
 * Gets subcollections by scanning documents in a collection
 */
async function getSubcollections(collectionPath: string): Promise<string[]> {
  try {
    const collectionRef = collection(db, collectionPath)
    const snapshot = await getDocs(query(collectionRef, limit(10))) // Sample documents

    const subcollections = new Set<string>()

    // This is a limitation - we can't directly list subcollections in client SDK
    // We would need to know the subcollection names or use Cloud Functions
    // For now, return empty array for subcollections

    return Array.from(subcollections)
  } catch (error: any) {
    throw new Error(`Failed to get subcollections for ${collectionPath}: ${error.message}`)
  }
}

/**
 * Gets document count for a collection
 */
async function getCollectionDocumentCount(collectionPath: string): Promise<number> {
  try {
    const collectionRef = collection(db, collectionPath)
    const snapshot = await getDocs(collectionRef)
    return snapshot.size
  } catch (error: any) {
    // If we can't read all docs, try to estimate with a small sample
    try {
      const collectionRef = collection(db, collectionPath)
      const smallSnapshot = await getDocs(query(collectionRef, limit(1)))
      return smallSnapshot.empty ? 0 : -1 // -1 indicates "has documents but count unknown"
    } catch {
      throw error
    }
  }
}

/**
 * Gets metadata for a collection
 */
async function getCollectionMetadata(collectionPath: string): Promise<{
  estimatedSize: string
  lastModified?: Date
}> {
  // Note: Client SDK has limited metadata access
  // This would typically require Admin SDK or Cloud Functions
  return {
    estimatedSize: "Unknown (requires Admin SDK)",
    lastModified: undefined,
  }
}

/**
 * Validates Firestore connection
 */
async function validateFirestoreConnection(): Promise<void> {
  try {
    // Try to access a minimal operation using a valid collection name
    const testRef = collection(db, "connection_test")
    const testQuery = query(testRef, limit(1))
    await getDocs(testQuery)
  } catch (error: any) {
    if (error.code === "permission-denied") {
      throw new Error("Insufficient permissions to access Firestore. Please check your security rules.")
    } else if (error.code === "unavailable") {
      throw new Error("Firestore service is currently unavailable. Please try again later.")
    } else if (error.code === "unauthenticated") {
      throw new Error("User not authenticated. Please sign in to access Firestore.")
    } else {
      throw new Error(`Firestore connection failed: ${error.message}`)
    }
  }
}

/**
 * Checks if a collection should be excluded based on patterns
 */
function shouldExcludeCollection(collectionName: string, excludePatterns: string[]): boolean {
  return excludePatterns.some((pattern) => {
    // Convert glob pattern to regex
    const regexPattern = pattern.replace(/\*/g, ".*").replace(/\?/g, ".")
    const regex = new RegExp(`^${regexPattern}$`, "i")
    return regex.test(collectionName)
  })
}

/**
 * Formats Firestore errors into user-friendly messages
 */
function formatFirestoreError(error: any): string {
  const errorMap: Record<string, string> = {
    "permission-denied": "Access denied. Check your Firestore security rules and user permissions.",
    unavailable: "Firestore service is temporarily unavailable. Please try again later.",
    unauthenticated: "User authentication required. Please sign in first.",
    "not-found": "The requested collection or document was not found.",
    "already-exists": "The collection or document already exists.",
    "resource-exhausted": "Request quota exceeded. Please try again later.",
    "deadline-exceeded": "Request timed out. The operation took too long to complete.",
    cancelled: "The operation was cancelled.",
    "invalid-argument": "Invalid request parameters provided.",
    "failed-precondition": "Operation failed due to system state. Please retry.",
    aborted: "Operation was aborted due to a conflict. Please retry.",
    "out-of-range": "Request parameters are out of valid range.",
    unimplemented: "This operation is not supported.",
    internal: "Internal server error occurred.",
    "data-loss": "Unrecoverable data loss or corruption detected.",
  }

  const code = error.code || "unknown"
  const userMessage = errorMap[code] || `Unknown error: ${error.message}`

  return `[${code.toUpperCase()}] ${userMessage}`
}

/**
 * Determines if an error is critical and should stop execution
 */
function isCriticalError(error: any): boolean {
  const criticalCodes = ["unauthenticated", "permission-denied", "unavailable", "internal", "data-loss"]

  return criticalCodes.includes(error.code)
}

/**
 * Simple function that returns just collection names (for basic use cases)
 *
 * @returns Promise<string[]> - Array of collection names
 *
 * @example
 * \`\`\`typescript
 * const collections = await getCollectionNames()
 * console.log('Found collections:', collections)
 * \`\`\`
 */
export async function getCollectionNames(): Promise<string[]> {
  try {
    const result = await listFirestoreCollections({
      includeSubcollections: false,
      includeDocumentCount: false,
      includeMetadata: false,
    })

    if (result.errors.length > 0) {
      console.warn("Warnings while listing collections:", result.errors)
    }

    return result.collections.map((c) => c.name)
  } catch (error: any) {
    throw new Error(`Failed to get collection names: ${error.message}`)
  }
}

/**
 * Network utility functions for testing connectivity
 */
export async function testFirestoreConnectivity(): Promise<{
  isConnected: boolean
  latency?: number
  error?: string
}> {
  const startTime = Date.now()

  try {
    await validateFirestoreConnection()
    return {
      isConnected: true,
      latency: Date.now() - startTime,
    }
  } catch (error: any) {
    return {
      isConnected: false,
      error: error.message,
    }
  }
}

/**
 * Enable/disable Firestore network for testing
 */
export async function toggleFirestoreNetwork(enable: boolean): Promise<void> {
  try {
    if (enable) {
      await enableNetwork(db)
    } else {
      await disableNetwork(db)
    }
  } catch (error: any) {
    throw new Error(`Failed to ${enable ? "enable" : "disable"} Firestore network: ${error.message}`)
  }
}

/**
 * Categorize collections by their purpose/domain
 */
export function categorizeCollections(collections: CollectionInfo[]): Record<string, CollectionInfo[]> {
  const categories: Record<string, CollectionInfo[]> = {
    "User Management": [],
    "Content & Media": [],
    "E-commerce": [],
    Communication: [],
    "Analytics & Tracking": [],
    Configuration: [],
    Testing: [],
    Other: [],
  }

  collections.forEach((collection) => {
    const name = collection.name.toLowerCase()

    if (
      name.includes("user") ||
      name.includes("iboard") ||
      name.includes("icast") ||
      name.includes("profile") ||
      name.includes("role") ||
      name.includes("access")
    ) {
      categories["User Management"].push(collection)
    } else if (
      name.includes("content") ||
      name.includes("media") ||
      name.includes("green_view") ||
      name.includes("apv") ||
      name.includes("news") ||
      name.includes("faq")
    ) {
      categories["Content & Media"].push(collection)
    } else if (
      name.includes("product") ||
      name.includes("cart") ||
      name.includes("payment") ||
      name.includes("transaction") ||
      name.includes("booking") ||
      name.includes("seller") ||
      name.includes("categories") ||
      name.includes("wishlist") ||
      name.includes("reviews")
    ) {
      categories["E-commerce"].push(collection)
    } else if (
      name.includes("chat") ||
      name.includes("message") ||
      name.includes("notification") ||
      name.includes("thread") ||
      name.includes("contact")
    ) {
      categories["Communication"].push(collection)
    } else if (
      name.includes("analytics") ||
      name.includes("history") ||
      name.includes("views") ||
      name.includes("visitor") ||
      name.includes("engagement") ||
      name.includes("immigration_statistics")
    ) {
      categories["Analytics & Tracking"].push(collection)
    } else if (
      name.includes("config") ||
      name.includes("preference") ||
      name.includes("policy") ||
      name.includes("app_") ||
      name.includes("tenant")
    ) {
      categories["Configuration"].push(collection)
    } else if (name.includes("test")) {
      categories["Testing"].push(collection)
    } else {
      categories["Other"].push(collection)
    }
  })

  // Remove empty categories
  Object.keys(categories).forEach((key) => {
    if (categories[key].length === 0) {
      delete categories[key]
    }
  })

  return categories
}

/**
 * Get collection statistics and insights
 */
export async function getCollectionInsights(collections: CollectionInfo[]): Promise<{
  totalCollections: number
  collectionsWithDocuments: number
  largestCollections: CollectionInfo[]
  recentlyModified: CollectionInfo[]
  categories: Record<string, number>
}> {
  const categorized = categorizeCollections(collections)
  const collectionsWithDocs = collections.filter((c) => (c.documentCount || 0) > 0)
  const largest = collections
    .filter((c) => c.documentCount !== undefined)
    .sort((a, b) => (b.documentCount || 0) - (a.documentCount || 0))
    .slice(0, 5)

  return {
    totalCollections: collections.length,
    collectionsWithDocuments: collectionsWithDocs.length,
    largestCollections: largest,
    recentlyModified: [], // Would need lastModified data
    categories: Object.fromEntries(Object.entries(categorized).map(([key, value]) => [key, value.length])),
  }
}
