import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  writeBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import { migrationCache } from "@/lib/migration-cache-manager"

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

export interface PriorityStats {
  priorityProducts: number
  standardProducts: number
  usersWithoutCompanyId: number
  usersWithCompanyId: number
  totalProductsAnalyzed: number
  prioritySelectionRate: number
}

export interface EnhancedPrioritizedMigrationState {
  migrationId: string
  startTime: string
  selectedProduct: ProductRecord | null
  selectedUser: UserRecord | null
  extractedCompanyId: string | null
  currentBatch: ProductRecord[]
  currentBatchNumber: number
  batchRange: string // e.g., "1-20", "21-40", "41-60"
  hasMoreBatches: boolean
  lastDoc?: QueryDocumentSnapshot<DocumentData>
  totalProcessed: number
  totalUpdated: number
  totalSkipped: number
  totalErrors: number
  selectionAttempts: number
  isPriorityProduct: boolean
  priorityStats?: PriorityStats
  noEligibleProducts?: boolean
  eligibilityStats?: {
    totalProductsChecked: number
    productsWithCompanyId: number
    productsWithoutSellerId: number
    sellersWithoutCompanyId: number
    eligibleProducts: number
  }
  sortingStats?: {
    totalProductsSorted: number
    priorityProductsFound: number
    standardProductsFound: number
    sortingDuration: number
  }
}

const PRODUCTS_PER_BATCH = 20 // Changed from 10 to 20
const MAX_SELECTION_ATTEMPTS = 30 // Increased for better coverage
const MAX_INITIAL_SAMPLE = 500 // Increased sample size
const PRIORITY_SAMPLE_SIZE = 200 // Increased priority sample
const MAX_SORTING_SAMPLE = 1000 // Maximum products to analyze for sorting

export class EnhancedPrioritizedProductMigrationService {
  private migrationState: EnhancedPrioritizedMigrationState | null = null
  private debugMode = true
  private priorityProductIds: Set<string> = new Set()
  private standardProductIds: Set<string> = new Set()
  private userCompanyIdCache: Map<string, string | null> = new Map()
  private sortedProductsList: ProductRecord[] = []

  constructor() {}

