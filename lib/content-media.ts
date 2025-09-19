import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  runTransaction,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore"
import type { ContentMedia, ContentMediaFilter } from "@/types/content-media"
import { parseDate, isValidDate } from "@/lib/date-utils"

// Collection reference
const contentMediaCollection = collection(db, "content_media")

// Get all content media with optional filtering and sorting
export async function getContentMedia(filter?: ContentMediaFilter): Promise<ContentMedia[]> {
  try {
    // Start with a base query
    let q = query(collection(db, "content_media"))

    // Apply filters if provided
    if (filter) {
      if (filter.category_id) {
        q = query(q, where("category_id", "==", filter.category_id))
      }
      if (filter.type) {
        q = query(q, where("type", "==", filter.type))
      }
      if (filter.showDeleted) {
        q = query(q, where("deleted", "==", true))
      } else {
        q = query(q, where("deleted", "==", false))
      }
      if (filter.featured !== undefined) {
        q = query(q, where("featured", "==", filter.featured))
      }
      if (filter.active !== undefined) {
        q = query(q, where("active", "==", filter.active))
      }
      if (filter.pinned !== undefined) {
        q = query(q, where("pinned", "==", filter.pinned))
      }
    }

    // Use a single orderBy to avoid complex index requirements
    // Sort by updated field in descending order (most recent first)
    q = query(q, orderBy("updated", "desc"))

    const querySnapshot = await getDocs(q)
    const media: ContentMedia[] = querySnapshot.docs.map((doc) => {
      const data = doc.data()

      // Safely convert Firestore timestamps to ISO strings
      const created = data.created instanceof Timestamp ? data.created.toDate().toISOString() : data.created

      const updated = data.updated instanceof Timestamp ? data.updated.toDate().toISOString() : data.updated

      // Handle start and end dates
      let start_date: string | undefined = undefined
      let end_date: string | undefined = undefined

      // First try to get from start_date/end_date fields
      if (data.start_date) {
        const startDate = data.start_date instanceof Timestamp ? data.start_date.toDate() : parseDate(data.start_date)

        if (startDate) {
          start_date = startDate.toISOString()
        }
      }

      if (data.end_date) {
        const endDate = data.end_date instanceof Timestamp ? data.end_date.toDate() : parseDate(data.end_date)

        if (endDate) {
          end_date = endDate.toISOString()
        }
      }

      // If not found, try the legacy dateTimeRange format
      if (!start_date && data.dateTimeRange?.start) {
        const startDate =
          data.dateTimeRange.start instanceof Timestamp
            ? data.dateTimeRange.start.toDate()
            : parseDate(data.dateTimeRange.start)

        if (startDate) {
          start_date = startDate.toISOString()
        }
      }

      if (!end_date && data.dateTimeRange?.end) {
        const endDate =
          data.dateTimeRange.end instanceof Timestamp
            ? data.dateTimeRange.end.toDate()
            : parseDate(data.dateTimeRange.end)

        if (endDate) {
          end_date = endDate.toISOString()
        }
      }

      // Ensure author and synopsis are properly handled
      const author = data.author || ""
      const synopsis = data.synopsis || ""

      // Process media array to ensure proper format
      let processedMedia = data.media || []
      if (Array.isArray(processedMedia)) {
        processedMedia = processedMedia.map((item) => {
          // Convert Firestore timestamps to ISO strings for created field
          const itemCreated =
            item.created instanceof Timestamp
              ? item.created.toDate().toISOString()
              : item.created || new Date().toISOString()

          return {
            ...item,
            url: item.url || item.imageUrl || "",
            description: item.description || "",
            created: itemCreated,
          }
        })
      }

      return {
        id: doc.id,
        ...data,
        created,
        updated,
        start_date,
        end_date,
        thumbnail: data.thumbnail || null,
        author,
        synopsis,
        media: processedMedia,
      } as ContentMedia
    })

    // Apply search filter client-side if provided
    if (filter?.searchQuery) {
      const searchLower = filter.searchQuery.toLowerCase()
      return media.filter(
        (item) =>
          (item.title?.toLowerCase() || "").includes(searchLower) ||
          (item.description?.toLowerCase() || "").includes(searchLower) ||
          (item.synopsis?.toLowerCase() || "").includes(searchLower) ||
          (item.author?.toLowerCase() || "").includes(searchLower) ||
          (item.type?.toLowerCase() || "").includes(searchLower),
      )
    }

    return media
  } catch (error) {
    console.error("Error getting content media:", error)
    throw new Error("Failed to fetch content media")
  }
}

