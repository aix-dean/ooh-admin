import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "./firebase"
import { isOnline } from "./network-status"

export interface PasswordResetResult {
  success: boolean
  message: string
}

export async function sendPasswordReset(email: string): Promise<PasswordResetResult> {
  // Check if user is online
  if (!isOnline()) {
    return {
      success: false,
      message: "You appear to be offline. Please check your internet connection and try again.",
    }
  }

  try {
    // Send password reset email using Firebase without custom redirect URL
    // This uses Firebase's default behavior which doesn't require domain whitelisting
    await sendPasswordResetEmail(auth, email)

    return {
      success: true,
      message: `Password reset link sent to ${email}. Please check your email inbox and spam folder.`,
    }
  } catch (error: any) {
    console.error("Password reset error:", error)

    // Provide user-friendly error messages
    if (error.code === "auth/user-not-found") {
      return {
        success: false,
        message: "If this email is registered, you will receive a password reset link.",
      }
    } else if (error.code === "auth/invalid-email") {
      return {
        success: false,
        message: "Please enter a valid email address.",
      }
    } else if (error.code === "auth/network-request-failed") {
      return {
        success: false,
        message: "Network error. Please check your internet connection and try again.",
      }
    } else if (error.code === "auth/too-many-requests") {
      return {
        success: false,
        message: "Too many requests. Please try again later.",
      }
    } else if (error.code === "auth/unauthorized-continue-uri") {
      // Handle the specific error we were encountering
      return {
        success: false,
        message: "Configuration error. Please contact support.",
      }
    } else {
      return {
        success: false,
        message: `An error occurred (${error.code || "unknown"}). Please try again later.`,
      }
    }
  }
}
