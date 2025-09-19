"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  Building2,
  Package,
  Calendar,
  FileText,
  Users,
  MessageSquare,
  BarChart3,
  History,
  Home,
  Code,
} from "lucide-react"

const navigationItems = [
  {
    title: "Dashboard",
    href: "/migration-dashboard",
    icon: Home,
    description: "Migration overview and quick actions",
  },
  {
    title: "Companies",
    href: "/migrate-companies",
    icon: Building2,
    description: "Migrate company data and associations",
  },
  {
    title: "Products",
    href: "/migrate-product-companies",
    icon: Package,
    description: "Associate products with companies",
  },
  {
    title: "Bookings",
    href: "/migrate-booking-companies",
    icon: Calendar,
    description: "Link bookings to company records",
  },
  {
    title: "Quotations",
    href: "/migrate-quotation-companies",
    icon: FileText,
    description: "Connect quotations with companies",
  },
  {
    title: "Followers",
    href: "/migrate-follower-companies",
    icon: Users,
    description: "Associate followers with companies",
  },
  {
    title: "Chats",
    href: "/migrate-chat-companies",
    icon: MessageSquare,
    description: "Link chat records to companies",
  },
  {
    title: "Site Codes",
    href: "/migrate-site-codes",
    icon: Code,
    description: "Migrate site code data",
  },
  {
    title: "Progress",
    href: "/migration-progress",
    icon: BarChart3,
    description: "View overall migration progress",
  },
  {
    title: "History",
    href: "/migration-history",
    icon: History,
    description: "View migration history and analytics",
  },
]

export function MigrationNavigation() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-40">
      <div className="container mx-auto p-6">
        <div className="flex space-x-8 overflow-x-auto">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300",
                )}
                title={item.description}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
