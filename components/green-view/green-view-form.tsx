"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { createGreenViewVideo, updateGreenViewVideo } from "@/lib/green-view"
import { useToast } from "@/hooks/use-toast"
import { Loader2, CheckCircle, AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

interface GreenViewFormProps {
  roadName: string
  onSuccess: () => void
  onCancel: () => void
  initialValues?: any
  isEditMode?: boolean
}

export function GreenViewForm({ roadName, onSuccess, onCancel, initialValues, isEditMode }: GreenViewFormProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [apvEpisodeError, setApvEpisodeError] = useState("")
  const [episodesError, setEpisodesError] = useState("")
  const [renderError, setRenderError] = useState<string | null>(null)
  const [episodeInput, setEpisodeInput] = useState("")

  // Debug log to verify props
  useEffect(() => {
    console.log("GreenViewForm props:", { roadName, initialValues, isEditMode })
  }, [roadName, initialValues, isEditMode])

  // Initialize form data with safe values
  const [formData, setFormData] = useState({
    road: isEditMode && initialValues?.road ? String(initialValues.road) : roadName,
    // Store position as string to avoid NaN issues with input fields
    position: initialValues?.position !== undefined ? String(initialValues.position) : "0",
    orientation: initialValues?.orientation ? String(initialValues.orientation) : "",
    version: initialValues?.version ? String(initialValues.version) : "",
    dh: initialValues?.dh ? String(initialValues.dh) : "",
    gl: initialValues?.gl ? String(initialValues.gl) : "",
    active: initialValues?.active !== undefined ? Boolean(initialValues.active) : true,
    episodes: Array.isArray(initialValues?.episodes) ? initialValues.episodes : [],
    apvEpisode: initialValues?.apvEpisode ? String(initialValues.apvEpisode) : "",
  })

  // Initialize episode input field from episodes array
  useEffect(() => {
    if (formData.episodes.length > 0) {
      setEpisodeInput(formData.episodes.join(", "))
    }
  }, [])

  // Debug log to verify form data
  useEffect(() => {
    console.log("Form data initialized:", formData)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    console.log(`Field changed: ${name} = ${value}`)

    if (name === "apvEpisode") {
      // Clear previous error
      setApvEpisodeError("")

      // Validate APV Episode format (e.g., APV-123 or similar pattern)
      if (value && !value.match(/^[A-Za-z0-9-]+$/)) {
        setApvEpisodeError("APV Episode should only contain letters, numbers, and hyphens")
      }
    }

    // Update form data with the new value
    setFormData({
      ...formData,
      [name]: value,
    })
  }

  const handleEpisodesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setEpisodeInput(value)
    setEpisodesError("")

    // Basic validation
    if (value.trim() !== "") {
      const episodeArray = value
        .split(",")
        .map((ep) => ep.trim())
        .filter((ep) => ep !== "")

      // Check for valid episode format
      const invalidEpisodes = episodeArray.filter((ep) => !ep.match(/^[A-Za-z0-9-]+$/))
      if (invalidEpisodes.length > 0) {
        setEpisodesError("Episodes should only contain letters, numbers, and hyphens")
        return
      }

      setFormData({
        ...formData,
        episodes: episodeArray,
      })
    } else {
      setFormData({
        ...formData,
        episodes: [],
      })
    }
  }

  const handleAddEpisode = () => {
    const episode = episodeInput.trim()
    if (!episode) return

    // Validate episode format
    if (!episode.match(/^[A-Za-z0-9-]+$/)) {
      setEpisodesError("Episode should only contain letters, numbers, and hyphens")
      return
    }

    // Check if episode already exists
    if (formData.episodes.includes(episode)) {
      setEpisodesError("This episode is already in the list")
      return
    }

    // Add episode to the list
    const updatedEpisodes = [...formData.episodes, episode]
    setFormData({
      ...formData,
      episodes: updatedEpisodes,
    })
    setEpisodeInput("")
    setEpisodesError("")
  }

  const handleRemoveEpisode = (episodeToRemove: string) => {
    const updatedEpisodes = formData.episodes.filter((episode) => episode !== episodeToRemove)
    setFormData({
      ...formData,
      episodes: updatedEpisodes,
    })
  }

  const handleSwitchChange = (checked: boolean) => {
    console.log(`Active switch changed: ${checked}`)
    setFormData({
      ...formData,
      active: checked,
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Form submitted with data:", formData)

    // Validate before submission
    if (apvEpisodeError || episodesError) {
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
      // Convert position to number for submission
      const submissionData = {
        ...formData,
        position: Number.parseFloat(formData.position) || 0, // Use 0 if parsing fails
      }

      console.log("Submitting data:", submissionData)

      if (isEditMode && initialValues?.id) {
        await updateGreenViewVideo(initialValues.id, submissionData)
        toast({
          title: "Success",
          description: "Green View video updated successfully",
        })
      } else {
        await createGreenViewVideo(submissionData)
        toast({
          title: "Success",
          description: "Green View video created successfully",
        })
      }
      setSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 1000)
    } catch (error) {
      console.error("Error saving Green View video:", error)
      toast({
        title: "Error",
        description: "Failed to save Green View video",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Catch any rendering errors
  try {
    return (
      <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-2xl mx-auto">
        {renderError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>Rendering error: {renderError}</AlertDescription>
          </Alert>
        )}

        {success && (
          <div className="bg-green-100 border border-green-500 text-green-900 px-4 py-3 rounded-md">
            <div className="flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              <p>Green View video saved successfully!</p>
            </div>
          </div>
        )}

        <div>
          <Label htmlFor="road" className="text-sm font-medium">
            Road
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
            className={!isEditMode ? "bg-muted cursor-not-allowed" : ""}
          />
          {!isEditMode && (
            <p className="text-xs text-muted-foreground mt-1">Road name is automatically set to the category name</p>
          )}
        </div>

        <div>
          <Label htmlFor="position" className="text-sm font-medium">
            Position
          </Label>
          <Input
            type="number"
            id="position"
            name="position"
            value={formData.position}
            onChange={handleChange}
            placeholder="Enter position"
            required
            min="0"
            step="1"
          />
        </div>

        {/* New Episodes Field */}
        <div>
          <Label htmlFor="episodes" className="text-sm font-medium">
            Episodes
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              id="episodes"
              value={episodeInput}
              onChange={handleEpisodesChange}
              placeholder="Enter episode (e.g., EP-123)"
              className={episodesError ? "border-red-500" : ""}
              aria-invalid={!!episodesError}
              aria-describedby={episodesError ? "episodes-error" : "episodes-help"}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddEpisode}
              disabled={!episodeInput.trim() || !!episodesError}
            >
              Add
            </Button>
          </div>
          {episodesError ? (
            <p id="episodes-error" className="text-xs text-red-500 mt-1">
              {episodesError}
            </p>
          ) : (
            <p id="episodes-help" className="text-xs text-muted-foreground mt-1">
              Add episodes associated with this Green View
            </p>
          )}

          {formData.episodes.length > 0 && (
            <div className="mt-2">
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.episodes.map((episode, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {episode}
                    <button
                      type="button"
                      onClick={() => handleRemoveEpisode(episode)}
                      className="ml-1 rounded-full hover:bg-gray-200 p-0.5"
                      aria-label={`Remove episode ${episode}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.episodes.length} episode{formData.episodes.length !== 1 ? "s" : ""} added
              </p>
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="orientation" className="text-sm font-medium">
            Orientation
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
          <Label htmlFor="version" className="text-sm font-medium">
            Version
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

        {/* APV Episode Field - Ensure it's visible and properly styled */}
        <div className="relative">
          <Label htmlFor="apvEpisode" className="text-sm font-medium">
            APV Episode
          </Label>
          <Input
            type="text"
            id="apvEpisode"
            name="apvEpisode"
            value={formData.apvEpisode}
            onChange={handleChange}
            placeholder="Enter APV episode (e.g., APV-123)"
            className={apvEpisodeError ? "border-red-500" : ""}
            aria-invalid={!!apvEpisodeError}
            aria-describedby={apvEpisodeError ? "apvEpisode-error" : "apvEpisode-help"}
          />
          {apvEpisodeError ? (
            <p id="apvEpisode-error" className="text-xs text-red-500 mt-1">
              {apvEpisodeError}
            </p>
          ) : (
            <p id="apvEpisode-help" className="text-xs text-muted-foreground mt-1">
              Specify the associated APV episode for this Green View
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="gl" className="text-sm font-medium">
            Tour URL
          </Label>
          <Textarea
            id="gl"
            name="gl"
            value={formData.gl}
            onChange={handleChange}
            placeholder="Enter tour URL"
            rows={3}
          />
        </div>

        <div className="flex items-center space-x-2 py-2">
          <Switch id="active" checked={formData.active} onCheckedChange={handleSwitchChange} />
          <Label htmlFor="active" className="text-sm font-medium">
            Active
          </Label>
        </div>

        {/* Ensure buttons are visible and properly styled */}
        <div className="flex justify-between pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={loading} className="min-w-[100px]">
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={loading || !!apvEpisodeError || !!episodesError}
            className="min-w-[200px]"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEditMode ? "Update Green View Video" : "Create Green View Video"}
          </Button>
        </div>
      </form>
    )
  } catch (error) {
    // Catch any rendering errors
    console.error("Rendering error:", error)
    setRenderError(error instanceof Error ? error.message : "Unknown error")

    // Fallback UI
    return (
      <div className="p-4 border border-red-500 rounded-md">
        <h3 className="text-red-500 font-bold">Error Rendering Form</h3>
        <p>There was an error rendering the form. Please try again or contact support.</p>
        <Button onClick={onCancel} className="mt-4">
          Go Back
        </Button>
      </div>
    )
  }
}
