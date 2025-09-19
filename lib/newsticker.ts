import { db, auth } from "./firebase"
import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
  query,
  where,
} from "firebase/firestore"
import type { Newsticker, NewstickerFormData, NewstickerFilter } from "@/types/newsticker"

// Use the correct collection name as specified
const COLLECTION_NAME = "news_ticker"

// Convert Firestore data to Newsticker object
const convertToNewsticker = (doc: any): Newsticker => {
  const data = doc.data()
  return {
    id: doc.id,
    uid: data.uid || "",
    title: data.title || "",
    content: data.content || "",
    start_time: data.start_time?.toDate() || new Date(),
    end_time: data.end_time?.toDate() || new Date(),
    position: data.position || 0,
    status: data.status || "draft",
    created: data.created?.toDate() || new Date(),
    timestamp: data.timestamp?.toDate() || new Date(),
    updated: data.updated?.toDate() || new Date(),
    deleted: data.deleted || false,
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

// Validate newsticker data
const validateNewstickerData = (data: NewstickerFormData): void => {
  if (!data.title || data.title.trim() === "") {
    throw new Error("Title is required")
  }

  if (!data.content || data.content.trim() === "") {
    throw new Error("Content is required")
  }

  const startTime = new Date(data.start_time)
  const endTime = new Date(data.end_time)

  if (isNaN(startTime.getTime())) {
    throw new Error("Invalid start time")
  }

  if (isNaN(endTime.getTime())) {
    throw new Error("Invalid end time")
  }

  if (endTime <= startTime) {
    throw new Error("End time must be after start time")
  }

  if (data.position < 0) {
    throw new Error("Position must be a non-negative number")
  }
}

// Create a new newsticker entry
export const createNewsticker = async (data: NewstickerFormData): Promise<string> => {
  try {
    // Validate the data
    validateNewstickerData(data)

    // Get current user ID
    const uid = getCurrentUserId()

    // Current timestamp
    const now = new Date()

    // Prepare the data according to the schema
    const newstickerData = {
      uid,
      title: data.title,
      content: data.content,
      start_time: Timestamp.fromDate(new Date(data.start_time)),
      end_time: Timestamp.fromDate(new Date(data.end_time)),
      position: data.position,
      status: data.status,
      created: serverTimestamp(), // Automatically set by Firestore
      timestamp: serverTimestamp(), // Automatically set by Firestore
      updated: serverTimestamp(), // Automatically set by Firestore
      deleted: false, // Default to false as specified
    }

    // Add document to Firestore
    const docRef = await addDoc(collection(db, COLLECTION_NAME), newstickerData)
    console.log("Newsticker created with ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating newsticker:", error)
    throw error instanceof Error ? error : new Error("Failed to create newsticker")
  }
}

// Get all newsticker entries with optional filtering
export const getNewstickers = async (filter?: NewstickerFilter): Promise<Newsticker[]> => {
  try {
    // Start with a base query
    let q = query(collection(db, COLLECTION_NAME))

    // Apply filters if provided
    if (filter) {
      // Filter by status if specified
      if (filter.status) {
        q = query(q, where("status", "==", filter.status))
      }

      // Filter by deleted status
      if (!filter.showDeleted) {
        q = query(q, where("deleted", "==", false))
      }
    }

    // Execute the query
    const querySnapshot = await getDocs(q)
    let newstickers = querySnapshot.docs.map(convertToNewsticker)

    // Apply search filter client-side if provided
    if (filter?.searchQuery) {
      const searchLower = filter.searchQuery.toLowerCase()
      newstickers = newstickers.filter(
        (item) => item.title.toLowerCase().includes(searchLower) || item.content.toLowerCase().includes(searchLower),
      )
    }

    // Sort by position
    newstickers.sort((a, b) => a.position - b.position)

    return newstickers
  } catch (error) {
    console.error("Error getting newstickers:", error)
    throw new Error("Failed to fetch newstickers")
  }
}

// Get a single newsticker by ID
export const getNewstickerById = async (id: string): Promise<Newsticker | null> => {
  try {
    console.log(`Fetching newsticker with ID: ${id}`)
    const docRef = doc(db, COLLECTION_NAME, id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      console.log(`Newsticker found: ${id}`)
      return convertToNewsticker(docSnap)
    } else {
      console.log(`No newsticker found with ID: ${id}`)
      return null
    }
  } catch (error) {
    console.error(`Error getting newsticker with ID ${id}:`, error)
    throw new Error(`Failed to fetch newsticker: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Update an existing newsticker
export const updateNewsticker = async (id: string, data: Partial<NewstickerFormData>): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)

    // Convert date strings to Firestore Timestamps
    const updateData: any = { ...data }
    if (data.start_time) {
      updateData.start_time = Timestamp.fromDate(new Date(data.start_time))
    }
    if (data.end_time) {
      updateData.end_time = Timestamp.fromDate(new Date(data.end_time))
    }

    // Always update the 'updated' timestamp
    updateData.updated = serverTimestamp()

    await updateDoc(docRef, updateData)
  } catch (error) {
    console.error("Error updating newsticker:", error)
    throw new Error("Failed to update newsticker")
  }
}

// Soft delete a newsticker (mark as deleted)
export const softDeleteNewsticker = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting newsticker:", error)
    throw new Error("Failed to delete newsticker")
  }
}

// Restore a soft-deleted newsticker
export const restoreNewsticker = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await updateDoc(docRef, {
      deleted: false,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error restoring newsticker:", error)
    throw new Error("Failed to restore newsticker")
  }
}

// Hard delete a newsticker (remove from database)
export const hardDeleteNewsticker = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_NAME, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error("Error hard deleting newsticker:", error)
    throw new Error("Failed to permanently delete newsticker")
  }
}

// Get active newstickers (published, not deleted, within date range)
export const getActiveNewstickers = async (): Promise<Newsticker[]> => {
  try {
    const now = new Date()

    // Fetch all newstickers and filter in memory to avoid index issues
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME))

    const newstickers = querySnapshot.docs
      .map(convertToNewsticker)
      .filter(
        (item) =>
          item.status === "published" &&
          !item.deleted &&
          new Date(item.start_time) <= now &&
          new Date(item.end_time) >= now,
      )
      .sort((a, b) => a.position - b.position)

    return newstickers
  } catch (error) {
    console.error("Error getting active newstickers:", error)
    throw new Error("Failed to fetch active newstickers")
  }
}
