"use client"

import type React from "react"

import { useState, useEffect, useReducer, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { createApvVideo, updateApvVideo, pinApvVideo, unpinApvVideo } from "@/lib/apv"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import {
  Loader2,
  CheckCircle,
  Edit,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Copy,
  AlertCircle,
  Info,
  Video,
  ListVideo,
  Pin,
  Settings,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  Check,
  Clipboard,
  Upload,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { EpisodeTemplates } from "@/components/episodes/episode-templates"
import { cn } from "@/lib/utils"

// Episode interface without end time
export interface Episode {
  episode: number
  name: string
  start: string
  public: boolean
  selected?: boolean
  source?: string
}

interface ApvFormProps {
  categoryId: string
  categoryName: string
  onSuccess: () => void
  onCancel: () => void
  initialValues?: any
  isEditMode?: boolean
}

// Define action types for the reducer
type EpisodeAction =
  | { type: "ADD_EPISODE"; episode: Episode }
  | { type: "UPDATE_EPISODE"; index: number; episode: Episode }
  | { type: "DELETE_EPISODE"; index: number }
  | { type: "MOVE_EPISODE"; index: number; direction: "up" | "down" }
  | { type: "APPLY_TEMPLATE"; episodes: Episode[] }
  | { type: "SET_EPISODES"; episodes: Episode[] }
  | { type: "TOGGLE_SELECT_ALL"; selected: boolean }
  | { type: "ADD_EPISODES_FROM_CATEGORY"; episodes: Episode[]; categoryName: string }

// Reducer function for episode management
function episodesReducer(state: Episode[], action: EpisodeAction): Episode[] {
  switch (action.type) {
    case "ADD_EPISODE": {
      const newEpisodes = [...state, action.episode]
      return newEpisodes.sort((a, b) => a.episode - b.episode)
    }
    case "UPDATE_EPISODE": {
      const newEpisodes = [...state]
      newEpisodes[action.index] = action.episode
      return newEpisodes.sort((a, b) => a.episode - b.episode)
    }
    case "DELETE_EPISODE": {
      return state.filter((_, index) => index !== action.index)
    }
    case "MOVE_EPISODE": {
      if (
        (action.direction === "up" && action.index === 0) ||
        (action.direction === "down" && action.index === state.length - 1)
      ) {
        return state
      }

      const newEpisodes = [...state]
      const targetIndex = action.direction === "up" ? action.index - 1 : action.index + 1

      // Swap episode numbers
      const currentEpisodeNumber = newEpisodes[action.index].episode
      newEpisodes[action.index].episode = newEpisodes[targetIndex].episode
      newEpisodes[targetIndex].episode = currentEpisodeNumber

      // Swap positions in array
      const temp = newEpisodes[action.index]
      newEpisodes[action.index] = newEpisodes[targetIndex]
      newEpisodes[targetIndex] = temp

      return newEpisodes
    }
    case "APPLY_TEMPLATE": {
      // Determine the starting episode number
      const startingEpisodeNumber = state.length > 0 ? Math.max(...state.map((ep) => ep.episode)) + 1 : 1

      // Create new episodes with incremented episode numbers
      const newEpisodes = action.episodes.map((ep, idx) => ({
        ...ep,
        episode: startingEpisodeNumber + idx,
      }))

      // Add the new episodes to the existing ones
      return [...state, ...newEpisodes].sort((a, b) => a.episode - b.episode)
    }
    case "SET_EPISODES":
      return action.episodes
    case "TOGGLE_SELECT_ALL":
      return state.map((episode) => ({
        ...episode,
        selected: action.selected,
      }))
    case "ADD_EPISODES_FROM_CATEGORY": {
      // Find the highest episode number in the current list
      const maxEpisodeNumber = state.length > 0 ? Math.max(...state.map((ep) => ep.episode)) : 0

      // Create new episodes with incremented episode numbers and source information
      const newEpisodes = action.episodes.map((ep, idx) => ({
        ...ep,
        episode: maxEpisodeNumber + idx + 1,
        source: action.categoryName,
      }))

      // Add the new episodes to the existing ones
      return [...state, ...newEpisodes].sort((a, b) => a.episode - b.episode)
    }
    default:
      return state
  }
}

// Define the steps in the form wizard
type FormStep = "basic" | "video" | "episodes" | "settings" | "review"

export function ApvForm({ categoryId, categoryName, onSuccess, onCancel, initialValues, isEditMode }: ApvFormProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentStep, setCurrentStep] = useState<FormStep>("basic")
  const [formProgress, setFormProgress] = useState(20)

  // Source data state
  const [greenViewCategories, setGreenViewCategories] = useState<any[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Episode inheritance state
  const [loadingEpisodes, setLoadingEpisodes] = useState(false)
  const [inheritanceStatus, setInheritanceStatus] = useState<{
    success: boolean
    message: string
    count: number
    categoryName: string
  } | null>(null)

  // UI state
  const [editingEpisodeIndex, setEditingEpisodeIndex] = useState<number | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [episodeToDeleteIndex, setEpisodeToDeleteIndex] = useState<number | null>(null)
  const [showAddEpisodeForm, setShowAddEpisodeForm] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [videoUrlCopied, setVideoUrlCopied] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Construct the webview URL with the authenticated user's UID
  const webviewUrl = user
    ? `https://gcp-upload-webview-dot-oh-app-bcf24.as.r.appspot.com/?uid=${user.uid}`
    : "https://gcp-upload-webview-dot-oh-app-bcf24.as.r.appspot.com/"

  // Form data state
  const [formData, setFormData] = useState({
    road: isEditMode ? initialValues?.road : categoryName,
    position: initialValues?.position || 0,
    orientation: initialValues?.orientation || "",
    version: initialValues?.version || "",
    dh: initialValues?.dh || "",
    active: initialValues?.active !== undefined ? initialValues.active : true,
    pinned: initialValues?.pinned || false,
  })

  // Use reducer for episodes management
  const [episodes, dispatchEpisodes] = useReducer(episodesReducer, initialValues?.episodes || [])

  const [newEpisode, setNewEpisode] = useState<Episode>({
    episode: 1,
    name: "",
    start: "00:00:00",
    public: false,
  })

  const [editEpisodeForm, setEditEpisodeForm] = useState<Episode>({
    episode: 1,
    name: "",
    start: "00:00:00",
    public: false,
  })

  // Update form progress based on current step
  useEffect(() => {
    switch (currentStep) {
      case "basic":
        setFormProgress(20)
        break
      case "video":
        setFormProgress(40)
        break
      case "episodes":
        setFormProgress(60)
        break
      case "settings":
        setFormProgress(80)
        break
      case "review":
        setFormProgress(100)
        break
    }
  }, [currentStep])

  // Update next episode number when episodes change
  useEffect(() => {
    if (episodes.length > 0) {
      const maxEpisodeNumber = Math.max(...episodes.map((ep: Episode) => ep.episode))
      setNewEpisode((prev) => ({
        ...prev,
        episode: maxEpisodeNumber + 1,
      }))
    } else {
      setNewEpisode((prev) => ({
        ...prev,
        episode: 1,
      }))
    }
  }, [episodes])

  // Fetch green view categories
  useEffect(() => {
    const fetchGreenViewCategories = async () => {
      try {
        const q = query(collection(db, "green_view_categories"), where("deleted", "==", false))
        const querySnapshot = await getDocs(q)
        const categoriesData: any[] = []

        querySnapshot.forEach((doc) => {
          const data = doc.data()
          if (Array.isArray(data.episodes) && data.episodes.length > 0) {
            categoriesData.push({
              id: doc.id,
              name: data.name || "Unnamed Category",
              episodeCount: data.episodes.length,
            })
          }
        })

        setGreenViewCategories(categoriesData)
      } catch (error) {
        console.error("Error fetching green view categories:", error)
      }
    }

    fetchGreenViewCategories()
  }, [])

  // Validate the current step
  const validateStep = (step: FormStep): boolean => {
    const errors: Record<string, string> = {}

    switch (step) {
      case "basic":
        if (!formData.road.trim()) errors.road = "Road name is required"
        if (formData.position < 0) errors.position = "Position must be a positive number"
        break
      case "video":
        // Video URL is optional, but if provided should be a valid URL
        if (formData.dh && !formData.dh.startsWith("http")) {
          errors.dh = "Video URL should be a valid URL"
        }
        break
      case "episodes":
        // Episodes are optional
        break
      case "settings":
        // No validation needed for settings
        break
      case "review":
        // Validate all fields for final submission
        if (!formData.road.trim()) errors.road = "Road name is required"
        if (formData.position < 0) errors.position = "Position must be a positive number"
        break
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Navigate to the next step
  const goToNextStep = () => {
    if (!validateStep(currentStep)) return

    switch (currentStep) {
      case "basic":
        setCurrentStep("video")
        break
      case "video":
        setCurrentStep("episodes")
        break
      case "episodes":
        setCurrentStep("settings")
        break
      case "settings":
        setCurrentStep("review")
        break
    }
  }

  // Navigate to the previous step
  const goToPreviousStep = () => {
    switch (currentStep) {
      case "video":
        setCurrentStep("basic")
        break
      case "episodes":
        setCurrentStep("video")
        break
      case "settings":
        setCurrentStep("episodes")
        break
      case "review":
        setCurrentStep("settings")
        break
    }
  }

  // Jump to a specific step
  const jumpToStep = (step: FormStep) => {
    // Only allow jumping to steps that come before the current step
    // or to any step if we're in review mode
    if (currentStep === "review" || getStepIndex(step) < getStepIndex(currentStep)) {
      setCurrentStep(step)
    }
  }

  // Get the index of a step
  const getStepIndex = (step: FormStep): number => {
    const steps: FormStep[] = ["basic", "video", "episodes", "settings", "review"]
    return steps.indexOf(step)
  }

  // Check if a step is completed
  const isStepCompleted = (step: FormStep): boolean => {
    switch (step) {
      case "basic":
        return !!formData.road.trim() && formData.position >= 0
      case "video":
        return true // Video is optional
      case "episodes":
        return true // Episodes are optional
      case "settings":
        return true // Settings are optional
      case "review":
        return false // Review is never "completed" until submission
      default:
        return false
    }
  }

  // Handle form field changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target
      setFormData((prev) => ({
        ...prev,
        [name]: name === "position" ? Number(value) : value,
      }))

      // Clear validation error when field is changed
      if (validationErrors[name]) {
        setValidationErrors((prev) => {
          const newErrors = { ...prev }
          delete newErrors[name]
          return newErrors
        })
      }
    },
    [validationErrors],
  )

  // Handle switch changes
  const handleSwitchChange = useCallback((checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      active: checked,
    }))
  }, [])

  // Handle pin switch changes
  const handlePinSwitchChange = useCallback(
    async (checked: boolean) => {
      try {
        setFormData((prev) => ({
          ...prev,
          pinned: checked,
        }))

        // If we're in edit mode and the user is pinning the video, show a toast
        if (isEditMode && initialValues?.id && checked) {
          toast({
            title: "Note",
            description: "Pinning this video will unpin any other currently pinned videos",
          })
        }
      } catch (error) {
        console.error("Error handling pin switch:", error)
        toast({
          title: "Error",
          description: "Failed to update pin status",
          variant: "destructive",
        })
      }
    },
    [isEditMode, initialValues?.id, toast],
  )

  // Handle category selection for episode inheritance
  const handleCategorySelect = useCallback(
    async (categoryId: string) => {
      if (!categoryId || selectedCategories.includes(categoryId)) return

      setLoadingEpisodes(true)
      setInheritanceStatus(null)

      try {
        // Find the category in our list for the name
        const categoryInfo = greenViewCategories.find((c) => c.id === categoryId)
        const sourceName = categoryInfo?.name || "Green View Category"

        // Get the full category data with episodes
        const docRef = doc(db, "green_view_categories", categoryId)
        const docSnap = await getDoc(docRef)

        let categoryEpisodes: Episode[] = []
        if (docSnap.exists()) {
          const data = docSnap.data()
          if (Array.isArray(data.episodes)) {
            categoryEpisodes = data.episodes
          }
        }

        if (categoryEpisodes.length === 0) {
          toast({
            title: "No Episodes Found",
            description: `The selected category "${sourceName}" has no episodes to inherit`,
            variant: "destructive",
          })
          return
        }

        // Add the episodes using the reducer
        dispatchEpisodes({
          type: "ADD_EPISODES_FROM_CATEGORY",
          episodes: categoryEpisodes,
          categoryName: sourceName,
        })

        // Add to selected categories
        setSelectedCategories((prev) => [...prev, categoryId])

        // Show success message
        setInheritanceStatus({
          success: true,
          message: "Episodes inherited successfully",
          count: categoryEpisodes.length,
          categoryName: sourceName,
        })

        toast({
          title: "Success",
          description: `${categoryEpisodes.length} episodes inherited from "${sourceName}"`,
        })
      } catch (error) {
        console.error(`Error inheriting category episodes:`, error)
        setInheritanceStatus({
          success: false,
          message: "Failed to inherit episodes",
          count: 0,
          categoryName: "",
        })
        toast({
          title: "Error",
          description: `Failed to inherit episodes from category`,
          variant: "destructive",
        })
      } finally {
        setLoadingEpisodes(false)
      }
    },
    [episodes, greenViewCategories, toast, dispatchEpisodes, selectedCategories],
  )

  // Handle adding a new episode
  const handleAddEpisode = useCallback(() => {
    // Validate new episode
    if (!newEpisode.name || newEpisode.name.trim() === "") {
      toast({
        title: "Validation Error",
        description: "Episode name is required",
        variant: "destructive",
      })
      return
    }

    // Add the episode using the reducer
    dispatchEpisodes({
      type: "ADD_EPISODE",
      episode: { ...newEpisode },
    })

    // Reset new episode form with incremented episode number
    setNewEpisode({
      episode: newEpisode.episode + 1,
      name: "",
      start: "00:00:00",
      public: false,
    })

    setShowAddEpisodeForm(false)

    toast({
      title: "Episode Added",
      description: "New episode has been added to the list",
    })
  }, [newEpisode, toast])

  // Handle editing an episode
  const startEditingEpisode = useCallback(
    (index: number) => {
      setEditingEpisodeIndex(index)
      setEditEpisodeForm({ ...episodes[index] })
    },
    [episodes],
  )

  // Cancel editing an episode
  const cancelEditingEpisode = useCallback(() => {
    setEditingEpisodeIndex(null)
  }, [])

  // Save edited episode
  const saveEditingEpisode = useCallback(
    (index: number) => {
      // Validate edit form
      if (!editEpisodeForm.name || editEpisodeForm.name.trim() === "") {
        toast({
          title: "Validation Error",
          description: "Episode name is required",
          variant: "destructive",
        })
        return
      }

      // Update the episode using the reducer
      dispatchEpisodes({
        type: "UPDATE_EPISODE",
        index,
        episode: editEpisodeForm,
      })

      setEditingEpisodeIndex(null)

      toast({
        title: "Episode Updated",
        description: "Episode has been updated successfully",
      })
    },
    [editEpisodeForm, toast],
  )

  // Confirm episode deletion
  const confirmDeleteEpisode = useCallback((index: number) => {
    setEpisodeToDeleteIndex(index)
    setIsDeleteDialogOpen(true)
  }, [])

  // Delete an episode
  const handleDeleteEpisode = useCallback(() => {
    if (episodeToDeleteIndex !== null) {
      // Delete the episode using the reducer
      dispatchEpisodes({
        type: "DELETE_EPISODE",
        index: episodeToDeleteIndex,
      })

      setIsDeleteDialogOpen(false)
      setEpisodeToDeleteIndex(null)

      toast({
        title: "Episode Deleted",
        description: "Episode has been removed from the list",
      })
    }
  }, [episodeToDeleteIndex, toast])

  // Apply episode template
  const handleApplyTemplate = useCallback(
    (templateEpisodes: Episode[]) => {
      // Apply the template using the reducer
      dispatchEpisodes({
        type: "APPLY_TEMPLATE",
        episodes: templateEpisodes,
      })

      toast({
        title: "Success",
        description: `${templateEpisodes.length} episodes added from template`,
      })
    },
    [toast],
  )

  // Move episode up or down
  const moveEpisode = useCallback((index: number, direction: "up" | "down") => {
    // Move the episode using the reducer
    dispatchEpisodes({
      type: "MOVE_EPISODE",
      index,
      direction,
    })
  }, [])

  // Copy video URL to clipboard
  const copyVideoUrl = useCallback(() => {
    if (formData.dh) {
      navigator.clipboard.writeText(formData.dh)
      setVideoUrlCopied(true)
      setTimeout(() => setVideoUrlCopied(false), 2000)
      toast({
        title: "Copied",
        description: "Video URL copied to clipboard",
      })
    }
  }, [formData.dh, toast])

  // Submit the form
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      // Validate all fields
      if (!validateStep("review")) {
        toast({
          title: "Validation Error",
          description: "Please fix the errors before submitting",
          variant: "destructive",
        })
        return
      }

      setLoading(true)
      setSuccess(false)

      try {
        // Combine form data with episodes
        const completeData = {
          ...formData,
          episodes,
        }

        if (isEditMode && initialValues?.id) {
          await updateApvVideo(initialValues.id, completeData)

          // Handle pinning/unpinning
          if (formData.pinned) {
            await pinApvVideo(initialValues.id)
          } else if (initialValues.pinned && !formData.pinned) {
            await unpinApvVideo(initialValues.id)
          }

          toast({
            title: "Success",
            description: "APV video updated successfully",
          })
        } else {
          const newId = await createApvVideo({ ...completeData, category_id: categoryId })

          // If the new video should be pinned
          if (formData.pinned && newId) {
            await pinApvVideo(newId)
          }

          toast({
            title: "Success",
            description: "APV video created successfully",
          })
        }
        setSuccess(true)
        setTimeout(() => {
          onSuccess()
        }, 1000)
      } catch (error) {
        console.error("Error saving APV video:", error)
        toast({
          title: "Error",
          description: "Failed to save APV video",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    },
    [formData, episodes, isEditMode, initialValues, categoryId, toast, onSuccess],
  )

  // Group episodes by source
  const episodesBySource = useMemo(() => {
    const grouped: Record<string, Episode[]> = {}

    episodes.forEach((episode) => {
      const source = episode.source || "Manual Entry"
      if (!grouped[source]) {
        grouped[source] = []
      }
      grouped[source].push(episode)
    })

    return grouped
  }, [episodes])

  // Render the step indicator
  const renderStepIndicator = () => {
    return (
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <div className="text-sm font-medium">
            Step {getStepIndex(currentStep) + 1} of 5: {getStepTitle(currentStep)}
          </div>
          <div className="text-sm text-muted-foreground">{formProgress}% Complete</div>
        </div>
        <Progress value={formProgress} className="h-2" />
        <div className="flex justify-between mt-4">
          {(["basic", "video", "episodes", "settings", "review"] as FormStep[]).map((step) => (
            <div
              key={step}
              className={cn(
                "flex flex-col items-center cursor-pointer transition-all",
                getStepIndex(step) <= getStepIndex(currentStep) ? "text-primary" : "text-muted-foreground opacity-50",
              )}
              onClick={() => jumpToStep(step)}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center mb-1 border-2",
                  step === currentStep
                    ? "bg-primary text-primary-foreground border-primary"
                    : getStepIndex(step) < getStepIndex(currentStep)
                      ? "bg-primary/20 border-primary"
                      : "bg-muted border-muted-foreground/30",
                )}
              >
                {getStepIndex(step) < getStepIndex(currentStep) ? <Check className="h-5 w-5" /> : getStepIcon(step)}
              </div>
              <span className="text-xs font-medium hidden sm:block">{getStepTitle(step)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Get the title for a step
  const getStepTitle = (step: FormStep): string => {
    switch (step) {
      case "basic":
        return "Basic Info"
      case "video":
        return "Video"
      case "episodes":
        return "Episodes"
      case "settings":
        return "Settings"
      case "review":
        return "Review"
    }
  }

  // Get the icon for a step
  const getStepIcon = (step: FormStep): React.ReactNode => {
    switch (step) {
      case "basic":
        return <Info className="h-5 w-5" />
      case "video":
        return <Video className="h-5 w-5" />
      case "episodes":
        return <ListVideo className="h-5 w-5" />
      case "settings":
        return <Settings className="h-5 w-5" />
      case "review":
        return <CheckCircle className="h-5 w-5" />
    }
  }

  // Render the basic info step
  const renderBasicInfoStep = () => {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="road" className="flex items-center gap-1">
              Road Name
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The name of the road for this APV video</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              type="text"
              id="road"
              name="road"
              value={formData.road}
              onChange={handleChange}
              placeholder="Enter road name"
              required
              disabled={!isEditMode}
              className={cn(
                !isEditMode ? "bg-muted cursor-not-allowed" : "",
                validationErrors.road ? "border-red-500" : "",
              )}
            />
            {validationErrors.road && <p className="text-sm text-red-500 mt-1">{validationErrors.road}</p>}
            {!isEditMode && (
              <p className="text-xs text-muted-foreground mt-1">Road name is automatically set to the category name</p>
            )}
          </div>
          <div>
            <Label htmlFor="position" className="flex items-center gap-1">
              Position
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The display position of this video in the list</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              type="number"
              id="position"
              name="position"
              value={formData.position}
              onChange={handleChange}
              placeholder="Enter position"
              required
              className={validationErrors.position ? "border-red-500" : ""}
            />
            {validationErrors.position && <p className="text-sm text-red-500 mt-1">{validationErrors.position}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="orientation" className="flex items-center gap-1">
              Orientation
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The orientation of the video (e.g., North, South)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              type="text"
              id="orientation"
              name="orientation"
              value={formData.orientation}
              onChange={handleChange}
              placeholder="Enter orientation"
            />
          </div>
          <div>
            <Label htmlFor="version" className="flex items-center gap-1">
              Version
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>The version of this video (e.g., v1, 2023)</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
            <Input
              type="text"
              id="version"
              name="version"
              value={formData.version}
              onChange={handleChange}
              placeholder="Enter version"
            />
          </div>
        </div>
      </div>
    )
  }

  // Render the video step
  const renderVideoStep = () => {
    return (
      <div className="space-y-4">
        <div>
          <Label htmlFor="dh" className="flex items-center gap-1">
            Video URL
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>The URL of the video file</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
          <div className="flex gap-2">
            <Textarea
              id="dh"
              name="dh"
              value={formData.dh}
              onChange={handleChange}
              placeholder="Enter video URL"
              rows={3}
              className={cn("flex-1", validationErrors.dh ? "border-red-500" : "")}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyVideoUrl}
              disabled={!formData.dh}
              className="h-10 w-10 flex-shrink-0"
            >
              {videoUrlCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            </Button>
          </div>
          {validationErrors.dh && <p className="text-sm text-red-500 mt-1">{validationErrors.dh}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Video Upload Tool
            </CardTitle>
            <CardDescription>Upload your video and copy the URL to the field above</CardDescription>
          </CardHeader>
          <CardContent>
            <WebView url={webviewUrl} height={350} className="bg-white rounded-md border" />
          </CardContent>
          <CardFooter className="text-sm text-muted-foreground">
            {user && <span className="font-medium">Uploading as user: {user.email}</span>}
          </CardFooter>
        </Card>

        {formData.dh && (
          <div className="mt-4">
            <Label className="mb-2 block">Video Preview</Label>
            <div className="aspect-video bg-black rounded-md overflow-hidden">
              <video src={formData.dh} controls className="w-full h-full" poster="/video-preview-concept.png" />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render the episodes step
  const renderEpisodesStep = () => {
    return (
      <div className="space-y-6">
        <Tabs defaultValue="inherit" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inherit">Inherit Episodes</TabsTrigger>
            <TabsTrigger value="manage">Manage Episodes</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="inherit" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inherit from Green View Categories</CardTitle>
                <CardDescription>Select categories to inherit episodes from</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="category-source">Select a Green View Category</Label>
                    <div className="flex gap-2">
                      <select
                        id="category-source"
                        className="flex-1 p-2 border rounded-md"
                        onChange={(e) => handleCategorySelect(e.target.value)}
                        disabled={loadingEpisodes}
                        value=""
                      >
                        <option value="">Select a category...</option>
                        {greenViewCategories
                          .filter((category) => !selectedCategories.includes(category.id))
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name} ({category.episodeCount} episodes)
                            </option>
                          ))}
                      </select>
                    </div>

                    {loadingEpisodes && (
                      <div className="flex items-center mt-2">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        <span className="text-sm">Inheriting episodes...</span>
                      </div>
                    )}

                    {inheritanceStatus && (
                      <div
                        className={`mt-2 p-3 rounded-md ${
                          inheritanceStatus.success
                            ? "bg-green-50 border border-green-200"
                            : "bg-red-50 border border-red-200"
                        }`}
                      >
                        <div className="flex items-center">
                          {inheritanceStatus.success ? (
                            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                          )}
                          <div>
                            <p className={inheritanceStatus.success ? "text-green-700" : "text-red-700"}>
                              {inheritanceStatus.message}
                            </p>
                            {inheritanceStatus.success && (
                              <p className="text-sm text-muted-foreground">
                                Added {inheritanceStatus.count} episodes from "{inheritanceStatus.categoryName}"
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedCategories.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium mb-2">Selected Categories</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedCategories.map((categoryId) => {
                          const category = greenViewCategories.find((c) => c.id === categoryId)
                          return (
                            <Badge key={categoryId} variant="secondary" className="px-3 py-1">
                              {category?.name || "Unknown Category"}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="manage" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Episodes ({episodes.length})</span>
                  <Button size="sm" onClick={() => setShowAddEpisodeForm(true)} type="button">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Episode
                  </Button>
                </CardTitle>
                <CardDescription>Manage episodes for this APV video</CardDescription>
              </CardHeader>
              <CardContent>
                {episodes.length === 0 ? (
                  <div className="text-center py-8 border rounded-md">
                    <p className="text-muted-foreground mb-4">No episodes yet</p>
                    <Button variant="outline" onClick={() => setShowAddEpisodeForm(true)} type="button">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Episode
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(episodesBySource).map(([source, sourceEpisodes]) => (
                      <div key={source} className="border rounded-md overflow-hidden">
                        <div className="bg-muted px-4 py-2 font-medium text-sm flex items-center justify-between">
                          <span>
                            {source} ({sourceEpisodes.length} episodes)
                          </span>
                          <Badge variant="outline">
                            {Math.round((sourceEpisodes.length / episodes.length) * 100)}%
                          </Badge>
                        </div>
                        <ScrollArea className="max-h-[250px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[50px]">
                                  <Checkbox
                                    checked={sourceEpisodes.length > 0 && sourceEpisodes.every((ep) => ep.selected)}
                                    onCheckedChange={(checked) => {
                                      const updatedEpisodes = [...episodes]
                                      updatedEpisodes.forEach((ep) => {
                                        if (ep.source === source) {
                                          ep.selected = !!checked
                                        }
                                      })
                                      dispatchEpisodes({ type: "SET_EPISODES", episodes: updatedEpisodes })
                                    }}
                                    aria-label={`Select all episodes from ${source}`}
                                  />
                                </TableHead>
                                <TableHead className="w-[60px]">Episode</TableHead>
                                <TableHead>Name</TableHead>
                                <TableHead className="w-[90px]">Start</TableHead>
                                <TableHead className="w-[90px]">Status</TableHead>
                                <TableHead className="text-right w-[120px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {sourceEpisodes.map((episode, sourceIndex) => {
                                const index = episodes.findIndex(
                                  (ep) => ep.episode === episode.episode && ep.name === episode.name,
                                )

                                return (
                                  <TableRow key={`${episode.episode}-${sourceIndex}`}>
                                    {editingEpisodeIndex === index ? (
                                      // Edit mode
                                      <>
                                        <TableCell>
                                          <Checkbox
                                            checked={episode.selected || false}
                                            onCheckedChange={(checked) => {
                                              const updatedEpisodes = [...episodes]
                                              updatedEpisodes[index].selected = !!checked
                                              dispatchEpisodes({ type: "SET_EPISODES", episodes: updatedEpisodes })
                                            }}
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            type="number"
                                            value={editEpisodeForm.episode}
                                            onChange={(e) =>
                                              setEditEpisodeForm({
                                                ...editEpisodeForm,
                                                episode: Number.parseInt(e.target.value),
                                              })
                                            }
                                            className="w-16"
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            value={editEpisodeForm.name}
                                            onChange={(e) =>
                                              setEditEpisodeForm({ ...editEpisodeForm, name: e.target.value })
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <Input
                                            value={editEpisodeForm.start}
                                            onChange={(e) =>
                                              setEditEpisodeForm({ ...editEpisodeForm, start: e.target.value })
                                            }
                                          />
                                        </TableCell>
                                        <TableCell>
                                          <div className="flex items-center space-x-2">
                                            <Switch
                                              checked={editEpisodeForm.public}
                                              onCheckedChange={(checked) =>
                                                setEditEpisodeForm({ ...editEpisodeForm, public: checked })
                                              }
                                              id={`public-switch-${index}`}
                                            />
                                            <Label
                                              htmlFor={`public-switch-${index}`}
                                              className="text-xs sm:text-sm text-wrap"
                                            >
                                              {editEpisodeForm.public ? "Public" : "Private"}
                                            </Label>
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => saveEditingEpisode(index)}
                                            type="button"
                                          >
                                            <Save className="h-4 w-4 mr-1" />
                                            <span className="text-wrap">Save</span>
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={cancelEditingEpisode}
                                            type="button"
                                          >
                                            <X className="h-4 w-4" />
                                          </Button>
                                        </TableCell>
                                      </>
                                    ) : (
                                      // View mode
                                      <>
                                        <TableCell>
                                          <Checkbox
                                            checked={episode.selected || false}
                                            onCheckedChange={(checked) => {
                                              const updatedEpisodes = [...episodes]
                                              updatedEpisodes[index].selected = !!checked
                                              dispatchEpisodes({ type: "SET_EPISODES", episodes: updatedEpisodes })
                                            }}
                                            aria-label={`Select episode ${episode.episode}`}
                                          />
                                        </TableCell>
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
                                              type="button"
                                            >
                                              <ChevronUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => moveEpisode(index, "down")}
                                              disabled={index === episodes.length - 1}
                                              className="h-7 w-7"
                                              type="button"
                                            >
                                              <ChevronDown className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => startEditingEpisode(index)}
                                              className="h-7 w-7"
                                              type="button"
                                            >
                                              <Edit className="h-4 w-4" />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              onClick={() => confirmDeleteEpisode(index)}
                                              className="h-7 w-7"
                                              type="button"
                                            >
                                              <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                          </div>
                                        </TableCell>
                                      </>
                                    )}
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new episode form */}
                {showAddEpisodeForm && (
                  <div className="mt-4 border rounded-md p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium">Add New Episode</h4>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddEpisodeForm(false)} type="button">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="new-episode" className="mb-1 block text-xs">
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
                          <Label htmlFor="new-name" className="mb-1 block text-xs">
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

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <Label htmlFor="new-start" className="mb-1 block text-xs">
                            Start Time
                          </Label>
                          <Input
                            id="new-start"
                            value={newEpisode.start}
                            onChange={(e) => setNewEpisode({ ...newEpisode, start: e.target.value })}
                            placeholder="00:00:00"
                          />
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={newEpisode.public}
                          onCheckedChange={(checked) => setNewEpisode({ ...newEpisode, public: checked })}
                          id="new-public-switch"
                        />
                        <Label htmlFor="new-public-switch">{newEpisode.public ? "Public" : "Private"}</Label>
                      </div>

                      <div className="flex justify-end">
                        <Button onClick={handleAddEpisode} type="button">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Episode
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Episode Templates</CardTitle>
                <CardDescription>Apply predefined episode templates to quickly add episodes</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setIsTemplateDialogOpen(true)} type="button" className="w-full">
                  <Copy className="h-4 w-4 mr-2" />
                  Open Templates Library
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  // Render the settings step
  const renderSettingsStep = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Video Settings</CardTitle>
            <CardDescription>Configure settings for this APV video</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-md">
              <div className="flex items-center gap-3">
                <Pin className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="font-medium">Pin this video</h4>
                  <p className="text-sm text-muted-foreground">
                    Pinned videos appear prominently at the top of the list
                  </p>
                </div>
              </div>
              <Switch checked={formData.pinned} onCheckedChange={handlePinSwitchChange} id="pinned" />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-md">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <h4 className="font-medium">Active status</h4>
                  <p className="text-sm text-muted-foreground">Only active videos are visible to users</p>
                </div>
              </div>
              <Switch checked={formData.active} onCheckedChange={handleSwitchChange} id="active" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the review step
  const renderReviewStep = () => {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Review Your APV Video</CardTitle>
            <CardDescription>Review the information before saving</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Basic Information</h4>
                  <div className="border rounded-md p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="font-medium">Road:</span>
                      <span>{formData.road}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Position:</span>
                      <span>{formData.position}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Orientation:</span>
                      <span>{formData.orientation || "Not specified"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Version:</span>
                      <span>{formData.version || "Not specified"}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Settings</h4>
                  <div className="border rounded-md p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Status:</span>
                      <Badge variant={formData.active ? "default" : "outline"}>
                        {formData.active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Pinned:</span>
                      <Badge
                        variant={formData.pinned ? "default" : "outline"}
                        className={formData.pinned ? "bg-primary" : ""}
                      >
                        {formData.pinned ? "Pinned" : "Not Pinned"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Video</h4>
                  <div className="border rounded-md p-4">
                    {formData.dh ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Video URL:</span>
                          <Button size="sm" variant="ghost" onClick={copyVideoUrl}>
                            <Clipboard className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground break-all border p-2 rounded bg-muted">
                          {formData.dh}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-muted-foreground">No video URL provided</div>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Episodes</h4>
                  <div className="border rounded-md p-4">
                    {episodes.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Total Episodes:</span>
                          <Badge variant="outline">{episodes.length}</Badge>
                        </div>
                        <div className="space-y-1">
                          {Object.entries(episodesBySource).map(([source, sourceEpisodes]) => (
                            <div key={source} className="flex justify-between items-center text-sm">
                              <span>{source}:</span>
                              <Badge variant="outline" className="bg-muted/50">
                                {sourceEpisodes.length} episodes
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-2 text-muted-foreground">No episodes added</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {success && (
          <div className="bg-green-100 border border-green-500 text-green-900 px-4 py-3 rounded-md">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <p>APV video saved successfully!</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Render the current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case "basic":
        return renderBasicInfoStep()
      case "video":
        return renderVideoStep()
      case "episodes":
        return renderEpisodesStep()
      case "settings":
        return renderSettingsStep()
      case "review":
        return renderReviewStep()
    }
  }

  // Render the navigation buttons
  const renderNavButtons = () => {
    return (
      <div className="flex justify-between mt-6">
        {currentStep !== "basic" ? (
          <Button type="button" variant="outline" onClick={goToPreviousStep} disabled={loading}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
        )}

        {currentStep !== "review" ? (
          <Button type="button" onClick={goToNextStep} disabled={loading}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Update APV Video" : "Create APV Video"}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {renderStepIndicator()}
      {renderStepContent()}
      {renderNavButtons()}

      {/* Delete confirmation dialog */}
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

      {/* Episode Templates Dialog */}
      <EpisodeTemplates
        open={isTemplateDialogOpen}
        onOpenChange={setIsTemplateDialogOpen}
        onApplyTemplate={handleApplyTemplate}
      />
    </div>
  )
}
