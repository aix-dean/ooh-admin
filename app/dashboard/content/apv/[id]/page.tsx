"use client"

import { useEffect, useState, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatDate } from "@/lib/date-utils"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, Plus, Edit, Trash2, Map, Play, ExternalLink, Pin } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { EpisodesDialog } from "@/components/episodes/episode-dialog"
import { ApvForm } from "@/components/apv/apv-form"
import { GreenViewForm } from "@/components/green-view/green-view-form"
import { TourPlayer } from "@/components/apv/tour-player"
import { NavigationTabs } from "@/components/apv/navigation-tabs"
import { GridView } from "@/components/apv/grid-view"
import { deleteApvVideo, getApvVideosByCategory, pinApvVideo, unpinApvVideo, pinLatestApvVideo } from "@/lib/apv"
import { deleteGreenViewVideo, getGreenViewVideosByRoad } from "@/lib/green-view"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface Episode {
  episode: number
  name: string
  start: string
  end: string
  public: boolean
}

interface APVItem {
  id: string
  active: boolean
  category_id: string
  created: any
  deleted: boolean
  dh: string
  gl: string
  episodes: Episode[]
  orientation: string
  position: number
  road: string
  timeslot_end: any
  timeslot_start: any
  type: string
  version: string
  pinned?: boolean
}

interface GreenViewItem {
  id: string
  active: boolean
  created: any
  deleted: boolean
  dh: string
  gl: string
  episodes: Episode[]
  orientation: string
  position: number
  road: string
  timeslot_end: any
  timeslot_start: any
  type: string
  updated: any
  version: string
}

interface CategoryDetails {
  id: string
  name: string
  archipelago: string
  active: boolean
  position: number
}

