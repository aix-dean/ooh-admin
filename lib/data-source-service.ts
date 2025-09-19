import { db } from "@/lib/firebase"
import { collection, getDocs, query, limit } from "firebase/firestore"
import type {
  DataSource,
  DataSourceField,
  DataMapping,
  DataMappingPreview,
  TransformationConfig,
} from "@/types/data-source"

export class DataSourceService {
  static async getAvailableDataSources(): Promise<DataSource[]> {
    try {
      // Get sample product data to analyze existing fields
      const productsQuery = query(collection(db, "products"), limit(100))
      const snapshot = await getDocs(productsQuery)

      const sampleProducts: any[] = []
      snapshot.forEach((doc) => {
        sampleProducts.push({ id: doc.id, ...doc.data() })
      })

      const existingFieldsSource = await this.analyzeExistingFields(sampleProducts)

      return [
        existingFieldsSource,
        {
          id: "shopify_api",
          name: "Shopify API",
          description: "Connect to Shopify store data",
          type: "external_api",
          available: false, // Would check API credentials
        },
        {
          id: "computed_fields",
          name: "Computed Fields",
          description: "Calculate values from existing data",
          type: "computed",
          available: true,
        },
        {
          id: "static_values",
          name: "Static Values",
          description: "Set fixed values for all products",
          type: "static",
          available: true,
        },
      ]
    } catch (error) {
      console.error("Error getting data sources:", error)
      return []
    }
  }

  static async analyzeExistingFields(products: any[]): Promise<DataSource> {
    const fieldAnalysis = new Map<string, DataSourceField>()

    // Analyze all products to understand field structure
    products.forEach((product) => {
      const flatProduct = this.flattenObject(product)

      Object.entries(flatProduct).forEach(([key, value]) => {
        if (!fieldAnalysis.has(key)) {
          fieldAnalysis.set(key, {
            key,
            name: this.formatFieldName(key),
            type: this.inferType(value),
            description: `Existing field: ${key}`,
            nullable: false,
            unique_count: 0,
            null_count: 0,
            sample_values: [],
          })
        }

        const field = fieldAnalysis.get(key)!

        // Update statistics
        if (value === null || value === undefined) {
          field.null_count = (field.null_count || 0) + 1
        }

        // Add to sample values (limit to 10)
        if (field.sample_values!.length < 10 && value !== null && value !== undefined) {
          if (!field.sample_values!.includes(value)) {
            field.sample_values!.push(value)
          }
        }
      })
    })

    // Calculate unique counts and finalize field info
    fieldAnalysis.forEach((field) => {
      field.unique_count = field.sample_values!.length
      field.nullable = (field.null_count || 0) > 0
    })

    return {
      id: "existing_fields",
      name: "Existing Product Fields",
      description: "Use data from existing product fields",
      type: "existing_field",
      available: true,
      schema: {
        fields: Array.from(fieldAnalysis.values()),
        total_records: products.length,
        last_updated: new Date(),
      },
    }
  }

