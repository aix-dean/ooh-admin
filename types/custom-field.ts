export interface CustomFieldDefinition {
  id: string
  name: string
  key: string
  dataType: "string" | "number" | "boolean" | "date" | "array" | "object"
  defaultValue: any
  required: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
    options?: string[]
  }
  description?: string
}

export interface BulkOperationFilter {
  status?: string[]
  type?: string[]
  active?: boolean
  seller_id?: string[]
  category?: string[]
  price_range?: { min: number; max: number }
  date_range?: { start: Date; end: Date }
  has_field?: string
  missing_field?: string
}

export interface BulkOperationResult {
  total_selected: number
  processed: number
  successful: number
  failed: number
  skipped: number
  errors: Array<{
    product_id: string
    product_name: string
    error: string
  }>
  warnings: Array<{
    product_id: string
    product_name: string
    warning: string
  }>
}