  private log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${level}] [EnhancedPrioritizedProductMigrationService] ${message}`

    if (this.debugMode) {
      if (data) {
        console.log(logMessage, data)
      } else {
        console.log(logMessage)
      }
    }
  }

  // Generate batch range string (1-20, 21-40, etc.)
  private generateBatchRange(batchNumber: number): string {
    const start = (batchNumber - 1) * PRODUCTS_PER_BATCH + 1
    const end = batchNumber * PRODUCTS_PER_BATCH
    return `${start}-${end}`
  }

  // Enhanced product sorting with company_id prioritization
  async sortProductsByUserPriority(): Promise<PriorityStats> {
    this.log("INFO", "Starting enhanced product sorting by company_id priority")
    const sortingStartTime = Date.now()

    const priorityStats: PriorityStats = {
      priorityProducts: 0,
      standardProducts: 0,
      usersWithoutCompanyId: 0,
      usersWithCompanyId: 0,
      totalProductsAnalyzed: 0,
      prioritySelectionRate: 0,
    }

    try {
      // Clear previous data
      this.priorityProductIds.clear()
      this.standardProductIds.clear()
      this.userCompanyIdCache.clear()
      this.sortedProductsList = []

      // Step 1: Get products WITHOUT company_id first (highest priority)
      this.log("INFO", "Fetching products without company_id (highest priority)")
      const productsWithoutCompanyIdQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        where("company_id", "==", null), // Products without company_id
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(Math.floor(MAX_SORTING_SAMPLE * 0.7)), // 70% of sample for priority products
      )

      const productsWithoutCompanyIdSnapshot = await getDocs(productsWithoutCompanyIdQuery)

      // Step 2: Get products WITH company_id (lower priority)
      this.log("INFO", "Fetching products with company_id (lower priority)")
      const productsWithCompanyIdQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        where("company_id", "!=", null), // Products with company_id
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(Math.floor(MAX_SORTING_SAMPLE * 0.3)), // 30% of sample for standard products
      )

      const productsWithCompanyIdSnapshot = await getDocs(productsWithCompanyIdQuery)

      // Combine results with priority products first
      const allProductDocs = [...productsWithoutCompanyIdSnapshot.docs, ...productsWithCompanyIdSnapshot.docs]

      priorityStats.totalProductsAnalyzed = allProductDocs.length

      if (allProductDocs.length === 0) {
        this.log("WARN", "No products found for enhanced sorting")
        return priorityStats
      }

      const allProducts = allProductDocs.map((doc) => {
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

      this.log("INFO", "Analyzing products for enhanced priority classification", {
        totalProducts: allProducts.length,
        productsWithoutCompanyId: productsWithoutCompanyIdSnapshot.size,
        productsWithCompanyId: productsWithCompanyIdSnapshot.size,
        analysisTarget: MAX_SORTING_SAMPLE,
      })

      // Step 3: Validate sellers for products without company_id (priority products)
      const priorityProducts: ProductRecord[] = []
      const standardProducts: ProductRecord[] = []
      const processedUsers = new Set<string>()

      // Process products without company_id first (these are automatically priority)
      const productsWithoutCompanyId = allProducts.filter((p) => !p.company_id || p.company_id.trim() === "")

      for (const product of productsWithoutCompanyId) {
        if (!product.seller_id || product.seller_id.trim() === "") {
          continue
        }

        try {
          // Check if seller has a valid company_id
          const userRecord = await migrationCache.getCachedUser(product.seller_id)

          if (!processedUsers.has(product.seller_id)) {
            processedUsers.add(product.seller_id)
            if (!userRecord?.company_id || userRecord.company_id.trim() === "") {
              priorityStats.usersWithoutCompanyId++
            } else {
              priorityStats.usersWithCompanyId++
            }
          }

          if (userRecord?.company_id && userRecord.company_id.trim() !== "") {
            // Product without company_id + User with company_id = PRIORITY for migration
            priorityProducts.push(product)
            this.priorityProductIds.add(product.id)
            priorityStats.priorityProducts++
            this.userCompanyIdCache.set(product.seller_id, userRecord.company_id)

            this.log("DEBUG", "Priority product identified", {
              productId: product.id,
              sellerId: product.seller_id,
              userCompanyId: userRecord.company_id,
              reason: "Product missing company_id, user has company_id",
            })
          } else {
            this.log("DEBUG", "Product skipped - seller has no company_id", {
              productId: product.id,
              sellerId: product.seller_id,
            })
          }
        } catch (error) {
          this.log("DEBUG", "Error validating seller for priority product", {
            productId: product.id,
            sellerId: product.seller_id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Process products with company_id (these are standard/lower priority)
      const productsWithCompanyId = allProducts.filter((p) => p.company_id && p.company_id.trim() !== "")

      for (const product of productsWithCompanyId) {
        if (!product.seller_id || product.seller_id.trim() === "") {
          continue
        }

        try {
          const userRecord = await migrationCache.getCachedUser(product.seller_id)

          if (!processedUsers.has(product.seller_id)) {
            processedUsers.add(product.seller_id)
            if (!userRecord?.company_id || userRecord.company_id.trim() === "") {
              priorityStats.usersWithoutCompanyId++
            } else {
              priorityStats.usersWithCompanyId++
            }
          }

          if (userRecord?.company_id && userRecord.company_id.trim() !== "") {
            // Product with company_id + User with company_id = STANDARD
            standardProducts.push(product)
            this.standardProductIds.add(product.id)
            priorityStats.standardProducts++
            this.userCompanyIdCache.set(product.seller_id, userRecord.company_id)

            this.log("DEBUG", "Standard product identified", {
              productId: product.id,
              sellerId: product.seller_id,
              userCompanyId: userRecord.company_id,
              reason: "Product already has company_id",
            })
          }
        } catch (error) {
          this.log("DEBUG", "Error validating seller for standard product", {
            productId: product.id,
            sellerId: product.seller_id,
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      // Create sorted list with priority products first (products without company_id)
      this.sortedProductsList = [...priorityProducts, ...standardProducts]

      // Calculate priority selection rate
      const totalCategorizedProducts = priorityStats.priorityProducts + priorityStats.standardProducts
      priorityStats.prioritySelectionRate =
        totalCategorizedProducts > 0 ? (priorityStats.priorityProducts / totalCategorizedProducts) * 100 : 0

      const sortingDuration = Date.now() - sortingStartTime

      this.log("INFO", "Enhanced product sorting completed with company_id prioritization", {
        priorityStats,
        sortingDuration: `${sortingDuration}ms`,
        sortedListSize: this.sortedProductsList.length,
        priorityProductsCount: this.priorityProductIds.size,
        standardProductsCount: this.standardProductIds.size,
        userCacheSize: this.userCompanyIdCache.size,
        sortingStrategy: "Products without company_id first, then products with company_id",
      })

      return priorityStats
    } catch (error) {
      this.log("ERROR", "Enhanced product sorting failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Enhanced prioritized product selection from company_id sorted list
  async selectFromSortedProducts(): Promise<{ product: ProductRecord; isPriority: boolean } | null> {
    this.log("INFO", "Selecting product from company_id sorted list")

    try {
      if (this.sortedProductsList.length === 0) {
        this.log("WARN", "No products in sorted list")
        return null
      }

      // Priority products are those WITHOUT company_id (first in sorted list)
      const priorityProductsInList = this.sortedProductsList.filter((p) => this.priorityProductIds.has(p.id))

      if (priorityProductsInList.length > 0) {
        const randomIndex = Math.floor(Math.random() * priorityProductsInList.length)
        const selectedProduct = priorityProductsInList[randomIndex]

        this.log("INFO", "Priority product selected (missing company_id)", {
          productId: selectedProduct.id,
          sellerId: selectedProduct.seller_id,
          productName: selectedProduct.name,
          hasCompanyId: !!selectedProduct.company_id,
          isPriority: true,
          availablePriorityProducts: priorityProductsInList.length,
          reason: "Product missing company_id - highest migration priority",
        })

        return { product: selectedProduct, isPriority: true }
      }

      // Fallback to standard products (those WITH company_id)
      const standardProductsInList = this.sortedProductsList.filter((p) => this.standardProductIds.has(p.id))

      if (standardProductsInList.length > 0) {
        const randomIndex = Math.floor(Math.random() * standardProductsInList.length)
        const selectedProduct = standardProductsInList[randomIndex]

        this.log("INFO", "Standard product selected (has company_id) - no priority products available", {
          productId: selectedProduct.id,
          sellerId: selectedProduct.seller_id,
          productName: selectedProduct.name,
          hasCompanyId: !!selectedProduct.company_id,
          isPriority: false,
          availableStandardProducts: standardProductsInList.length,
          reason: "Product already has company_id - lower migration priority",
        })

        return { product: selectedProduct, isPriority: false }
      }

      this.log("WARN", "No suitable products found in company_id sorted list")
      return null
    } catch (error) {
      this.log("ERROR", "Failed to select from company_id sorted products", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Enhanced user validation with caching
  async getUserBySellerId(sellerId: string): Promise<UserRecord | null> {
    this.log("INFO", `Getting user for seller_id: ${sellerId}`)

    if (!sellerId || sellerId.trim() === "") {
      this.log("WARN", "Invalid seller_id provided")
      return null
    }

    try {
      // Check cache first
      const cachedCompanyId = this.userCompanyIdCache.get(sellerId)
      if (cachedCompanyId !== undefined) {
        if (!cachedCompanyId || cachedCompanyId.trim() === "") {
          this.log("WARN", "User has no company_id (from cache)", { sellerId })
          return null
        }
      }

      const userRecord = await migrationCache.getCachedUser(sellerId)

      if (!userRecord) {
        this.log("WARN", "No user found for seller_id", { sellerId })
        this.userCompanyIdCache.set(sellerId, null)
        return null
      }

      if (!userRecord.company_id || userRecord.company_id.trim() === "") {
        this.log("WARN", "User has no company_id", {
          sellerId,
          userId: userRecord.id,
          email: userRecord.email,
        })
        this.userCompanyIdCache.set(sellerId, null)
        return null
      }

      // Update cache
      this.userCompanyIdCache.set(sellerId, userRecord.company_id)

      this.log("INFO", "User found with valid company_id", {
        sellerId,
        userId: userRecord.id,
        companyId: userRecord.company_id,
        email: userRecord.email,
      })

      return userRecord
    } catch (error) {
      this.log("ERROR", "Failed to get user by seller_id", {
        sellerId,
        error: error instanceof Error ? error.message : String(error),
      })
      this.userCompanyIdCache.set(sellerId, null)
      return null
    }
  }

  // Enhanced batch retrieval with 20-product batches (1-20, 21-40, etc.)
  async getProductsForSeller(
    sellerId: string,
    batchNumber: number,
    lastDoc?: QueryDocumentSnapshot<DocumentData>,
  ): Promise<{
    products: ProductRecord[]
    hasMore: boolean
    lastDoc?: QueryDocumentSnapshot<DocumentData>
    batchRange: string
  }> {
    const batchRange = this.generateBatchRange(batchNumber)

    this.log("INFO", `Getting products for seller: ${sellerId} (Batch ${batchNumber}: ${batchRange})`, {
      isFirstBatch: batchNumber === 1,
      lastDocId: lastDoc?.id,
      batchRange,
      batchSize: PRODUCTS_PER_BATCH,
    })

    try {
      let productsQuery

      if (lastDoc && batchNumber > 1) {
        // Subsequent batch with pagination
        productsQuery = query(
          collection(db, "products"),
          where("seller_id", "==", sellerId),
          orderBy("__name__"),
          startAfter(lastDoc),
          limit(PRODUCTS_PER_BATCH),
        )
      } else {
        // First batch
        productsQuery = query(
          collection(db, "products"),
          where("seller_id", "==", sellerId),
          orderBy("__name__"),
          limit(PRODUCTS_PER_BATCH),
        )
      }

      const snapshot = await getDocs(productsQuery)

      if (snapshot.empty) {
        this.log("WARN", "No products found for seller", { sellerId, batchNumber, batchRange })
        return { products: [], hasMore: false, batchRange }
      }

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

      const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : undefined
      const hasMore = snapshot.docs.length === PRODUCTS_PER_BATCH

      this.log("INFO", "Products retrieved for seller", {
        sellerId,
        batchNumber,
        batchRange,
        productCount: products.length,
        hasMore,
        lastDocId: newLastDoc?.id,
        expectedBatchSize: PRODUCTS_PER_BATCH,
      })

      return {
        products,
        hasMore,
        lastDoc: newLastDoc,
        batchRange,
      }
    } catch (error) {
      this.log("ERROR", "Failed to get products for seller", {
        sellerId,
        batchNumber,
        batchRange,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Enhanced eligibility checking
  async checkMigrationEligibility(): Promise<{
    hasEligibleProducts: boolean
    stats: {
      totalProductsChecked: number
      productsWithCompanyId: number
      productsWithoutSellerId: number
      sellersWithoutCompanyId: number
      eligibleProducts: number
    }
  }> {
    this.log("INFO", "Checking enhanced migration eligibility")

    const stats = {
      totalProductsChecked: 0,
      productsWithCompanyId: 0,
      productsWithoutSellerId: 0,
      sellersWithoutCompanyId: 0,
      eligibleProducts: 0,
    }

    try {
      const eligibilityQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(MAX_INITIAL_SAMPLE * 2),
      )

      const snapshot = await getDocs(eligibilityQuery)
      stats.totalProductsChecked = snapshot.size

      if (snapshot.empty) {
        return { hasEligibleProducts: false, stats }
      }

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

      // Enhanced eligibility checking with batch user lookups
      const uniqueSellerIds = [...new Set(products.map((p) => p.seller_id).filter(Boolean))]
      const userValidationPromises = uniqueSellerIds.slice(0, 100).map(async (sellerId) => {
        try {
          const userRecord = await migrationCache.getCachedUser(sellerId)
          return {
            sellerId,
            hasCompanyId: userRecord?.company_id && userRecord.company_id.trim() !== "",
            userRecord,
          }
        } catch (error) {
          return { sellerId, hasCompanyId: false, userRecord: null }
        }
      })

      const userValidationResults = await Promise.all(userValidationPromises)
      const sellerValidationMap = new Map(userValidationResults.map((result) => [result.sellerId, result.hasCompanyId]))

      // Check eligibility for each product
      for (const product of products) {
        if (product.company_id && product.company_id.trim() !== "") {
          stats.productsWithCompanyId++
          continue
        }

        if (!product.seller_id || product.seller_id.trim() === "") {
          stats.productsWithoutSellerId++
          continue
        }

        const sellerHasCompanyId = sellerValidationMap.get(product.seller_id)
        if (sellerHasCompanyId === false) {
          stats.sellersWithoutCompanyId++
          continue
        }

        if (sellerHasCompanyId === true) {
          stats.eligibleProducts++
        }
      }

      const hasEligibleProducts = stats.eligibleProducts > 0

      this.log("INFO", "Enhanced eligibility check completed", {
        hasEligibleProducts,
        stats,
        uniqueSellersChecked: userValidationResults.length,
      })

      return { hasEligibleProducts, stats }
    } catch (error) {
      this.log("ERROR", "Enhanced eligibility check failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Enhanced migration initialization
  async initializeMigration(): Promise<EnhancedPrioritizedMigrationState> {
    this.log("INFO", "Starting enhanced prioritized migration initialization")

    const migrationId = `enhanced_prioritized_migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = new Date().toISOString()

    try {
      // Step 1: Enhanced product sorting
      const sortingStartTime = Date.now()
      const priorityStats = await this.sortProductsByUserPriority()
      const sortingDuration = Date.now() - sortingStartTime

      // Step 2: Enhanced eligibility check
      const eligibilityCheck = await this.checkMigrationEligibility()

      if (
        !eligibilityCheck.hasEligibleProducts &&
        priorityStats.priorityProducts === 0 &&
        priorityStats.standardProducts === 0
      ) {
        this.log("INFO", "No eligible products found - creating completed migration state")

        const migrationState: EnhancedPrioritizedMigrationState = {
          migrationId,
          startTime,
          selectedProduct: null,
          selectedUser: null,
          extractedCompanyId: null,
          currentBatch: [],
          currentBatchNumber: 1,
          batchRange: this.generateBatchRange(1),
          hasMoreBatches: false,
          totalProcessed: 0,
          totalUpdated: 0,
          totalSkipped: 0,
          totalErrors: 0,
          selectionAttempts: 1,
          isPriorityProduct: false,
          priorityStats,
          noEligibleProducts: true,
          eligibilityStats: eligibilityCheck.stats,
          sortingStats: {
            totalProductsSorted: priorityStats.totalProductsAnalyzed,
            priorityProductsFound: priorityStats.priorityProducts,
            standardProductsFound: priorityStats.standardProducts,
            sortingDuration,
          },
        }

        this.migrationState = migrationState
        return migrationState
      }

      // Step 3: Enhanced product and user selection
      let selectedProduct: ProductRecord | null = null
      let selectedUser: UserRecord | null = null
      let isPriorityProduct = false
      let selectionAttempts = 0

      while (!selectedProduct && selectionAttempts < MAX_SELECTION_ATTEMPTS) {
        selectionAttempts++
        this.log("DEBUG", `Enhanced selection attempt ${selectionAttempts}/${MAX_SELECTION_ATTEMPTS}`)

        // Select from sorted products list
        const productResult = await this.selectFromSortedProducts()
        if (!productResult) {
          this.log("WARN", "No candidate product found in sorted list")
          continue
        }

        const candidateProduct = productResult.product
        isPriorityProduct = productResult.isPriority

        // Validate seller
        const candidateUser = await this.getUserBySellerId(candidateProduct.seller_id)
        if (!candidateUser) {
          this.log("WARN", "Seller has no valid company_id, trying another product", {
            productId: candidateProduct.id,
            sellerId: candidateProduct.seller_id,
            isPriority: isPriorityProduct,
          })
          continue
        }

        // Success!
        selectedProduct = candidateProduct
        selectedUser = candidateUser
        break
      }

      if (!selectedProduct || !selectedUser) {
        this.log("WARN", "Failed to find valid product and user after maximum attempts")

        const migrationState: EnhancedPrioritizedMigrationState = {
          migrationId,
          startTime,
          selectedProduct: null,
          selectedUser: null,
          extractedCompanyId: null,
          currentBatch: [],
          currentBatchNumber: 1,
          batchRange: this.generateBatchRange(1),
          hasMoreBatches: false,
          totalProcessed: 0,
          totalUpdated: 0,
          totalSkipped: 0,
          totalErrors: 0,
          selectionAttempts,
          isPriorityProduct: false,
          priorityStats,
          noEligibleProducts: true,
          eligibilityStats: eligibilityCheck.stats,
          sortingStats: {
            totalProductsSorted: priorityStats.totalProductsAnalyzed,
            priorityProductsFound: priorityStats.priorityProducts,
            standardProductsFound: priorityStats.standardProducts,
            sortingDuration,
          },
        }

        this.migrationState = migrationState
        return migrationState
      }

      // Step 4: Get first batch (1-20)
      const firstBatchResult = await this.getProductsForSeller(selectedUser.id, 1)

      const migrationState: EnhancedPrioritizedMigrationState = {
        migrationId,
        startTime,
        selectedProduct,
        selectedUser,
        extractedCompanyId: selectedUser.company_id!,
        currentBatch: firstBatchResult.products,
        currentBatchNumber: 1,
        batchRange: firstBatchResult.batchRange,
        hasMoreBatches: firstBatchResult.hasMore,
        lastDoc: firstBatchResult.lastDoc,
        totalProcessed: firstBatchResult.products.length,
        totalUpdated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        selectionAttempts,
        isPriorityProduct,
        priorityStats,
        sortingStats: {
          totalProductsSorted: priorityStats.totalProductsAnalyzed,
          priorityProductsFound: priorityStats.priorityProducts,
          standardProductsFound: priorityStats.standardProducts,
          sortingDuration,
        },
      }

      this.migrationState = migrationState

      this.log("INFO", "Enhanced migration initialized successfully", {
        migrationId,
        selectedProductId: selectedProduct.id,
        sellerId: selectedUser.id,
        companyId: selectedUser.company_id,
        firstBatchSize: firstBatchResult.products.length,
        batchRange: firstBatchResult.batchRange,
        hasMoreBatches: firstBatchResult.hasMore,
        selectionAttempts,
        isPriorityProduct,
        priorityStats,
        sortingDuration: `${sortingDuration}ms`,
      })

      return migrationState
    } catch (error) {
      this.log("ERROR", "Enhanced migration initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Load next batch (21-40, 41-60, etc.)
  async loadNextBatch(): Promise<EnhancedPrioritizedMigrationState> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    if (!this.migrationState.hasMoreBatches) {
      throw new Error("No more batches available")
    }

    if (!this.migrationState.selectedUser) {
      throw new Error("No selected user available")
    }

    const nextBatchNumber = this.migrationState.currentBatchNumber + 1
    const nextBatchRange = this.generateBatchRange(nextBatchNumber)

    this.log("INFO", "Loading next enhanced batch", {
      currentBatch: this.migrationState.currentBatchNumber,
      nextBatch: nextBatchNumber,
      nextBatchRange,
      sellerId: this.migrationState.selectedUser.id,
      isPriorityProduct: this.migrationState.isPriorityProduct,
      batchSize: PRODUCTS_PER_BATCH,
    })

    try {
      const nextBatchResult = await this.getProductsForSeller(
        this.migrationState.selectedUser.id,
        nextBatchNumber,
        this.migrationState.lastDoc,
      )

      this.migrationState = {
        ...this.migrationState,
        currentBatch: nextBatchResult.products,
        currentBatchNumber: nextBatchNumber,
        batchRange: nextBatchResult.batchRange,
        hasMoreBatches: nextBatchResult.hasMore,
        lastDoc: nextBatchResult.lastDoc,
        totalProcessed: this.migrationState.totalProcessed + nextBatchResult.products.length,
      }

      this.log("INFO", "Next enhanced batch loaded successfully", {
        batchNumber: this.migrationState.currentBatchNumber,
        batchRange: this.migrationState.batchRange,
        batchSize: nextBatchResult.products.length,
        hasMore: nextBatchResult.hasMore,
        totalProcessed: this.migrationState.totalProcessed,
        isPriorityProduct: this.migrationState.isPriorityProduct,
      })

      return this.migrationState
    } catch (error) {
      this.log("ERROR", "Failed to load next enhanced batch", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Process current batch
  async processCurrentBatch(): Promise<EnhancedPrioritizedMigrationState> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    if (!this.migrationState.extractedCompanyId) {
      throw new Error("No company_id available")
    }

    if (!this.migrationState.selectedUser) {
      throw new Error("No selected user available")
    }

    this.log("INFO", "Processing current enhanced batch", {
      batchNumber: this.migrationState.currentBatchNumber,
      batchRange: this.migrationState.batchRange,
      batchSize: this.migrationState.currentBatch.length,
      companyId: this.migrationState.extractedCompanyId,
      isPriorityProduct: this.migrationState.isPriorityProduct,
      expectedBatchSize: PRODUCTS_PER_BATCH,
    })

    try {
      const updateResults = await this.updateProductBatch(
        this.migrationState.currentBatch,
        this.migrationState.extractedCompanyId,
        this.migrationState.selectedUser.id,
        this.migrationState.currentBatchNumber,
        this.migrationState.isPriorityProduct,
      )

      this.migrationState = {
        ...this.migrationState,
        totalUpdated: this.migrationState.totalUpdated + updateResults.updated,
        totalSkipped: this.migrationState.totalSkipped + updateResults.skipped,
        totalErrors: this.migrationState.totalErrors + updateResults.errors,
      }

      this.log("INFO", "Enhanced batch processed successfully", {
        batchNumber: this.migrationState.currentBatchNumber,
        batchRange: this.migrationState.batchRange,
        results: updateResults,
        totals: {
          updated: this.migrationState.totalUpdated,
          skipped: this.migrationState.totalSkipped,
          errors: this.migrationState.totalErrors,
        },
        isPriorityProduct: this.migrationState.isPriorityProduct,
      })

      return this.migrationState
    } catch (error) {
      this.log("ERROR", "Failed to process current enhanced batch", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Process all remaining batches
  async processAllBatches(
    onBatchComplete?: (
      batchNumber: number,
      results: { updated: number; skipped: number; errors: number },
      batchRange: string,
      isPriority: boolean,
    ) => void,
  ): Promise<EnhancedPrioritizedMigrationState> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    this.log("INFO", "Processing all enhanced batches")

    try {
      // Process current batch first
      await this.processCurrentBatch()

      if (onBatchComplete) {
        onBatchComplete(
          this.migrationState.currentBatchNumber,
          {
            updated: this.migrationState.totalUpdated,
            skipped: this.migrationState.totalSkipped,
            errors: this.migrationState.totalErrors,
          },
          this.migrationState.batchRange,
          this.migrationState.isPriorityProduct,
        )
      }

      // Continue with remaining batches
      while (this.migrationState.hasMoreBatches) {
        await this.loadNextBatch()
        await this.processCurrentBatch()

        if (onBatchComplete) {
          onBatchComplete(
            this.migrationState.currentBatchNumber,
            {
              updated: this.migrationState.totalUpdated,
              skipped: this.migrationState.totalSkipped,
              errors: this.migrationState.totalErrors,
            },
            this.migrationState.batchRange,
            this.migrationState.isPriorityProduct,
          )
        }
      }

      this.log("INFO", "All enhanced batches processed successfully", {
        totalBatches: this.migrationState.currentBatchNumber,
        finalTotals: {
          updated: this.migrationState.totalUpdated,
          skipped: this.migrationState.totalSkipped,
          errors: this.migrationState.totalErrors,
        },
        isPriorityProduct: this.migrationState.isPriorityProduct,
        batchSize: PRODUCTS_PER_BATCH,
      })

      return this.migrationState
    } catch (error) {
      this.log("ERROR", "Failed to process all enhanced batches", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Enhanced batch update with 20-product batches
  async updateProductBatch(
    products: ProductRecord[],
    companyId: string,
    sellerId: string,
    batchNumber: number,
    isPriority: boolean,
  ): Promise<{ updated: number; skipped: number; errors: number }> {
    const batchRange = this.generateBatchRange(batchNumber)

    this.log("INFO", "Updating enhanced product batch", {
      batchNumber,
      batchRange,
      totalProducts: products.length,
      companyId,
      sellerId,
      isPriority,
      expectedBatchSize: PRODUCTS_PER_BATCH,
    })

    if (!products || products.length === 0) {
      return { updated: 0, skipped: 0, errors: 0 }
    }

    try {
      // Filter products that need updating
      const productsToUpdate = products.filter((product) => {
        const needsUpdate = !product.company_id || product.company_id === null || product.company_id === ""
        const isValid = product.id && product.seller_id === sellerId
        return needsUpdate && isValid
      })

      const skippedCount = products.length - productsToUpdate.length

      if (productsToUpdate.length === 0) {
        this.log("WARN", "No products require updating in this enhanced batch", { batchRange, isPriority })
        return { updated: 0, skipped: skippedCount, errors: 0 }
      }

      let updatedCount = 0
      let errorCount = 0

      const batch = writeBatch(db)
      const updateTimestamp = new Date()

      const updateData = {
        company_id: companyId,
        updated_at: updateTimestamp,
        migration_source: "enhanced_prioritized_product_migration",
        migration_timestamp: updateTimestamp.toISOString(),
        migration_seller_id: sellerId,
        migration_batch: batchNumber,
        migration_batch_range: batchRange,
        migration_batch_size: PRODUCTS_PER_BATCH,
        migration_priority: isPriority,
        migration_id: this.migrationState?.migrationId || "unknown",
      }

      for (const product of productsToUpdate) {
        try {
          if (!product.id) {
            throw new Error("Product missing ID")
          }

          const productRef = doc(db, "products", product.id)
          batch.update(productRef, updateData)
        } catch (err) {
          this.log("ERROR", "Error adding product to enhanced batch", {
            productId: product.id,
            batchRange,
            isPriority,
            error: err instanceof Error ? err.message : String(err),
          })
          errorCount++
        }
      }

      if (productsToUpdate.length - errorCount > 0) {
        await batch.commit()
        updatedCount = productsToUpdate.length - errorCount

        // Invalidate cache after successful update
        await migrationCache.invalidateAfterUpdate(sellerId, "PRODUCT")
      }

      const result = { updated: updatedCount, skipped: skippedCount, errors: errorCount }

      this.log("INFO", "Enhanced batch update completed", {
        batchNumber,
        batchRange,
        isPriority,
        result,
        batchSize: PRODUCTS_PER_BATCH,
      })

      return result
    } catch (error) {
      this.log("ERROR", "Enhanced batch update failed", {
        batchNumber,
        batchRange,
        isPriority,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Get current migration state
  getMigrationState(): EnhancedPrioritizedMigrationState | null {
    return this.migrationState
  }

  // Enhanced reset with cache clearing
  reset(): void {
    this.log("INFO", "Resetting enhanced migration state")
    this.migrationState = null
    this.priorityProductIds.clear()
    this.standardProductIds.clear()
    this.userCompanyIdCache.clear()
    this.sortedProductsList = []
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    this.log("INFO", `Enhanced debug mode ${enabled ? "enabled" : "disabled"}`)
  }

  // Get sorting statistics
  getSortingStats(): {
    priorityProductsCount: number
    standardProductsCount: number
    sortedListSize: number
    userCacheSize: number
  } {
    return {
      priorityProductsCount: this.priorityProductIds.size,
      standardProductsCount: this.standardProductIds.size,
      sortedListSize: this.sortedProductsList.length,
      userCacheSize: this.userCompanyIdCache.size,
    }
  }
}

// Export singleton instance
export const enhancedPrioritizedProductMigrationService = new EnhancedPrioritizedProductMigrationService()
