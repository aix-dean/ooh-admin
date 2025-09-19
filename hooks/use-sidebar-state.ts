"use client"

import { useState, useEffect } from "react"

type SidebarState = {
  isVisible: boolean
  toggleVisibility: () => void
  setSidebarVisible: (visible: boolean) => void
}

export function useSidebarState(defaultVisible = true): SidebarState {
  const [isVisible, setIsVisible] = useState(defaultVisible)
  const [isInitialized, setIsInitialized] = useState(false)

  // Use a single consistent storage key for the entire dashboard
  const storageKey = "dashboard-sidebar-visible"

  // Initialize state from localStorage on component mount
  useEffect(() => {
    // Only run on client side
    if (typeof window !== "undefined") {
      const storedValue = localStorage.getItem(storageKey)

      if (storedValue !== null) {
        setIsVisible(storedValue === "true")
      } else {
        // If no stored value, use the default
        setIsVisible(defaultVisible)
      }

      setIsInitialized(true)
    }
  }, [defaultVisible])

  // Update localStorage when state changes
  useEffect(() => {
    if (isInitialized && typeof window !== "undefined") {
      localStorage.setItem(storageKey, String(isVisible))
    }
  }, [isVisible, isInitialized])

  const toggleVisibility = () => {
    setIsVisible((prev) => !prev)
  }

  const setSidebarVisible = (visible: boolean) => {
    setIsVisible(visible)
  }

  return { isVisible, toggleVisibility, setSidebarVisible }
}
