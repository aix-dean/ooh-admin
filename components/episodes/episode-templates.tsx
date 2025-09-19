"use client"

import { useState, useEffect } from "react"
import { collection, getDocs, addDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
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
import { Loader2, Plus, Trash2, Save, Copy, CheckCircle, Info } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Episode {
  episode: number
  name: string
  start: string
  end: string
  public: boolean
  description?: string
  thumbnail?: string
}

interface EpisodeTemplate {
  id: string
  name: string
  description: string
  episodes: Episode[]
  created: any
  updated: any
  createdBy?: string
}

interface EpisodeTemplatesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApplyTemplate: (episodes: Episode[]) => void
}

export function EpisodeTemplates({ open, onOpenChange, onApplyTemplate }: EpisodeTemplatesProps) {
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EpisodeTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("browse")
  const [selectedTemplate, setSelectedTemplate] = useState<EpisodeTemplate | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null)
  const [isApplying, setIsApplying] = useState(false)

  // New template form state
  const [newTemplateName, setNewTemplateName] = useState("")
  const [newTemplateDescription, setNewTemplateDescription] = useState("")
  const [newTemplateEpisodes, setNewTemplateEpisodes] = useState<Episode[]>([])
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    try {
      setLoading(true)
      const querySnapshot = await getDocs(collection(db, "episode_templates"))
      const templatesData: EpisodeTemplate[] = []

      querySnapshot.forEach((doc) => {
        templatesData.push({
          id: doc.id,
          ...doc.data(),
        } as EpisodeTemplate)
      })

      // Sort templates by name
      templatesData.sort((a, b) => a.name.localeCompare(b.name))

      setTemplates(templatesData)
    } catch (error) {
      console.error("Error fetching episode templates:", error)
      toast({
        title: "Error",
        description: "Failed to load episode templates",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast({
        title: "Validation Error",
        description: "Template name is required",
        variant: "destructive",
      })
      return
    }

    if (newTemplateEpisodes.length === 0) {
      toast({
        title: "Validation Error",
        description: "Template must have at least one episode",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      const newTemplate = {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim(),
        episodes: newTemplateEpisodes,
        created: serverTimestamp(),
        updated: serverTimestamp(),
      }

      const docRef = await addDoc(collection(db, "episode_templates"), newTemplate)

      // Add the new template to the state
      setTemplates([
        ...templates,
        {
          id: docRef.id,
          ...newTemplate,
          created: new Date(),
          updated: new Date(),
        } as EpisodeTemplate,
      ])

      // Reset form
      setNewTemplateName("")
      setNewTemplateDescription("")
      setNewTemplateEpisodes([])

      // Switch to browse tab
      setActiveTab("browse")

      toast({
        title: "Success",
        description: "Template created successfully",
      })
    } catch (error) {
      console.error("Error creating template:", error)
      toast({
        title: "Error",
        description: "Failed to create template",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDeleteTemplate = (templateId: string) => {
    setTemplateToDelete(templateId)
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteTemplate = async () => {
    if (!templateToDelete) return

    try {
      await deleteDoc(doc(db, "episode_templates", templateToDelete))

      // Remove the deleted template from the state
      setTemplates(templates.filter((template) => template.id !== templateToDelete))

      toast({
        title: "Success",
        description: "Template deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting template:", error)
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive",
      })
    } finally {
      setIsDeleteDialogOpen(false)
      setTemplateToDelete(null)
    }
  }

  const handleApplyTemplate = (template: EpisodeTemplate) => {
    setSelectedTemplate(template)
    setIsApplying(true)
  }

  const confirmApplyTemplate = () => {
    if (!selectedTemplate) return

    try {
      onApplyTemplate(selectedTemplate.episodes)

      toast({
        title: "Success",
        description: `Template "${selectedTemplate.name}" applied successfully`,
      })

      onOpenChange(false)
    } catch (error) {
      console.error("Error applying template:", error)
      toast({
        title: "Error",
        description: "Failed to apply template",
        variant: "destructive",
      })
    } finally {
      setIsApplying(false)
      setSelectedTemplate(null)
    }
  }

  const addEpisodeToTemplate = () => {
    const newEpisode: Episode = {
      episode: newTemplateEpisodes.length > 0 ? Math.max(...newTemplateEpisodes.map((ep) => ep.episode)) + 1 : 1,
      name: `Episode ${newTemplateEpisodes.length + 1}`,
      start: "00:00:00",
      end: "00:00:00",
      public: true,
    }

    setNewTemplateEpisodes([...newTemplateEpisodes, newEpisode])
  }

  const updateTemplateEpisode = (index: number, field: keyof Episode, value: any) => {
    const updatedEpisodes = [...newTemplateEpisodes]
    updatedEpisodes[index] = {
      ...updatedEpisodes[index],
      [field]: value,
    }
    setNewTemplateEpisodes(updatedEpisodes)
  }

  const removeTemplateEpisode = (index: number) => {
    const updatedEpisodes = newTemplateEpisodes.filter((_, i) => i !== index)
    setNewTemplateEpisodes(updatedEpisodes)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[90vw] md:max-w-[80vw] lg:max-w-[70vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Episode Templates</DialogTitle>
            <DialogDescription>
              Browse, create, and apply episode templates to quickly set up your content.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="browse">Browse Templates</TabsTrigger>
              <TabsTrigger value="create">Create Template</TabsTrigger>
            </TabsList>

            <TabsContent value="browse" className="space-y-4 py-4">
              {loading ? (
                <div className="flex items-center justify-center h-60">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 border rounded-md">
                  <p className="text-muted-foreground">No templates found</p>
                  <Button variant="outline" className="mt-4 bg-transparent" onClick={() => setActiveTab("create")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Template
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {templates.map((template) => (
                    <Card key={template.id} className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <CardDescription className="line-clamp-2">
                          {template.description || "No description provided"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">Episodes</span>
                          <Badge>{template.episodes.length}</Badge>
                        </div>
                        <ScrollArea className="h-[100px] border rounded-md p-2">
                          {template.episodes.map((episode, index) => (
                            <div key={index} className="py-1 text-sm">
                              <div className="font-medium">
                                Episode {episode.episode}: {episode.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {episode.start} - {episode.end} • {episode.public ? "Public" : "Private"}
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                      </CardContent>
                      <CardFooter className="flex justify-between pt-2">
                        <Button variant="outline" size="sm" onClick={() => confirmDeleteTemplate(template.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                        <Button size="sm" onClick={() => handleApplyTemplate(template)}>
                          <Copy className="h-4 w-4 mr-1" />
                          Apply
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="create" className="space-y-4 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-name">Template Name</Label>
                    <Input
                      id="template-name"
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      placeholder="Enter template name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={newTemplateDescription}
                      onChange={(e) => setNewTemplateDescription(e.target.value)}
                      placeholder="Enter template description"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label>Episodes</Label>
                      <Button variant="outline" size="sm" onClick={addEpisodeToTemplate}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Episode
                      </Button>
                    </div>

                    {newTemplateEpisodes.length === 0 ? (
                      <div className="text-center py-6 border rounded-md">
                        <p className="text-muted-foreground">No episodes added yet</p>
                        <Button variant="outline" className="mt-2 bg-transparent" onClick={addEpisodeToTemplate}>
                          <Plus className="h-4 w-4 mr-2" />
                          Add Your First Episode
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="h-[300px] border rounded-md p-2">
                        {newTemplateEpisodes.map((episode, index) => (
                          <div key={index} className="py-2 border-b last:border-0">
                            <div className="flex justify-between items-start mb-2">
                              <div className="font-medium">Episode {episode.episode}</div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeTemplateEpisode(index)}
                                className="h-6 w-6 p-0"
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>

                            <div className="grid grid-cols-1 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor={`episode-name-${index}`} className="text-xs">
                                  Name
                                </Label>
                                <Input
                                  id={`episode-name-${index}`}
                                  value={episode.name}
                                  onChange={(e) => updateTemplateEpisode(index, "name", e.target.value)}
                                  className="h-7 text-sm"
                                />
                              </div>

                              <div className="grid grid-cols-1 gap-2">
                                <div className="space-y-1">
                                  <Label htmlFor={`episode-start-${index}`} className="text-xs">
                                    Start
                                  </Label>
                                  <Input
                                    id={`episode-start-${index}`}
                                    value={episode.start}
                                    onChange={(e) => updateTemplateEpisode(index, "start", e.target.value)}
                                    className="h-7 text-sm"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`episode-public-${index}`}
                                  checked={episode.public}
                                  onCheckedChange={(checked) => updateTemplateEpisode(index, "public", checked)}
                                />
                                <Label htmlFor={`episode-public-${index}`} className="text-xs">
                                  {episode.public ? "Public" : "Private"}
                                </Label>
                              </div>
                            </div>
                          </div>
                        ))}
                      </ScrollArea>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <Alert className="bg-blue-50 border-blue-200">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      Templates allow you to save and reuse episode structures across different videos. This is useful
                      for series or recurring content formats.
                    </AlertDescription>
                  </Alert>

                  <div className="border rounded-md p-4">
                    <h3 className="font-medium mb-2">Template Preview</h3>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{newTemplateName || "Untitled Template"}</span>
                        <Badge>{newTemplateEpisodes.length} Episodes</Badge>
                      </div>

                      {newTemplateDescription && (
                        <p className="text-sm text-muted-foreground">{newTemplateDescription}</p>
                      )}

                      <div className="border-t pt-2 mt-2">
                        <span className="text-sm font-medium">Episodes:</span>
                        <ul className="mt-1 space-y-1">
                          {newTemplateEpisodes.map((episode, index) => (
                            <li key={index} className="text-sm">
                              <span className="font-medium">Episode {episode.episode}:</span> {episode.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <Button variant="outline" onClick={() => setActiveTab("browse")}>
                  Cancel
                </Button>
                <Button onClick={handleCreateTemplate} disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Save Template
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Confirmation Dialog */}
      <AlertDialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to apply the template "{selectedTemplate?.name}"? This will add{" "}
              {selectedTemplate?.episodes.length} episodes to your content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmApplyTemplate} className="bg-primary hover:bg-primary/90">
              {isApplying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Apply Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
