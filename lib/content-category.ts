import { db, auth, storage } from "./firebase"
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  writeBatch,
  type QueryConstraint,
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import type { ContentCategory, ContentCategoryFormData, ContentCategoryFilter } from "@/types/content-category"

// Use the correct collection name
const COLLECTION_NAME = "content_category"

// Convert Firestore data to ContentCategory object
const convertToContentCategory = (doc: any): ContentCategory => {
  try {
    const data = doc.data() || {}
    return {
      id: doc.id,
      type: data.type || "",
      position: data.position || 0,
      description: data.description || "",
      name: data.name || "",
      active: data.active === undefined ? false : data.active,
      pinned_content: data.pinned_content || false,
      logo: data.logo || "",
      featured: data.featured || false,
      pinned_contents: data.pinned_contents || [],
      created: data.created?.toDate() || new Date(),
      updated: data.updated?.toDate() || new Date(),
      deleted: data.deleted || false,
    }
  } catch (error) {
    console.error("Error converting document:", error)
    // Return a default object if conversion fails
    return {
      id: doc.id,
      type: "",
      position: 0,
      description: "",
      name: "Error loading item",
      active: false,
      pinned_content: false,
      logo: "",
      featured: false,
      pinned_contents: [],
      created: new Date(),
      updated: new Date(),
      deleted: false,
    }
  }
}

// Get current user ID from Firebase Auth
const getCurrentUserId = (): string => {
  const user = auth.currentUser
  if (!user) {
    throw new Error("User not authenticated")
  }
  return user.uid
}

// Validate content category data
const validateContentCategoryData = (data: ContentCategoryFormData): void => {
  if (!data.name || data.name.trim() === "") {
    throw new Error("Name is required")
  }

  if (!data.type || data.type.trim() === "") {
    throw new Error("Type is required")
  }

  if (data.position < 0) {
    throw new Error("Position must be a non-negative number")
  }
}

// Upload logo image to Firebase Storage
const uploadLogo = async (file: File, categoryId: string): Promise<string> => {
  if (!file) return ""

  const fileExtension = file.name.split(".").pop()
  const storageRef = ref(storage, `content_categories/${categoryId}/logo.${fileExtension}`)

  await uploadBytes(storageRef, file)
  const downloadURL = await getDownloadURL(storageRef)

  return downloadURL
}

// Delete logo image from Firebase Storage
const deleteLogo = async (logoUrl: string): Promise<void> => {
  if (!logoUrl) return

  try {
    const storageRef = ref(storage, logoUrl)
    await deleteObject(storageRef)
  } catch (error) {
    console.error("Error deleting logo:", error)
  }
}

// Create a new content category
export const createContentCategory = async (data: ContentCategoryFormData): Promise<string> => {
  try {
    // Validate the data
    validateContentCategoryData(data)

    // Get current user ID
    const uid = getCurrentUserId()

    // Prepare the data according to the schema
    const categoryData = {
      type: data.type,
      position: data.position,
      description: data.description,
      name: data.name,
      active: data.active,
      pinned_content: data.pinned_content,
      featured: data.featured,
      pinned_contents: data.pinned_contents || [],
      logo: "", // Will be updated after upload
      created: serverTimestamp(),
      updated: serverTimestamp(),
      deleted: false,
    }

    // Add document to Firestore
    const docRef = await addDoc(collection(db, COLLECTION_NAME), categoryData)
    console.log("Content category created with ID:", docRef.id)

    // Upload logo if provided
    if (data.logo) {
      const logoUrl = await uploadLogo(data.logo, docRef.id)

      // Update the document with the logo URL
      await updateDoc(docRef, { logo: logoUrl })
    }

    return docRef.id
  } catch (error) {
    console.error("Error creating content category:", error)
    throw error instanceof Error ? error : new Error("Failed to create content category")
  }
}

