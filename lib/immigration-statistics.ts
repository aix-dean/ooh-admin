import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore"
import { db } from "./firebase"

// Define the types for our immigration statistics
export interface UserDevice {
  android: number
  ios: number
  web: number
}

export interface ImmigrationStatistics {
  id: string
  type: "OHPLUS" | "SELLAH" | "OHSHOP"
  active_users: number
  app_store: number
  created: string // ISO date string
  female_users: number
  male_users: number
  play_store: number
  registered_visitors: number
  total_users: number
  unregistered_visitors: number
  updated: string // ISO date string
  user_device: UserDevice
}

// Define the categories we want to query
export const CATEGORIES = ["OHPLUS", "SELLAH", "OHSHOP"] as const

/**
 * Fetches immigration statistics from Firestore and categorizes them by type
 */
export async function getImmigrationStatistics(): Promise<Record<string, ImmigrationStatistics[]>> {
  try {
    const statsCollection = collection(db, "immigration_statistics")

    // Create an object to store results by category
    const results: Record<string, ImmigrationStatistics[]> = {
      OHPLUS: [],
      SELLAH: [],
      OHSHOP: [],
    }

    // Fetch data for each category
    for (const category of CATEGORIES) {
      const categoryQuery = query(statsCollection, where("type", "==", category), orderBy("created", "desc"))

      const querySnapshot = await getDocs(categoryQuery)

      const categoryData: ImmigrationStatistics[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()

        // Convert Firestore timestamps to ISO strings
        const created = data.created?.toDate?.() ? data.created.toDate().toISOString() : new Date().toISOString()

        const updated = data.updated?.toDate?.() ? data.updated.toDate().toISOString() : new Date().toISOString()

        categoryData.push({
          id: doc.id,
          type: category,
          active_users: data.active_users || 0,
          app_store: data.app_store || 0,
          created,
          female_users: data.female_users || 0,
          male_users: data.male_users || 0,
          play_store: data.play_store || 0,
          registered_visitors: data.registered_visitors || 0,
          total_users: data.total_users || 0,
          unregistered_visitors: data.unregistered_visitors || 0,
          updated,
          user_device: {
            android: data.user_device?.android || 0,
            ios: data.user_device?.ios || 0,
            web: data.user_device?.web || 0,
          },
        })
      })

      results[category] = categoryData
    }

    return results
  } catch (error) {
    console.error("Error fetching immigration statistics:", error)
    throw error
  }
}

/**
 * Gets the most recent statistics for each category
 */
export async function getLatestImmigrationStatistics(): Promise<Record<string, ImmigrationStatistics | null>> {
  try {
    const statsCollection = collection(db, "immigration_statistics")

    // Create an object to store results by category
    const results: Record<string, ImmigrationStatistics | null> = {
      OHPLUS: null,
      SELLAH: null,
      OHSHOP: null,
    }

    // Fetch the latest data for each category
    for (const category of CATEGORIES) {
      const categoryQuery = query(statsCollection, where("type", "==", category), orderBy("created", "desc"), limit(1))

      const querySnapshot = await getDocs(categoryQuery)

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0]
        const data = doc.data()

        // Convert Firestore timestamps to ISO strings
        const created = data.created?.toDate?.() ? data.created.toDate().toISOString() : new Date().toISOString()

        const updated = data.updated?.toDate?.() ? data.updated.toDate().toISOString() : new Date().toISOString()

        results[category] = {
          id: doc.id,
          type: category,
          active_users: data.active_users || 0,
          app_store: data.app_store || 0,
          created,
          female_users: data.female_users || 0,
          male_users: data.male_users || 0,
          play_store: data.play_store || 0,
          registered_visitors: data.registered_visitors || 0,
          total_users: data.total_users || 0,
          unregistered_visitors: data.unregistered_visitors || 0,
          updated,
          user_device: {
            android: data.user_device?.android || 0,
            ios: data.user_device?.ios || 0,
            web: data.user_device?.web || 0,
          },
        }
      }
    }

    return results
  } catch (error) {
    console.error("Error fetching latest immigration statistics:", error)
    throw error
  }
}
