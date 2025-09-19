"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, XCircle, AlertCircle, Users, MessageSquare, ArrowRight, RotateCcw, Search } from "lucide-react"
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

interface ChatDocument {
  id: string
  users: string[] // Array of user IDs
  company_id?: string
  [key: string]: any
}

interface UserDocument {
  id: string
  company_id?: string
  [key: string]: any
}

interface ValidationResult {
  isValid: boolean
  hasProperty: boolean
  value: string | null
  type: string
  reason?: string
}

interface MigrationStats {
  totalChats: number
  processedChats: number
  updatedChats: number
  skippedChats: number
  errorChats: number
  validUsersFound: number
  noValidUserFound: number
  usersWithCompanyId: number
  usersWithoutCompanyId: number
  totalIndicesChecked: number
  currentBatch: number
  totalBatches: number
  validationErrors: number
  dataIntegrityIssues: number
}

interface MigrationLog {
  chatId: string
  status: "success" | "error" | "skipped" | "warning" | "validation"
  message: string
  userId?: string
  userIndex?: number
  companyId?: string
  indicesChecked?: number
  batchNumber?: number
  validationDetails?: ValidationResult
  timestamp: Date
}

const BATCH_SIZE = 10

export default function MigrateChatCompaniesPage() {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMoreData, setHasMoreData] = useState(true)
  const [stats, setStats] = useState<MigrationStats>({
    totalChats: 0,
    processedChats: 0,
    updatedChats: 0,
    skippedChats: 0,
    errorChats: 0,
    validUsersFound: 0,
    noValidUserFound: 0,
    usersWithCompanyId: 0,
    usersWithoutCompanyId: 0,
    totalIndicesChecked: 0,
    currentBatch: 0,
    totalBatches: 0,
    validationErrors: 0,
    dataIntegrityIssues: 0,
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
    setLogs((prev) => [...prev, { ...log, timestamp: new Date() }])
  }

  // Enhanced validation function for company_id
  const validateCompanyId = (data: any, context: string): ValidationResult => {
    const result: ValidationResult = {
      isValid: false,
      hasProperty: false,
      value: null,
      type: typeof data?.company_id,
    }

    try {
      // Check if property exists
      result.hasProperty = data && typeof data === "object" && data.hasOwnProperty("company_id")

      if (!result.hasProperty) {
        result.reason = "Property 'company_id' does not exist"
        return result
      }

      const companyId = data.company_id
      result.value = companyId
      result.type = typeof companyId

      // Validate company_id value
      if (companyId === null) {
        result.reason = "company_id is null"
        return result
      }

      if (companyId === undefined) {
        result.reason = "company_id is undefined"
        return result
      }

      if (typeof companyId !== "string") {
        result.reason = `company_id is not a string (type: ${typeof companyId})`
        return result
      }

      if (companyId.trim() === "") {
        result.reason = "company_id is empty string"
        return result
      }

      if (companyId.length < 3) {
        result.reason = `company_id too short (${companyId.length} characters): "${companyId}"`
        return result
      }

      // Valid company_id found
      result.isValid = true
      result.reason = `Valid company_id: "${companyId}"`
      return result
    } catch (error) {
      result.reason = `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`
      return result
    }
  }

  // Update real-time stats whenever main stats change
  const updateStats = (updates: Partial<MigrationStats>) => {
    setStats((prev) => {
      const newStats = { ...prev, ...updates }

      // Sync with real-time stats
      setRealTimeStats((prevReal) => ({
        ...prevReal,
        totalItems: newStats.totalChats,
        processedItems: newStats.processedChats,
        successfulItems: newStats.updatedChats,
        errorItems: newStats.errorChats,
        skippedItems: newStats.skippedChats,
        processingRate:
          isProcessing && startTime > 0 ? Math.round(newStats.processedChats / ((Date.now() - startTime) / 1000)) : 0,
      }))

      return newStats
    })
  }

  // Enhanced user lookup with proper error handling
  const getUserById = async (userId: string): Promise<UserDocument | null> => {
    try {
      if (!userId || typeof userId !== "string" || userId.trim() === "") {
        addLog({
          chatId: "user_lookup",
          status: "validation",
          message: `Invalid user ID provided: ${JSON.stringify(userId)} (type: ${typeof userId})`,
        })
        return null
      }

      // Use direct document reference for more reliable lookup
      const userDocRef = doc(db, "iboard_users", userId)
      const userDocSnapshot = await getDoc(userDocRef)

      if (userDocSnapshot.exists()) {
        const userData = userDocSnapshot.data()
        const userDocument: UserDocument = {
          id: userDocSnapshot.id,
          ...userData,
        }

        // Validate the retrieved user data
        const validation = validateCompanyId(userDocument, `user_${userId}`)

        addLog({
          chatId: "user_lookup",
          status: validation.isValid ? "success" : "validation",
          message: `User ${userId} lookup: ${validation.reason}`,
          userId,
          validationDetails: validation,
        })

        return userDocument
      } else {
        addLog({
          chatId: "user_lookup",
          status: "warning",
          message: `User document not found: ${userId}`,
          userId,
        })
        return null
      }
    } catch (error) {
      addLog({
        chatId: "user_lookup",
        status: "error",
        message: `Error fetching user ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`,
        userId,
      })
      return null
    }
  }

  // Enhanced function to find valid user with comprehensive validation
  const findValidUserWithCompanyId = async (
    users: string[],
    chatId: string,
    batchNumber: number,
  ): Promise<{ userId: string; userIndex: number; companyId: string; indicesChecked: number } | null> => {
    let indicesChecked = 0

    try {
      addLog({
        chatId,
        status: "success",
        message: `Batch ${batchNumber}: Starting user validation for ${users.length} users`,
        batchNumber,
      })

      // Iterate through users array starting from index 0
      for (let i = 0; i < users.length; i++) {
        indicesChecked++
        const userId = users[i]

        addLog({
          chatId,
          status: "validation",
          message: `Batch ${batchNumber}: Checking user at index ${i}: ${JSON.stringify(userId)} (type: ${typeof userId})`,
          userIndex: i,
          userId: userId || undefined,
          batchNumber,
        })

        // Enhanced user ID validation
        if (!userId) {
          addLog({
            chatId,
            status: "validation",
            message: `Batch ${batchNumber}: User ID at index ${i} is ${userId === null ? "null" : userId === undefined ? "undefined" : "falsy"}`,
            userIndex: i,
            batchNumber,
          })
          continue
        }

        if (typeof userId !== "string") {
          addLog({
            chatId,
            status: "validation",
            message: `Batch ${batchNumber}: User ID at index ${i} is not a string (type: ${typeof userId}, value: ${JSON.stringify(userId)})`,
            userIndex: i,
            batchNumber,
          })
          updateStats({ validationErrors: stats.validationErrors + 1 })
          continue
        }

        if (userId.trim() === "") {
          addLog({
            chatId,
            status: "validation",
            message: `Batch ${batchNumber}: User ID at index ${i} is empty string`,
            userIndex: i,
            batchNumber,
          })
          continue
        }

        // Query iboard_users collection for this user
        const user = await getUserById(userId)

        if (user) {
          // Valid user found in iboard_users collection
          updateStats({ validUsersFound: stats.validUsersFound + 1 })

          // Validate user's company_id with enhanced validation
          const validation = validateCompanyId(user, `user_${userId}`)

          addLog({
            chatId,
            status: validation.isValid ? "success" : "validation",
            message: `Batch ${batchNumber}: User ${userId} at index ${i} - ${validation.reason}`,
            userId: user.id,
            userIndex: i,
            batchNumber,
            validationDetails: validation,
          })

          if (validation.isValid && validation.value) {
            // User has valid company_id - SUCCESS!
            updateStats({
              usersWithCompanyId: stats.usersWithCompanyId + 1,
              totalIndicesChecked: stats.totalIndicesChecked + indicesChecked,
            })

            addLog({
              chatId,
              status: "success",
              message: `Batch ${batchNumber}: Found user with valid company_id at index ${i} - stopping further checks`,
              userId: user.id,
              userIndex: i,
              companyId: validation.value,
              indicesChecked,
              batchNumber,
            })

            return {
              userId: user.id,
              userIndex: i,
              companyId: validation.value,
              indicesChecked,
            }
          } else {
            // User found but no valid company_id
            updateStats({ usersWithoutCompanyId: stats.usersWithoutCompanyId + 1 })

            if (!validation.hasProperty) {
              updateStats({ dataIntegrityIssues: stats.dataIntegrityIssues + 1 })
            }

            addLog({
              chatId,
              status: "validation",
              message: `Batch ${batchNumber}: User at index ${i} - ${validation.reason} - continuing to next index`,
              userId: user.id,
              userIndex: i,
              batchNumber,
              validationDetails: validation,
            })
            continue
          }
        } else {
          // User not found in iboard_users - continue to next index
          addLog({
            chatId,
            status: "warning",
            message: `Batch ${batchNumber}: User not found in iboard_users at index ${i} - continuing to next index`,
            userId: userId,
            userIndex: i,
            batchNumber,
          })
          continue
        }
      }

      // All indices checked, no valid user with company_id found
      updateStats({
        noValidUserFound: stats.noValidUserFound + 1,
        totalIndicesChecked: stats.totalIndicesChecked + indicesChecked,
      })

      addLog({
        chatId,
        status: "error",
        message: `Batch ${batchNumber}: All ${indicesChecked} indices checked - no user with valid company_id found`,
        indicesChecked,
        batchNumber,
      })

      return null
    } catch (error) {
      console.error("Error finding valid user with company ID:", error)
      updateStats({
        totalIndicesChecked: stats.totalIndicesChecked + indicesChecked,
        validationErrors: stats.validationErrors + 1,
      })

      addLog({
        chatId,
        status: "error",
        message: `Batch ${batchNumber}: Error during user search: ${error instanceof Error ? error.message : "Unknown error"}`,
        indicesChecked,
        batchNumber,
      })

      return null
    }
  }

  // Enhanced chat validation before processing
  const validateChatDocument = (chatData: ChatDocument, chatId: string, batchNumber: number): boolean => {
    // Validate chat has company_id property and check its value
    const validation = validateCompanyId(chatData, `chat_${chatId}`)

    addLog({
      chatId,
      status: "validation",
      message: `Batch ${batchNumber}: Chat validation - ${validation.reason}`,
      batchNumber,
      validationDetails: validation,
    })

    return validation.isValid
  }

  // Process next batch of 10 chats with enhanced validation
  const processNextBatch = async () => {
    if (!hasMoreData) {
      addLog({
        chatId: "system",
        status: "success",
        message: "No more data to process",
      })
      return
    }

    setIsProcessing(true)
    const currentBatchNumber = stats.currentBatch + 1

    try {
      addLog({
        chatId: "system",
        status: "success",
        message: `Starting batch ${currentBatchNumber} - processing ${BATCH_SIZE} chat entries with enhanced validation...`,
        batchNumber: currentBatchNumber,
      })

      // Build query for next batch
      let chatsQuery = query(collection(db, "chats"), limit(BATCH_SIZE))

      if (lastDoc) {
        chatsQuery = query(collection(db, "chats"), startAfter(lastDoc), limit(BATCH_SIZE))
      }

      const chatsSnapshot = await getDocs(chatsQuery)

      if (chatsSnapshot.empty) {
        setHasMoreData(false)
        addLog({
          chatId: "system",
          status: "success",
          message: `Batch ${currentBatchNumber}: No more chat documents found - migration complete`,
          batchNumber: currentBatchNumber,
        })
        return
      }

      // Process current batch
      const batch = writeBatch(db)
      let batchUpdates = 0
      let batchProcessed = 0
      let batchUpdatedCount = 0
      let batchSkippedCount = 0
      let batchErrorCount = 0

      for (const chatDoc of chatsSnapshot.docs) {
        const chatData = chatDoc.data() as ChatDocument
        const chatId = chatDoc.id

        addLog({
          chatId,
          status: "success",
          message: `Batch ${currentBatchNumber}: Starting processing of chat document`,
          batchNumber: currentBatchNumber,
        })

        try {
          // Enhanced validation: Check if chat already has valid company_id
          if (validateChatDocument(chatData, chatId, currentBatchNumber)) {
            batchSkippedCount++
            addLog({
              chatId,
              status: "skipped",
              message: `Batch ${currentBatchNumber}: Chat already has valid company_id: ${chatData.company_id}`,
              companyId: chatData.company_id,
              batchNumber: currentBatchNumber,
            })
            batchProcessed++
            continue
          }

          // Enhanced users array validation
          if (!chatData.hasOwnProperty("users")) {
            batchErrorCount++
            updateStats({ dataIntegrityIssues: stats.dataIntegrityIssues + 1 })
            addLog({
              chatId,
              status: "error",
              message: `Batch ${currentBatchNumber}: Chat document missing 'users' property`,
              batchNumber: currentBatchNumber,
            })
            batchProcessed++
            continue
          }

          if (!Array.isArray(chatData.users)) {
            batchErrorCount++
            updateStats({ dataIntegrityIssues: stats.dataIntegrityIssues + 1 })
            addLog({
              chatId,
              status: "error",
              message: `Batch ${currentBatchNumber}: 'users' property is not an array (type: ${typeof chatData.users})`,
              batchNumber: currentBatchNumber,
            })
            batchProcessed++
            continue
          }

          if (chatData.users.length === 0) {
            batchErrorCount++
            addLog({
              chatId,
              status: "error",
              message: `Batch ${currentBatchNumber}: Users array is empty`,
              batchNumber: currentBatchNumber,
            })
            batchProcessed++
            continue
          }

          addLog({
            chatId,
            status: "success",
            message: `Batch ${currentBatchNumber}: Found users array with ${chatData.users.length} entries - starting enhanced validation`,
            batchNumber: currentBatchNumber,
          })

          // Find first valid user with company_id using enhanced validation
          const userInfo = await findValidUserWithCompanyId(chatData.users, chatId, currentBatchNumber)

          if (userInfo) {
            // Double-check: Re-validate the company_id before updating
            const finalValidation = validateCompanyId({ company_id: userInfo.companyId }, "final_check")

            if (finalValidation.isValid) {
              // Update chat with user's company_id
              batch.update(doc(db, "chats", chatId), {
                company_id: userInfo.companyId,
                migration_source: "chat_company_migration",
                migration_timestamp: new Date(),
                migration_user_id: userInfo.userId,
                migration_user_index: userInfo.userIndex,
                migration_indices_checked: userInfo.indicesChecked,
                migration_batch: currentBatchNumber,
              })

              batchUpdates++
              batchUpdatedCount++

              addLog({
                chatId,
                status: "success",
                message: `Batch ${currentBatchNumber}: Chat will be updated with company_id: ${userInfo.companyId} (from user ${userInfo.userId} at index ${userInfo.userIndex})`,
                userId: userInfo.userId,
                userIndex: userInfo.userIndex,
                companyId: userInfo.companyId,
                indicesChecked: userInfo.indicesChecked,
                batchNumber: currentBatchNumber,
              })
            } else {
              batchErrorCount++
              updateStats({ validationErrors: stats.validationErrors + 1 })
              addLog({
                chatId,
                status: "error",
                message: `Batch ${currentBatchNumber}: Final validation failed for company_id: ${finalValidation.reason}`,
                batchNumber: currentBatchNumber,
              })
            }
          } else {
            batchSkippedCount++
            addLog({
              chatId,
              status: "skipped",
              message: `Batch ${currentBatchNumber}: No user with valid company_id found in users array`,
              batchNumber: currentBatchNumber,
            })
          }

          batchProcessed++
        } catch (error) {
          batchErrorCount++
          addLog({
            chatId,
            status: "error",
            message: `Batch ${currentBatchNumber}: Error processing chat: ${error instanceof Error ? error.message : "Unknown error"}`,
            batchNumber: currentBatchNumber,
          })
          batchProcessed++
        }
      }

      // Commit batch updates if any
      if (batchUpdates > 0) {
        await batch.commit()
        addLog({
          chatId: "system",
          status: "success",
          message: `Batch ${currentBatchNumber}: Successfully committed ${batchUpdates} updates to Firestore`,
          batchNumber: currentBatchNumber,
        })
      } else {
        addLog({
          chatId: "system",
          status: "warning",
          message: `Batch ${currentBatchNumber}: No updates to commit`,
          batchNumber: currentBatchNumber,
        })
      }

      // Update stats
      updateStats({
        processedChats: stats.processedChats + batchProcessed,
        updatedChats: stats.updatedChats + batchUpdatedCount,
        skippedChats: stats.skippedChats + batchSkippedCount,
        errorChats: stats.errorChats + batchErrorCount,
        currentBatch: currentBatchNumber,
      })

      // Update progress
      const newProgress = Math.min(100, Math.round((stats.processedChats / Math.max(stats.totalChats, 1)) * 100))
      setProgress(newProgress)

      // Set last document for pagination
      const lastDocument = chatsSnapshot.docs[chatsSnapshot.docs.length - 1]
      setLastDoc(lastDocument)

      // Check if there's more data
      if (chatsSnapshot.docs.length < BATCH_SIZE) {
        setHasMoreData(false)
        addLog({
          chatId: "system",
          status: "success",
          message: `Batch ${currentBatchNumber}: Reached end of collection - no more data to process`,
          batchNumber: currentBatchNumber,
        })
      }

      addLog({
        chatId: "system",
        status: "success",
        message: `Batch ${currentBatchNumber} completed: Processed ${batchProcessed}, Updated ${batchUpdatedCount}, Skipped ${batchSkippedCount}, Errors ${batchErrorCount}`,
        batchNumber: currentBatchNumber,
      })
    } catch (error) {
      console.error("Error processing batch:", error)
      addLog({
        chatId: "system",
        status: "error",
        message: `Batch ${currentBatchNumber}: Error processing batch: ${error instanceof Error ? error.message : "Unknown error"}`,
        batchNumber: currentBatchNumber,
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Process all remaining batches
  const processAllBatches = async () => {
    if (!hasMoreData) {
      addLog({
        chatId: "system",
        status: "success",
        message: "No more data to process",
      })
      return
    }

    setStartTime(Date.now())

    addLog({
      chatId: "system",
      status: "success",
      message: "Starting automated processing of all remaining batches...",
    })

    while (hasMoreData && !isProcessing) {
      await processNextBatch()
      // Small delay between batches to prevent overwhelming the database
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    addLog({
      chatId: "system",
      status: "success",
      message: "Automated processing completed",
    })
  }

  // Reset migration state
  const resetMigration = () => {
    setProgress(0)
    setLastDoc(null)
    setHasMoreData(true)
    setStats({
      totalChats: 0,
      processedChats: 0,
      updatedChats: 0,
      skippedChats: 0,
      errorChats: 0,
      validUsersFound: 0,
      noValidUserFound: 0,
      usersWithCompanyId: 0,
      usersWithoutCompanyId: 0,
      totalIndicesChecked: 0,
      currentBatch: 0,
      totalBatches: 0,
      validationErrors: 0,
      dataIntegrityIssues: 0,
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
      chatId: "system",
      status: "success",
      message: "Migration state reset",
    })
  }

  // Get total chat count for progress calculation
  const getTotalChatCount = async () => {
    try {
      const chatsSnapshot = await getDocs(collection(db, "chats"))
      const totalCount = chatsSnapshot.size
      updateStats({ totalChats: totalCount })
      addLog({
        chatId: "system",
        status: "success",
        message: `Total chat documents found: ${totalCount}`,
      })
    } catch (error) {
      addLog({
        chatId: "system",
        status: "error",
        message: `Error getting total chat count: ${error instanceof Error ? error.message : "Unknown error"}`,
      })
    }
  }

  return (
    <MigrationLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Migrate Chat Companies</h1>
            <p className="text-muted-foreground">
              Update chat records with company information from user data (Enhanced Validation)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={getTotalChatCount} variant="outline" size="sm">
              <Search className="h-4 w-4 mr-1" />
              Count Chats
            </Button>
            <Button onClick={resetMigration} variant="outline" size="sm">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
          </div>
        </div>

        {/* Real-Time Migration Monitor */}
        <RealTimeMigrationMonitor
          migrationName="Chat Companies"
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
          title="Chat Migration Statistics"
          description="Real-time progress of chat company assignments with enhanced validation"
          stats={{
            totalItems: stats.totalChats,
            processedItems: stats.processedChats,
            successfulItems: stats.updatedChats,
            errorItems: stats.errorChats,
            skippedItems: stats.skippedChats,
            lastUpdated: new Date(),
          }}
        />

        {/* Migration Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Migration Controls
            </CardTitle>
            <CardDescription>Process chat documents in batches of {BATCH_SIZE}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button onClick={processNextBatch} disabled={isProcessing || !hasMoreData}>
                {isProcessing ? "Processing..." : "Process Next Batch"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button onClick={processAllBatches} disabled={isProcessing || !hasMoreData} variant="secondary">
                Process All Batches
              </Button>
            </div>

            {progress > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="w-full" />
              </div>
            )}

            {!hasMoreData && stats.processedChats > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>Migration completed! All chat documents have been processed.</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Enhanced Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalChats}</div>
              <p className="text-xs text-muted-foreground">Documents in collection</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processedChats}</div>
              <p className="text-xs text-muted-foreground">Batch {stats.currentBatch}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Updated</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.updatedChats}</div>
              <p className="text-xs text-muted-foreground">Successfully updated</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Errors</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.errorChats}</div>
              <p className="text-xs text-muted-foreground">Processing errors</p>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced User Validation Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Validation Statistics
            </CardTitle>
            <CardDescription>Detailed breakdown of user validation process</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-semibold text-green-600">{stats.validUsersFound}</div>
                <div className="text-xs text-green-600">Valid Users Found</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">{stats.usersWithCompanyId}</div>
                <div className="text-xs text-blue-600">Users with Company ID</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 rounded-lg">
                <div className="text-lg font-semibold text-yellow-600">{stats.usersWithoutCompanyId}</div>
                <div className="text-xs text-yellow-600">Users without Company ID</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-lg font-semibold text-red-600">{stats.validationErrors}</div>
                <div className="text-xs text-red-600">Validation Errors</div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-semibold text-purple-600">{stats.totalIndicesChecked}</div>
                <div className="text-xs text-purple-600">Total Indices Checked</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-semibold text-orange-600">{stats.noValidUserFound}</div>
                <div className="text-xs text-orange-600">No Valid User Found</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-600">{stats.dataIntegrityIssues}</div>
                <div className="text-xs text-gray-600">Data Integrity Issues</div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                      {log.chatId !== "system" && log.chatId !== "user_lookup" && (
                        <span>Chat: {log.chatId.slice(0, 8)}...</span>
                      )}
                      {log.userId && <span>User: {log.userId.slice(0, 8)}...</span>}
                      {log.userIndex !== undefined && <span>Index: {log.userIndex}</span>}
                      {log.companyId && <span>Company: {log.companyId.slice(0, 8)}...</span>}
                      {log.batchNumber && <span>Batch: {log.batchNumber}</span>}
                    </div>
                  </div>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
