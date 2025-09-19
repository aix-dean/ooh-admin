import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  limit,
  startAfter,
  type DocumentSnapshot,
  deleteDoc,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type { Category, CategoryFormData, CategoryFilter } from "@/types/category"

const COLLECTION_NAME = "categories"

// Helper function to convert Firestore data to Category
export const convertToCategory = (doc: any): Category => {
  const data = doc.data()
  return {
    id: doc.id,
    name: data.name || "",
    photo_url: data.photo_url || "",
    active: data.active ?? true,
    clicked: data.clicked || 0,
    created: data.created || Timestamp.now(),
    deleted: data.deleted ?? false,
    featured: data.featured ?? false,
    main_category_id: data.main_category_id || [],
    position: data.position || 0,
    type: data.type || "",
  }
}

// Get all categories with pagination and filtering
export async function getCategories(
  filter: CategoryFilter = {},
): Promise<{ categories: Category[]; lastDoc: DocumentSnapshot | null; total: number }> {
  try {
    const {
      searchTerm = "",
      featured,
      active,
      mainCategoryId,
      type,
      sortBy = "position",
      sortDirection = "asc",
      page = 1,
      limit: pageLimit = 10,
      showDeleted = false,
    } = filter

    // Build query constraints
    const constraints: any[] = [where("deleted", "==", showDeleted)]

    if (featured !== undefined) {
      constraints.push(where("featured", "==", featured))
    }

    if (active !== undefined) {
      constraints.push(where("active", "==", active))
    }

    if (mainCategoryId) {
      constraints.push(where("main_category_id", "array-contains", mainCategoryId))
    }

    if (type) {
      constraints.push(where("type", "==", type))
    }

    // Add sorting
    constraints.push(orderBy(sortBy, sortDirection))

    // Create the query
    let q = query(collection(db, COLLECTION_NAME), ...constraints)

    // Add pagination
    if (pageLimit > 0) {
      q = query(q, limit(pageLimit))
    }

    // Execute the query
    const querySnapshot = await getDocs(q)

    // Get total count (for pagination)
    const countQuery = query(collection(db, COLLECTION_NAME), ...constraints.filter((c) => c.type !== "limit"))
    const countSnapshot = await getDocs(countQuery)
    const total = countSnapshot.size

    // Convert to Category objects
    let categories = querySnapshot.docs.map(convertToCategory)

    // Client-side filtering for search term if provided
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      categories = categories.filter((category) => category.name.toLowerCase().includes(lowerSearchTerm))
    }

    // Get the last document for pagination
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    return { categories, lastDoc, total }
  } catch (error) {
    console.error("Error getting categories:", error)
    throw error
  }
}

// Get more categories (for pagination)
export async function getMoreCategories(
  lastDoc: DocumentSnapshot,
  filter: CategoryFilter = {},
): Promise<{ categories: Category[]; lastDoc: DocumentSnapshot | null }> {
  try {
    const {
      featured,
      active,
      mainCategoryId,
      type,
      sortBy = "position",
      sortDirection = "asc",
      limit: pageLimit = 10,
      showDeleted = false,
    } = filter

    // Build query constraints
    const constraints: any[] = [where("deleted", "==", showDeleted)]

    if (featured !== undefined) {
      constraints.push(where("featured", "==", featured))
    }

    if (active !== undefined) {
      constraints.push(where("active", "==", active))
    }

    if (mainCategoryId) {
      constraints.push(where("main_category_id", "array-contains", mainCategoryId))
    }

    if (type) {
      constraints.push(where("type", "==", type))
    }

    // Add sorting
    constraints.push(orderBy(sortBy, sortDirection))

    // Add startAfter for pagination
    constraints.push(startAfter(lastDoc))

    // Create the query with limit
    const q = query(collection(db, COLLECTION_NAME), ...constraints, limit(pageLimit))

    // Execute the query
    const querySnapshot = await getDocs(q)

    // Convert to Category objects
    const categories = querySnapshot.docs.map(convertToCategory)

    // Get the last document for pagination
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    return { categories, lastDoc: newLastDoc }
  } catch (error) {
    console.error("Error getting more categories:", error)
    throw error
  }
}

// Get a single category by ID
export async function getCategoryById(id: string): Promise<Category | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return convertToCategory(docSnap)
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting category:", error)
    throw error
  }
}

