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

export interface QuotationRecord {
  id: string
  seller_id: string
  company_id?: string | null
  buyer_id?: string
  status?: string
  created_at?: any
  updated_at?: any
  [key: string]: any
}

export interface QuotationBatch {
  quotations: QuotationRecord[]
  hasMore: boolean
  lastDoc?: QueryDocumentSnapshot<DocumentData>
  batchNumber: number
  totalProcessed: number
  debugInfo?: {
    queryUsed: string
    docsReturned: number
    lastDocId?: string
    timestamp: string
  }
}

export interface QuotationMigrationResult {
  sellerId: string
  companyId: string
  currentBatch: QuotationBatch
  allBatches: QuotationBatch[]
  totalUpdated: number
  totalSkipped: number
  totalErrors: number
  isComplete: boolean
  migrationId: string
  startTime: string
  debugInfo?: {
    initializationAttempts: number
    batchLoadAttempts: number
    cacheHits: number
    cacheMisses: number
    errors: Array<{ timestamp: string; error: string; context: string }>
  }
}

export interface QuotationMigrationProgress {
  currentBatch: number
  totalBatches: number
  processedQuotations: number
  remainingQuotations: number
  estimatedTotal: number
  progressPercentage: number
  migrationId: string
}

const QUOTATIONS_PER_BATCH = 10
const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000

export class QuotationMigrationService {
  private migrationState: QuotationMigrationResult | null = null
  private progressCallbacks: Set<(progress: QuotationMigrationProgress) => void> = new Set()
  private isInitializing = false
  private isLoadingBatch = false
  private debugMode = true

