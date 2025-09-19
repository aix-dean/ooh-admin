"use client"

import { useState, useCallback } from "react"
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
  Calendar,
  ArrowRight,
  RotateCcw,
  Search,
  Database,
  Activity,
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

interface BookingDocument {
  id: string
  seller_id?: string
  buyer_id?: string
  company_id?: string | null
  [key: string]: any
}

interface UserDocument {
  id: string
  company_id?: string
  [key: string]: any
}

interface CollectionAnalysis {
  totalDocuments: number
  documentsWithCompanyId: number
  documentsWithoutCompanyId: number
  documentsWithInvalidCompanyId: number
  lastAnalyzed: Date | null
  isAnalyzing: boolean
}

interface MigrationStats {
  totalToMigrate: number
  processedDocuments: number
  successfulUpdates: number
  skippedDocuments: number
  errorDocuments: number
  currentBatch: number
  validUsersFound: number
  usersWithCompanyId: number
  usersWithoutCompanyId: number
  dataIntegrityIssues: number
  validationErrors: number
}

interface MigrationLog {
  id: string
  bookingId: string
  status: "success" | "error" | "skipped" | "warning" | "validation" | "info"
  message: string
  details?: {
    userId?: string
    companyId?: string
    batchNumber?: number
    errorCode?: string
    originalData?: any
  }
  timestamp: Date
}

interface BatchResult {
  batchNumber: number
  processed: number
  successful: number
  skipped: number
  errors: number
  startTime: Date
  endTime: Date
  duration: number
}

const BATCH_SIZE = 50
const COLLECTION_NAME = "booking"

export default function MigrateBookingCompaniesPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMoreData, setHasMoreData] = useState(true)

  const [collectionAnalysis, setCollectionAnalysis] = useState<CollectionAnalysis>({
    totalDocuments: 0,
    documentsWithCompanyId: 0,
    documentsWithoutCompanyId: 0,
    documentsWithInvalidCompanyId: 0,
    lastAnalyzed: null,
    isAnalyzing: false,
  })

  const [migrationStats, setMigrationStats] = useState<MigrationStats>({
    totalToMigrate: 0,
    processedDocuments: 0,
    successfulUpdates: 0,
    skippedDocuments: 0,
    errorDocuments: 0,
    currentBatch: 0,
    validUsersFound: 0,
    usersWithCompanyId: 0,
    usersWithoutCompanyId: 0,
    dataIntegrityIssues: 0,
    validationErrors: 0,
  })

  const [logs, setLogs] = useState<MigrationLog[]>([])
  const [batchResults, setBatchResults] = useState<BatchResult[]>([])
  const [startTime, setStartTime] = useState<number>(0)

  const [realTimeStats, setRealTimeStats] = useState({
    totalItems: 0,
    processedItems: 0,
    successfulItems: 0,
    errorItems: 0,
    skippedItems: 0,
    processingRate: 0,
  })

  // Generate unique log ID
  const generateLogId = () => `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Enhanced logging function
  const addLog = useCallback((log: Omit<MigrationLog, "id" | "timestamp">) => {
    const newLog: MigrationLog = {
      ...log,
      id: generateLogId(),
      timestamp: new Date(),
    }
    setLogs((prev) => [newLog, ...prev.slice(0, 99)]) // Keep only last 100 logs
  }, [])

  // Update migration stats with validation
  const updateMigrationStats = useCallback(
    (updates: Partial<MigrationStats>) => {
      setMigrationStats((prev) => {
        const newStats = { ...prev, ...updates }

        // Sync with real-time stats
        setRealTimeStats((prevReal) => ({
          ...prevReal,
          totalItems: newStats.totalToMigrate,
          processedItems: newStats.processedDocuments,
          successfulItems: newStats.successfulUpdates,
          errorItems: newStats.errorDocuments,
          skippedItems: newStats.skippedDocuments,
          processingRate:
            isProcessing && startTime > 0
              ? Math.round(newStats.processedDocuments / ((Date.now() - startTime) / 1000))
              : 0,
        }))

        // Update progress
        if (newStats.totalToMigrate > 0) {
          const newProgress = Math.min(100, Math.round((newStats.processedDocuments / newStats.totalToMigrate) * 100))
          setProgress(newProgress)
        }

        return newStats
      })
    },
    [isProcessing, startTime],
  )

  // Validate company_id with enhanced checks
  const validateCompanyId = (companyId: any): boolean => {
    if (companyId === null || companyId === undefined) return false
    if (typeof companyId !== "string") return false
    if (companyId.trim() === "") return false
    if (companyId.length < 3) return false
    if (companyId === "null" || companyId === "undefined") return false
    return true
  }

  // Enhanced user lookup with caching and validation
  const getUserById = async (userId: string, bookingId: string): Promise<UserDocument | null> => {
    try {
      if (!userId || typeof userId !== "string" || userId.trim() === "") {
        addLog({
          bookingId,
          status: "validation",
          message: "Invalid user ID provided",
          details: { userId, errorCode: "INVALID_USER_ID" },
        })
        return null
      }

      const userDocRef = doc(db, "iboard_users", userId)
      const userDocSnapshot = await getDoc(userDocRef)

      if (userDocSnapshot.exists()) {
        const userData = userDocSnapshot.data()
        const userDocument: UserDocument = {
          id: userDocSnapshot.id,
          ...userData,
        }

        addLog({
          bookingId,
          status: "info",
          message: `User found: ${userId}`,
          details: {
            userId,
            companyId: userDocument.company_id,
          },
        })

        return userDocument
      } else {
        addLog({
          bookingId,
          status: "warning",
          message: `User document not found: ${userId}`,
          details: { userId, errorCode: "USER_NOT_FOUND" },
        })
        return null
      }
    } catch (error) {
      addLog({
        bookingId,
        status: "error",
        message: `Error fetching user: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: {
          userId,
          errorCode: "USER_FETCH_ERROR",
        },
      })
      return null
    }
  }

  // Enhanced company ID resolution with priority logic
  const resolveCompanyId = async (
    bookingData: BookingDocument,
    bookingId: string,
    batchNumber: number,
  ): Promise<{ userId: string; companyId: string } | null> => {
    try {
      addLog({
        bookingId,
        status: "info",
        message: "Starting company ID resolution",
        details: { batchNumber },
      })

      // Priority 1: Check seller_id
      if (bookingData.seller_id) {
        const sellerUser = await getUserById(bookingData.seller_id, bookingId)
        if (sellerUser) {
          updateMigrationStats({ validUsersFound: migrationStats.validUsersFound + 1 })

          if (validateCompanyId(sellerUser.company_id)) {
            updateMigrationStats({ usersWithCompanyId: migrationStats.usersWithCompanyId + 1 })
            addLog({
              bookingId,
              status: "success",
              message: "Company ID resolved from seller",
              details: {
                userId: sellerUser.id,
                companyId: sellerUser.company_id!,
                batchNumber,
              },
            })
            return { userId: sellerUser.id, companyId: sellerUser.company_id! }
          } else {
            updateMigrationStats({ usersWithoutCompanyId: migrationStats.usersWithoutCompanyId + 1 })
            addLog({
              bookingId,
              status: "validation",
              message: "Seller has no valid company ID, trying buyer",
              details: { batchNumber },
            })
          }
        }
      }

      // Priority 2: Check buyer_id
      if (bookingData.buyer_id) {
        const buyerUser = await getUserById(bookingData.buyer_id, bookingId)
        if (buyerUser) {
          updateMigrationStats({ validUsersFound: migrationStats.validUsersFound + 1 })

          if (validateCompanyId(buyerUser.company_id)) {
            updateMigrationStats({ usersWithCompanyId: migrationStats.usersWithCompanyId + 1 })
            addLog({
              bookingId,
              status: "success",
              message: "Company ID resolved from buyer",
              details: {
                userId: buyerUser.id,
                companyId: buyerUser.company_id!,
                batchNumber,
              },
            })
            return { userId: buyerUser.id, companyId: buyerUser.company_id! }
          } else {
            updateMigrationStats({ usersWithoutCompanyId: migrationStats.usersWithoutCompanyId + 1 })
          }
        }
      }

      addLog({
        bookingId,
        status: "warning",
        message: "No valid company ID found from any user",
        details: { batchNumber, errorCode: "NO_VALID_COMPANY_ID" },
      })

      return null
    } catch (error) {
      updateMigrationStats({ validationErrors: migrationStats.validationErrors + 1 })
      addLog({
        bookingId,
        status: "error",
        message: `Error resolving company ID: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: {
          batchNumber,
          errorCode: "COMPANY_RESOLUTION_ERROR",
        },
      })
      return null
    }
  }

  // Add this helper function before the analyzeCollection function
  const validateCollectionAccess = async (): Promise<boolean> => {
    try {
      addLog({
        bookingId: "system",
        status: "info",
        message: `Validating access to '${COLLECTION_NAME}' collection...`,
      })

      const testQuery = query(collection(db, COLLECTION_NAME), limit(1))
      const testSnapshot = await getDocs(testQuery)

      addLog({
        bookingId: "system",
        status: "success",
        message: `Collection access validated. Collection exists and is accessible.`,
      })

      return true
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      addLog({
        bookingId: "system",
        status: "error",
        message: `Collection validation failed: ${errorMessage}`,
        details: { errorCode: "VALIDATION_FAILED" },
      })
      return false
    }
  }

  // Comprehensive collection analysis with enhanced error handling
  const analyzeCollection = async () => {
    // Prevent multiple simultaneous analyses
    if (collectionAnalysis.isAnalyzing) {
      addLog({
        bookingId: "system",
        status: "warning",
        message: "Collection analysis already in progress",
      })
      return
    }

    setCollectionAnalysis((prev) => ({ ...prev, isAnalyzing: true }))

    try {
      addLog({
        bookingId: "system",
        status: "info",
        message: `Starting comprehensive collection analysis for '${COLLECTION_NAME}' collection`,
      })

      // Test collection access first
      const testQuery = query(collection(db, COLLECTION_NAME), limit(1))
      const testSnapshot = await getDocs(testQuery)

      addLog({
        bookingId: "system",
        status: "info",
        message: `Collection '${COLLECTION_NAME}' accessible. Sample document count: ${testSnapshot.size}`,
      })

      // Get all documents with progress tracking
      addLog({
        bookingId: "system",
        status: "info",
        message: "Fetching all documents from collection...",
      })

      const bookingsSnapshot = await getDocs(collection(db, COLLECTION_NAME))
      const totalDocuments = bookingsSnapshot.size

      addLog({
        bookingId: "system",
        status: "info",
        message: `Retrieved ${totalDocuments} documents. Starting analysis...`,
      })

      if (totalDocuments === 0) {
        addLog({
          bookingId: "system",
          status: "warning",
          message: `Collection '${COLLECTION_NAME}' is empty or does not exist`,
        })

        const analysis: CollectionAnalysis = {
          totalDocuments: 0,
          documentsWithCompanyId: 0,
          documentsWithoutCompanyId: 0,
          documentsWithInvalidCompanyId: 0,
          lastAnalyzed: new Date(),
          isAnalyzing: false,
        }

        setCollectionAnalysis(analysis)
        updateMigrationStats({ totalToMigrate: 0 })
        return
      }

      let totalCount = 0
      let withValidCompanyId = 0
      let withoutCompanyId = 0
      let withInvalidCompanyId = 0
      let documentsWithoutField = 0
      let documentsWithNullValue = 0
      let documentsWithEmptyString = 0
      let documentsWithInvalidString = 0

      // Detailed analysis with categorization
      bookingsSnapshot.forEach((doc, index) => {
        totalCount++
        const data = doc.data()
        const companyId = data.company_id

        // Log progress every 100 documents
        if (index % 100 === 0 && index > 0) {
          addLog({
            bookingId: "system",
            status: "info",
            message: `Analysis progress: ${index}/${totalDocuments} documents processed`,
          })
        }

        // Detailed categorization
        if (companyId === undefined) {
          documentsWithoutField++
          withoutCompanyId++
        } else if (companyId === null) {
          documentsWithNullValue++
          withoutCompanyId++
        } else if (companyId === "") {
          documentsWithEmptyString++
          withInvalidCompanyId++
        } else if (typeof companyId === "string") {
          if (companyId.trim() === "" || companyId.length < 3 || companyId === "null" || companyId === "undefined") {
            documentsWithInvalidString++
            withInvalidCompanyId++
          } else {
            withValidCompanyId++
          }
        } else {
          // Non-string company_id
          withInvalidCompanyId++
        }
      })

      const analysis: CollectionAnalysis = {
        totalDocuments: totalCount,
        documentsWithCompanyId: withValidCompanyId,
        documentsWithoutCompanyId: withoutCompanyId,
        documentsWithInvalidCompanyId: withInvalidCompanyId,
        lastAnalyzed: new Date(),
        isAnalyzing: false,
      }

      setCollectionAnalysis(analysis)

      const totalToMigrate = withoutCompanyId + withInvalidCompanyId
      updateMigrationStats({ totalToMigrate })

      // Detailed logging of results
      addLog({
        bookingId: "system",
        status: "success",
        message: `Collection analysis complete: ${totalCount} total documents analyzed`,
      })

      addLog({
        bookingId: "system",
        status: "info",
        message: `Results: ${withValidCompanyId} valid, ${withoutCompanyId} missing, ${withInvalidCompanyId} invalid company_id`,
      })

      addLog({
        bookingId: "system",
        status: "info",
        message: `Detailed breakdown: ${documentsWithoutField} without field, ${documentsWithNullValue} null, ${documentsWithEmptyString} empty, ${documentsWithInvalidString} invalid strings`,
      })

      addLog({
        bookingId: "system",
        status: "success",
        message: `${totalToMigrate} documents require migration`,
      })

      // Reset pagination state when analysis completes
      setLastDoc(null)
      setHasMoreData(totalToMigrate > 0)
    } catch (error) {
      console.error("Collection analysis error:", error)

      setCollectionAnalysis((prev) => ({ ...prev, isAnalyzing: false }))

      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      addLog({
        bookingId: "system",
        status: "error",
        message: `Collection analysis failed: ${errorMessage}`,
        details: {
          errorCode: "ANALYSIS_ERROR",
          collectionName: COLLECTION_NAME,
          originalData: { error: errorMessage },
        },
      })

      // Check for specific error types
      if (errorMessage.includes("permission")) {
        addLog({
          bookingId: "system",
          status: "error",
          message: "Permission denied. Check Firestore security rules and authentication.",
          details: { errorCode: "PERMISSION_DENIED" },
        })
      } else if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
        addLog({
          bookingId: "system",
          status: "error",
          message: `Collection '${COLLECTION_NAME}' does not exist. Please verify the collection name.`,
          details: { errorCode: "COLLECTION_NOT_FOUND" },
        })
      } else if (errorMessage.includes("network")) {
        addLog({
          bookingId: "system",
          status: "error",
          message: "Network error. Please check your internet connection and try again.",
          details: { errorCode: "NETWORK_ERROR" },
        })
      }
    }
  }

  // Enhanced batch processing with better error handling
  const processNextBatch = async () => {
    if (!hasMoreData || isPaused) {
      addLog({
        bookingId: "system",
        status: "info",
        message: isPaused ? "Processing paused" : "No more data to process",
      })
      return
    }

    setIsProcessing(true)
    const currentBatchNumber = migrationStats.currentBatch + 1
    const batchStartTime = new Date()

    addLog({
      bookingId: "system",
      status: "info",
      message: `Debug: hasMoreData=${hasMoreData}, isPaused=${isPaused}, totalToMigrate=${migrationStats.totalToMigrate}`,
      details: { batchNumber: currentBatchNumber },
    })

    try {
      addLog({
        bookingId: "system",
        status: "info",
        message: `Starting batch ${currentBatchNumber} (${BATCH_SIZE} documents)`,
        details: { batchNumber: currentBatchNumber },
      })

      // Query for documents without valid company_id - Use a simpler approach
      let bookingsQuery = query(collection(db, COLLECTION_NAME), limit(BATCH_SIZE))

      if (lastDoc) {
        bookingsQuery = query(collection(db, COLLECTION_NAME), startAfter(lastDoc), limit(BATCH_SIZE))
      }

      const bookingsSnapshot = await getDocs(bookingsQuery)

      // Filter documents that need migration in memory
      const documentsToProcess = bookingsSnapshot.docs.filter((doc) => {
        const data = doc.data()
        return !validateCompanyId(data.company_id)
      })

      addLog({
        bookingId: "system",
        status: "info",
        message: `Found ${bookingsSnapshot.docs.length} documents, ${documentsToProcess.length} need migration`,
        details: { batchNumber: currentBatchNumber },
      })

      if (documentsToProcess.length === 0) {
        if (bookingsSnapshot.docs.length < BATCH_SIZE) {
          setHasMoreData(false)
          addLog({
            bookingId: "system",
            status: "success",
            message: "Migration completed - no more documents to process",
            details: { batchNumber: currentBatchNumber },
          })
          return
        } else {
          // Continue to next batch if current batch has no documents to migrate
          const lastDocument = bookingsSnapshot.docs[bookingsSnapshot.docs.length - 1]
          setLastDoc(lastDocument)
          addLog({
            bookingId: "system",
            status: "info",
            message: "No documents to migrate in this batch, continuing to next batch",
            details: { batchNumber: currentBatchNumber },
          })
          setIsProcessing(false)
          return
        }
      }

      // Process batch with transaction safety
      const batch = writeBatch(db)
      const batchStats = {
        processed: 0,
        successful: 0,
        skipped: 0,
        errors: 0,
      }

      for (const bookingDoc of documentsToProcess) {
        const bookingData = bookingDoc.data() as BookingDocument
        const bookingId = bookingDoc.id

        try {
          batchStats.processed++

          // Data integrity validation
          if (!bookingData.seller_id && !bookingData.buyer_id) {
            batchStats.errors++
            updateMigrationStats({ dataIntegrityIssues: migrationStats.dataIntegrityIssues + 1 })
            addLog({
              bookingId,
              status: "error",
              message: "Missing both seller_id and buyer_id",
              details: {
                batchNumber: currentBatchNumber,
                errorCode: "MISSING_USER_IDS",
                originalData: { seller_id: bookingData.seller_id, buyer_id: bookingData.buyer_id },
              },
            })
            continue
          }

          // Skip if already has valid company_id (edge case)
          if (validateCompanyId(bookingData.company_id)) {
            batchStats.skipped++
            addLog({
              bookingId,
              status: "skipped",
              message: "Already has valid company_id",
              details: {
                batchNumber: currentBatchNumber,
                companyId: bookingData.company_id,
              },
            })
            continue
          }

          // Resolve company ID
          const companyResolution = await resolveCompanyId(bookingData, bookingId, currentBatchNumber)

          if (companyResolution) {
            // Prepare batch update
            batch.update(doc(db, COLLECTION_NAME, bookingId), {
              company_id: companyResolution.companyId,
              migration_metadata: {
                source: "booking_company_migration_v2",
                timestamp: new Date(),
                batch_number: currentBatchNumber,
                resolved_from_user: companyResolution.userId,
                migration_version: "2.0",
              },
            })

            batchStats.successful++
            addLog({
              bookingId,
              status: "success",
              message: "Prepared for company ID update",
              details: {
                batchNumber: currentBatchNumber,
                userId: companyResolution.userId,
                companyId: companyResolution.companyId,
              },
            })
          } else {
            batchStats.skipped++
            addLog({
              bookingId,
              status: "skipped",
              message: "No valid company ID could be resolved",
              details: { batchNumber: currentBatchNumber },
            })
          }
        } catch (error) {
          batchStats.errors++
          addLog({
            bookingId,
            status: "error",
            message: `Error processing document: ${error instanceof Error ? error.message : "Unknown error"}`,
            details: {
              batchNumber: currentBatchNumber,
              errorCode: "DOCUMENT_PROCESSING_ERROR",
            },
          })
        }
      }

      // Commit batch if there are updates
      if (batchStats.successful > 0) {
        await batch.commit()
        addLog({
          bookingId: "system",
          status: "success",
          message: `Batch ${currentBatchNumber} committed: ${batchStats.successful} updates`,
          details: { batchNumber: currentBatchNumber },
        })
      }

      // Update statistics
      updateMigrationStats({
        processedDocuments: migrationStats.processedDocuments + batchStats.processed,
        successfulUpdates: migrationStats.successfulUpdates + batchStats.successful,
        skippedDocuments: migrationStats.skippedDocuments + batchStats.skipped,
        errorDocuments: migrationStats.errorDocuments + batchStats.errors,
        currentBatch: currentBatchNumber,
      })

      // Record batch result
      const batchEndTime = new Date()
      const batchResult: BatchResult = {
        batchNumber: currentBatchNumber,
        processed: batchStats.processed,
        successful: batchStats.successful,
        skipped: batchStats.skipped,
        errors: batchStats.errors,
        startTime: batchStartTime,
        endTime: batchEndTime,
        duration: batchEndTime.getTime() - batchStartTime.getTime(),
      }
      setBatchResults((prev) => [batchResult, ...prev.slice(0, 9)]) // Keep last 10 batch results

      // Update pagination
      const lastDocument = bookingsSnapshot.docs[bookingsSnapshot.docs.length - 1]
      setLastDoc(lastDocument)

      // Check for more data
      if (bookingsSnapshot.docs.length < BATCH_SIZE) {
        setHasMoreData(false)
        addLog({
          bookingId: "system",
          status: "success",
          message: "Reached end of collection",
          details: { batchNumber: currentBatchNumber },
        })
      }

      addLog({
        bookingId: "system",
        status: "success",
        message: `Batch ${currentBatchNumber} completed in ${batchResult.duration}ms`,
        details: {
          batchNumber: currentBatchNumber,
          ...batchStats,
        },
      })
    } catch (error) {
      addLog({
        bookingId: "system",
        status: "error",
        message: `Batch ${currentBatchNumber} failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        details: {
          batchNumber: currentBatchNumber,
          errorCode: "BATCH_PROCESSING_ERROR",
        },
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Process all remaining batches with pause capability
  const processAllBatches = async () => {
    if (!hasMoreData) {
      addLog({
        bookingId: "system",
        status: "info",
        message: "No data to process",
      })
      return
    }

    setStartTime(Date.now())
    setIsPaused(false)

    addLog({
      bookingId: "system",
      status: "info",
      message: "Starting automated batch processing",
    })

    while (hasMoreData && !isPaused) {
      await processNextBatch()
      // Small delay between batches
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    if (isPaused) {
      addLog({
        bookingId: "system",
        status: "info",
        message: "Automated processing paused",
      })
    } else {
      addLog({
        bookingId: "system",
        status: "success",
        message: "Automated processing completed",
      })
    }
  }

  // Pause processing
  const pauseProcessing = () => {
    setIsPaused(true)
    addLog({
      bookingId: "system",
      status: "info",
      message: "Processing pause requested",
    })
  }

  // Resume processing
  const resumeProcessing = () => {
    setIsPaused(false)
    addLog({
      bookingId: "system",
      status: "info",
      message: "Processing resumed",
    })
    if (hasMoreData) {
      processAllBatches()
    }
  }

  // Reset migration state
  const resetMigration = () => {
    setProgress(0)
    setLastDoc(null)
    setHasMoreData(true)
    setIsPaused(false)
    setMigrationStats({
      totalToMigrate: 0,
      processedDocuments: 0,
      successfulUpdates: 0,
      skippedDocuments: 0,
      errorDocuments: 0,
      currentBatch: 0,
      validUsersFound: 0,
      usersWithCompanyId: 0,
      usersWithoutCompanyId: 0,
      dataIntegrityIssues: 0,
      validationErrors: 0,
    })
    setLogs([])
    setBatchResults([])
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
      bookingId: "system",
      status: "info",
      message: "Migration state reset",
    })
  }

  return (
    <MigrationLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Migrate Booking Companies</h1>
            <p className="text-muted-foreground">
              Enhanced migration process with comprehensive data analysis and robust error handling
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                const isValid = await validateCollectionAccess()
                if (isValid) {
                  await analyzeCollection()
                }
              }}
              variant="outline"
              size="sm"
              disabled={collectionAnalysis.isAnalyzing}
              className="flex items-center gap-2"
            >
              {collectionAnalysis.isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Analyze Collection
                </>
              )}
            </Button>
            <Button onClick={resetMigration} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Real-Time Migration Monitor */}
        <RealTimeMigrationMonitor
          migrationName="Booking Companies"
          isRunning={isProcessing}
          totalItems={realTimeStats.totalItems}
          processedItems={realTimeStats.processedItems}
          successfulItems={realTimeStats.successfulItems}
          errorItems={realTimeStats.errorItems}
          skippedItems={realTimeStats.skippedItems}
          processingRate={realTimeStats.processingRate}
          onRefresh={analyzeCollection}
        />

        {/* Migration Stats Card */}
        <MigrationStatsCard
          title="Enhanced Migration Statistics"
          description="Comprehensive tracking of booking company migration progress"
          stats={{
            totalItems: migrationStats.totalToMigrate,
            processedItems: migrationStats.processedDocuments,
            successfulItems: migrationStats.successfulUpdates,
            errorItems: migrationStats.errorDocuments,
            skippedItems: migrationStats.skippedDocuments,
            lastUpdated: new Date(),
          }}
        />

        {/* Collection Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Collection Analysis
            </CardTitle>
            <CardDescription>
              Comprehensive analysis of the {COLLECTION_NAME} collection
              {collectionAnalysis.lastAnalyzed && (
                <span className="block text-xs mt-1">
                  Last analyzed: {collectionAnalysis.lastAnalyzed.toLocaleString()}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">{collectionAnalysis.totalDocuments}</div>
                <div className="text-xs text-blue-600">Total Documents</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-semibold text-green-600">{collectionAnalysis.documentsWithCompanyId}</div>
                <div className="text-xs text-green-600">Valid Company ID</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-semibold text-orange-600">
                  {collectionAnalysis.documentsWithoutCompanyId}
                </div>
                <div className="text-xs text-orange-600">Missing Company ID</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-semibold text-red-600">
                  {collectionAnalysis.documentsWithInvalidCompanyId}
                </div>
                <div className="text-xs text-red-600">Invalid Company ID</div>
              </div>
            </div>

            {migrationStats.totalToMigrate === 0 && collectionAnalysis.totalDocuments > 0 && (
              <Alert className="mt-4">
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>All documents have valid company_id. No migration needed.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Add this after the Collection Analysis card */}
        {logs.some((log) => log.status === "error" && log.bookingId === "system") && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Collection analysis encountered errors. Check the logs below for details.
              {logs.find((log) => log.status === "error" && log.details?.errorCode === "COLLECTION_NOT_FOUND") && (
                <div className="mt-2">
                  <strong>Suggestion:</strong> Verify that the collection name '{COLLECTION_NAME}' is correct.
                </div>
              )}
              {logs.find((log) => log.status === "error" && log.details?.errorCode === "PERMISSION_DENIED") && (
                <div className="mt-2">
                  <strong>Suggestion:</strong> Check your Firestore security rules and authentication status.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Migration Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Migration Controls
            </CardTitle>
            <CardDescription>Process documents in optimized batches of {BATCH_SIZE}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={processNextBatch}
                disabled={isProcessing || !hasMoreData || migrationStats.totalToMigrate === 0}
                className="flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    Process Next Batch
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              {!isProcessing && !isPaused && (
                <Button
                  onClick={processAllBatches}
                  disabled={!hasMoreData || migrationStats.totalToMigrate === 0}
                  variant="secondary"
                >
                  Process All Batches
                </Button>
              )}

              {isProcessing && !isPaused && (
                <Button onClick={pauseProcessing} variant="outline">
                  Pause Processing
                </Button>
              )}

              {isPaused && (
                <Button onClick={resumeProcessing} variant="outline">
                  Resume Processing
                </Button>
              )}
            </div>

            {progress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Migration Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
                <div className="text-xs text-muted-foreground">
                  {migrationStats.processedDocuments} of {migrationStats.totalToMigrate} documents processed
                </div>
              </div>
            )}

            {!hasMoreData && migrationStats.processedDocuments > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Migration completed! All eligible documents have been processed.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Batch Results History */}
        {batchResults.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Batch Results
              </CardTitle>
              <CardDescription>Performance metrics for recent batch operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {batchResults.map((result) => (
                  <div key={result.batchNumber} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                      <Badge variant="outline">Batch {result.batchNumber}</Badge>
                      <div className="text-sm">
                        <span className="font-medium">{result.processed}</span> processed,{" "}
                        <span className="text-green-600 font-medium">{result.successful}</span> successful,{" "}
                        <span className="text-orange-600 font-medium">{result.skipped}</span> skipped,{" "}
                        <span className="text-red-600 font-medium">{result.errors}</span> errors
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">{result.duration}ms</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detailed Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">To Migrate</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{migrationStats.totalToMigrate}</div>
              <p className="text-xs text-muted-foreground">Documents requiring migration</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{migrationStats.processedDocuments}</div>
              <p className="text-xs text-muted-foreground">Batch {migrationStats.currentBatch}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Successful</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{migrationStats.successfulUpdates}</div>
              <p className="text-xs text-muted-foreground">Successfully updated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{migrationStats.errorDocuments}</div>
              <p className="text-xs text-muted-foreground">Processing errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Data Integrity Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Data Integrity & User Validation
            </CardTitle>
            <CardDescription>Performance metrics for recent batch operations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-semibold text-green-600">{migrationStats.validUsersFound}</div>
                <div className="text-xs text-green-600">Valid Users Found</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">{migrationStats.usersWithCompanyId}</div>
                <div className="text-xs text-blue-600">Users with Company ID</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-semibold text-yellow-600">{migrationStats.dataIntegrityIssues}</div>
                <div className="text-xs text-yellow-600">Data Integrity Issues</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-semibold text-red-600">{migrationStats.validationErrors}</div>
                <div className="text-xs text-red-600">Validation Errors</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Enhanced Migration Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Migration Logs
            </CardTitle>
            <CardDescription>Detailed logs with enhanced error tracking and debugging information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {logs.slice(0, 50).map((log) => (
                <div key={log.id} className="flex items-start gap-2 p-3 rounded-lg bg-gray-50">
                  <Badge
                    variant={
                      log.status === "success"
                        ? "default"
                        : log.status === "error"
                          ? "destructive"
                          : log.status === "warning"
                            ? "secondary"
                            : log.status === "validation"
                              ? "outline"
                              : "secondary"
                    }
                    className="mt-0.5 shrink-0"
                  >
                    {log.status.toUpperCase()}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.message}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                      <span>{log.timestamp.toLocaleTimeString()}</span>
                      {log.bookingId !== "system" && <span>Booking: {log.bookingId.slice(0, 8)}...</span>}
                      {log.details?.userId && <span>User: {log.details.userId.slice(0, 8)}...</span>}
                      {log.details?.companyId && <span>Company: {log.details.companyId.slice(0, 8)}...</span>}
                      {log.details?.batchNumber && <span>Batch: {log.details.batchNumber}</span>}
                      {log.details?.errorCode && <span className="text-red-600">Code: {log.details.errorCode}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No logs yet</p>
                  <p className="text-sm">Start the migration process to see detailed logs</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MigrationLayout>
  )
}
