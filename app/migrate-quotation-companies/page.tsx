"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  Users,
  FileText,
  ArrowRight,
  RotateCcw,
  Search,
  Package,
  Clock,
} from "lucide-react"
import { db } from "@/lib/firebase"
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  writeBatch,
  limit,
  startAfter,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"
import { MigrationLayout } from "@/components/migration-layout"
import { MigrationStatsCard } from "@/components/migration-stats-card"
import { RealTimeMigrationMonitor } from "@/components/real-time-migration-monitor"

interface QuotationDocument {
  id: string
  seller_id?: string
  company_id?: string
  [key: string]: any
}

interface UserDocument {
  id: string
  company_id?: string
  [key: string]: any
}

interface BatchResult {
  batchNumber: number
  startIndex: number
  endIndex: number
  documentsProcessed: number
  successfulUpdates: number
  skippedDocuments: number
  errors: number
  noUserFound: number
  processingTimeMs: number
  timestamp: Date
}

interface MigrationStats {
  totalQuotations: number
  quotationsWithCompanyId: number
  quotationsWithoutCompanyId: number
  processedQuotations: number
  updatedQuotations: number
  skippedQuotations: number
  errorQuotations: number
  noUserFoundCount: number
  currentBatch: number
  documentsRemaining: number
  validationErrors: number
  networkErrors: number
}

interface MigrationLog {
  quotationId: string
  status: "success" | "error" | "skipped" | "warning" | "validation" | "network_error"
  message: string
  sellerId?: string
  companyId?: string
  batchNumber?: number
  documentIndex?: number
  timestamp: Date
  errorDetails?: string
}

const BATCH_SIZE = 10

export default function MigrateQuotationCompaniesPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])

  const [stats, setStats] = useState<MigrationStats>({
    totalQuotations: 0,
    quotationsWithCompanyId: 0,
    quotationsWithoutCompanyId: 0,
    processedQuotations: 0,
    updatedQuotations: 0,
    skippedQuotations: 0,
    errorQuotations: 0,
    noUserFoundCount: 0,
    currentBatch: 0,
    documentsRemaining: 0,
    validationErrors: 0,
    networkErrors: 0,
  })

  const [logs, setLogs] = useState<MigrationLog[]>([])
  const [startTime, setStartTime] = useState<number>(0)

  const [realTimeStats, setRealTimeStats] = useState({
    totalItems: 0,
    processedItems: 0,
    successfulItems: 0,
    errorItems: 0,
    skippedItems: 0,
    processingRate: 0,
  })

  const addLog = (log: Omit<MigrationLog, "timestamp">) => {
    setLogs((prev) => [{ ...log, timestamp: new Date() }, ...prev].slice(0, 100)) // Keep only last 100 logs
  }

  // Update real-time stats whenever main stats change
  const updateStats = (updates: Partial<MigrationStats>) => {
    setStats((prev) => {
      const newStats = { ...prev, ...updates }

      // Calculate remaining documents
      newStats.documentsRemaining = Math.max(0, newStats.quotationsWithoutCompanyId - newStats.processedQuotations)

      // Sync with real-time stats
      setRealTimeStats((prevReal) => ({
        ...prevReal,
        totalItems: newStats.quotationsWithoutCompanyId,
        processedItems: newStats.processedQuotations,
        successfulItems: newStats.updatedQuotations,
        errorItems: newStats.errorQuotations + newStats.networkErrors,
        skippedItems: newStats.skippedQuotations,
        processingRate:
          isProcessing && startTime > 0
            ? Math.round(newStats.processedQuotations / ((Date.now() - startTime) / 1000))
            : 0,
      }))

      return newStats
    })
  }

  // Validate company_id
  const validateCompanyId = (companyId: any): boolean => {
    return (
      companyId !== null &&
      companyId !== undefined &&
      typeof companyId === "string" &&
      companyId.trim() !== "" &&
      companyId.length >= 3
    )
  }

  // Validate seller_id format
  const validateSellerId = (sellerId: any): boolean => {
    return (
      sellerId !== null &&
      sellerId !== undefined &&
      typeof sellerId === "string" &&
      sellerId.trim() !== "" &&
      sellerId.length >= 10 // Assuming minimum length for valid seller_id
    )
  }

  // Get user by seller_id with enhanced error handling
  const getUserBySellerId = async (
    sellerId: string,
    batchNumber: number,
    documentIndex: number,
  ): Promise<UserDocument | null> => {
    try {
      if (!validateSellerId(sellerId)) {
        addLog({
          quotationId: "user_lookup",
          status: "validation",
          message: `Invalid seller_id format: ${JSON.stringify(sellerId)}`,
          sellerId,
          batchNumber,
          documentIndex,
        })
        return null
      }

      const userDocRef = doc(db, "iboard_users", sellerId)
      const userDocSnapshot = await getDoc(userDocRef)

      if (userDocSnapshot.exists()) {
        const userData = userDocSnapshot.data()
        const userDocument: UserDocument = {
          id: userDocSnapshot.id,
          ...userData,
        }

        addLog({
          quotationId: "user_lookup",
          status: "success",
          message: `User found for seller_id ${sellerId.slice(0, 8)}... with company_id: ${userDocument.company_id ? userDocument.company_id.slice(0, 8) + "..." : "none"}`,
          sellerId,
          companyId: userDocument.company_id,
          batchNumber,
          documentIndex,
        })

        return userDocument
      } else {
        addLog({
          quotationId: "user_lookup",
          status: "warning",
          message: `No user document found for seller_id: ${sellerId.slice(0, 8)}...`,
          sellerId,
          batchNumber,
          documentIndex,
        })
        return null
      }
    } catch (error) {
      const isNetworkError =
        error instanceof Error &&
        (error.message.includes("network") ||
          error.message.includes("timeout") ||
          error.message.includes("connection") ||
          error.message.includes("unavailable"))

      addLog({
        quotationId: "user_lookup",
        status: isNetworkError ? "network_error" : "error",
        message: `Error fetching user for seller_id ${sellerId.slice(0, 8)}...: ${error instanceof Error ? error.message : "Unknown error"}`,
        sellerId,
        batchNumber,
        documentIndex,
        errorDetails: error instanceof Error ? error.stack : undefined,
      })

      if (isNetworkError) {
        throw error // Re-throw network errors to handle at batch level
      }

      return null
    }
  }

  // Scan collection to get accurate counts
  const scanQuotationCollection = async () => {
    setIsScanning(true)
    const scanStartTime = Date.now()

    try {
      addLog({
        quotationId: "system",
        status: "success",
        message: "Starting comprehensive scan of quotation_request collection...",
      })

      // Get total count
      const totalSnapshot = await getDocs(collection(db, "quotation_request"))
      let withCompanyId = 0
      let withoutCompanyId = 0

      totalSnapshot.docs.forEach((doc) => {
        const data = doc.data()
        if (data.company_id && validateCompanyId(data.company_id)) {
          withCompanyId++
        } else {
          withoutCompanyId++
        }
      })

      const scanDuration = Date.now() - scanStartTime

      updateStats({
        totalQuotations: totalSnapshot.size,
        quotationsWithCompanyId: withCompanyId,
        quotationsWithoutCompanyId: withoutCompanyId,
        documentsRemaining: withoutCompanyId,
      })

      addLog({
        quotationId: "system",
        status: "success",
        message: `Scan completed in ${scanDuration}ms: ${totalSnapshot.size} total, ${withCompanyId} with company_id, ${withoutCompanyId} without company_id`,
      })
    } catch (error) {
      addLog({
        quotationId: "system",
        status: "error",
        message: `Error scanning collection: ${error instanceof Error ? error.message : "Unknown error"}`,
        errorDetails: error instanceof Error ? error.stack : undefined,
      })
    } finally {
      setIsScanning(false)
    }
  }

  // Process next batch with enhanced tracking and error handling
  const processNextBatch = async () => {
    if (!hasMoreData) {
      addLog({
        quotationId: "system",
        status: "success",
        message: "No more documents to process - migration complete",
      })
      return
    }

    setIsProcessing(true)
    const batchStartTime = Date.now()
    const currentBatchNumber = stats.currentBatch + 1

    // Calculate dynamic start index based on actual processed documents
    const startIndex = stats.processedQuotations + 1

    const batchResult: BatchResult = {
      batchNumber: currentBatchNumber,
      startIndex,
      endIndex: startIndex,
      documentsProcessed: 0,
      successfulUpdates: 0,
      skippedDocuments: 0,
      errors: 0,
      noUserFound: 0,
      processingTimeMs: 0,
      timestamp: new Date(),
    }

    try {
      addLog({
        quotationId: "system",
        status: "success",
        message: `Starting batch ${currentBatchNumber} - querying up to ${BATCH_SIZE} documents starting from position ${startIndex}`,
        batchNumber: currentBatchNumber,
      })

      // Build optimized query for all quotations (not just those without company_id)
      let quotationsQuery = query(collection(db, "quotation_request"), limit(BATCH_SIZE))

      if (lastDoc) {
        quotationsQuery = query(collection(db, "quotation_request"), startAfter(lastDoc), limit(BATCH_SIZE))
      }

      const quotationsSnapshot = await getDocs(quotationsQuery)

      if (quotationsSnapshot.empty) {
        setHasMoreData(false)
        addLog({
          quotationId: "system",
          status: "success",
          message: `Batch ${currentBatchNumber}: No more quotation documents found - migration complete`,
          batchNumber: currentBatchNumber,
        })
        return
      }

      // Calculate actual batch size and end index
      const actualBatchSize = quotationsSnapshot.docs.length
      const endIndex = startIndex + actualBatchSize - 1
      batchResult.endIndex = endIndex

      addLog({
        quotationId: "system",
        status: "success",
        message: `Batch ${currentBatchNumber}: Processing documents ${startIndex}-${endIndex} (${actualBatchSize} documents)`,
        batchNumber: currentBatchNumber,
      })

      // Process current batch with detailed tracking
      const batch = writeBatch(db)
      let batchUpdates = 0
      let documentIndex = startIndex

      for (const quotationDoc of quotationsSnapshot.docs) {
        const quotationData = quotationDoc.data() as QuotationDocument
        const quotationId = quotationDoc.id

        addLog({
          quotationId,
          status: "success",
          message: `Processing document ${documentIndex} of ${endIndex} (ID: ${quotationId.slice(0, 8)}...)`,
          batchNumber: currentBatchNumber,
          documentIndex,
        })

        try {
          // Check if quotation already has valid company_id
          if (quotationData.company_id && validateCompanyId(quotationData.company_id)) {
            batchResult.skippedDocuments++
            addLog({
              quotationId,
              status: "skipped",
              message: `Document ${documentIndex}: Already has valid company_id: ${quotationData.company_id.slice(0, 8)}...`,
              companyId: quotationData.company_id,
              batchNumber: currentBatchNumber,
              documentIndex,
            })
            documentIndex++
            continue
          }

          // Check if seller_id exists and is valid
          if (!quotationData.seller_id) {
            batchResult.errors++
            addLog({
              quotationId,
              status: "error",
              message: `Document ${documentIndex}: Missing seller_id field`,
              batchNumber: currentBatchNumber,
              documentIndex,
            })
            documentIndex++
            continue
          }

          // Get user by seller_id with retry logic for network errors
          let user: UserDocument | null = null
          let retryCount = 0
          const maxRetries = 3

          while (retryCount < maxRetries && !user) {
            try {
              user = await getUserBySellerId(quotationData.seller_id, currentBatchNumber, documentIndex)
              break
            } catch (error) {
              retryCount++
              if (retryCount < maxRetries) {
                addLog({
                  quotationId,
                  status: "warning",
                  message: `Document ${documentIndex}: Network error, retrying (${retryCount}/${maxRetries})`,
                  batchNumber: currentBatchNumber,
                  documentIndex,
                })
                await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
              } else {
                throw error
              }
            }
          }

          if (!user) {
            batchResult.noUserFound++
            addLog({
              quotationId,
              status: "warning",
              message: `Document ${documentIndex}: No user found for seller_id: ${quotationData.seller_id.slice(0, 8)}...`,
              sellerId: quotationData.seller_id,
              batchNumber: currentBatchNumber,
              documentIndex,
            })
            documentIndex++
            continue
          }

          // Check if user has valid company_id
          if (!validateCompanyId(user.company_id)) {
            batchResult.skippedDocuments++
            addLog({
              quotationId,
              status: "skipped",
              message: `Document ${documentIndex}: User ${user.id.slice(0, 8)}... has no valid company_id`,
              sellerId: quotationData.seller_id,
              batchNumber: currentBatchNumber,
              documentIndex,
            })
            documentIndex++
            continue
          }

          // Update quotation with user's company_id
          batch.update(doc(db, "quotation_request", quotationId), {
            company_id: user.company_id,
            migration_source: "quotation_seller_migration_v1",
            migration_timestamp: new Date(),
            migration_seller_id: quotationData.seller_id,
            migration_batch: currentBatchNumber,
            migration_document_index: documentIndex,
          })

          batchUpdates++
          batchResult.successfulUpdates++

          addLog({
            quotationId,
            status: "success",
            message: `Document ${documentIndex}: Will be updated with company_id: ${user.company_id.slice(0, 8)}... (from seller_id ${quotationData.seller_id.slice(0, 8)}...)`,
            sellerId: quotationData.seller_id,
            companyId: user.company_id,
            batchNumber: currentBatchNumber,
            documentIndex,
          })

          documentIndex++
        } catch (error) {
          batchResult.errors++
          const isNetworkError =
            error instanceof Error &&
            (error.message.includes("network") ||
              error.message.includes("timeout") ||
              error.message.includes("connection") ||
              error.message.includes("unavailable"))

          addLog({
            quotationId,
            status: isNetworkError ? "network_error" : "error",
            message: `Document ${documentIndex}: Error processing quotation: ${error instanceof Error ? error.message : "Unknown error"}`,
            batchNumber: currentBatchNumber,
            documentIndex,
            errorDetails: error instanceof Error ? error.stack : undefined,
          })

          if (isNetworkError) {
            updateStats({ networkErrors: stats.networkErrors + 1 })
          }

          documentIndex++
        }
      }

      batchResult.documentsProcessed = actualBatchSize

      // Commit batch updates if any
      if (batchUpdates > 0) {
        try {
          await batch.commit()
          addLog({
            quotationId: "system",
            status: "success",
            message: `Batch ${currentBatchNumber}: Successfully committed ${batchUpdates} updates to Firestore`,
            batchNumber: currentBatchNumber,
          })
        } catch (error) {
          addLog({
            quotationId: "system",
            status: "error",
            message: `Batch ${currentBatchNumber}: Error committing batch: ${error instanceof Error ? error.message : "Unknown error"}`,
            batchNumber: currentBatchNumber,
            errorDetails: error instanceof Error ? error.stack : undefined,
          })
          throw error
        }
      } else {
        addLog({
          quotationId: "system",
          status: "warning",
          message: `Batch ${currentBatchNumber}: No updates to commit`,
          batchNumber: currentBatchNumber,
        })
      }

      // Update stats and progress
      updateStats({
        processedQuotations: stats.processedQuotations + batchResult.documentsProcessed,
        updatedQuotations: stats.updatedQuotations + batchResult.successfulUpdates,
        skippedQuotations: stats.skippedQuotations + batchResult.skippedDocuments,
        errorQuotations: stats.errorQuotations + batchResult.errors,
        noUserFoundCount: stats.noUserFoundCount + batchResult.noUserFound,
        currentBatch: currentBatchNumber,
      })

      // Update progress percentage based on total quotations
      const newProgress = Math.min(
        100,
        Math.round(
          ((stats.processedQuotations + batchResult.documentsProcessed) / Math.max(stats.totalQuotations, 1)) * 100,
        ),
      )
      setProgress(newProgress)

      // Update pagination
      const lastDocument = quotationsSnapshot.docs[quotationsSnapshot.docs.length - 1]
      setLastDoc(lastDocument)

      // Check if there's more data - if we got less than BATCH_SIZE, we're at the end
      if (actualBatchSize < BATCH_SIZE) {
        setHasMoreData(false)
        addLog({
          quotationId: "system",
          status: "success",
          message: `Batch ${currentBatchNumber}: Reached end of collection - processed final ${actualBatchSize} documents`,
          batchNumber: currentBatchNumber,
        })
      }

      // Finalize batch result
      batchResult.processingTimeMs = Date.now() - batchStartTime
      setBatchResults((prev) => [batchResult, ...prev].slice(0, 10))

      addLog({
        quotationId: "system",
        status: "success",
        message: `Batch ${currentBatchNumber} completed in ${batchResult.processingTimeMs}ms: Documents ${batchResult.startIndex}-${batchResult.endIndex} (${batchResult.documentsProcessed} docs), Updated: ${batchResult.successfulUpdates}, Skipped: ${batchResult.skippedDocuments}, Errors: ${batchResult.errors}, No User: ${batchResult.noUserFound}`,
        batchNumber: currentBatchNumber,
      })
    } catch (error) {
      console.error("Error processing batch:", error)
      batchResult.processingTimeMs = Date.now() - batchStartTime
      setBatchResults((prev) => [batchResult, ...prev].slice(0, 10))

      addLog({
        quotationId: "system",
        status: "error",
        message: `Batch ${currentBatchNumber}: Critical error processing batch: ${error instanceof Error ? error.message : "Unknown error"}`,
        batchNumber: currentBatchNumber,
        errorDetails: error instanceof Error ? error.stack : undefined,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reset migration state
  const resetMigration = () => {
    setProgress(0)
    setLastDoc(null)
    setHasMoreData(true)
    setCurrentOffset(0)
    setBatchResults([])
    setStats({
      totalQuotations: 0,
      quotationsWithCompanyId: 0,
      quotationsWithoutCompanyId: 0,
      processedQuotations: 0,
      updatedQuotations: 0,
      skippedQuotations: 0,
      errorQuotations: 0,
      noUserFoundCount: 0,
      currentBatch: 0,
      documentsRemaining: 0,
      validationErrors: 0,
      networkErrors: 0,
    })
    setLogs([])
    setRealTimeStats({
      totalItems: 0,
      processedItems: 0,
      successfulItems: 0,
      errorItems: 0,
      skippedItems: 0,
      processingRate: 0,
    })
    setStartTime(0)

    addLog({
      quotationId: "system",
      status: "success",
      message: "Migration state reset - ready for new migration",
    })
  }

  return (
    <MigrationLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Migrate Quotation Companies</h1>
            <p className="text-muted-foreground">
              Update quotation request records with company information based on seller_id
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={scanQuotationCollection} variant="outline" size="sm" disabled={isScanning}>
              <Search className="h-4 w-4 mr-1" />
              {isScanning ? "Scanning..." : "Scan Collection"}
            </Button>
            <Button onClick={resetMigration} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Real-Time Migration Monitor */}
        <RealTimeMigrationMonitor
          migrationName="Quotation Companies"
          isRunning={isProcessing}
          totalItems={realTimeStats.totalItems}
          processedItems={realTimeStats.processedItems}
          successfulItems={realTimeStats.successfulItems}
          errorItems={realTimeStats.errorItems}
          skippedItems={realTimeStats.skippedItems}
          processingRate={realTimeStats.processingRate}
          onRefresh={() => {}}
        />

        {/* Migration Stats Card */}
        <MigrationStatsCard
          title="Quotation Migration Statistics"
          description="Real-time progress of quotation company assignments"
          stats={{
            totalItems: stats.quotationsWithoutCompanyId,
            processedItems: stats.processedQuotations,
            successfulItems: stats.updatedQuotations,
            errorItems: stats.errorQuotations + stats.networkErrors,
            skippedItems: stats.skippedQuotations,
            lastUpdated: new Date(),
          }}
        />

        {/* Collection Overview */}
        {stats.totalQuotations > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Collection Overview
              </CardTitle>
              <CardDescription>Current state of the quotation_request collection</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.totalQuotations}</div>
                  <div className="text-sm text-blue-600">Total Quotations</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.quotationsWithCompanyId}</div>
                  <div className="text-sm text-green-600">Have Company ID</div>
                  <div className="text-xs text-green-500">
                    {stats.totalQuotations > 0
                      ? Math.round((stats.quotationsWithCompanyId / stats.totalQuotations) * 100)
                      : 0}
                    %
                  </div>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats.quotationsWithoutCompanyId}</div>
                  <div className="text-sm text-orange-600">Need Migration</div>
                  <div className="text-xs text-orange-500">
                    {stats.totalQuotations > 0
                      ? Math.round((stats.quotationsWithoutCompanyId / stats.totalQuotations) * 100)
                      : 0}
                    %
                  </div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats.documentsRemaining}</div>
                  <div className="text-sm text-purple-600">Remaining</div>
                  <div className="text-xs text-purple-500">Documents left to process</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Migration Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Migration Controls
            </CardTitle>
            <CardDescription>
              Process quotation documents in batches of up to {BATCH_SIZE} - Next batch: {stats.processedQuotations + 1}
              -{Math.min(stats.processedQuotations + BATCH_SIZE, stats.totalQuotations)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={processNextBatch} disabled={isProcessing || !hasMoreData}>
                {isProcessing
                  ? "Processing..."
                  : `Process Next Batch (${stats.processedQuotations + 1}-${Math.min(stats.processedQuotations + BATCH_SIZE, stats.totalQuotations)})`}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            {progress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>
                    {progress}% ({stats.processedQuotations}/{stats.quotationsWithoutCompanyId})
                  </span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {!hasMoreData && stats.processedQuotations > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Migration completed! All quotation documents have been processed.</AlertDescription>
              </Alert>
            )}

            {stats.documentsRemaining === 0 && stats.totalQuotations > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  No quotations need migration - all quotations already have company_id assigned.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Batch Results History */}
        {batchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-15" />
                Recent Batch Results
              </CardTitle>
              <CardDescription>Performance and results of recent batches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {batchResults.map((result, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">Batch {result.batchNumber}</span>
                      <span className="text-sm text-muted-foreground">{result.processingTimeMs}ms</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Range:</span>
                        <div className="font-medium">
                          {result.startIndex}-{result.endIndex}
                        </div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Processed:</span>
                        <div className="font-medium">{result.documentsProcessed}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Updated:</span>
                        <div className="font-medium text-green-600">{result.successfulUpdates}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Skipped:</span>
                        <div className="font-medium text-yellow-600">{result.skippedDocuments}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">No User:</span>
                        <div className="font-medium text-orange-600">{result.noUserFound}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Errors:</span>
                        <div className="font-medium text-red-600">{result.errors}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processedQuotations}</div>
              <p className="text-xs text-muted-foreground">Batch {stats.currentBatch}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Updated</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.updatedQuotations}</div>
              <p className="text-xs text-muted-foreground">Successfully updated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">No User Found</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.noUserFoundCount}</div>
              <p className="text-xs text-muted-foreground">Seller not in users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Errors</CardTitle>
              <XCircle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.networkErrors}</div>
              <p className="text-xs text-muted-foreground">Connection issues</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Other Errors</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.errorQuotations}</div>
              <p className="text-xs text-muted-foreground">Processing errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Recent Migration Logs
            </CardTitle>
            <CardDescription>Latest {Math.min(logs.length, 20)} log entries</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 20).map((log, index) => (
                <div key={index} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <Badge
                    variant={
                      log.status === "success"
                        ? "default"
                        : log.status === "error" || log.status === "network_error"
                          ? "destructive"
                          : log.status === "warning"
                            ? "secondary"
                            : log.status === "validation"
                              ? "outline"
                              : "secondary"
                    }
                    className="mt-0.5 shrink-0"
                  >
                    {log.status.toUpperCase().replace("_", " ")}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.message}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>{log.timestamp.toLocaleTimeString()}</span>
                      {log.quotationId !== "system" && log.quotationId !== "user_lookup" && (
                        <span>Quotation: {log.quotationId}</span>
                      )}
                      {log.sellerId && <span>Seller: {log.sellerId.slice(0, 8)}...</span>}
                      {log.batchNumber && <span>Batch: {log.batchNumber}</span>}
                      {log.documentIndex && <span>Index: {log.documentIndex}</span>}
                    </div>
                    {log.errorDetails && (
                      <details className="mt-1">
                        <summary className="text-xs text-red-600 cursor-pointer">Error Details</summary>
                        <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">{log.errorDetails}</pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No logs yet</p>
                  <p className="text-sm">Start processing to see migration logs</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MigrationLayout>
  )
}
