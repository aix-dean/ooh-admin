"use client"

import { useState, useRef } from "react"
import { collection, query, where, getDocs, doc, writeBatch, limit, startAfter, orderBy } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Loader2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Package,
  Database,
  TrendingUp,
  FileText,
  Info,
  Building2,
  Users,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MigrationLayout } from "@/components/migration-layout"
import { MigrationStatsCard } from "@/components/migration-stats-card"
import { RealTimeMigrationMonitor } from "@/components/real-time-migration-monitor"

// Types
interface ProductRecord {
  id: string
  seller_id: string
  company_id?: string | null
  name?: string
  status?: string
  price?: number
  created_at?: any
  updated_at?: any
}

interface UserRecord {
  id: string
  company_id?: string | null
  email?: string
  display_name?: string
  name?: string
}

interface BatchResult {
  batchNumber: number
  totalProcessed: number
  successful: number
  skipped: number
  errors: number
  noUserFound: number
  alreadyHasCompanyId: number
  errorMessages: string[]
  processingTime: number
  timestamp: string
  sellersProcessed: string[]
}

interface MigrationProgress {
  phase: "idle" | "scanning" | "processing" | "completed" | "error" | "paused"
  totalProducts: number
  scannedProducts: number
  processedProducts: number
  successfulUpdates: number
  skippedProducts: number
  noUserFound: number
  alreadyHasCompanyId: number
  errorCount: number
  currentBatch: number
  totalBatches: number
  uniqueSellersProcessed: number
  startTime?: Date
  endTime?: Date
  isPaused: boolean
  canResume: boolean
  errorMessage?: string
  estimatedTimeRemaining?: string
}

interface MigrationState {
  progress: MigrationProgress
  currentBatchProducts: ProductRecord[]
  recentBatches: BatchResult[]
  userCache: Map<string, UserRecord | null>
  processedProductIds: Set<string>
  processedSellerIds: Set<string>
  debugLogs: string[]
  lastProcessedDoc?: any
}

const BATCH_SIZE = 50
const SCAN_BATCH_SIZE = 1000
const MAX_DEBUG_LOGS = 100
const CACHE_SIZE_LIMIT = 10000