export default function CategoryDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const categoryId = params.id as string

  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<CategoryDetails | null>(null)
  const [apvItems, setApvItems] = useState<APVItem[]>([])
  const [greenViewItems, setGreenViewItems] = useState<GreenViewItem[]>([])
  const [activeTab, setActiveTab] = useState("apv")
  const [viewMode, setViewMode] = useState<"list" | "grid">("list")
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<any>({})
  const [sort, setSort] = useState({ field: "position", direction: "asc" as "asc" | "desc" })

  // Force re-render function
  const forceUpdate = useState({})[1]
  const forceRerender = () => forceUpdate({})

  // Episodes dialog state
  const [episodesDialogOpen, setEpisodesDialogOpen] = useState(false)
  const [selectedCollection, setSelectedCollection] = useState<string>("")
  const [selectedItemId, setSelectedItemId] = useState<string>("")
  const [selectedEpisodes, setSelectedEpisodes] = useState<Episode[]>([])

  // APV CRUD state
  const [isApvFormOpen, setIsApvFormOpen] = useState(false)
  const [selectedApvItem, setSelectedApvItem] = useState<APVItem | null>(null)
  const [isApvEditMode, setIsApvEditMode] = useState(false)
  const [isApvDeleteDialogOpen, setIsApvDeleteDialogOpen] = useState(false)

  // Green View CRUD state
  const [isGreenViewFormOpen, setIsGreenViewFormOpen] = useState(false)
  const [selectedGreenViewItem, setSelectedGreenViewItem] = useState<GreenViewItem | null>(null)
  const [isGreenViewEditMode, setIsGreenViewEditMode] = useState(false)
  const [isGreenViewDeleteDialogOpen, setIsGreenViewDeleteDialogOpen] = useState(false)

  // Tour player state
  const [isTourPlayerOpen, setIsTourPlayerOpen] = useState(false)
  const [selectedVideoLink, setSelectedVideoLink] = useState<string | null>(null)
  const [selectedTourTitle, setSelectedTourTitle] = useState<string>("")

  useEffect(() => {
    if (categoryId) {
      fetchCategoryDetails()
    }
  }, [categoryId])

  // Reset dialog states when component unmounts
  useEffect(() => {
    return () => {
      setEpisodesDialogOpen(false)
      setIsApvFormOpen(false)
      setIsGreenViewFormOpen(false)
      setIsApvDeleteDialogOpen(false)
      setIsGreenViewDeleteDialogOpen(false)
      setIsTourPlayerOpen(false)
      setSelectedVideoLink(null)
      setSelectedTourTitle("")
    }
  }, [])

  const fetchCategoryDetails = async () => {
    try {
      setLoading(true)

      // Fetch the category details
      const categoryRef = doc(db, "green_view_categories", categoryId)
      const categorySnap = await getDoc(categoryRef)

      if (!categorySnap.exists()) {
        toast({
          title: "Error",
          description: "Category not found",
          variant: "destructive",
        })
        router.push("/dashboard/content/apv")
        return
      }

      const categoryData = {
        id: categorySnap.id,
        ...categorySnap.data(),
      } as CategoryDetails

      setCategory(categoryData)

      // Fetch APV items with matching category_id
      const apvData = await getApvVideosByCategory(categoryId)
      setApvItems(apvData)

      // Fetch Green View items with matching road name
      if (categoryData.name) {
        const greenViewData = await getGreenViewVideosByRoad(categoryData.name)
        setGreenViewItems(greenViewData)
      }
    } catch (error) {
      console.error("Error fetching data:", error)
      toast({
        title: "Error",
        description: "Failed to load category details",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort the items based on current filters, search, and sort settings
  const filteredApvItems = useMemo(() => {
    let result = [...apvItems]

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.road.toLowerCase().includes(query) ||
          item.version?.toLowerCase().includes(query) ||
          item.orientation?.toLowerCase().includes(query),
      )
    }

    // Apply filters
    if (filters.status === "active") {
      result = result.filter((item) => item.active)
    } else if (filters.status === "inactive") {
      result = result.filter((item) => !item.active)
    }

    if (filters.hasVideo) {
      result = result.filter((item) => item.dh)
    }

    if (filters.hasTour) {
      result = result.filter((item) => item.gl)
    }

    if (filters.hasEpisodes) {
      result = result.filter((item) => Array.isArray(item.episodes) && item.episodes.length > 0)
    }

    // Apply sort
    result.sort((a, b) => {
      let valueA, valueB

      switch (sort.field) {
        case "road":
          valueA = a.road.toLowerCase()
          valueB = b.road.toLowerCase()
          break
        case "created":
          valueA = a.created?.toDate?.() || a.created || 0
          valueB = b.created?.toDate?.() || b.created || 0
          break
        case "updated":
          valueA = a.updated?.toDate?.() || a.created?.toDate?.() || a.updated || a.created || 0
          valueB = b.updated?.toDate?.() || b.created?.toDate?.() || b.updated || b.created || 0
          break
        case "position":
        default:
          valueA = a.position
          valueB = b.position
      }

      if (sort.direction === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })

    return result
  }, [apvItems, searchQuery, filters, sort])

  // Filter and sort the Green View items
  const filteredGreenViewItems = useMemo(() => {
    let result = [...greenViewItems]

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (item) =>
          item.road.toLowerCase().includes(query) ||
          item.version?.toLowerCase().includes(query) ||
          item.orientation?.toLowerCase().includes(query),
      )
    }

    // Apply filters
    if (filters.status === "active") {
      result = result.filter((item) => item.active)
    } else if (filters.status === "inactive") {
      result = result.filter((item) => !item.active)
    }

    if (filters.hasVideo) {
      result = result.filter((item) => item.dh)
    }

    if (filters.hasTour) {
      result = result.filter((item) => item.gl)
    }

    if (filters.hasEpisodes) {
      result = result.filter((item) => Array.isArray(item.episodes) && item.episodes.length > 0)
    }

    // Apply sort
    result.sort((a, b) => {
      let valueA, valueB

      switch (sort.field) {
        case "road":
          valueA = a.road.toLowerCase()
          valueB = b.road.toLowerCase()
          break
        case "created":
          valueA = a.created?.toDate?.() || a.created || 0
          valueB = b.created?.toDate?.() || b.created || 0
          break
        case "updated":
          valueA = a.updated?.toDate?.() || a.created?.toDate?.() || a.updated || a.created || 0
          valueB = b.updated?.toDate?.() || b.created?.toDate?.() || b.updated || b.created || 0
          break
        case "position":
        default:
          valueA = a.position
          valueB = b.position
      }

      if (sort.direction === "asc") {
        return valueA > valueB ? 1 : -1
      } else {
        return valueA < valueB ? 1 : -1
      }
    })

    return result
  }, [greenViewItems, searchQuery, filters, sort])

  const handleBackClick = () => {
    router.push("/dashboard/content/apv")
  }

  const handlePlayVideo = (item: APVItem | GreenViewItem) => {
    if (!item.dh) {
      toast({
        title: "Error",
        description: "No video link available for this item",
        variant: "destructive",
      })
      return
    }

    // Reset state before opening
    setSelectedVideoLink(null)
    setSelectedTourTitle("")

    // Small timeout to ensure clean state
    setTimeout(() => {
      setSelectedVideoLink(item.dh)
      setSelectedTourTitle(`${item.road} - ${item.version || ""}`)
      setIsTourPlayerOpen(true)
    }, 50)
  }

  const renderTourOptions = (item: APVItem | GreenViewItem) => {
    if (!item.gl && !item.dh) return "No tour available"

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            <Map className="h-4 w-4 mr-2" />
            View Tour
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.gl && (
            <DropdownMenuItem asChild>
              <a href={item.gl} target="_blank" rel="noopener noreferrer" className="flex items-center cursor-pointer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open in new tab
              </a>
            </DropdownMenuItem>
          )}
          {item.dh && (
            <DropdownMenuItem onClick={() => handlePlayVideo(item)} className="flex items-center cursor-pointer">
              <Play className="h-4 w-4 mr-2" />
              Play in viewer
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  const handleEpisodesClick = (collection: string, itemId: string, episodes: Episode[]) => {
    // First close any open dialog to ensure clean state
    setEpisodesDialogOpen(false)

    // Small timeout to ensure the previous dialog is fully closed
    setTimeout(() => {
      setSelectedCollection(collection)
      setSelectedItemId(itemId)
      setSelectedEpisodes(Array.isArray(episodes) ? episodes : [])
      setEpisodesDialogOpen(true)
      // Force re-render to ensure all event handlers are properly attached
      forceRerender()
    }, 50)
  }

  // APV CRUD handlers
  const handleOpenApvForm = () => {
    setIsApvFormOpen(false)
    setTimeout(() => {
      setSelectedApvItem(null)
      setIsApvEditMode(false)
      setIsApvFormOpen(true)
      forceRerender()
    }, 50)
  }

  const handleEditApvVideo = (item: APVItem) => {
    setSelectedApvItem(item)
    setIsApvEditMode(true)
    setIsApvFormOpen(true)
  }

  const handleDeleteApvVideo = (item: APVItem) => {
    setSelectedApvItem(item)
    setIsApvDeleteDialogOpen(true)
  }

  const handleTogglePinApvVideo = async (item: APVItem) => {
    try {
      setLoading(true)
      if (item.pinned) {
        await unpinApvVideo(item.id)
        toast({
          title: "Success",
          description: "Video unpinned successfully",
        })
      } else {
        await pinApvVideo(item.id)
        toast({
          title: "Success",
          description: "Video pinned successfully",
        })
      }
      await fetchCategoryDetails()
    } catch (error) {
      console.error("Error toggling pin status:", error)
      toast({
        title: "Error",
        description: "Failed to update pin status",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handlePinLatestApvVideo = async () => {
    try {
      setLoading(true)
      const pinnedId = await pinLatestApvVideo(categoryId)

      if (pinnedId) {
        toast({
          title: "Success",
          description: "Latest video pinned successfully",
        })
      } else {
        toast({
          title: "Info",
          description: "No active videos found to pin",
        })
      }

      await fetchCategoryDetails()
    } catch (error) {
      console.error("Error pinning latest video:", error)
      toast({
        title: "Error",
        description: "Failed to pin latest video",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const confirmDeleteApvVideo = async () => {
    if (selectedApvItem) {
      try {
        await deleteApvVideo(selectedApvItem.id)
        toast({
          title: "Success",
          description: "APV video deleted successfully",
        })
        await fetchCategoryDetails()
      } catch (error) {
        console.error("Error deleting APV video:", error)
        toast({
          title: "Error",
          description: "Failed to delete APV video",
          variant: "destructive",
        })
      } finally {
        setIsApvDeleteDialogOpen(false)
        setSelectedApvItem(null)
      }
    }
  }

  const handleApvFormSuccess = async () => {
    setIsApvFormOpen(false)
    setSelectedApvItem(null)
    await fetchCategoryDetails()
  }

  const handleApvFormCancel = () => {
    setIsApvFormOpen(false)
    setSelectedApvItem(null)
  }

  // Green View CRUD handlers
  const handleOpenGreenViewForm = () => {
    setSelectedGreenViewItem(null)
    setIsGreenViewEditMode(false)
    setIsGreenViewFormOpen(true)
  }

  const handleEditGreenViewVideo = (item: GreenViewItem) => {
    setSelectedGreenViewItem(item)
    setIsGreenViewEditMode(true)
    setIsGreenViewFormOpen(true)
  }

  const handleDeleteGreenViewVideo = (item: GreenViewItem) => {
    setSelectedGreenViewItem(item)
    setIsGreenViewDeleteDialogOpen(true)
  }

  const confirmDeleteGreenViewVideo = async () => {
    if (selectedGreenViewItem) {
      try {
        await deleteGreenViewVideo(selectedGreenViewItem.id)
        toast({
          title: "Success",
          description: "Green View tour deleted successfully",
        })
        await fetchCategoryDetails()
      } catch (error) {
        console.error("Error deleting Green View tour:", error)
        toast({
          title: "Error",
          description: "Failed to delete Green View tour",
          variant: "destructive",
        })
      } finally {
        setIsGreenViewDeleteDialogOpen(false)
        setSelectedGreenViewItem(null)
      }
    }
  }

  const handleGreenViewFormSuccess = async () => {
    setIsGreenViewFormOpen(false)
    setSelectedGreenViewItem(null)
    await fetchCategoryDetails()
  }

  const handleGreenViewFormCancel = () => {
    setIsGreenViewFormOpen(false)
    setSelectedGreenViewItem(null)
  }

  // Handle search, filter, and sort changes
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  const handleFilterChange = (newFilters: any) => {
    setFilters(newFilters)
  }

  const handleSortChange = (field: string, direction: "asc" | "desc") => {
    setSort({ field, direction })
  }

  const handleTourPlayerClose = (open: boolean) => {
    if (!open) {
      // When closing, reset state after a short delay
      setTimeout(() => {
        setSelectedVideoLink(null)
        setSelectedTourTitle("")
      }, 300)
    }
    setIsTourPlayerOpen(open)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{category?.name}</h1>
            <p className="text-muted-foreground">
              {category?.archipelago} • Position: {category?.position} • Status:{" "}
              {category?.active ? "Active" : "Inactive"}
            </p>
          </div>
          <Button variant="outline" onClick={handleBackClick} className="hidden sm:flex">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Categories
          </Button>
        </div>
      </div>

      <NavigationTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        itemCount={{
          apv: apvItems.length,
          greenview: greenViewItems.length,
        }}
        onSearch={handleSearchChange}
        onFilterChange={handleFilterChange}
        onSortChange={handleSortChange}
        searchQuery={searchQuery}
        categoryName={category?.name || ""}
        onViewModeChange={setViewMode}
        viewMode={viewMode}
      />

      {activeTab === "apv" && filteredApvItems.some((item) => item.pinned) && (
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-3 flex items-center">
            <Pin className="h-5 w-5 mr-2 text-primary" />
            Pinned APV Video
          </h3>
          <div className="bg-muted/30 border rounded-lg p-4">
            {filteredApvItems
              .filter((item) => item.pinned)
              .map((item) => (
                <div key={item.id} className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                  <div className="flex-1">
                    <h4 className="text-xl font-semibold">{item.road}</h4>
                    <div className="text-sm text-muted-foreground mt-1">
                      <span className="inline-block mr-4">Version: {item.version || "N/A"}</span>
                      <span className="inline-block mr-4">Position: {item.position}</span>
                      <span className="inline-block">Orientation: {item.orientation || "N/A"}</span>
                    </div>
                    <div className="mt-2">
                      <Badge variant={item.active ? "default" : "outline"}>{item.active ? "Active" : "Inactive"}</Badge>
                      <Badge variant="outline" className="ml-2">
                        {Array.isArray(item.episodes) ? `${item.episodes.length} episodes` : "No episodes"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {item.dh && (
                      <Button size="sm" onClick={() => handlePlayVideo(item)}>
                        <Play className="h-4 w-4 mr-2" />
                        Play Video
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEditApvVideo(item)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleTogglePinApvVideo(item)}>
                      <Pin className="h-4 w-4 mr-2" />
                      Unpin
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="apv" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              APV Videos ({filteredApvItems.length}/{apvItems.length})
            </h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePinLatestApvVideo} disabled={loading}>
                <Pin className="h-5 w-5 mr-2" />
                Pin Latest
              </Button>
              <Button onClick={handleOpenApvForm} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-5 w-5 mr-2" />
                Add APV Video
              </Button>
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>APV Videos</CardTitle>
              {searchQuery && (
                <CardDescription>
                  Showing {filteredApvItems.length} of {apvItems.length} videos
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              {filteredApvItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery || Object.keys(filters).length > 0
                      ? "No APV videos match your search or filters"
                      : "No APV videos found for this category"}
                  </p>
                </div>
              ) : viewMode === "list" ? (
                <div className="rounded-lg border border-border/50 overflow-hidden bg-card shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b border-border/50 hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <Map className="h-4 w-4" />
                            Road
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Position</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Orientation</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Version</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Play className="h-4 w-4" />
                            Episodes
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Pin className="h-4 w-4" />
                            Pinned
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Tour</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredApvItems.map((item, index) => (
                        <TableRow
                          key={item.id}
                          className={`
                            border-b border-border/30 transition-all duration-200 
                            hover:bg-muted/20 hover:shadow-sm group
                            ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                          `}
                        >
                          <TableCell className="font-medium py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-3 h-3 rounded-full ${item.active ? "bg-green-500" : "bg-gray-400"} shadow-sm`}
                              />
                              <div>
                                <div className="font-semibold text-foreground">{item.road}</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Created: {formatDate(item.created?.toDate?.() || item.created)}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge variant="outline" className="font-mono text-xs px-2 py-1">
                              #{item.position}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex items-center justify-center">
                              <Badge variant="secondary" className="text-xs px-2 py-1">
                                {item.orientation || "N/A"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex items-center justify-center">
                              <Badge
                                variant="outline"
                                className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border-blue-200"
                              >
                                {item.version || "N/A"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEpisodesClick("apv", item.id, item.episodes)}
                              className="hover:bg-primary/10 hover:text-primary transition-colors group-hover:shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <Play className="h-3 w-3" />
                                <Badge
                                  variant="outline"
                                  className={`
                                    text-xs px-2 py-1 transition-colors
                                    ${
                                      Array.isArray(item.episodes) && item.episodes.length > 0
                                        ? "bg-green-50 text-green-700 border-green-200"
                                        : "bg-gray-50 text-gray-600 border-gray-200"
                                    }
                                  `}
                                >
                                  {Array.isArray(item.episodes) ? `${item.episodes.length} episodes` : "No episodes"}
                                </Badge>
                              </div>
                            </Button>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge
                              variant={item.deleted ? "destructive" : item.active ? "default" : "outline"}
                              className={`
                                text-xs px-3 py-1 font-medium shadow-sm
                                ${item.deleted ? "bg-red-100 text-red-800 border-red-200" : ""}
                                ${item.active && !item.deleted ? "bg-green-100 text-green-800 border-green-200" : ""}
                                ${!item.active && !item.deleted ? "bg-gray-100 text-gray-600 border-gray-200" : ""}
                              `}
                            >
                              {item.deleted ? "Deleted" : item.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTogglePinApvVideo(item)}
                              className={`
                                transition-all duration-200 hover:shadow-sm
                                ${
                                  item.pinned
                                    ? "hover:bg-primary/10 text-primary"
                                    : "hover:bg-muted text-muted-foreground"
                                }
                              `}
                            >
                              <div className="flex items-center gap-2">
                                <Pin className={`h-3 w-3 ${item.pinned ? "fill-current" : ""}`} />
                                <Badge
                                  variant={item.pinned ? "default" : "outline"}
                                  className={`
                                    text-xs px-2 py-1 transition-colors
                                    ${
                                      item.pinned
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                                    }
                                  `}
                                >
                                  {item.pinned ? "Pinned" : "Pin"}
                                </Badge>
                              </div>
                            </Button>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex justify-center">
                              {!item.gl && !item.dh ? (
                                <Badge variant="outline" className="text-xs px-2 py-1 bg-gray-50 text-gray-500">
                                  No tour
                                </Badge>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200"
                                    >
                                      <Map className="h-3 w-3 mr-1" />
                                      Tour
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center" className="w-48">
                                    {item.gl && (
                                      <DropdownMenuItem asChild>
                                        <a
                                          href={item.gl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center cursor-pointer"
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Open in new tab
                                        </a>
                                      </DropdownMenuItem>
                                    )}
                                    {item.dh && (
                                      <DropdownMenuItem
                                        onClick={() => handlePlayVideo(item)}
                                        className="flex items-center cursor-pointer"
                                      >
                                        <Play className="h-4 w-4 mr-2" />
                                        Play in viewer
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4">
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditApvVideo(item)}
                                className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                title="Edit video"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteApvVideo(item)}
                                className="h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-colors"
                                title="Delete video"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <GridView
                  items={filteredApvItems}
                  onEdit={handleEditApvVideo}
                  onDelete={handleDeleteApvVideo}
                  onPlayVideo={handlePlayVideo}
                  onManageEpisodes={(_, itemId, episodes) => handleEpisodesClick("apv", itemId, episodes)}
                  collectionName="apv"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="greenview" className="mt-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-semibold tracking-tight">
              Green View Tours ({filteredGreenViewItems.length}/{greenViewItems.length})
            </h2>
            <Button onClick={handleOpenGreenViewForm} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-5 w-5 mr-2" />
              Add Green View Tour
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Green View Tours</CardTitle>
              <CardDescription>
                {searchQuery && `Showing ${filteredGreenViewItems.length} of ${greenViewItems.length} tours`}
                {!searchQuery && `Tours from the Green View collection related to ${category?.name}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredGreenViewItems.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchQuery || Object.keys(filters).length > 0
                      ? "No Green View tours match your search or filters"
                      : "No Green View tours found for this category"}
                  </p>
                </div>
              ) : viewMode === "list" ? (
                <div className="rounded-lg border border-border/50 overflow-hidden bg-card shadow-sm">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-b border-border/50 hover:bg-transparent">
                        <TableHead className="font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <Map className="h-4 w-4" />
                            Road
                          </div>
                        </TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Created</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Updated</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Position</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Version</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                        <TableHead className="font-semibold text-foreground text-center">Tour</TableHead>
                        <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGreenViewItems.map((item, index) => (
                        <TableRow
                          key={item.id}
                          className={`
                            border-b border-border/30 transition-all duration-200 
                            hover:bg-muted/20 hover:shadow-sm group
                            ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                          `}
                        >
                          <TableCell className="font-medium py-4">
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-3 h-3 rounded-full ${item.active ? "bg-green-500" : "bg-gray-400"} shadow-sm`}
                              />
                              <div>
                                <div className="font-semibold text-foreground">{item.road}</div>
                                <div className="text-xs text-muted-foreground mt-1">ID: {item.id.slice(0, 8)}...</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="text-sm text-muted-foreground">
                              {formatDate(item.created?.toDate?.() || item.created)}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="text-sm text-muted-foreground">
                              {item.updated ? formatDate(item.updated?.toDate?.() || item.updated) : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge variant="outline" className="font-mono text-xs px-2 py-1">
                              #{item.position}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge
                              variant="outline"
                              className="text-xs px-2 py-1 bg-blue-50 text-blue-700 border-blue-200"
                            >
                              {item.version || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <Badge
                              variant={item.deleted ? "destructive" : item.active ? "default" : "outline"}
                              className={`
                                text-xs px-3 py-1 font-medium shadow-sm
                                ${item.deleted ? "bg-red-100 text-red-800 border-red-200" : ""}
                                ${item.active && !item.deleted ? "bg-green-100 text-green-800 border-green-200" : ""}
                                ${!item.active && !item.deleted ? "bg-gray-100 text-gray-600 border-gray-200" : ""}
                              `}
                            >
                              {item.deleted ? "Deleted" : item.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center py-4">
                            <div className="flex justify-center">
                              {!item.gl && !item.dh ? (
                                <Badge variant="outline" className="text-xs px-2 py-1 bg-gray-50 text-gray-500">
                                  No tour
                                </Badge>
                              ) : (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all duration-200"
                                    >
                                      <Map className="h-3 w-3 mr-1" />
                                      Tour
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="center" className="w-48">
                                    {item.gl && (
                                      <DropdownMenuItem asChild>
                                        <a
                                          href={item.gl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="flex items-center cursor-pointer"
                                        >
                                          <ExternalLink className="h-4 w-4 mr-2" />
                                          Open in new tab
                                        </a>
                                      </DropdownMenuItem>
                                    )}
                                    {item.dh && (
                                      <DropdownMenuItem
                                        onClick={() => handlePlayVideo(item)}
                                        className="flex items-center cursor-pointer"
                                      >
                                        <Play className="h-4 w-4 mr-2" />
                                        Play in viewer
                                      </DropdownMenuItem>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right py-4">
                            <div className="flex justify-end items-center gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEpisodesClick("green_view", item.id, item.episodes)}
                                className="h-8 w-8 hover:bg-green-100 hover:text-green-600 transition-colors"
                                title="Manage Episodes"
                              >
                                <Badge variant="outline" className="text-xs px-1 py-0.5">
                                  {Array.isArray(item.episodes) ? item.episodes.length : 0}
                                </Badge>
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEditGreenViewVideo(item)}
                                className="h-8 w-8 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                title="Edit tour"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteGreenViewVideo(item)}
                                className="h-8 w-8 hover:bg-red-100 hover:text-red-600 transition-colors"
                                title="Delete tour"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <GridView
                  items={filteredGreenViewItems}
                  onEdit={handleEditGreenViewVideo}
                  onDelete={handleDeleteGreenViewVideo}
                  onPlayVideo={handlePlayVideo}
                  onManageEpisodes={(_, itemId, episodes) => handleEpisodesClick("green_view", itemId, episodes)}
                  collectionName="green_view"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Episodes Dialog */}
      <EpisodesDialog
        key={`episodes-dialog-${selectedItemId}-${episodesDialogOpen}`}
        open={episodesDialogOpen}
        onOpenChange={setEpisodesDialogOpen}
        collectionName={selectedCollection}
        documentId={selectedItemId}
        episodes={selectedEpisodes}
        refreshData={fetchCategoryDetails}
      />

      {/* APV Form Dialog */}
      <Dialog open={isApvFormOpen} onOpenChange={setIsApvFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isApvEditMode ? "Edit APV Video" : "Create APV Video"}</DialogTitle>
          </DialogHeader>
          <ApvForm
            categoryId={categoryId}
            categoryName={category?.name || ""}
            onSuccess={handleApvFormSuccess}
            onCancel={handleApvFormCancel}
            initialValues={selectedApvItem}
            isEditMode={isApvEditMode}
          />
        </DialogContent>
      </Dialog>

      {/* Green View Form Dialog */}
      <Dialog open={isGreenViewFormOpen} onOpenChange={setIsGreenViewFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isGreenViewEditMode ? "Edit Green View Tour" : "Create Green View Tour"}</DialogTitle>
          </DialogHeader>
          <GreenViewForm
            roadName={category?.name || ""}
            onSuccess={handleGreenViewFormSuccess}
            onCancel={handleGreenViewFormCancel}
            initialValues={selectedGreenViewItem}
            isEditMode={isGreenViewEditMode}
          />
        </DialogContent>
      </Dialog>

      {/* APV Delete Confirmation Dialog */}
      <AlertDialog open={isApvDeleteDialogOpen} onOpenChange={setIsApvDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete APV Video</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this APV video? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsApvDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteApvVideo} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Green View Delete Confirmation Dialog */}
      <AlertDialog open={isGreenViewDeleteDialogOpen} onOpenChange={setIsGreenViewDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Green View Tour</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Green View tour? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsGreenViewDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGreenViewVideo} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tour Player Dialog */}
      <TourPlayer
        open={isTourPlayerOpen}
        onOpenChange={handleTourPlayerClose}
        videoLink={selectedVideoLink}
        title={selectedTourTitle}
      />
    </div>
  )
}
