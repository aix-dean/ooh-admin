"use client"

import { useState, useEffect, useCallback } from "react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, AlertTriangle, CheckSquare, Square, Loader2, Copy, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export interface Episode {
  episode: number
  name: string
  start: string
  end: string
  public: boolean
  description?: string
  thumbnail?: string
  selected?: boolean // Add this property
}

export type InheritanceStrategy = "append" | "replace" | "merge"

interface EpisodeInheritancePanelProps {
  sourceEpisodes: Episode[]
  currentEpisodes: Episode[]
  sourceName: string
  onApply: (selectedEpisodes: Episode[], strategy: InheritanceStrategy) => void
  onCancel: () => void
  isLoading?: boolean
}

export function EpisodeInheritancePanel({
  sourceEpisodes,
  currentEpisodes,
  sourceName,
  onApply,
  onCancel,
  isLoading = false,
}: EpisodeInheritancePanelProps) {
  const { toast } = useToast()
  const [selectedIndices, setSelectedIndices] = useState<number[]>([])
  const [selectAllChecked, setSelectAllChecked] = useState(false)
  const [strategy, setStrategy] = useState<InheritanceStrategy>("append")
  const [applyLoading, setApplyLoading] = useState(false)
  const [sourceEpisodesState, setSourceEpisodes] = useState<Episode[]>(sourceEpisodes)

  // Reset selections when source episodes change - with a key check to prevent unnecessary updates
  useEffect(() => {
    // Only reset if we actually have source episodes and they've changed
    setSelectedIndices([])
    setSelectAllChecked(false)
    setSourceEpisodes(sourceEpisodes)
  }, [sourceEpisodes]) // Only depend on the length to avoid deep comparisons

  // Handle select all toggle - memoized to prevent recreating on every render
  const handleSelectAll = useCallback(() => {
    const newSelectAllState = !selectAllChecked
    setSelectAllChecked(newSelectAllState)

    if (newSelectAllState) {
      // Select all episodes
      setSelectedIndices(sourceEpisodesState.map((_, index) => index))
    } else {
      // Deselect all episodes
      setSelectedIndices([])
    }
  }, [selectAllChecked, sourceEpisodesState])

  // Toggle individual episode selection - memoized to prevent recreating on every render
  const toggleEpisodeSelection = useCallback((index: number) => {
    setSelectedIndices((current) => {
      const newSelection = [...current]
      const selectionIndex = newSelection.indexOf(index)

      if (selectionIndex === -1) {
        newSelection.push(index)
      } else {
        newSelection.splice(selectionIndex, 1)
      }

      // Update select all state separately to avoid circular updates
      return newSelection
    })
  }, [])

  // Update selectAllChecked when selectedIndices changes
  useEffect(() => {
    const allSelected = selectedIndices.length === sourceEpisodesState.length && sourceEpisodesState.length > 0
    if (selectAllChecked !== allSelected) {
      setSelectAllChecked(allSelected)
    }
  }, [selectedIndices, sourceEpisodesState.length, selectAllChecked])

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectedIndices([])
    setSelectAllChecked(false)
  }, [])

  // Apply the selected episodes with the chosen strategy
  const handleApply = useCallback(async () => {
    if (selectedIndices.length === 0) {
      toast({
        title: "Selection Required",
        description: "Please select at least one episode to inherit",
        variant: "destructive",
      })
      return
    }

    setApplyLoading(true)
    try {
      // Get the selected episodes
      const selectedEpisodes = selectedIndices.map((index) => sourceEpisodesState[index])

      // Call the parent handler
      await onApply(selectedEpisodes, strategy)

      // Success message handled by parent
    } catch (error) {
      console.error("Error applying episodes:", error)
      toast({
        title: "Error",
        description: "Failed to apply episodes. Please try again.",
        variant: "destructive",
      })
    } finally {
      setApplyLoading(false)
    }
  }, [selectedIndices, sourceEpisodesState, strategy, onApply, toast])

  // Calculate preview statistics - memoized to prevent recalculating on every render
  const getPreviewStats = useCallback(() => {
    if (selectedIndices.length === 0) {
      return {
        currentCount: currentEpisodes.length,
        resultCount: currentEpisodes.length,
        hasConflicts: false,
        conflictCount: 0,
      }
    }

    const selectedCount = selectedIndices.length

    switch (strategy) {
      case "replace":
        return {
          currentCount: currentEpisodes.length,
          resultCount: selectedCount,
          hasConflicts: false,
          conflictCount: 0,
        }
      case "append":
        return {
          currentCount: currentEpisodes.length,
          resultCount: currentEpisodes.length + selectedCount,
          hasConflicts: false,
          conflictCount: 0,
        }
      case "merge":
        // Check for conflicts (episodes with the same number)
        const selectedEpisodes = selectedIndices.map((idx) => sourceEpisodesState[idx])
        const existingEpisodeNumbers = new Set(currentEpisodes.map((ep) => ep.episode))
        const conflictCount = selectedEpisodes.filter((ep) => existingEpisodeNumbers.has(ep.episode)).length

        return {
          currentCount: currentEpisodes.length,
          resultCount: currentEpisodes.length + selectedCount - conflictCount,
          hasConflicts: conflictCount > 0,
          conflictCount,
        }
    }
  }, [currentEpisodes, selectedIndices, sourceEpisodesState, strategy])

  const previewStats = getPreviewStats()

  return (
    <div className="mt-4 border rounded-md p-4 bg-muted/20">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-medium">Green View Episode Selection</h4>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            type="button"
            disabled={sourceEpisodesState.length === 0}
          >
            {selectAllChecked ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Deselect All
              </>
            ) : (
              <>
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </>
            )}
          </Button>
          {selectedIndices.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearSelections} type="button">
              <X className="h-4 w-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Inheritance Strategy</Label>
            <div className="grid grid-cols-1 gap-2">
              <div
                className={`flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer ${
                  strategy === "append" ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => setStrategy("append")}
              >
                <input
                  type="radio"
                  id="strategy-append"
                  checked={strategy === "append"}
                  onChange={() => setStrategy("append")}
                  className="h-4 w-4"
                />
                <div>
                  <Label htmlFor="strategy-append" className="font-medium cursor-pointer">
                    Append
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Add selected episodes to the end of the current list with new episode numbers
                  </p>
                </div>
              </div>

              <div
                className={`flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer ${
                  strategy === "replace" ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => setStrategy("replace")}
              >
                <input
                  type="radio"
                  id="strategy-replace"
                  checked={strategy === "replace"}
                  onChange={() => setStrategy("replace")}
                  className="h-4 w-4"
                />
                <div>
                  <Label htmlFor="strategy-replace" className="font-medium cursor-pointer">
                    Replace
                  </Label>
                  <p className="text-sm text-muted-foreground">Replace all current episodes with the selected ones</p>
                </div>
              </div>

              <div
                className={`flex items-center space-x-2 border rounded-md p-3 hover:bg-muted/50 cursor-pointer ${
                  strategy === "merge" ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => setStrategy("merge")}
              >
                <input
                  type="radio"
                  id="strategy-merge"
                  checked={strategy === "merge"}
                  onChange={() => setStrategy("merge")}
                  className="h-4 w-4"
                />
                <div>
                  <Label htmlFor="strategy-merge" className="font-medium cursor-pointer">
                    Merge
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Combine both sets, replacing any episodes with the same number
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Available Episodes</Label>
            <div className="border rounded-md">
              <ScrollArea className="h-[250px]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-[100px]">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">Loading episodes...</span>
                  </div>
                ) : sourceEpisodesState.length === 0 ? (
                  <div className="flex items-center justify-center h-[100px]">
                    <p className="text-muted-foreground">No episodes available</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Select</TableHead>
                        <TableHead>Episode</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Start</TableHead>
                        <TableHead>End</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceEpisodesState.map((episode, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Checkbox
                              checked={episode.selected || false}
                              onCheckedChange={(checked) => {
                                const updatedEpisodes = [...sourceEpisodesState]
                                updatedEpisodes[index] = { ...updatedEpisodes[index], selected: !!checked }
                                setSourceEpisodes(updatedEpisodes)

                                if (checked) {
                                  setSelectedIndices((prev) => [...prev, index])
                                } else {
                                  setSelectedIndices((prev) => prev.filter((i) => i !== index))
                                }
                              }}
                              aria-label={`Select episode ${episode.episode}`}
                            />
                          </TableCell>
                          <TableCell>{episode.episode}</TableCell>
                          <TableCell>{episode.name}</TableCell>
                          <TableCell>{episode.start}</TableCell>
                          <TableCell>{episode.end}</TableCell>
                          <TableCell>
                            <Badge variant={episode.public ? "default" : "outline"} className="text-xs">
                              {episode.public ? "Public" : "Private"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="border rounded-md p-4">
            <h4 className="font-medium mb-4">Inheritance Preview</h4>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div>
                  <p className="font-medium">Green View Category</p>
                  <p className="text-sm text-muted-foreground">{sourceName}</p>
                </div>
                <Badge variant="outline">{sourceEpisodesState.length} Episodes</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div>
                  <p className="font-medium">Current</p>
                  <p className="text-sm text-muted-foreground">This APV Video</p>
                </div>
                <Badge variant="outline">{currentEpisodes.length} Episodes</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md">
                <div>
                  <p className="font-medium">Selected</p>
                  <p className="text-sm text-muted-foreground">Episodes to inherit</p>
                </div>
                <Badge>{selectedIndices.length} Selected</Badge>
              </div>

              {selectedIndices.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-primary/10 rounded-md border-2 border-primary/20">
                  <div>
                    <p className="font-medium">Result</p>
                    <p className="text-sm text-muted-foreground">After applying {strategy} strategy</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <Badge variant="default">{previewStats.resultCount} Episodes</Badge>

                    {previewStats.hasConflicts && (
                      <div className="flex items-center mt-1 text-amber-600">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        <span className="text-xs">{previewStats.conflictCount} episode conflicts</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {strategy === "merge" && previewStats.hasConflicts && (
            <Alert variant="warning" className="bg-amber-50 border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Some episodes have the same episode numbers. Using the "Merge" strategy will replace existing episodes
                with the same numbers.
              </AlertDescription>
            </Alert>
          )}

          {strategy === "replace" && currentEpisodes.length > 0 && (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                The "Replace" strategy will remove all {currentEpisodes.length} existing episodes. This cannot be
                undone.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onCancel} type="button">
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applyLoading || selectedIndices.length === 0} type="button">
              {applyLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Copy className="h-4 w-4 mr-2" />
              Import Selected Episodes
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