// Increment click count for a category
export async function incrementCategoryClicks(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const category = convertToCategory(docSnap)
      await updateDoc(docRef, {
        clicked: category.clicked + 1,
      })
    }
  } catch (error) {
    console.error("Error incrementing category clicks:", error)
    throw error
  }
}

// Validate category data
export function validateCategory(data: CategoryFormData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.name || data.name.trim() === "") {
    errors.name = "Name is required"
  } else if (data.name.length > 100) {
    errors.name = "Name must be less than 100 characters"
  }

  if (data.position < 0) {
    errors.position = "Position must be a non-negative number"
  }

  if (!data.type || data.type.trim() === "") {
    errors.type = "Type is required"
  }

  return errors
}

// Create a new category
export async function createCategory(data: CategoryFormData): Promise<string> {
  try {
    // Validate data
    const errors = validateCategory(data)
    if (Object.keys(errors).length > 0) {
      throw new Error("Validation failed: " + JSON.stringify(errors))
    }

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      clicked: 0,
      created: serverTimestamp(),
      deleted: false,
    })

    return docRef.id
  } catch (error) {
    console.error("Error creating category:", error)
    throw error
  }
}

// Update an existing category
export async function updateCategory(id: string, data: Partial<CategoryFormData>): Promise<void> {
  try {
    // Validate data (only validate fields that are being updated)
    const fieldsToValidate: Partial<CategoryFormData> = {}
    Object.keys(data).forEach((key) => {
      fieldsToValidate[key as keyof CategoryFormData] = data[key as keyof CategoryFormData]
    })

    const errors = validateCategory(fieldsToValidate as CategoryFormData)
    if (Object.keys(errors).length > 0) {
      throw new Error("Validation failed: " + JSON.stringify(errors))
    }

    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, data)
  } catch (error) {
    console.error("Error updating category:", error)
    throw error
  }
}

// Soft delete a category (mark as deleted)
export async function softDeleteCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: true,
    })
  } catch (error) {
    console.error("Error soft deleting category:", error)
    throw error
  }
}

// Restore a soft-deleted category
export async function restoreCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: false,
    })
  } catch (error) {
    console.error("Error restoring category:", error)
    throw error
  }
}

// Hard delete a category (remove from database)
export async function hardDeleteCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)

    // Get the category to check if it has a photo_url
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const category = convertToCategory(docSnap)

      // If there's a photo, delete it from storage
      if (category.photo_url) {
        try {
          // Extract the path from the URL
          const url = new URL(category.photo_url)
          const path = url.pathname.split("/o/")[1]
          if (path) {
            const decodedPath = decodeURIComponent(path.split("?")[0])
            const photoRef = ref(storage, decodedPath)
            await deleteObject(photoRef)
          }
        } catch (photoError) {
          console.error("Error deleting photo from storage:", photoError)
          // Continue with document deletion even if photo deletion fails
        }
      }
    }

    // Delete the document
    await deleteDoc(docRef)
  } catch (error) {
    console.error("Error hard deleting category:", error)
    throw error
  }
}

// Upload a photo for a category
export async function uploadCategoryPhoto(file: File): Promise<string> {
  try {
    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if (!validTypes.includes(file.type)) {
      throw new Error("Invalid file type. Please upload a JPEG, PNG, GIF, or WebP image.")
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      throw new Error("File too large. Please upload an image smaller than 5MB.")
    }

    // Create a unique filename
    const fileExtension = file.name.split(".").pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExtension}`

    // Create a reference to the storage location
    const storageRef = ref(storage, `categories/${fileName}`)

    // Upload the file
    await uploadBytes(storageRef, file)

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef)

    return downloadURL
  } catch (error) {
    console.error("Error uploading category photo:", error)
    throw error
  }
}

// Toggle featured status
export async function toggleCategoryFeatured(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const category = convertToCategory(docSnap)
      await updateDoc(docRef, {
        featured: !category.featured,
      })
    }
  } catch (error) {
    console.error("Error toggling category featured status:", error)
    throw error
  }
}

// Toggle active status
export async function toggleCategoryActive(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const category = convertToCategory(docSnap)
      await updateDoc(docRef, {
        active: !category.active,
      })
    }
  } catch (error) {
    console.error("Error toggling category active status:", error)
    throw error
  }
}
