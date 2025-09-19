"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Play,
  SkipForward,
  RotateCcw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Package,
  Users,
  Database,
  TrendingUp,
} from "lucide-react"
import {
  paginatedMigrationService,
  type MigrationProgress,
  type PaginatedMigrationResult,
} from "@/lib/paginated-migration-service"

interface PaginatedMigrationControlsProps {
  onStateChange?: (state: PaginatedMigrationResult | null) => void
  onProgressUpdate?: (progress: MigrationProgress) => void
}

export function PaginatedMigrationControls({ onStateChange, onProgressUpdate }: PaginatedMigrationControlsProps) {
  const [migrationState, setMigrationState] = useState<PaginatedMigrationResult | null>(null)
  const [progress, setProgress] = useState<MigrationProgress | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchResults, setBatchResults] = useState<
    Array<{
      batchNumber: number
      updated: number
      skipped: number
      errors: number
      timestamp: string
    }>
  >([])

  // Enhanced initialization with proper error handling
  const initializeMigration = async () => {
    if (isInitializing || isProcessing) {
      console.warn("Migration operation already in progress")
      return
    }

    setIsInitializing(true)
    setError(null)
    setBatchResults([])

    try {
      console.log("🚀 Starting migration initialization...")
      const result = await paginatedMigrationService.initializeMigration()
      setMigrationState(result)
      onStateChange?.(result)
      console.log("✅ Migration initialized successfully", result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to initialize migration"
      setError(errorMessage)
      console.error("❌ Migration initialization failed:", err)
    } finally {
      setIsInitializing(false)
    }
  }

  // Process current batch
  const processCurrentBatch = async () => {
    if (!migrationState) {
      setError("Migration not initialized - please initialize migration first")
      return
    }

    if (!migrationState.extractedCompanyId) {
      setError("Migration missing company_id - please reinitialize migration")
      return
    }

    if (!migrationState.selectedEntry) {
      setError("Migration missing selected entry - please reinitialize migration")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      await paginatedMigrationService.processCurrentBatch()
      const updatedState = paginatedMigrationService.getMigrationState()

      if (updatedState) {
        setMigrationState(updatedState)
        onStateChange?.(updatedState)

        // Add batch result
        setBatchResults((prev) => [
          ...prev,
          {
            batchNumber: updatedState.currentBatch.batchNumber,
            updated: updatedState.totalUpdated,
            skipped: updatedState.totalSkipped,
            errors: updatedState.totalErrors,
            timestamp: new Date().toLocaleTimeString(),
          },
        ])
      }

      console.log("✅ Current batch processed successfully")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process batch"
      setError(errorMessage)
      console.error("❌ Batch processing failed:", err)
    } finally {
      setIsProcessing(false)
    }
  }

  // Enhanced load next batch with proper validation
  const loadNextBatch = async () => {
    if (!migrationState) {
      setError("No migration state available - please initialize migration first")
      return
    }

    if (isLoadingNext || isProcessing) {
      console.warn("Batch operation already in progress")
      return
    }

    if (!migrationState.currentBatch.hasMore) {
      console.log("📋 No more batches available")
      setError("No more batches available - migration is complete")
      return
    }

    if (!migrationState.currentBatch.lastDoc) {
      setError("Cannot load next batch - pagination cursor is missing")
      return
    }

    setIsLoadingNext(true)
    setError(null)

    try {
      console.log("📦 Loading next batch...", {
        currentBatch: migrationState.currentBatch.batchNumber,
        lastDocId: migrationState.currentBatch.lastDoc?.id,
      })

      const hasMore = await paginatedMigrationService.loadNextBatch()
      const updatedState = paginatedMigrationService.getMigrationState()

      if (updatedState) {
        setMigrationState(updatedState)
        onStateChange?.(updatedState)
        console.log("✅ Next batch loaded successfully", {
          newBatch: updatedState.currentBatch.batchNumber,
          hasMore: updatedState.currentBatch.hasMore,
        })
      }

      if (!hasMore) {
        console.log("📋 No more batches available - migration complete")
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load next batch"
      setError(errorMessage)
      console.error("❌ Next batch loading failed:", err)
    } finally {
      setIsLoadingNext(false)
    }
  }

  // Process all remaining batches
  const processAllBatches = async () => {
    if (!migrationState) {
      setError("Migration not initialized - please initialize migration first")
      return
    }

    if (!migrationState.extractedCompanyId) {
      setError("Migration missing company_id - please reinitialize migration")
      return
    }

    if (!migrationState.selectedEntry) {
      setError("Migration missing selected entry - please reinitialize migration")
      return
    }

    setIsProcessing(true)
    setError(null)

    try {
      await paginatedMigrationService.processAllBatches((batchNumber, results) => {
        setBatchResults((prev) => {
          const existing = prev.find((r) => r.batchNumber === batchNumber)
          if (existing) {
            return prev.map((r) =>
              r.batchNumber === batchNumber
                ? {
                    ...r,
                    updated: results.updated,
                    skipped: results.skipped,
                    errors: results.errors,
                    timestamp: new Date().toLocaleTimeString(),
                  }
                : r,
            )
          } else {
            return [
              ...prev,
              {
                batchNumber,
                updated: results.updated,
                skipped: results.skipped,
                errors: results.errors,
                timestamp: new Date().toLocaleTimeString(),
              },
            ]
          }
        })

        // Update state
        const updatedState = paginatedMigrationService.getMigrationState()
        if (updatedState) {
          setMigrationState(updatedState)
          onStateChange?.(updatedState)
        }
      })

      console.log("✅ All batches processed successfully")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process all batches"
      setError(errorMessage)
      console.error("❌ All batches processing failed:", err)
    } finally {
      setIsProcessing(false)
    }
  }

  // Reset migration
  const resetMigration = () => {
    paginatedMigrationService.reset()
    setMigrationState(null)
    setProgress(null)
    setError(null)
    setBatchResults([])
    onStateChange?.(null)
    console.log("🔄 Migration reset")
  }

  // Setup progress listener
  useEffect(() => {
    const unsubscribe = paginatedMigrationService.onProgressUpdate((newProgress) => {
      setProgress(newProgress)
      onProgressUpdate?.(newProgress)
    })

    return unsubscribe
  }, [onProgressUpdate])

  // Auto-initialize on mount
  useEffect(() => {
    initializeMigration()
  }, [])

  const summary = paginatedMigrationService.getMigrationSummary()

  // Enhanced button state management
  const canInitialize = !isInitializing && !isProcessing && !isLoadingNext
  const canProcessBatch =
    migrationState &&
    migrationState.extractedCompanyId &&
    migrationState.selectedEntry &&
    !isProcessing &&
    !isInitializing &&
    !isLoadingNext &&
    !migrationState.noEligibleProducts &&
    !migrationState.migrationComplete
  const canLoadNext =
    migrationState &&
    migrationState.extractedCompanyId &&
    migrationState.selectedEntry &&
    !isLoadingNext &&
    !isProcessing &&
    migrationState.currentBatch.hasMore &&
    !migrationState.isComplete &&
    migrationState.currentBatch.lastDoc &&
    !migrationState.noEligibleProducts &&
    !migrationState.migrationComplete
  const canProcessAll =
    migrationState &&
    migrationState.extractedCompanyId &&
    migrationState.selectedEntry &&
    !isProcessing &&
    !isInitializing &&
    !migrationState.noEligibleProducts &&
    !migrationState.migrationComplete
  const canReset = !isInitializing && !isProcessing && !isLoadingNext

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Paginated Migration Controls
          </CardTitle>
          <CardDescription>
            Process products in batches of 10 for optimal performance and reduced Firebase load
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={initializeMigration} disabled={!canInitialize} variant="outline">
              {isInitializing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Initialize New Migration
            </Button>

            <Button onClick={processCurrentBatch} disabled={!canProcessBatch}>
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Process Current Batch
            </Button>

            <Button onClick={loadNextBatch} disabled={!canLoadNext} variant="outline">
              {isLoadingNext ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SkipForward className="mr-2 h-4 w-4" />
              )}
              Load Next Batch
            </Button>

            <Button onClick={processAllBatches} disabled={!canProcessAll} variant="secondary">
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="mr-2 h-4 w-4" />
              )}
              Process All Batches
            </Button>

            <Button onClick={resetMigration} disabled={!canReset} variant="destructive">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex flex-col gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Migration Error</span>
              </div>
              <p className="text-sm text-red-600">{error}</p>
              <div className="flex gap-2 mt-2">
                <Button
                  onClick={() => setError(null)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-300"
                >
                  Dismiss
                </Button>
                {migrationState && (
                  <Button
                    onClick={() => {
                      setError(null)
                      loadNextBatch()
                    }}
                    variant="outline"
                    size="sm"
                    className="text-red-600 border-red-300"
                    disabled={!canLoadNext}
                  >
                    Retry Load Next
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Current Status */}
          {migrationState && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-semibold text-blue-600">{migrationState.currentBatch.batchNumber}</div>
                <div className="text-xs text-blue-600">Current Batch</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-semibold text-green-600">
                  {migrationState.currentBatch.products.length}
                </div>
                <div className="text-xs text-green-600">Products in Batch</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-semibold text-purple-600">
                  {migrationState.currentBatch.totalProcessed}
                </div>
                <div className="text-xs text-purple-600">Total Processed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-lg font-semibold text-gray-600">
                  {migrationState.currentBatch.hasMore ? "Yes" : "No"}
                </div>
                <div className="text-xs text-gray-600">Has More Batches</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Migration Summary */}
      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Migration Summary
            </CardTitle>
            <CardDescription>Overall progress and statistics for the paginated migration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{summary.totalBatches}</div>
                <div className="text-sm text-blue-600">Total Batches</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{summary.totalProducts}</div>
                <div className="text-sm text-purple-600">Total Products</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{summary.totalUpdated}</div>
                <div className="text-sm text-green-600">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{summary.totalSkipped}</div>
                <div className="text-sm text-yellow-600">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{summary.totalErrors}</div>
                <div className="text-sm text-red-600">Errors</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center">
              <Badge variant={summary.isComplete ? "default" : "secondary"} className="text-sm">
                {summary.isComplete ? (
                  <>
                    <CheckCircle className="mr-1 h-4 w-4" />
                    Migration Complete
                  </>
                ) : (
                  <>
                    <Loader2 className="mr-1 h-4 w-4" />
                    Migration In Progress
                  </>
                )}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Batch Results History */}
      {batchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Batch Processing History
            </CardTitle>
            <CardDescription>Detailed results for each processed batch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {batchResults.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline">Batch {result.batchNumber}</Badge>
                    <span className="text-sm text-gray-600">{result.timestamp}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-600">✓ {result.updated}</span>
                    <span className="text-yellow-600">⏭ {result.skipped}</span>
                    <span className="text-red-600">✗ {result.errors}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Indicator */}
      {progress && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Migration Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {progress.totalBatches > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Batch Progress</span>
                  <span>
                    {progress.currentBatch} / {progress.totalBatches}
                  </span>
                </div>
                <Progress value={(progress.currentBatch / progress.totalBatches) * 100} />
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="text-center">
                <div className="font-semibold">{progress.processedProducts}</div>
                <div className="text-gray-600">Processed</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">
                  {progress.remainingProducts >= 0 ? progress.remainingProducts : "Unknown"}
                </div>
                <div className="text-gray-600">Remaining</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">
                  {progress.estimatedTotal >= 0 ? progress.estimatedTotal : "Unknown"}
                </div>
                <div className="text-gray-600">Estimated Total</div>
              </div>
              <div className="text-center">
                <div className="font-semibold">
                  {progress.progressPercentage >= 0 ? `${progress.progressPercentage}%` : "Unknown"}
                </div>
                <div className="text-gray-600">Complete</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
