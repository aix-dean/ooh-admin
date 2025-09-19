import { createUserWithEmailAndPassword, updateProfile, AuthErrorCodes, type User } from "firebase/auth"
import { doc, setDoc, serverTimestamp, getDoc, runTransaction, enableNetwork, disableNetwork } from "firebase/firestore"
import { auth, db, isFirebaseInitialized } from "./firebase"
import { isOnline, logNetworkError } from "./network-status"

// Maximum number of retries for Firestore operations
const MAX_RETRIES = 3
// Delay between retries (in milliseconds)
const RETRY_DELAY = 1000

interface RegisterUserData {
  firstName: string
  middleName?: string
  lastName: string
  contactNumber: string
  countryCode?: string
  gender: string
  email: string
  password: string
  displayName?: string
  location?: { lat?: number; lng?: number }
}

interface FirestoreUserData {
  email: string
  display_name: string
  uid: string
  id: string
  first_name: string
  middle_name: string
  last_name: string
  gender: string
  phone_number: string
  country_code: string
  photo_url: string
  banner: string
  location: any
  active: boolean
  onboarding: boolean
  type: string
  role: string[]
  followers: number
  rating: number
  created: any
  created_time: any
  updated: any
  active_date: any
}

// Helper function to wait for a specified time
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Helper function to retry a Firestore operation
async function retryOperation<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    if (retries <= 0) {
      console.error("Max retries reached, operation failed:", error)
      throw error
    }

    // Log the retry attempt
    console.log(`Retrying operation, ${retries} attempts remaining`)

    // Check if it's a network error
    if (error.code === "unavailable" || error.code === "network-request-failed") {
      console.log("Network error detected, waiting before retry")

      // Wait longer for network errors
      await wait(RETRY_DELAY * 2)

      // Try to re-enable the network if it was disabled
      try {
        await enableNetwork(db)
        console.log("Network re-enabled")
      } catch (networkError) {
        console.warn("Failed to re-enable network:", networkError)
      }
    } else {
      // Standard delay for other errors
      await wait(RETRY_DELAY)
    }

    // Retry the operation
    return retryOperation(operation, retries - 1)
  }
}

// Function to map Firebase Auth errors to user-friendly messages
function getAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case AuthErrorCodes.EMAIL_EXISTS:
      return "This email address is already in use. Please try a different email or log in."
    case AuthErrorCodes.WEAK_PASSWORD:
      return "Password is too weak. Please choose a stronger password (at least 6 characters)."
    case AuthErrorCodes.INVALID_EMAIL:
      return "Invalid email address. Please enter a valid email."
    case AuthErrorCodes.NETWORK_REQUEST_FAILED:
      return "Network error. Please check your internet connection and try again."
    case AuthErrorCodes.TOO_MANY_ATTEMPTS_TRY_LATER:
      return "Too many attempts. Please try again later."
    case AuthErrorCodes.USER_DISABLED:
      return "This account has been disabled. Please contact support."
    case AuthErrorCodes.OPERATION_NOT_ALLOWED:
      return "Operation not allowed. Please contact support."
    default:
      return "An error occurred during registration. Please try again later."
  }
}

// Function to map Firestore errors to user-friendly messages
function getFirestoreErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case "unavailable":
      return "The service is currently unavailable. Please try again later."
    case "permission-denied":
      return "You don't have permission to perform this action."
    case "resource-exhausted":
      return "System resources have been exhausted. Please try again later."
    case "unauthenticated":
      return "You need to be authenticated to perform this action."
    case "aborted":
      return "The operation was aborted. Please try again."
    case "already-exists":
      return "This record already exists."
    case "cancelled":
      return "The operation was cancelled."
    case "data-loss":
      return "Unrecoverable data loss or corruption."
    case "deadline-exceeded":
      return "Deadline expired before operation could complete."
    case "failed-precondition":
      return "Operation was rejected because the system is not in a state required for the operation's execution."
    case "internal":
      return "Internal error. Please try again later."
    case "invalid-argument":
      return "Invalid argument provided."
    case "not-found":
      return "The requested document was not found."
    case "out-of-range":
      return "Operation was attempted past the valid range."
    case "unimplemented":
      return "Operation is not implemented or not supported."
    case "unknown":
      return "Unknown error occurred. Please try again."
    default:
      return "An error occurred while saving your data. Please try again later."
  }
}

// Verify Firebase initialization before registration
async function verifyFirebaseBeforeRegistration(): Promise<boolean> {
  // Check if Firebase is initialized
  if (!isFirebaseInitialized()) {
    console.error("Firebase is not properly initialized")
    throw new Error("System initialization error. Please try again later or contact support.")
  }

  // Check network status
  if (!isOnline()) {
    console.error("Network is offline")
    throw new Error("You appear to be offline. Please check your internet connection and try again.")
  }

  // Verify Firestore connection
  const isConnected = await checkFirestoreConnection()
  if (!isConnected) {
    console.error("Firestore connection verification failed")
    throw new Error("Unable to connect to the database. Please try again later.")
  }

  return true
}

