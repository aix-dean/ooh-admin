"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Play,
  Eye,
  RefreshCw,
  Database,
  TrendingUp,
} from "lucide-react"
import type { CustomFieldDefinition, BulkOperationFilter, BulkOperationResult } from "@/types/custom-field"
import { CustomFieldService } from "@/lib/custom-field-service"

interface BulkOperationsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fieldDefinition: CustomFieldDefinition
  onConfirm: (filters: BulkOperationFilter, dryRun: boolean) => Promise<BulkOperationResult>
  loading?: boolean
}

export function BulkOperationsDialog({
  open,
  onOpenChange,
  fieldDefinition,
  onConfirm,
  loading = false,
}: BulkOperationsDialogProps) {
  const [currentTab, setCurrentTab] = useState("filters")
  const [filters, setFilters] = useState<BulkOperationFilter>({})
  const [previewResult, setPreviewResult] = useState<BulkOperationResult | null>(null)
  const [executionResult, setExecutionResult] = useState<BulkOperationResult | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [migrationHistory, setMigrationHistory] = useState<any[]>([])
  const [fieldStats, setFieldStats] = useState<any>(null)

  useEffect(() => {
    if (open) {
      loadMigrationHistory()
      loadFieldStats()
    }
  }, [open, fieldDefinition.key])

  const loadMigrationHistory = async () => {
    try {
      const history = await CustomFieldService.getFieldMigrationHistory(fieldDefinition.key)
      setMigrationHistory(history)
    } catch (error) {
      console.error("Error loading migration history:", error)
    }
  }

  const loadFieldStats = async () => {
    try {
      const stats = await CustomFieldService.getFieldUsageStats()
      setFieldStats(stats)
    } catch (error) {
      console.error("Error loading field stats:", error)
    }
  }

  const handleFilterChange = (key: keyof BulkOperationFilter, value: any) => {
    setFilters({ ...filters, [key]: value })
    // Clear preview when filters change
    setPreviewResult(null)
  }

  const handleDryRun = async () => {
    try {
      setIsDryRunning(true)
      const result = await onConfirm(filters, true)
      setPreviewResult(result)
      setCurrentTab("preview")
    } catch (error) {
      console.error("Dry run failed:", error)
    } finally {
      setIsDryRunning(false)
    }
  }

  const handleExecute = async () => {
    try {
      setIsExecuting(true)
      const result = await onConfirm(filters, false)
      setExecutionResult(result)
      setCurrentTab("results")
    } catch (error) {
      console.error("Execution failed:", error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleClose = () => {
    if (!isExecuting && !isDryRunning) {
      setCurrentTab("filters")
      setFilters({})
      setPreviewResult(null)
      setExecutionResult(null)
      onOpenChange(false)
    }
  }

  const renderFilterSection = () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-3">Field Information</h4>
        <Card>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">Field Name</Label>
                <div className="text-sm">{fieldDefinition.name}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Field Key</Label>
                <div className="text-sm font-mono">{fieldDefinition.key}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Data Type</Label>
                <Badge variant="outline">{fieldDefinition.dataType}</Badge>
              </div>
              <div>
                <Label className="text-sm font-medium">Default Value</Label>
                <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {JSON.stringify(fieldDefinition.defaultValue)}
                </div>
              </div>
            </div>
            {fieldDefinition.description && (
              <div className="mt-3">
                <Label className="text-sm font-medium">Description</Label>
                <div className="text-sm text-muted-foreground">{fieldDefinition.description}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="font-medium mb-3">Product Filters</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="status">Status</Label>
            <Select onValueChange={(value) => handleFilterChange("status", value === "ALL" ? undefined : [value])}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <Select onValueChange={(value) => handleFilterChange("type", value === "ALL" ? undefined : [value])}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="Rental">Rental</SelectItem>
                <SelectItem value="Sale">Sale</SelectItem>
                <SelectItem value="Service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="active">Active Status</Label>
            <Select
              onValueChange={(value) => handleFilterChange("active", value === "ALL" ? undefined : value === "true")}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="true">Active Only</SelectItem>
                <SelectItem value="false">Inactive Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="hasField">Has Field</Label>
            <Input
              id="hasField"
              placeholder="field_key"
              value={filters.has_field || ""}
              onChange={(e) => handleFilterChange("has_field", e.target.value || undefined)}
            />
          </div>

          <div>
            <Label htmlFor="missingField">Missing Field</Label>
            <Input
              id="missingField"
              placeholder="field_key"
              value={filters.missing_field || ""}
              onChange={(e) => handleFilterChange("missing_field", e.target.value || undefined)}
            />
          </div>
        </div>

        <div className="mt-4">
          <Label>Price Range</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              placeholder="Min price"
              value={filters.price_range?.min || ""}
              onChange={(e) =>
                handleFilterChange("price_range", {
                  ...filters.price_range,
                  min: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
            <Input
              type="number"
              placeholder="Max price"
              value={filters.price_range?.max || ""}
              onChange={(e) =>
                handleFilterChange("price_range", {
                  ...filters.price_range,
                  max: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800">Important Notice</h4>
            <p className="text-sm text-yellow-700 mt-1">
              This operation will add the field "{fieldDefinition.key}" to all products matching the filters. Products
              that already have this field will be skipped. Always run a preview first to see what will be affected.
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderPreviewSection = () => (
    <div className="space-y-6">
      {previewResult ? (
        <>
          <div>
            <h4 className="font-medium mb-3">Preview Results</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{previewResult.total_selected}</div>
                  <div className="text-sm text-muted-foreground">Total Selected</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{previewResult.successful}</div>
                  <div className="text-sm text-muted-foreground">Will Update</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{previewResult.skipped}</div>
                  <div className="text-sm text-muted-foreground">Will Skip</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">{previewResult.failed}</div>
                  <div className="text-sm text-muted-foreground">Will Fail</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{previewResult.processed}</div>
                  <div className="text-sm text-muted-foreground">Processed</div>
                </CardContent>
              </Card>
            </div>
          </div>

          {(previewResult.warnings.length > 0 || previewResult.errors.length > 0) && (
            <div>
              <h4 className="font-medium mb-3">Issues Found</h4>
              <ScrollArea className="h-48 border rounded-lg p-4">
                {previewResult.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2 mb-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{warning.product_name}</div>
                      <div className="text-muted-foreground">{warning.warning}</div>
                    </div>
                  </div>
                ))}
                {previewResult.errors.map((error, index) => (
                  <div key={index} className="flex items-start gap-2 mb-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{error.product_name}</div>
                      <div className="text-muted-foreground">{error.error}</div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Preview Complete</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              {previewResult.successful} products will be updated with the new field. Review the results above and
              proceed with execution if everything looks correct.
            </p>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Preview Available</h3>
          <p className="text-muted-foreground">Run a preview to see what products will be affected.</p>
        </div>
      )}
    </div>
  )

  const renderResultsSection = () => (
    <div className="space-y-6">
      {executionResult ? (
        <>
          <div>
            <h4 className="font-medium mb-3">Execution Results</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{executionResult.total_selected}</div>
                  <div className="text-sm text-muted-foreground">Total Selected</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-green-600">{executionResult.successful}</div>
                  <div className="text-sm text-muted-foreground">Updated</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-yellow-600">{executionResult.skipped}</div>
                  <div className="text-sm text-muted-foreground">Skipped</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold text-red-600">{executionResult.failed}</div>
                  <div className="text-sm text-muted-foreground">Failed</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="text-2xl font-bold">{executionResult.processed}</div>
                  <div className="text-sm text-muted-foreground">Processed</div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="rounded-lg bg-green-50 border border-green-200 p-4">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Operation Completed Successfully</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              The custom field has been added to {executionResult.successful} products. The operation has been recorded
              for audit purposes.
            </p>
          </div>

          {(executionResult.warnings.length > 0 || executionResult.errors.length > 0) && (
            <div>
              <h4 className="font-medium mb-3">Issues Encountered</h4>
              <ScrollArea className="h-48 border rounded-lg p-4">
                {executionResult.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2 mb-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{warning.product_name}</div>
                      <div className="text-muted-foreground">{warning.warning}</div>
                    </div>
                  </div>
                ))}
                {executionResult.errors.map((error, index) => (
                  <div key={index} className="flex items-start gap-2 mb-2 text-sm">
                    <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium">{error.product_name}</div>
                      <div className="text-muted-foreground">{error.error}</div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Results Available</h3>
          <p className="text-muted-foreground">Execute the operation to see results.</p>
        </div>
      )}
    </div>
  )

  const renderHistorySection = () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium mb-3">Migration History</h4>
        {migrationHistory.length > 0 ? (
          <ScrollArea className="h-64 border rounded-lg">
            <div className="p-4 space-y-3">
              {migrationHistory.map((migration, index) => (
                <div key={index} className="border-l-2 border-blue-200 pl-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{migration.operation_type}</Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(migration.created).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-sm">
                    <div>
                      Updated: {migration.result.successful}, Failed: {migration.result.failed}, Skipped:{" "}
                      {migration.result.skipped}
                    </div>
                    <div className="text-muted-foreground">Execution time: {migration.execution_time_ms}ms</div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 border rounded-lg">
            <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">No migration history available</p>
          </div>
        )}
      </div>

      {fieldStats && (
        <div>
          <h4 className="font-medium mb-3">Field Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{fieldStats.total_fields}</div>
                <div className="text-sm text-muted-foreground">Total Custom Fields</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{fieldStats.active_fields}</div>
                <div className="text-sm text-muted-foreground">Active Fields</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            Bulk Field Addition
          </DialogTitle>
          <DialogDescription>
            Add the custom field "{fieldDefinition.name}" to multiple products with advanced filtering and validation.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={currentTab} onValueChange={setCurrentTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="filters" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Results
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="filters" className="mt-0">
                {renderFilterSection()}
              </TabsContent>
              <TabsContent value="preview" className="mt-0">
                {renderPreviewSection()}
              </TabsContent>
              <TabsContent value="results" className="mt-0">
                {renderResultsSection()}
              </TabsContent>
              <TabsContent value="history" className="mt-0">
                {renderHistorySection()}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isExecuting || isDryRunning}>
            {executionResult ? "Close" : "Cancel"}
          </Button>

          {currentTab === "filters" && (
            <Button onClick={handleDryRun} disabled={isDryRunning || isExecuting} variant="secondary">
              {isDryRunning ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Running Preview...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Changes
                </>
              )}
            </Button>
          )}

          {currentTab === "preview" && previewResult && (
            <Button onClick={handleExecute} disabled={isExecuting || isDryRunning}>
              {isExecuting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Execute Operation
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
