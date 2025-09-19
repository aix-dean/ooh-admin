"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  getDocument,
  addFieldToDocument,
  removeFieldFromDocument,
  validateFieldValue,
  getFieldType,
} from "@/lib/document-operations"
import {
  Save,
  Plus,
  Trash2,
  AlertCircle,
  X,
  Hash,
  Type,
  ToggleLeft,
  List,
  Braces,
  Clock,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface DocumentEditorProps {
  collectionPath: string
  documentId: string
  onDocumentUpdated?: () => void
}

interface FieldEdit {
  name: string
  value: any
  type: string
  isNew?: boolean
  isModified?: boolean
  originalValue?: any
}

export function DocumentEditor({ collectionPath, documentId, onDocumentUpdated }: DocumentEditorProps) {
  const { toast } = useToast()
  const [document, setDocument] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<FieldEdit[]>([])
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldValue, setNewFieldValue] = useState("")
  const [newFieldType, setNewFieldType] = useState("string")
  const [showAddField, setShowAddField] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [unsavedChanges, setUnsavedChanges] = useState(false)

  useEffect(() => {
    loadDocument()
  }, [collectionPath, documentId])

  const loadDocument = async () => {
    setLoading(true)
    setError(null)
    try {
      const doc = await getDocument(collectionPath, documentId)
      if (doc) {
        setDocument(doc)
        const docFields = Object.entries(doc)
          .filter(([key]) => !key.startsWith("_"))
          .map(([key, value]) => ({
            name: key,
            value,
            type: getFieldType(value),
            originalValue: value,
          }))
        setFields(docFields)
      } else {
        setError("Document not found")
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleFieldChange = (fieldName: string, newValue: any, newType?: string) => {
    setFields((prev) =>
      prev.map((field) => {
        if (field.name === fieldName) {
          const isModified = JSON.stringify(newValue) !== JSON.stringify(field.originalValue)
          return {
            ...field,
            value: newValue,
            type: newType || field.type,
            isModified,
          }
        }
        return field
      }),
    )
    setUnsavedChanges(true)
  }

  const handleAddField = async () => {
    if (!newFieldName.trim()) {
      toast({
        title: "Validation Error",
        description: "Field name is required",
        variant: "destructive",
      })
      return
    }

    if (fields.some((f) => f.name === newFieldName)) {
      toast({
        title: "Validation Error",
        description: "Field name already exists",
        variant: "destructive",
      })
      return
    }

    const validation = validateFieldValue(newFieldValue, newFieldType)
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.error,
        variant: "destructive",
      })
      return
    }

    try {
      await addFieldToDocument(collectionPath, documentId, newFieldName, newFieldValue, newFieldType)

      setFields((prev) => [
        ...prev,
        {
          name: newFieldName,
          value: newFieldValue,
          type: newFieldType,
          isNew: true,
          originalValue: newFieldValue,
        },
      ])

      setNewFieldName("")
      setNewFieldValue("")
      setNewFieldType("string")
      setShowAddField(false)

      toast({
        title: "Success",
        description: "Field added successfully",
      })

      onDocumentUpdated?.()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const handleRemoveField = async (fieldName: string) => {
    try {
      await removeFieldFromDocument(collectionPath, documentId, fieldName)
      setFields((prev) => prev.filter((f) => f.name !== fieldName))

      toast({
        title: "Success",
        description: "Field removed successfully",
      })

      onDocumentUpdated?.()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const handleSaveField = async (field: FieldEdit) => {
    if (!field.isModified && !field.isNew) return

    const validation = validateFieldValue(field.value, field.type)
    if (!validation.isValid) {
      toast({
        title: "Validation Error",
        description: validation.error,
        variant: "destructive",
      })
      return
    }

    try {
      await addFieldToDocument(collectionPath, documentId, field.name, field.value, field.type)

      setFields((prev) =>
        prev.map((f) =>
          f.name === field.name ? { ...f, isModified: false, originalValue: f.value, isNew: false } : f,
        ),
      )

      setEditingField(null)
      setUnsavedChanges(false)

      toast({
        title: "Success",
        description: "Field updated successfully",
      })

      onDocumentUpdated?.()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    }
  }

  const handleSaveAllChanges = async () => {
    setSaving(true)
    const modifiedFields = fields.filter((f) => f.isModified)

    try {
      for (const field of modifiedFields) {
        await addFieldToDocument(collectionPath, documentId, field.name, field.value, field.type)
      }

      setFields((prev) =>
        prev.map((f) => ({
          ...f,
          isModified: false,
          originalValue: f.value,
          isNew: false,
        })),
      )

      setUnsavedChanges(false)

      toast({
        title: "Success",
        description: `${modifiedFields.length} fields updated successfully`,
      })

      onDocumentUpdated?.()
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getFieldIcon = (type: string) => {
    const icons = {
      string: Type,
      number: Hash,
      boolean: ToggleLeft,
      array: List,
      object: Braces,
      timestamp: Clock,
    }
    const Icon = icons[type as keyof typeof icons] || Type
    return <Icon className="h-4 w-4" />
  }

  const renderFieldValue = (field: FieldEdit) => {
    switch (field.type) {
      case "boolean":
        return (
          <Switch
            checked={Boolean(field.value)}
            onCheckedChange={(checked) => handleFieldChange(field.name, checked)}
          />
        )

      case "array":
        return <ArrayFieldEditor field={field} onUpdate={handleFieldChange} />

      case "object":
        return (
          <Textarea
            value={typeof field.value === "string" ? field.value : JSON.stringify(field.value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleFieldChange(field.name, parsed)
              } catch {
                handleFieldChange(field.name, e.target.value)
              }
            }}
            rows={4}
            className="font-mono text-sm"
          />
        )

      case "timestamp":
        return (
          <Input
            type="datetime-local"
            value={field.value?.toDate ? field.value.toDate().toISOString().slice(0, 16) : ""}
            onChange={(e) => handleFieldChange(field.name, e.target.value, "timestamp")}
          />
        )

      default:
        return (
          <Input
            value={String(field.value || "")}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={`Enter ${field.type} value`}
          />
        )
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          Loading document...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Edit Document</h3>
          <p className="text-sm text-muted-foreground">
            {collectionPath} / {documentId}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unsavedChanges && (
            <Badge variant="outline" className="text-orange-600 border-orange-200">
              Unsaved Changes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={loadDocument} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSaveAllChanges} disabled={!unsavedChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save All"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fields" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="raw">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          {/* Add New Field */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Add New Field</CardTitle>
                <Button variant="outline" size="sm" onClick={() => setShowAddField(!showAddField)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            {showAddField && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="field-name">Field Name</Label>
                    <Input
                      id="field-name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      placeholder="field_name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="field-type">Type</Label>
                    <Select value={newFieldType} onValueChange={setNewFieldType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="array">Array</SelectItem>
                        <SelectItem value="object">Object</SelectItem>
                        <SelectItem value="timestamp">Timestamp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="field-value">Value</Label>
                    <Input
                      id="field-value"
                      value={newFieldValue}
                      onChange={(e) => setNewFieldValue(e.target.value)}
                      placeholder="Enter value"
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleAddField} className="w-full">
                      Add
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Fields List */}
          <Card>
            <CardHeader>
              <CardTitle>Document Fields ({fields.length})</CardTitle>
              <CardDescription>Edit field values, types, and manage document structure</CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-4">
                  {fields.map((field) => (
                    <div
                      key={field.name}
                      className={cn(
                        "border rounded-lg p-4",
                        field.isModified && "border-orange-200 bg-orange-50/50",
                        field.isNew && "border-green-200 bg-green-50/50",
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getFieldIcon(field.type)}
                          <span className="font-medium">{field.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            {field.type}
                          </Badge>
                          {field.isModified && (
                            <Badge variant="outline" className="text-orange-600 border-orange-200">
                              Modified
                            </Badge>
                          )}
                          {field.isNew && (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              New
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSaveField(field)}
                            disabled={!field.isModified && !field.isNew}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Field</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to delete the field "{field.name}"? This action cannot be
                                  undone.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button variant="outline">Cancel</Button>
                                <Button variant="destructive" onClick={() => handleRemoveField(field.name)}>
                                  Delete
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`field-${field.name}`}>Value</Label>
                        {renderFieldValue(field)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardHeader>
              <CardTitle>Raw JSON View</CardTitle>
              <CardDescription>View the document structure in JSON format</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-96">
                {JSON.stringify(document, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Array Field Editor Component
interface ArrayFieldEditorProps {
  field: FieldEdit
  onUpdate: (fieldName: string, newValue: any) => void
}

function ArrayFieldEditor({ field, onUpdate }: ArrayFieldEditorProps) {
  const [newItem, setNewItem] = useState("")
  const [itemType, setItemType] = useState("string")

  const handleAddItem = () => {
    if (!newItem.trim()) return

    let convertedItem = newItem
    if (itemType === "number") {
      convertedItem = Number(newItem)
      if (isNaN(convertedItem)) return
    } else if (itemType === "boolean") {
      convertedItem = newItem === "true"
    }

    const currentArray = Array.isArray(field.value) ? field.value : []
    onUpdate(field.name, [...currentArray, convertedItem])
    setNewItem("")
  }

  const handleRemoveItem = (index: number) => {
    const currentArray = Array.isArray(field.value) ? field.value : []
    const newArray = currentArray.filter((_, i) => i !== index)
    onUpdate(field.name, newArray)
  }

  const currentArray = Array.isArray(field.value) ? field.value : []

  return (
    <div className="space-y-3">
      <div className="border rounded-lg p-3 bg-muted/50">
        <Label className="text-sm font-medium mb-2 block">Array Items ({currentArray.length})</Label>
        {currentArray.length === 0 ? (
          <p className="text-sm text-muted-foreground">No items in array</p>
        ) : (
          <div className="space-y-2">
            {currentArray.map((item, index) => (
              <div key={index} className="flex items-center justify-between bg-background rounded p-2">
                <span className="text-sm">{JSON.stringify(item)}</span>
                <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(index)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Select value={itemType} onValueChange={setItemType}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="string">String</SelectItem>
            <SelectItem value="number">Number</SelectItem>
            <SelectItem value="boolean">Boolean</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Add new item"
          className="flex-1"
        />
        <Button onClick={handleAddItem} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