// Get all content categories with optional filtering
export const getContentCategories = async (filter?: ContentCategoryFilter): Promise<ContentCategory[]> => {
  try {
    console.log("Getting content categories with filter:", filter)

    // Start with a base query and constraints array
    const constraints: QueryConstraint[] = [orderBy("position", "asc")]

    // Apply deleted filter - always apply this filter
    if (filter?.showDeleted) {
      constraints.push(where("deleted", "==", true))
    } else {
      constraints.push(where("deleted", "==", false))
    }

    // Create the query with the constraints
    const q = query(collection(db, COLLECTION_NAME), ...constraints)

    // Execute the query
    console.log("Executing Firestore query")
    const querySnapshot = await getDocs(q)
    console.log(`Query returned ${querySnapshot.docs.length} documents`)

    // Convert documents to ContentCategory objects
    let categories = querySnapshot.docs.map(convertToContentCategory)

    // Apply additional filters in memory
    if (filter) {
      // Filter by type if specified
      if (filter.type) {
        console.log(`Filtering by type: ${filter.type}`)
        categories = categories.filter((item) => item.type === filter.type)
      }

      // Filter by featured status if specified
      if (filter.featured !== undefined) {
        console.log(`Filtering by featured: ${filter.featured}`)
        categories = categories.filter((item) => item.featured === filter.featured)
      }

      // Filter by active status if specified
      if (filter.active !== undefined) {
        console.log(`Filtering by active: ${filter.active}`)
        categories = categories.filter((item) => item.active === filter.active)
      }

      // Apply search filter if provided
      if (filter.searchQuery) {
        const searchLower = filter.searchQuery.toLowerCase()
        console.log(`Filtering by search query: ${searchLower}`)
        categories = categories.filter(
          (item) =>
            item.name.toLowerCase().includes(searchLower) ||
            item.description.toLowerCase().includes(searchLower) ||
            item.type.toLowerCase().includes(searchLower),
        )
      }
    }

    console.log(`Returning ${categories.length} categories after filtering`)
    return categories
  } catch (error) {
    console.error("Error getting content categories:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch content categories: ${error.message}`)
    } else {
      throw new Error("Failed to fetch content categories: Unknown error")
    }
  }
}

// Get a single content category by ID
export const getContentCategoryById = async (id: string): Promise<ContentCategory | null> => {
  try {
    console.log(`Fetching content category with ID: ${id}`)
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      console.log(`Content category found: ${id}`)
      return convertToContentCategory(docSnap)
    } else {
      console.log(`No content category found with ID: ${id}`)
      return null
    }
  } catch (error) {
    console.error(`Error getting content category with ID ${id}:`, error)
    throw new Error(`Failed to fetch content category: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Update an existing content category
export const updateContentCategory = async (id: string, data: Partial<ContentCategoryFormData>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)

    // Get the current category data to check if we need to update the logo
    const currentDoc = await getDoc(docRef)
    if (!currentDoc.exists()) {
      throw new Error("Content category not found")
    }

    const currentData = currentDoc.data()

    // Prepare update data
    const updateData: any = { ...data }
    delete updateData.logo // Remove logo from update data as we'll handle it separately

    // Always update the 'updated' timestamp
    updateData.updated = serverTimestamp()

    // Update the document
    await updateDoc(docRef, updateData)

    // Handle logo update if provided
    if (data.logo instanceof File) {
      // Delete the old logo if it exists
      if (currentData.logo) {
        await deleteLogo(currentData.logo)
      }

      // Upload the new logo
      const logoUrl = await uploadLogo(data.logo, id)

      // Update the document with the new logo URL
      await updateDoc(docRef, { logo: logoUrl })
    }
  } catch (error) {
    console.error("Error updating content category:", error)
    throw new Error("Failed to update content category")
  }
}

// Soft delete a content category (mark as deleted)
export const softDeleteContentCategory = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting content category:", error)
    throw new Error("Failed to delete content category")
  }
}

// Restore a soft-deleted content category
export const restoreContentCategory = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: false,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error restoring content category:", error)
    throw new Error("Failed to restore content category")
  }
}

// Hard delete a content category (remove from database)
export const hardDeleteContentCategory = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)

    // Get the current category data to check if we need to delete the logo
    const currentDoc = await getDoc(docRef)
    if (currentDoc.exists()) {
      const currentData = currentDoc.data()

      // Delete the logo if it exists
      if (currentData.logo) {
        await deleteLogo(currentData.logo)
      }
    }

    // Delete the document
    await deleteDoc(docRef)
  } catch (error) {
    console.error("Error hard deleting content category:", error)
    throw new Error("Failed to permanently delete content category")
  }
}

// Get all content types (for filtering)
export const getContentTypes = async (): Promise<string[]> => {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME))
    const types = new Set<string>()

    querySnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.type) {
        types.add(data.type)
      }
    })

    return Array.from(types).sort()
  } catch (error) {
    console.error("Error getting content types:", error)
    throw new Error("Failed to fetch content types")
  }
}

// Update multiple content categories' positions
export const updateCategoryPositions = async (updates: { id: string; position: number }[]): Promise<void> => {
  try {
    const batch = writeBatch(db)

    updates.forEach((update) => {
      const docRef = doc(db, COLLECTION_NAME, update.id)
      batch.update(docRef, {
        position: update.position,
        updated: serverTimestamp(),
      })
    })

    await batch.commit()
  } catch (error) {
    console.error("Error updating category positions:", error)
    throw new Error("Failed to update category positions")
  }
}
