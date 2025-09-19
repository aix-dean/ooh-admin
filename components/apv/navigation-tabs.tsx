"use client"

import type React from "react"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Map,
  Video,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  X,
  List,
  LayoutGrid,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useSafeEvent } from "@/hooks/use-safe-event"

interface NavigationTabsProps {
  activeTab: string
  onTabChange: (value: string) => void
  itemCount: {
    apv: number
    greenview: number
  }
  onSearch: (query: string) => void
  onFilterChange: (filters: any) => void
  onSortChange: (sort: string, direction: "asc" | "desc") => void
  searchQuery: string
  categoryName: string
  onViewModeChange: (mode: "list" | "grid") => void
  viewMode: "list" | "grid"
}

export function NavigationTabs({
  activeTab,
  onTabChange,
  itemCount,
  onSearch,
  onFilterChange,
  onSortChange,
  searchQuery,
  categoryName,
  onViewModeChange,
  viewMode,
}: NavigationTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [currentSort, setCurrentSort] = useState<string>("position")

  const handleSortChange = (field: string) => {
    // If clicking the same field, toggle direction
    const newDirection = field === currentSort && sortDirection === "asc" ? "desc" : "asc"
    setCurrentSort(field)
    setSortDirection(newDirection)
    onSortChange(field, newDirection)
  }

  const handleBackToCategories = () => {
    router.push("/dashboard/content/apv")
  }

  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  const handleSearchChange = useSafeEvent(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearch(e.target.value)
    },
    [onSearch],
  )

  const clearSearch = () => {
    onSearch("")
  }

  const handleTabChange = useSafeEvent(
    (value: string) => {
      onTabChange(value)
    },
    [onTabChange],
  )

  return (
    <div className="space-y-4">
      {/* Mobile navigation bar */}
      <div className="flex items-center justify-between lg:hidden bg-white p-2 rounded-md shadow-sm">
        <Button variant="ghost" size="sm" onClick={handleBackToCategories}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h2 className="text-sm font-medium truncate max-w-[150px]">{categoryName}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <List className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Navigation</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleBackToDashboard}>
              <Home className="h-4 w-4 mr-2" />
              Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBackToCategories}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              All Categories
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>View</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleTabChange("apv")}>
              <Video className="h-4 w-4 mr-2" />
              APV Videos ({itemCount.apv})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleTabChange("greenview")}>
              <Map className="h-4 w-4 mr-2" />
              Green View Tours ({itemCount.greenview})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop navigation */}
      <div className="hidden lg:flex items-center space-x-2 text-sm text-muted-foreground">
        <Button variant="ghost" size="sm" onClick={handleBackToDashboard} className="h-8">
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
        <ChevronRight className="h-4 w-4" />
        <Button variant="ghost" size="sm" onClick={handleBackToCategories} className="h-8">
          <List className="h-4 w-4 mr-1" />
          APV Categories
        </Button>
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">{categoryName}</span>
      </div>

      {/* Tabs and filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="apv" className="relative">
              APV Videos
              <Badge variant="secondary" className="ml-1 absolute -top-2 -right-2 text-xs">
                {itemCount.apv}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="greenview" className="relative">
              Green View Tours
              <Badge variant="secondary" className="ml-1 absolute -top-2 -right-2 text-xs">
                {itemCount.greenview}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="pl-8 h-9 w-full sm:w-[200px] lg:w-[250px]"
              value={searchQuery}
              onChange={handleSearchChange}
            />
            {searchQuery && (
              <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={clearSearch}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                {sortDirection === "asc" ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
                Sort
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => handleSortChange("position")}>
                  {currentSort === "position" && <span className="mr-2">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  Position
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange("road")}>
                  {currentSort === "road" && <span className="mr-2">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  Road Name
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange("created")}>
                  {currentSort === "created" && <span className="mr-2">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  Date Created
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSortChange("updated")}>
                  {currentSort === "updated" && <span className="mr-2">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                  Last Updated
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Filter dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Filter className="h-4 w-4 mr-2" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => onFilterChange({ status: "all" })}>All</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange({ status: "active" })}>Active</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange({ status: "inactive" })}>Inactive</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onFilterChange({ hasVideo: true })}>Has Video</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange({ hasTour: true })}>Has Tour</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onFilterChange({ hasEpisodes: true })}>Has Episodes</DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View mode toggle */}
          <div className="flex items-center border rounded-md">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              className="h-9 rounded-r-none"
              onClick={() => onViewModeChange("list")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="h-9 rounded-l-none"
              onClick={() => onViewModeChange("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