  static flattenObject(obj: any, prefix = ""): Record<string, any> {
    const flattened: Record<string, any> = {}

    Object.keys(obj).forEach((key) => {
      const value = obj[key]
      const newKey = prefix ? `${prefix}.${key}` : key

      if (value !== null && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey))
      } else {
        flattened[newKey] = value
      }
    })

    return flattened
  }

  static formatFieldName(key: string): string {
    return key
      .split(/[._]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  }

  static inferType(value: any): string {
    if (value === null || value === undefined) return "string"
    if (typeof value === "boolean") return "boolean"
    if (typeof value === "number") return "number"
    if (value instanceof Date) return "date"
    if (Array.isArray(value)) return "array"
    if (typeof value === "object") return "object"
    return "string"
  }

  static async previewDataMapping(
    sourceId: string,
    mapping: DataMapping,
    sampleSize = 10,
  ): Promise<DataMappingPreview> {
    try {
      // Get sample data from the source
      const productsQuery = query(collection(db, "products"), limit(sampleSize))
      const snapshot = await getDocs(productsQuery)

      const sourceData: any[] = []
      snapshot.forEach((doc) => {
        sourceData.push({ id: doc.id, ...doc.data() })
      })

      const preview: DataMappingPreview = {
        source_sample: [],
        mapped_sample: [],
        statistics: {
          successful_mappings: 0,
          failed_mappings: 0,
          type_conversions: 0,
          data_quality_score: 0,
        },
        validation_errors: [],
      }

      sourceData.forEach((item, index) => {
        try {
          const flatItem = this.flattenObject(item)
          preview.source_sample.push(flatItem)

          const mappedValue = this.applyMapping(flatItem, mapping, index)
          preview.mapped_sample.push({
            [mapping.target_field]: mappedValue,
          })

          preview.statistics.successful_mappings++
        } catch (error) {
          preview.statistics.failed_mappings++
          preview.validation_errors.push({
            row_index: index,
            error_message: error instanceof Error ? error.message : "Unknown error",
            source_value: item[mapping.source_field],
          })
        }
      })

      // Calculate quality score
      const total = preview.statistics.successful_mappings + preview.statistics.failed_mappings
      preview.statistics.data_quality_score = total > 0 ? (preview.statistics.successful_mappings / total) * 100 : 0

      return preview
    } catch (error) {
      console.error("Error generating preview:", error)
      throw error
    }
  }

  static applyMapping(data: Record<string, any>, mapping: DataMapping, index: number): any {
    const sourceValue = data[mapping.source_field]

    if (!mapping.transformation || mapping.transformation.type === "direct") {
      return sourceValue
    }

    switch (mapping.transformation.type) {
      case "format":
        return this.applyFormatTransformation(sourceValue, mapping.transformation.config)
      case "calculate":
        return this.applyCalculateTransformation(data, mapping.transformation.config)
      case "lookup":
        return this.applyLookupTransformation(sourceValue, mapping.transformation.config)
      case "conditional":
        return this.applyConditionalTransformation(data, mapping.transformation.config)
      default:
        return sourceValue
    }
  }

  static applyFormatTransformation(value: any, config: TransformationConfig): any {
    if (config.format_string) {
      return config.format_string.replace("{value}", String(value))
    }

    if (config.number_format && typeof value === "number") {
      const formatted = value.toFixed(config.number_format.decimals || 2)
      return config.number_format.currency ? `${formatted} ${config.number_format.currency}` : formatted
    }

    return value
  }

  static applyCalculateTransformation(data: Record<string, any>, config: TransformationConfig): any {
    if (!config.expression) return null

    try {
      // Simple expression evaluation (in production, use a proper expression parser)
      let expression = config.expression
      Object.keys(data).forEach((key) => {
        const regex = new RegExp(`\\{${key}\\}`, "g")
        expression = expression.replace(regex, String(data[key] || 0))
      })

      // Basic math evaluation (unsafe - use proper parser in production)
      return eval(expression)
    } catch (error) {
      throw new Error(`Expression evaluation failed: ${error}`)
    }
  }

  static applyLookupTransformation(value: any, config: TransformationConfig): any {
    if (!config.lookup_table) return config.default_value || value

    const lookupValue = config.lookup_table[String(value)]
    return lookupValue !== undefined ? lookupValue : config.default_value || value
  }

  static applyConditionalTransformation(data: Record<string, any>, config: TransformationConfig): any {
    if (!config.conditions) return config.default_value

    for (const condition of config.conditions) {
      // Simple condition evaluation (in production, use proper condition parser)
      try {
        if (eval(condition.condition.replace(/\{(\w+)\}/g, (_, key) => String(data[key] || 0)))) {
          return condition.value
        }
      } catch (error) {
        continue
      }
    }

    return config.default_value
  }
}
