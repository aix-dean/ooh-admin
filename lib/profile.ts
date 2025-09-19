import { doc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore"
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { auth, db, storage } from "./firebase"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Update user profile in Firestore
export async function updateUserProfile(profileData: {
  first_name: string
  middle_name: string
  last_name: string
  display_name: string
  phone_number: string
  country_code: string
  gender: string
  location: string
}) {
  try {
    const auth = getAuth()
    const user = auth.currentUser

    if (!user) {
      throw new Error("User not authenticated")
    }

    const db = getFirestore()
    const userRef = doc(db, "users", user.uid)

    // Update the user profile in Firestore
    await updateDoc(userRef, {
      first_name: profileData.first_name,
      middle_name: profileData.middle_name,
      last_name: profileData.last_name,
      display_name: profileData.display_name,
      phone_number: profileData.phone_number,
      country_code: profileData.country_code,
      gender: profileData.gender,
      location: profileData.location,
      updated_at: serverTimestamp(),
    })

    return true
  } catch (error: any) {
    console.error("Error updating user profile:", error)
    throw new Error(error.message || "Failed to update profile")
  }
}

// Update user password
export async function updateUserPassword(currentPassword: string, newPassword: string) {
  try {
    const user = auth.currentUser
    if (!user || !user.email) {
      throw new Error("You must be logged in to update your password")
    }

    // Re-authenticate user before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)

    // Update password
    await updatePassword(user, newPassword)

    return true
  } catch (error: any) {
    console.error("Error updating password:", error)

    // Provide user-friendly error messages
    if (error.code === "auth/wrong-password") {
      throw new Error("Current password is incorrect")
    } else if (error.code === "auth/weak-password") {
      throw new Error("New password is too weak")
    } else if (error.code === "auth/requires-recent-login") {
      throw new Error("This operation requires recent authentication. Please log in again before retrying")
    }

    throw new Error(error.message || "Failed to update password")
  }
}

// Update profile image
export async function updateProfileImage(file: File) {
  try {
    const user = auth.currentUser
    if (!user) {
      throw new Error("You must be logged in to update your profile image")
    }

    // Create a reference to the storage location
    const storageRef = ref(storage, `profile_images/${user.uid}/${Date.now()}_${file.name}`)

    // Upload the file
    const snapshot = await uploadBytes(storageRef, file)

    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref)

    // Update profile in Firebase Auth
    await updateProfile(user, {
      photoURL: downloadURL,
    })

    // Update photo_url in Firestore
    const userRef = doc(db, "iboard_users", user.uid)
    await updateDoc(userRef, {
      photo_url: downloadURL,
      updated: serverTimestamp(),
    })

    return downloadURL
  } catch (error: any) {
    console.error("Error updating profile image:", error)
    throw new Error(error.message || "Failed to update profile image")
  }
}

// Get user profile data
export async function getUserProfile(userId: string) {
  try {
    const userRef = doc(db, "iboard_users", userId)
    const userDoc = await getDoc(userRef)

    if (!userDoc.exists()) {
      throw new Error("User profile not found")
    }

    return userDoc.data()
  } catch (error: any) {
    console.error("Error getting user profile:", error)
    throw new Error(error.message || "Failed to get user profile")
  }
}