export async function registerUser(userData: RegisterUserData): Promise<User> {
  // Start logging the registration process
  console.log("Starting user registration process")

  // Verify Firebase initialization and connection
  await verifyFirebaseBeforeRegistration()

  try {
    console.log("Creating user in Firebase Auth")

    // Create the user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password)
    const user = userCredential.user

    console.log("User created successfully in Firebase Auth:", user.uid)

    // Update the user's display name
    const displayName = userData.displayName || `${userData.firstName} ${userData.lastName}`
    console.log("Updating user profile with display name:", displayName)

    await updateProfile(user, {
      displayName,
    })

    console.log("User profile updated successfully")

    // Format phone number with country code if provided
    const phoneNumber = userData.countryCode
      ? `${userData.countryCode} ${userData.contactNumber}`
      : userData.contactNumber

    // Prepare user data for Firestore with all required fields
    const userDocData: FirestoreUserData = {
      // User identification
      email: userData.email,
      display_name: displayName,
      uid: user.uid,
      id: user.uid, // Using uid as id

      // Personal information
      first_name: userData.firstName,
      middle_name: userData.middleName || "-",
      last_name: userData.lastName,
      gender: userData.gender,
      phone_number: phoneNumber || "-",
      country_code: userData.countryCode || "+63", // Default to Philippines

      // Profile data
      photo_url: "", // Empty image path initially
      banner: "", // Empty image path initially
      location: userData.location || "", // Empty location initially

      // Account status
      active: true,
      onboarding: false,
      type: "OHADMIN", // Default type
      role: ["user"], // Default role as array

      // Metrics
      followers: 0,
      rating: 0.0, // Double for rating

      // Timestamps
      created: serverTimestamp(),
      created_time: serverTimestamp(),
      updated: serverTimestamp(),
      active_date: serverTimestamp(),
    }

    console.log("Preparing to store user data in Firestore")

    // Use a transaction to ensure data consistency
    await retryOperation(async () => {
      try {
        await runTransaction(db, async (transaction) => {
          // Check if the document already exists
          const userDocRef = doc(db, "iboard_users", user.uid)
          const userDoc = await transaction.get(userDocRef)

          if (userDoc.exists()) {
            console.warn("User document already exists in Firestore, updating instead of creating")
            // Update the existing document
            transaction.update(userDocRef, {
              ...userDocData,
              updated: serverTimestamp(),
            })
          } else {
            // Create a new document
            transaction.set(userDocRef, userDocData)
          }
        })
        console.log("User data successfully stored in Firestore")
      } catch (transactionError: any) {
        console.error("Transaction failed:", transactionError)

        // If transaction fails, try a direct write as fallback
        console.log("Attempting direct write as fallback")
        const userDocRef = doc(db, "iboard_users", user.uid)
        await setDoc(userDocRef, userDocData)
        console.log("Fallback direct write successful")
      }
    })

    // Verify the user data was written correctly
    await verifyUserDataInFirestore(user.uid)

    console.log("User registration completed successfully")
    return user
  } catch (error: any) {
    console.error("Error during registration:", error)

    // Log detailed error information
    logNetworkError(error, "user registration")

    // Determine if it's an Auth error or Firestore error
    if (error.code && error.code.startsWith("auth/")) {
      // Auth error
      const errorMessage = getAuthErrorMessage(error.code)
      throw new Error(errorMessage)
    } else if (error.code) {
      // Firestore error
      const errorMessage = getFirestoreErrorMessage(error.code)
      throw new Error(errorMessage)
    } else {
      // Generic error
      throw new Error(error.message || "Failed to register. Please try again.")
    }
  }
}

// Function to verify user data was written to Firestore
async function verifyUserDataInFirestore(userId: string): Promise<boolean> {
  try {
    console.log(`Verifying user data in Firestore for user ID: ${userId}`)
    const userDocRef = doc(db, "iboard_users", userId)
    const userDoc = await getDoc(userDocRef)

    if (userDoc.exists()) {
      console.log("User data verification successful")
      return true
    } else {
      console.error("User data verification failed: Document does not exist")
      return false
    }
  } catch (error) {
    console.error("Error verifying user data:", error)
    return false
  }
}

// Function to toggle offline/online mode
export async function toggleNetworkMode(online: boolean): Promise<void> {
  try {
    if (online) {
      console.log("Enabling network")
      await enableNetwork(db)
    } else {
      console.log("Disabling network")
      await disableNetwork(db)
    }
  } catch (error) {
    console.error(`Failed to ${online ? "enable" : "disable"} network:`, error)
    throw error
  }
}

// Verify Firestore connection
export const checkFirestoreConnection = async (): Promise<boolean> => {
  try {
    // Try to access the iboard_users collection
    const testDocRef = doc(db, "system", "connection_test")
    await getDoc(testDocRef)

    console.log("Firestore connection verified successfully")
    return true
  } catch (error) {
    console.error("Firestore connection verification failed:", error)
    return false
  }
}