  // Enhanced logging
  private log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, data?: any) {
    const timestamp = new Date().toISOString()
    const logMessage = `[${level}] [QuotationMigrationService] ${message}`

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
  onProgressUpdate(callback: (progress: QuotationMigrationProgress) => void): () => void {
    this.progressCallbacks.add(callback)
    return () => this.progressCallbacks.delete(callback)
  }

  private notifyProgress(progress: QuotationMigrationProgress) {
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

  // Get first quotation batch for a seller
  async getFirstQuotationBatch(sellerId: string): Promise<QuotationBatch> {
    this.log("INFO", `Starting first quotation batch retrieval for seller: ${sellerId}`)

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for quotation batch retrieval")
    }

    return this.retryOperation(async () => {
      try {
        // Check cache first
        this.log("DEBUG", "Checking cache for existing quotations", { sellerId })

        const cachedQuotations = await migrationCache.getCachedQuotations(sellerId)

        if (cachedQuotations && cachedQuotations.length > 0) {
          this.log("INFO", "Using cached quotations for first batch", {
            sellerId,
            totalCachedQuotations: cachedQuotations.length,
            cacheHit: true,
          })

          // Validate cached data
          const validQuotations = cachedQuotations.filter((q) => q.id && q.seller_id === sellerId)
          if (validQuotations.length !== cachedQuotations.length) {
            this.log("WARN", "Some cached quotations are invalid", {
              totalCached: cachedQuotations.length,
              validQuotations: validQuotations.length,
              invalidQuotations: cachedQuotations.length - validQuotations.length,
            })
          }

          const firstBatch = validQuotations.slice(0, QUOTATIONS_PER_BATCH)
          let hasMore = validQuotations.length > QUOTATIONS_PER_BATCH

          // For cached results, we need to fetch the lastDoc cursor if there are more batches
          let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined = undefined

          if (hasMore && firstBatch.length > 0) {
            try {
              // Get the actual document reference for the last quotation in the batch
              const lastQuotationId = firstBatch[firstBatch.length - 1].id
              const lastDocRef = doc(db, "quotation_request", lastQuotationId)
              const lastDocSnapshot = await getDoc(lastDocRef)

              if (lastDocSnapshot.exists()) {
                lastDoc = lastDocSnapshot as QueryDocumentSnapshot<DocumentData>
                this.log("DEBUG", "Retrieved lastDoc cursor for cached quotation batch", {
                  lastDocId: lastDoc.id,
                })
              } else {
                this.log(
                  "WARN",
                  "Could not retrieve lastDoc for cached quotation batch - falling back to Firestore query",
                )
                // Fall back to fresh Firestore query to ensure proper pagination
                const quotationsQuery = query(
                  collection(db, "quotation_request"),
                  where("seller_id", "==", sellerId),
                  orderBy("__name__"),
                  limit(QUOTATIONS_PER_BATCH),
                )
                const snapshot = await getDocs(quotationsQuery)
                if (!snapshot.empty) {
                  lastDoc = snapshot.docs[snapshot.docs.length - 1]
                }
              }
            } catch (error) {
              this.log("ERROR", "Failed to get lastDoc cursor for cached quotation batch", {
                error: error instanceof Error ? error.message : String(error),
              })
              // Continue without lastDoc - hasMore will be set to false to prevent pagination issues
              hasMore = false
            }
          }

          const batch: QuotationBatch = {
            quotations: firstBatch,
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

          this.log("INFO", "First quotation batch created from cache with cursor", {
            batchSize: firstBatch.length,
            hasMore: batch.hasMore,
            totalAvailable: validQuotations.length,
            lastDocId: lastDoc?.id,
          })

          return batch
        }

        // Cache miss - fetch from Firestore with enhanced pagination
        this.log("INFO", "Cache miss - fetching first quotation batch from Firestore", { sellerId })

        const quotationsQuery = query(
          collection(db, "quotation_request"),
          where("seller_id", "==", sellerId),
          orderBy("__name__"),
          limit(QUOTATIONS_PER_BATCH),
        )

        this.log("DEBUG", "Executing first quotation batch query", {
          sellerId,
          batchSize: QUOTATIONS_PER_BATCH,
          queryConstraints: [`seller_id == ${sellerId}`, "orderBy __name__", `limit ${QUOTATIONS_PER_BATCH}`],
        })

        const snapshot = await getDocs(quotationsQuery)

        this.log("INFO", "First quotation batch query completed", {
          docsReturned: snapshot.size,
          isEmpty: snapshot.empty,
          queryExecutionTime: Date.now(),
        })

        if (snapshot.empty) {
          this.log("WARN", "No quotations found for seller", { sellerId })
          throw new Error(`No quotations found for seller_id: ${sellerId}`)
        }

        const quotations = snapshot.docs.map((doc, index) => {
          const data = doc.data()
          const quotation = {
            id: doc.id,
            seller_id: data.seller_id,
            company_id: data.company_id,
            buyer_id: data.buyer_id,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
            ...data, // Include all other fields
          } as QuotationRecord

          this.log("DEBUG", `First batch quotation ${index + 1}`, {
            id: quotation.id,
            buyer_id: quotation.buyer_id,
            has_company_id: !!quotation.company_id,
          })

          return quotation
        })

        const lastDoc = snapshot.docs[snapshot.docs.length - 1]
        const hasMore = snapshot.docs.length === QUOTATIONS_PER_BATCH

        const batch: QuotationBatch = {
          quotations,
          hasMore,
          lastDoc,
          batchNumber: 1,
          totalProcessed: quotations.length,
          debugInfo: {
            queryUsed: "FIRESTORE_FIRST_BATCH",
            docsReturned: quotations.length,
            lastDocId: lastDoc?.id,
            timestamp: new Date().toISOString(),
          },
        }

        this.log("INFO", "First quotation batch created successfully", {
          batchSize: quotations.length,
          hasMore,
          lastDocId: lastDoc?.id,
          totalProcessed: quotations.length,
        })

        return batch
      } catch (error) {
        this.log("ERROR", "First quotation batch retrieval failed", {
          sellerId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "getFirstQuotationBatch")
  }

  // Get next quotation batch with proper cursor management
  async getNextQuotationBatch(
    sellerId: string,
    lastDoc: QueryDocumentSnapshot<DocumentData>,
    batchNumber: number,
    totalProcessed: number,
  ): Promise<QuotationBatch> {
    this.log("INFO", `Starting next quotation batch retrieval`, {
      sellerId,
      batchNumber,
      totalProcessed,
      lastDocId: lastDoc?.id,
    })

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for next quotation batch retrieval")
    }

    if (!lastDoc) {
      throw new Error("No lastDoc provided for pagination - cannot retrieve next quotation batch")
    }

    return this.retryOperation(async () => {
      try {
        this.log("DEBUG", "Constructing next quotation batch query", {
          sellerId,
          batchNumber,
          lastDocId: lastDoc.id,
          lastDocPath: lastDoc.ref.path,
        })

        const quotationsQuery = query(
          collection(db, "quotation_request"),
          where("seller_id", "==", sellerId),
          orderBy("__name__"),
          startAfter(lastDoc),
          limit(QUOTATIONS_PER_BATCH),
        )

        this.log("DEBUG", "Executing next quotation batch query", {
          sellerId,
          batchNumber,
          batchSize: QUOTATIONS_PER_BATCH,
          queryConstraints: [
            `seller_id == ${sellerId}`,
            "orderBy __name__",
            `startAfter ${lastDoc.id}`,
            `limit ${QUOTATIONS_PER_BATCH}`,
          ],
        })

        const snapshot = await getDocs(quotationsQuery)

        this.log("INFO", "Next quotation batch query completed", {
          batchNumber,
          docsReturned: snapshot.size,
          isEmpty: snapshot.empty,
          queryExecutionTime: Date.now(),
        })

        const quotations = snapshot.docs.map((doc, index) => {
          const data = doc.data()
          const quotation = {
            id: doc.id,
            seller_id: data.seller_id,
            company_id: data.company_id,
            buyer_id: data.buyer_id,
            status: data.status,
            created_at: data.created_at,
            updated_at: data.updated_at,
            ...data, // Include all other fields
          } as QuotationRecord

          this.log("DEBUG", `Next batch quotation ${index + 1}`, {
            batchNumber,
            id: quotation.id,
            buyer_id: quotation.buyer_id,
            has_company_id: !!quotation.company_id,
          })

          return quotation
        })

        const newLastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null
        const hasMore = snapshot.docs.length === QUOTATIONS_PER_BATCH

        const batch: QuotationBatch = {
          quotations,
          hasMore,
          lastDoc: newLastDoc || undefined,
          batchNumber,
          totalProcessed: totalProcessed + quotations.length,
          debugInfo: {
            queryUsed: "FIRESTORE_NEXT_BATCH",
            docsReturned: quotations.length,
            lastDocId: newLastDoc?.id,
            timestamp: new Date().toISOString(),
          },
        }

        this.log("INFO", "Next quotation batch created successfully", {
          batchNumber,
          batchSize: quotations.length,
          hasMore,
          newLastDocId: newLastDoc?.id,
          totalProcessed: batch.totalProcessed,
        })

        return batch
      } catch (error) {
        this.log("ERROR", "Next quotation batch retrieval failed", {
          sellerId,
          batchNumber,
          lastDocId: lastDoc?.id,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "getNextQuotationBatch")
  }

  // Update quotation batch with company_id
  async updateQuotationBatch(
    quotations: QuotationRecord[],
    companyId: string,
    sellerId: string,
    batchNumber: number,
  ): Promise<{ updated: number; skipped: number; errors: number }> {
    this.log("INFO", `Starting quotation batch update`, {
      batchNumber,
      totalQuotations: quotations.length,
      companyId,
      sellerId,
    })

    if (!quotations || quotations.length === 0) {
      this.log("WARN", "No quotations provided for batch update", { batchNumber })
      return { updated: 0, skipped: 0, errors: 0 }
    }

    if (!companyId || companyId.trim() === "") {
      throw new Error("Invalid company_id provided for quotation batch update")
    }

    if (!sellerId || sellerId.trim() === "") {
      throw new Error("Invalid seller_id provided for quotation batch update")
    }

    return this.retryOperation(async () => {
      try {
        // Pre-filter and validate quotations
        const quotationsToUpdate = quotations.filter((quotation) => {
          const needsUpdate = !quotation.company_id || quotation.company_id === null || quotation.company_id === ""
          const isValid = quotation.id && quotation.seller_id === sellerId

          this.log("DEBUG", `Quotation validation`, {
            batchNumber,
            quotationId: quotation.id,
            needsUpdate,
            isValid,
            currentCompanyId: quotation.company_id,
          })

          return needsUpdate && isValid
        })

        const skippedCount = quotations.length - quotationsToUpdate.length

        this.log("INFO", "Quotation batch update pre-filtering completed", {
          batchNumber,
          totalQuotations: quotations.length,
          quotationsToUpdate: quotationsToUpdate.length,
          skippedCount,
          filterReason: "already has company_id or invalid data",
        })

        if (quotationsToUpdate.length === 0) {
          this.log("WARN", "No quotations require updating in this batch", { batchNumber })
          return { updated: 0, skipped: skippedCount, errors: 0 }
        }

        let updatedCount = 0
        let errorCount = 0

        const batch = writeBatch(db)
        const updateTimestamp = new Date()

        const updateData = {
          company_id: companyId,
          updated_at: updateTimestamp,
          migration_source: "quotation_migration_service",
          migration_timestamp: updateTimestamp.toISOString(),
          migration_seller_id: sellerId,
          migration_batch: batchNumber,
          migration_id: this.migrationState?.migrationId || "unknown",
        }

        this.log("DEBUG", "Preparing quotation batch write operation", {
          batchNumber,
          updateData,
          quotationsToUpdate: quotationsToUpdate.length,
        })

        for (const quotation of quotationsToUpdate) {
          try {
            if (!quotation.id) {
              throw new Error("Quotation missing ID")
            }

            const quotationRef = doc(db, "quotation_request", quotation.id)
            batch.update(quotationRef, updateData)

            this.log("DEBUG", "Added quotation to batch write", {
              batchNumber,
              quotationId: quotation.id,
              buyerId: quotation.buyer_id,
            })
          } catch (err) {
            this.log("ERROR", "Error adding quotation to batch write", {
              batchNumber,
              quotationId: quotation.id,
              error: err instanceof Error ? err.message : String(err),
            })
            errorCount++
          }
        }

        if (quotationsToUpdate.length - errorCount > 0) {
          this.log("DEBUG", "Committing quotation batch write", {
            batchNumber,
            quotationsInBatch: quotationsToUpdate.length - errorCount,
          })

          await batch.commit()
          updatedCount = quotationsToUpdate.length - errorCount

          this.log("INFO", "Quotation batch write committed successfully", {
            batchNumber,
            updatedCount,
            commitTimestamp: new Date().toISOString(),
          })

          // Invalidate cache after successful update
          migrationCache.invalidateAfterUpdate(sellerId, "QUOTATION")
          this.log("DEBUG", "Cache invalidated after quotation batch update", {
            batchNumber,
            sellerId,
          })
        } else {
          this.log("WARN", "No quotations to commit in batch", {
            batchNumber,
            totalErrors: errorCount,
          })
        }

        const result = { updated: updatedCount, skipped: skippedCount, errors: errorCount }

        this.log("INFO", "Quotation batch update completed", {
          batchNumber,
          result,
          completionTimestamp: new Date().toISOString(),
        })

        return result
      } catch (error) {
        this.log("ERROR", "Quotation batch update failed", {
          batchNumber,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
        throw error
      }
    }, "updateQuotationBatch")
  }

  // Initialize quotation migration
  async initializeQuotationMigration(sellerId: string, companyId: string): Promise<QuotationMigrationResult> {
    if (this.isInitializing) {
      this.log("WARN", "Quotation migration initialization already in progress")
      throw new Error("Quotation migration initialization already in progress")
    }

    this.isInitializing = true
    this.log("INFO", "Starting quotation migration initialization")

    try {
      // Generate unique migration ID
      const migrationId = `quotation_migration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      const startTime = new Date().toISOString()

      this.log("INFO", "Generated quotation migration session", {
        migrationId,
        startTime,
        sellerId,
        companyId,
      })

      // Clear any existing state
      this.reset()
      this.log("DEBUG", "Previous quotation migration state cleared")

      // Get first batch
      this.log("DEBUG", "Getting first quotation batch")
      const firstBatch = await this.getFirstQuotationBatch(sellerId)

      // Create migration result
      const migrationResult: QuotationMigrationResult = {
        sellerId,
        companyId,
        currentBatch: firstBatch,
        allBatches: [firstBatch],
        totalUpdated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        isComplete: !firstBatch.hasMore,
        migrationId,
        startTime,
        debugInfo: {
          initializationAttempts: 1,
          batchLoadAttempts: 0,
          cacheHits: 0,
          cacheMisses: 0,
          errors: [],
        },
      }

      this.migrationState = migrationResult

      // Notify progress
      this.notifyProgress({
        currentBatch: 1,
        totalBatches: firstBatch.hasMore ? -1 : 1,
        processedQuotations: firstBatch.quotations.length,
        remainingQuotations: firstBatch.hasMore ? -1 : 0,
        estimatedTotal: firstBatch.hasMore ? -1 : firstBatch.quotations.length,
        progressPercentage: firstBatch.hasMore ? 0 : 100,
        migrationId,
      })

      this.log("INFO", "Quotation migration initialization completed successfully", {
        migrationId,
        sellerId,
        companyId,
        firstBatchSize: firstBatch.quotations.length,
        hasMoreBatches: firstBatch.hasMore,
        isComplete: migrationResult.isComplete,
      })

      return migrationResult
    } catch (error) {
      this.log("ERROR", "Quotation migration initialization failed", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    } finally {
      this.isInitializing = false
    }
  }

  // Load next quotation batch
  async loadNextQuotationBatch(): Promise<boolean> {
    if (!this.migrationState) {
      throw new Error("Quotation migration not initialized - cannot load next batch")
    }

    if (this.isLoadingBatch) {
      this.log("WARN", "Quotation batch loading already in progress")
      throw new Error("Quotation batch loading already in progress")
    }

    this.isLoadingBatch = true

    try {
      const { currentBatch, sellerId, migrationId } = this.migrationState

      this.log("INFO", "Starting next quotation batch loading", {
        migrationId,
        currentBatchNumber: currentBatch.batchNumber,
        hasMore: currentBatch.hasMore,
        lastDocId: currentBatch.lastDoc?.id,
      })

      // Validate current state
      if (!currentBatch.hasMore) {
        this.log("INFO", "No more quotation batches to load - migration complete", { migrationId })
        this.migrationState.isComplete = true
        return false
      }

      if (!currentBatch.lastDoc) {
        this.log("ERROR", "Cannot load next quotation batch - no lastDoc cursor available", {
          migrationId,
          currentBatchNumber: currentBatch.batchNumber,
          batchHasMore: currentBatch.hasMore,
          debugInfo: currentBatch.debugInfo,
        })

        // Try to recover by re-fetching the current batch with proper cursor
        this.log("INFO", "Attempting to recover by re-fetching current quotation batch")
        try {
          const recoveryBatch = await this.getFirstQuotationBatch(sellerId)
          if (recoveryBatch.lastDoc) {
            this.migrationState.currentBatch = recoveryBatch
            this.log("INFO", "Successfully recovered quotation batch with cursor", {
              lastDocId: recoveryBatch.lastDoc.id,
            })
            // Don't return here, continue with the recovery batch
          } else {
            this.log("ERROR", "Quotation recovery failed - no cursor available")
            this.migrationState.isComplete = true
            return false
          }
        } catch (recoveryError) {
          this.log("ERROR", "Quotation recovery attempt failed", {
            error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
          })
          this.migrationState.isComplete = true
          return false
        }
      }

      // Increment batch load attempts
      if (this.migrationState.debugInfo) {
        this.migrationState.debugInfo.batchLoadAttempts++
      }

      this.log("DEBUG", "Loading next quotation batch with cursor", {
        migrationId,
        sellerId,
        currentBatchNumber: currentBatch.batchNumber,
        nextBatchNumber: currentBatch.batchNumber + 1,
        lastDocId: currentBatch.lastDoc.id,
        totalProcessed: currentBatch.totalProcessed,
      })

      const nextBatch = await this.getNextQuotationBatch(
        sellerId,
        currentBatch.lastDoc,
        currentBatch.batchNumber + 1,
        currentBatch.totalProcessed,
      )

      // Update migration state
      this.migrationState.currentBatch = nextBatch
      this.migrationState.allBatches.push(nextBatch)
      this.migrationState.isComplete = !nextBatch.hasMore

      this.log("INFO", "Next quotation batch loaded successfully", {
        migrationId,
        batchNumber: nextBatch.batchNumber,
        batchSize: nextBatch.quotations.length,
        hasMore: nextBatch.hasMore,
        totalProcessed: nextBatch.totalProcessed,
        isComplete: this.migrationState.isComplete,
      })

      // Notify progress
      const totalProcessed = this.migrationState.allBatches.reduce((sum, batch) => sum + batch.quotations.length, 0)
      this.notifyProgress({
        currentBatch: nextBatch.batchNumber,
        totalBatches: nextBatch.hasMore ? -1 : nextBatch.batchNumber,
        processedQuotations: totalProcessed,
        remainingQuotations: nextBatch.hasMore ? -1 : 0,
        estimatedTotal: nextBatch.hasMore ? -1 : totalProcessed,
        progressPercentage: nextBatch.hasMore ? 0 : 100,
        migrationId,
      })

      return true
    } catch (error) {
      this.log("ERROR", "Failed to load next quotation batch", {
        migrationId: this.migrationState?.migrationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    } finally {
      this.isLoadingBatch = false
    }
  }

  // Process current quotation batch
  async processCurrentQuotationBatch(): Promise<void> {
    if (!this.migrationState) {
      throw new Error("Quotation migration not initialized")
    }

    const { currentBatch, companyId, sellerId, migrationId } = this.migrationState

    this.log("INFO", "Starting current quotation batch processing", {
      migrationId,
      batchNumber: currentBatch.batchNumber,
      batchSize: currentBatch.quotations.length,
      companyId,
      sellerId,
    })

    try {
      const updateResults = await this.updateQuotationBatch(
        currentBatch.quotations,
        companyId,
        sellerId,
        currentBatch.batchNumber,
      )

      // Update totals
      this.migrationState.totalUpdated += updateResults.updated
      this.migrationState.totalSkipped += updateResults.skipped
      this.migrationState.totalErrors += updateResults.errors

      this.log("INFO", "Current quotation batch processed successfully", {
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
      this.log("ERROR", "Failed to process current quotation batch", {
        migrationId,
        batchNumber: currentBatch.batchNumber,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // Process all quotation batches
  async processAllQuotationBatches(
    onBatchComplete?: (
      batchNumber: number,
      results: { total: number; updated: number; skipped: number; errors: number },
    ) => void,
  ): Promise<void> {
    if (!this.migrationState) {
      throw new Error("Quotation migration not initialized")
    }

    const { migrationId } = this.migrationState

    this.log("INFO", "Starting process all quotation batches", { migrationId })

    try {
      // Process current batch first
      await this.processCurrentQuotationBatch()

      if (onBatchComplete) {
        const totalQuotations = this.migrationState.allBatches.reduce((sum, batch) => sum + batch.quotations.length, 0)
        onBatchComplete(this.migrationState.currentBatch.batchNumber, {
          total: totalQuotations,
          updated: this.migrationState.totalUpdated,
          skipped: this.migrationState.totalSkipped,
          errors: this.migrationState.totalErrors,
        })
      }

      // Continue with remaining batches
      let batchCount = 1
      while (!this.migrationState.isComplete) {
        this.log("DEBUG", "Processing quotation batch sequence", {
          migrationId,
          batchCount,
          currentBatch: this.migrationState.currentBatch.batchNumber,
          hasMore: this.migrationState.currentBatch.hasMore,
          hasLastDoc: !!this.migrationState.currentBatch.lastDoc,
        })

        try {
          const hasMore = await this.loadNextQuotationBatch()
          if (!hasMore) {
            this.log("INFO", "No more quotation batches to process", { migrationId, totalBatches: batchCount })
            break
          }

          await this.processCurrentQuotationBatch()
          batchCount++

          if (onBatchComplete) {
            const totalQuotations = this.migrationState.allBatches.reduce(
              (sum, batch) => sum + batch.quotations.length,
              0,
            )
            onBatchComplete(this.migrationState.currentBatch.batchNumber, {
              total: totalQuotations,
              updated: this.migrationState.totalUpdated,
              skipped: this.migrationState.totalSkipped,
              errors: this.migrationState.totalErrors,
            })
          }
        } catch (error) {
          this.log("ERROR", "Error in quotation batch processing sequence", {
            migrationId,
            batchCount,
            currentBatch: this.migrationState.currentBatch.batchNumber,
            error: error instanceof Error ? error.message : String(error),
          })

          // If it's a cursor issue, try to complete gracefully
          if (error instanceof Error && error.message.includes("pagination cursor")) {
            this.log("INFO", "Cursor issue detected - completing quotation migration gracefully", {
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
          this.log("ERROR", "Safety limit reached - stopping quotation batch processing", {
            migrationId,
            batchCount,
          })
          throw new Error("Safety limit reached - too many quotation batches processed")
        }
      }

      this.log("INFO", "All quotation batches processed successfully", {
        migrationId,
        totalBatches: batchCount,
        finalTotals: {
          totalUpdated: this.migrationState.totalUpdated,
          totalSkipped: this.migrationState.totalSkipped,
          totalErrors: this.migrationState.totalErrors,
        },
      })
    } catch (error) {
      this.log("ERROR", "Failed to process all quotation batches", {
        migrationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      throw error
    }
  }

  // Get migration state
  getMigrationState(): QuotationMigrationResult | null {
    return this.migrationState
  }

  // Reset migration state
  reset(): void {
    const previousMigrationId = this.migrationState?.migrationId

    this.log("INFO", "Resetting quotation migration state", { previousMigrationId })

    this.migrationState = null
    this.progressCallbacks.clear()
    this.isInitializing = false
    this.isLoadingBatch = false

    this.log("INFO", "Quotation migration state reset completed", { previousMigrationId })
  }

  // Get migration summary
  getMigrationSummary(): {
    migrationId: string
    startTime: string
    totalBatches: number
    totalQuotations: number
    totalUpdated: number
    totalSkipped: number
    totalErrors: number
    isComplete: boolean
    debugInfo?: any
  } | null {
    if (!this.migrationState) return null

    const totalQuotations = this.migrationState.allBatches.reduce((sum, batch) => sum + batch.quotations.length, 0)

    return {
      migrationId: this.migrationState.migrationId,
      startTime: this.migrationState.startTime,
      totalBatches: this.migrationState.allBatches.length,
      totalQuotations,
      totalUpdated: this.migrationState.totalUpdated,
      totalSkipped: this.migrationState.totalSkipped,
      totalErrors: this.migrationState.totalErrors,
      isComplete: this.migrationState.isComplete,
      debugInfo: this.migrationState.debugInfo,
    }
  }

  // Enable/disable debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    this.log("INFO", `Quotation migration debug mode ${enabled ? "enabled" : "disabled"}`)
  }
}

// Export singleton instance
export const quotationMigrationService = new QuotationMigrationService()
