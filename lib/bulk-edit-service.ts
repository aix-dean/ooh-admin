import { doc, writeBatch, getDoc, increment, arrayUnion, arrayRemove, deleteField, Timestamp } from "firebase/firestore"
import { db } from "./firebase"
import type { BulkEditField, BulkEditPreview, BulkEditResult, BulkEditValidation } from "@/types/bulk-edit"

export class BulkEditService {
  private static readonly BATCH_SIZE = 500 // Firestore batch limit
  private static readonly MAX_PREVIEW_DOCS = 10

  /**
   * Validate bulk edit operation before execution
   */
  static async validateBulkEdit(
    collectionPath: string,
    documentIds: string[],
    fields: BulkEditField[],
  ): Promise<BulkEditValidation> {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate document IDs
    if (documentIds.length === 0) {
      errors.push("No documents selected for bulk edit")
    }

    if (documentIds.length > 10000) {
      warnings.push(
        `Large number of documents selected (${documentIds.length}). Consider processing in smaller batches.`,
      )
    }

    // Validate fields
    const enabledFields = fields.filter((f) => f.enabled)
    if (enabledFields.length === 0) {
      errors.push("No fields selected for editing")
    }

    // Validate field values and operations
    for (const field of enabledFields) {
      const fieldValidation = this.validateField(field)
      if (!fieldValidation.isValid) {
        errors.push(`Field "${field.name}": ${fieldValidation.error}`)
      }
    }

    // Check for conflicting operations
    const fieldNames = enabledFields.map((f) => f.name)
    const duplicateFields = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index)
    if (duplicateFields.length > 0) {
      errors.push(`Duplicate field operations detected: ${duplicateFields.join(", ")}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      affectedDocuments: documentIds.length,
    }
  }

  /**
   * Generate preview of bulk edit changes
   */
  static async generatePreview(
    collectionPath: string,
    documentIds: string[],
    fields: BulkEditField[],
  ): Promise<BulkEditPreview[]> {
    const enabledFields = fields.filter((f) => f.enabled)
    const previewIds = documentIds.slice(0, this.MAX_PREVIEW_DOCS)
    const previews: BulkEditPreview[] = []

    for (const documentId of previewIds) {
      try {
        const docRef = doc(db, collectionPath, documentId)
        const docSnap = await getDoc(docRef)

        if (!docSnap.exists()) {
          previews.push({
            documentId,
            currentValues: {},
            newValues: {},
            changes: [],
            warnings: ["Document does not exist"],
            errors: [],
          })
          continue
        }

        const currentData = docSnap.data()
        const preview = this.generateDocumentPreview(documentId, currentData, enabledFields)
        previews.push(preview)
      } catch (error: any) {
        previews.push({
          documentId,
          currentValues: {},
          newValues: {},
          changes: [],
          warnings: [],
          errors: [`Failed to load document: ${error.message}`],
        })
      }
    }

    return previews
  }

  /**
   * Execute bulk edit operation
   */
  static async executeBulkEdit(
    collectionPath: string,
    documentIds: string[],
    fields: BulkEditField[],
  ): Promise<BulkEditResult> {
    const startTime = Date.now()
    const enabledFields = fields.filter((f) => f.enabled)
    const result: BulkEditResult = {
      totalSelected: documentIds.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      warnings: [],
      executionTime: 0,
    }

    // Process documents in batches
    const batches = this.createBatches(documentIds, this.BATCH_SIZE)

    for (const batchIds of batches) {
      try {
        const batchResult = await this.processBatch(collectionPath, batchIds, enabledFields)

        result.successful += batchResult.successful
        result.failed += batchResult.failed
        result.skipped += batchResult.skipped
        result.errors.push(...batchResult.errors)
        result.warnings.push(...batchResult.warnings)
      } catch (error: any) {
        // If entire batch fails, mark all documents as failed
        for (const docId of batchIds) {
          result.errors.push({
            documentId: docId,
            error: `Batch operation failed: ${error.message}`,
          })
        }
        result.failed += batchIds.length
      }
    }

    result.executionTime = Date.now() - startTime
    return result
  }

  /**
   * Process a single batch of documents
   */
  private static async processBatch(
    collectionPath: string,
    documentIds: string[],
    fields: BulkEditField[],
  ): Promise<Omit<BulkEditResult, "totalSelected" | "executionTime">> {
    const batch = writeBatch(db)
    const result = {
      successful: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ documentId: string; error: string }>,
      warnings: [] as Array<{ documentId: string; warning: string }>,
    }

    for (const documentId of documentIds) {
      try {
        const docRef = doc(db, collectionPath, documentId)

        // Check if document exists
        const docSnap = await getDoc(docRef)
        if (!docSnap.exists()) {
          result.skipped++
          result.warnings.push({
            documentId,
            warning: "Document does not exist, skipping",
          })
          continue
        }

        // Build update data
        const updateData = this.buildUpdateData(fields, docSnap.data())

        if (Object.keys(updateData).length === 0) {
          result.skipped++
          result.warnings.push({
            documentId,
            warning: "No changes to apply, skipping",
          })
          continue
        }

        // Add to batch
        batch.update(docRef, {
          ...updateData,
          updatedAt: Timestamp.now(),
          lastBulkEdit: Timestamp.now(),
        })

        result.successful++
      } catch (error: any) {
        result.failed++
        result.errors.push({
          documentId,
          error: error.message,
        })
      }
    }

    // Commit batch if there are any updates
    if (result.successful > 0) {
      await batch.commit()
    }

    return result
  }

  /**
   * Build update data from fields
   */
  private static buildUpdateData(fields: BulkEditField[], currentData: any): Record<string, any> {
    const updateData: Record<string, any> = {}

    for (const field of fields) {
      try {
        switch (field.operation) {
          case "set":
            updateData[field.name] = this.convertValue(field.value, field.type)
            break

          case "increment":
            if (field.type === "number") {
              updateData[field.name] = increment(Number(field.value) || 1)
            }
            break

          case "array_union":
            if (field.type === "array") {
              const values = Array.isArray(field.value) ? field.value : [field.value]
              updateData[field.name] = arrayUnion(...values)
            }
            break

          case "array_remove":
            if (field.type === "array") {
              const values = Array.isArray(field.value) ? field.value : [field.value]
              updateData[field.name] = arrayRemove(...values)
            }
            break

          case "delete":
            updateData[field.name] = deleteField()
            break
        }
      } catch (error) {
        // Skip invalid field operations
        console.warn(`Skipping field ${field.name}: ${error}`)
      }
    }

    return updateData
  }

  /**
   * Convert value to appropriate type
   */
  private static convertValue(value: any, type: string): any {
    switch (type) {
      case "string":
        return String(value)

      case "number":
        const num = Number(value)
        if (isNaN(num)) throw new Error("Invalid number value")
        return num

      case "boolean":
        if (typeof value === "boolean") return value
        if (value === "true") return true
        if (value === "false") return false
        throw new Error("Invalid boolean value")

      case "array":
        if (Array.isArray(value)) return value
        try {
          return JSON.parse(value)
        } catch {
          return [value]
        }

      case "object":
        if (typeof value === "object" && value !== null) return value
        try {
          return JSON.parse(value)
        } catch {
          throw new Error("Invalid object value")
        }

      case "timestamp":
        return Timestamp.fromDate(new Date(value))

      case "null":
        return null

      default:
        return value
    }
  }

  /**
   * Validate individual field
   */
  private static validateField(field: BulkEditField): { isValid: boolean; error?: string } {
    if (!field.name.trim()) {
      return { isValid: false, error: "Field name is required" }
    }

    if (field.operation === "increment" && field.type !== "number") {
      return { isValid: false, error: "Increment operation only supports number fields" }
    }

    if ((field.operation === "array_union" || field.operation === "array_remove") && field.type !== "array") {
      return { isValid: false, error: "Array operations only support array fields" }
    }

    if (field.operation === "set") {
      try {
        this.convertValue(field.value, field.type)
      } catch (error: any) {
        return { isValid: false, error: error.message }
      }
    }

    return { isValid: true }
  }

  /**
   * Generate preview for a single document
   */
  private static generateDocumentPreview(
    documentId: string,
    currentData: any,
    fields: BulkEditField[],
  ): BulkEditPreview {
    const preview: BulkEditPreview = {
      documentId,
      documentName: currentData.name || currentData.title || documentId,
      currentValues: { ...currentData },
      newValues: { ...currentData },
      changes: [],
      warnings: [],
      errors: [],
    }

    for (const field of fields) {
      try {
        const currentValue = currentData[field.name]
        let newValue: any

        switch (field.operation) {
          case "set":
            newValue = this.convertValue(field.value, field.type)
            break

          case "increment":
            newValue = (Number(currentValue) || 0) + (Number(field.value) || 1)
            break

          case "array_union":
            const currentArray = Array.isArray(currentValue) ? currentValue : []
            const unionValues = Array.isArray(field.value) ? field.value : [field.value]
            newValue = [...new Set([...currentArray, ...unionValues])]
            break

          case "array_remove":
            const removeArray = Array.isArray(currentValue) ? currentValue : []
            const removeValues = Array.isArray(field.value) ? field.value : [field.value]
            newValue = removeArray.filter((item) => !removeValues.includes(item))
            break

          case "delete":
            newValue = undefined
            break

          default:
            continue
        }

        preview.newValues[field.name] = newValue
        preview.changes.push({
          field: field.name,
          operation: field.operation,
          oldValue: currentValue,
          newValue,
          type: field.type,
        })

        // Add warnings for potential issues
        if (field.operation === "set" && currentValue !== undefined && typeof currentValue !== typeof newValue) {
          preview.warnings.push(`Type change for field "${field.name}": ${typeof currentValue} → ${typeof newValue}`)
        }
      } catch (error: any) {
        preview.errors.push(`Field "${field.name}": ${error.message}`)
      }
    }

    return preview
  }

  /**
   * Create batches from document IDs
   */
  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Get common fields across multiple documents
   */
  static async getCommonFields(
    collectionPath: string,
    documentIds: string[],
    sampleSize = 10,
  ): Promise<Array<{ name: string; type: string; frequency: number }>> {
    const sampleIds = documentIds.slice(0, sampleSize)
    const fieldCounts: Record<string, { types: Set<string>; count: number }> = {}

    for (const documentId of sampleIds) {
      try {
        const docRef = doc(db, collectionPath, documentId)
        const docSnap = await getDoc(docRef)

        if (docSnap.exists()) {
          const data = docSnap.data()

          Object.entries(data).forEach(([key, value]) => {
            if (key.startsWith("_")) return // Skip metadata fields

            if (!fieldCounts[key]) {
              fieldCounts[key] = { types: new Set(), count: 0 }
            }

            fieldCounts[key].count++
            fieldCounts[key].types.add(this.getValueType(value))
          })
        }
      } catch (error) {
        console.warn(`Failed to analyze document ${documentId}:`, error)
      }
    }

    return Object.entries(fieldCounts)
      .map(([name, info]) => ({
        name,
        type: Array.from(info.types)[0], // Use most common type
        frequency: info.count / sampleIds.length,
      }))
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Get value type
   */
  private static getValueType(value: any): string {
    if (value === null) return "null"
    if (value === undefined) return "undefined"
    if (value && typeof value.toDate === "function") return "timestamp"
    if (Array.isArray(value)) return "array"
    return typeof value
  }
}
