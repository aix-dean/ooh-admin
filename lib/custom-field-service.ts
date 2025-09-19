import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  runTransaction,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { CustomFieldDefinition, BulkOperationResult, BulkOperationFilter } from "@/types/custom-field"

const CUSTOM_FIELDS_COLLECTION = "custom_field_definitions"
const FIELD_MIGRATIONS_COLLECTION = "field_migrations"
const PRODUCTS_COLLECTION = "products"

export interface StoredCustomFieldDefinition extends CustomFieldDefinition {
  created: Date
  updated: Date
  created_by: string
  version: number
  status: "active" | "deprecated" | "archived"
  usage_count: number
  last_used: Date | null
}

export interface FieldMigration {
  id: string
  field_definition_id: string
  field_key: string
  operation_type: "add" | "update" | "remove" | "migrate"
  from_version?: number
  to_version: number
  filters_applied: BulkOperationFilter
  result: BulkOperationResult
  created: Date
  created_by: string
  execution_time_ms: number
}

export interface FieldValidationError {
  field_key: string
  product_id: string
  error_type: "type_mismatch" | "validation_failed" | "required_missing" | "constraint_violation"
  error_message: string
  current_value: any
  expected_type: string
}

export class CustomFieldService {
  /**
   * Store a custom field definition in Firebase
   */
  static async saveFieldDefinition(
    fieldDef: CustomFieldDefinition,
    userId: string,
  ): Promise<StoredCustomFieldDefinition> {
    try {
      // Check if field key already exists
      const existingField = await this.getFieldDefinitionByKey(fieldDef.key)
      if (existingField) {
        throw new Error(`Field with key '${fieldDef.key}' already exists`)
      }

      const now = new Date()
      const storedFieldDef: StoredCustomFieldDefinition = {
        ...fieldDef,
        created: now,
        updated: now,
        created_by: userId,
        version: 1,
        status: "active",
        usage_count: 0,
        last_used: null,
      }

      const docRef = doc(db, CUSTOM_FIELDS_COLLECTION, fieldDef.id)
      await setDoc(docRef, {
        ...storedFieldDef,
        created: Timestamp.fromDate(storedFieldDef.created),
        updated: Timestamp.fromDate(storedFieldDef.updated),
        last_used: storedFieldDef.last_used ? Timestamp.fromDate(storedFieldDef.last_used) : null,
      })

      console.log(`Custom field definition '${fieldDef.key}' saved successfully`)
      return storedFieldDef
    } catch (error) {
      console.error("Error saving field definition:", error)
      throw new Error(`Failed to save field definition: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Get all custom field definitions
   */
  static async getFieldDefinitions(includeArchived = false): Promise<StoredCustomFieldDefinition[]> {
    try {
      let q = query(collection(db, CUSTOM_FIELDS_COLLECTION), orderBy("created", "desc"))

      if (!includeArchived) {
        q = query(q, where("status", "in", ["active", "deprecated"]))
      }

      const snapshot = await getDocs(q)
      const fieldDefs: StoredCustomFieldDefinition[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        fieldDefs.push({
          ...data,
          id: doc.id,
          created: data.created?.toDate() || new Date(),
          updated: data.updated?.toDate() || new Date(),
          last_used: data.last_used?.toDate() || null,
        } as StoredCustomFieldDefinition)
      })

      return fieldDefs
    } catch (error) {
      console.error("Error fetching field definitions:", error)
      throw new Error("Failed to fetch field definitions")
    }
  }

  /**
   * Get a field definition by its key
   */
  static async getFieldDefinitionByKey(key: string): Promise<StoredCustomFieldDefinition | null> {
    try {
      const q = query(
        collection(db, CUSTOM_FIELDS_COLLECTION),
        where("key", "==", key),
        where("status", "==", "active"),
      )
      const snapshot = await getDocs(q)

      if (snapshot.empty) {
        return null
      }

      const doc = snapshot.docs[0]
      const data = doc.data()
      return {
        ...data,
        id: doc.id,
        created: data.created?.toDate() || new Date(),
        updated: data.updated?.toDate() || new Date(),
        last_used: data.last_used?.toDate() || null,
      } as StoredCustomFieldDefinition
    } catch (error) {
      console.error("Error fetching field definition by key:", error)
      throw new Error(`Failed to fetch field definition for key: ${key}`)
    }
  }

  /**
   * Update field definition usage statistics
   */
  static async updateFieldUsage(fieldId: string): Promise<void> {
    try {
      const docRef = doc(db, CUSTOM_FIELDS_COLLECTION, fieldId)
      await updateDoc(docRef, {
        usage_count: (await getDoc(docRef)).data()?.usage_count + 1 || 1,
        last_used: Timestamp.now(),
        updated: Timestamp.now(),
      })
    } catch (error) {
      console.error("Error updating field usage:", error)
      // Don't throw here as this is not critical
    }
  }

  /**
   * Convert JavaScript value to Firebase-compatible value
   */
  static convertValueForFirebase(value: any, dataType: string): any {
    switch (dataType) {
      case "date":
        if (value instanceof Date) {
          return Timestamp.fromDate(value)
        }
        if (typeof value === "string") {
          return Timestamp.fromDate(new Date(value))
        }
        return value

      case "number":
        return Number(value)

      case "boolean":
        return Boolean(value)

      case "array":
        return Array.isArray(value) ? value : []

      case "object":
        return typeof value === "object" && value !== null ? value : {}

      case "string":
      default:
        return String(value)
    }
  }

  /**
   * Convert Firebase value to JavaScript value
   */
  static convertValueFromFirebase(value: any, dataType: string): any {
    switch (dataType) {
      case "date":
        if (value?.toDate) {
          return value.toDate()
        }
        return value

      case "number":
        return Number(value)

      case "boolean":
        return Boolean(value)

      case "array":
        return Array.isArray(value) ? value : []

      case "object":
        return typeof value === "object" && value !== null ? value : {}

      case "string":
      default:
        return String(value)
    }
  }

  /**
   * Validate field value against definition
   */
  static validateFieldValue(value: any, fieldDef: StoredCustomFieldDefinition): FieldValidationError[] {
    const errors: FieldValidationError[] = []

    try {
      // Check required
      if (fieldDef.required && (value === null || value === undefined || value === "")) {
        errors.push({
          field_key: fieldDef.key,
          product_id: "",
          error_type: "required_missing",
          error_message: `Field '${fieldDef.name}' is required`,
          current_value: value,
          expected_type: fieldDef.dataType,
        })
        return errors
      }

      // Skip validation if value is empty and not required
      if (!fieldDef.required && (value === null || value === undefined || value === "")) {
        return errors
      }

      // Type-specific validation
      switch (fieldDef.dataType) {
        case "string":
          const strValue = String(value)
          if (fieldDef.validation?.min && strValue.length < fieldDef.validation.min) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "constraint_violation",
              error_message: `String too short (min: ${fieldDef.validation.min})`,
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          }
          if (fieldDef.validation?.max && strValue.length > fieldDef.validation.max) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "constraint_violation",
              error_message: `String too long (max: ${fieldDef.validation.max})`,
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          }
          if (fieldDef.validation?.pattern && !new RegExp(fieldDef.validation.pattern).test(strValue)) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "validation_failed",
              error_message: `String doesn't match pattern: ${fieldDef.validation.pattern}`,
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          }
          if (fieldDef.validation?.options && !fieldDef.validation.options.includes(strValue)) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "validation_failed",
              error_message: `Invalid option. Must be one of: ${fieldDef.validation.options.join(", ")}`,
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          }
          break

        case "number":
          const numValue = Number(value)
          if (isNaN(numValue)) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "type_mismatch",
              error_message: "Invalid number",
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          } else {
            if (fieldDef.validation?.min !== undefined && numValue < fieldDef.validation.min) {
              errors.push({
                field_key: fieldDef.key,
                product_id: "",
                error_type: "constraint_violation",
                error_message: `Number too small (min: ${fieldDef.validation.min})`,
                current_value: value,
                expected_type: fieldDef.dataType,
              })
            }
            if (fieldDef.validation?.max !== undefined && numValue > fieldDef.validation.max) {
              errors.push({
                field_key: fieldDef.key,
                product_id: "",
                error_type: "constraint_violation",
                error_message: `Number too large (max: ${fieldDef.validation.max})`,
                current_value: value,
                expected_type: fieldDef.dataType,
              })
            }
          }
          break

