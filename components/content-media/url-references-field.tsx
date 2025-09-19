"use client"

import { useState } from "react"
import { useFormContext } from "react-hook-form"
import { FormControl, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"

interface UrlReferencesFieldProps {
  disabled?: boolean
}

export function UrlReferencesField({ disabled = false }: UrlReferencesFieldProps) {
  const form = useFormContext()
  const [urls, setUrls] = useState<string[]>([""])

  // Add a new empty URL field
  const addUrl = () => {
    setUrls([...urls, ""])
  }

  // Remove a URL field at specific index
  const removeUrl = (index: number) => {
    const newUrls = [...urls]
    newUrls.splice(index, 1)
    setUrls(newUrls)

    // Update the form value
    const currentUrls = form.getValues("url_references") || []
    const updatedUrls = [...currentUrls]
    updatedUrls.splice(index, 1)
    form.setValue("url_references", updatedUrls, { shouldValidate: true })
  }

  // Handle URL input change
  const handleUrlChange = (value: string, index: number) => {
    // Update local state
    const newUrls = [...urls]
    newUrls[index] = value
    setUrls(newUrls)

    // Update form value
    const currentUrls = [...(form.getValues("url_references") || [])]
    while (currentUrls.length <= index) {
      currentUrls.push("")
    }
    currentUrls[index] = value
    form.setValue("url_references", currentUrls, { shouldValidate: true })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <FormLabel>URL References</FormLabel>
        <Button type="button" variant="outline" size="sm" onClick={addUrl} disabled={disabled}>
          <Plus className="h-4 w-4 mr-1" /> Add URL
        </Button>
      </div>

      {urls.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">No URL references added. Click "Add URL" to add one.</p>
      ) : (
        <div className="space-y-2">
          {urls.map((url, index) => (
            <div key={index} className="flex items-center gap-2">
              <FormItem className="flex-1 mb-0">
                <FormControl>
                  <Input
                    placeholder="Enter URL reference"
                    value={url}
                    onChange={(e) => handleUrlChange(e.target.value, index)}
                    disabled={disabled}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeUrl(index)}
                disabled={disabled}
                className="h-9 w-9 flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
