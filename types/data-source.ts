export interface DataSource {
  id: string
  name: string
  description: string
  type: "existing_field" | "external_api" | "computed" | "static"
  available: boolean
  schema?: DataSourceSchema
  connection_config?: Record<string, any>
}

export interface DataSourceSchema {
  fields: DataSourceField[]
  total_records?: number
  last_updated?: Date
}

export interface DataSourceField {
  key: string
  name: string
  type: string
  description?: string
  nullable: boolean
  unique_count?: number
  null_count?: number
  sample_values?: any[]
}

export interface DataMapping {
  source_field: string
  target_field: string
  transformation?: {
    type: "direct" | "format" | "calculate" | "lookup" | "conditional"
    config: TransformationConfig
  }
}

export interface TransformationConfig {
  format_string?: string
  number_format?: {
    decimals?: number
    currency?: string
  }
  expression?: string
  lookup_table?: Record<string, any>
  default_value?: any
  conditions?: Array<{
    condition: string
    value: any
  }>
}

export interface DataMappingPreview {
  source_sample: Record<string, any>[]
  mapped_sample: Record<string, any>[]
  statistics: {
    successful_mappings: number
    failed_mappings: number
    type_conversions: number
    data_quality_score: number
  }
  validation_errors: Array<{
    row_index: number
    error_message: string
    source_value: any
  }>
}

export interface ConditionalRule {
  condition: string
  value: any
  operator: "equals" | "not_equals" | "greater_than" | "less_than" | "contains" | "regex"
}

export interface ValidationRule {
  type: "required" | "type_check" | "range" | "pattern" | "custom"
  config: Record<string, any>
  error_message: string
}

export interface ConflictResolution {
  strategy: "overwrite" | "skip" | "merge" | "prompt"
  merge_strategy?: "concat" | "sum" | "max" | "min" | "custom"
}

export interface ValidationError {
  row_index: number
  field: string
  error_type: string
  error_message: string
  source_value: any
  suggested_fix?: string
}

export interface TransformationWarning {
  row_index: number
  field: string
  warning_type: string
  warning_message: string
  source_value: any
  transformed_value: any
}

export interface MappingStatistics {
  total_rows: number
  successful_mappings: number
  failed_mappings: number
  null_values: number
  type_conversions: number
  data_quality_score: number
}
