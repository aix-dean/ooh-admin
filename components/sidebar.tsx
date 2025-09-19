"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronDown,
  Home,
  BarChart2,
  ShoppingCart,
  Landmark,
  Users,
  FileText,
  TrendingUp,
  StampIcon as Passport,
  Calculator,
  Megaphone,
  Cloud,
  HardDrive,
  Tractor,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "./logo"

interface NavItemProps {
  href: string
  icon: React.ReactNode
  label: string
  active?: boolean
  hasSubmenu?: boolean
  expanded?: boolean
  onClick?: () => void
}

function NavItem({ href, icon, label, active, hasSubmenu, expanded, onClick }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center px-4 py-3 text-sm font-medium",
        active ? "bg-gray-200" : "hover:bg-gray-100",
        hasSubmenu && "justify-between",
      )}
      onClick={onClick}
    >
      <div className="flex items-center">
        {icon}
        <span className="ml-3">{label}</span>
      </div>
      {hasSubmenu && <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({})

  const toggleMenu = (menu: string) => {
    setExpandedMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }))
  }

  return (
    <div className="w-64 border-r bg-white">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center border-b px-4">
          <Logo />
        </div>
        <div className="flex-1 overflow-auto py-2">
          <nav className="space-y-1">
            <NavItem
              href="/dashboard"
              icon={<Home className="h-5 w-5" />}
              label="Home"
              active={pathname === "/dashboard"}
            />
            <NavItem
              href="/dashboard/monitoring"
              icon={<BarChart2 className="h-5 w-5" />}
              label="OH! Monitoring"
              active={pathname === "/dashboard/monitoring"}
            />
            <div>
              <NavItem
                href="#"
                icon={<ShoppingCart className="h-5 w-5" />}
                label="Sales"
                hasSubmenu
                expanded={expandedMenus["sales"]}
                onClick={() => toggleMenu("sales")}
              />
              {expandedMenus["sales"] && (
                <div className="ml-8 space-y-1 border-l pl-4">
                  <Link
                    href="/dashboard/sales/orders"
                    className={cn(
                      "block py-2 text-sm",
                      pathname === "/dashboard/sales/orders" ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    Orders
                  </Link>
                  <Link
                    href="/dashboard/sales/customers"
                    className={cn(
                      "block py-2 text-sm",
                      pathname === "/dashboard/sales/customers" ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    Customers
                  </Link>
                </div>
              )}
            </div>
            <NavItem
              href="/dashboard/treasury"
              icon={<Landmark className="h-5 w-5" />}
              label="Treasury"
              active={pathname === "/dashboard/treasury"}
            />
            <div>
              <NavItem
                href="#"
                icon={<Users className="h-5 w-5" />}
                label="Admin"
                hasSubmenu
                expanded={expandedMenus["admin"]}
                onClick={() => toggleMenu("admin")}
              />
              {expandedMenus["admin"] && (
                <div className="ml-8 space-y-1 border-l pl-4">
                  <Link
                    href="/dashboard/admin/users"
                    className={cn(
                      "block py-2 text-sm",
                      pathname === "/dashboard/admin/users" ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    Users
                  </Link>
                  <Link
                    href="/dashboard/admin/roles"
                    className={cn(
                      "block py-2 text-sm",
                      pathname === "/dashboard/admin/roles" ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    Roles & Permissions
                  </Link>
                </div>
              )}
            </div>
            <NavItem
              href="/dashboard/content"
              icon={<FileText className="h-5 w-5" />}
              label="Content management"
              active={pathname === "/dashboard/content"}
            />
            <NavItem
              href="/dashboard/economy"
              icon={<TrendingUp className="h-5 w-5" />}
              label="Economy"
              active={pathname === "/dashboard/economy"}
            />
            <div>
              <NavItem
                href="#"
                icon={<Passport className="h-5 w-5" />}
                label="Immigration"
                hasSubmenu
                expanded={expandedMenus["immigration"]}
                onClick={() => toggleMenu("immigration")}
              />
            </div>
            <NavItem
              href="/dashboard/accounting"
              icon={<Calculator className="h-5 w-5" />}
              label="Accounting"
              active={pathname === "/dashboard/accounting"}
            />
            <div>
              <NavItem
                href="#"
                icon={<Megaphone className="h-5 w-5" />}
                label="Marketing"
                hasSubmenu
                expanded={expandedMenus["marketing"]}
                onClick={() => toggleMenu("marketing")}
              />
            </div>
            <div>
              <NavItem
                href="#"
                icon={<Cloud className="h-5 w-5" />}
                label="SAM"
                hasSubmenu
                expanded={expandedMenus["sam"]}
                onClick={() => toggleMenu("sam")}
              />
            </div>
            <div>
              <NavItem
                href="#"
                icon={<HardDrive className="h-5 w-5" />}
                label="RAM"
                hasSubmenu
                expanded={expandedMenus["ram"]}
                onClick={() => toggleMenu("ram")}
              />
            </div>
            <div>
              <NavItem
                href="#"
                icon={<Tractor className="h-5 w-5" />}
                label="Harvester"
                hasSubmenu
                expanded={expandedMenus["harvester"]}
                onClick={() => toggleMenu("harvester")}
              />
            </div>
            <div>
              <NavItem
                href="#"
                icon={<HelpCircle className="h-5 w-5" />}
                label="Help Desk"
                hasSubmenu
                expanded={expandedMenus["help"]}
                onClick={() => toggleMenu("help")}
              />
            </div>
          </nav>
        </div>
      </div>
    </div>
  )
}
