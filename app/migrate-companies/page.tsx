"use client"

import { useState, useRef } from "react"
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  writeBatch,
  addDoc,
  limit,
  startAfter,
  orderBy,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore"
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
  Users,
  Database,
  TrendingUp,
  FileText,
  Info,
  Building2,
  Key,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MigrationLayout } from "@/components/migration-layout"
import { MigrationStatsCard } from "@/components/migration-stats-card"
import { RealTimeMigrationMonitor } from "@/components/real-time-migration-monitor"

// Types
interface UserRecord {
  id: string
  company_id?: string | null
  email?: string
  display_name?: string
  name?: string
  license_key?: string | null
  created_at?: any
  updated_at?: any
  _batchNumber?: number
  _retrievalTimestamp?: string
  _priority?: "license_key" | "no_license_key"
}

interface LicenseKeyGroup {
  license_key: string
  users: UserRecord[]
  existing_company_id?: string | null
  needs_new_company: boolean
}

interface BatchUpdateResult {
  batchNumber: number
  totalInBatch: number
  successful: number
  skipped: number
  errors: number
  companiesCreated: number
  errorMessages: string[]
  processingTime: number
  timestamp: string
  operationType: "license_key_group" | "individual_users"
}

interface MigrationProgress {
  phase: "idle" | "scanning" | "processing" | "completed" | "error" | "paused"
  totalUsers: number
  scannedUsers: number
  processedUsers: number
  successfulUpdates: number
  skippedUsers: number
  errorCount: number
  companiesCreated: number
  currentBatch: number
  totalBatches: number
  startTime?: Date
  endTime?: Date
  isPaused: boolean
  canResume: boolean
  errorMessage?: string
  // License key specific tracking
  licenseKeyUsers: number
  noLicenseKeyUsers: number
  licenseKeyGroups: number
  processedLicenseKeyUsers: number
  processedNoLicenseKeyUsers: number
  currentProcessingGroup: "license_key" | "no_license_key" | "idle"
}

interface MigrationState {
  progress: MigrationProgress
  currentBatchUsers: UserRecord[]
  recentBatches: BatchUpdateResult[]
  processedUserIds: Set<string>
  debugLogs: string[]
  licenseKeyGroups: LicenseKeyGroup[]
  individualUsers: UserRecord[]
}

const INDIVIDUAL_BATCH_SIZE = 10
const SCAN_BATCH_SIZE = 100
const MAX_DEBUG_LOGS = 50

