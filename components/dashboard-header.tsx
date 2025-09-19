"use client"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"

import Link from "next/link"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { Bell, MessageSquare, User, LogOut, PanelLeft, PanelRight, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/contexts/auth-context"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface DashboardHeaderProps {
  toggleSidebar: () => void
  sidebarVisible: boolean
  isProfilePage?: boolean
}

export function DashboardHeader({ toggleSidebar, sidebarVisible, isProfilePage = false }: DashboardHeaderProps) {
  const { user, userData, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await logout()
      router.push("/login")
    } catch (error) {
      console.error("Failed to log out", error)
    }
  }

  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  // Use userData if available, otherwise fall back to user
  const displayName = userData?.display_name || user?.displayName || user?.email?.split("@")[0] || "User"
  const photoUrl = userData?.photo_url || user?.photoURL || ""
  const email = userData?.email || user?.email || ""

  // Get user initials for avatar fallback
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)

  // Check if we're on the profile page
  const isOnProfilePage = pathname === "/dashboard/profile"

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b bg-[#23295A] px-2 sm:px-4 text-white">
      <div className="flex items-center">
        {/* Only show the back button if not on profile page */}
        {!isOnProfilePage && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="mr-1 sm:mr-2 text-white hover:bg-[#1A237E]/20"
                  title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                  aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
                >
                  {/* Use Menu icon on mobile, PanelLeft/Right on desktop */}
                  <span className="block sm:hidden">
                    <Menu className="h-5 w-5" />
                  </span>
                  <span className="hidden sm:block">
                    {sidebarVisible ? <PanelLeft className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
                  </span>
                  <span className="sr-only">{sidebarVisible ? "Hide sidebar" : "Show sidebar"}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{sidebarVisible ? "Hide sidebar" : "Show sidebar"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Link href="/dashboard" className="flex items-center">
          <div className="relative h-10 w-10 mr-2 sm:h-14 sm:w-14 sm:mr-4 min-w-[80px] min-h-[40px] sm:min-w-[120px] sm:min-h-[120px]">
            <Image src="/images/navigation-logo.png" alt="OH! Shop Logo" fill className="object-contain" />
          </div>
        </Link>
      </div>

      <div className="flex items-center space-x-1 sm:space-x-2">
        <Button variant="ghost" size="icon" className="relative text-white hover:bg-[#1A237E]/20">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px]">
            3
          </span>
          <span className="sr-only">Notifications</span>
        </Button>

        <Button variant="ghost" size="icon" className="relative text-white hover:bg-[#1A237E]/20 hidden sm:flex">
          <MessageSquare className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px]">
            5
          </span>
          <span className="sr-only">Messages</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-8 w-8 border border-white/20">
                <AvatarImage src={photoUrl || "/placeholder.svg?height=32&width=32"} alt={displayName} />
                <AvatarFallback className="bg-[#1A237E] text-white">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </DropdownMenuLabel>
            {userData && (
              <>
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  Type: {userData.type}
                </DropdownMenuLabel>
                {userData.role && userData.role.length > 0 && (
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Roles: {userData.role.join(", ")}
                  </DropdownMenuLabel>
                )}
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/profile" className="flex cursor-pointer items-center">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="flex cursor-pointer items-center">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