// Get all content media for a category
export async function getContentMediaByCategory(categoryId: string): Promise<ContentMedia[]> {
  try {
    const q = query(
      contentMediaCollection,
      where("categoryId", "==", categoryId),
      orderBy("pinned", "desc"),
      orderBy("pinnedOrder", "asc"),
      orderBy("publishDate", "desc"),
    )

    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ContentMedia[]
  } catch (error) {
    console.error("Error getting content media:", error)
    throw new Error("Failed to fetch content media")
  }
}

// Update the getContentMediaById function to properly handle media array
export async function getContentMediaById(id: string): Promise<ContentMedia | null> {
  try {
    const docRef = doc(db, "content_media", id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data() as Omit<ContentMedia, "id">

      // Safely convert Firestore timestamps to ISO strings
      const created = data.created instanceof Timestamp ? data.created.toDate().toISOString() : data.created

      const updated = data.updated instanceof Timestamp ? data.updated.toDate().toISOString() : data.updated

      // Handle start and end dates
      let start_date: string | undefined = undefined
      let end_date: string | undefined = undefined
      let publishDate: string | undefined = undefined
      let expiryDate: string | undefined = undefined

      // Handle publishDate
      if (data.publishDate) {
        const parsedDate =
          data.publishDate instanceof Timestamp ? data.publishDate.toDate() : parseDate(data.publishDate)

        if (parsedDate) {
          publishDate = parsedDate.toISOString()
        }
      }

      // Handle expiryDate
      if (data.expiryDate) {
        const parsedDate = data.expiryDate instanceof Timestamp ? data.expiryDate.toDate() : parseDate(data.expiryDate)

        if (parsedDate) {
          expiryDate = parsedDate.toISOString()
        }
      }

      // First try to get from start_date/end_date fields
      if (data.start_date) {
        const startDate = data.start_date instanceof Timestamp ? data.start_date.toDate() : parseDate(data.start_date)

        if (startDate) {
          start_date = startDate.toISOString()
        }
      }

      if (data.end_date) {
        const endDate = data.end_date instanceof Timestamp ? data.end_date.toDate() : parseDate(data.end_date)

        if (endDate) {
          end_date = endDate.toISOString()
        }
      }

      // If not found, try the legacy dateTimeRange format
      if (!start_date && data.dateTimeRange?.start) {
        const startDate =
          data.dateTimeRange.start instanceof Timestamp
            ? data.dateTimeRange.start.toDate()
            : parseDate(data.dateTimeRange.start)

        if (startDate) {
          start_date = startDate.toISOString()
        }
      }

      if (!end_date && data.dateTimeRange?.end) {
        const endDate =
          data.dateTimeRange.end instanceof Timestamp
            ? data.dateTimeRange.end.toDate()
            : parseDate(data.dateTimeRange.end)

        if (endDate) {
          end_date = endDate.toISOString()
        }
      }

      // Process media array properly
      let processedMedia = data.media || []

      // For backward compatibility, check for articleMedia
      if (!processedMedia.length && data.articleMedia && Array.isArray(data.articleMedia)) {
        processedMedia = data.articleMedia
      }

      if (Array.isArray(processedMedia)) {
        processedMedia = processedMedia.map((item) => {
          if (typeof item === "object" && item !== null) {
            // Convert Firestore timestamps to ISO strings for created field
            const itemCreated =
              item.created instanceof Timestamp
                ? item.created.toDate().toISOString()
                : item.created || new Date().toISOString()

            return {
              created: itemCreated,
              description: item.description || "",
              url: item.url || item.imageUrl || "",
              id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            }
          }
          return {
            created: new Date().toISOString(),
            description: "",
            url: "",
            id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          }
        })
      }

      // Ensure author and synopsis are properly handled
      const author = data.author || ""
      const synopsis = data.synopsis || ""

      return {
        id: docSnap.id,
        ...data,
        created,
        updated,
        start_date,
        end_date,
        publishDate,
        expiryDate,
        thumbnail: data.thumbnail || null,
        media: processedMedia,
        author,
        synopsis,
      }
    }
    return null
  } catch (error) {
    console.error("Error getting content media by ID:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch content media: ${error.message}`)
    }
    throw new Error("Failed to fetch content media: Unknown error")
  }
}

