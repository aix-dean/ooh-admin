import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { migrationCache } from "@/lib/migration-cache-manager"

interface MigrationCacheInterface {
  set: (key: string, value: any) => Promise<void>
  get: (key: string) => Promise<any>
  clear: () => Promise<void>
  getCachedUser: (sellerId: string) => Promise<UserRecord | null>
  getCachedProducts: (sellerId: string) => Promise<ProductRecord[] | null>
  invalidateAfterUpdate: (sellerId: string, type: string) => Promise<void>
}

export interface PaginatedProductBatch {
  products: ProductRecord[]
  hasMore: boolean
  lastDoc?: QueryDocumentSnapshot<DocumentData>
  batchNumber: number
  totalProcessed: number
  querySnapshot?: any
  debugInfo?: {
    queryUsed: string
    docsReturned: number
    lastDocId?: string
    timestamp: string
  }
}

export interface ProductRecord {
  id: string
  seller_id: string
  company_id?: string | null
  name?: string
  status?: string
  created_at?: any
  updated_at?: any
}

export interface UserRecord {
  id: string
  company_id?: string | null
  email?: string
  display_name?: string
  [key: string]: any
}

export interface PaginatedMigrationResult {
  selectedEntry: ProductRecord | null
  userRecord: UserRecord | null
  extractedCompanyId: string | null
  currentBatch: PaginatedProductBatch
  allBatches: PaginatedProductBatch[]
  totalUpdated: number
  totalSkipped: number
  totalErrors: number
  isComplete: boolean
  migrationId: string
  startTime: string
  migrationComplete?: boolean
  noEligibleProducts?: boolean
  debugInfo?: {
    initializationAttempts: number
    batchLoadAttempts: number
    cacheHits: number
    cacheMisses: number
    errors: Array<{ timestamp: string; error: string; context: string }>
    eligibilityStats?: {
      totalProductsChecked: number
      productsWithCompanyId: number
      productsWithoutSellerId: number
      sellersWithoutCompanyId: number
      validationErrors: number
    }
  }
}

export interface MigrationProgress {
  currentBatch: number
  totalBatches: number
  processedProducts: number
  remainingProducts: number
  estimatedTotal: number
  progressPercentage: number
  migrationId: string
}

const PRODUCTS_PER_BATCH = 10
const MAX_INITIAL_SAMPLE = 100 // Increased sample size
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000
const MAX_SELECTION_ATTEMPTS = 10 // Increased attempts

export class PaginatedMigrationService {
  private readonly migrationCache: MigrationCacheInterface
  private migrationState: PaginatedMigrationResult | null = null
  private progressCallbacks: Set<(progress: MigrationProgress) => void> = new Set()
  private isInitializing = false
  private isLoadingBatch = false
  private debugMode = true

  constructor(migrationCache: MigrationCacheInterface) {
    this.migrationCache = migrationCache
  }

