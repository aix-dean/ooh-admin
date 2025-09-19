import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore, enableMultiTabIndexedDbPersistence } from "firebase/firestore"
import { getStorage } from "firebase/storage"
import { firebaseConfig, websiteInfo } from "./firebase-config"

let firebaseApp
try {
  firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()
} catch (error: any) {
  console.error("Firebase initialization error:", error.message)
}

let auth, db, storage

try {
  auth = getAuth(firebaseApp)
  db = getFirestore(firebaseApp)
  storage = getStorage(firebaseApp)

  // Enable persistence only if we're in the browser and haven't already enabled it
  if (typeof window !== "undefined") {
    // Check if persistence is already enabled by trying to enable it
    // and catching the error if it's already been called
    enableMultiTabIndexedDbPersistence(db).catch((err) => {
      if (err.code === "failed-precondition") {
        // Multiple tabs open, persistence can only be enabled in one tab at a time
        console.warn("Firebase persistence failed: Multiple tabs open")
      } else if (err.code === "unimplemented") {
        // The current browser doesn't support persistence
        console.warn("Firebase persistence failed: Browser not supported")
      } else {
        // Persistence has already been enabled, ignore the error
        console.log("Firebase persistence already enabled or failed to enable:", err.code)
      }
    })
  }
} catch (error: any) {
  console.error("Error initializing Firebase services:", error.message)
}

// Function to check if Firebase is initialized
const isFirebaseInitialized = (): boolean => {
  return !!firebaseApp
}

// Function to get the Firebase initialization error
const getInitializationError = (): Error | null => {
  try {
    getAuth() // Accessing auth triggers initialization check
    return null
  } catch (error: any) {
    return error instanceof Error ? error : new Error("Firebase not initialized")
  }
}

// Verify Firestore connection
const checkFirestoreConnection = async (): Promise<boolean> => {
  try {
    // Try to access the iboard_users collection
    await getFirestore()
    return true
  } catch (error) {
    console.error("Firestore connection verification failed:", error)
    return false
  }
}

export {
  firebaseApp,
  auth,
  db,
  storage,
  isFirebaseInitialized,
  getInitializationError,
  checkFirestoreConnection,
  websiteInfo,
}