// Get all content media types
export async function getContentMediaTypes(): Promise<string[]> {
  try {
    // Use a simple query without filtering to avoid index requirements
    const mediaQuery = collection(db, "content_media")
    const q = query(mediaQuery)
    const querySnapshot = await getDocs(q)

    const types = new Set<string>()
    querySnapshot.docs.forEach((doc) => {
      try {
        const data = doc.data()
        // Only include types from non-deleted items
        if (data.type && !data.deleted) {
          types.add(data.type)
        }
      } catch (docError) {
        console.error(`Error processing document type ${doc.id}:`, docError)
        // Continue with other documents
      }
    })

    return Array.from(types).sort()
  } catch (error) {
    console.error("Error getting content media types:", error)
    if (error instanceof Error) {
      throw new Error(`Failed to fetch content media types: ${error.message}`)
    }
    throw new Error("Failed to fetch content media types: Unknown error")
  }
}

// Soft delete content media
export async function softDeleteContentMedia(id: string): Promise<void> {
  try {
    const mediaRef = doc(db, "content_media", id)
    await updateDoc(mediaRef, {
      deleted: true,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error soft deleting content media:", error)
    throw new Error("Failed to delete content media")
  }
}

// Hard delete content media
export async function hardDeleteContentMedia(id: string): Promise<void> {
  try {
    const mediaRef = doc(db, "content_media", id)
    await deleteDoc(mediaRef)
  } catch (error) {
    console.error("Error hard deleting content media:", error)
    throw new Error("Failed to permanently delete content media")
  }
}

// Delete content media
export async function deleteContentMedia(id: string): Promise<void> {
  try {
    const docRef = doc(contentMediaCollection, id)
    await deleteDoc(docRef)
  } catch (error) {
    console.error("Error deleting content media:", error)
    throw new Error("Failed to delete content media")
  }
}

// Restore content media
export async function restoreContentMedia(id: string): Promise<void> {
  try {
    const mediaRef = doc(db, "content_media", id)
    await updateDoc(mediaRef, {
      deleted: false,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error restoring content media:", error)
    throw new Error("Failed to restore content media")
  }
}

// Update the updateContentMedia function to properly handle all fields
export async function updateContentMedia(id: string, data: Partial<ContentMedia>): Promise<void> {
  try {
    console.log("Updating content media with data:", data)
    const mediaRef = doc(db, "content_media", id)

    // Process the data to ensure it's in the correct format for Firestore
    const processedData = processContentMediaData(data)

    // Create a clean data object for Firestore
    const cleanData: any = {}

    // Explicitly handle text fields to ensure they're properly updated
    if (processedData.title !== undefined) cleanData.title = processedData.title
    if (processedData.description !== undefined) cleanData.description = processedData.description
    // For backward compatibility, also set body field to match description
    if (processedData.description !== undefined) cleanData.body = processedData.description
    else if (processedData.body !== undefined) {
      cleanData.description = processedData.body
      cleanData.body = processedData.body
    }
    if (processedData.synopsis !== undefined) cleanData.synopsis = processedData.synopsis
    if (processedData.author !== undefined) cleanData.author = processedData.author
    if (processedData.placement !== undefined) cleanData.placement = processedData.placement
    if (processedData.video_url !== undefined) cleanData.video_url = processedData.video_url || null // Ensure video_url is never undefined
    if (processedData.type !== undefined) cleanData.type = processedData.type

    // Handle boolean fields
    if (processedData.active !== undefined) cleanData.active = processedData.active
    if (processedData.featured !== undefined) cleanData.featured = processedData.featured
    if (processedData.public !== undefined) cleanData.public = processedData.public
    if (processedData.pinned !== undefined) cleanData.pinned = processedData.pinned

    // Handle numeric fields
    if (processedData.position !== undefined) cleanData.position = processedData.position
    if (processedData.orientation !== undefined) cleanData.orientation = processedData.orientation
    if (processedData.episode !== undefined) cleanData.episode = processedData.episode
    if (processedData.pinnedOrder !== undefined) cleanData.pinnedOrder = processedData.pinnedOrder

    // Handle URL fields
    if (processedData.thumbnail !== undefined) cleanData.thumbnail = processedData.thumbnail

    // Handle arrays
    if (processedData.link_ref !== undefined) cleanData.link_ref = processedData.link_ref
    if (processedData.urlReferences !== undefined) cleanData.urlReferences = processedData.urlReferences

    // Handle date conversions for Firestore
    if (processedData.start_date) {
      const startDate = parseDate(processedData.start_date)
      if (startDate) {
        cleanData.start_date = Timestamp.fromDate(startDate)
      } else {
        delete cleanData.start_date
      }
    }

    if (processedData.end_date) {
      const endDate = parseDate(processedData.end_date)
      if (endDate) {
        cleanData.end_date = Timestamp.fromDate(endDate)
      } else {
        delete cleanData.end_date
      }
    }

    // For backward compatibility, also update dateTimeRange
    if (processedData.start_date || processedData.end_date) {
      cleanData.dateTimeRange = {
        start: processedData.start_date ? Timestamp.fromDate(parseDate(processedData.start_date)!) : null,
        end: processedData.end_date ? Timestamp.fromDate(parseDate(processedData.end_date)!) : null,
      }
    }

    // Handle media field (replacing articleMedia)
    if (processedData.media !== undefined) {
      // Process media items to ensure they have created timestamps
      const processedMedia = processedData.media
        .filter((item) => item && item.url && item.url.trim() !== "")
        .map((item) => {
          // Convert created field to Firestore Timestamp if it's a Date or string
          let createdTimestamp
          if (item.created instanceof Date) {
            createdTimestamp = Timestamp.fromDate(item.created)
          } else if (typeof item.created === "string") {
            createdTimestamp = Timestamp.fromDate(new Date(item.created))
          } else if (item.created instanceof Timestamp) {
            createdTimestamp = item.created
          } else {
            createdTimestamp = Timestamp.fromDate(new Date())
          }

          return {
            url: item.url, // The URL of the media
            description: item.description || "", // A textual description of the media
            id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            created: createdTimestamp, // Timestamp of creation
          }
        })

      cleanData.media = processedMedia
      console.log("Processed media for update:", cleanData.media)
    }

    // Always update the timestamp
    cleanData.updated = serverTimestamp()

    console.log("Final clean data for Firestore:", cleanData)
    await updateDoc(mediaRef, cleanData)
  } catch (error) {
    console.error("Error updating content media:", error)
    throw new Error(`Failed to update content media: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Toggle pin status with transaction to ensure consistency between content item and category
export async function togglePinStatus(item: ContentMedia): Promise<ContentMedia> {
  try {
    const newPinnedState = !item.pinned
    const mediaRef = doc(db, "content_media", item.id)

    // Use a transaction to ensure data consistency
    const updatedItem = await runTransaction(db, async (transaction) => {
      // FIRST: Perform all reads
      const mediaDoc = await transaction.get(mediaRef)

      if (!mediaDoc.exists()) {
        throw new Error(`Media item with ID ${item.id} not found`)
      }

      // Read the category document if it exists
      let categoryDoc = null
      if (item.category_id) {
        const categoryRef = doc(db, "content_category", item.category_id)
        categoryDoc = await transaction.get(categoryRef)
      }

      // SECOND: After all reads are complete, perform writes

      // Update the media item's pinned status
      transaction.update(mediaRef, {
        pinned: newPinnedState,
        updated: Timestamp.now(),
      })

      // If the item has a category and the category exists, update its pinned_contents array
      if (item.category_id && categoryDoc && categoryDoc.exists()) {
        const categoryRef = doc(db, "content_category", item.category_id)

        if (newPinnedState) {
          // Add to pinned_contents if pinning
          transaction.update(categoryRef, {
            pinned_contents: arrayUnion(item.id),
            updated: Timestamp.now(),
          })
        } else {
          // Remove from pinned_contents if unpinning
          transaction.update(categoryRef, {
            pinned_contents: arrayRemove(item.id),
            updated: Timestamp.now(),
          })
        }
      } else if (item.category_id) {
        console.warn(`Category with ID ${item.category_id} not found. Cannot update pinned_contents.`)
      }

      // Return the updated item for the UI
      return {
        ...item,
        pinned: newPinnedState,
        updated: new Date().toISOString(),
      }
    })

    return updatedItem
  } catch (error) {
    console.error("Error toggling pin status:", error)
    throw new Error(`Failed to toggle pin status: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Toggle feature status
export async function toggleFeatureStatus(item: ContentMedia): Promise<ContentMedia> {
  try {
    // Use a transaction to ensure data consistency
    const updatedItem = await runTransaction(db, async (transaction) => {
      // STEP 1: PERFORM ALL READS FIRST
      // Get the current state from Firestore to ensure we have the latest data
      const mediaRef = doc(db, "content_media", item.id)
      const mediaDoc = await transaction.get(mediaRef)

      if (!mediaDoc.exists()) {
        throw new Error(`Media item with ID ${item.id} not found`)
      }

      // Get the current featured state from Firestore
      const currentData = mediaDoc.data()
      const currentFeaturedState = !!currentData.featured

      // Read the category document if it exists
      let categoryDoc = null
      let categoryRef = null
      if (item.category_id) {
        categoryRef = doc(db, "content_category", item.category_id)
        categoryDoc = await transaction.get(categoryRef)

        if (!categoryDoc.exists()) {
          console.warn(`Category with ID ${item.category_id} not found. Cannot update pinned_contents.`)
        }
      }

      // Toggle the featured state based on the current state in Firestore
      const newFeaturedState = !currentFeaturedState

      // STEP 2: AFTER ALL READS ARE COMPLETE, PERFORM WRITES
      // Update the feature status
      transaction.update(mediaRef, {
        featured: newFeaturedState,
        updated: serverTimestamp(),
      })

      // If the item has a category_id and the category exists, update the category's pinned_contents array
      if (categoryRef && categoryDoc && categoryDoc.exists()) {
        if (newFeaturedState) {
          // Add to pinned_contents if featuring
          transaction.update(categoryRef, {
            pinned_contents: arrayUnion(item.id),
            updated: serverTimestamp(),
          })
        } else {
          // Remove from pinned_contents if unfeaturing
          transaction.update(categoryRef, {
            pinned_contents: arrayRemove(item.id),
            updated: serverTimestamp(),
          })
        }
      }

      // Return the updated item for the UI
      return {
        ...item,
        featured: newFeaturedState,
        updated: new Date().toISOString(),
      }
    })

    return updatedItem
  } catch (error) {
    console.error("Error toggling feature status:", error)
    throw new Error(`Failed to toggle feature status: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Unpin content media with transaction to ensure consistency
export async function unpinContentMedia(item: ContentMedia): Promise<void> {
  try {
    if (!item.pinned) {
      // Already unpinned, nothing to do
      return
    }

    const mediaRef = doc(db, "content_media", item.id)

    // Use a transaction to ensure data consistency
    await runTransaction(db, async (transaction) => {
      // FIRST: Perform all reads
      const mediaDoc = await transaction.get(mediaRef)

      if (!mediaDoc.exists()) {
        throw new Error(`Media item with ID ${item.id} not found`)
      }

      // Read the category document if it exists
      let categoryDoc = null
      if (item.category_id) {
        const categoryRef = doc(db, "content_category", item.category_id)
        categoryDoc = await transaction.get(categoryRef)
      }

      // SECOND: After all reads are complete, perform writes

      // Update the media item's pinned status
      transaction.update(mediaRef, {
        pinned: false,
        updated: Timestamp.now(),
      })

      // If the item has a category and the category exists, update its pinned_contents array
      if (item.category_id && categoryDoc && categoryDoc.exists()) {
        const categoryRef = doc(db, "content_category", item.category_id)
        // Remove from pinned_contents
        transaction.update(categoryRef, {
          pinned_contents: arrayRemove(item.id),
          updated: Timestamp.now(),
        })
      }
    })
  } catch (error) {
    console.error("Error unpinning content media:", error)
    throw new Error(`Failed to unpin content media: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Utility function to synchronize pinned_contents array with actual pinned items
export async function syncPinnedContents(categoryId: string): Promise<void> {
  try {
    // Get the category
    const categoryRef = doc(db, "content_category", categoryId)
    const categoryDoc = await getDoc(categoryRef)

    if (!categoryDoc.exists()) {
      throw new Error(`Category with ID ${categoryId} not found`)
    }

    // Get all pinned content items for this category
    const mediaQuery = query(collection(db, "content_media"))
    const querySnapshot = await getDocs(mediaQuery)

    // Collect all pinned item IDs for this category
    const pinnedItemIds: string[] = []
    querySnapshot.docs.forEach((doc) => {
      const data = doc.data()
      if (data.category_id === categoryId && data.pinned && !data.deleted) {
        pinnedItemIds.push(doc.id)
      }
    })

    // Update the category's pinned_contents array
    await updateDoc(categoryRef, {
      pinned_contents: pinnedItemIds,
      updated: Timestamp.now(),
    })
  } catch (error) {
    console.error("Error synchronizing pinned contents:", error)
    throw new Error(
      `Failed to synchronize pinned contents: ${error instanceof Error ? error.message : "Unknown error"}`,
    )
  }
}

// Update the createContentMedia function to properly handle date fields
export async function createContentMedia(data: Partial<ContentMedia>): Promise<string> {
  try {
    // Process the data to ensure it's in the correct format for Firestore
    const processedData = processContentMediaData(data)

    // Validate required fields
    if (!processedData.title) {
      throw new Error("Title is required")
    }
    if (!processedData.type && !processedData.categoryId) {
      throw new Error("Type and Category are required")
    }

    // Get the highest existing position in the category
    const existingMedia = await getContentMedia({ category_id: processedData.categoryId || processedData.category_id })
    const maxPosition = existingMedia.reduce((max, item) => (item.position > max ? item.position : max), -1)

    // Determine the next available position
    const newPosition = maxPosition + 1

    // Prepare the data
    const mediaData: any = {
      ...processedData,
      created: serverTimestamp(),
      updated: serverTimestamp(),
      deleted: false,
      views: 0,
      likes: 0,
      shares: 0,
      active: processedData.active !== undefined ? processedData.active : true,
      public: processedData.public !== undefined ? processedData.public : true,
      featured: processedData.featured !== undefined ? processedData.featured : false,
      pinned: processedData.pinned !== undefined ? processedData.pinned : false,
      position: newPosition, // Assign the new position
      thumbnail: processedData.thumbnail || null, // Ensure thumbnail is properly saved
      video_url: processedData.video_url || null, // Ensure video_url is never undefined
    }

    // Handle date conversions for Firestore
    if (processedData.start_date) {
      const startDate = parseDate(processedData.start_date)
      if (startDate) {
        mediaData.start_date = Timestamp.fromDate(startDate)
      }
    }

    if (processedData.end_date) {
      const endDate = parseDate(processedData.end_date)
      if (endDate) {
        mediaData.end_date = Timestamp.fromDate(endDate)
      }
    }

    // For backward compatibility, also update dateTimeRange
    if (processedData.start_date || processedData.end_date) {
      mediaData.dateTimeRange = {
        start: processedData.start_date ? Timestamp.fromDate(parseDate(processedData.start_date)!) : null,
        end: processedData.end_date ? Timestamp.fromDate(parseDate(processedData.end_date)!) : null,
      }
    }

    // Process media items to ensure they have created timestamps
    if (processedData.media && Array.isArray(processedData.media)) {
      mediaData.media = processedData.media
        .filter((item) => item && item.url && item.url.trim() !== "")
        .map((item) => {
          // Convert created field to Firestore Timestamp if it's a Date or string
          let createdTimestamp
          if (item.created instanceof Date) {
            createdTimestamp = Timestamp.fromDate(item.created)
          } else if (typeof item.created === "string") {
            createdTimestamp = Timestamp.fromDate(new Date(item.created))
          } else if (item.created instanceof Timestamp) {
            createdTimestamp = item.created
          } else {
            createdTimestamp = Timestamp.fromDate(new Date())
          }

          return {
            url: item.url, // The URL of the media
            description: item.description || "", // A textual description of the media
            id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            created: createdTimestamp, // Timestamp of creation
          }
        })

      console.log("Structured media items for new content:", mediaData.media)
    }

    // Add document to Firestore
    const docRef = await addDoc(collection(db, "content_media"), mediaData)
    console.log("New content media created with ID:", docRef.id)
    return docRef.id
  } catch (error) {
    console.error("Error creating content media:", error)
    throw new Error(`Failed to create content media: ${error instanceof Error ? error.message : "Unknown error"}`)
  }
}

// Helper function to process content media data
function processContentMediaData(data: Partial<ContentMedia>): Partial<ContentMedia> {
  const processedData: Partial<ContentMedia> = { ...data }

  // Add this section to handle the type field
  if (processedData.type !== undefined) {
    // Ensure type is one of the valid values
    if (!["HPV", "Article", "Video"].includes(processedData.type)) {
      processedData.type = "Article" // Default to Article if invalid
    }
  }

  // Convert Date objects to Firestore Timestamps
  if (processedData.start_date) {
    if (processedData.start_date instanceof Date) {
      // Keep as Date object for later conversion to Timestamp
    } else if (typeof processedData.start_date === "string") {
      const parsedDate = new Date(processedData.start_date)
      if (isValidDate(parsedDate)) {
        processedData.start_date = parsedDate
      } else {
        delete processedData.start_date
      }
    } else {
      delete processedData.start_date
    }
  }

  if (processedData.end_date) {
    if (processedData.end_date instanceof Date) {
      // Keep as Date object for later conversion to Timestamp
    } else if (typeof processedData.end_date === "string") {
      const parsedDate = new Date(processedData.end_date)
      if (isValidDate(parsedDate)) {
        processedData.end_date = parsedDate
      } else {
        delete processedData.end_date
      }
    } else {
      delete processedData.end_date
    }
  }

  // Ensure text fields are strings
  if (processedData.title !== undefined) {
    processedData.title = String(processedData.title).trim()
  }

  if (processedData.synopsis !== undefined) {
    processedData.synopsis = String(processedData.synopsis).trim()
  }

  if (processedData.description !== undefined) {
    processedData.description = String(processedData.description).trim()
    // For backward compatibility, also set body field
    processedData.body = processedData.description
  } else if (processedData.body !== undefined) {
    // Handle case where body is provided but description isn't
    processedData.description = String(processedData.body).trim()
    processedData.body = processedData.description
  }

  // Ensure video_url is never undefined
  if (processedData.video_url === undefined) {
    processedData.video_url = null
  }

  // Filter out empty URL references
  if (processedData.urlReferences) {
    processedData.urlReferences = processedData.urlReferences.filter(
      (ref) => ref.url.trim() !== "" && ref.label.trim() !== "",
    )
  }

  // Ensure pinned is a boolean
  if (processedData.pinned !== undefined) {
    processedData.pinned = Boolean(processedData.pinned)
  }

  // Ensure pinnedOrder is a number
  if (processedData.pinnedOrder !== undefined) {
    processedData.pinnedOrder = Number(processedData.pinnedOrder) || 0
  }

  // Ensure author is a string
  if (processedData.author !== undefined) {
    processedData.author = String(processedData.author).trim()
  }

  // Handle media field (replacing articleMedia)
  if (processedData.media) {
    processedData.media = processedData.media
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        // Ensure each media item has a created timestamp
        const created = item.created || new Date()

        return {
          url: item.url || "",
          description: item.description || "",
          id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          created,
        }
      })
      .filter((item) => item.url.trim() !== "")

    console.log("Processed media:", processedData.media)
  }

  // For backward compatibility, handle articleMedia if it exists
  if (processedData.articleMedia && !processedData.media) {
    processedData.media = processedData.articleMedia
      .filter((item) => item && typeof item === "object")
      .map((item) => {
        // Ensure each media item has a created timestamp
        const created = item.created || new Date()

        return {
          url: item.url || item.imageUrl || "",
          description: item.description || "",
          id: item.id || `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          created,
        }
      })
      .filter((item) => item.url.trim() !== "")

    console.log("Processed articleMedia as media:", processedData.media)
  }

  return processedData
}
