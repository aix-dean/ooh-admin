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
} from "firebase/firestore"

// Function to create a new Green View video
export async function createGreenViewVideo(data: any): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "green_view"), {
      ...data,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating Green View video:", error)
    throw new Error("Failed to create Green View video")
  }
}

// Function to update an existing Green View video
export async function updateGreenViewVideo(id: string, data: any): Promise<void> {
  try {
    const greenViewRef = doc(db, "green_view", id)
    await updateDoc(greenViewRef, {
      ...data,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating Green View video:", error)
    throw new Error("Failed to update Green View video")
  }
}

// Function to delete a Green View video
export async function deleteGreenViewVideo(id: string): Promise<void> {
  try {
    const greenViewRef = doc(db, "green_view", id)
    await deleteDoc(greenViewRef)
  } catch (error) {
    console.error("Error deleting Green View video:", error)
    throw new Error("Failed to delete Green View video")
  }
}

// Function to get all Green View videos for a road name
export async function getGreenViewVideosByRoad(roadName: string): Promise<any[]> {
  try {
    const q = query(collection(db, "green_view"), where("road", "==", roadName))
    const querySnapshot = await getDocs(q)
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))
  } catch (error) {
    console.error("Error getting Green View videos:", error)
    throw new Error("Failed to get Green View videos")
  }
}
