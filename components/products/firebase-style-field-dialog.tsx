"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, AlertCircle, Database, Type, Hash, Calendar, ToggleLeft, List, Eye, EyeOff } from "lucide-react"
import type { CustomFieldDefinition } from "@/types/custom-field"

interface FirebaseStyleFieldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (fieldDef: CustomFieldDefinition) => Promise<void>
  loading?: boolean
}

// Firebase-style data types with icons and descriptions
const FIREBASE_DATA_TYPES = [
  {
    value: "string",
    label: "string",
    icon: <Type className="h-4 w-4" />,
    description: "UTF-8 encoded text",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  {
    value: "number",
    label: "number",
    icon: <Hash className="h-4 w-4" />,
    description: "64-bit floating point number",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  {
    value: "boolean",
    label: "boolean",
    icon: <ToggleLeft className="h-4 w-4" />,
    description: "True or false value",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-purple-200",
  },
  {
    value: "date",
    label: "timestamp",
    icon: <Calendar className="h-4 w-4" />,
    description: "Date and time value",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  {
    value: "array",
    label: "array",
    icon: <List className="h-4 w-4" />,
    description: "Ordered list of values",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  {
    value: "object",
    label: "map",
    icon: <Database className="h-4 w-4" />,
    description: "Key-value pairs",
    color: "text-indigo-600",
    bgColor: "bg-indigo-50",
    borderColor: "border-indigo-200",
  },
]

export function FirebaseStyleFieldDialog({
  open,
  onOpenChange,
  onConfirm,
  loading = false,
}: FirebaseStyleFieldDialogProps) {
  const [fieldDef, setFieldDef] = useState<Partial<CustomFieldDefinition>>({
    name: "",
    key: "",
    dataType: "string",
    defaultValue: "",
    required: false,
    validation: {},
    description: "",
  })
  const [validationOptions, setValidationOptions] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [currentTab, setCurrentTab] = useState("basic")

  const selectedType = FIREBASE_DATA_TYPES.find((type) => type.value === fieldDef.dataType)

  const validateField = (field: Partial<CustomFieldDefinition>): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    if (!field.name?.trim()) {
      newErrors.name = "Field name is required"
    } else if (field.name.length > 1500) {
      newErrors.name = "Field name must be 1500 characters or less"
    }

    if (!field.key?.trim()) {
      newErrors.key = "Field key is required"
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) {
      newErrors.key =
        "Field key must start with a letter or underscore and contain only letters, numbers, and underscores"
    } else if (field.key.length > 1500) {
      newErrors.key = "Field key must be 1500 characters or less"
    }

    // Validate default value based on type
    if (field.defaultValue !== undefined && field.defaultValue !== "") {
      try {
        validateValueForType(field.defaultValue, field.dataType!)
      } catch (error) {
        newErrors.defaultValue = error instanceof Error ? error.message : "Invalid default value"
      }
    }

    return newErrors
  }

  const validateValueForType = (value: any, type: string) => {
    switch (type) {
      case "number":
        if (isNaN(Number(value))) {
          throw new Error("Must be a valid number")
        }
        break
      case "boolean":
        if (typeof value !== "boolean" && value !== "true" && value !== "false") {
          throw new Error("Must be true or false")
        }
        break
      case "date":
        if (!(value instanceof Date) && isNaN(Date.parse(value))) {
          throw new Error("Must be a valid date")
        }
        break
      case "array":
        if (!Array.isArray(value) && typeof value === "string") {
          try {
            JSON.parse(value)
          } catch {
            throw new Error("Must be a valid array or JSON array string")
          }
        }
        break
      case "object":
        if (typeof value === "string") {
          try {
            JSON.parse(value)
          } catch {
            throw new Error("Must be a valid object or JSON object string")
          }
        } else if (typeof value !== "object" || Array.isArray(value)) {
          throw new Error("Must be a valid object")
        }
        break
    }
  }

  const handleFieldChange = (key: keyof CustomFieldDefinition, value: any) => {
    const updated = { ...fieldDef, [key]: value }

    // Auto-generate key from name if key is empty
    if (key === "name" && !fieldDef.key) {
      updated.key = value
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/^[0-9]/, "_$&")
        .substring(0, 1500)
    }

    setFieldDef(updated)

    // Clear related errors
    const newErrors = { ...errors }
    delete newErrors[key]
    setErrors(newErrors)
  }

  const handleDataTypeChange = (dataType: string) => {
    const newFieldDef = {
      ...fieldDef,
      dataType: dataType as CustomFieldDefinition["dataType"],
      validation: {},
    }

    // Set appropriate default value for type
    switch (dataType) {
      case "string":
        newFieldDef.defaultValue = ""
        break
      case "number":
        newFieldDef.defaultValue = 0
        break
      case "boolean":
        newFieldDef.defaultValue = false
        break
      case "date":
        newFieldDef.defaultValue = new Date().toISOString()
        break
      case "array":
        newFieldDef.defaultValue = []
        break
      case "object":
        newFieldDef.defaultValue = {}
        break
    }

    setFieldDef(newFieldDef)
    setValidationOptions([])
  }

  const handleConfirm = async () => {
    const validationErrors = validateField(fieldDef)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }

    try {
      const completeFieldDef: CustomFieldDefinition = {
        id: crypto.randomUUID(),
        name: fieldDef.name!,
        key: fieldDef.key!,
        dataType: fieldDef.dataType!,
        defaultValue: fieldDef.defaultValue,
        required: fieldDef.required || false,
        validation: fieldDef.validation,
        description: fieldDef.description,
      }

      await onConfirm(completeFieldDef)

      // Reset form
      setFieldDef({
        name: "",
        key: "",
        dataType: "string",
        defaultValue: "",
        required: false,
        validation: {},
        description: "",
      })
      setValidationOptions([])
      setErrors({})
      setCurrentTab("basic")
      setShowAdvanced(false)
    } catch (error) {
      console.error("Error creating custom field:", error)
      setErrors({
        general: error instanceof Error ? error.message : "Failed to create custom field",
      })
    }
  }

  const renderDataTypeSelector = () => (
    <div className="space-y-3">
      <Label className="text-sm font-medium text-gray-700">Type</Label>
      <div className="grid grid-cols-2 gap-2">
        {FIREBASE_DATA_TYPES.map((type) => (
          <Card
            key={type.value}
            className={`cursor-pointer transition-all hover:shadow-sm ${
              fieldDef.dataType === type.value
                ? `ring-2 ring-blue-500 ${type.bgColor} ${type.borderColor}`
                : "border-gray-200 hover:border-gray-300"
            }`}
            onClick={() => handleDataTypeChange(type.value)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className={`${fieldDef.dataType === type.value ? type.color : "text-gray-500"}`}>{type.icon}</div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${fieldDef.dataType === type.value ? type.color : "text-gray-700"}`}
                  >
                    {type.label}
                  </div>
                  <div className="text-xs text-gray-500">{type.description}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderDefaultValueInput = () => {
    if (!selectedType) return null

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium text-gray-700">Default value</Label>
          <Badge variant="outline" className={`text-xs ${selectedType.color} ${selectedType.borderColor}`}>
            {selectedType.label}
          </Badge>
        </div>

        {fieldDef.dataType === "boolean" ? (
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="defaultTrue"
                checked={fieldDef.defaultValue === true}
                onCheckedChange={(checked) => handleFieldChange("defaultValue", checked)}
              />
              <Label htmlFor="defaultTrue" className="text-sm">
                true
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="defaultFalse"
                checked={fieldDef.defaultValue === false}
                onCheckedChange={(checked) => handleFieldChange("defaultValue", !checked)}
              />
              <Label htmlFor="defaultFalse" className="text-sm">
                false
              </Label>
            </div>
          </div>
        ) : fieldDef.dataType === "number" ? (
          <Input
            type="number"
            value={fieldDef.defaultValue || ""}
            onChange={(e) => handleFieldChange("defaultValue", Number(e.target.value))}
            placeholder="0"
            className="font-mono"
          />
        ) : fieldDef.dataType === "date" ? (
          <Input
            type="datetime-local"
            value={
              fieldDef.defaultValue
                ? new Date(fieldDef.defaultValue).toISOString().slice(0, 16)
                : new Date().toISOString().slice(0, 16)
            }
            onChange={(e) => handleFieldChange("defaultValue", new Date(e.target.value).toISOString())}
          />
        ) : fieldDef.dataType === "array" ? (
          <Textarea
            value={
              Array.isArray(fieldDef.defaultValue)
                ? JSON.stringify(fieldDef.defaultValue, null, 2)
                : fieldDef.defaultValue || "[]"
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleFieldChange("defaultValue", parsed)
              } catch {
                handleFieldChange("defaultValue", e.target.value)
              }
            }}
            placeholder="[]"
            className="font-mono min-h-[80px]"
          />
        ) : fieldDef.dataType === "object" ? (
          <Textarea
            value={
              typeof fieldDef.defaultValue === "object"
                ? JSON.stringify(fieldDef.defaultValue, null, 2)
                : fieldDef.defaultValue || "{}"
            }
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value)
                handleFieldChange("defaultValue", parsed)
              } catch {
                handleFieldChange("defaultValue", e.target.value)
              }
            }}
            placeholder="{}"
            className="font-mono min-h-[80px]"
          />
        ) : (
          <Input
            value={fieldDef.defaultValue || ""}
            onChange={(e) => handleFieldChange("defaultValue", e.target.value)}
            placeholder="Enter default value"
            className="font-mono"
          />
        )}

        {errors.defaultValue && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="h-4 w-4" />
            {errors.defaultValue}
          </div>
        )}
      </div>
    )
  }

  const renderValidationRules = () => {
    if (!selectedType) return null

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-gray-700">Validation rules</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-blue-600 hover:text-blue-700"
          >
            {showAdvanced ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
            {showAdvanced ? "Hide" : "Show"} advanced
          </Button>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox
            id="required"
            checked={fieldDef.required || false}
            onCheckedChange={(checked) => handleFieldChange("required", checked)}
          />
          <Label htmlFor="required" className="text-sm">
            Required field
          </Label>
        </div>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
            {fieldDef.dataType === "string" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Minimum length</Label>
                    <Input
                      type="number"
                      min="0"
                      value={fieldDef.validation?.min || ""}
                      onChange={(e) =>
                        setFieldDef({
                          ...fieldDef,
                          validation: { ...fieldDef.validation, min: Number(e.target.value) },
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Maximum length</Label>
                    <Input
                      type="number"
                      min="0"
                      value={fieldDef.validation?.max || ""}
                      onChange={(e) =>
                        setFieldDef({
                          ...fieldDef,
                          validation: { ...fieldDef.validation, max: Number(e.target.value) },
                        })
                      }
                      placeholder="1500"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">Pattern (Regular Expression)</Label>
                  <Input
                    value={fieldDef.validation?.pattern || ""}
                    onChange={(e) =>
                      setFieldDef({
                        ...fieldDef,
                        validation: { ...fieldDef.validation, pattern: e.target.value },
                      })
                    }
                    placeholder="^[A-Za-z0-9]+$"
                    className="font-mono"
                  />
                </div>
              </div>
            )}

            {fieldDef.dataType === "number" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Minimum value</Label>
                  <Input
                    type="number"
                    value={fieldDef.validation?.min || ""}
                    onChange={(e) =>
                      setFieldDef({
                        ...fieldDef,
                        validation: { ...fieldDef.validation, min: Number(e.target.value) },
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label className="text-sm">Maximum value</Label>
                  <Input
                    type="number"
                    value={fieldDef.validation?.max || ""}
                    onChange={(e) =>
                      setFieldDef({
                        ...fieldDef,
                        validation: { ...fieldDef.validation, max: Number(e.target.value) },
                      })
                    }
                    placeholder="100"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderFieldPreview = () => (
    <div className="space-y-4">
      <Label className="text-sm font-medium text-gray-700">Field preview</Label>
      <Card className="border-2 border-dashed border-gray-200">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-500" />
              <span className="font-medium text-gray-900">{fieldDef.name || "Field name"}</span>
              {selectedType && (
                <Badge variant="outline" className={`${selectedType.color} ${selectedType.borderColor}`}>
                  {selectedType.label}
                </Badge>
              )}
              {fieldDef.required && (
                <Badge variant="destructive" className="text-xs">
                  Required
                </Badge>
              )}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-medium">Key:</span> {fieldDef.key || "field_key"}
            </div>
            {fieldDef.description && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Description:</span> {fieldDef.description}
              </div>
            )}
            <div className="text-sm text-gray-600">
              <span className="font-medium">Default:</span>{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                {fieldDef.defaultValue !== undefined ? JSON.stringify(fieldDef.defaultValue) : "null"}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="border-b border-gray-200 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Plus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-semibold text-gray-900">Add field</DialogTitle>
              <DialogDescription className="text-gray-600">
                Add a new field to your product collection
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3 bg-gray-100">
            <TabsTrigger value="basic" className="data-[state=active]:bg-white">
              Basic
            </TabsTrigger>
            <TabsTrigger value="validation" className="data-[state=active]:bg-white">
              Validation
            </TabsTrigger>
            <TabsTrigger value="preview" className="data-[state=active]:bg-white">
              Preview
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="basic" className="space-y-6 mt-0">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fieldName" className="text-sm font-medium text-gray-700">
                      Field name *
                    </Label>
                    <Input
                      id="fieldName"
                      value={fieldDef.name || ""}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      placeholder="Enter field name"
                      className={errors.name ? "border-red-500 focus:border-red-500" : ""}
                    />
                    {errors.name && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {errors.name}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fieldKey" className="text-sm font-medium text-gray-700">
                      Field key *
                    </Label>
                    <Input
                      id="fieldKey"
                      value={fieldDef.key || ""}
                      onChange={(e) => handleFieldChange("key", e.target.value)}
                      placeholder="field_key"
                      className={`font-mono ${errors.key ? "border-red-500 focus:border-red-500" : ""}`}
                    />
                    {errors.key && (
                      <div className="flex items-center gap-2 text-red-600 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        {errors.key}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="text-sm font-medium text-gray-700">
                    Description
                  </Label>
                  <Textarea
                    id="description"
                    value={fieldDef.description || ""}
                    onChange={(e) => handleFieldChange("description", e.target.value)}
                    placeholder="Optional description for this field"
                    className="min-h-[60px]"
                  />
                </div>

                <Separator />

                {renderDataTypeSelector()}

                <Separator />

                {renderDefaultValueInput()}
              </div>
            </TabsContent>

            <TabsContent value="validation" className="space-y-6 mt-0">
              {renderValidationRules()}
            </TabsContent>

            <TabsContent value="preview" className="space-y-6 mt-0">
              {renderFieldPreview()}

              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">Field path</Label>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <code className="text-sm text-gray-800">
                    products/{"{productId}"}/{fieldDef.key || "field_key"}
                  </code>
                </div>
              </div>

              <div className="space-y-4">
                <Label className="text-sm font-medium text-gray-700">Security rules</Label>
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <code className="text-sm text-gray-800 whitespace-pre-wrap">
                    {`// Allow read/write access to authenticated users
match /products/{productId} {
  allow read, write: if request.auth != null;
}`}
                  </code>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        {errors.general && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">{errors.general}</span>
            </div>
          </div>
        )}

        <DialogFooter className="border-t border-gray-200 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !fieldDef.name || !fieldDef.key}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Adding field...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add field
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
