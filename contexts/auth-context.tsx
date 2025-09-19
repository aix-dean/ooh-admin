"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import {
  type User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth"
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { tenantConfig } from "@/lib/tenant-service"

// Define the user data interface to match Firestore structure
interface UserData {
  email: string
  display_name: string
  uid: string
  id: string
  created_time: any
  phone_number: string
  location: any
  active: boolean
  updated: any
  gender: string
  photo_url: string
  first_name: string
  middle_name: string
  last_name: string
  onboarding: boolean
  followers: number
  rating: number
  created: any
  banner: string
  active_date: any
  role: string[]
  type: string
  tenantId?: string
}

interface AuthContextType {
  user: User | null
  userData: UserData | null
  loading: boolean
  signUp: (email: string, password: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  logout: () => Promise<void>
  updateUserProfile: (displayName: string) => Promise<void>
  refreshUserData: () => Promise<void>
  tenantId: string
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signUp: async () => {},
  signIn: async () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
  updateUserProfile: async () => {},
  refreshUserData: async () => {},
  tenantId: tenantConfig.tenantId,
})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const tenantId = tenantConfig.tenantId

  // Function to fetch user data from Firestore
  const fetchUserData = async (uid: string) => {
    try {
      const docRef = doc(db, "iboard_users", uid)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        const data = docSnap.data() as UserData
        setUserData(data)
      } else {
        console.log("No user data found in Firestore")

        // If user exists in Auth but not in Firestore, create a basic profile
        if (user) {
          const displayName = user.displayName || user.email?.split("@")[0] || "User"
          const basicUserData = {
            email: user.email || "",
            display_name: displayName,
            uid: user.uid,
            id: user.uid,
            created_time: serverTimestamp(),
            phone_number: user.phoneNumber || "-",
            location: "",
            active: true,
            updated: serverTimestamp(),
            gender: "Not specified",
            photo_url: user.photoURL || "",
            first_name: displayName.split(" ")[0] || "User",
            middle_name: "-",
            last_name: displayName.split(" ").slice(1).join(" ") || "-",
            onboarding: false,
            followers: 0,
            rating: 0.0,
            created: serverTimestamp(),
            banner: "",
            active_date: serverTimestamp(),
            role: ["user"],
            type: "OHADMIN",
            tenantId: tenantId,
          }

          try {
            await setDoc(docRef, basicUserData)
            setUserData(basicUserData as UserData)
          } catch (error) {
            console.error("Error creating basic user profile:", error)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
    }
  }

  // Function to refresh user data
  const refreshUserData = async () => {
    if (user) {
      await fetchUserData(user.uid)
    }
  }

  useEffect(() => {
    // Use the standard auth instance
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user)

      if (user) {
        await fetchUserData(user.uid)
      } else {
        setUserData(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email, password)
  }

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    const result = await signInWithPopup(auth, provider)

    // Check if this is a new user and create Firestore record if needed
    if (result.user) {
      const docRef = doc(db, "iboard_users", result.user.uid)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        // Create a new user record for Google sign-in
        const displayName = result.user.displayName || result.user.email?.split("@")[0] || "User"
        const nameParts = displayName.split(" ")
        const firstName = nameParts[0] || "User"
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "-"

        const userData = {
          email: result.user.email || "",
          display_name: displayName,
          uid: result.user.uid,
          id: result.user.uid,
          created_time: serverTimestamp(),
          phone_number: result.user.phoneNumber || "-",
          location: "",
          active: true,
          updated: serverTimestamp(),
          gender: "Not specified",
          photo_url: result.user.photoURL || "",
          first_name: firstName,
          middle_name: "-",
          last_name: lastName,
          onboarding: false,
          followers: 0,
          rating: 0.0,
          created: serverTimestamp(),
          banner: "",
          active_date: serverTimestamp(),
          role: ["user"],
          type: "OHADMIN",
          tenantId: tenantId,
        }

        await setDoc(docRef, userData)
      }
    }
  }

  const logout = async () => {
    await signOut(auth)
  }

  const updateUserProfile = async (displayName: string) => {
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName })
      setUser({ ...auth.currentUser })

      // Also update in Firestore
      if (userData) {
        const userRef = doc(db, "iboard_users", auth.currentUser.uid)
        await setDoc(
          userRef,
          {
            display_name: displayName,
            updated: serverTimestamp(),
          },
          { merge: true },
        )

        // Update local userData
        setUserData({
          ...userData,
          display_name: displayName,
        })
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        logout,
        updateUserProfile,
        refreshUserData,
        tenantId,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
