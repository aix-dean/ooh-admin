"use client"
import { X, Plus, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormDescription } from "@/components/ui/form"
import { useState, useEffect } from "react"

interface UrlReference {
  url: string
  label: string
}

interface EnhancedUrlReferencesFieldProps {
  value?: UrlReference[] | null
  onChange: (value: UrlReference[]) => void
  disabled?: boolean
}

export function EnhancedUrlReferencesField({ value, onChange, disabled = false }: EnhancedUrlReferencesFieldProps) {
  // Initialize with a default empty reference
  const [references, setReferences] = useState<UrlReference[]>([{ url: "", label: "" }])

  // Initialize from props with proper null/undefined handling
  useEffect(() => {
    if (Array.isArray(value) && value.length > 0) {
      // Map to ensure all properties exist and are strings
      const sanitizedReferences = value.map((ref) => ({
        url: typeof ref.url === "string" ? ref.url : "",
        label: typeof ref.label === "string" ? ref.label : "",
      }))
      setReferences(sanitizedReferences)
    } else {
      // Default to a single empty reference
      setReferences([{ url: "", label: "" }])
    }
  }, [value])

  // Update parent component when references change
  const updateReferences = (newReferences: UrlReference[]) => {
    // Ensure we're not passing undefined or null values
    const sanitizedReferences = newReferences.map((ref) => ({
      url: ref.url || "",
      label: ref.label || "",
    }))

    setReferences(sanitizedReferences)
    onChange(sanitizedReferences)
  }

  // Handle URL change
  const handleUrlChange = (index: number, url: string) => {
    if (index < 0 || index >= references.length) return

    const newReferences = [...references]
    newReferences[index] = {
      ...newReferences[index],
      url: url || "",
    }
    updateReferences(newReferences)
  }

  // Handle label change
  const handleLabelChange = (index: number, label: string) => {
    if (index < 0 || index >= references.length) return

    const newReferences = [...references]
    newReferences[index] = {
      ...newReferences[index],
      label: label || "",
    }
    updateReferences(newReferences)
  }

  // Add a new empty reference
  const addReference = () => {
    updateReferences([...references, { url: "", label: "" }])
  }

  // Remove a reference at the specified index
  const removeReference = (index: number) => {
    if (index < 0 || index >= references.length) return

    const newReferences = references.filter((_, i) => i !== index)
    // Ensure we always have at least one reference
    updateReferences(newReferences.length > 0 ? newReferences : [{ url: "", label: "" }])
  }

  return (
    <div className="space-y-4">
      {references.map((reference, index) => (
        <div key={`url-ref-${index}`} className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <div className="flex-grow">
              <div className="flex items-center space-x-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="https://example.com"
                  value={reference.url || ""}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  disabled={disabled}
                  aria-label={`URL reference ${index + 1}`}
                />
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeReference(index)}
              disabled={disabled || references.length === 1}
              aria-label="Remove URL reference"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Link label"
            value={reference.label || ""}
            onChange={(e) => handleLabelChange(index, e.target.value)}
            disabled={disabled}
            aria-label={`Label for URL reference ${index + 1}`}
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addReference} disabled={disabled}>
        <Plus className="h-4 w-4 mr-2" />
        Add URL Reference
      </Button>

      <FormDescription className="mt-2">Add links to external resources related to this content</FormDescription>
    </div>
  )
}
