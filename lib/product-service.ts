import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  Timestamp,
  GeoPoint,
  type DocumentSnapshot,
  getCountFromServer,
} from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Product, ProductFilters } from "@/types/product"
import { CustomFieldService, type StoredCustomFieldDefinition } from "@/lib/custom-field-service"

const COLLECTION_NAME = "products"

export interface PaginatedResult<T> {
  data: T[]
  totalCount: number
  hasNextPage: boolean
  hasPreviousPage: boolean
  currentPage: number
  totalPages: number
  lastDoc?: DocumentSnapshot
}

export interface BulkOperationResult {
  total_selected: number
  processed: number
  successful: number
  failed: number
  skipped: number
  errors: { product_id: string; product_name: string; error: string }[]
  warnings: { product_id: string; product_name: string; warning: string }[]
}

export interface BulkOperationFilter {
  status?: string[]
  type?: string[]
  active?: boolean
  has_field?: string
  missing_field?: string
  price_range?: { min?: number; max?: number }
  date_range?: { start?: Date; end?: Date }
  seller_id?: string[]
  category?: string[]
}

export interface CustomFieldDefinition {
  key: string
  name: string
  dataType: "string" | "number" | "boolean" | "date" | "array" | "object"
  defaultValue: any
  required?: boolean
  validation?: {
    min?: number
    max?: number
    pattern?: string
    options?: string[]
  }
}

export interface DataMapping {
  source_field: string
  target_field: string
  transformation?: string
}

export class ProductService {
  static async getProductsPaginated(
    filters: ProductFilters = {},
    page = 1,
    pageSize = 20,
    lastDoc?: DocumentSnapshot,
  ): Promise<PaginatedResult<Product>> {
    try {
      let q = query(collection(db, COLLECTION_NAME))

      // Apply filters
      if (filters.status && filters.status !== "ALL") {
        q = query(q, where("status", "==", filters.status))
      }

      if (filters.type && filters.type !== "ALL") {
        q = query(q, where("type", "==", filters.type))
      }

      if (filters.active !== undefined && filters.active !== "ALL") {
        q = query(q, where("active", "==", filters.active))
      }

      if (filters.seller_id) {
        q = query(q, where("seller_id", "==", filters.seller_id))
      }

      if (filters.category) {
        q = query(q, where("categories", "array-contains", filters.category))
      }

      // Add ordering
      q = query(q, orderBy("updated", "desc"))

      // Get total count for pagination
      const countSnapshot = await getCountFromServer(q)
      const totalCount = countSnapshot.data().count

      // Apply pagination
      if (lastDoc) {
        q = query(q, startAfter(lastDoc))
      } else if (page > 1) {
        // For page-based navigation, we need to skip documents
        const skipCount = (page - 1) * pageSize
        if (skipCount > 0) {
          const skipQuery = query(q, limit(skipCount))
          const skipSnapshot = await getDocs(skipQuery)
          if (skipSnapshot.docs.length > 0) {
            const lastSkipDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1]
            q = query(q, startAfter(lastSkipDoc))
          }
        }
      }

      q = query(q, limit(pageSize))

      const snapshot = await getDocs(q)
      const products: Product[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        products.push({
          id: doc.id,
          ...data,
          created: data.created?.toDate ? data.created.toDate() : new Date(data.created || Date.now()),
          updated: data.updated?.toDate ? data.updated.toDate() : new Date(data.updated || Date.now()),
        } as Product)
      })

