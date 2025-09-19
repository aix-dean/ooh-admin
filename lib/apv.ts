import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  writeBatch,
  getDoc,
} from "firebase/firestore"

// Function to create a new APV video
export async function createApvVideo(data: any): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "apv"), {
      ...data,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating APV video:", error)
    throw new Error("Failed to create APV video")
  }
}

// Function to update an existing APV video
export async function updateApvVideo(id: string, data: any): Promise<void> {
  try {
    const apvRef = doc(db, "apv", id)
    await updateDoc(apvRef, {
      ...data,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating APV video:", error)
    throw new Error("Failed to update APV video")
  }
}

// Function to delete an APV video
export async function deleteApvVideo(id: string): Promise<void> {
  try {
    const apvRef = doc(db, "apv", id)
    await deleteDoc(apvRef)
  } catch (error) {
    console.error("Error deleting APV video:", error)
    throw new Error("Failed to delete APV video")
  }
}

// Function to get all APV videos for a category
export async function getApvVideosByCategory(categoryId: string): Promise<any[]> {
  try {
    const q = query(collection(db, "apv"), where("category_id", "==", categoryId))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error("Error getting APV videos:", error)
    throw new Error("Failed to get APV videos")
  }
}

// Function to pin an APV video (and optionally unpin others)
export async function pinApvVideo(id: string, unpinOthers = true): Promise<void> {
  try {
    // Create a batch using writeBatch instead of db.batch()
    const batch = writeBatch(db)

    // Get the APV video being pinned to extract category_id
    const apvRef = doc(db, "apv", id)
    const apvDoc = await getDoc(apvRef)

    if (!apvDoc.exists()) {
      throw new Error("APV video not found")
    }

    const apvData = apvDoc.data()
    const categoryId = apvData.category_id

    // If we need to unpin others first
    if (unpinOthers) {
      const apvCollection = collection(db, "apv")
      const querySnapshot = await getDocs(query(apvCollection, where("pinned", "==", true)))

      querySnapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { pinned: false })
      })
    }

    // Pin the selected video
    batch.update(apvRef, {
      pinned: true,
      updated: serverTimestamp(),
    })

    // Update the category document with pinned video information
    if (categoryId) {
      const categoryRef = doc(db, "green_view_categories", categoryId)
      batch.update(categoryRef, {
        pinned: id,
        latest_apv_id: id,
        latest_apv_updated: serverTimestamp(),
      })
    }

    await batch.commit()
  } catch (error) {
    console.error("Error pinning APV video:", error)
    throw new Error("Failed to pin APV video")
  }
}

// Function to unpin an APV video
export async function unpinApvVideo(id: string): Promise<void> {
  try {
    const batch = writeBatch(db)

    // Get the APV video being unpinned to extract category_id
    const apvRef = doc(db, "apv", id)
    const apvDoc = await getDoc(apvRef)

    if (!apvDoc.exists()) {
      throw new Error("APV video not found")
    }

    const apvData = apvDoc.data()
    const categoryId = apvData.category_id

    // Unpin the video
    batch.update(apvRef, {
      pinned: false,
      updated: serverTimestamp(),
    })

    // Clear the category's pinned information if this was the pinned video
    if (categoryId) {
      const categoryRef = doc(db, "green_view_categories", categoryId)
      const categoryDoc = await getDoc(categoryRef)

      if (categoryDoc.exists()) {
        const categoryData = categoryDoc.data()
        // Only clear if this video was the pinned one
        if (categoryData.pinned === id) {
          batch.update(categoryRef, {
            pinned: "",
            latest_apv_id: "",
            latest_apv_updated: serverTimestamp(),
          })
        }
      }
    }

    await batch.commit()
  } catch (error) {
    console.error("Error unpinning APV video:", error)
    throw new Error("Failed to unpin APV video")
  }
}

// Function to get the latest pinned APV video
export async function getPinnedApvVideos(): Promise<any[]> {
  try {
    const q = query(collection(db, "apv"), where("pinned", "==", true))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error("Error getting pinned APV videos:", error)
    throw new Error("Failed to get pinned APV videos")
  }
}

// Function to automatically pin the latest APV video
export async function pinLatestApvVideo(categoryId?: string): Promise<string | null> {
  try {
    let q

    if (categoryId) {
      q = query(
        collection(db, "apv"),
        where("category_id", "==", categoryId),
        where("active", "==", true),
        where("deleted", "==", false),
      )
    } else {
      q = query(collection(db, "apv"), where("active", "==", true), where("deleted", "==", false))
    }

    const querySnapshot = await getDocs(q)

    if (querySnapshot.empty) {
      return null
    }

    // Find the latest video by created date
    let latestVideo = null
    let latestDate = new Date(0) // Start with oldest possible date

    querySnapshot.docs.forEach((doc) => {
      const data = doc.data()
      const createdDate = data.created?.toDate?.() || data.created

      if (createdDate > latestDate) {
        latestDate = createdDate
        latestVideo = {
          id: doc.id,
          ...data,
        }
      }
    })

    if (latestVideo) {
      await pinApvVideo(latestVideo.id)
      return latestVideo.id
    }

    return null
  } catch (error) {
    console.error("Error pinning latest APV video:", error)
    throw new Error("Failed to pin latest APV video")
  }
}
