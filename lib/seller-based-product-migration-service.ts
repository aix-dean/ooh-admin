import { collection, query, where, orderBy, limit, getDocs, doc, writeBatch } from "firebase/firestore"
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

export interface BatchUpdateResult {
  updated: number
  skipped: number
  errors: number
  batchNumber: number
  totalBatches: number
}

export interface SellerMigrationState {
  migrationId: string
  startTime: string
  currentSeller: {
    sellerId: string
    companyId: string
    userRecord: UserRecord
    totalProducts: number
    processedProducts: number
    currentBatch: number
    totalBatches: number
  } | null
  currentBatchProducts: ProductRecord[]
  overallStats: {
    totalSellersProcessed: number
    totalProductsUpdated: number
    totalProductsSkipped: number
    totalErrors: number
    totalBatchesProcessed: number
  }
  isComplete: boolean
  noEligibleProducts?: boolean
  lastError?: string
}

const PRODUCTS_PER_BATCH = 10
const MAX_RANDOM_SELECTION_ATTEMPTS = 50
const MAX_INITIAL_SAMPLE = 200

export class SellerBasedProductMigrationService {
  private migrationState: SellerMigrationState | null = null
  private debugMode = true
  private progressCallbacks: Set<(state: SellerMigrationState) => void> = new Set()

  constructor() {}

