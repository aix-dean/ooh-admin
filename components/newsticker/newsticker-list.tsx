"use client"

import { useState } from "react"
import type { Newsticker } from "@/types/newsticker"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Edit, Trash, Trash2, RotateCcw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { InlineEditForm } from "./inline-edit-form"
import { useToast } from "@/hooks/use-toast"

interface NewstickerListProps {
  newstickers: Newsticker[]
  loading: boolean
  error: string | null
  onEdit: (newsticker: Newsticker) => void
  onDelete: (newsticker: Newsticker) => void
  onRestore?: (newsticker: Newsticker) => void
  onInlineUpdate?: (updatedNewsticker: Newsticker) => void
  showRestore: boolean
  showHardDelete: boolean
  enableInlineEdit?: boolean
}

export function NewstickerList({
  newstickers,
  loading,
  error,
  onEdit,
  onDelete,
  onRestore,
  onInlineUpdate,
  showRestore,
  showHardDelete,
  enableInlineEdit = false,
}: NewstickerListProps) {
  const { toast } = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-destructive/10 p-4 rounded-md flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
        <div>
          <h3 className="font-medium text-destructive">Error</h3>
          <p className="text-sm text-destructive-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (newstickers.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-6 text-center">
          <p className="text-muted-foreground mb-4">No news tickers found</p>
          <p className="text-sm text-muted-foreground">
            {showRestore ? "The trash is empty." : "Create a new news ticker to get started."}
          </p>
        </CardContent>
      </Card>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 hover:bg-green-200"
      case "draft":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
      case "archived":
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200"
    }
  }

  const handleInlineEdit = (newsticker: Newsticker) => {
    if (enableInlineEdit) {
      setEditingId(newsticker.id)
    } else {
      onEdit(newsticker)
    }
  }

  const handleSaveInlineEdit = (updatedNewsticker: Newsticker) => {
    setEditingId(null)
    if (onInlineUpdate) {
      onInlineUpdate(updatedNewsticker)
      toast({
        title: "Success",
        description: "News ticker updated successfully",
      })
    }
  }

  const handleCancelInlineEdit = () => {
    setEditingId(null)
  }

  return (
    <div className="space-y-4">
      {newstickers.map((newsticker) => (
        <Card
          key={newsticker.id}
          className={`overflow-hidden transition-all duration-200 ${
            editingId === newsticker.id ? "ring-2 ring-primary shadow-md" : ""
          }`}
        >
          {editingId === newsticker.id ? (
            <InlineEditForm newsticker={newsticker} onSave={handleSaveInlineEdit} onCancel={handleCancelInlineEdit} />
          ) : (
            <>
              <div className="border-b p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{newsticker.title}</h3>
                      <Badge className={getStatusColor(newsticker.status)}>
                        {newsticker.status === "published" ? "Ongoing" : newsticker.status}
                      </Badge>
                      {newsticker.deleted && <Badge variant="destructive">Deleted</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{newsticker.content}</p>
                  </div>
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    {showRestore && onRestore && (
                      <Button variant="outline" size="sm" onClick={() => onRestore(newsticker)}>
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    )}
                    {!newsticker.deleted && (
                      <Button variant="outline" size="sm" onClick={() => handleInlineEdit(newsticker)}>
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(newsticker)}
                    >
                      {showHardDelete ? <Trash2 className="h-4 w-4 mr-1" /> : <Trash className="h-4 w-4 mr-1" />}
                      {showHardDelete ? "Delete Permanently" : "Delete"}
                    </Button>
                  </div>
                </div>
              </div>
              <CardContent className="p-4 pt-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Display Period</p>
                    <p>
                      {format(new Date(newsticker.start_time), "MMM d, yyyy")} -{" "}
                      {format(new Date(newsticker.end_time), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Position</p>
                    <p>{newsticker.position}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p>{format(new Date(newsticker.created), "MMM d, yyyy h:mm a")}</p>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      ))}
    </div>
  )
}
