import { db } from "@/lib/firebase"
import { collection, query, getDocs, doc, Timestamp, writeBatch } from "firebase/firestore"
import type { ContentMedia } from "@/types/content-media"
import type { ContentCategory } from "@/types/content-category"

/**
 * Synchronizes the pinned_contents array in content_category documents
 * with the pinned status of content_media items.
 *
 * This is useful for fixing inconsistencies in the database.
 */
export async function syncPinnedContent(): Promise<{
  categoriesUpdated: number
  mediaUpdated: number
  errors: string[]
}> {
  const result = {
    categoriesUpdated: 0,
    mediaUpdated: 0,
    errors: [] as string[],
  }

  try {
    // 1. Get all content media items
    const mediaQuery = query(collection(db, "content_media"))
    const mediaSnapshot = await getDocs(mediaQuery)

    // 2. Get all categories
    const categoryQuery = query(collection(db, "content_category"))
    const categorySnapshot = await getDocs(categoryQuery)

    // 3. Create a map of categories by ID
    const categories = new Map<string, ContentCategory>()
    categorySnapshot.forEach((doc) => {
      const data = doc.data() as Omit<ContentCategory, "id">
      categories.set(doc.id, {
        id: doc.id,
        ...data,
        pinned_contents: data.pinned_contents || [],
      })
    })

    // 4. Create a map to track which media items should be in each category's pinned_contents
    const categoryPinnedContents = new Map<string, Set<string>>()
    categories.forEach((category, categoryId) => {
      categoryPinnedContents.set(categoryId, new Set<string>())
    })

    // 5. Process all media items
    const batch = writeBatch(db)
    const mediaUpdates = 0

    mediaSnapshot.forEach((mediaDoc) => {
      try {
        const mediaData = mediaDoc.data() as ContentMedia
        const mediaId = mediaDoc.id

        // Skip deleted items
        if (mediaData.deleted) return

        // If the media has a category and is pinned, add it to the category's pinned_contents
        if (mediaData.category_id && mediaData.pinned) {
          const pinnedContents = categoryPinnedContents.get(mediaData.category_id)
          if (pinnedContents) {
            pinnedContents.add(mediaId)
          }
        }

        // If the media is pinned but doesn't have a category_id, log a warning
        if (mediaData.pinned && !mediaData.category_id) {
          console.warn(`Media item ${mediaId} is pinned but has no category_id`)
        }
      } catch (error) {
        result.errors.push(
          `Error processing media ${mediaDoc.id}: ${error instanceof Error ? error.message : "Unknown error"}`,
        )
      }
    })

    // 6. Update categories with the correct pinned_contents
    categories.forEach((category, categoryId) => {
      const currentPinnedContents = new Set(category.pinned_contents || [])
      const correctPinnedContents = categoryPinnedContents.get(categoryId) || new Set()

      // Check if we need to update this category
      let needsUpdate = false

      // Check for items that should be removed
      for (const contentId of currentPinnedContents) {
        if (!correctPinnedContents.has(contentId)) {
          needsUpdate = true
          break
        }
      }

      // Check for items that should be added
      if (!needsUpdate) {
        for (const contentId of correctPinnedContents) {
          if (!currentPinnedContents.has(contentId)) {
            needsUpdate = true
            break
          }
        }
      }

      // Update the category if needed
      if (needsUpdate) {
        const categoryRef = doc(db, "content_category", categoryId)
        batch.update(categoryRef, {
          pinned_contents: Array.from(correctPinnedContents),
          updated: Timestamp.now(),
        })
        result.categoriesUpdated++
      }
    })

    // 7. Commit all the updates
    await batch.commit()

    return result
  } catch (error) {
    console.error("Error synchronizing pinned content:", error)
    result.errors.push(`Global error: ${error instanceof Error ? error.message : "Unknown error"}`)
    return result
  }
}