  private log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${level}] [SellerBasedProductMigrationService] ${message}`

    if (this.debugMode) {
      if (data) {
        console.log(logMessage, data)
      } else {
        console.log(logMessage)
      }
    }
  }

  // Progress tracking
  onProgressUpdate(callback: (state: SellerMigrationState) => void): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  private notifyProgress() {
    if (this.migrationState) {
      this.progressCallbacks.forEach((callback) => {
        try {
          callback(this.migrationState!)
        } catch (error) {
          this.log("ERROR", "Error in progress callback", {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      })
    }
  }

  // Step 1: Randomly select a product entry to get seller_id
  async selectRandomProductEntry(): Promise<ProductRecord | null> {
    this.log("INFO", "Selecting random product entry to extract seller_id")

    try {
      // Get a sample of products that don't have company_id
      const productsQuery = query(
        collection(db, "products"),
        where("seller_id", "!=", null),
        where("company_id", "==", null),
        orderBy("seller_id"),
        orderBy("__name__"),
        limit(MAX_INITIAL_SAMPLE),
      )

      const snapshot = await getDocs(productsQuery)

      if (snapshot.empty) {
        this.log("WARN", "No products without company_id found")
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

      // Filter products that need migration (no company_id)
      const eligibleProducts = products.filter(
        (product) => !product.company_id && product.seller_id && product.seller_id.trim() !== "",
      )

      if (eligibleProducts.length === 0) {
        this.log("WARN", "No eligible products found for migration")
        return null
      }

      // Select random product
      const randomIndex = Math.floor(Math.random() * eligibleProducts.length)
      const selectedProduct = eligibleProducts[randomIndex]

      this.log("INFO", "Random product selected", {
        productId: selectedProduct.id,
        sellerId: selectedProduct.seller_id,
        productName: selectedProduct.name,
        totalEligible: eligibleProducts.length,
      })

      return selectedProduct
    } catch (error) {
      this.log("ERROR", "Failed to select random product entry", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Step 2: Get user by seller_id and extract company_id
  async getUserCompanyId(sellerId: string): Promise<UserRecord | null> {
    this.log("INFO", `Getting user and company_id for seller: ${sellerId}`)

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided")
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
      this.log("ERROR", "Failed to get user company_id", {
        sellerId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Step 3: Get all products for a seller_id
  async getProductsForSeller(sellerId: string): Promise<ProductRecord[]> {
    this.log("INFO", `Getting all products for seller: ${sellerId}`)

    try {
      const productsQuery = query(collection(db, "products"), where("seller_id", "==", sellerId), orderBy("__name__"))

      const snapshot = await getDocs(productsQuery)

      if (snapshot.empty) {
        this.log("WARN", "No products found for seller", { sellerId })
        return []
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

      // Filter products that need migration (no company_id)
      const productsNeedingMigration = products.filter(
        (product) => !product.company_id || product.company_id === null || product.company_id === "",
      )

      this.log("INFO", "Products retrieved for seller", {
        sellerId,
        totalProducts: products.length,
        productsNeedingMigration: productsNeedingMigration.length,
        productsAlreadyMigrated: products.length - productsNeedingMigration.length,
      })

      return productsNeedingMigration
    } catch (error) {
      this.log("ERROR", "Failed to get products for seller", {
        sellerId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Step 4: Update products in batches of 10
  async updateProductBatch(
    products: ProductRecord[],
    companyId: string,
    sellerId: string,
    batchNumber: number,
    totalBatches: number,
  ): Promise<BatchUpdateResult> {
    this.log("INFO", `Updating product batch ${batchNumber}/${totalBatches}`, {
      batchSize: products.length,
      companyId,
      sellerId,
    })

    if (!products || products.length === 0) {
      return { updated: 0, skipped: 0, errors: 0, batchNumber, totalBatches }
    }

    try {
      let updatedCount = 0
      let skippedCount = 0
      let errorCount = 0

      const batch = writeBatch(db)
      const updateTimestamp = new Date()

      const updateData = {
        company_id: companyId,
        updated_at: updateTimestamp,
        migration_source: "seller_based_product_migration",
        migration_timestamp: updateTimestamp.toISOString(),
        migration_seller_id: sellerId,
        migration_batch: batchNumber,
        migration_id: this.migrationState?.migrationId || "unknown",
      }

      for (const product of products) {
        try {
          if (!product.id) {
            this.log("WARN", "Product missing ID, skipping", { product })
            skippedCount++
            continue
          }

          if (product.seller_id !== sellerId) {
            this.log("WARN", "Product seller_id mismatch, skipping", {
              productId: product.id,
              productSellerId: product.seller_id,
              expectedSellerId: sellerId,
            })
            skippedCount++
            continue
          }

          const productRef = doc(db, "products", product.id)
          batch.update(productRef, updateData)

          this.log("DEBUG", "Added product to batch update", {
            productId: product.id,
            productName: product.name,
            batchNumber,
          })
        } catch (err) {
          this.log("ERROR", "Error adding product to batch", {
            productId: product.id,
            error: err instanceof Error ? err.message : String(err),
          })
          errorCount++
        }
      }

      if (products.length - errorCount - skippedCount > 0) {
        await batch.commit()
        updatedCount = products.length - errorCount - skippedCount

        this.log("INFO", "Batch update committed successfully", {
          batchNumber,
          updatedCount,
          skippedCount,
          errorCount,
        })

        // Invalidate cache after successful update
        await migrationCache.invalidateAfterUpdate(sellerId, "PRODUCT")
      } else {
        this.log("WARN", "No products to commit in batch", {
          batchNumber,
          totalErrors: errorCount,
          totalSkipped: skippedCount,
        })
      }

      const result: BatchUpdateResult = {
        updated: updatedCount,
        skipped: skippedCount,
        errors: errorCount,
        batchNumber,
        totalBatches,
      }

      this.log("INFO", "Batch update completed", {
        batchNumber,
        result,
      })

      return result
    } catch (error) {
      this.log("ERROR", "Batch update failed", {
        batchNumber,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Step 5: Process all products for a seller in batches
  async processSellerProducts(
    sellerId: string,
    companyId: string,
    userRecord: UserRecord,
    onBatchComplete?: (result: BatchUpdateResult) => void,
  ): Promise<void> {
    this.log("INFO", `Processing all products for seller: ${sellerId}`)

    try {
      // Get all products for this seller
      const products = await this.getProductsForSeller(sellerId)

      if (products.length === 0) {
        this.log("INFO", "No products found needing migration for seller", { sellerId })

        if (this.migrationState) {
          this.migrationState.currentSeller = {
            sellerId,
            companyId,
            userRecord,
            totalProducts: 0,
            processedProducts: 0,
            currentBatch: 0,
            totalBatches: 0,
          }
          this.migrationState.currentBatchProducts = []
          this.notifyProgress()
        }
        return
      }

      const totalBatches = Math.ceil(products.length / PRODUCTS_PER_BATCH)

      // Update migration state
      if (this.migrationState) {
        this.migrationState.currentSeller = {
          sellerId,
          companyId,
          userRecord,
          totalProducts: products.length,
          processedProducts: 0,
          currentBatch: 0,
          totalBatches,
        }
        this.notifyProgress()
      }

      this.log("INFO", "Starting batch processing for seller", {
        sellerId,
        totalProducts: products.length,
        totalBatches,
        batchSize: PRODUCTS_PER_BATCH,
      })

      // Process products in batches
      for (let i = 0; i < products.length; i += PRODUCTS_PER_BATCH) {
        const batchProducts = products.slice(i, i + PRODUCTS_PER_BATCH)
        const batchNumber = Math.floor(i / PRODUCTS_PER_BATCH) + 1

        // Update current batch in state
        if (this.migrationState && this.migrationState.currentSeller) {
          this.migrationState.currentSeller.currentBatch = batchNumber
          this.migrationState.currentBatchProducts = batchProducts
          this.notifyProgress()
        }

        this.log("INFO", `Processing batch ${batchNumber}/${totalBatches}`, {
          sellerId,
          batchSize: batchProducts.length,
          productsRange: `${i + 1}-${Math.min(i + PRODUCTS_PER_BATCH, products.length)}`,
        })

        try {
          const batchResult = await this.updateProductBatch(
            batchProducts,
            companyId,
            sellerId,
            batchNumber,
            totalBatches,
          )

          // Update migration state with batch results
          if (this.migrationState) {
            this.migrationState.overallStats.totalProductsUpdated += batchResult.updated
            this.migrationState.overallStats.totalProductsSkipped += batchResult.skipped
            this.migrationState.overallStats.totalErrors += batchResult.errors
            this.migrationState.overallStats.totalBatchesProcessed++

            if (this.migrationState.currentSeller) {
              this.migrationState.currentSeller.processedProducts += batchProducts.length
            }

            this.notifyProgress()
          }

          // Call progress callback
          if (onBatchComplete) {
            onBatchComplete(batchResult)
          }

          this.log("INFO", `Batch ${batchNumber}/${totalBatches} completed`, {
            sellerId,
            batchResult,
          })
        } catch (error) {
          this.log("ERROR", `Batch ${batchNumber}/${totalBatches} failed`, {
            sellerId,
            error: error instanceof Error ? error.message : String(error),
          })

          // Update error count
          if (this.migrationState) {
            this.migrationState.overallStats.totalErrors += batchProducts.length
            this.migrationState.lastError = error instanceof Error ? error.message : String(error)
            this.notifyProgress()
          }

          throw error
        }
      }

      // Update seller completion
      if (this.migrationState) {
        this.migrationState.overallStats.totalSellersProcessed++
        this.migrationState.currentSeller = null
        this.migrationState.currentBatchProducts = []
        this.notifyProgress()
      }

      this.log("INFO", "Completed processing all products for seller", {
        sellerId,
        totalProducts: products.length,
        totalBatches,
      })
    } catch (error) {
      this.log("ERROR", "Failed to process seller products", {
        sellerId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Initialize migration
  async initializeMigration(): Promise<SellerMigrationState> {
    this.log("INFO", "Initializing seller-based product migration")

    const migrationId = `seller_migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const startTime = new Date().toISOString()

    try {
      // Check if there are any eligible products
      const randomProduct = await this.selectRandomProductEntry()

      if (!randomProduct) {
        this.log("INFO", "No eligible products found for migration")

        const migrationState: SellerMigrationState = {
          migrationId,
          startTime,
          currentSeller: null,
          currentBatchProducts: [],
          overallStats: {
            totalSellersProcessed: 0,
            totalProductsUpdated: 0,
            totalProductsSkipped: 0,
            totalErrors: 0,
            totalBatchesProcessed: 0,
          },
          isComplete: true,
          noEligibleProducts: true,
        }

        this.migrationState = migrationState
        this.notifyProgress()
        return migrationState
      }

      // Validate the seller
      const userRecord = await this.getUserCompanyId(randomProduct.seller_id)

      if (!userRecord) {
        throw new Error(`No valid user found for seller_id: ${randomProduct.seller_id}`)
      }

      const migrationState: SellerMigrationState = {
        migrationId,
        startTime,
        currentSeller: null,
        currentBatchProducts: [],
        overallStats: {
          totalSellersProcessed: 0,
          totalProductsUpdated: 0,
          totalProductsSkipped: 0,
          totalErrors: 0,
          totalBatchesProcessed: 0,
        },
        isComplete: false,
      }

      this.migrationState = migrationState
      this.notifyProgress()

      this.log("INFO", "Migration initialized successfully", {
        migrationId,
        initialSellerId: randomProduct.seller_id,
        initialCompanyId: userRecord.company_id,
      })

      return migrationState
    } catch (error) {
      this.log("ERROR", "Migration initialization failed", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Process next seller (main migration loop)
  async processNextSeller(onBatchComplete?: (result: BatchUpdateResult) => void): Promise<boolean> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    if (this.migrationState.isComplete) {
      this.log("INFO", "Migration already complete")
      return false
    }

    try {
      let attempts = 0
      let foundValidSeller = false

      while (attempts < MAX_RANDOM_SELECTION_ATTEMPTS && !foundValidSeller) {
        attempts++
        this.log("DEBUG", `Seller selection attempt ${attempts}/${MAX_RANDOM_SELECTION_ATTEMPTS}`)

        // Step 1: Select random product to get seller_id
        const randomProduct = await this.selectRandomProductEntry()

        if (!randomProduct) {
          this.log("INFO", "No more eligible products found - migration complete")
          this.migrationState.isComplete = true
          this.notifyProgress()
          return false
        }

        // Step 2: Get user and company_id for this seller
        try {
          const userRecord = await this.getUserCompanyId(randomProduct.seller_id)

          if (!userRecord) {
            this.log("WARN", `No valid user found for seller ${randomProduct.seller_id}, trying another seller`)
            continue
          }

          // Step 3: Process all products for this seller
          await this.processSellerProducts(randomProduct.seller_id, userRecord.company_id!, userRecord, onBatchComplete)

          foundValidSeller = true
        } catch (error) {
          this.log("WARN", `Error processing seller ${randomProduct.seller_id}, trying another seller`, {
            error: error instanceof Error ? error.message : String(error),
          })
          continue
        }
      }

      if (!foundValidSeller) {
        this.log("INFO", "No valid sellers found after maximum attempts - migration complete")
        this.migrationState.isComplete = true
        this.notifyProgress()
        return false
      }

      return true
    } catch (error) {
      this.log("ERROR", "Failed to process next seller", {
        error: error instanceof Error ? error.message : String(error),
      })

      if (this.migrationState) {
        this.migrationState.lastError = error instanceof Error ? error.message : String(error)
        this.notifyProgress()
      }

      throw error
    }
  }

  // Process all sellers (complete migration)
  async processAllSellers(
    onBatchComplete?: (result: BatchUpdateResult) => void,
    onSellerComplete?: (sellerId: string, totalProducts: number) => void,
  ): Promise<void> {
    if (!this.migrationState) {
      throw new Error("Migration not initialized")
    }

    this.log("INFO", "Starting to process all sellers")

    try {
      let hasMoreSellers = true
      let sellerCount = 0

      while (hasMoreSellers && sellerCount < 100) {
        // Safety limit
        sellerCount++

        const currentSellerId = this.migrationState.currentSeller?.sellerId
        const currentTotalProducts = this.migrationState.currentSeller?.totalProducts || 0

        hasMoreSellers = await this.processNextSeller(onBatchComplete)

        if (currentSellerId && onSellerComplete) {
          onSellerComplete(currentSellerId, currentTotalProducts)
        }

        if (!hasMoreSellers) {
          break
        }
      }

      this.log("INFO", "Completed processing all sellers", {
        totalSellersProcessed: this.migrationState.overallStats.totalSellersProcessed,
        totalProductsUpdated: this.migrationState.overallStats.totalProductsUpdated,
        totalBatchesProcessed: this.migrationState.overallStats.totalBatchesProcessed,
      })
    } catch (error) {
      this.log("ERROR", "Failed to process all sellers", {
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  // Get current migration state
  getMigrationState(): SellerMigrationState | null {
    return this.migrationState
  }

  // Reset migration
  reset(): void {
    this.log("INFO", "Resetting migration state")
    this.migrationState = null
    this.progressCallbacks.clear()
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    this.log("INFO", `Debug mode ${enabled ? "enabled" : "disabled"}`)
  }
}

// Export singleton instance
export const sellerBasedProductMigrationService = new SellerBasedProductMigrationService()
