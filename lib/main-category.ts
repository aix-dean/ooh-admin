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
  writeBatch,
  limit,
  startAfter,
  type DocumentSnapshot,
  deleteDoc,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type { MainCategory, MainCategoryFormData, MainCategoryFilter } from "@/types/main-category"

const COLLECTION_NAME = "main_categories"

// Helper function to convert Firestore data to MainCategory
export const convertToMainCategory = (doc: any): MainCategory => {
  const data = doc.data()
  return {
    id: doc.id,
    name: data.name || "",
    photo_url: data.photo_url || "",
    created: data.created || Timestamp.now(),
    active: data.active ?? true,
    description: data.description || "",
    updated: data.updated || Timestamp.now(),
    featured: data.featured ?? false,
    position: data.position || 0,
    date_deleted: data.date_deleted,
    deleted: data.deleted ?? false,
    clicks: data.clicks || 0,
  }
}

// Get all main categories with pagination and filtering
export async function getMainCategories(
  filter: MainCategoryFilter = {},
): Promise<{ categories: MainCategory[]; lastDoc: DocumentSnapshot | null; total: number }> {
  try {
    const {
      searchTerm = "",
      featured,
      active,
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

    // Convert to MainCategory objects
    let categories = querySnapshot.docs.map(convertToMainCategory)

    // Client-side filtering for search term if provided
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase()
      categories = categories.filter(
        (category) =>
          category.name.toLowerCase().includes(lowerSearchTerm) ||
          category.description.toLowerCase().includes(lowerSearchTerm),
      )
    }

    // Get the last document for pagination
    const lastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    return { categories, lastDoc, total }
  } catch (error) {
    console.error("Error getting main categories:", error)
    throw error
  }
}

// Get more categories (for pagination)
export async function getMoreMainCategories(
  lastDoc: DocumentSnapshot,
  filter: MainCategoryFilter = {},
): Promise<{ categories: MainCategory[]; lastDoc: DocumentSnapshot | null }> {
  try {
    const {
      featured,
      active,
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

    // Add sorting
    constraints.push(orderBy(sortBy, sortDirection))

    // Add startAfter for pagination
    constraints.push(startAfter(lastDoc))

    // Create the query with limit
    const q = query(collection(db, COLLECTION_NAME), ...constraints, limit(pageLimit))

    // Execute the query
    const querySnapshot = await getDocs(q)

    // Convert to MainCategory objects
    const categories = querySnapshot.docs.map(convertToMainCategory)

    // Get the last document for pagination
    const newLastDoc = querySnapshot.docs.length > 0 ? querySnapshot.docs[querySnapshot.docs.length - 1] : null

    return { categories, lastDoc: newLastDoc }
  } catch (error) {
    console.error("Error getting more main categories:", error)
    throw error
  }
}

// Get a single main category by ID
export async function getMainCategoryById(id: string): Promise<MainCategory | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return convertToMainCategory(docSnap)
    } else {
      return null
    }
  } catch (error) {
    console.error("Error getting main category:", error)
    throw error
  }
}

// Validate main category data
export function validateMainCategory(data: MainCategoryFormData): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!data.name || data.name.trim() === "") {
    errors.name = "Name is required"
  } else if (data.name.length > 100) {
    errors.name = "Name must be less than 100 characters"
  }

  if (data.description && data.description.length > 1000) {
    errors.description = "Description must be less than 1000 characters"
  }

  if (data.position < 0) {
    errors.position = "Position must be a non-negative number"
  }

  return errors
}

// Create a new main category
export async function createMainCategory(data: MainCategoryFormData): Promise<string> {
  try {
    // Validate data
    const errors = validateMainCategory(data)
    if (Object.keys(errors).length > 0) {
      throw new Error("Validation failed: " + JSON.stringify(errors))
    }

    // First create the document without the ID
    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...data,
      created: serverTimestamp(),
      updated: serverTimestamp(),
      deleted: false,
    })

    // Then update the document to include its own ID
    await updateDoc(docRef, {
      id: docRef.id,
      updated: serverTimestamp(),
    })

    return docRef.id
  } catch (error) {
    console.error("Error creating main category:", error)
    throw error
  }
}