      // Apply client-side filters for complex queries
      let filteredProducts = products

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        filteredProducts = filteredProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm) ||
            product.seller_name.toLowerCase().includes(searchTerm) ||
            product.site_code.toLowerCase().includes(searchTerm) ||
            product.ai_text_tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
            product.ai_logo_tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
        )
      }

      if (filters.price_min !== undefined) {
        filteredProducts = filteredProducts.filter((product) => product.price >= filters.price_min!)
      }

      if (filters.price_max !== undefined) {
        filteredProducts = filteredProducts.filter((product) => product.price <= filters.price_max!)
      }

      const totalPages = Math.ceil(totalCount / pageSize)
      const hasNextPage = page < totalPages
      const hasPreviousPage = page > 1

      return {
        data: filteredProducts,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        currentPage: page,
        totalPages,
        lastDoc: snapshot.docs[snapshot.docs.length - 1],
      }
    } catch (error) {
      console.error("Error fetching paginated products:", error)
      throw error
    }
  }

  static async getProducts(filters: ProductFilters = {}, limitCount = 1000): Promise<Product[]> {
    try {
      let q = query(collection(db, COLLECTION_NAME))

      // Only apply filters if they are specifically set (not "ALL" or empty)
      if (filters.status && filters.status !== "ALL") {
        q = query(q, where("status", "==", filters.status))
      }

      if (filters.type && filters.type !== "ALL") {
        q = query(q, where("type", "==", filters.type))
      }

      if (filters.active !== undefined && filters.active !== "ALL") {
        q = query(q, where("active", "==", filters.active))
      }

      if (filters.seller_id) {
        q = query(q, where("seller_id", "==", filters.seller_id))
      }

      if (filters.category) {
        q = query(q, where("categories", "array-contains", filters.category))
      }

      // Add ordering and limit - order by updated descending to show newest first
      q = query(q, orderBy("updated", "desc"), limit(limitCount))

      const snapshot = await getDocs(q)
      const products: Product[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        products.push({
          id: doc.id,
          ...data,
          created: data.created?.toDate ? data.created.toDate() : new Date(data.created || Date.now()),
          updated: data.updated?.toDate ? data.updated.toDate() : new Date(data.updated || Date.now()),
        } as Product)
      })

      // Apply client-side filters for complex queries
      let filteredProducts = products

      if (filters.search) {
        const searchTerm = filters.search.toLowerCase()
        filteredProducts = filteredProducts.filter(
          (product) =>
            product.name.toLowerCase().includes(searchTerm) ||
            product.description.toLowerCase().includes(searchTerm) ||
            product.seller_name.toLowerCase().includes(searchTerm) ||
            product.site_code.toLowerCase().includes(searchTerm) ||
            product.ai_text_tags.some((tag) => tag.toLowerCase().includes(searchTerm)) ||
            product.ai_logo_tags.some((tag) => tag.toLowerCase().includes(searchTerm)),
        )
      }

      if (filters.price_min !== undefined) {
        filteredProducts = filteredProducts.filter((product) => product.price >= filters.price_min!)
      }

      if (filters.price_max !== undefined) {
        filteredProducts = filteredProducts.filter((product) => product.price <= filters.price_max!)
      }

      return filteredProducts
    } catch (error) {
      console.error("Error fetching products:", error)
      throw error
    }
  }

  static async getAllProducts(): Promise<Product[]> {
    try {
      // Get all products without any filters
      const q = query(collection(db, COLLECTION_NAME), orderBy("updated", "desc"))
      const snapshot = await getDocs(q)
      const products: Product[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        products.push({
          id: doc.id,
          ...data,
          created: data.created?.toDate ? data.created.toDate() : new Date(data.created || Date.now()),
          updated: data.updated?.toDate ? data.updated.toDate() : new Date(data.updated || Date.now()),
        } as Product)
      })

      return products
    } catch (error) {
      console.error("Error fetching all products:", error)
      throw error
    }
  }

  static async getProductById(id: string): Promise<Product | null> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ...data,
          created: data.created?.toDate ? data.created.toDate() : new Date(data.created || Date.now()),
          updated: data.updated?.toDate ? data.updated.toDate() : new Date(data.updated || Date.now()),
        } as Product
      }

      return null
    } catch (error) {
      console.error("Error fetching product:", error)
      throw error
    }
  }

  static async updateProduct(id: string, updates: Partial<Product>): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id)
      const updateData = {
        ...updates,
        updated: Timestamp.now(),
      }

      // Convert geopoint if provided
      if (updates.specs_rental?.geopoint) {
        updateData.specs_rental = {
          ...updates.specs_rental,
          geopoint: new GeoPoint(updates.specs_rental.geopoint[0], updates.specs_rental.geopoint[1]),
        }
      }

      await updateDoc(docRef, updateData)
    } catch (error) {
      console.error("Error updating product:", error)
      throw error
    }
  }

  static async deleteProduct(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id)
      await updateDoc(docRef, {
        deleted: true,
        updated: Timestamp.now(),
      })
    } catch (error) {
      console.error("Error deleting product:", error)
      throw error
    }
  }

  static async softDeleteProduct(id: string): Promise<void> {
    try {
      const docRef = doc(db, COLLECTION_NAME, id)

      // First check if the product exists and get its current state
      const docSnap = await getDoc(docRef)
      if (!docSnap.exists()) {
        throw new Error("Product not found")
      }

      const currentData = docSnap.data()

      // Check if already deleted
      if (currentData.deleted === true) {
        throw new Error("Product is already deleted")
      }

      // Perform soft delete
      await updateDoc(docRef, {
        deleted: true,
        updated: Timestamp.now(),
      })

      console.log(`Product ${id} successfully marked as deleted`)
    } catch (error) {
      console.error("Error soft deleting product:", error)
      throw error
    }
  }

  static async getProductStats(): Promise<{
    total: number
    active: number
    pending: number
    approved: number
    totalValue: number
  }> {
    try {
      // Get all products for accurate stats
      const products = await this.getAllProducts()

      const stats = {
        total: products.length,
        active: products.filter((p) => p.active).length,
        pending: products.filter((p) => p.status === "PENDING").length,
        approved: products.filter((p) => p.status === "APPROVED").length,
        totalValue: products.reduce((sum, p) => sum + p.price, 0),
      }

      return stats
    } catch (error) {
      console.error("Error fetching product stats:", error)
      throw error
    }
  }

  static async addDeletedFieldToProducts(): Promise<{
    processed: number
    updated: number
    alreadyHadField: number
    errors: string[]
  }> {
    try {
      // Get all products without any filters to ensure we check everything
      const q = query(collection(db, COLLECTION_NAME))
      const snapshot = await getDocs(q)

      const results = {
        processed: 0,
        updated: 0,
        alreadyHadField: 0,
        errors: [] as string[],
      }

      console.log(`Starting migration for ${snapshot.docs.length} products...`)

      // Process each product
      for (const docSnapshot of snapshot.docs) {
        try {
          results.processed++
          const data = docSnapshot.data()

          // Check if the product already has a 'deleted' field
          if (data.hasOwnProperty("deleted")) {
            results.alreadyHadField++
            console.log(`Product ${docSnapshot.id} already has 'deleted' field: ${data.deleted}`)
            continue
          }

          // Add the 'deleted' field with default value false
          const docRef = doc(db, COLLECTION_NAME, docSnapshot.id)
          await updateDoc(docRef, {
            deleted: false,
            updated: Timestamp.now(),
          })

          results.updated++
          console.log(`Added 'deleted' field to product ${docSnapshot.id}`)
        } catch (error) {
          const errorMsg = `Failed to update product ${docSnapshot.id}: ${error}`
          console.error(errorMsg)
          results.errors.push(errorMsg)
        }
      }

      console.log("Migration completed:", results)
      return results
    } catch (error) {
      console.error("Error during migration:", error)
      throw error
    }
  }

  static async addCustomFieldToProducts(
    fieldDefinition: CustomFieldDefinition,
    filters: BulkOperationFilter = {},
    dryRun = false,
  ): Promise<BulkOperationResult> {
    try {
      // First, save the field definition to Firebase if it doesn't exist
      let storedFieldDef: StoredCustomFieldDefinition
      const existingField = await CustomFieldService.getFieldDefinitionByKey(fieldDefinition.key)

      if (existingField) {
        storedFieldDef = existingField
      } else {
        // Save new field definition (assuming current user ID is available)
        const userId = "current_user_id" // This should come from auth context
        storedFieldDef = await CustomFieldService.saveFieldDefinition(fieldDefinition, userId)
      }

      // Get filtered products
      const products = await this.getFilteredProducts(filters)
      const productIds = products.map((p) => p.id)

      // Execute bulk operation using Firebase service
      const result = await CustomFieldService.executeBulkFieldAddition(
        storedFieldDef,
        productIds,
        "current_user_id", // This should come from auth context
        dryRun,
      )

      return result
    } catch (error) {
      console.error("Error during custom field addition:", error)
      throw error
    }
  }

  static async addCustomFieldWithMapping(
    fieldDefinition: CustomFieldDefinition,
    mapping: DataMapping,
    filters: BulkOperationFilter = {},
    dryRun = false,
  ): Promise<BulkOperationResult> {
    try {
      // First, save the field definition to Firebase if it doesn't exist
      let storedFieldDef: StoredCustomFieldDefinition
      const existingField = await CustomFieldService.getFieldDefinitionByKey(fieldDefinition.key)

      if (existingField) {
        storedFieldDef = existingField
      } else {
        // Save new field definition (assuming current user ID is available)
        const userId = "current_user_id" // This should come from auth context
        storedFieldDef = await CustomFieldService.saveFieldDefinition(fieldDefinition, userId)
      }

      // Get filtered products
      const products = await this.getFilteredProducts(filters)

      // Apply data mapping to each product
      const result: BulkOperationResult = {
        total_selected: products.length,
        processed: 0,
        successful: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        warnings: [],
      }

      for (const product of products) {
        try {
          result.processed++

          // Check if product already has this field
          if (product.hasOwnProperty(fieldDefinition.key)) {
            result.skipped++
            result.warnings.push({
              product_id: product.id,
              product_name: product.name,
              warning: `Already has field '${fieldDefinition.key}'`,
            })
            continue
          }

          // Apply data mapping to get the value
          const flattenedProduct = CustomFieldService.flattenObject(product)
          const mappedData = {
            [mapping.target_field]: DataSourceService.applyMapping(flattenedProduct, mapping, result.processed),
          }
          const mappedValue = mappedData[mapping.target_field]

          // Validate the mapped value
          // const validationErrors = CustomFieldService.validateFieldValue(mappedValue, storedFieldDef)
          // if (validationErrors.length > 0) {
          //   result.failed++
          //   result.errors.push({
          //     product_id: product.id,
          //     product_name: product.name,
          //     error: validationErrors.map((e) => e.error_message).join(", "),
          //   })
          //   continue
          // }

          if (!dryRun) {
            // Convert value for Firebase storage
            const firebaseValue = CustomFieldService.convertValueForFirebase(mappedValue, fieldDefinition.dataType)

            // Update the product
            const docRef = doc(db, COLLECTION_NAME, product.id)
            await updateDoc(docRef, {
              [fieldDefinition.key]: firebaseValue,
              updated: Timestamp.now(),
            })
          }

          result.successful++
          console.log(`${dryRun ? "Would map" : "Mapped"} field '${fieldDefinition.key}' to product ${product.id}`)
        } catch (error) {
          result.failed++
          const errorMsg = error instanceof Error ? error.message : "Unknown error"
          result.errors.push({
            product_id: product.id,
            product_name: product.name,
            error: errorMsg,
          })
          console.error(`Failed to ${dryRun ? "validate" : "update"} product ${product.id}:`, error)
        }
      }

      // Record migration if not dry run
      if (!dryRun) {
        await CustomFieldService.recordMigration({
          field_definition_id: storedFieldDef.id,
          field_key: storedFieldDef.key,
          operation_type: "add",
          to_version: storedFieldDef.version,
          filters_applied: filters,
          result,
          created_by: "current_user_id", // This should come from auth context
          execution_time_ms: Date.now(),
        })

        // Update field usage
        await CustomFieldService.updateFieldUsage(storedFieldDef.id)
      }

      console.log(`${dryRun ? "Dry run" : "Operation"} completed:`, result)
      return result
    } catch (error) {
      console.error("Error during custom field addition with mapping:", error)
      throw error
    }
  }

  static async getFilteredProducts(filters: BulkOperationFilter): Promise<Product[]> {
    try {
      let q = query(collection(db, COLLECTION_NAME))

      // Apply Firestore filters where possible
      if (filters.status && filters.status.length > 0) {
        q = query(q, where("status", "in", filters.status))
      }

      if (filters.type && filters.type.length > 0) {
        q = query(q, where("type", "in", filters.type))
      }

      if (filters.active !== undefined) {
        q = query(q, where("active", "==", filters.active))
      }

      if (filters.has_field) {
        q = query(q, where(filters.has_field, "!=", null))
      }

      // Add ordering
      q = query(q, orderBy("updated", "desc"))

      const snapshot = await getDocs(q)
      let products: Product[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        products.push({
          id: doc.id,
          ...data,
          created: data.created?.toDate ? data.created.toDate() : new Date(data.created || Date.now()),
          updated: data.updated?.toDate ? data.updated.toDate() : new Date(data.updated || Date.now()),
        } as Product)
      })

      // Apply client-side filters for complex conditions
      if (filters.missing_field) {
        products = products.filter((product) => !product.hasOwnProperty(filters.missing_field!))
      }

      if (filters.price_range) {
        if (filters.price_range.min !== undefined) {
          products = products.filter((product) => product.price >= filters.price_range!.min)
        }
        if (filters.price_range.max !== undefined) {
          products = products.filter((product) => product.price <= filters.price_range!.max)
        }
      }

      if (filters.date_range) {
        if (filters.date_range.start) {
          products = products.filter((product) => product.updated >= filters.date_range!.start)
        }
        if (filters.date_range.end) {
          products = products.filter((product) => product.updated <= filters.date_range!.end)
        }
      }

      if (filters.seller_id && filters.seller_id.length > 0) {
        products = products.filter((product) => filters.seller_id!.includes(product.seller_id))
      }

      if (filters.category && filters.category.length > 0) {
        products = products.filter((product) => product.categories.some((cat) => filters.category!.includes(cat)))
      }

      return products
    } catch (error) {
      console.error("Error filtering products:", error)
      throw error
    }
  }

  static validateFieldValue(value: any, fieldDefinition: CustomFieldDefinition): any {
    const { dataType, validation, required } = fieldDefinition

    // Check required
    if (required && (value === null || value === undefined || value === "")) {
      throw new Error(`Field '${fieldDefinition.name}' is required`)
    }

    // Type validation and conversion
    switch (dataType) {
      case "string":
        const strValue = String(value)
        if (validation?.min && strValue.length < validation.min) {
          throw new Error(`String too short (min: ${validation.min})`)
        }
        if (validation?.max && strValue.length > validation.max) {
          throw new Error(`String too long (max: ${validation.max})`)
        }
        if (validation?.pattern && !new RegExp(validation.pattern).test(strValue)) {
          throw new Error(`String doesn't match pattern: ${validation.pattern}`)
        }
        if (validation?.options && !validation.options.includes(strValue)) {
          throw new Error(`Invalid option. Must be one of: ${validation.options.join(", ")}`)
        }
        return strValue

      case "number":
        const numValue = Number(value)
        if (isNaN(numValue)) {
          throw new Error("Invalid number")
        }
        if (validation?.min !== undefined && numValue < validation.min) {
          throw new Error(`Number too small (min: ${validation.min})`)
        }
        if (validation?.max !== undefined && numValue > validation.max) {
          throw new Error(`Number too large (max: ${validation.max})`)
        }
        return numValue

      case "boolean":
        return Boolean(value)

      case "date":
        if (value instanceof Date) return value
        const dateValue = new Date(value)
        if (isNaN(dateValue.getTime())) {
          throw new Error("Invalid date")
        }
        return dateValue

      case "array":
        if (!Array.isArray(value)) {
          throw new Error("Value must be an array")
        }
        return value

      case "object":
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          throw new Error("Value must be an object")
        }
        return value

      default:
        return value
    }
  }
}

// Dummy DataSourceService and CustomFieldService for compilation
class DataSourceService {
  static applyMapping(data: any, mapping: DataMapping, index: number): any {
    // Replace with actual data mapping logic
    return `Mapped value ${index} from ${mapping.source_field} to ${mapping.target_field}`
  }
}
