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
  getDoc,
} from "firebase/firestore"

export interface Episode {
  episode: number
  name: string
  start: string
  end: string
  public: boolean
  description?: string
  thumbnail?: string
}

export interface EpisodeTemplate {
  id: string
  name: string
  description: string
  episodes: Episode[]
  created: any
  updated: any
  createdBy?: string
}

// Function to create a new episode template
export async function createEpisodeTemplate(
  data: Omit<EpisodeTemplate, "id" | "created" | "updated">,
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "episode_templates"), {
      ...data,
      created: serverTimestamp(),
      updated: serverTimestamp(),
    })
    return docRef.id
  } catch (error) {
    console.error("Error creating episode template:", error)
    throw new Error("Failed to create episode template")
  }
}

// Function to update an existing episode template
export async function updateEpisodeTemplate(id: string, data: Partial<EpisodeTemplate>): Promise<void> {
  try {
    const templateRef = doc(db, "episode_templates", id)
    await updateDoc(templateRef, {
      ...data,
      updated: serverTimestamp(),
    })
  } catch (error) {
    console.error("Error updating episode template:", error)
    throw new Error("Failed to update episode template")
  }
}

// Function to delete an episode template
export async function deleteEpisodeTemplate(id: string): Promise<void> {
  try {
    const templateRef = doc(db, "episode_templates", id)
    await deleteDoc(templateRef)
  } catch (error) {
    console.error("Error deleting episode template:", error)
    throw new Error("Failed to delete episode template")
  }
}

// Function to get all episode templates
export async function getAllEpisodeTemplates(): Promise<EpisodeTemplate[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "episode_templates"))
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EpisodeTemplate[]
  } catch (error) {
    console.error("Error getting episode templates:", error)
    throw new Error("Failed to get episode templates")
  }
}

// Function to get a specific episode template by ID
export async function getEpisodeTemplateById(id: string): Promise<EpisodeTemplate | null> {
  try {
    const docRef = doc(db, "episode_templates", id)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as EpisodeTemplate
    }

    return null
  } catch (error) {
    console.error("Error getting episode template:", error)
    throw new Error("Failed to get episode template")
  }
}

// Function to get episode templates by creator
export async function getEpisodeTemplatesByCreator(creatorId: string): Promise<EpisodeTemplate[]> {
  try {
    const q = query(collection(db, "episode_templates"), where("createdBy", "==", creatorId))
    const querySnapshot = await getDocs(q)

    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as EpisodeTemplate[]
  } catch (error) {
    console.error("Error getting episode templates by creator:", error)
    throw new Error("Failed to get episode templates by creator")
  }
}
