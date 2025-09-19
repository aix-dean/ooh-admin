"use client"

import { useState, useEffect } from "react"

// Function to check if the device is online
export const isOnline = (): boolean => {
  if (typeof navigator !== "undefined" && "onLine" in navigator) {
    return navigator.onLine
  }
  return true // Default to true if we can't determine
}

// Hook to monitor online/offline status
export const useNetworkStatus = () => {
  const [isNetworkOnline, setIsNetworkOnline] = useState(isOnline())

  useEffect(() => {
    // Set initial state
    setIsNetworkOnline(isOnline())

    const handleOnline = () => {
      console.log("Network connection restored")
      setIsNetworkOnline(true)
    }

    const handleOffline = () => {
      console.log("Network connection lost")
      setIsNetworkOnline(false)
    }

    // Add event listeners
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return isNetworkOnline
}

// Function to log network-related errors
export const logNetworkError = (error: any, operation: string): void => {
  console.error(`Network error during ${operation}:`, error)

  // Log additional details if available
  if (error.code) {
    console.error(`Error code: ${error.code}`)
  }

  if (error.message) {
    console.error(`Error message: ${error.message}`)
  }

  if (error.serverResponse) {
    console.error(`Server response:`, error.serverResponse)
  }

  // Log stack trace
  console.error(`Stack trace:`, error.stack)
}
