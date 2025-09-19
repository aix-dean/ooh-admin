"use client"

import { useState, useEffect } from "react"
import { doc, updateDoc, getDoc, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Trash2, Edit, Save, X, Plus, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"

interface Episode {
  episode: number
  name: string
  start: string
  public: boolean
}

interface EpisodesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionName: string
  documentId: string
  episodes: Episode[]
  refreshData: () => Promise<void>
}

export function EpisodesDialog({
  open,
  onOpenChange,
  collectionName,
  documentId,
  episodes = [],
  refreshData,
}: EpisodesDialogProps) {
  const { toast } = useToast()
  const [episodesList, setEpisodesList] = useState<Episode[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [episodeToDelete, setEpisodeToDelete] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("list")
  const [showWebView, setShowWebView] = useState(false)

  const [newEpisode, setNewEpisode] = useState<Episode>({
    episode: 0,
    name: "",
    start: "00:00:00",
    public: false,
  })

  const [editForm, setEditForm] = useState<Episode>({
    episode: 0,
    name: "",
    start: "00:00:00",
    public: false,
  })

  useEffect(() => {
    if (open && episodes) {
      // Sort episodes by episode number
      const sortedEpisodes = [...episodes].sort((a, b) => a.episode - b.episode)
      setEpisodesList(sortedEpisodes)

      // Set the next episode number for new episodes
      const nextEpisodeNumber = sortedEpisodes.length > 0 ? Math.max(...sortedEpisodes.map((e) => e.episode)) + 1 : 1

      setNewEpisode((prev) => ({
        ...prev,
        episode: nextEpisodeNumber,
      }))
    }

    // Clean up function to reset state when dialog closes
    return () => {
      if (!open) {
        setEditingIndex(null)
        setIsDeleteDialogOpen(false)
        setEpisodeToDelete(null)
        setActiveTab("list")
      }
    }
  }, [open, episodes])

  const handleSaveEpisode = async () => {
    try {
      setIsLoading(true)

      // Get the current document
      const docRef = doc(db, collectionName, documentId)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) {
        toast({
          title: "Error",
          description: "Document not found",
          variant: "destructive",
        })
        return
      }

      // Update the episodes array with the edited episodes
      await updateDoc(docRef, {
        episodes: episodesList,
        updated: Timestamp.now(),
      })

      await refreshData()

      toast({
        title: "Success",
        description: "Episodes updated successfully",
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error updating episodes:", error)
      toast({
        title: "Error",
        description: "Failed to update episodes",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddEpisode = () => {
    // Validate new episode
    if (!newEpisode.name || newEpisode.name.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Episode name is required",
        variant: "destructive",
      })
      return
    }

    const updatedList = [...episodesList, newEpisode]
    setEpisodesList(updatedList)

    // Reset new episode form with incremented episode number
    setNewEpisode({
      episode: newEpisode.episode + 1,
      name: "",
      start: "00:00:00",
      public: false,
    })

    // Switch to list tab after adding
    setActiveTab("list")

    toast({
      title: "Episode Added",
      description: "New episode has been added to the list",
    })
  }

  const startEditing = (index: number) => {
    setEditingIndex(index)
    setEditForm({ ...episodesList[index] })
  }

  const cancelEditing = () => {
    setEditingIndex(null)
  }

  const saveEditing = (index: number) => {
    // Validate edit form
    if (!editForm.name || editForm.name.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Episode name is required",
        variant: "destructive",
      })
      return
    }

    const updatedList = [...episodesList]
    updatedList[index] = editForm
    setEpisodesList(updatedList)
    setEditingIndex(null)

    toast({
      title: "Episode Updated",
      description: "Episode has been updated successfully",
    })
  }

  const confirmDeleteEpisode = (index: number) => {
    setEpisodeToDelete(index)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteEpisode = () => {
    if (episodeToDelete !== null) {
      const updatedList = episodesList.filter((_, index) => index !== episodeToDelete)
      setEpisodesList(updatedList)
      setIsDeleteDialogOpen(false)
      setEpisodeToDelete(null)

      toast({
        title: "Episode Deleted",
        description: "Episode has been removed from the list",
      })
    }
  }

  const moveEpisode = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === episodesList.length - 1)) {
      return
    }

    const newList = [...episodesList]
    const targetIndex = direction === "up" ? index - 1 : index + 1

    // Swap episode numbers
    const currentEpisodeNumber = newList[index].episode
    newList[index].episode = newList[targetIndex].episode
    newList[targetIndex].episode = currentEpisodeNumber

    // Swap positions in array
    const temp = newList[index]
    newList[index] = newList[targetIndex]
    newList[targetIndex] = temp

    setEpisodesList(newList)
  }

  // Force refresh of DOM elements to ensure event handlers are properly attached
  const refreshEventHandlers = () => {
    setEpisodesList([...episodesList])
  }

  // Call this when the dialog opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(refreshEventHandlers, 100)
      return () => clearTimeout(timer)
    }
  }, [open, episodesList])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange} key={`episodes-dialog-${documentId}`}>
        <DialogContent
          className="w-[95vw] sm:w-[90vw] md:w-[85vw] lg:w-[75vw] xl:w-[65vw] 2xl:w-[60vw] max-w-[1200px] max-h-[90vh] overflow-hidden p-3 sm:p-4 md:p-5"
          style={{ maxWidth: "calc(100vw - 32px)" }}
        >
          <DialogHeader className="pb-2">
            <DialogTitle className="text-wrap">Manage Episodes</DialogTitle>
            <DialogDescription className="text-wrap">
              View, edit, add or delete episodes for this content.
            </DialogDescription>
          </DialogHeader>

          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full mt-2 max-w-full overflow-hidden flex flex-col h-full"
          >
            <TabsList className="w-full grid grid-cols-2 mb-3 max-w-full px-0">
              <TabsTrigger value="list" className="text-wrap text-xs sm:text-sm px-2 sm:px-4">
                Episodes List ({episodesList.length})
              </TabsTrigger>
              <TabsTrigger value="add" className="text-wrap text-xs sm:text-sm px-2 sm:px-4">
                Add New Episode
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="mt-0 flex-1 overflow-hidden">
              <Card className="border-0 shadow-none">
                <CardContent className="p-0 sm:p-2">
                  {episodesList.length === 0 ? (
                    <div className="text-center py-8 border rounded-md">
                      <p className="text-muted-foreground text-wrap">No episodes found</p>
                      <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setActiveTab("add")}>
                        <Plus className="h-4 w-4 mr-2" />
                        <span className="text-wrap">Add Your First Episode</span>
                      </Button>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <div className="w-full max-h-[60vh] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[60px]">Episode</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead className="w-[90px]">Start</TableHead>
                              <TableHead className="w-[90px]">Status</TableHead>
                              <TableHead className="text-right w-[120px]">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {episodesList.map((episode, index) => (
                              <TableRow key={index}>
                                {editingIndex === index ? (
                                  <>
                                    <TableCell>
                                      <Input
                                        type="number"
                                        value={editForm.episode}
                                        onChange={(e) =>
                                          setEditForm({ ...editForm, episode: Number.parseInt(e.target.value) })
                                        }
                                        className="w-16"
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <Input
                                        value={editForm.start}
                                        onChange={(e) => setEditForm({ ...editForm, start: e.target.value })}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          checked={editForm.public}
                                          onCheckedChange={(checked) => setEditForm({ ...editForm, public: checked })}
                                          id={`public-switch-${index}`}
                                        />
                                        <Label
                                          htmlFor={`public-switch-${index}`}
                                          className="text-xs sm:text-sm text-wrap"
                                        >
                                          {editForm.public ? "Public" : "Private"}
                                        </Label>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right space-x-1">
                                      <Button size="sm" variant="outline" onClick={() => saveEditing(index)}>
                                        <Save className="h-4 w-4 mr-1" />
                                        <span className="text-wrap">Save</span>
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={cancelEditing}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </TableCell>
                                  </>
                                ) : (
                                  <>
                                    <TableCell>{episode.episode}</TableCell>
                                    <TableCell className="font-medium text-wrap break-words max-w-[300px]">
                                      {episode.name}
                                    </TableCell>
                                    <TableCell className="text-wrap">{episode.start}</TableCell>
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
                                          onClick={() => startEditing(index)}
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
                                          <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </>
                                )}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="add" className="mt-0">
              <Card className="border-0 shadow-none">
                <CardContent className="p-0 sm:p-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="new-episode" className="mb-2 block text-wrap">
                          Episode Number
                        </Label>
                        <Input
                          id="new-episode"
                          type="number"
                          value={newEpisode.episode}
                          onChange={(e) => setNewEpisode({ ...newEpisode, episode: Number.parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-name" className="mb-2 block text-wrap">
                          Episode Name
                        </Label>
                        <Input
                          id="new-name"
                          value={newEpisode.name}
                          onChange={(e) => setNewEpisode({ ...newEpisode, name: e.target.value })}
                          placeholder="Enter episode name"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="new-start" className="mb-2 block text-wrap">
                        Start Time
                      </Label>
                      <Input
                        id="new-start"
                        value={newEpisode.start}
                        onChange={(e) => setNewEpisode({ ...newEpisode, start: e.target.value })}
                        placeholder="00:00:00"
                      />
                    </div>

                    <div className="flex items-center space-x-2 mt-4">
                      <Switch
                        checked={newEpisode.public}
                        onCheckedChange={(checked) => setNewEpisode({ ...newEpisode, public: checked })}
                        id="new-public-switch"
                      />
                      <Label htmlFor="new-public-switch" className="text-wrap">
                        {newEpisode.public ? "Public" : "Private"}
                      </Label>
                    </div>

                    <Button onClick={handleAddEpisode} className="w-full mt-4">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="text-wrap">Add Episode</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              <span className="text-wrap">Cancel</span>
            </Button>
            <Button onClick={handleSaveEpisode} disabled={isLoading} className="w-full sm:w-auto">
              {isLoading ? <Clock className="mr-2 h-4 w-4 animate-spin" /> : null}
              <span className="text-wrap">Save All Changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-wrap">Delete Episode</AlertDialogTitle>
            <AlertDialogDescription className="text-wrap">
              Are you sure you want to delete this episode? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-wrap">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteEpisode} className="bg-red-600 hover:bg-red-700 text-wrap">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
