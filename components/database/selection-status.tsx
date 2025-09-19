"use client"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RefreshCw, Database, CheckSquare, Square, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SelectionStatusProps {
  selectedCount: number
  totalVisible: number
  isAllDocumentsSelected: boolean
  totalDocumentsCount: number | null
  isLoadingCount: boolean
  hasMorePages: boolean
  onSelectAllDocuments: () => void
  onClearSelection: () => void
}

export function SelectionStatus({
  selectedCount,
  totalVisible,
  isAllDocumentsSelected,
  totalDocumentsCount,
  isLoadingCount,
  hasMorePages,
  onSelectAllDocuments,
  onClearSelection,
}: SelectionStatusProps) {
  // Don't show anything if no documents are selected
  if (selectedCount === 0) {
    return null
  }

  // Show option to select all documents if we have a page selection and there are more pages
  const showSelectAllOption = selectedCount === totalVisible && hasMorePages && !isAllDocumentsSelected

  return (
    <div className="mb-6 space-y-3">
      {/* Current Selection Status */}
      <Alert className={cn("border-blue-200 bg-blue-50", isAllDocumentsSelected && "border-green-200 bg-green-50")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isAllDocumentsSelected ? (
              <Database className="h-4 w-4 text-green-600" />
            ) : (
              <CheckSquare className="h-4 w-4 text-blue-600" />
            )}
            <AlertDescription className={cn("text-blue-800 font-medium", isAllDocumentsSelected && "text-green-800")}>
              {isAllDocumentsSelected ? (
                <>
                  All {totalDocumentsCount?.toLocaleString() || selectedCount} documents in this collection are selected
                </>
              ) : (
                <>
                  {selectedCount} document{selectedCount !== 1 ? "s" : ""} selected on this page
                </>
              )}
            </AlertDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        </div>
      </Alert>

      {/* Select All Documents Option */}
      {showSelectAllOption && (
        <Alert className="border-orange-200 bg-orange-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Square className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                You have selected {selectedCount} documents on this page.
                {hasMorePages && " There are more documents in this collection."}
              </AlertDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onSelectAllDocuments}
              disabled={isLoadingCount}
              className="border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              {isLoadingCount ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Select All Documents
                </>
              )}
            </Button>
          </div>
        </Alert>
      )}

      {/* Large Selection Warning */}
      {isAllDocumentsSelected && totalDocumentsCount && totalDocumentsCount > 10000 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertDescription className="text-yellow-800">
            <strong>Large Selection:</strong> You have selected {totalDocumentsCount.toLocaleString()} documents. Bulk
            operations on large datasets may take several minutes to complete.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