  // Enhanced logging
  private log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${level}] [PaginatedMigrationService] ${message}`

    if (this.debugMode) {
      if (data) {
        console.log(logMessage, data)
      } else {
        console.log(logMessage)
      }
    }

    // Add to migration debug info
    if (this.migrationState?.debugInfo && level === "ERROR") {
      this.migrationState.debugInfo.errors.push({
        timestamp,
        error: message,
        context: data ? JSON.stringify(data) : "No additional context",
      })
    }
  }

  // Progress tracking
  onProgressUpdate(callback: (progress: MigrationProgress) => void): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  private notifyProgress(progress: MigrationProgress) {
    this.log("DEBUG", "Notifying progress update", progress)
    this.progressCallbacks.forEach((callback) => {
      try {
        callback(progress)
      } catch (error) {
        this.log("ERROR", "Error in progress callback", {
          error: error instanceof Error ? error.message : String(error),
        })
      }
    })
  }

  // Enhanced retry mechanism
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts: number = MAX_RETRY_ATTEMPTS,
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.log("DEBUG", `Attempting ${operationName} (attempt ${attempt}/${maxAttempts})`)
        const result = await operation()

        if (attempt > 1) {
          this.log("INFO", `${operationName} succeeded on attempt ${attempt}`)
        }

        return result
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        this.log("WARN", `${operationName} failed on attempt ${attempt}`, {
          error: lastError.message,
          stack: lastError.stack,
        })

        if (attempt < maxAttempts) {
          const delay = RETRY_DELAY * attempt
          this.log("DEBUG", `Waiting ${delay}ms before retry`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    this.log("ERROR", `${operationName} failed after ${maxAttempts} attempts`, {
      finalError: lastError?.message,
      stack: lastError?.stack,
    })
    throw lastError || new Error(`${operationName} failed after ${maxAttempts} attempts`)
  }

  // Enhanced eligibility check with comprehensive statistics
  async checkMigrationEligibility(): Promise<{
    hasEligibleProducts: boolean
    stats: {
      totalProductsChecked: number
      productsWithCompanyId: number
      productsWithoutSellerId: number
      sellersWithoutCompanyId: number
      validationErrors: number
      eligibleProducts: number
    }
    sampleEligibleProducts: ProductRecord[]
  }> {
    this.log("INFO", "Starting comprehensive migration eligibility check")

    const stats = {
      totalProductsChecked: 0,
      productsWithCompanyId: 0,
      productsWithoutSellerId: 0,
      sellersWithoutCompanyId: 0,
      validationErrors: 0,
      eligibleProducts: 0,
    }

    const sampleEligibleProducts: ProductRecord[] = []

    try {
      // Check a larger sample to get better statistics
      const eligibilityQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(MAX_INITIAL_SAMPLE * 2), // Check more products for eligibility
      )

      this.log("DEBUG", "Executing eligibility check query", {
        sampleSize: MAX_INITIAL_SAMPLE * 2,
      })

      const snapshot = await getDocs(eligibilityQuery)
      stats.totalProductsChecked = snapshot.size

      this.log("INFO", `Eligibility check query completed`, {
        docsReturned: snapshot.size,
        isEmpty: snapshot.empty,
      })

      if (snapshot.empty) {
        this.log("WARN", "No products found in collection")
        return { hasEligibleProducts: false, stats, sampleEligibleProducts }
      }

      // Process products in batches to avoid overwhelming the system
      const products = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          seller_id: data.seller_id,
          company_id: data.company_id,
          name: data.name,
          status: data.status,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } as ProductRecord
      })

      this.log("DEBUG", "Processing products for eligibility", {
        totalProducts: products.length,
      })

      // Check eligibility for each product
      for (const product of products) {
        // Skip products that already have company_id
        if (product.company_id && product.company_id.trim() !== "") {
          stats.productsWithCompanyId++
          continue
        }

        // Skip products without seller_id
        if (!product.seller_id || product.seller_id.trim() === "") {
          stats.productsWithoutSellerId++
          continue
        }

        // Check if seller has company_id
        try {
          const sellerRecord = await this.migrationCache.getCachedUser(product.seller_id)
          if (!sellerRecord || !sellerRecord.company_id || sellerRecord.company_id.trim() === "") {
            stats.sellersWithoutCompanyId++
            continue
          }

          // Product is eligible
          stats.eligibleProducts++
          if (sampleEligibleProducts.length < 10) {
            // Keep a small sample of eligible products
            sampleEligibleProducts.push(product)
          }

          this.log("DEBUG", "Found eligible product", {
            productId: product.id,
            sellerId: product.seller_id,
            sellerCompanyId: sellerRecord.company_id,
          })
        } catch (error) {
          stats.validationErrors++
          this.log("WARN", "Error validating seller for product", {
            productId: product.id,
            sellerId: product.seller_id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const hasEligibleProducts = stats.eligibleProducts > 0

      this.log("INFO", "Eligibility check completed", {
        hasEligibleProducts,
        stats,
        sampleSize: sampleEligibleProducts.length,
      })

      return { hasEligibleProducts, stats, sampleEligibleProducts }
    } catch (error) {
      this.log("ERROR", "Eligibility check failed", {
        error: error instanceof Error ? error.message : String(error),
        stats,
      })
      throw error
    }
  }

  // Step 1: Enhanced random product selection with eligibility pre-check
  async selectRandomProductEntry(): Promise<ProductRecord | null> {
    this.log("INFO", "Starting enhanced random product selection with dynamic alternatives")

    return this.retryOperation(async () => {
      try {
        // First, get a comprehensive eligibility check
        const eligibilityCheck = await this.checkMigrationEligibility()

        if (!eligibilityCheck.hasEligibleProducts) {
          this.log("WARN", "No eligible products found in eligibility check", {
            stats: eligibilityCheck.stats,
          })

          throw new Error(
            `No eligible products found for migration. Stats: ${eligibilityCheck.stats.totalProductsChecked} total, ${eligibilityCheck.stats.productsWithCompanyId} already migrated, ${eligibilityCheck.stats.sellersWithoutCompanyId} sellers without company_id`,
          )
        }

        // If we have eligible products from the check, use one of them
        if (eligibilityCheck.sampleEligibleProducts.length > 0) {
          const randomIndex = Math.floor(Math.random() * eligibilityCheck.sampleEligibleProducts.length)
          const selectedEntry = eligibilityCheck.sampleEligibleProducts[randomIndex]

          this.log("INFO", "Product selected from eligibility check sample", {
            selectedIndex: randomIndex,
            totalSample: eligibilityCheck.sampleEligibleProducts.length,
            selectedId: selectedEntry.id,
            sellerId: selectedEntry.seller_id,
            productName: selectedEntry.name,
          })

          return selectedEntry
        }

        // Enhanced fallback with multiple attempts to find different products
        this.log("DEBUG", "Using enhanced fallback with dynamic product discovery")

        const maxDiscoveryAttempts = 5
        const productsPerAttempt = MAX_INITIAL_SAMPLE

        for (let discoveryAttempt = 1; discoveryAttempt <= maxDiscoveryAttempts; discoveryAttempt++) {
          this.log("DEBUG", `Product discovery attempt ${discoveryAttempt}/${maxDiscoveryAttempts}`)

          // Use different query strategies for each attempt
          let eligibleProductsQuery

          switch (discoveryAttempt) {
            case 1:
              // Standard query
              eligibleProductsQuery = query(
                collection(db, "products"),
                where("seller_id", "!=", null),
                orderBy("seller_id"),
                orderBy("__name__"),
                limit(productsPerAttempt),
              )
              break
            case 2:
              // Query with different ordering
              eligibleProductsQuery = query(
                collection(db, "products"),
                where("seller_id", "!=", null),
                orderBy("seller_id", "desc"),
                orderBy("__name__"),
                limit(productsPerAttempt),
              )
              break
            case 3:
              // Query focusing on products without company_id
              eligibleProductsQuery = query(
                collection(db, "products"),
                where("seller_id", "!=", null),
                where("company_id", "==", null),
                orderBy("seller_id"),
                limit(productsPerAttempt),
              )
              break
            case 4:
              // Query with empty string company_id
              eligibleProductsQuery = query(
                collection(db, "products"),
                where("seller_id", "!=", null),
                where("company_id", "==", ""),
                orderBy("seller_id"),
                limit(productsPerAttempt),
              )
              break
            default:
              // Final attempt with broader search
              eligibleProductsQuery = query(
                collection(db, "products"),
                where("seller_id", "!=", null),
                orderBy("seller_id"),
                limit(productsPerAttempt * 2),
              )
          }

          this.log("DEBUG", `Executing discovery query attempt ${discoveryAttempt}`, {
            queryType: `attempt_${discoveryAttempt}`,
            expectedResults: productsPerAttempt,
          })

          const snapshot = await getDocs(eligibleProductsQuery)

          if (snapshot.empty) {
            this.log("WARN", `No products found in discovery attempt ${discoveryAttempt}`)
            continue
          }

          this.log("INFO", `Discovery attempt ${discoveryAttempt} returned ${snapshot.size} products`)

          // Process products and find eligible ones
          const allProducts = snapshot.docs.map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              seller_id: data.seller_id,
              company_id: data.company_id,
              name: data.name,
              status: data.status,
              created_at: data.created_at,
              updated_at: data.updated_at,
            } as ProductRecord
          })

          // Validate products in batches to avoid overwhelming the system
          const validatedProducts: ProductRecord[] = []
          const batchSize = 10

          for (let i = 0; i < allProducts.length; i += batchSize) {
            const batch = allProducts.slice(i, i + batchSize)

            for (const product of batch) {
              // Skip products that already have company_id
              if (product.company_id && product.company_id.trim() !== "") {
                continue
              }

              // Skip products without seller_id
              if (!product.seller_id || product.seller_id.trim() === "") {
                continue
              }

              // Validate seller has company_id
              try {
                const sellerRecord = await this.migrationCache.getCachedUser(product.seller_id)
                if (!sellerRecord || !sellerRecord.company_id || sellerRecord.company_id.trim() === "") {
                  continue
                }

                // Product is valid for migration
                validatedProducts.push(product)

                this.log("DEBUG", `Found eligible product in attempt ${discoveryAttempt}`, {
                  productId: product.id,
                  sellerId: product.seller_id,
                  sellerCompanyId: sellerRecord.company_id,
                })

                // If we found enough eligible products, break early
                if (validatedProducts.length >= 5) {
                  break
                }
              } catch (error) {
                this.log("DEBUG", "Error validating seller for product", {
                  productId: product.id,
                  sellerId: product.seller_id,
                  error: error instanceof Error ? error.message : String(error),
                })
              }
            }

            // If we found eligible products, break out of batch processing
            if (validatedProducts.length > 0) {
              break
            }
          }

          this.log("INFO", `Discovery attempt ${discoveryAttempt} validation completed`, {
            totalProducts: allProducts.length,
            eligibleProducts: validatedProducts.length,
          })

          if (validatedProducts.length > 0) {
            // Select a random product from the eligible ones
            const randomIndex = Math.floor(Math.random() * validatedProducts.length)
            const selectedEntry = validatedProducts[randomIndex]

            this.log("INFO", `Product selected from discovery attempt ${discoveryAttempt}`, {
              selectedIndex: randomIndex,
              totalEligible: validatedProducts.length,
              selectedId: selectedEntry.id,
              sellerId: selectedEntry.seller_id,
              productName: selectedEntry.name,
              discoveryAttempt,
            })

            return selectedEntry
          }

          // Wait before next discovery attempt
          if (discoveryAttempt < maxDiscoveryAttempts) {
            const delay = 1000 * discoveryAttempt
            this.log("DEBUG", `Waiting ${delay}ms before next discovery attempt`)
            await new Promise((resolve) => setTimeout(resolve, delay))
          }
        }

        // If all discovery attempts failed
        throw new Error(
          `No eligible products found after ${maxDiscoveryAttempts} discovery attempts with different query strategies`,
        )
      } catch (error) {
        this.log("ERROR", "Product selection failed", {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "selectRandomProductEntry")
  }

  // Dynamic seller validation with alternative selection
  async findAlternativeProductForSeller(
    originalSellerId: string,
    excludeProductIds: string[] = [],
  ): Promise<ProductRecord | null> {
    this.log("INFO", `Finding alternative product for seller: ${originalSellerId}`)

    try {
      // First, try to find other products for the same seller
      const sellerProductsQuery = query(
        collection(db, "products"),
        where("seller_id", "==", originalSellerId),
        orderBy("__name__"),
        limit(20),
      )

      const sellerSnapshot = await getDocs(sellerProductsQuery)

      if (!sellerSnapshot.empty) {
        const sellerProducts = sellerSnapshot.docs
          .map((doc) => {
            const data = doc.data()
            return {
              id: doc.id,
              seller_id: data.seller_id,
              company_id: data.company_id,
              name: data.name,
              status: data.status,
              created_at: data.created_at,
              updated_at: data.updated_at,
            } as ProductRecord
          })
          .filter((product) => {
            // Exclude already processed products and products with company_id
            return !excludeProductIds.includes(product.id) && (!product.company_id || product.company_id.trim() === "")
          })

        if (sellerProducts.length > 0) {
          const randomProduct = sellerProducts[Math.floor(Math.random() * sellerProducts.length)]
          this.log("INFO", "Found alternative product for same seller", {
            originalSellerId,
            alternativeProductId: randomProduct.id,
            alternativeProductName: randomProduct.name,
          })
          return randomProduct
        }
      }

      this.log("DEBUG", "No alternative products found for seller, looking for different seller")
      return null
    } catch (error) {
      this.log("ERROR", "Failed to find alternative product for seller", {
        originalSellerId,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  // Step 2: Enhanced user lookup with proper cache handling
  async getUserCompanyId(sellerId: string): Promise<UserRecord | null> {
    this.log("INFO", `Starting enhanced user lookup for seller: ${sellerId}`)

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for user lookup")
    }

    return this.retryOperation(async () => {
      try {
        this.log("DEBUG", "Attempting cached user lookup", { sellerId })

        const userRecord = await this.migrationCache.getCachedUser(sellerId)

        if (userRecord) {
          this.log("INFO", "User data retrieved successfully", {
            sellerId,
            userId: userRecord.id,
            hasCompanyId: !!userRecord.company_id,
            companyId: userRecord.company_id,
            email: userRecord.email,
            cacheHit: true,
            retrievalTimestamp: new Date().toISOString(),
          })

          // Validate user data integrity with enhanced checks
          if (!userRecord.company_id || userRecord.company_id.trim() === "") {
            this.log("ERROR", "Seller validation failed - no valid company_id", {
              sellerId,
              userId: userRecord.id,
              companyId: userRecord.company_id,
              email: userRecord.email,
              validationReason: "missing_or_empty_company_id",
            })
            throw new Error(`Seller ${sellerId} exists but has no valid company_id - skipping associated products`)
          }

          // Additional validation for company_id format if needed
          if (userRecord.company_id.length < 3) {
            this.log("WARN", "Seller has suspiciously short company_id", {
              sellerId,
              companyId: userRecord.company_id,
              companyIdLength: userRecord.company_id.length,
            })
          }

          if (this.migrationState?.debugInfo) {
            this.migrationState.debugInfo.cacheHits++
          }
        } else {
          this.log("WARN", "No user document found", { sellerId })

          if (this.migrationState?.debugInfo) {
            this.migrationState.debugInfo.cacheMisses++
          }
        }

        return userRecord
      } catch (error) {
        this.log("ERROR", "User lookup failed", {
          sellerId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "getUserCompanyId")
  }

  // Create empty batch for completed migrations
  private createEmptyBatch(): PaginatedProductBatch {
    return {
      products: [],
      hasMore: false,
      batchNumber: 1,
      totalProcessed: 0,
      debugInfo: {
        queryUsed: "EMPTY_BATCH_NO_ELIGIBLE_PRODUCTS",
        docsReturned: 0,
        timestamp: new Date().toISOString(),
      },
    }
  }

  // Step 3: Enhanced first batch retrieval with proper pagination setup
  async getFirstProductBatch(sellerId: string): Promise<PaginatedProductBatch> {
    this.log("INFO", `Starting enhanced first batch retrieval for seller: ${sellerId}`)

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for batch retrieval")
    }

    return this.retryOperation(async () => {
      try {
        // Check cache first but with validation
        this.log("DEBUG", "Checking cache for existing products", { sellerId })

        const cachedProducts = await this.migrationCache.getCachedProducts(sellerId)

        if (cachedProducts && cachedProducts.length > 0) {
          this.log("INFO", "Using cached products for first batch", {
            sellerId,
            totalCachedProducts: cachedProducts.length,
            cacheHit: true,
          })

          // Validate cached data
          const validProducts = cachedProducts.filter((p) => p.id && p.seller_id === sellerId)
          if (validProducts.length !== cachedProducts.length) {
            this.log("WARN", "Some cached products are invalid", {
              totalCached: cachedProducts.length,
              validProducts: validProducts.length,
              invalidProducts: cachedProducts.length - validProducts.length,
            })
          }

          const firstBatch = validProducts.slice(0, PRODUCTS_PER_BATCH)
          let hasMore = validProducts.length > PRODUCTS_PER_BATCH

          // For cached results, we need to fetch the lastDoc cursor if there are more batches
          let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined = undefined

          if (hasMore && firstBatch.length > 0) {
            try {
              // Get the actual document reference for the last product in the batch
              const lastProductId = firstBatch[firstBatch.length - 1].id
              const lastDocRef = doc(db, "products", lastProductId)
              const lastDocSnapshot = await getDoc(lastDocRef)

              if (lastDocSnapshot.exists()) {
                lastDoc = lastDocSnapshot as QueryDocumentSnapshot<DocumentData>
                this.log("DEBUG", "Retrieved lastDoc cursor for cached batch", {
                  lastDocId: lastDoc.id,
                })
              } else {
                this.log("WARN", "Could not retrieve lastDoc for cached batch - falling back to Firestore query")
                // Fall back to fresh Firestore query to ensure proper pagination
                const productsQuery = query(
                  collection(db, "products"),
                  where("seller_id", "==", sellerId),
                  orderBy("__name__"),
                  limit(PRODUCTS_PER_BATCH),
                )
                const snapshot = await getDocs(productsQuery)
                if (!snapshot.empty) {
                  lastDoc = snapshot.docs[snapshot.docs.length - 1]
                }
              }
            } catch (error) {
              this.log("ERROR", "Failed to get lastDoc cursor for cached batch", {
                error: error instanceof Error ? error.message : String(error),
              })
              // Continue without lastDoc - hasMore will be set to false to prevent pagination issues
              hasMore = false
            }
          }

          const batch: PaginatedProductBatch = {
            products: firstBatch,
            hasMore: hasMore && !!lastDoc, // Only set hasMore if we have a valid cursor
            lastDoc,
            batchNumber: 1,
            totalProcessed: firstBatch.length,
            debugInfo: {
              queryUsed: "CACHE_HIT_WITH_CURSOR",
              docsReturned: firstBatch.length,
              lastDocId: lastDoc?.id,
              timestamp: new Date().toISOString(),
            },
          }

          this.log("INFO", "First batch created from cache with cursor", {
            batchSize: firstBatch.length,
            hasMore: batch.hasMore,
            totalAvailable: validProducts.length,
            lastDocId: lastDoc?.id,
          })

          return batch
        }

        // Cache miss - fetch from Firestore with enhanced pagination
        this.log("INFO", "Cache miss - fetching first batch from Firestore", { sellerId })

        const productsQuery = query(
          collection(db, "products"),
          where("seller_id", "==", sellerId),
          orderBy("__name__"),
          limit(PRODUCTS_PER_BATCH),
        )

        this.log("DEBUG", "Executing first batch query", {
          sellerId,
          batchSize: PRODUCTS_PER_BATCH,
          queryConstraints: [`seller_id == ${sellerId}`, "orderBy __name__", `limit ${PRODUCTS_PER_BATCH}`],
        })

        const snapshot = await getDocs(productsQuery)

        this.log("INFO", "First batch query completed", {
          docsReturned: snapshot.size,
          isEmpty: snapshot.empty,
          queryExecutionTime: Date.now(),
        })

        if (snapshot.empty) {
          this.log("WARN", "No products found for seller", { sellerId })
          throw new Error(`No products found for seller_id: ${sellerId}`)
        }

        const products = snapshot.docs.map((doc, index) => {
          const data = doc.data()
          const product = {
            id: doc.id,
            seller_id: data.seller_id,
            company_id: data.company_id,
            name: data.name,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
          } as ProductRecord

          this.log("DEBUG", `First batch product ${index + 1}`, {
            id: product.id,
            name: product.name,
            has_company_id: !!product.company_id,
          })

          return product
        })

        const lastDoc = snapshot.docs[snapshot.docs.length - 1]
        const hasMore = snapshot.docs.length === PRODUCTS_PER_BATCH

        const batch: PaginatedProductBatch = {
          products,
          hasMore,
          lastDoc,
          batchNumber: 1,
          totalProcessed: products.length,
          querySnapshot: snapshot,
          debugInfo: {
            queryUsed: "FIRESTORE_FIRST_BATCH",
            docsReturned: products.length,
            lastDocId: lastDoc?.id,
            timestamp: new Date().toISOString(),
          },
        }

        this.log("INFO", "First batch created successfully", {
          batchSize: products.length,
          hasMore,
          lastDocId: lastDoc?.id,
          totalProcessed: products.length,
        })

        return batch
      } catch (error) {
        this.log("ERROR", "First batch retrieval failed", {
          sellerId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "getFirstProductBatch")
  }

  // Enhanced next batch retrieval with proper cursor management
  async getNextProductBatch(
    sellerId: string,
    lastDoc: QueryDocumentSnapshot<DocumentData>,
    batchNumber: number,
    totalProcessed: number,
  ): Promise<PaginatedProductBatch> {
    this.log("INFO", `Starting enhanced next batch retrieval`, {
      sellerId,
      batchNumber,
      totalProcessed,
      lastDocId: lastDoc?.id,
    })

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for next batch retrieval")
    }

    if (!lastDoc) {
      throw new Error("No lastDoc provided for pagination - cannot retrieve next batch")
    }

    return this.retryOperation(async () => {
      try {
        this.log("DEBUG", "Constructing next batch query", {
          sellerId,
          batchNumber,
          lastDocId: lastDoc.id,
          lastDocPath: lastDoc.ref.path,
        })

        const productsQuery = query(
          collection(db, "products"),
          where("seller_id", "==", sellerId),
          orderBy("__name__"),
          startAfter(lastDoc),
          limit(PRODUCTS_PER_BATCH),
        )

        this.log("DEBUG", "Executing next batch query", {
          sellerId,
          batchNumber,
          batchSize: PRODUCTS_PER_BATCH,
          queryConstraints: [
            `seller_id == ${sellerId}`,
            "orderBy __name__",
            `startAfter ${lastDoc.id}`,
            `limit ${PRODUCTS_PER_BATCH}`,
          ],
        })

        const snapshot = await getDocs(productsQuery)

        this.log("INFO", "Next batch query completed", {
          batchNumber,
          docsReturned: snapshot.size,
          isEmpty: snapshot.empty,
          queryExecutionTime: Date.now(),
        })

        const products = snapshot.docs.map((doc, index) => {
          const data = doc.data()
          const product = {
            id: doc.id,
            seller_id: data.seller_id,
            company_id: data.company_id,
            name: data.name,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
          } as ProductRecord

          this.log("DEBUG", `Next batch product ${index + 1}`, {
            batchNumber,
            id: product.id,
            name: product.name,
            has_company_id: !!product.company_id,
          })

          return product
        })

        const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
        const hasMore = snapshot.docs.length === PRODUCTS_PER_BATCH

        const batch: PaginatedProductBatch = {
          products,
          hasMore,
          lastDoc: newLastDoc || undefined,
          batchNumber,
          totalProcessed: totalProcessed + products.length,
          querySnapshot: snapshot,
          debugInfo: {
            queryUsed: "FIRESTORE_NEXT_BATCH",
            docsReturned: products.length,
            lastDocId: newLastDoc?.id,
            timestamp: new Date().toISOString(),
          },
        }

        this.log("INFO", "Next batch created successfully", {
          batchNumber,
          batchSize: products.length,
          hasMore,
          newLastDocId: newLastDoc?.id,
          totalProcessed: batch.totalProcessed,
        })

        return batch
      } catch (error) {
        this.log("ERROR", "Next batch retrieval failed", {
          sellerId,
          batchNumber,
          lastDocId: lastDoc?.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "getNextProductBatch")
  }

  // Enhanced product batch update with integrity checks
  async updateProductBatch(
    products: ProductRecord[],
    companyId: string,
    sellerId: string,
    batchNumber: number,
  ): Promise<{ updated: number; skipped: number; errors: number }> {
    this.log("INFO", `Starting enhanced batch update`, {
      batchNumber,
      totalProducts: products.length,
      companyId,
      sellerId,
    })

    if (!products || products.length === 0) {
      this.log("WARN", "No products provided for batch update", { batchNumber })
      return { updated: 0, skipped: 0, errors: 0 }
    }

    if (!companyId || companyId.trim() === "") {
      throw new Error("Invalid company_id provided for batch update")
    }

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for batch update")
    }

    return this.retryOperation(async () => {
      try {
        // Pre-filter and validate products
        const productsToUpdate = products.filter((product) => {
          const needsUpdate = !product.company_id || product.company_id === null || product.company_id === ""
          const isValid = product.id && product.seller_id === sellerId

          this.log("DEBUG", `Product validation`, {
            batchNumber,
            productId: product.id,
            needsUpdate,
            isValid,
            currentCompanyId: product.company_id,
          })

          return needsUpdate && isValid
        })

        const skippedCount = products.length - productsToUpdate.length

        this.log("INFO", "Batch update pre-filtering completed", {
          batchNumber,
          totalProducts: products.length,
          productsToUpdate: productsToUpdate.length,
          skippedCount,
          filterReason: "already has company_id or invalid data",
        })

        if (productsToUpdate.length === 0) {
          this.log("WARN", "No products require updating in this batch", { batchNumber })
          return { updated: 0, skipped: skippedCount, errors: 0 }
        }

        let updatedCount = 0
        let errorCount = 0

        const batch = writeBatch(db)
        const updateTimestamp = new Date()

        const updateData = {
          company_id: companyId,
          updated_at: updateTimestamp,
          migration_source: "enhanced_paginated_migration_v2",
          migration_timestamp: updateTimestamp.toISOString(),
          migration_seller_id: sellerId,
          migration_batch: batchNumber,
          migration_id: this.migrationState?.migrationId || "unknown",
        }

        this.log("DEBUG", "Preparing batch write operation", {
          batchNumber,
          updateData,
          productsToUpdate: productsToUpdate.length,
        })

        for (const product of productsToUpdate) {
          try {
            if (!product.id) {
              throw new Error("Product missing ID")
            }

            const productRef = doc(db, "products", product.id)
            batch.update(productRef, updateData)

            this.log("DEBUG", "Added product to batch write", {
              batchNumber,
              productId: product.id,
              productName: product.name,
            })
          } catch (err) {
            this.log("ERROR", "Error adding product to batch write", {
              batchNumber,
              productId: product.id,
              error: err instanceof Error ? err.message : String(err),
            })
            errorCount++
          }
        }

        if (productsToUpdate.length - errorCount > 0) {
          this.log("DEBUG", "Committing batch write", {
            batchNumber,
            productsInBatch: productsToUpdate.length - errorCount,
          })

          await batch.commit()
          updatedCount = productsToUpdate.length - errorCount

          this.log("INFO", "Batch write committed successfully", {
            batchNumber,
            updatedCount,
            commitTimestamp: new Date().toISOString(),
          })

          // Invalidate cache after successful update
          this.migrationCache.invalidateAfterUpdate(sellerId, "PRODUCT")
          this.log("DEBUG", "Cache invalidated after batch update", {
            batchNumber,
            sellerId,
          })
        } else {
          this.log("WARN", "No products to commit in batch", {
            batchNumber,
            totalErrors: errorCount,
          })
        }

        const result = { updated: updatedCount, skipped: skippedCount, errors: errorCount }

        this.log("INFO", "Batch update completed", {
          batchNumber,
          result,
          completionTimestamp: new Date().toISOString(),
        })

        return result
      } catch (error) {
        this.log("ERROR", "Batch update failed", {
          batchNumber,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "updateProductBatch")
  }

  // Enhanced migration initialization with dynamic alternative selection
  async initializeMigration(): Promise<PaginatedMigrationResult> {
    if (this.isInitializing) {
      this.log("WARN", "Migration initialization already in progress")
      throw new Error("Migration initialization already in progress")
    }

    this.isInitializing = true
    this.log("INFO", "Starting enhanced migration initialization with dynamic alternative selection")

    try {
      // Generate unique migration ID
      const migrationId = `migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const startTime = new Date().toISOString()

      this.log("INFO", "Generated migration session", {
        migrationId,
        startTime,
      })

      // Clear any existing state and cache
      this.reset()
      this.log("DEBUG", "Previous state cleared")

      // First, check overall migration eligibility
      this.log("DEBUG", "Step 0: Checking migration eligibility")
      const eligibilityCheck = await this.checkMigrationEligibility()

      if (!eligibilityCheck.hasEligibleProducts) {
        this.log("INFO", "No eligible products found - creating completed migration state", {
          stats: eligibilityCheck.stats,
        })

        // Create a completed migration result for when no products need migration
        const emptyBatch = this.createEmptyBatch()
        const migrationResult: PaginatedMigrationResult = {
          selectedEntry: null,
          userRecord: null,
          extractedCompanyId: null,
          currentBatch: emptyBatch,
          allBatches: [emptyBatch],
          totalUpdated: 0,
          totalSkipped: 0,
          totalErrors: 0,
          isComplete: true,
          migrationComplete: true,
          noEligibleProducts: true,
          migrationId,
          startTime,
          debugInfo: {
            initializationAttempts: 1,
            batchLoadAttempts: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: [],
            eligibilityStats: eligibilityCheck.stats,
          },
        }

        this.migrationState = migrationResult

        // Notify progress as complete
        this.notifyProgress({
          currentBatch: 1,
          totalBatches: 1,
          processedProducts: 0,
          remainingProducts: 0,
          estimatedTotal: 0,
          progressPercentage: 100,
          migrationId,
        })

        this.log("INFO", "Migration initialization completed - no eligible products", {
          migrationId,
          eligibilityStats: eligibilityCheck.stats,
        })

        return migrationResult
      }

      // Step 1: Enhanced product selection with dynamic alternatives
      this.log("DEBUG", "Step 1: Dynamic product selection with alternative fallback")
      let selectedEntry: ProductRecord | null = null
      let userRecord: UserRecord | null = null
      let selectionAttempts = 0
      const processedSellerIds = new Set<string>()
      const processedProductIds = new Set<string>()

      while (!selectedEntry && selectionAttempts < MAX_SELECTION_ATTEMPTS) {
        selectionAttempts++
        this.log("DEBUG", `Dynamic selection attempt ${selectionAttempts}/${MAX_SELECTION_ATTEMPTS}`)

        try {
          // Try to select a random product
          const candidateProduct = await this.selectRandomProductEntry()

          if (!candidateProduct) {
            this.log("WARN", `No candidate product found in attempt ${selectionAttempts}`)
            continue
          }

          // Check if we've already processed this product or seller
          if (processedProductIds.has(candidateProduct.id)) {
            this.log("DEBUG", "Product already processed, finding alternative", {
              productId: candidateProduct.id,
              sellerId: candidateProduct.seller_id,
            })

            // Try to find alternative product for the same seller
            const alternativeProduct = await this.findAlternativeProductForSeller(
              candidateProduct.seller_id,
              Array.from(processedProductIds),
            )

            if (alternativeProduct) {
              candidateProduct.id = alternativeProduct.id
              candidateProduct.name = alternativeProduct.name
              candidateProduct.status = alternativeProduct.status
              this.log("INFO", "Using alternative product for seller", {
                originalProductId: candidateProduct.id,
                alternativeProductId: alternativeProduct.id,
                sellerId: candidateProduct.seller_id,
              })
            }
          }

          // Validate the candidate product's seller
          this.log("DEBUG", "Validating candidate product seller", {
            productId: candidateProduct.id,
            sellerId: candidateProduct.seller_id,
          })

          const candidateUserRecord = await this.getUserCompanyId(candidateProduct.seller_id)

          if (!candidateUserRecord) {
            this.log("WARN", `No user record found for seller ${candidateProduct.seller_id}`)
            processedSellerIds.add(candidateProduct.seller_id)
            processedProductIds.add(candidateProduct.id)
            continue
          }

          if (!candidateUserRecord.company_id || candidateUserRecord.company_id.trim() === "") {
            this.log("WARN", `Seller ${candidateProduct.seller_id} has no company_id`)
            processedSellerIds.add(candidateProduct.seller_id)
            processedProductIds.add(candidateProduct.id)
            continue
          }

          // Success! We found a valid product and seller
          selectedEntry = candidateProduct
          userRecord = candidateUserRecord

          this.log("INFO", "Valid product and seller found", {
            attempt: selectionAttempts,
            productId: selectedEntry.id,
            sellerId: selectedEntry.seller_id,
            companyId: userRecord.company_id,
            totalProcessedSellers: processedSellerIds.size,
            totalProcessedProducts: processedProductIds.size,
          })
        } catch (error) {
          this.log("WARN", `Selection attempt ${selectionAttempts} failed`, {
            error: error instanceof Error ? error.message : String(error),
          })

          if (selectionAttempts >= MAX_SELECTION_ATTEMPTS) {
            // If we can't find eligible products after many attempts, create a completed migration
            this.log("INFO", "Max selection attempts reached - creating completed migration state")

            const emptyBatch = this.createEmptyBatch()
            const migrationResult: PaginatedMigrationResult = {
              selectedEntry: null,
              userRecord: null,
              extractedCompanyId: null,
              currentBatch: emptyBatch,
              allBatches: [emptyBatch],
              totalUpdated: 0,
              totalSkipped: 0,
              totalErrors: 0,
              isComplete: true,
              migrationComplete: true,
              noEligibleProducts: true,
              migrationId,
              startTime,
              debugInfo: {
                initializationAttempts: selectionAttempts,
                batchLoadAttempts: 0,
                cacheHits: 0,
                cacheMisses: 0,
                errors: [],
                eligibilityStats: eligibilityCheck.stats,
              },
            }

            this.migrationState = migrationResult

            this.notifyProgress({
              currentBatch: 1,
              totalBatches: 1,
              processedProducts: 0,
              remainingProducts: 0,
              estimatedTotal: 0,
              progressPercentage: 100,
              migrationId,
            })

            return migrationResult
          }

          // Wait before retry with exponential backoff
          const delay = 1000 * selectionAttempts
          this.log("DEBUG", `Waiting ${delay}ms before retry`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }

      if (!selectedEntry || !userRecord) {
        throw new Error("Failed to find valid product and seller after dynamic selection attempts")
      }

      // Step 3: Get first batch with proper pagination setup
      this.log("DEBUG", "Step 3: Getting first product batch")
      const firstBatch = await this.getFirstProductBatch(selectedEntry.seller_id)

      // Create migration result with enhanced debugging
      const migrationResult: PaginatedMigrationResult = {
        selectedEntry,
        userRecord,
        extractedCompanyId: userRecord.company_id,
        currentBatch: firstBatch,
        allBatches: [firstBatch],
        totalUpdated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        isComplete: !firstBatch.hasMore,
        migrationId,
        startTime,
        debugInfo: {
          initializationAttempts: selectionAttempts,
          batchLoadAttempts: 0,
          cacheHits: 0,
          cacheMisses: 0,
          errors: [],
          eligibilityStats: eligibilityCheck.stats,
        },
      }

      this.migrationState = migrationResult

      // Notify progress with detailed information
      this.notifyProgress({
        currentBatch: 1,
        totalBatches: firstBatch.hasMore ? -1 : 1,
        processedProducts: firstBatch.products.length,
        remainingProducts: firstBatch.hasMore ? -1 : 0,
        estimatedTotal: firstBatch.hasMore ? -1 : firstBatch.products.length,
        progressPercentage: firstBatch.hasMore ? 0 : 100,
        migrationId,
      })

      this.log("INFO", "Migration initialization completed successfully with dynamic selection", {
        migrationId,
        sellerId: selectedEntry.seller_id,
        companyId: userRecord.company_id,
        firstBatchSize: firstBatch.products.length,
        hasMoreBatches: firstBatch.hasMore,
        isComplete: migrationResult.isComplete,
        selectionAttempts,
        eligibilityStats: eligibilityCheck.stats,
      })

      return migrationResult
    } catch (error) {
      this.log("ERROR", "Migration initialization failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  // Enhanced load next batch with proper state validation
  async loadNextBatch(): Promise<boolean> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized - cannot load next batch")
    }

    if (this.isLoadingBatch) {
      this.log("WARN", "Batch loading already in progress")
      throw new Error("Batch loading already in progress")
    }

    this.isLoadingBatch = true

    try {
      const { currentBatch, selectedEntry, migrationId } = this.migrationState

      this.log("INFO", "Starting enhanced next batch loading", {
        migrationId,
        currentBatchNumber: currentBatch.batchNumber,
        hasMore: currentBatch.hasMore,
        lastDocId: currentBatch.lastDoc?.id,
      })

      // Validate current state
      if (!currentBatch.hasMore) {
        this.log("INFO", "No more batches to load - migration complete", { migrationId })
        this.migrationState.isComplete = true
        return false
      }

      if (!currentBatch.lastDoc) {
        this.log("ERROR", "Cannot load next batch - no lastDoc cursor available", {
          migrationId,
          currentBatchNumber: currentBatch.batchNumber,
          batchHasMore: currentBatch.hasMore,
          debugInfo: currentBatch.debugInfo,
        })

        // Try to recover by re-fetching the current batch with proper cursor
        this.log("INFO", "Attempting to recover by re-fetching current batch")
        try {
          const recoveryBatch = await this.getFirstProductBatch(selectedEntry.seller_id)
          if (recoveryBatch.lastDoc) {
            this.migrationState.currentBatch = recoveryBatch
            this.log("INFO", "Successfully recovered batch with cursor", {
              lastDocId: recoveryBatch.lastDoc.id,
            })
            // Don't return here, continue with the recovery batch
          } else {
            this.log("ERROR", "Recovery failed - no cursor available")
            this.migrationState.isComplete = true
            return false
          }
        } catch (recoveryError) {
          this.log("ERROR", "Recovery attempt failed", {
            error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          })
          this.migrationState.isComplete = true
          return false
        }
      }

      if (!selectedEntry) {
        throw new Error("Cannot load next batch - no selected entry available")
      }

      // Increment batch load attempts
      if (this.migrationState.debugInfo) {
        this.migrationState.debugInfo.batchLoadAttempts++
      }

      this.log("DEBUG", "Loading next batch with cursor", {
        migrationId,
        sellerId: selectedEntry.seller_id,
        currentBatchNumber: currentBatch.batchNumber,
        nextBatchNumber: currentBatch.batchNumber + 1,
        lastDocId: currentBatch.lastDoc.id,
        totalProcessed: currentBatch.totalProcessed,
      })

      const nextBatch = await this.getNextProductBatch(
        selectedEntry.seller_id,
        currentBatch.lastDoc,
        currentBatch.batchNumber + 1,
        currentBatch.totalProcessed,
      )

      // Update migration state with validation
      this.migrationState.currentBatch = nextBatch
      this.migrationState.allBatches.push(nextBatch)
      this.migrationState.isComplete = !nextBatch.hasMore

      this.log("INFO", "Next batch loaded successfully", {
        migrationId,
        batchNumber: nextBatch.batchNumber,
        batchSize: nextBatch.products.length,
        hasMore: nextBatch.hasMore,
        totalProcessed: nextBatch.totalProcessed,
        isComplete: this.migrationState.isComplete,
      })

      // Notify progress with updated information
      const totalProcessed = this.migrationState.allBatches.reduce((sum, batch) => sum + batch.products.length, 0)
      this.notifyProgress({
        currentBatch: nextBatch.batchNumber,
        totalBatches: nextBatch.hasMore ? -1 : nextBatch.batchNumber,
        processedProducts: totalProcessed,
        remainingProducts: nextBatch.hasMore ? -1 : 0,
        estimatedTotal: nextBatch.hasMore ? -1 : totalProcessed,
        progressPercentage: nextBatch.hasMore ? 0 : 100,
        migrationId,
      })

      return true
    } catch (error) {
      this.log("ERROR", "Failed to load next batch", {
        migrationId: this.migrationState?.migrationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    } finally {
      this.isLoadingBatch = false
    }
  }

  // State validation helper
  private validateMigrationState(operation: string): void {
    if (!this.migrationState) {
      throw new Error(`Migration not initialized - cannot ${operation}`)
    }

    if (!this.migrationState.extractedCompanyId || this.migrationState.extractedCompanyId.trim() === "") {
      throw new Error(`Migration missing or invalid company_id - cannot ${operation}`)
    }

    if (!this.migrationState.selectedEntry) {
      throw new Error(`Migration missing selected entry - cannot ${operation}`)
    }

    if (this.migrationState.noEligibleProducts || this.migrationState.migrationComplete) {
      this.log("INFO", `Migration already complete - skipping ${operation}`, {
        noEligibleProducts: this.migrationState.noEligibleProducts,
        migrationComplete: this.migrationState.migrationComplete,
      })
      return
    }
  }

  // Enhanced process current batch with validation
  async processCurrentBatch(): Promise<void> {
    this.log("DEBUG", "Starting processCurrentBatch with state validation")

    if (!this.migrationState) {
      const error = "Migration not initialized - cannot process batch"
      this.log("ERROR", error)
      throw new Error(error)
    }

    if (!this.migrationState.extractedCompanyId || this.migrationState.extractedCompanyId.trim() === "") {
      const error = "Migration missing or invalid company_id - cannot process batch"
      this.log("ERROR", error, {
        hasExtractedCompanyId: !!this.migrationState.extractedCompanyId,
        extractedCompanyId: this.migrationState.extractedCompanyId,
      })
      throw new Error(error)
    }

    if (!this.migrationState.selectedEntry) {
      const error = "Migration missing selected entry - cannot process batch"
      this.log("ERROR", error)
      throw new Error(error)
    }

    if (!this.migrationState.currentBatch) {
      const error = "Migration missing current batch - cannot process batch"
      this.log("ERROR", error)
      throw new Error(error)
    }

    // Check if migration is already complete
    if (this.migrationState.noEligibleProducts || this.migrationState.migrationComplete) {
      this.log("INFO", "Migration already complete - no batch processing needed", {
        noEligibleProducts: this.migrationState.noEligibleProducts,
        migrationComplete: this.migrationState.migrationComplete,
      })
      return
    }

    const { currentBatch, extractedCompanyId, selectedEntry, migrationId } = this.migrationState

    this.log("INFO", "Starting enhanced current batch processing", {
      migrationId,
      batchNumber: currentBatch.batchNumber,
      batchSize: currentBatch.products.length,
      companyId: extractedCompanyId,
      sellerId: selectedEntry.seller_id,
    })

    try {
      const updateResults = await this.updateProductBatch(
        currentBatch.products,
        extractedCompanyId,
        selectedEntry.seller_id,
        currentBatch.batchNumber,
      )

      // Update totals with validation
      this.migrationState.totalUpdated += updateResults.updated
      this.migrationState.totalSkipped += updateResults.skipped
      this.migrationState.totalErrors += updateResults.errors

      this.log("INFO", "Current batch processed successfully", {
        migrationId,
        batchNumber: currentBatch.batchNumber,
        batchResults: updateResults,
        runningTotals: {
          totalUpdated: this.migrationState.totalUpdated,
          totalSkipped: this.migrationState.totalSkipped,
          totalErrors: this.migrationState.totalErrors,
        },
      })
    } catch (error) {
      this.log("ERROR", "Failed to process current batch", {
        migrationId,
        batchNumber: currentBatch.batchNumber,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // Enhanced process all batches with comprehensive error handling
  async processAllBatches(
    onBatchComplete?: (batchNumber: number, results: { updated: number; skipped: number; errors: number }) => void,
  ): Promise<void> {
    this.log("DEBUG", "Starting processAllBatches with state validation")

    if (!this.migrationState) {
      const error = "Migration not initialized - cannot process batches"
      this.log("ERROR", error)
      throw new Error(error)
    }

    if (!this.migrationState.extractedCompanyId || this.migrationState.extractedCompanyId.trim() === "") {
      const error = "Migration missing or invalid company_id - cannot process batches"
      this.log("ERROR", error, {
        hasExtractedCompanyId: !!this.migrationState.extractedCompanyId,
        extractedCompanyId: this.migrationState.extractedCompanyId,
      })
      throw new Error(error)
    }

    if (!this.migrationState.selectedEntry) {
      const error = "Migration missing selected entry - cannot process batches"
      this.log("ERROR", error)
      throw new Error(error)
    }

    const { migrationId } = this.migrationState

    this.log("INFO", "Starting enhanced process all batches", { migrationId })

    try {
      // Check if migration is already complete (no eligible products)
      if (this.migrationState.noEligibleProducts || this.migrationState.migrationComplete) {
        this.log("INFO", "Migration already complete - no products to process", {
          migrationId,
          noEligibleProducts: this.migrationState.noEligibleProducts,
          migrationComplete: this.migrationState.migrationComplete,
        })
        return
      }

      // Process current batch first
      await this.processCurrentBatch()

      if (onBatchComplete) {
        onBatchComplete(this.migrationState.currentBatch.batchNumber, {
          updated: this.migrationState.totalUpdated,
          skipped: this.migrationState.totalSkipped,
          errors: this.migrationState.totalErrors,
        })
      }

      // Continue with remaining batches
      let batchCount = 1
      while (!this.migrationState.isComplete) {
        this.log("DEBUG", "Processing batch sequence", {
          migrationId,
          batchCount,
          currentBatch: this.migrationState.currentBatch.batchNumber,
          hasMore: this.migrationState.currentBatch.hasMore,
          hasLastDoc: !!this.migrationState.currentBatch.lastDoc,
        })

        try {
          const hasMore = await this.loadNextBatch()
          if (!hasMore) {
            this.log("INFO", "No more batches to process", { migrationId, totalBatches: batchCount })
            break
          }

          await this.processCurrentBatch()
          batchCount++

          if (onBatchComplete) {
            onBatchComplete(this.migrationState.currentBatch.batchNumber, {
              updated: this.migrationState.totalUpdated,
              skipped: this.migrationState.totalSkipped,
              errors: this.migrationState.totalErrors,
            })
          }
        } catch (error) {
          this.log("ERROR", "Error in batch processing sequence", {
            migrationId,
            batchCount,
            currentBatch: this.migrationState.currentBatch.batchNumber,
            error: error instanceof Error ? error.message : String(error),
          })

          // If it's a cursor issue, try to complete gracefully
          if (error instanceof Error && error.message.includes("pagination cursor")) {
            this.log("INFO", "Cursor issue detected - completing migration gracefully", {
              migrationId,
              processedBatches: batchCount,
            })
            this.migrationState.isComplete = true
            break
          }

          // For other errors, re-throw
          throw error
        }

        // Safety check to prevent infinite loops
        if (batchCount > 1000) {
          this.log("ERROR", "Safety limit reached - stopping batch processing", {
            migrationId,
            batchCount,
          })
          throw new Error("Safety limit reached - too many batches processed")
        }
      }

      this.log("INFO", "All batches processed successfully", {
        migrationId,
        totalBatches: batchCount,
        finalTotals: {
          totalUpdated: this.migrationState.totalUpdated,
          totalSkipped: this.migrationState.totalSkipped,
          totalErrors: this.migrationState.totalErrors,
        },
      })
    } catch (error) {
      this.log("ERROR", "Failed to process all batches", {
        migrationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // Get current migration state with validation
  getMigrationState(): PaginatedMigrationResult | null {
    return this.migrationState
  }

  // Enhanced reset with proper cleanup
  reset(): void {
    const previousMigrationId = this.migrationState?.migrationId

    this.log("INFO", "Resetting migration state", { previousMigrationId })

    this.migrationState = null
    this.progressCallbacks.clear()
    this.isInitializing = false
    this.isLoadingBatch = false

    // Clear any relevant caches using the correct method name
    this.migrationCache.clear()

    this.log("INFO", "Migration state reset completed", { previousMigrationId })
  }

  // Enhanced migration summary with detailed information
  getMigrationSummary(): {
    migrationId: string
    startTime: string
    totalBatches: number
    totalProducts: number
    totalUpdated: number
    totalSkipped: number
    totalErrors: number
    isComplete: boolean
    noEligibleProducts?: boolean
    debugInfo?: any
  } | null {
    if (!this.migrationState) return null

    const totalProducts = this.migrationState.allBatches.reduce((sum, batch) => sum + batch.products.length, 0)

    return {
      migrationId: this.migrationState.migrationId,
      startTime: this.migrationState.startTime,
      totalBatches: this.migrationState.allBatches.length,
      totalProducts,
      totalUpdated: this.migrationState.totalUpdated,
      totalSkipped: this.migrationState.totalSkipped,
      totalErrors: this.migrationState.totalErrors,
      isComplete: this.migrationState.isComplete,
      noEligibleProducts: this.migrationState.noEligibleProducts,
      debugInfo: this.migrationState.debugInfo,
    }
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    this.log("INFO", `Debug mode ${enabled ? "enabled" : "disabled"}`)
  }

  // Get detailed debug information
  getDebugInfo(): any {
    return {
      migrationState: this.migrationState,
      isInitializing: this.isInitializing,
      isLoadingBatch: this.isLoadingBatch,
      progressCallbackCount: this.progressCallbacks.size,
      debugMode: this.debugMode,
    }
  }
}

// Export singleton instance
export const paginatedMigrationService = new PaginatedMigrationService(migrationCache)
