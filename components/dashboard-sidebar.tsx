"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, BarChart2, FileText, ChevronUp, ChevronDown, X, Folders, Package, Plane, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Logo } from "./logo"

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  isActive?: boolean
  isIconOnly?: boolean
  onClick?: () => void
  hasSubmenu?: boolean
  expanded?: boolean
}

function NavItem({ href, icon, label, isActive, isIconOnly, onClick, hasSubmenu, expanded }: NavItemProps) {
  const content = (
    <>
      <div className="flex items-center">
        <span className={cn("flex items-center justify-center", isIconOnly ? "w-5 h-5" : "mr-3 w-5 h-5")}>{icon}</span>
        {!isIconOnly && <span className="truncate">{label === "Product Controls" ? "Database Controls" : label}</span>}
      </div>
      {hasSubmenu &&
        !isIconOnly &&
        (expanded ? <ChevronUp className="ml-auto h-4 w-4" /> : <ChevronDown className="ml-auto h-4 w-4" />)}
    </>
  )

  const className = cn(
    "flex h-11 items-center text-sm font-medium transition-all duration-200 rounded-lg group relative",
    isActive
      ? "bg-gradient-to-r from-[#23295A] to-[#1A237E] text-white shadow-md"
      : "text-[#23295A] hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 hover:shadow-sm",
    isIconOnly && "justify-center px-3 mx-2",
    hasSubmenu ? "justify-between px-4 mx-2" : "px-4 mx-2",
  )

  // For collapsible menu items, use a button
  if (hasSubmenu) {
    return (
      <button
        type="button"
        className={className}
        onClick={(e) => {
          e.preventDefault()
          if (onClick) onClick()
        }}
        title={isIconOnly ? label : undefined}
      >
        {content}
      </button>
    )
  }

  // For regular menu items, use a Link
  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      title={isIconOnly ? label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      {content}
    </Link>
  )
}

interface SubNavItemProps {
  href: string
  label: string
  isActive?: boolean
  isIconOnly?: boolean
  onClick?: () => void
}

function SubNavItem({ href, label, isActive, isIconOnly, onClick }: SubNavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex h-10 items-center pl-12 pr-4 mx-2 text-sm transition-all duration-200 rounded-lg relative group",
        "before:absolute before:left-6 before:top-1/2 before:-translate-y-1/2 before:w-2 before:h-2 before:rounded-full before:transition-all before:duration-200",
        isActive
          ? "font-medium text-[#23295A] bg-gradient-to-r from-blue-50 to-indigo-50 before:bg-[#23295A] shadow-sm"
          : "text-[#6B7280] hover:text-[#23295A] hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 before:bg-gray-300 hover:before:bg-[#23295A]",
        isIconOnly && "justify-center px-0 pl-0 mx-2",
      )}
      onClick={onClick}
      title={isIconOnly ? label : undefined}
      aria-current={isActive ? "page" : undefined}
    >
      {!isIconOnly && <span className="truncate">{label}</span>}
    </Link>
  )
}

interface DashboardSidebarProps {
  isOpen: boolean
  isIconOnly: boolean
  isMobile: boolean
  closeMobileMenu: () => void
}