// Update an existing main category
export async function updateMainCategory(id: string, data: Partial<MainCategoryFormData>): Promise<void> {
  try {
    // Validate data (only validate fields that are being updated)
    const fieldsToValidate: Partial<MainCategoryFormData> = {}
    Object.keys(data).forEach((key) => {
      fieldsToValidate[key as keyof MainCategoryFormData] = data[key as keyof MainCategoryFormData]
    })

    const errors = validateMainCategory(fieldsToValidate as MainCategoryFormData)
    if (Object.keys(errors).length > 0) {
      throw new Error("Validation failed: " + JSON.stringify(errors))
    }

    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      ...data,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating main category:", error)
    throw error
  }
}

// Soft delete a main category (mark as deleted)
export async function softDeleteMainCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: true,
      date_deleted: serverTimestamp(),
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting main category:", error)
    throw error
  }
}

// Restore a soft-deleted main category
export async function restoreMainCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: false,
      date_deleted: null,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error restoring main category:", error)
    throw error
  }
}

// Hard delete a main category (remove from database)
export async function hardDeleteMainCategory(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)

    // Get the category to check if it has a photo_url
    const docSnap = await getDoc(docRef)
    if (docSnap.exists()) {
      const category = convertToMainCategory(docSnap)

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
    console.error("Error hard deleting main category:", error)
    throw error
  }
}

// Upload a photo for a main category
export async function uploadMainCategoryPhoto(file: File): Promise<string> {
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
    const storageRef = ref(storage, `main_categories/${fileName}`)

    // Upload the file
    await uploadBytes(storageRef, file)

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef)

    return downloadURL
  } catch (error) {
    console.error("Error uploading main category photo:", error)
    throw error
  }
}

// Update positions of multiple main categories
export async function updateMainCategoryPositions(positionUpdates: { id: string; position: number }[]): Promise<void> {
  try {
    const batch = writeBatch(db)

    positionUpdates.forEach((update) => {
      const docRef = doc(db, COLLECTION_NAME, update.id)
      batch.update(docRef, {
        position: update.position,
        updated: serverTimestamp(),
      })
    })

    await batch.commit()
  } catch (error) {
    console.error("Error updating main category positions:", error)
    throw error
  }
}

// Toggle featured status
export async function toggleMainCategoryFeatured(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const category = convertToMainCategory(docSnap)
      await updateDoc(docRef, {
        featured: !category.featured,
        updated: serverTimestamp(),
      })
    }
  } catch (error) {
    console.error("Error toggling main category featured status:", error)
    throw error
  }
}

// Toggle active status
export async function toggleMainCategoryActive(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const category = convertToMainCategory(docSnap)
      await updateDoc(docRef, {
        active: !category.active,
        updated: serverTimestamp(),
      })
    }
  } catch (error) {
    console.error("Error toggling main category active status:", error)
    throw error
  }
}

// Get the next available position for a new main category
export async function getNextMainCategoryPosition(): Promise<number> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy("position", "desc"), limit(1))
    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return 0 // First category
    }

    const lastCategory = convertToMainCategory(querySnapshot.docs[0])
    return lastCategory.position + 1
  } catch (error) {
    console.error("Error getting next main category position:", error)
    throw error
  }
}

// Increment category clicks (for analytics/tracking)
export async function incrementCategoryClicks(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const category = convertToMainCategory(docSnap)
      const currentClicks = category.clicks || 0

      await updateDoc(docRef, {
        clicks: currentClicks + 1,
        updated: serverTimestamp(),
      })
    }
  } catch (error) {
    console.error("Error incrementing category clicks:", error)
    throw error
  }
}
