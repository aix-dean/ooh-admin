"use client"

import type React from "react"

import { useState, useEffect, createContext, useContext } from "react"
import { useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { DashboardHeader } from "@/components/dashboard-header"
import { DashboardSidebar } from "@/components/dashboard-sidebar"
import { SidebarBackdrop } from "@/components/sidebar-backdrop"
import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"
import { useSidebarState } from "@/hooks/use-sidebar-state"

// Create a context for sidebar state
type SidebarContextType = {
  isVisible: boolean
  toggleSidebar: () => void
  setSidebarVisible: (visible: boolean) => void
  isProfilePage: boolean
  isMobile: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

// Hook to use sidebar context
export function useSidebar() {
  const context = useContext(SidebarContext)
  if (context === undefined) {
    throw new Error("useSidebar must be used within a DashboardLayout")
  }
  return context
}

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [isMobile, setIsMobile] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [previousPathname, setPreviousPathname] = useState("")

  // Check if we're on the profile page
  const isProfilePage = pathname === "/dashboard/profile"

  // Use our custom hook with a default value of visible
  // This will be overridden by the stored value if it exists
  const { isVisible, toggleVisibility, setSidebarVisible } = useSidebarState(true)

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Track pathname changes but don't automatically close the sidebar
  useEffect(() => {
    // Only close sidebar on major navigation changes (not within same section)
    // This allows users to navigate within sections without the sidebar closing
    const currentMainPath = pathname.split("/").slice(0, 3).join("/")
    const previousMainPath = previousPathname.split("/").slice(0, 3).join("/")

    // Only close sidebar if navigating to a completely different section
    if (previousPathname && currentMainPath !== previousMainPath) {
      setMobileMenuOpen(false)
    }

    setPreviousPathname(pathname)
  }, [pathname, previousPathname])

  // Check if mobile and adjust sidebar accordingly
  useEffect(() => {
    const checkMobile = () => {
      const isMobileView = window.innerWidth < 1024
      setIsMobile(isMobileView)
    }

    // Initial check
    checkMobile()

    // Add event listener
    window.addEventListener("resize", checkMobile)

    // Cleanup
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen) // Toggle mobile menu slide-out
    } else if (!isProfilePage) {
      toggleVisibility() // Toggle sidebar visibility only if not on profile page
    }
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Don't render anything if not authenticated (will redirect)
  if (!user) {
    return null
  }

  // Create the context value
  const sidebarContextValue: SidebarContextType = {
    isVisible: isProfilePage ? false : isVisible,
    toggleSidebar,
    setSidebarVisible,
    isProfilePage,
    isMobile,
  }

  // Determine if sidebar should be shown
  const showSidebar = !isProfilePage && (isMobile ? mobileMenuOpen : isVisible)

  return (
    <SidebarContext.Provider value={sidebarContextValue}>
      <div className="flex h-screen flex-col bg-gray-100">
        <DashboardHeader
          toggleSidebar={toggleSidebar}
          sidebarVisible={!isProfilePage && isVisible}
          isProfilePage={isProfilePage}
        />
        <div className="flex flex-1 overflow-hidden">
          {/* Backdrop for mobile */}
          {isMobile && <SidebarBackdrop isOpen={mobileMenuOpen} onClick={() => setMobileMenuOpen(false)} />}

          {/* Sidebar - always render but use CSS transform to show/hide */}
          <DashboardSidebar
            isOpen={showSidebar}
            isIconOnly={!isMobile && !isVisible}
            isMobile={isMobile}
            closeMobileMenu={() => setMobileMenuOpen(false)}
          />

          <main
            className={cn(
              "flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 transition-all duration-300 ease-in-out scrollbar-hide",
              !isMobile && isVisible && !isProfilePage ? "lg:ml-64" : "lg:ml-0",
            )}
          >
            {children}
          </main>
        </div>
      </div>
    </SidebarContext.Provider>
  )
}
