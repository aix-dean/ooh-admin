"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { collection, getDocs, query, where, updateDoc, doc, addDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { formatDate } from "@/lib/date-utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  InfoIcon,
  Loader2,
  Plus,
  Edit,
  Trash,
  Search,
  X,
  ExternalLink,
  List,
  ChevronDown,
  ChevronUp,
  Save,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DeleteDialog } from "@/components/content-category/delete-dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
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
import { WebView } from "@/components/webview/webview"
import { useAuth } from "@/contexts/auth-context"

interface Episode {
  episode: number
  name: string
  start: string
  public: boolean
  description?: string
  thumbnail?: string
}

interface GreenViewCategory {
  id: string
  name: string
  active: boolean
  created: any
  updated?: any
  archipelago: string
  deleted: boolean
  position: number
  latest_apv_id?: string
  latest_gv_id?: string
  pinned?: string
  date_deleted?: any
  episodes?: Episode[]
}

interface FormData {
  name: string
  archipelago: string
  position: number
  active: boolean
}

interface EpisodeFormData {
  episode: number
  name: string
  description: string
  start: string
  public: boolean
  thumbnail?: string
  videoUrl?: string
}

const ARCHIPELAGOS = ["Luzon", "Visayas", "Mindanao"]
const DEFAULT_ARCHIPELAGO = "Luzon"

