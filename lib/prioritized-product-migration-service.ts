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
}

export interface PrioritizedMigrationState {
  migrationId: string
  startTime: string
  selectedProduct: ProductRecord | null
  selectedUser: UserRecord | null
  extractedCompanyId: string | null
  currentBatch: ProductRecord[]
  currentBatchNumber: number
  batchRange: string // e.g., "1-10", "11-20", "21-30"
  hasMoreBatches: boolean
  lastDoc?: QueryDocumentSnapshot<DocumentData>
  totalProcessed: number
  totalUpdated: number
  totalSkipped: number
  totalErrors: number
  selectionAttempts: number
  isPriorityProduct: boolean // Whether current product is from priority list
  priorityStats?: PriorityStats
  noEligibleProducts?: boolean
  eligibilityStats?: {
    totalProductsChecked: number
    productsWithCompanyId: number
    productsWithoutSellerId: number
    sellersWithoutCompanyId: number
    eligibleProducts: number
  }
}

const PRODUCTS_PER_BATCH = 10
const MAX_SELECTION_ATTEMPTS = 20
const MAX_INITIAL_SAMPLE = 200
const PRIORITY_SAMPLE_SIZE = 100

export class PrioritizedProductMigrationService {
  private migrationState: PrioritizedMigrationState | null = null
  private debugMode = true
  private priorityProductIds: Set<string> = new Set()
  private standardProductIds: Set<string> = new Set()

  constructor() {}

