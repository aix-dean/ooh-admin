import { doc, getDoc, updateDoc, deleteDoc, addDoc, collection, type DocumentData, Timestamp } from "firebase/firestore"
import { db } from "./firebase"

export interface DocumentOperation {
  id: string
  operation: "create" | "update" | "delete"
  collectionPath: string
  data?: DocumentData
  timestamp: Date
  status: "pending" | "success" | "error"
  error?: string
}

/**
 * Get a single document by ID
 */
export async function getDocument(collectionPath: string, documentId: string): Promise<DocumentData | null> {
  try {
    const docRef = doc(db, collectionPath, documentId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
        _metadata: {
          exists: true,
          fromCache: docSnap.metadata.fromCache,
          hasPendingWrites: docSnap.metadata.hasPendingWrites,
        },
      }
    }

    return null
  } catch (error: any) {
    throw new Error(`Failed to get document: ${error.message}`)
  }
}

/**
 * Update a document
 */
export async function updateDocument(
  collectionPath: string,
  documentId: string,
  data: Partial<DocumentData>,
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, documentId)

    // Add timestamp for tracking
    const updateData = {
      ...data,
      updatedAt: Timestamp.now(),
    }

    await updateDoc(docRef, updateData)
  } catch (error: any) {
    throw new Error(`Failed to update document: ${error.message}`)
  }
}

/**
 * Delete a document
 */
export async function deleteDocument(collectionPath: string, documentId: string): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, documentId)
    await deleteDoc(docRef)
  } catch (error: any) {
    throw new Error(`Failed to delete document: ${error.message}`)
  }
}

/**
 * Create a new document
 */
export async function createDocument(collectionPath: string, data: DocumentData): Promise<string> {
  try {
    const collectionRef = collection(db, collectionPath)

    // Add timestamp for tracking
    const createData = {
      ...data,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }

    const docRef = await addDoc(collectionRef, createData)
    return docRef.id
  } catch (error: any) {
    throw new Error(`Failed to create document: ${error.message}`)
  }
}

/**
 * Batch operations utility
 */
export class DocumentBatch {
  private operations: DocumentOperation[] = []

  addCreate(collectionPath: string, data: DocumentData): void {
    this.operations.push({
      id: `create_${Date.now()}_${Math.random()}`,
      operation: "create",
      collectionPath,
      data,
      timestamp: new Date(),
      status: "pending",
    })
  }

  addUpdate(collectionPath: string, documentId: string, data: Partial<DocumentData>): void {
    this.operations.push({
      id: documentId,
      operation: "update",
      collectionPath,
      data,
      timestamp: new Date(),
      status: "pending",
    })
  }

  addDelete(collectionPath: string, documentId: string): void {
    this.operations.push({
      id: documentId,
      operation: "delete",
      collectionPath,
      timestamp: new Date(),
      status: "pending",
    })
  }

  async execute(): Promise<DocumentOperation[]> {
    const results: DocumentOperation[] = []

    for (const operation of this.operations) {
      try {
        switch (operation.operation) {
          case "create":
            if (operation.data) {
              const newId = await createDocument(operation.collectionPath, operation.data)
              results.push({ ...operation, id: newId, status: "success" })
            }
            break

          case "update":
            if (operation.data) {
              await updateDocument(operation.collectionPath, operation.id, operation.data)
              results.push({ ...operation, status: "success" })
            }
            break

          case "delete":
            await deleteDocument(operation.collectionPath, operation.id)
            results.push({ ...operation, status: "success" })
            break
        }
      } catch (error: any) {
        results.push({
          ...operation,
          status: "error",
          error: error.message,
        })
      }
    }

    return results
  }

  getOperations(): DocumentOperation[] {
    return [...this.operations]
  }

  clear(): void {
    this.operations = []
  }
}

/**
 * Export collection data to JSON
 */
export async function exportCollectionToJSON(collectionPath: string): Promise<string> {
  try {
    const { getDocs, collection, query } = await import("firebase/firestore")

    const collectionRef = collection(db, collectionPath)
    const snapshot = await getDocs(collectionRef)

    const documents = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
      metadata: {
        fromCache: doc.metadata.fromCache,
        hasPendingWrites: doc.metadata.hasPendingWrites,
      },
    }))

    const exportData = {
      collection: collectionPath,
      exportedAt: new Date().toISOString(),
      documentCount: documents.length,
      documents,
    }

    return JSON.stringify(exportData, null, 2)
  } catch (error: any) {
    throw new Error(`Failed to export collection: ${error.message}`)
  }
}