export default function APVPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const [categories, setCategories] = useState<GreenViewCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredCategories, setFilteredCategories] = useState<GreenViewCategory[]>([])

  // Category form state
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    name: "",
    archipelago: DEFAULT_ARCHIPELAGO,
    position: 0,
    active: true,
  })
  const [formMode, setFormMode] = useState<"create" | "edit">("create")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formSubmitting, setFormSubmitting] = useState(false)

  // Episode management state
  const [isEpisodeDialogOpen, setIsEpisodeDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<GreenViewCategory | null>(null)
  const [episodesList, setEpisodesList] = useState<Episode[]>([])
  const [episodeFormData, setEpisodeFormData] = useState<EpisodeFormData>({
    episode: 1,
    name: "",
    description: "",
    start: "00:00:00",
    public: true,
    thumbnail: "",
    videoUrl: "",
  })
  const [episodeFormMode, setEpisodeFormMode] = useState<"create" | "edit">("create")
  const [editingEpisodeIndex, setEditingEpisodeIndex] = useState<number | null>(null)
  const [episodeSubmitting, setEpisodeSubmitting] = useState(false)
  const [activeEpisodeTab, setActiveEpisodeTab] = useState("list")
  const [episodePreviewMode, setEpisodePreviewMode] = useState(false)
  const [isDeleteEpisodeDialogOpen, setIsDeleteEpisodeDialogOpen] = useState(false)
  const [episodeToDeleteIndex, setEpisodeToDeleteIndex] = useState<number | null>(null)

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<GreenViewCategory | null>(null)

  // Webview URL for video uploads
  const webviewUrl = user
    ? `https://gcp-upload-webview-dot-oh-app-bcf24.as.r.appspot.com/?uid=${user.uid}`
    : "https://gcp-upload-webview-dot-oh-app-bcf24.as.r.appspot.com/"

  useEffect(() => {
    fetchCategories()
  }, [])

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredCategories(categories)
    } else {
      const lowercaseQuery = searchQuery.toLowerCase()
      setFilteredCategories(
        categories.filter(
          (category) =>
            category.name.toLowerCase().includes(lowercaseQuery) ||
            category.archipelago.toLowerCase().includes(lowercaseQuery),
        ),
      )
    }
  }, [searchQuery, categories])

  // Update next episode number when episodes change
  useEffect(() => {
    if (episodesList.length > 0) {
      const maxEpisodeNumber = Math.max(...episodesList.map((ep) => ep.episode))
      setEpisodeFormData((prev) => ({
        ...prev,
        episode: maxEpisodeNumber + 1,
      }))
    } else {
      setEpisodeFormData((prev) => ({
        ...prev,
        episode: 1,
      }))
    }
  }, [episodesList])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      const q = query(collection(db, "green_view_categories"), where("deleted", "==", false))
      const querySnapshot = await getDocs(q)
      const categoriesData: GreenViewCategory[] = []

      querySnapshot.forEach((doc) => {
        categoriesData.push({
          id: doc.id,
          ...doc.data(),
        } as GreenViewCategory)
      })

      categoriesData.sort((a, b) => a.position - b.position)

      setCategories(categoriesData)
      setFilteredCategories(categoriesData)
    } catch (error) {
      console.error("Error fetching categories:", error)
      toast({
        title: "Error",
        description: "Failed to load APV categories. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const toggleActiveStatus = async (id: string, currentStatus: boolean) => {
    try {
      setUpdating(id)
      const categoryRef = doc(db, "green_view_categories", id)
      await updateDoc(categoryRef, {
        active: !currentStatus,
        updated: serverTimestamp(),
      })

      const updatedCategories = categories.map((category) =>
        category.id === id ? { ...category, active: !currentStatus, updated: new Date() } : category,
      )
      setCategories(updatedCategories)

      toast({
        title: "Success",
        description: `Category ${!currentStatus ? "activated" : "deactivated"} successfully.`,
      })
    } catch (error) {
      console.error("Error updating category status:", error)
      toast({
        title: "Error",
        description: "Failed to update category status. Please try again.",
        variant: "destructive",
      })
    } finally {
      setUpdating(null)
    }
  }

  const openCreateForm = () => {
    setFormData({
      name: "",
      archipelago: DEFAULT_ARCHIPELAGO,
      position: categories.length > 0 ? Math.max(...categories.map((c) => c.position)) + 1 : 0,
      active: true,
    })
    setFormMode("create")
    setEditingId(null)
    setIsFormOpen(true)
  }

  const openEditForm = (category: GreenViewCategory) => {
    setFormData({
      name: category.name || "",
      archipelago: category.archipelago || DEFAULT_ARCHIPELAGO,
      position: category.position || 0,
      active: category.active !== undefined ? category.active : true,
    })
    setFormMode("edit")
    setEditingId(category.id)
    setIsFormOpen(true)
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Category name is required",
        variant: "destructive",
      })
      return
    }

    const archipelago = formData.archipelago || DEFAULT_ARCHIPELAGO

    try {
      setFormSubmitting(true)

      if (formMode === "create") {
        const newCategory = {
          name: formData.name.trim(),
          archipelago: archipelago,
          position: formData.position,
          active: formData.active,
          created: serverTimestamp(),
          updated: serverTimestamp(),
          deleted: false,
          episodes: [],
        }

        const docRef = await addDoc(collection(db, "green_view_categories"), newCategory)

        setCategories([
          ...categories,
          {
            id: docRef.id,
            ...newCategory,
            created: new Date(),
            updated: new Date(),
          } as GreenViewCategory,
        ])

        toast({ title: "Success", description: "Category created successfully" })
      } else if (formMode === "edit" && editingId) {
        const categoryRef = doc(db, "green_view_categories", editingId)
        const updateData = {
          name: formData.name.trim(),
          archipelago: archipelago,
          position: formData.position,
          active: formData.active,
          updated: serverTimestamp(),
        }

        await updateDoc(categoryRef, updateData)

        setCategories(
          categories.map((category) =>
            category.id === editingId ? { ...category, ...updateData, updated: new Date() } : category,
          ),
        )

        toast({ title: "Success", description: "Category updated successfully" })
      }

      setIsFormOpen(false)
    } catch (error) {
      console.error("Error saving category:", error)
      toast({
        title: "Error",
        description: `Failed to ${formMode === "create" ? "create" : "update"} category. Please try again.`,
        variant: "destructive",
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  const openDeleteDialog = (category: GreenViewCategory) => {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!categoryToDelete) return

    try {
      const categoryRef = doc(db, "green_view_categories", categoryToDelete.id)
      await updateDoc(categoryRef, {
        deleted: true,
        date_deleted: serverTimestamp(),
        updated: serverTimestamp(),
      })

      setCategories(categories.filter((c) => c.id !== categoryToDelete.id))

      toast({ title: "Success", description: "Category deleted successfully" })
    } catch (error) {
      console.error("Error deleting category:", error)
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    }
  }

  // Episode management functions
  const openEpisodeDialog = (category: GreenViewCategory) => {
    setSelectedCategory(category)
    setEpisodesList(category.episodes || [])
    setIsEpisodeDialogOpen(true)
    setActiveEpisodeTab("list")
    setEpisodePreviewMode(false)

    // Reset episode form
    setEpisodeFormData({
      episode: episodesList.length > 0 ? Math.max(...episodesList.map((ep) => ep.episode)) + 1 : 1,
      name: "",
      description: "",
      start: "00:00:00",
      public: true,
      thumbnail: "",
      videoUrl: "",
    })
    setActiveEpisodeTab("list")
  }

  const handleEpisodeFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target
    setEpisodeFormData({
      ...episodeFormData,
      [name]: name === "episode" ? Number(value) : value,
    })
  }

  const handleEpisodePublicChange = (checked: boolean) => {
    setEpisodeFormData({
      ...episodeFormData,
      public: checked,
    })
  }

  const validateEpisodeForm = () => {
    if (!episodeFormData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Episode name is required",
        variant: "destructive",
      })
      return false
    }

    if (!episodeFormData.start.match(/^\d{2}:\d{2}:\d{2}$/)) {
      toast({
        title: "Validation Error",
        description: "Start time must be in format HH:MM:SS",
        variant: "destructive",
      })
      return false
    }

    return true
  }

  const handleAddEpisode = () => {
    if (!validateEpisodeForm()) return

    const newEpisode: Episode = {
      episode: episodeFormData.episode,
      name: episodeFormData.name.trim(),
      description: episodeFormData.description.trim(),
      start: episodeFormData.start,
      public: episodeFormData.public,
      thumbnail: episodeFormData.thumbnail,
    }

    const updatedEpisodes = [...episodesList, newEpisode]
    updatedEpisodes.sort((a, b) => a.episode - b.episode)
    setEpisodesList(updatedEpisodes)

    // Reset form for next episode
    setEpisodeFormData({
      episode: episodeFormData.episode + 1,
      name: "",
      description: "",
      start: "00:00:00",
      public: true,
      thumbnail: "",
      videoUrl: "",
    })

    setActiveEpisodeTab("list")

    toast({
      title: "Success",
      description: "Episode added successfully",
    })
  }

  const startEditingEpisode = (index: number) => {
    const episode = episodesList[index]
    setEpisodeFormData({
      episode: episode.episode,
      name: episode.name,
      description: episode.description || "",
      start: episode.start,
      public: episode.public,
      thumbnail: episode.thumbnail || "",
      videoUrl: "",
    })
    setEditingEpisodeIndex(index)
    setEpisodeFormMode("edit")
    setActiveEpisodeTab("edit")
  }

  const cancelEditingEpisode = () => {
    setEditingEpisodeIndex(null)
    setEpisodeFormMode("create")
    setActiveEpisodeTab("list")

    // Reset form
    setEpisodeFormData({
      episode: episodesList.length > 0 ? Math.max(...episodesList.map((ep) => ep.episode)) + 1 : 1,
      name: "",
      description: "",
      start: "00:00:00",
      public: true,
      thumbnail: "",
      videoUrl: "",
    })
  }

  const saveEditingEpisode = () => {
    if (!validateEpisodeForm() || editingEpisodeIndex === null) return

    const updatedEpisode: Episode = {
      episode: episodeFormData.episode,
      name: episodeFormData.name.trim(),
      description: episodeFormData.description.trim(),
      start: episodeFormData.start,
      public: episodeFormData.public,
      thumbnail: episodeFormData.thumbnail,
    }

    const updatedEpisodes = [...episodesList]
    updatedEpisodes[editingEpisodeIndex] = updatedEpisode
    updatedEpisodes.sort((a, b) => a.episode - b.episode)

    setEpisodesList(updatedEpisodes)
    setEditingEpisodeIndex(null)
    setEpisodeFormMode("create")
    setActiveEpisodeTab("list")

    toast({
      title: "Success",
      description: "Episode updated successfully",
    })
  }

  const confirmDeleteEpisode = (index: number) => {
    setEpisodeToDeleteIndex(index)
    setIsDeleteEpisodeDialogOpen(true)
  }

  const handleDeleteEpisode = () => {
    if (episodeToDeleteIndex === null) return

    const updatedEpisodes = episodesList.filter((_, index) => index !== episodeToDeleteIndex)
    setEpisodesList(updatedEpisodes)

    toast({
      title: "Success",
      description: "Episode deleted successfully",
    })

    setIsDeleteEpisodeDialogOpen(false)
    setEpisodeToDeleteIndex(null)
  }

  const moveEpisode = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === episodesList.length - 1)) {
      return
    }

    const newEpisodes = [...episodesList]
    const targetIndex = direction === "up" ? index - 1 : index + 1

    // Swap episode numbers
    const currentEpisodeNumber = newEpisodes[index].episode
    newEpisodes[index].episode = newEpisodes[targetIndex].episode
    newEpisodes[targetIndex].episode = currentEpisodeNumber

    // Swap positions in array
    const temp = newEpisodes[index]
    newEpisodes[index] = newEpisodes[targetIndex]
    newEpisodes[targetIndex] = temp

    setEpisodesList(newEpisodes)
  }

  const toggleEpisodePreview = () => {
    setEpisodePreviewMode(!episodePreviewMode)
  }

  const saveEpisodes = async () => {
    if (!selectedCategory) return

    try {
      setEpisodeSubmitting(true)

      const categoryRef = doc(db, "green_view_categories", selectedCategory.id)
      await updateDoc(categoryRef, {
        episodes: episodesList,
        updated: serverTimestamp(),
      })

      // Update local state
      setCategories(
        categories.map((category) =>
          category.id === selectedCategory.id ? { ...category, episodes: episodesList, updated: new Date() } : category,
        ),
      )

      toast({
        title: "Success",
        description: "Episodes saved successfully",
      })

      setIsEpisodeDialogOpen(false)
    } catch (error) {
      console.error("Error saving episodes:", error)
      toast({
        title: "Error",
        description: "Failed to save episodes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setEpisodeSubmitting(false)
    }
  }

  const clearSearch = () => setSearchQuery("")

  const getLastUpdated = (category: GreenViewCategory) => {
    return category.updated || category.created
  }

  const viewCategoryDetails = (categoryId: string) => {
    router.push(`/dashboard/content/apv/${categoryId}`)
  }

  const getSourceCategoryName = (categoryId: string) => {
    const category = categories.find((cat) => cat.id === categoryId)
    return category ? category.name : "Unknown Category"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">APV Content Management</h1>
        <p className="text-muted-foreground">Manage Green View Categories for APV</p>
      </div>

      <Alert>
        <InfoIcon className="h-4 w-4" />
        <AlertDescription>
          This dashboard displays Green View Categories from the APV system. You can create, edit, and manage
          categories. Click on a row to view related APV and Green View videos.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="space-y-1">
            <CardTitle>Green View Categories</CardTitle>
            <CardDescription>Manage and update APV Green View categories</CardDescription>
          </div>
          <Button onClick={openCreateForm} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" /> Add Category
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search categories..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <Button variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={clearSearch}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-60">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCategories.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground">
                {searchQuery ? "No categories match your search" : "No categories found"}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Archipelago</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead>Episodes</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCategories.map((category) => (
                    <TableRow
                      key={category.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => viewCategoryDetails(category.id)}
                    >
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell>{category.archipelago || DEFAULT_ARCHIPELAGO}</TableCell>
                      <TableCell>{formatDate(category.created?.toDate?.() || category.created)}</TableCell>
                      <TableCell>
                        {formatDate(getLastUpdated(category)?.toDate?.() || getLastUpdated(category))}
                      </TableCell>
                      <TableCell>{category.position}</TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => openEpisodeDialog(category)}
                          >
                            <Badge variant="outline" className="cursor-pointer hover:bg-secondary">
                              {Array.isArray(category.episodes) ? category.episodes.length : 0}
                            </Badge>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div onClick={(e) => e.stopPropagation()}>
                          <Switch
                            checked={category.active}
                            disabled={updating === category.id}
                            onCheckedChange={() => toggleActiveStatus(category.id, category.active)}
                          />
                          {updating === category.id && <Loader2 className="h-4 w-4 animate-spin ml-2 inline-block" />}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" onClick={() => openEditForm(category)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEpisodeDialog(category)}>
                            <List className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 bg-transparent"
                            onClick={() => openDeleteDialog(category)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => viewCategoryDetails(category.id)}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {filteredCategories.length} {filteredCategories.length === 1 ? "category" : "categories"} found
          </div>
        </CardFooter>
      </Card>

      {/* Create/Edit Form Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{formMode === "create" ? "Create New Category" : "Edit Category"}</DialogTitle>
            <DialogDescription>
              {formMode === "create"
                ? "Add a new green view category to the system."
                : "Update the details of this green view category."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleFormSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter category name"
                  disabled={formSubmitting}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="archipelago">Archipelago</Label>
                <Select
                  value={formData.archipelago || DEFAULT_ARCHIPELAGO}
                  onValueChange={(value) => setFormData({ ...formData, archipelago: value })}
                  disabled={formSubmitting}
                >
                  <SelectTrigger id="archipelago">
                    <SelectValue placeholder="Select archipelago" />
                  </SelectTrigger>
                  <SelectContent>
                    {ARCHIPELAGOS.map((archipelago) => (
                      <SelectItem key={archipelago} value={archipelago}>
                        {archipelago}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  type="number"
                  min="0"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: Number.parseInt(e.target.value) || 0 })}
                  disabled={formSubmitting}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  disabled={formSubmitting}
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={formSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={formSubmitting}>
                {formSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {formMode === "create" ? "Create" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Episodes Management Dialog */}
      <Dialog open={isEpisodeDialogOpen} onOpenChange={setIsEpisodeDialogOpen}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Episodes for {selectedCategory?.name}</DialogTitle>
            <DialogDescription>Add, edit, or remove episodes for this category.</DialogDescription>
          </DialogHeader>

          <Tabs value={activeEpisodeTab} onValueChange={setActiveEpisodeTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="list">Episodes List ({episodesList.length})</TabsTrigger>
              <TabsTrigger value="add">Add New Episode</TabsTrigger>
              <TabsTrigger value="edit" disabled={episodeFormMode !== "edit"}>
                {episodeFormMode === "edit" ? "Edit Episode" : "Edit"}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="space-y-4 py-4">
              {episodesList.length === 0 ? (
                <div className="text-center py-8 border rounded-md">
                  <p className="text-muted-foreground">No episodes found</p>
                  <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setActiveEpisodeTab("add")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Episode
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <ScrollArea className="h-[50vh]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Episode</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="w-[100px]">Start</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="text-right w-[180px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {episodesList.map((episode, index) => (
                          <TableRow key={index}>
                            <TableCell>{episode.episode}</TableCell>
                            <TableCell className="font-medium">
                              {episode.name}
                              {episode.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                  {episode.description}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>{episode.start}</TableCell>
                            <TableCell>
                              <Badge variant={episode.public ? "default" : "outline"}>
                                {episode.public ? "Public" : "Private"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end items-center space-x-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => moveEpisode(index, "up")}
                                  disabled={index === 0}
                                  className="h-7 w-7"
                                >
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => moveEpisode(index, "down")}
                                  disabled={index === episodesList.length - 1}
                                  className="h-7 w-7"
                                >
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => startEditingEpisode(index)}
                                  className="h-7 w-7"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => confirmDeleteEpisode(index)}
                                  className="h-7 w-7"
                                >
                                  <Trash className="h-4 w-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </div>
              )}
            </TabsContent>

            <TabsContent value="add" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="episode">Episode Number</Label>
                      <Input
                        id="episode"
                        name="episode"
                        type="number"
                        value={episodeFormData.episode}
                        onChange={handleEpisodeFormChange}
                        min="1"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Episode Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={episodeFormData.name}
                        onChange={handleEpisodeFormChange}
                        placeholder="Enter episode name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      value={episodeFormData.description}
                      onChange={handleEpisodeFormChange}
                      placeholder="Enter episode description"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start">Start Time (HH:MM:SS)</Label>
                      <Input
                        id="start"
                        name="start"
                        value={episodeFormData.start}
                        onChange={handleEpisodeFormChange}
                        placeholder="00:00:00"
                        pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail">Thumbnail URL (Optional)</Label>
                    <Input
                      id="thumbnail"
                      name="thumbnail"
                      value={episodeFormData.thumbnail || ""}
                      onChange={handleEpisodeFormChange}
                      placeholder="Enter thumbnail URL"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="videoUrl">Video URL (Optional)</Label>
                    <Input
                      id="videoUrl"
                      name="videoUrl"
                      value={episodeFormData.videoUrl || ""}
                      onChange={handleEpisodeFormChange}
                      placeholder="Enter video URL"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch id="public" checked={episodeFormData.public} onCheckedChange={handleEpisodePublicChange} />
                    <Label htmlFor="public">Public</Label>
                  </div>

                  <div className="border rounded-md p-4 bg-muted/30">
                    <h3 className="font-medium mb-2">Video Upload Tool</h3>
                    <WebView url={webviewUrl} height={200} className="bg-white" />
                    <p className="text-xs text-muted-foreground mt-2">
                      Use this tool to upload your video and copy the URL to the Video URL field above.
                    </p>
                  </div>
                </div>

                <div className="border rounded-md p-4">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-medium">Episode Preview</h3>
                    <Button variant="outline" size="sm" onClick={toggleEpisodePreview}>
                      {episodePreviewMode ? "Edit Mode" : "Preview Mode"}
                    </Button>
                  </div>

                  {episodePreviewMode ? (
                    <div className="space-y-4">
                      <div className="rounded-md border p-4 bg-card">
                        <h2 className="text-xl font-bold">{episodeFormData.name || "Episode Title"}</h2>
                        <div className="flex items-center space-x-2 mt-1 text-sm text-muted-foreground">
                          <span>Episode {episodeFormData.episode}</span>
                          <span>•</span>
                          <span>Start: {episodeFormData.start}</span>
                          <span>•</span>
                          <Badge variant={episodeFormData.public ? "default" : "outline"}>
                            {episodeFormData.public ? "Public" : "Private"}
                          </Badge>
                        </div>

                        {episodeFormData.description && <p className="mt-4 text-sm">{episodeFormData.description}</p>}

                        {episodeFormData.thumbnail && (
                          <div className="mt-4">
                            <img
                              src={episodeFormData.thumbnail || "/placeholder.svg"}
                              alt={`Thumbnail for ${episodeFormData.name}`}
                              className="rounded-md max-h-[200px] object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      Fill out the form and click "Preview Mode" to see how your episode will look.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setActiveEpisodeTab("list")}>
                  Cancel
                </Button>
                <Button onClick={handleAddEpisode}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Episode
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="edit" className="space-y-4 py-4">
              {episodeFormMode === "edit" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-episode">Episode Number</Label>
                        <Input
                          id="edit-episode"
                          name="episode"
                          type="number"
                          value={episodeFormData.episode}
                          onChange={handleEpisodeFormChange}
                          min="1"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-name">Episode Name</Label>
                        <Input
                          id="edit-name"
                          name="name"
                          value={episodeFormData.name}
                          onChange={handleEpisodeFormChange}
                          placeholder="Enter episode name"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-description">Description</Label>
                      <Textarea
                        id="edit-description"
                        name="description"
                        value={episodeFormData.description}
                        onChange={handleEpisodeFormChange}
                        placeholder="Enter episode description"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-start">Start Time (HH:MM:SS)</Label>
                        <Input
                          id="edit-start"
                          name="start"
                          value={episodeFormData.start}
                          onChange={handleEpisodeFormChange}
                          placeholder="00:00:00"
                          pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="edit-thumbnail">Thumbnail URL (Optional)</Label>
                      <Input
                        id="edit-thumbnail"
                        name="thumbnail"
                        value={episodeFormData.thumbnail || ""}
                        onChange={handleEpisodeFormChange}
                        placeholder="Enter thumbnail URL"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="edit-public"
                        checked={episodeFormData.public}
                        onCheckedChange={handleEpisodePublicChange}
                      />
                      <Label htmlFor="edit-public">Public</Label>
                    </div>
                  </div>

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-4">Episode Preview</h3>
                    <div className="rounded-md border p-4 bg-card">
                      <h2 className="text-xl font-bold">{episodeFormData.name || "Episode Title"}</h2>
                      <div className="flex items-center space-x-2 mt-1 text-sm text-muted-foreground">
                        <span>Episode {episodeFormData.episode}</span>
                        <span>•</span>
                        <span>Start: {episodeFormData.start}</span>
                        <span>•</span>
                        <Badge variant={episodeFormData.public ? "default" : "outline"}>
                          {episodeFormData.public ? "Public" : "Private"}
                        </Badge>
                      </div>

                      {episodeFormData.description && <p className="mt-4 text-sm">{episodeFormData.description}</p>}

                      {episodeFormData.thumbnail && (
                        <div className="mt-4">
                          <img
                            src={episodeFormData.thumbnail || "/placeholder.svg"}
                            alt={`Thumbnail for ${episodeFormData.name}`}
                            className="rounded-md max-h-[200px] object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={cancelEditingEpisode}>
                  Cancel
                </Button>
                <Button onClick={saveEditingEpisode}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEpisodeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEpisodes} disabled={episodeSubmitting}>
              {episodeSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Episodes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Episode Confirmation Dialog */}
      <AlertDialog open={isDeleteEpisodeDialogOpen} onOpenChange={setIsDeleteEpisodeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Episode</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this episode? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEpisode} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Category Confirmation Dialog */}
      <DeleteDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${categoryToDelete?.name}"`}
        description="This will mark the category as deleted but preserve it in the database. It will no longer appear in the active categories list."
        confirmText="Delete"
      />
    </div>
  )
}