export default function MigrateProductCompaniesPage() {
  const [migrationState, setMigrationState] = useState<MigrationState>({
    progress: {
      phase: "idle",
      totalProducts: 0,
      scannedProducts: 0,
      processedProducts: 0,
      successfulUpdates: 0,
      skippedProducts: 0,
      noUserFound: 0,
      alreadyHasCompanyId: 0,
      errorCount: 0,
      currentBatch: 0,
      totalBatches: 0,
      uniqueSellersProcessed: 0,
      isPaused: false,
      canResume: false,
    },
    currentBatchProducts: [],
    recentBatches: [],
    userCache: new Map(),
    processedProductIds: new Set(),
    processedSellerIds: new Set(),
    debugLogs: [],
  })

  const [showProductPreview, setShowProductPreview] = useState(false)
  const [productsNeedingMigration, setProductsNeedingMigration] = useState<ProductRecord[]>([])
  const [productCounts, setProductCounts] = useState({
    withCompanyId: 0,
    withoutCompanyId: 0,
    totalScanned: 0,
  })

  // Use ref to track pause state for async operations
  const pauseRequestedRef = useRef(false)

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] ${message}`

    setMigrationState((prev) => ({
      ...prev,
      debugLogs: [...prev.debugLogs.slice(-MAX_DEBUG_LOGS + 1), logMessage],
    }))

    console.log(logMessage)
  }

  // Check if pause was requested
  const checkPauseRequested = (): boolean => {
    return pauseRequestedRef.current
  }

  // Validate company_id
  const isValidCompanyId = (companyId: any): boolean => {
    return (
      companyId !== null &&
      companyId !== undefined &&
      typeof companyId === "string" &&
      companyId.trim() !== "" &&
      companyId.length >= 3
    )
  }

  // Step 1: Scan products collection for documents without company_id
  const scanProductsWithoutCompanyId = async (): Promise<ProductRecord[]> => {
    addDebugLog("Starting comprehensive scan of products collection for documents without company_id")

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        phase: "scanning",
        startTime: new Date(),
      },
    }))

    // Reset counts
    setProductCounts({
      withCompanyId: 0,
      withoutCompanyId: 0,
      totalScanned: 0,
    })

    try {
      const allProducts: ProductRecord[] = []
      let lastDoc: any = null
      let totalScanned = 0
      let withCompanyIdCount = 0
      let withoutCompanyIdCount = 0
      let batchCount = 0

      while (true) {
        // Check for pause request during scanning
        if (checkPauseRequested()) {
          addDebugLog("Pause requested during product scanning - stopping scan")
          throw new Error("Product scanning paused by user")
        }

        batchCount++
        addDebugLog(`Scanning batch ${batchCount} (starting from ${lastDoc ? "last document" : "beginning"})`)

        // Build query for all products with seller_id
        let productsQuery = query(
          collection(db, "products"),
          where("seller_id", "!=", null),
          orderBy("seller_id"),
          limit(SCAN_BATCH_SIZE),
        )

        // Add pagination if we have a last document
        if (lastDoc) {
          productsQuery = query(
            collection(db, "products"),
            where("seller_id", "!=", null),
            orderBy("seller_id"),
            startAfter(lastDoc),
            limit(SCAN_BATCH_SIZE),
          )
        }

        const snapshot = await getDocs(productsQuery)

        if (snapshot.empty) {
          addDebugLog(`No more products found in batch ${batchCount} - scan complete`)
          break
        }

        let batchProductsNeedingMigration = 0
        let batchProductsWithCompanyId = 0

        snapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data()
          const product: ProductRecord = { id: docSnapshot.id, ...data }
          totalScanned++

          // Check if product has valid company_id
          const hasValidCompanyId = isValidCompanyId(data.company_id)

          if (hasValidCompanyId) {
            withCompanyIdCount++
            batchProductsWithCompanyId++
          } else if (data.seller_id && data.seller_id.trim() !== "") {
            withoutCompanyIdCount++
            allProducts.push(product)
            batchProductsNeedingMigration++
          }
        })

        // Update counts in real-time
        setProductCounts({
          withCompanyId: withCompanyIdCount,
          withoutCompanyId: withoutCompanyIdCount,
          totalScanned: totalScanned,
        })

        // Update progress
        setMigrationState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            scannedProducts: totalScanned,
            totalProducts: allProducts.length,
          },
        }))

        addDebugLog(
          `Batch ${batchCount}: Scanned ${snapshot.docs.length} products, found ${batchProductsNeedingMigration} needing migration, ${batchProductsWithCompanyId} already have company_id (${allProducts.length} total need migration, ${withCompanyIdCount} total have company_id)`,
        )

        // Set last document for pagination
        lastDoc = snapshot.docs[snapshot.docs.length - 1]

        // Small delay between batches to prevent overwhelming Firestore
        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      addDebugLog(
        `Product scanning completed: Found ${allProducts.length} products needing migration, ${withCompanyIdCount} products already have company_id, out of ${totalScanned} total products scanned`,
      )

      return allProducts
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addDebugLog(`Error during product scanning: ${errorMessage}`)

      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          phase: "error",
          errorMessage,
        },
      }))

      throw error
    }
  }

  // Step 2: Get user company_id by seller_id (with caching and batch optimization)
  const getUserCompanyId = async (sellerId: string): Promise<UserRecord | null> => {
    // Check cache first
    if (migrationState.userCache.has(sellerId)) {
      const cachedResult = migrationState.userCache.get(sellerId)
      if (cachedResult) {
        addDebugLog(`Cache hit for seller_id: ${sellerId} -> company_id: ${cachedResult.company_id}`)
      } else {
        addDebugLog(`Cache hit for seller_id: ${sellerId} -> no user found`)
      }
      return cachedResult || null
    }

    try {
      addDebugLog(`Querying iboard_users for seller_id: ${sellerId}`)

      // Query iboard_users collection where document ID matches seller_id
      const userQuery = query(collection(db, "iboard_users"), where("__name__", "==", sellerId))
      const userSnapshot = await getDocs(userQuery)

      if (userSnapshot.empty) {
        addDebugLog(`No user found in iboard_users for seller_id: ${sellerId}`)

        // Cache the null result to avoid repeated queries
        setMigrationState((prev) => {
          const newCache = new Map(prev.userCache)
          newCache.set(sellerId, null)

          // Implement cache size limit
          if (newCache.size > CACHE_SIZE_LIMIT) {
            const firstKey = newCache.keys().next().value
            newCache.delete(firstKey)
          }

          return {
            ...prev,
            userCache: newCache,
          }
        })
        return null
      }

      const userDoc = userSnapshot.docs[0]
      const userData = userDoc.data()
      const userRecord: UserRecord = {
        id: userDoc.id,
        company_id: userData.company_id,
        email: userData.email,
        display_name: userData.display_name,
        name: userData.name,
      }

      if (!isValidCompanyId(userRecord.company_id)) {
        addDebugLog(`User ${sellerId} found but has no valid company_id: ${userRecord.company_id}`)

        // Cache the result even if no valid company_id
        setMigrationState((prev) => {
          const newCache = new Map(prev.userCache)
          newCache.set(sellerId, userRecord)

          if (newCache.size > CACHE_SIZE_LIMIT) {
            const firstKey = newCache.keys().next().value
            newCache.delete(firstKey)
          }

          return {
            ...prev,
            userCache: newCache,
          }
        })
        return null
      }

      // Cache the successful result
      setMigrationState((prev) => {
        const newCache = new Map(prev.userCache)
        newCache.set(sellerId, userRecord)

        if (newCache.size > CACHE_SIZE_LIMIT) {
          const firstKey = newCache.keys().next().value
          newCache.delete(firstKey)
        }

        return {
          ...prev,
          userCache: newCache,
        }
      })

      addDebugLog(`Found user ${sellerId} with valid company_id: ${userRecord.company_id}`)
      return userRecord
    } catch (error) {
      addDebugLog(
        `Error getting user for seller_id ${sellerId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return null
    }
  }

  // Step 3: Get all products for a seller_id that need company_id update
  const getAllProductsForSeller = async (sellerId: string): Promise<ProductRecord[]> => {
    try {
      addDebugLog(`Getting all products for seller_id: ${sellerId}`)

      const productsQuery = query(collection(db, "products"), where("seller_id", "==", sellerId))
      const snapshot = await getDocs(productsQuery)

      if (snapshot.empty) {
        addDebugLog(`No products found for seller_id: ${sellerId}`)
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
          price: data.price,
          created_at: data.created_at,
          updated_at: data.updated_at,
        } as ProductRecord
      })

      // Filter products that need migration (no valid company_id)
      const productsNeedingMigration = products.filter((product) => !isValidCompanyId(product.company_id))

      addDebugLog(
        `Found ${products.length} total products for seller ${sellerId}, ${productsNeedingMigration.length} need company_id update`,
      )

      return productsNeedingMigration
    } catch (error) {
      addDebugLog(
        `Error getting products for seller ${sellerId}: ${error instanceof Error ? error.message : String(error)}`,
      )
      return []
    }
  }

  // Step 4: Process a batch of products with seller-based optimization
  const processBatch = async (
    products: ProductRecord[],
    batchNumber: number,
    totalBatches: number,
  ): Promise<BatchResult> => {
    const startTime = Date.now()
    addDebugLog(`Processing batch ${batchNumber}/${totalBatches} with ${products.length} products`)

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentBatch: batchNumber,
      },
      currentBatchProducts: products,
    }))

    const batch = writeBatch(db)
    let successful = 0
    let skipped = 0
    let errors = 0
    let noUserFound = 0
    let alreadyHasCompanyId = 0
    const errorMessages: string[] = []
    const sellersProcessed: string[] = []

    try {
      // Group products by seller_id to optimize user lookups
      const productsBySeller = new Map<string, ProductRecord[]>()

      for (const product of products) {
        if (!productsBySeller.has(product.seller_id)) {
          productsBySeller.set(product.seller_id, [])
        }
        productsBySeller.get(product.seller_id)!.push(product)
      }

      addDebugLog(`Batch ${batchNumber}: Processing ${productsBySeller.size} unique sellers`)

      for (const [sellerId, sellerProducts] of productsBySeller) {
        try {
          // Skip if seller already processed in this session
          if (migrationState.processedSellerIds.has(sellerId)) {
            addDebugLog(`Seller ${sellerId} already processed, skipping ${sellerProducts.length} products`)
            skipped += sellerProducts.length
            continue
          }

          // Get user company_id
          const userRecord = await getUserCompanyId(sellerId)

          if (!userRecord || !userRecord.company_id) {
            addDebugLog(`No valid company_id found for seller ${sellerId}, skipping ${sellerProducts.length} products`)
            noUserFound += sellerProducts.length
            continue
          }

          // Get ALL products for this seller (not just the ones in current batch)
          const allSellerProducts = await getAllProductsForSeller(sellerId)

          if (allSellerProducts.length === 0) {
            addDebugLog(`No products needing migration found for seller ${sellerId}`)
            skipped += sellerProducts.length
            continue
          }

          // Update ALL products for this seller
          let sellerUpdates = 0
          for (const product of allSellerProducts) {
            // Skip if product already processed
            if (migrationState.processedProductIds.has(product.id)) {
              continue
            }

            // Double-check that product doesn't already have company_id
            if (isValidCompanyId(product.company_id)) {
              alreadyHasCompanyId++
              continue
            }

            const productRef = doc(db, "products", product.id)
            const updateData = {
              company_id: userRecord.company_id,
              updated_at: new Date(),
              migration_timestamp: new Date().toISOString(),
              migration_source: "product_company_migration_v3",
              migration_batch: batchNumber,
              migration_seller_id: sellerId,
              migration_user_email: userRecord.email || "unknown",
            }

            batch.update(productRef, updateData)
            sellerUpdates++
          }

          successful += sellerUpdates
          sellersProcessed.push(sellerId)

          addDebugLog(
            `Prepared ${sellerUpdates} product updates for seller ${sellerId} with company_id: ${userRecord.company_id}`,
          )

          // Mark seller as processed
          setMigrationState((prev) => ({
            ...prev,
            processedSellerIds: new Set([...prev.processedSellerIds, sellerId]),
          }))

          // Mark all seller products as processed
          const sellerProductIds = allSellerProducts.map((p) => p.id)
          setMigrationState((prev) => ({
            ...prev,
            processedProductIds: new Set([...prev.processedProductIds, ...sellerProductIds]),
          }))
        } catch (error) {
          const errorMsg = `Error processing seller ${sellerId}: ${error instanceof Error ? error.message : String(error)}`
          addDebugLog(errorMsg)
          errorMessages.push(errorMsg)
          errors += sellerProducts.length
        }
      }

      // Commit the batch if there are updates
      if (successful > 0) {
        await batch.commit()
        addDebugLog(`Successfully committed batch ${batchNumber} with ${successful} product updates`)
      } else {
        addDebugLog(`No products to commit in batch ${batchNumber}`)
      }

      const processingTime = Date.now() - startTime
      const result: BatchResult = {
        batchNumber,
        totalProcessed: products.length,
        successful,
        skipped,
        errors,
        noUserFound,
        alreadyHasCompanyId,
        errorMessages,
        processingTime,
        timestamp: new Date().toISOString(),
        sellersProcessed,
      }

      // Update progress
      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          processedProducts: prev.progress.processedProducts + products.length,
          successfulUpdates: prev.progress.successfulUpdates + successful,
          skippedProducts: prev.progress.skippedProducts + skipped,
          noUserFound: prev.progress.noUserFound + noUserFound,
          alreadyHasCompanyId: prev.progress.alreadyHasCompanyId + alreadyHasCompanyId,
          errorCount: prev.progress.errorCount + errors,
          uniqueSellersProcessed: prev.progress.uniqueSellersProcessed + sellersProcessed.length,
        },
        recentBatches: [result, ...prev.recentBatches.slice(0, 9)], // Keep last 10 batches
        currentBatchProducts: [],
      }))

      addDebugLog(
        `Batch ${batchNumber} completed: ${successful} successful, ${skipped} skipped, ${errors} errors, ${noUserFound} no user found, ${alreadyHasCompanyId} already had company_id, ${sellersProcessed.length} sellers processed`,
      )
      return result
    } catch (error) {
      const errorMsg = `Batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`
      addDebugLog(errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Step 5: Process all products in batches
  const processAllProducts = async (products: ProductRecord[]): Promise<void> => {
    addDebugLog(`Starting to process ${products.length} products in batches of ${BATCH_SIZE}`)

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        phase: "processing",
      },
    }))

    try {
      const totalBatches = Math.ceil(products.length / BATCH_SIZE)

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        // Check for pause request
        if (checkPauseRequested()) {
          addDebugLog("Pause requested during batch processing - pausing migration")
          setMigrationState((prev) => ({
            ...prev,
            progress: {
              ...prev.progress,
              phase: "paused",
              isPaused: true,
              canResume: true,
            },
          }))
          return
        }

        const batchProducts = products.slice(i, i + BATCH_SIZE)
        const batchNumber = Math.floor(i / BATCH_SIZE) + 1

        // Calculate estimated time remaining
        const processedBatches = batchNumber - 1
        if (processedBatches > 0) {
          const avgTimePerBatch =
            migrationState.recentBatches.reduce((sum, batch) => sum + batch.processingTime, 0) /
            Math.min(processedBatches, migrationState.recentBatches.length)
          const remainingBatches = totalBatches - batchNumber + 1
          const estimatedTimeRemaining = Math.round((avgTimePerBatch * remainingBatches) / 1000)

          setMigrationState((prev) => ({
            ...prev,
            progress: {
              ...prev.progress,
              estimatedTimeRemaining: `${Math.floor(estimatedTimeRemaining / 60)}m ${estimatedTimeRemaining % 60}s`,
            },
          }))
        }

        await processBatch(batchProducts, batchNumber, totalBatches)

        // Small delay between batches to prevent overwhelming Firestore
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // Migration completed
      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          phase: "completed",
          endTime: new Date(),
          isPaused: false,
          canResume: false,
        },
      }))

      addDebugLog("Product migration completed successfully!")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addDebugLog(`Product migration failed: ${errorMessage}`)

      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          phase: "error",
          errorMessage,
        },
      }))

      throw error
    }
  }

  // Main migration function
  const startMigration = async () => {
    pauseRequestedRef.current = false
    addDebugLog("Starting optimized product company migration process")

    try {
      // Step 1: Scan for products without company_id
      const products = await scanProductsWithoutCompanyId()
      setProductsNeedingMigration(products)

      if (products.length === 0) {
        addDebugLog("No products found that need migration")
        setMigrationState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            phase: "completed",
            endTime: new Date(),
          },
        }))
        return
      }

      const totalBatches = Math.ceil(products.length / BATCH_SIZE)
      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          totalProducts: products.length,
          totalBatches,
        },
      }))

      // Step 2: Process products in batches
      await processAllProducts(products)
    } catch (error) {
      addDebugLog(`Migration process failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Pause migration
  const pauseMigration = () => {
    addDebugLog("Pause requested - will pause after current batch completes")
    pauseRequestedRef.current = true
  }

  // Resume migration
  const resumeMigration = async () => {
    if (productsNeedingMigration.length === 0) {
      addDebugLog("No products available to resume migration")
      return
    }

    addDebugLog("Resuming migration from current position")
    pauseRequestedRef.current = false

    // Filter out already processed products
    const remainingProducts = productsNeedingMigration.filter(
      (product) => !migrationState.processedProductIds.has(product.id),
    )

    if (remainingProducts.length === 0) {
      addDebugLog("All products have been processed")
      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          phase: "completed",
          endTime: new Date(),
          isPaused: false,
          canResume: false,
        },
      }))
      return
    }

    try {
      await processAllProducts(remainingProducts)
    } catch (error) {
      addDebugLog(`Resume migration failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Reset migration
  const resetMigration = () => {
    pauseRequestedRef.current = false
    setMigrationState({
      progress: {
        phase: "idle",
        totalProducts: 0,
        scannedProducts: 0,
        processedProducts: 0,
        successfulUpdates: 0,
        skippedProducts: 0,
        noUserFound: 0,
        alreadyHasCompanyId: 0,
        errorCount: 0,
        currentBatch: 0,
        totalBatches: 0,
        uniqueSellersProcessed: 0,
        isPaused: false,
        canResume: false,
      },
      currentBatchProducts: [],
      recentBatches: [],
      userCache: new Map(),
      processedProductIds: new Set(),
      processedSellerIds: new Set(),
      debugLogs: [],
    })
    setProductsNeedingMigration([])
    setProductCounts({
      withCompanyId: 0,
      withoutCompanyId: 0,
      totalScanned: 0,
    })
    addDebugLog("Migration reset completed")
  }

  const { progress } = migrationState
  const progressPercentage =
    progress.totalProducts > 0 ? Math.round((progress.processedProducts / progress.totalProducts) * 100) : 0

  const canStart = progress.phase === "idle"
  const canPause = progress.phase === "processing" && !progress.isPaused
  const canResume = progress.phase === "paused" && progress.canResume
  const canReset = progress.phase !== "processing" || progress.isPaused

  return (
    <MigrationLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Product Company Migration</h1>
            <p className="text-muted-foreground">
              Migrate products without company_id by extracting company information from iboard_users collection
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Database className="h-4 w-4" />
              <span>Optimized batch processing with seller-based grouping and caching</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canStart && (
              <Button onClick={startMigration} className="gap-2">
                <Play className="h-4 w-4" />
                Start Migration
              </Button>
            )}

            {canPause && (
              <Button onClick={pauseMigration} variant="outline" className="gap-2">
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}

            {canResume && (
              <Button onClick={resumeMigration} className="gap-2">
                <Play className="h-4 w-4" />
                Resume Migration
              </Button>
            )}

            <Button onClick={resetMigration} disabled={!canReset} variant="outline" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Real-Time Migration Monitor */}
        <RealTimeMigrationMonitor
          migrationName="Product Company Migration"
          isRunning={progress.phase === "processing"}
          totalItems={progress.totalProducts}
          processedItems={progress.processedProducts}
          successfulItems={progress.successfulUpdates}
          errorItems={progress.errorCount}
          skippedItems={progress.skippedProducts + progress.noUserFound + progress.alreadyHasCompanyId}
          processingRate={progress.phase === "processing" ? 3.2 : undefined}
          onRefresh={() => {}}
        />

        {/* Migration Stats Card */}
        <MigrationStatsCard
          title="Product Migration Statistics"
          description="Real-time progress of product company_id migration from iboard_users data"
          stats={{
            totalItems: progress.totalProducts,
            processedItems: progress.processedProducts,
            successfulItems: progress.successfulUpdates,
            errorItems: progress.errorCount,
            skippedItems: progress.skippedProducts + progress.noUserFound + progress.alreadyHasCompanyId,
            lastUpdated: new Date(),
          }}
        />

        {/* Scanning Progress Card */}
        {progress.phase === "scanning" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning Products Collection
              </CardTitle>
              <CardDescription>
                Real-time analysis of products collection to identify migration candidates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{productCounts.withCompanyId}</div>
                  <div className="text-sm text-muted-foreground">Already have company_id</div>
                  <div className="text-xs text-green-600">
                    {productCounts.totalScanned > 0
                      ? Math.round((productCounts.withCompanyId / productCounts.totalScanned) * 100)
                      : 0}
                    %
                  </div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{productCounts.withoutCompanyId}</div>
                  <div className="text-sm text-muted-foreground">Need migration</div>
                  <div className="text-xs text-orange-600">
                    {productCounts.totalScanned > 0
                      ? Math.round((productCounts.withoutCompanyId / productCounts.totalScanned) * 100)
                      : 0}
                    %
                  </div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{productCounts.totalScanned}</div>
                  <div className="text-sm text-muted-foreground">Total scanned</div>
                  <div className="text-xs text-blue-600">Products analyzed</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Scanning Progress</span>
                  <span>{productCounts.totalScanned} products analyzed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Database className="h-4 w-4" />
                  <span>Analyzing products collection...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Alerts */}
        {progress.phase === "completed" && progress.totalProducts === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No products were found that require migration. All products in the collection already have a company_id
              assigned.
            </AlertDescription>
          </Alert>
        )}

        {progress.phase === "completed" && progress.totalProducts > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Migration completed successfully! {progress.successfulUpdates} products were updated with company IDs from
              iboard_users data. {progress.uniqueSellersProcessed} unique sellers were processed.
            </AlertDescription>
          </Alert>
        )}

        {progress.phase === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Migration process encountered an error: {progress.errorMessage}</AlertDescription>
          </Alert>
        )}

        {progress.phase === "paused" && (
          <Alert>
            <Pause className="h-4 w-4" />
            <AlertDescription>
              Migration is paused. Progress has been saved and can be resumed later. Processed{" "}
              {progress.processedProducts} of {progress.totalProducts} products.
            </AlertDescription>
          </Alert>
        )}

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Migration Progress
              <Badge
                variant={
                  progress.phase === "completed" ? "success" : progress.phase === "error" ? "destructive" : "default"
                }
              >
                {progress.phase.toUpperCase()}
              </Badge>
            </CardTitle>
            <CardDescription>
              {progress.phase === "idle" && "Ready to start product migration"}
              {progress.phase === "scanning" && "Scanning products collection for documents without company_id"}
              {progress.phase === "processing" &&
                `Processing batch ${progress.currentBatch} of ${progress.totalBatches}`}
              {progress.phase === "completed" && "Migration process completed"}
              {progress.phase === "error" && "Migration process encountered an error"}
              {progress.phase === "paused" && "Migration is paused and can be resumed"}
              {progress.estimatedTimeRemaining && (
                <span className="ml-2 text-sm">• ETA: {progress.estimatedTimeRemaining}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.totalProducts > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {progress.processedProducts} of {progress.totalProducts} products processed
                </div>
              </div>
            )}

            {(progress.phase === "processing" || progress.phase === "scanning") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.phase === "scanning" ? "Scanning products..." : "Processing products..."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
          {productCounts.totalScanned > 0 && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Scanned</CardTitle>
                  <Database className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{productCounts.totalScanned}</div>
                  <p className="text-xs text-blue-600">Total products analyzed</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Have Company</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{productCounts.withCompanyId}</div>
                  <p className="text-xs text-green-600">
                    {productCounts.totalScanned > 0
                      ? Math.round((productCounts.withCompanyId / productCounts.totalScanned) * 100)
                      : 0}
                    % of total
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Need Migration</CardTitle>
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">{productCounts.withoutCompanyId}</div>
                  <p className="text-xs text-orange-600">
                    {productCounts.totalScanned > 0
                      ? Math.round((productCounts.withoutCompanyId / productCounts.totalScanned) * 100)
                      : 0}
                    % of total
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress.totalProducts}</div>
              <p className="text-xs text-muted-foreground">Products found</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress.processedProducts}</div>
              <p className="text-xs text-muted-foreground">{progressPercentage}% complete</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{progress.successfulUpdates}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No User</CardTitle>
              <Users className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{progress.noUserFound}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Has Company</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{progress.alreadyHasCompanyId}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sellers</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{progress.uniqueSellersProcessed}</div>
              <p className="text-xs text-purple-600">Unique sellers</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache</CardTitle>
              <Database className="h-4 w-4 text-gray-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-600">{migrationState.userCache.size}</div>
              <p className="text-xs text-gray-600">Cached users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{progress.errorCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Current Batch Processing */}
        {migrationState.currentBatchProducts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Current Batch Processing
              </CardTitle>
              <CardDescription>
                Batch {progress.currentBatch} of {progress.totalBatches} - Processing{" "}
                {migrationState.currentBatchProducts.length} products
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {migrationState.currentBatchProducts.slice(0, 5).map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{product.name || "Unnamed Product"}</div>
                      <div className="text-sm text-muted-foreground">ID: {product.id}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">Seller: {product.seller_id}</div>
                      <Badge variant="outline" className="text-xs">
                        Processing
                      </Badge>
                    </div>
                  </div>
                ))}
                {migrationState.currentBatchProducts.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground">
                    ... and {migrationState.currentBatchProducts.length - 5} more products
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Batch Results */}
        {migrationState.recentBatches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Batch Results</CardTitle>
              <CardDescription>Latest batch processing results with detailed metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {migrationState.recentBatches.slice(0, 5).map((batch) => (
                  <div key={batch.batchNumber} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full",
                          batch.errors > 0 ? "bg-red-500" : batch.successful > 0 ? "bg-green-500" : "bg-yellow-500",
                        )}
                      />
                      <div>
                        <div className="font-medium">Batch {batch.batchNumber}</div>
                        <div className="text-sm text-muted-foreground">
                          {batch.totalProcessed} products • {batch.sellersProcessed.length} sellers
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex gap-2 mb-1">
                        <Badge variant="success" className="text-xs">
                          {batch.successful} success
                        </Badge>
                        {batch.noUserFound > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {batch.noUserFound} no user
                          </Badge>
                        )}
                        {batch.alreadyHasCompanyId > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {batch.alreadyHasCompanyId} has company
                          </Badge>
                        )}
                        {batch.skipped > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            {batch.skipped} skipped
                          </Badge>
                        )}
                        {batch.errors > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {batch.errors} errors
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {batch.processingTime}ms
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Products Preview */}
        {productsNeedingMigration.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Products Discovery Results
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{productsNeedingMigration.length} found</Badge>
                  <Button variant="outline" size="sm" onClick={() => setShowProductPreview(!showProductPreview)}>
                    {showProductPreview ? "Hide" : "Show"} Preview
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>Products identified during scanning that require company_id migration</CardDescription>
            </CardHeader>
            {showProductPreview && (
              <CardContent>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Product ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Seller ID</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Current Company ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsNeedingMigration.slice(0, 20).map((product) => (
                        <TableRow key={product.id}>
                          <TableCell>
                            {migrationState.processedProductIds.has(product.id) ? (
                              <Badge variant="success" className="text-xs">
                                Processed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{product.id}</TableCell>
                          <TableCell>{product.name || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{product.seller_id}</TableCell>
                          <TableCell>{product.price ? `$${product.price}` : "-"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {product.company_id || "None"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {productsNeedingMigration.length > 20 && (
                    <div className="p-4 text-center text-sm text-muted-foreground border-t">
                      Showing first 20 of {productsNeedingMigration.length} products
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Debug Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Process Logs</CardTitle>
            <CardDescription>Real-time migration progress and debug information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-lg max-h-60 overflow-y-auto">
              {migrationState.debugLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No logs yet...</p>
              ) : (
                <div className="space-y-1">
                  {migrationState.debugLogs.map((log, index) => (
                    <div key={index} className="text-xs font-mono text-gray-700">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MigrationLayout>
  )
}