  private log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${level}] [PrioritizedProductMigrationService] ${message}`

    if (this.debugMode) {
      if (data) {
        console.log(logMessage, data)
      } else {
        console.log(logMessage)
      }
    }
  }

  // Generate batch range string (1-10, 11-20, etc.)
  private generateBatchRange(batchNumber: number): string {
    const start = (batchNumber - 1) * PRODUCTS_PER_BATCH + 1
    const end = batchNumber * PRODUCTS_PER_BATCH
    return `${start}-${end}`
  }

  // Step 1: Sort and categorize products by user priority
  async sortProductsByUserPriority(): Promise<PriorityStats> {
    this.log("INFO", "Sorting products by user priority (users without company_id first)")

    const priorityStats: PriorityStats = {
      priorityProducts: 0,
      standardProducts: 0,
      usersWithoutCompanyId: 0,
      usersWithCompanyId: 0,
    }

    try {
      // Clear previous categorization
      this.priorityProductIds.clear()
      this.standardProductIds.clear()

      // Get a large sample of products for analysis
      const productsQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(MAX_INITIAL_SAMPLE),
      )

      const snapshot = await getDocs(productsQuery)

      if (snapshot.empty) {
        this.log("WARN", "No products found for priority sorting")
        return priorityStats
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

      // Filter out products that already have company_id
      const eligibleProducts = products.filter((product) => !product.company_id || product.company_id.trim() === "")

      this.log("INFO", "Analyzing products for priority classification", {
        totalProducts: products.length,
        eligibleProducts: eligibleProducts.length,
      })

      // Check each product's seller for company_id status
      const userCache = new Map<string, UserRecord | null>()

      for (const product of eligibleProducts) {
        if (!product.seller_id || product.seller_id.trim() === "") {
          continue
        }

        // Check cache first
        let userRecord = userCache.get(product.seller_id)
        if (userRecord === undefined) {
          // Fetch user if not in cache
          try {
            userRecord = await migrationCache.getCachedUser(product.seller_id)
            userCache.set(product.seller_id, userRecord)
          } catch (error) {
            this.log("DEBUG", "Error fetching user for priority classification", {
              sellerId: product.seller_id,
              error: error instanceof Error ? error.message : String(error),
            })
            userCache.set(product.seller_id, null)
            continue
          }
        }

        if (!userRecord) {
          continue
        }

        // Categorize based on user's company_id status
        if (!userRecord.company_id || userRecord.company_id.trim() === "") {
          // Priority: User without company_id
          this.priorityProductIds.add(product.id)
          priorityStats.priorityProducts++
          if (!userCache.has(`counted_user_${userRecord.id}`)) {
            priorityStats.usersWithoutCompanyId++
            userCache.set(`counted_user_${userRecord.id}`, userRecord)
          }
        } else {
          // Standard: User with company_id
          this.standardProductIds.add(product.id)
          priorityStats.standardProducts++
          if (!userCache.has(`counted_user_${userRecord.id}`)) {
            priorityStats.usersWithCompanyId++
            userCache.set(`counted_user_${userRecord.id}`, userRecord)
          }
        }
      }

      this.log("INFO", "Product priority sorting completed", {
        priorityStats,
        priorityProductsCount: this.priorityProductIds.size,
        standardProductsCount: this.standardProductIds.size,
      })

      return priorityStats
    } catch (error) {
      this.log("ERROR", "Failed to sort products by priority", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Step 2: Select random product with priority preference
  async selectPrioritizedRandomProduct(): Promise<{ product: ProductRecord; isPriority: boolean } | null> {
    this.log("INFO", "Selecting prioritized random product")

    try {
      // First try to select from priority products (users without company_id)
      if (this.priorityProductIds.size > 0) {
        const priorityArray = Array.from(this.priorityProductIds)
        const randomIndex = Math.floor(Math.random() * priorityArray.length)
        const selectedProductId = priorityArray[randomIndex]

        // Fetch the selected priority product
        const priorityQuery = query(collection(db, "products"), where("__name__", "==", selectedProductId), limit(1))

        const prioritySnapshot = await getDocs(priorityQuery)
        if (!prioritySnapshot.empty) {
          const doc = prioritySnapshot.docs[0]
          const data = doc.data()
          const product: ProductRecord = {
            id: doc.id,
            seller_id: data.seller_id,
            company_id: data.company_id,
            name: data.name,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }

          this.log("INFO", "Priority product selected", {
            productId: product.id,
            sellerId: product.seller_id,
            productName: product.name,
            isPriority: true,
          })

          return { product, isPriority: true }
        }
      }

      // Fallback to standard products if no priority products available
      if (this.standardProductIds.size > 0) {
        const standardArray = Array.from(this.standardProductIds)
        const randomIndex = Math.floor(Math.random() * standardArray.length)
        const selectedProductId = standardArray[randomIndex]

        // Fetch the selected standard product
        const standardQuery = query(collection(db, "products"), where("__name__", "==", selectedProductId), limit(1))

        const standardSnapshot = await getDocs(standardQuery)
        if (!standardSnapshot.empty) {
          const doc = standardSnapshot.docs[0]
          const data = doc.data()
          const product: ProductRecord = {
            id: doc.id,
            seller_id: data.seller_id,
            company_id: data.company_id,
            name: data.name,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }

          this.log("INFO", "Standard product selected (no priority products available)", {
            productId: product.id,
            sellerId: product.seller_id,
            productName: product.name,
            isPriority: false,
          })

          return { product, isPriority: false }
        }
      }

      // If no categorized products, fall back to random selection
      this.log("WARN", "No categorized products available, falling back to random selection")
      return await this.selectRandomProductFallback()
    } catch (error) {
      this.log("ERROR", "Failed to select prioritized random product", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Fallback random product selection
  async selectRandomProductFallback(): Promise<{ product: ProductRecord; isPriority: boolean } | null> {
    this.log("INFO", "Using fallback random product selection")

    try {
      const productsQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(PRIORITY_SAMPLE_SIZE),
      )

      const snapshot = await getDocs(productsQuery)

      if (snapshot.empty) {
        this.log("WARN", "No products found in fallback selection")
        return null
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

      // Filter out products that already have company_id
      const eligibleProducts = products.filter((product) => !product.company_id || product.company_id.trim() === "")

      if (eligibleProducts.length === 0) {
        this.log("WARN", "No eligible products found in fallback selection")
        return null
      }

      // Select random product
      const randomIndex = Math.floor(Math.random() * eligibleProducts.length)
      const selectedProduct = eligibleProducts[randomIndex]

      this.log("INFO", "Fallback product selected", {
        productId: selectedProduct.id,
        sellerId: selectedProduct.seller_id,
        productName: selectedProduct.name,
        isPriority: false,
      })

      return { product: selectedProduct, isPriority: false }
    } catch (error) {
      this.log("ERROR", "Failed fallback product selection", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Step 3: Get user by seller_id and check for company_id
  async getUserBySellerId(sellerId: string): Promise<UserRecord | null> {
    this.log("INFO", `Getting user for seller_id: ${sellerId}`)

    if (!sellerId || sellerId.trim() === "") {
      this.log("WARN", "Invalid seller_id provided")
      return null
    }

    try {
      const userRecord = await migrationCache.getCachedUser(sellerId)

      if (!userRecord) {
        this.log("WARN", "No user found for seller_id", { sellerId })
        return null
      }

      if (!userRecord.company_id || userRecord.company_id.trim() === "") {
        this.log("WARN", "User has no company_id", {
          sellerId,
          userId: userRecord.id,
          email: userRecord.email,
        })
        return null
      }

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
      return null
    }
  }

  // Step 4: Get sequential batch of products for the seller (1-10, 11-20, etc.)
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

  // Check migration eligibility
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
    this.log("INFO", "Checking migration eligibility")

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

        try {
          const sellerRecord = await migrationCache.getCachedUser(product.seller_id)
          if (!sellerRecord || !sellerRecord.company_id || sellerRecord.company_id.trim() === "") {
            stats.sellersWithoutCompanyId++
            continue
          }

          stats.eligibleProducts++
        } catch (error) {
          this.log("DEBUG", "Error validating seller", {
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
      })

      return { hasEligibleProducts, stats }
    } catch (error) {
      this.log("ERROR", "Eligibility check failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Initialize migration with prioritized product selection
  async initializeMigration(): Promise<PrioritizedMigrationState> {
    this.log("INFO", "Starting prioritized migration initialization")

    const migrationId = `prioritized_migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = new Date().toISOString()

    try {
      // Step 1: Sort products by user priority
      const priorityStats = await this.sortProductsByUserPriority()

      // Check if there are any eligible products
      const eligibilityCheck = await this.checkMigrationEligibility()

      if (
        !eligibilityCheck.hasEligibleProducts &&
        priorityStats.priorityProducts === 0 &&
        priorityStats.standardProducts === 0
      ) {
        this.log("INFO", "No eligible products found - creating completed migration state")

        const migrationState: PrioritizedMigrationState = {
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
        }

        this.migrationState = migrationState
        return migrationState
      }

      // Step 2: Prioritized product and user selection
      let selectedProduct: ProductRecord | null = null
      let selectedUser: UserRecord | null = null
      let isPriorityProduct = false
      let selectionAttempts = 0

      while (!selectedProduct && selectionAttempts < MAX_SELECTION_ATTEMPTS) {
        selectionAttempts++
        this.log("DEBUG", `Selection attempt ${selectionAttempts}/${MAX_SELECTION_ATTEMPTS}`)

        // Step 2a: Select prioritized random product
        const productResult = await this.selectPrioritizedRandomProduct()
        if (!productResult) {
          this.log("WARN", "No candidate product found")
          continue
        }

        const candidateProduct = productResult.product
        isPriorityProduct = productResult.isPriority

        // Step 2b: Check if seller has company_id
        const candidateUser = await this.getUserBySellerId(candidateProduct.seller_id)
        if (!candidateUser) {
          this.log("WARN", "Seller has no valid company_id, trying another product", {
            productId: candidateProduct.id,
            sellerId: candidateProduct.seller_id,
            isPriority: isPriorityProduct,
          })
          continue
        }

        // Success! We found a valid product and user
        selectedProduct = candidateProduct
        selectedUser = candidateUser
        break
      }

      if (!selectedProduct || !selectedUser) {
        this.log("WARN", "Failed to find valid product and user after maximum attempts")

        const migrationState: PrioritizedMigrationState = {
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
        }

        this.migrationState = migrationState
        return migrationState
      }

      // Step 3: Get first batch of products for the seller (1-10)
      const firstBatchResult = await this.getProductsForSeller(selectedUser.id, 1)

      const migrationState: PrioritizedMigrationState = {
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
      }

      this.migrationState = migrationState

      this.log("INFO", "Migration initialized successfully", {
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
      })

      return migrationState
    } catch (error) {
      this.log("ERROR", "Migration initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Load next batch of products (11-20, 21-30, etc.)
  async loadNextBatch(): Promise<PrioritizedMigrationState> {
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

    this.log("INFO", "Loading next batch", {
      currentBatch: this.migrationState.currentBatchNumber,
      nextBatch: nextBatchNumber,
      nextBatchRange,
      sellerId: this.migrationState.selectedUser.id,
      isPriorityProduct: this.migrationState.isPriorityProduct,
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

      this.log("INFO", "Next batch loaded successfully", {
        batchNumber: this.migrationState.currentBatchNumber,
        batchRange: this.migrationState.batchRange,
        batchSize: nextBatchResult.products.length,
        hasMore: nextBatchResult.hasMore,
        totalProcessed: this.migrationState.totalProcessed,
        isPriorityProduct: this.migrationState.isPriorityProduct,
      })

      return this.migrationState
    } catch (error) {
      this.log("ERROR", "Failed to load next batch", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Process current batch
  async processCurrentBatch(): Promise<PrioritizedMigrationState> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    if (!this.migrationState.extractedCompanyId) {
      throw new Error("No company_id available")
    }

    if (!this.migrationState.selectedUser) {
      throw new Error("No selected user available")
    }

    this.log("INFO", "Processing current batch", {
      batchNumber: this.migrationState.currentBatchNumber,
      batchRange: this.migrationState.batchRange,
      batchSize: this.migrationState.currentBatch.length,
      companyId: this.migrationState.extractedCompanyId,
      isPriorityProduct: this.migrationState.isPriorityProduct,
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

      this.log("INFO", "Batch processed successfully", {
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
      this.log("ERROR", "Failed to process current batch", {
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
  ): Promise<PrioritizedMigrationState> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    this.log("INFO", "Processing all batches")

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

      this.log("INFO", "All batches processed successfully", {
        totalBatches: this.migrationState.currentBatchNumber,
        finalTotals: {
          updated: this.migrationState.totalUpdated,
          skipped: this.migrationState.totalSkipped,
          errors: this.migrationState.totalErrors,
        },
        isPriorityProduct: this.migrationState.isPriorityProduct,
      })

      return this.migrationState
    } catch (error) {
      this.log("ERROR", "Failed to process all batches", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Update product batch with company_id
  async updateProductBatch(
    products: ProductRecord[],
    companyId: string,
    sellerId: string,
    batchNumber: number,
    isPriority: boolean,
  ): Promise<{ updated: number; skipped: number; errors: number }> {
    const batchRange = this.generateBatchRange(batchNumber)

    this.log("INFO", "Updating product batch", {
      batchNumber,
      batchRange,
      totalProducts: products.length,
      companyId,
      sellerId,
      isPriority,
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
        this.log("WARN", "No products require updating in this batch", { batchRange, isPriority })
        return { updated: 0, skipped: skippedCount, errors: 0 }
      }

      let updatedCount = 0
      let errorCount = 0

      const batch = writeBatch(db)
      const updateTimestamp = new Date()

      const updateData = {
        company_id: companyId,
        updated_at: updateTimestamp,
        migration_source: "prioritized_product_migration",
        migration_timestamp: updateTimestamp.toISOString(),
        migration_seller_id: sellerId,
        migration_batch: batchNumber,
        migration_batch_range: batchRange,
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
          this.log("ERROR", "Error adding product to batch", {
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

      this.log("INFO", "Batch update completed", {
        batchNumber,
        batchRange,
        isPriority,
        result,
      })

      return result
    } catch (error) {
      this.log("ERROR", "Batch update failed", {
        batchNumber,
        batchRange,
        isPriority,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Get current migration state
  getMigrationState(): PrioritizedMigrationState | null {
    return this.migrationState
  }

  // Reset migration
  reset(): void {
    this.log("INFO", "Resetting migration state")
    this.migrationState = null
    this.priorityProductIds.clear()
    this.standardProductIds.clear()
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    this.log("INFO", `Debug mode ${enabled ? "enabled" : "disabled"}`)
  }
}

// Export singleton instance
export const prioritizedProductMigrationService = new PrioritizedProductMigrationService()