        case "date":
          if (!(value instanceof Date) && !value?.toDate) {
            const dateValue = new Date(value)
            if (isNaN(dateValue.getTime())) {
              errors.push({
                field_key: fieldDef.key,
                product_id: "",
                error_type: "type_mismatch",
                error_message: "Invalid date",
                current_value: value,
                expected_type: fieldDef.dataType,
              })
            }
          }
          break

        case "array":
          if (!Array.isArray(value)) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "type_mismatch",
              error_message: "Value must be an array",
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          }
          break

        case "object":
          if (typeof value !== "object" || value === null || Array.isArray(value)) {
            errors.push({
              field_key: fieldDef.key,
              product_id: "",
              error_type: "type_mismatch",
              error_message: "Value must be an object",
              current_value: value,
              expected_type: fieldDef.dataType,
            })
          }
          break
      }
    } catch (error) {
      errors.push({
        field_key: fieldDef.key,
        product_id: "",
        error_type: "validation_failed",
        error_message: `Validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
        current_value: value,
        expected_type: fieldDef.dataType,
      })
    }

    return errors
  }

  /**
   * Execute bulk field addition with Firebase transaction
   */
  static async executeBulkFieldAddition(
    fieldDef: StoredCustomFieldDefinition,
    productIds: string[],
    userId: string,
    dryRun = false,
  ): Promise<BulkOperationResult> {
    const startTime = Date.now()
    const result: BulkOperationResult = {
      total_selected: productIds.length,
      processed: 0,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
    }

    try {
      console.log(`${dryRun ? "Dry run" : "Executing"} bulk field addition for ${productIds.length} products...`)

      // Process in batches to avoid Firebase limits
      const batchSize = 500 // Firebase batch limit
      const batches = []

      for (let i = 0; i < productIds.length; i += batchSize) {
        const batchIds = productIds.slice(i, i + batchSize)
        batches.push(batchIds)
      }

      for (const batchIds of batches) {
        if (!dryRun) {
          // Use transaction for data consistency
          await runTransaction(db, async (transaction) => {
            const batch = writeBatch(db)

            for (const productId of batchIds) {
              try {
                result.processed++

                // Get current product data
                const productRef = doc(db, PRODUCTS_COLLECTION, productId)
                const productDoc = await transaction.get(productRef)

                if (!productDoc.exists()) {
                  result.failed++
                  result.errors.push({
                    product_id: productId,
                    product_name: "Unknown",
                    error: "Product not found",
                  })
                  continue
                }

                const productData = productDoc.data()

                // Check if field already exists
                if (productData.hasOwnProperty(fieldDef.key)) {
                  result.skipped++
                  result.warnings.push({
                    product_id: productId,
                    product_name: productData.name || "Unknown",
                    warning: `Already has field '${fieldDef.key}'`,
                  })
                  continue
                }

                // Validate and convert the default value
                const validationErrors = this.validateFieldValue(fieldDef.defaultValue, fieldDef)
                if (validationErrors.length > 0) {
                  result.failed++
                  result.errors.push({
                    product_id: productId,
                    product_name: productData.name || "Unknown",
                    error: validationErrors.map((e) => e.error_message).join(", "),
                  })
                  continue
                }

                const firebaseValue = this.convertValueForFirebase(fieldDef.defaultValue, fieldDef.dataType)

                // Add field to product
                batch.update(productRef, {
                  [fieldDef.key]: firebaseValue,
                  updated: Timestamp.now(),
                })

                result.successful++
              } catch (error) {
                result.failed++
                result.errors.push({
                  product_id: productId,
                  product_name: "Unknown",
                  error: error instanceof Error ? error.message : "Unknown error",
                })
              }
            }

            // Commit the batch
            await batch.commit()
          })
        } else {
          // Dry run - just validate
          for (const productId of batchIds) {
            try {
              result.processed++

              const productRef = doc(db, PRODUCTS_COLLECTION, productId)
              const productDoc = await getDoc(productRef)

              if (!productDoc.exists()) {
                result.failed++
                result.errors.push({
                  product_id: productId,
                  product_name: "Unknown",
                  error: "Product not found",
                })
                continue
              }

              const productData = productDoc.data()

              if (productData.hasOwnProperty(fieldDef.key)) {
                result.skipped++
                result.warnings.push({
                  product_id: productId,
                  product_name: productData.name || "Unknown",
                  warning: `Already has field '${fieldDef.key}'`,
                })
                continue
              }

              const validationErrors = this.validateFieldValue(fieldDef.defaultValue, fieldDef)
              if (validationErrors.length > 0) {
                result.failed++
                result.errors.push({
                  product_id: productId,
                  product_name: productData.name || "Unknown",
                  error: validationErrors.map((e) => e.error_message).join(", "),
                })
                continue
              }

              result.successful++
            } catch (error) {
              result.failed++
              result.errors.push({
                product_id: productId,
                product_name: "Unknown",
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }
        }
      }

      // Record migration if not dry run
      if (!dryRun) {
        await this.recordMigration({
          field_definition_id: fieldDef.id,
          field_key: fieldDef.key,
          operation_type: "add",
          to_version: fieldDef.version,
          filters_applied: {}, // Add actual filters used
          result,
          created_by: userId,
          execution_time_ms: Date.now() - startTime,
        })

        // Update field usage
        await this.updateFieldUsage(fieldDef.id)
      }

      console.log(`${dryRun ? "Dry run" : "Operation"} completed:`, result)
      return result
    } catch (error) {
      console.error("Error during bulk field addition:", error)
      throw new Error(`Bulk operation failed: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  /**
   * Record a field migration for audit purposes
   */
  static async recordMigration(migration: Omit<FieldMigration, "id" | "created">): Promise<void> {
    try {
      const migrationDoc: FieldMigration = {
        id: crypto.randomUUID(),
        ...migration,
        created: new Date(),
      }

      const docRef = doc(db, FIELD_MIGRATIONS_COLLECTION, migrationDoc.id)
      await setDoc(docRef, {
        ...migrationDoc,
        created: Timestamp.fromDate(migrationDoc.created),
      })

      console.log(`Migration recorded: ${migrationDoc.id}`)
    } catch (error) {
      console.error("Error recording migration:", error)
      // Don't throw as this is not critical for the operation
    }
  }

  /**
   * Get migration history for a field
   */
  static async getFieldMigrationHistory(fieldKey: string): Promise<FieldMigration[]> {
    try {
      const q = query(
        collection(db, FIELD_MIGRATIONS_COLLECTION),
        where("field_key", "==", fieldKey),
        orderBy("created", "desc"),
      )

      const snapshot = await getDocs(q)
      const migrations: FieldMigration[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        migrations.push({
          ...data,
          id: doc.id,
          created: data.created?.toDate() || new Date(),
        } as FieldMigration)
      })

      return migrations
    } catch (error) {
      console.error("Error fetching migration history:", error)
      throw new Error("Failed to fetch migration history")
    }
  }

  /**
   * Archive a field definition (soft delete)
   */
  static async archiveFieldDefinition(fieldId: string, userId: string): Promise<void> {
    try {
      const docRef = doc(db, CUSTOM_FIELDS_COLLECTION, fieldId)
      await updateDoc(docRef, {
        status: "archived",
        updated: Timestamp.now(),
      })

      console.log(`Field definition ${fieldId} archived`)
    } catch (error) {
      console.error("Error archiving field definition:", error)
      throw new Error("Failed to archive field definition")
    }
  }

  /**
   * Get field usage statistics
   */
  static async getFieldUsageStats(): Promise<{
    total_fields: number
    active_fields: number
    most_used: StoredCustomFieldDefinition[]
    recently_added: StoredCustomFieldDefinition[]
  }> {
    try {
      const fieldDefs = await this.getFieldDefinitions(true)

      const stats = {
        total_fields: fieldDefs.length,
        active_fields: fieldDefs.filter((f) => f.status === "active").length,
        most_used: fieldDefs
          .filter((f) => f.status === "active")
          .sort((a, b) => b.usage_count - a.usage_count)
          .slice(0, 5),
        recently_added: fieldDefs
          .filter((f) => f.status === "active")
          .sort((a, b) => b.created.getTime() - a.created.getTime())
          .slice(0, 5),
      }

      return stats
    } catch (error) {
      console.error("Error fetching field usage stats:", error)
      throw new Error("Failed to fetch field usage statistics")
    }
  }
}
