export interface BulkEditSelection {
  documentIds: string[]
  selectAll: boolean
  totalDocuments: number
}

export interface BulkEditField {
  name: string
  type: "string" | "number" | "boolean" | "array" | "object" | "timestamp" | "null"
  value: any
  operation: "set" | "increment" | "array_union" | "array_remove" | "delete"
  enabled: boolean
}

export interface BulkEditPreview {
  documentId: string
  documentName?: string
  currentValues: Record<string, any>
  newValues: Record<string, any>
  changes: BulkEditChange[]
  warnings: string[]
  errors: string[]
}

export interface BulkEditChange {
  field: string
  operation: string
  oldValue: any
  newValue: any
  type: string
}

export interface BulkEditResult {
  totalSelected: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{
    documentId: string
    error: string
  }>
  warnings: Array<{
    documentId: string
    warning: string
  }>
  executionTime: number
}

export interface BulkEditValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  affectedDocuments: number
}