export default function MigrateCompaniesPage() {
  const [migrationState, setMigrationState] = useState<MigrationState>({
    progress: {
      phase: "idle",
      totalUsers: 0,
      scannedUsers: 0,
      processedUsers: 0,
      successfulUpdates: 0,
      skippedUsers: 0,
      errorCount: 0,
      companiesCreated: 0,
      currentBatch: 0,
      totalBatches: 0,
      isPaused: false,
      canResume: false,
      licenseKeyUsers: 0,
      noLicenseKeyUsers: 0,
      licenseKeyGroups: 0,
      processedLicenseKeyUsers: 0,
      processedNoLicenseKeyUsers: 0,
      currentProcessingGroup: "idle",
    },
    currentBatchUsers: [],
    recentBatches: [],
    processedUserIds: new Set(),
    debugLogs: [],
    licenseKeyGroups: [],
    individualUsers: [],
  })

  const [showUserPreview, setShowUserPreview] = useState(false)

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

  // Step 1: Scan and categorize users without company_id
  const scanAndCategorizeUsers = async (): Promise<{
    licenseKeyGroups: LicenseKeyGroup[]
    individualUsers: UserRecord[]
  }> => {
    addDebugLog("Starting scan for users without company_id in iboard_users collection")

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        phase: "scanning",
        startTime: new Date(),
      },
    }))

    try {
      const usersWithoutCompanyId: UserRecord[] = []
      let lastDoc: QueryDocumentSnapshot<DocumentData> | undefined
      let batchCount = 0
      let totalScanned = 0

      // Scan all users without company_id
      while (true) {
        if (checkPauseRequested()) {
          addDebugLog("Pause requested during user scanning - stopping scan")
          throw new Error("User scanning paused by user")
        }

        batchCount++
        addDebugLog(`Processing scan batch ${batchCount}...`)

        const usersQuery = lastDoc
          ? query(collection(db, "iboard_users"), orderBy("__name__"), startAfter(lastDoc), limit(SCAN_BATCH_SIZE))
          : query(collection(db, "iboard_users"), orderBy("__name__"), limit(SCAN_BATCH_SIZE))

        const snapshot = await getDocs(usersQuery)

        if (snapshot.empty) {
          addDebugLog(`No more users found. Completed scanning after ${batchCount} batches.`)
          break
        }

        // Filter users that need company_id migration
        snapshot.docs.forEach((docSnapshot) => {
          const data = docSnapshot.data()
          const user: UserRecord = { id: docSnapshot.id, ...data }
          totalScanned++

          // Check if user needs company_id migration
          const needsCompanyId = !isValidCompanyId(data.company_id)

          if (needsCompanyId) {
            user._batchNumber = batchCount
            user._retrievalTimestamp = new Date().toISOString()
            usersWithoutCompanyId.push(user)
          }
        })

        // Update progress
        setMigrationState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            scannedUsers: totalScanned,
            totalUsers: usersWithoutCompanyId.length,
          },
        }))

        lastDoc = snapshot.docs[snapshot.docs.length - 1]
        addDebugLog(
          `Scan batch ${batchCount}: Found ${usersWithoutCompanyId.length} users needing migration (${totalScanned} total scanned)`,
        )

        // Safety check
        if (batchCount > 1000) {
          addDebugLog("Safety limit reached: processed 1000 scan batches, stopping")
          break
        }

        await new Promise((resolve) => setTimeout(resolve, 100))
      }

      // Step 2: Categorize users by license_key presence
      const usersWithLicenseKey: UserRecord[] = []
      const usersWithoutLicenseKey: UserRecord[] = []

      usersWithoutCompanyId.forEach((user) => {
        if (user.license_key && typeof user.license_key === "string" && user.license_key.trim() !== "") {
          user._priority = "license_key"
          usersWithLicenseKey.push(user)
        } else {
          user._priority = "no_license_key"
          usersWithoutLicenseKey.push(user)
        }
      })

      addDebugLog(
        `Categorization complete: ${usersWithLicenseKey.length} users with license_key, ${usersWithoutLicenseKey.length} users without license_key`,
      )

      // Step 3: Group users with license_key and check for existing company_id
      const licenseKeyGroups = await groupUsersByLicenseKey(usersWithLicenseKey)

      const totalBatches = licenseKeyGroups.length + Math.ceil(usersWithoutLicenseKey.length / INDIVIDUAL_BATCH_SIZE)

      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          totalUsers: usersWithoutCompanyId.length,
          totalBatches,
          scannedUsers: totalScanned,
          licenseKeyUsers: usersWithLicenseKey.length,
          noLicenseKeyUsers: usersWithoutLicenseKey.length,
          licenseKeyGroups: licenseKeyGroups.length,
        },
        licenseKeyGroups,
        individualUsers: usersWithoutLicenseKey,
      }))

      addDebugLog(
        `Migration plan: ${licenseKeyGroups.length} license key groups (${usersWithLicenseKey.length} users), ${usersWithoutLicenseKey.length} individual users`,
      )

      return { licenseKeyGroups, individualUsers: usersWithoutLicenseKey }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addDebugLog(`Error during user scanning: ${errorMessage}`)

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

  // Group users by license_key and check for existing company_id
  const groupUsersByLicenseKey = async (users: UserRecord[]): Promise<LicenseKeyGroup[]> => {
    addDebugLog("Grouping users by license_key and checking for existing company_id...")

    const licenseKeyMap = new Map<string, UserRecord[]>()

    // Group users by license_key
    users.forEach((user) => {
      const licenseKey = user.license_key!
      if (!licenseKeyMap.has(licenseKey)) {
        licenseKeyMap.set(licenseKey, [])
      }
      licenseKeyMap.get(licenseKey)!.push(user)
    })

    const groups: LicenseKeyGroup[] = []

    // For each license key group, check if any user already has a company_id
    for (const [licenseKey, groupUsers] of licenseKeyMap) {
      addDebugLog(`Processing license key group: ${licenseKey} (${groupUsers.length} users)`)

      // Query all users with this license_key to find existing company_id
      const licenseKeyQuery = query(
        collection(db, "iboard_users"),
        where("license_key", "==", licenseKey),
        where("company_id", "!=", null),
        limit(1),
      )

      const existingSnapshot = await getDocs(licenseKeyQuery)
      let existing_company_id: string | null = null

      if (!existingSnapshot.empty) {
        const existingUser = existingSnapshot.docs[0].data()
        existing_company_id = existingUser.company_id
        addDebugLog(`Found existing company_id for license key ${licenseKey}: ${existing_company_id}`)
      } else {
        addDebugLog(`No existing company_id found for license key ${licenseKey}, will create new company`)
      }

      groups.push({
        license_key: licenseKey,
        users: groupUsers,
        existing_company_id,
        needs_new_company: !existing_company_id,
      })
    }

    addDebugLog(`Created ${groups.length} license key groups`)
    return groups
  }

  // Create a new empty company document
  const createNewCompany = async (): Promise<string> => {
    try {
      const newCompanyRef = await addDoc(collection(db, "companies"), {
        name: "",
        description: "",
        created_at: new Date(),
        updated_at: new Date(),
        active: true,
        migration_source: "user_company_migration",
        migration_timestamp: new Date().toISOString(),
      })

      addDebugLog(`Created new company with ID: ${newCompanyRef.id}`)
      return newCompanyRef.id
    } catch (error) {
      addDebugLog(`Error creating new company: ${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }

  // Process a license key group
  const processLicenseKeyGroup = async (group: LicenseKeyGroup, batchNumber: number): Promise<BatchUpdateResult> => {
    const startTime = Date.now()
    addDebugLog(`Processing license key group: ${group.license_key} (${group.users.length} users)`)

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentBatch: batchNumber,
      },
      currentBatchUsers: group.users,
    }))

    const batch = writeBatch(db)
    let successful = 0
    let skipped = 0
    let errors = 0
    let companiesCreated = 0
    const errorMessages: string[] = []

    try {
      // Determine company_id to use
      let companyId = group.existing_company_id

      // Create new company if needed
      if (group.needs_new_company) {
        companyId = await createNewCompany()
        companiesCreated = 1
      }

      if (!companyId) {
        throw new Error(`No company_id available for license key group: ${group.license_key}`)
      }

      // Update all users in the group
      for (const user of group.users) {
        try {
          if (migrationState.processedUserIds.has(user.id)) {
            skipped++
            continue
          }

          const userRef = doc(db, "iboard_users", user.id)
          const updateData = {
            company_id: companyId,
            updated_at: new Date(),
            migration_timestamp: new Date().toISOString(),
            migration_source: "user_company_migration_license_key",
            migration_batch: batchNumber,
            migration_license_key: group.license_key,
          }

          batch.update(userRef, updateData)
          successful++

          addDebugLog(`Added user ${user.id} to batch update with company_id: ${companyId}`)
        } catch (error) {
          const errorMsg = `Error processing user ${user.id}: ${error instanceof Error ? error.message : String(error)}`
          addDebugLog(errorMsg)
          errorMessages.push(errorMsg)
          errors++
        }
      }

      // Commit the batch
      if (successful > 0) {
        await batch.commit()
        addDebugLog(`Successfully committed license key group batch with ${successful} updates`)

        // Mark users as processed
        setMigrationState((prev) => ({
          ...prev,
          processedUserIds: new Set([...prev.processedUserIds, ...group.users.map((u) => u.id)]),
        }))
      }

      const processingTime = Date.now() - startTime
      const result: BatchUpdateResult = {
        batchNumber,
        totalInBatch: group.users.length,
        successful,
        skipped,
        errors,
        companiesCreated,
        errorMessages,
        processingTime,
        timestamp: new Date().toISOString(),
        operationType: "license_key_group",
      }

      // Update progress
      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          processedUsers: prev.progress.processedUsers + group.users.length,
          successfulUpdates: prev.progress.successfulUpdates + successful,
          skippedUsers: prev.progress.skippedUsers + skipped,
          errorCount: prev.progress.errorCount + errors,
          companiesCreated: prev.progress.companiesCreated + companiesCreated,
          processedLicenseKeyUsers: prev.progress.processedLicenseKeyUsers + group.users.length,
        },
        recentBatches: [result, ...prev.recentBatches.slice(0, 9)],
        currentBatchUsers: [],
      }))

      addDebugLog(
        `License key group completed: ${successful} successful, ${skipped} skipped, ${errors} errors, ${companiesCreated} companies created`,
      )
      return result
    } catch (error) {
      const errorMsg = `License key group ${group.license_key} failed: ${error instanceof Error ? error.message : String(error)}`
      addDebugLog(errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Process individual users without license_key
  const processIndividualUsersBatch = async (users: UserRecord[], batchNumber: number): Promise<BatchUpdateResult> => {
    const startTime = Date.now()
    addDebugLog(`Processing individual users batch ${batchNumber} with ${users.length} users`)

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        currentBatch: batchNumber,
      },
      currentBatchUsers: users,
    }))

    const batch = writeBatch(db)
    let successful = 0
    let skipped = 0
    let errors = 0
    let companiesCreated = 0
    const errorMessages: string[] = []

    try {
      for (const user of users) {
        try {
          if (migrationState.processedUserIds.has(user.id)) {
            skipped++
            continue
          }

          // Create new company for each individual user
          const companyId = await createNewCompany()
          companiesCreated++

          const userRef = doc(db, "iboard_users", user.id)
          const updateData = {
            company_id: companyId,
            updated_at: new Date(),
            migration_timestamp: new Date().toISOString(),
            migration_source: "user_company_migration_individual",
            migration_batch: batchNumber,
          }

          batch.update(userRef, updateData)
          successful++

          addDebugLog(`Added user ${user.id} to batch update with new company_id: ${companyId}`)
        } catch (error) {
          const errorMsg = `Error processing user ${user.id}: ${error instanceof Error ? error.message : String(error)}`
          addDebugLog(errorMsg)
          errorMessages.push(errorMsg)
          errors++
        }
      }

      // Commit the batch
      if (successful > 0) {
        await batch.commit()
        addDebugLog(`Successfully committed individual users batch with ${successful} updates`)

        // Mark users as processed
        setMigrationState((prev) => ({
          ...prev,
          processedUserIds: new Set([...prev.processedUserIds, ...users.map((u) => u.id)]),
        }))
      }

      const processingTime = Date.now() - startTime
      const result: BatchUpdateResult = {
        batchNumber,
        totalInBatch: users.length,
        successful,
        skipped,
        errors,
        companiesCreated,
        errorMessages,
        processingTime,
        timestamp: new Date().toISOString(),
        operationType: "individual_users",
      }

      // Update progress
      setMigrationState((prev) => ({
        ...prev,
        progress: {
          ...prev.progress,
          processedUsers: prev.progress.processedUsers + users.length,
          successfulUpdates: prev.progress.successfulUpdates + successful,
          skippedUsers: prev.progress.skippedUsers + skipped,
          errorCount: prev.progress.errorCount + errors,
          companiesCreated: prev.progress.companiesCreated + companiesCreated,
          processedNoLicenseKeyUsers: prev.progress.processedNoLicenseKeyUsers + users.length,
        },
        recentBatches: [result, ...prev.recentBatches.slice(0, 9)],
        currentBatchUsers: [],
      }))

      addDebugLog(
        `Individual users batch completed: ${successful} successful, ${skipped} skipped, ${errors} errors, ${companiesCreated} companies created`,
      )
      return result
    } catch (error) {
      const errorMsg = `Individual users batch ${batchNumber} failed: ${error instanceof Error ? error.message : String(error)}`
      addDebugLog(errorMsg)
      throw new Error(errorMsg)
    }
  }

  // Main processing function
  const processAllUsers = async (licenseKeyGroups: LicenseKeyGroup[], individualUsers: UserRecord[]): Promise<void> => {
    addDebugLog(
      `Starting processing: ${licenseKeyGroups.length} license key groups, ${individualUsers.length} individual users`,
    )

    setMigrationState((prev) => ({
      ...prev,
      progress: {
        ...prev.progress,
        phase: "processing",
      },
    }))

    try {
      let batchNumber = 0

      // Phase 1: Process license key groups
      if (licenseKeyGroups.length > 0) {
        addDebugLog(`Phase 1: Processing ${licenseKeyGroups.length} license key groups`)

        setMigrationState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            currentProcessingGroup: "license_key",
          },
        }))

        for (const group of licenseKeyGroups) {
          if (checkPauseRequested()) {
            addDebugLog("Pause requested during license key group processing")
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

          batchNumber++
          await processLicenseKeyGroup(group, batchNumber)
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      // Phase 2: Process individual users
      if (individualUsers.length > 0) {
        addDebugLog(`Phase 2: Processing ${individualUsers.length} individual users`)

        setMigrationState((prev) => ({
          ...prev,
          progress: {
            ...prev.progress,
            currentProcessingGroup: "no_license_key",
          },
        }))

        for (let i = 0; i < individualUsers.length; i += INDIVIDUAL_BATCH_SIZE) {
          if (checkPauseRequested()) {
            addDebugLog("Pause requested during individual users processing")
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

          const batchUsers = individualUsers.slice(i, i + INDIVIDUAL_BATCH_SIZE)
          batchNumber++
          await processIndividualUsersBatch(batchUsers, batchNumber)
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
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
          currentProcessingGroup: "idle",
        },
      }))

      addDebugLog("Company migration completed successfully!")
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      addDebugLog(`Company migration failed: ${errorMessage}`)

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
    addDebugLog("Starting company migration process")

    try {
      const { licenseKeyGroups, individualUsers } = await scanAndCategorizeUsers()

      if (licenseKeyGroups.length === 0 && individualUsers.length === 0) {
        addDebugLog("No users found that need migration")
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

      await processAllUsers(licenseKeyGroups, individualUsers)
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
    addDebugLog("Resuming migration from current position")
    pauseRequestedRef.current = false

    try {
      // Filter out already processed groups and users
      const remainingLicenseKeyGroups = migrationState.licenseKeyGroups
        .map((group) => ({
          ...group,
          users: group.users.filter((user) => !migrationState.processedUserIds.has(user.id)),
        }))
        .filter((group) => group.users.length > 0)

      const remainingIndividualUsers = migrationState.individualUsers.filter(
        (user) => !migrationState.processedUserIds.has(user.id),
      )

      if (remainingLicenseKeyGroups.length === 0 && remainingIndividualUsers.length === 0) {
        addDebugLog("All users have been processed")
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

      await processAllUsers(remainingLicenseKeyGroups, remainingIndividualUsers)
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
        totalUsers: 0,
        scannedUsers: 0,
        processedUsers: 0,
        successfulUpdates: 0,
        skippedUsers: 0,
        errorCount: 0,
        companiesCreated: 0,
        currentBatch: 0,
        totalBatches: 0,
        isPaused: false,
        canResume: false,
        licenseKeyUsers: 0,
        noLicenseKeyUsers: 0,
        licenseKeyGroups: 0,
        processedLicenseKeyUsers: 0,
        processedNoLicenseKeyUsers: 0,
        currentProcessingGroup: "idle",
      },
      currentBatchUsers: [],
      recentBatches: [],
      processedUserIds: new Set(),
      debugLogs: [],
      licenseKeyGroups: [],
      individualUsers: [],
    })
    addDebugLog("Migration reset completed")
  }

  const { progress } = migrationState
  const progressPercentage =
    progress.totalUsers > 0 ? Math.round((progress.processedUsers / progress.totalUsers) * 100) : 0

  const canStart = progress.phase === "idle"
  const canPause = progress.phase === "processing" && !progress.isPaused
  const canResume = progress.phase === "paused" && progress.canResume
  const canReset = progress.phase !== "processing" || progress.isPaused

  const allUsers = [...migrationState.licenseKeyGroups.flatMap((g) => g.users), ...migrationState.individualUsers]

  return (
    <MigrationLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Company Migration</h1>
            <p className="text-muted-foreground">
              Migrate users without company_id by creating companies based on license_key grouping
            </p>
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

            {canReset && (
              <Button onClick={resetMigration} variant="outline" className="gap-2">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Real-Time Migration Monitor */}
        <RealTimeMigrationMonitor
          migrationName="Company Migration"
          isRunning={progress.phase === "processing"}
          totalItems={progress.totalUsers}
          processedItems={progress.processedUsers}
          successfulItems={progress.successfulUpdates}
          errorItems={progress.errorCount}
          skippedItems={progress.skippedUsers}
          processingRate={progress.phase === "processing" ? 2.0 : undefined}
          onRefresh={() => {}}
        />

        {/* Migration Stats Card */}
        <MigrationStatsCard
          title="Company Migration Statistics"
          description="Real-time progress of company creation and user assignment"
          stats={{
            totalItems: progress.totalUsers,
            processedItems: progress.processedUsers,
            successfulItems: progress.successfulUpdates,
            errorItems: progress.errorCount,
            skippedItems: progress.skippedUsers,
            lastUpdated: new Date(),
          }}
        />

        {/* Status Alerts */}
        {progress.phase === "completed" && progress.totalUsers === 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No users were found that require migration. All users in the collection already have a valid company_id
              assigned.
            </AlertDescription>
          </Alert>
        )}

        {progress.phase === "completed" && progress.totalUsers > 0 && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Migration completed successfully! {progress.successfulUpdates} users were assigned company IDs and{" "}
              {progress.companiesCreated} companies were created.
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
              Migration is paused. Progress has been saved and can be resumed later. Processed {progress.processedUsers}{" "}
              of {progress.totalUsers} users.
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
              {progress.phase === "idle" && "Ready to start company migration"}
              {progress.phase === "scanning" && "Scanning iboard_users collection and grouping by license_key"}
              {progress.phase === "processing" &&
                progress.currentProcessingGroup === "license_key" &&
                `Processing license_key groups - batch ${progress.currentBatch} of ${progress.totalBatches}`}
              {progress.phase === "processing" &&
                progress.currentProcessingGroup === "no_license_key" &&
                `Processing individual users - batch ${progress.currentBatch} of ${progress.totalBatches}`}
              {progress.phase === "completed" && "Company migration process completed"}
              {progress.phase === "error" && "Migration process encountered an error"}
              {progress.phase === "paused" && "Migration is paused and can be resumed"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.totalUsers > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Overall Progress</span>
                  <span>{progressPercentage}%</span>
                </div>
                <Progress value={progressPercentage} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {progress.processedUsers} of {progress.totalUsers} users processed
                </div>
              </div>
            )}

            {(progress.phase === "processing" || progress.phase === "scanning") && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress.phase === "scanning" ? "Scanning users..." : "Processing users..."}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">License Key Groups</CardTitle>
              <Key className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{progress.licenseKeyGroups}</div>
              <p className="text-xs text-muted-foreground">Groups to process</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">License Key Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{progress.licenseKeyUsers}</div>
              <p className="text-xs text-muted-foreground">Grouped users</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Individual Users</CardTitle>
              <Users className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{progress.noLicenseKeyUsers}</div>
              <p className="text-xs text-muted-foreground">No license key</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Found</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress.totalUsers}</div>
              <p className="text-xs text-muted-foreground">Users needing migration</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Processed</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{progress.processedUsers}</div>
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
              <CardTitle className="text-sm font-medium">Companies Created</CardTitle>
              <Building2 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{progress.companiesCreated}</div>
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
        {migrationState.currentBatchUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Current Batch Processing
              </CardTitle>
              <CardDescription>
                Batch {progress.currentBatch} of {progress.totalBatches} - Processing{" "}
                {migrationState.currentBatchUsers.length} users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {migrationState.currentBatchUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 border rounded">
                    <div>
                      <div className="font-medium">{user.display_name || user.name || "Unnamed User"}</div>
                      <div className="text-sm text-muted-foreground">
                        {user.email || `ID: ${user.id}`} • License Key:{" "}
                        {user.license_key ? (
                          <Badge variant="outline">{user.license_key.substring(0, 8)}...</Badge>
                        ) : (
                          <Badge variant="secondary">None</Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Processing
                    </Badge>
                  </div>
                ))}
                {migrationState.currentBatchUsers.length > 5 && (
                  <div className="text-center text-sm text-muted-foreground">
                    ... and {migrationState.currentBatchUsers.length - 5} more users
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
              <CardDescription>Latest batch processing results</CardDescription>
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
                        <div className="font-medium">
                          Batch {batch.batchNumber} (
                          {batch.operationType === "license_key_group" ? "License Key Group" : "Individual Users"})
                        </div>
                        <div className="text-sm text-muted-foreground">{batch.totalInBatch} users</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex gap-2 mb-1">
                        <Badge variant="success" className="text-xs">
                          {batch.successful} success
                        </Badge>
                        {batch.companiesCreated > 0 && (
                          <Badge variant="default" className="text-xs">
                            {batch.companiesCreated} companies
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
                      <div className="text-xs text-muted-foreground">{batch.processingTime}ms</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users Preview */}
        {allUsers.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Users Needing Migration
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{allUsers.length} users</Badge>
                  <Button variant="outline" size="sm" onClick={() => setShowUserPreview(!showUserPreview)}>
                    {showUserPreview ? "Hide" : "Show"} Preview
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>Users identified during scanning that require company_id migration</CardDescription>
            </CardHeader>
            {showUserPreview && (
              <CardContent>
                <div className="rounded-md border max-h-96 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>User ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>License Key</TableHead>
                        <TableHead>Current Company ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allUsers.slice(0, 20).map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            {migrationState.processedUserIds.has(user.id) ? (
                              <Badge variant="success" className="text-xs">
                                Processed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={user._priority === "license_key" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {user._priority === "license_key" ? "License Key" : "Individual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{user.id}</TableCell>
                          <TableCell>{user.display_name || user.name || "-"}</TableCell>
                          <TableCell>{user.email || "-"}</TableCell>
                          <TableCell>
                            {user.license_key ? (
                              <Badge variant="outline" className="text-xs">
                                {user.license_key.substring(0, 8)}...
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                None
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {user.company_id ? (
                              <Badge variant="outline" className="text-xs">
                                {user.company_id}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Missing
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {allUsers.length > 20 && (
                    <div className="p-4 text-center text-sm text-muted-foreground border-t">
                      Showing first 20 of {allUsers.length} users
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