/**
 * Add a new field to a document
 */
export async function addFieldToDocument(
  collectionPath: string,
  documentId: string,
  fieldName: string,
  fieldValue: any,
  fieldType: string,
): Promise<void> {
  try {
    const docRef = doc(db, collectionPath, documentId)

    // Convert value based on type
    let convertedValue = fieldValue
    switch (fieldType) {
      case "number":
        convertedValue = Number(fieldValue)
        if (isNaN(convertedValue)) {
          throw new Error("Invalid number value")
        }
        break
      case "boolean":
        convertedValue = fieldValue === "true" || fieldValue === true
        break
      case "timestamp":
        convertedValue = Timestamp.fromDate(new Date(fieldValue))
        break
      case "array":
        convertedValue = Array.isArray(fieldValue) ? fieldValue : [fieldValue]
        break
      case "object":
        convertedValue = typeof fieldValue === "string" ? JSON.parse(fieldValue) : fieldValue
        break
      default:
        convertedValue = String(fieldValue)
    }

    const updateData = {
      [fieldName]: convertedValue,
      updatedAt: Timestamp.now(),
    }

    await updateDoc(docRef, updateData)
  } catch (error: any) {
    throw new Error(`Failed to add field: ${error.message}`)
  }
}

/**
 * Remove a field from a document
 */
export async function removeFieldFromDocument(
  collectionPath: string,
  documentId: string,
  fieldName: string,
): Promise<void> {
  try {
    const { deleteField } = await import("firebase/firestore")
    const docRef = doc(db, collectionPath, documentId)

    const updateData = {
      [fieldName]: deleteField(),
      updatedAt: Timestamp.now(),
    }

    await updateDoc(docRef, updateData)
  } catch (error: any) {
    throw new Error(`Failed to remove field: ${error.message}`)
  }
}

/**
 * Update array field operations
 */
export async function updateArrayField(
  collectionPath: string,
  documentId: string,
  fieldName: string,
  operation: "add" | "remove",
  value: any,
): Promise<void> {
  try {
    const { arrayUnion, arrayRemove } = await import("firebase/firestore")
    const docRef = doc(db, collectionPath, documentId)

    const updateData = {
      [fieldName]: operation === "add" ? arrayUnion(value) : arrayRemove(value),
      updatedAt: Timestamp.now(),
    }

    await updateDoc(docRef, updateData)
  } catch (error: any) {
    throw new Error(`Failed to update array field: ${error.message}`)
  }
}

/**
 * Validate field value based on type
 */
export function validateFieldValue(value: any, type: string): { isValid: boolean; error?: string } {
  switch (type) {
    case "string":
      return { isValid: typeof value === "string" }

    case "number":
      const num = Number(value)
      if (isNaN(num)) {
        return { isValid: false, error: "Value must be a valid number" }
      }
      return { isValid: true }

    case "boolean":
      if (typeof value === "boolean") return { isValid: true }
      if (value === "true" || value === "false") return { isValid: true }
      return { isValid: false, error: "Value must be true or false" }

    case "array":
      if (Array.isArray(value)) return { isValid: true }
      try {
        JSON.parse(value)
        return { isValid: true }
      } catch {
        return { isValid: false, error: "Value must be a valid array or JSON array" }
      }

    case "object":
      if (typeof value === "object" && value !== null) return { isValid: true }
      try {
        JSON.parse(value)
        return { isValid: true }
      } catch {
        return { isValid: false, error: "Value must be a valid object or JSON object" }
      }

    case "timestamp":
      const date = new Date(value)
      if (isNaN(date.getTime())) {
        return { isValid: false, error: "Value must be a valid date" }
      }
      return { isValid: true }

    default:
      return { isValid: true }
  }
}

/**
 * Get field type from value
 */
export function getFieldType(value: any): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (value && typeof value.toDate === "function") return "timestamp"
  if (Array.isArray(value)) return "array"
  return typeof value
}