export function DashboardSidebar({ isOpen, isIconOnly, isMobile, closeMobileMenu }: DashboardSidebarProps) {
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLDivElement>(null)
  // Add state for admin menu in expandedMenus
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    contentManagement: true, // Default to expanded
    immigration: false, // Default to collapsed
    admin: false, // Add admin menu state
  })

  const toggleMenu = (menu: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }))
  }

  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isMobile && isOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        closeMobileMenu()
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isMobile, isOpen, closeMobileMenu])

  // Check if current path is within content management
  const isContentActive = pathname.startsWith("/dashboard/content")
  const is4PsActive = pathname === "/dashboard/content/4ps" || pathname.startsWith("/dashboard/content/4ps?")
  const isNewsTickerActive = pathname === "/dashboard/content/newsticker"
  const isAPVActive = pathname === "/dashboard/content/apv"

  // Check if current path is within immigration
  const isImmigrationActive =
    (pathname.startsWith("/dashboard/immigration") || pathname.startsWith("/dashboard/members")) &&
    !pathname.startsWith("/dashboard/admin")
  const isBookingActive =
    pathname === "/dashboard/immigration/booking" || pathname.startsWith("/dashboard/immigration/booking/")
  const isQuotationsActive =
    pathname === "/dashboard/immigration/quotations" || pathname.startsWith("/dashboard/immigration/quotations/")
  const isImmigrationProductsActive =
    pathname === "/dashboard/immigration/products" || pathname.startsWith("/dashboard/immigration/products/")
  const isImmigrationMembersActive = pathname === "/dashboard/members" || pathname.startsWith("/dashboard/members/")

  // Add admin active state checks after immigration checks
  const isAdminActive = pathname.startsWith("/dashboard/admin")
  const isAdminBookingActive =
    pathname === "/dashboard/admin/booking" || pathname.startsWith("/dashboard/admin/booking/")
  const isAdminQuotationsActive =
    pathname === "/dashboard/admin/quotations" || pathname.startsWith("/dashboard/admin/quotations/")
  const isAdminProductsActive =
    pathname === "/dashboard/admin/products" || pathname.startsWith("/dashboard/admin/products/")

  // Ensure content management is expanded if any of its subitems are active
  useEffect(() => {
    if (is4PsActive || isNewsTickerActive || isAPVActive) {
      setExpandedMenus((prev) => ({
        ...prev,
        contentManagement: true,
      }))
    }

    // Ensure immigration is expanded if any of its subitems are active
    if (isBookingActive || isQuotationsActive || isImmigrationProductsActive || isImmigrationMembersActive) {
      setExpandedMenus((prev) => ({
        ...prev,
        immigration: true,
      }))
    }

    // Ensure admin is expanded if any of its subitems are active
    if (isAdminBookingActive || isAdminQuotationsActive || isAdminProductsActive) {
      setExpandedMenus((prev) => ({
        ...prev,
        admin: true,
      }))
    }
  }, [
    pathname,
    is4PsActive,
    isNewsTickerActive,
    isAPVActive,
    isBookingActive,
    isQuotationsActive,
    isImmigrationProductsActive,
    isImmigrationMembersActive,
    isAdminBookingActive,
    isAdminQuotationsActive,
    isAdminProductsActive,
  ])

  return (
    <div
      ref={sidebarRef}
      className={cn(
        "fixed inset-y-0 left-0 z-20 flex flex-col bg-white shadow-lg transition-all duration-300 ease-in-out",
        isMobile ? "w-[85%] sm:w-64" : isIconOnly ? "w-20" : "w-64",
        isMobile && "top-0",
        // Transform for smooth transitions
        isOpen ? "translate-x-0" : "-translate-x-full",
        // Special case for desktop icon-only mode
        !isMobile && isIconOnly && isOpen && "translate-x-0 w-20",
      )}
      aria-hidden={!isOpen}
    >
      {/* Header with logo */}
      <div className="flex h-16 items-center justify-between border-b bg-[#23295A] px-4">
        {!isIconOnly || isMobile ? (
          <Logo className="text-white" showText={true} />
        ) : (
          <Logo className="text-white mx-auto" showText={false} />
        )}
        {isMobile && (
          <Button variant="ghost" size="icon" onClick={closeMobileMenu} className="text-white hover:bg-[#1A237E]/20">
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-2">
        <nav className="space-y-2">
          {/* Home Navigation Item */}
          <NavItem
            href="/dashboard"
            icon={<Home className="h-5 w-5" />}
            label="Home"
            isActive={pathname === "/dashboard"}
            isIconOnly={isIconOnly}
            onClick={undefined} // Removed closeMobileMenu to keep sidebar open
          />

          {/* OH! Monitoring Navigation Item */}
          <NavItem
            href="/dashboard/monitoring"
            icon={<BarChart2 className="h-5 w-5" />}
            label="OH! Monitoring"
            isActive={pathname === "/dashboard/monitoring" || pathname.startsWith("/dashboard/monitoring/")}
            isIconOnly={isIconOnly}
            onClick={undefined} // Removed closeMobileMenu to keep sidebar open
          />

          {/* Content Management Navigation Item with Submenu */}
          <div>
            <NavItem
              href="/dashboard/content"
              icon={<FileText className="h-5 w-5" />}
              label="Content Management"
              isActive={isContentActive}
              isIconOnly={isIconOnly}
              hasSubmenu={true}
              expanded={expandedMenus.contentManagement}
              onClick={() => {
                toggleMenu("contentManagement")
                // Removed closeMobileMenu to keep sidebar open when toggling submenu
              }}
            />

            {/* Submenu items - only show when not in icon-only mode or when expanded in icon-only mode */}
            {expandedMenus.contentManagement && !isIconOnly && (
              <div className="mt-1 space-y-1">
                <SubNavItem
                  href="/dashboard/content/4ps"
                  label="4Ps"
                  isActive={is4PsActive}
                  onClick={undefined} // Removed closeMobileMenu to keep sidebar open
                />
                <SubNavItem
                  href="/dashboard/content/newsticker"
                  label="News Ticker"
                  isActive={isNewsTickerActive}
                  onClick={undefined} // Removed closeMobileMenu to keep sidebar open
                />
                <SubNavItem
                  href="/dashboard/content/apv"
                  label="APV"
                  isActive={isAPVActive}
                  onClick={undefined} // Removed closeMobileMenu to keep sidebar open
                />
              </div>
            )}
          </div>
          {/* Immigration Navigation Item with Submenu */}
          <div>
            <NavItem
              href="/dashboard/immigration"
              icon={<Plane className="h-5 w-5" />}
              label="Immigration"
              isActive={isImmigrationActive}
              isIconOnly={isIconOnly}
              hasSubmenu={true}
              expanded={expandedMenus.immigration}
              onClick={() => {
                toggleMenu("immigration")
              }}
            />

            {/* Submenu items - only show when not in icon-only mode or when expanded in icon-only mode */}
            {expandedMenus.immigration && !isIconOnly && (
              <div className="mt-1 space-y-1">
                {/* Hide Booking, Quotations, and Products - they are now under Admin */}
                {false && (
                  <>
                    <SubNavItem
                      href="/dashboard/immigration/booking"
                      label="Booking"
                      isActive={isBookingActive}
                      onClick={undefined}
                    />
                    <SubNavItem
                      href="/dashboard/immigration/quotations"
                      label="Quotations"
                      isActive={isQuotationsActive}
                      onClick={undefined}
                    />
                    <SubNavItem
                      href="/dashboard/immigration/products"
                      label="Products"
                      isActive={isImmigrationProductsActive}
                      onClick={undefined}
                    />
                  </>
                )}
                <SubNavItem
                  href="/dashboard/members"
                  label="Members"
                  isActive={isImmigrationMembersActive}
                  onClick={undefined}
                />
              </div>
            )}
          </div>
          {/* Admin Navigation Item with Submenu */}
          <div>
            <NavItem
              href="/dashboard/admin"
              icon={<Settings className="h-5 w-5" />}
              label="Admin"
              isActive={isAdminActive}
              isIconOnly={isIconOnly}
              hasSubmenu={true}
              expanded={expandedMenus.admin}
              onClick={() => {
                toggleMenu("admin")
              }}
            />

            {/* Submenu items - only show when not in icon-only mode or when expanded in icon-only mode */}
            {expandedMenus.admin && !isIconOnly && (
              <div className="mt-1 space-y-1">
                <SubNavItem
                  href="/dashboard/admin/booking"
                  label="Booking"
                  isActive={isAdminBookingActive}
                  onClick={undefined}
                />
                <SubNavItem
                  href="/dashboard/admin/quotations"
                  label="Quotations"
                  isActive={isAdminQuotationsActive}
                  onClick={undefined}
                />
                <SubNavItem
                  href="/dashboard/admin/products"
                  label="Products"
                  isActive={isAdminProductsActive}
                  onClick={undefined}
                />
              </div>
            )}
          </div>
          {/* Categories Management Navigation Item */}
          <NavItem
            href="/dashboard/categories"
            icon={<Folders className="h-5 w-5" />}
            label="Categories Management"
            isActive={pathname === "/dashboard/categories" || pathname.startsWith("/dashboard/categories/")}
            isIconOnly={isIconOnly}
            onClick={undefined}
          />
          {/* Product Controls Navigation Item - Hidden */}
          {false && (
            <NavItem
              href="/dashboard/products"
              icon={<Package className="h-5 w-5" />}
              label="Product Controls"
              isActive={pathname === "/dashboard/products" || pathname.startsWith("/dashboard/products/")}
              isIconOnly={isIconOnly}
              onClick={undefined}
            />
          )}

          {/* Members Navigation Item - Hidden */}
          {/* 
<NavItem
  href="/dashboard/members"
  icon={<Users className="h-5 w-5" />}
  label="Members"
  isActive={pathname === "/dashboard/members" || pathname.startsWith("/dashboard/members/")}
  isIconOnly={isIconOnly}
  onClick={undefined}
/>
*/}
        </nav>
      </div>
    </div>
  )
}
