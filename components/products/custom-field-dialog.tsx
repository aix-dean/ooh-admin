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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Plus, Minus, AlertCircle } from "lucide-react"
import type { CustomFieldDefinition } from "@/types/custom-field"
import { CustomFieldService } from "@/lib/custom-field-service"

interface CustomFieldDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (fieldDef: CustomFieldDefinition) => Promise<void>
  loading?: boolean
}

export function CustomFieldDialog({ open, onOpenChange, onConfirm, loading = false }: CustomFieldDialogProps) {
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

  const dataTypes = [
    { value: "string", label: "Text" },
    { value: "number", label: "Number" },
    { value: "boolean", label: "True/False" },
    { value: "date", label: "Date" },
    { value: "array", label: "List" },
    { value: "object", label: "Object" },
  ]

  const validateField = (field: Partial<CustomFieldDefinition>): Record<string, string> => {
    const newErrors: Record<string, string> = {}

    if (!field.name?.trim()) {
      newErrors.name = "Field name is required"
    }

    if (!field.key?.trim()) {
      newErrors.key = "Field key is required"
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field.key)) {
      newErrors.key = "Field key must be a valid identifier (letters, numbers, underscore)"
    }

    if (field.dataType === "number" && field.defaultValue && isNaN(Number(field.defaultValue))) {
      newErrors.defaultValue = "Default value must be a valid number"
    }

    if (field.validation?.min !== undefined && field.validation?.max !== undefined) {
      if (field.validation.min > field.validation.max) {
        newErrors.validation = "Minimum value cannot be greater than maximum value"
      }
    }

    return newErrors
  }

  const handleFieldChange = (key: keyof CustomFieldDefinition, value: any) => {
    const updated = { ...fieldDef, [key]: value }

    // Auto-generate key from name if key is empty
    if (key === "name" && !fieldDef.key) {
      updated.key = value
        .toLowerCase()
        .replace(/[^a-zA-Z0-9]/g, "_")
        .replace(/^[0-9]/, "_$&")
    }

    setFieldDef(updated)

    // Clear related errors
    const newErrors = { ...errors }
    delete newErrors[key]
    setErrors(newErrors)
  }

  const handleValidationChange = (key: string, value: any) => {
    setFieldDef({
      ...fieldDef,
      validation: {
        ...fieldDef.validation,
        [key]: value,
      },
    })
  }

  const addValidationOption = () => {
    setValidationOptions([...validationOptions, ""])
  }

  const updateValidationOption = (index: number, value: string) => {
    const updated = [...validationOptions]
    updated[index] = value
    setValidationOptions(updated)
    handleValidationChange(
      "options",
      updated.filter((opt) => opt.trim()),
    )
  }

  const removeValidationOption = (index: number) => {
    const updated = validationOptions.filter((_, i) => i !== index)
    setValidationOptions(updated)
    handleValidationChange(
      "options",
      updated.filter((opt) => opt.trim()),
    )
  }

  const getDefaultValueForType = (dataType: string) => {
    switch (dataType) {
      case "string":
        return ""
      case "number":
        return 0
      case "boolean":
        return false
      case "date":
        return new Date().toISOString().split("T")[0]
      case "array":
        return []
      case "object":
        return {}
      default:
        return ""
    }
  }

  const handleDataTypeChange = (dataType: string) => {
    setFieldDef({
      ...fieldDef,
      dataType: dataType as CustomFieldDefinition["dataType"],
      defaultValue: getDefaultValueForType(dataType),
      validation: {},
    })
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

      // Check if field already exists in Firebase
      const existingField = await CustomFieldService.getFieldDefinitionByKey(completeFieldDef.key)
      if (existingField) {
        setErrors({ key: "A field with this key already exists in the database" })
        return
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
    } catch (error) {
      console.error("Error creating custom field:", error)
      setErrors({
        general: error instanceof Error ? error.message : "Failed to create custom field",
      })
    }
  }

  const renderDefaultValueInput = () => {
    switch (fieldDef.dataType) {
      case "boolean":
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id="defaultValue"
              checked={fieldDef.defaultValue === true}
              onCheckedChange={(checked) => handleFieldChange("defaultValue", checked)}
            />
            <Label htmlFor="defaultValue">Default to true</Label>
          </div>
        )
      case "number":
        return (
          <Input
            type="number"
            value={fieldDef.defaultValue || ""}
            onChange={(e) => handleFieldChange("defaultValue", Number(e.target.value))}
            placeholder="0"
          />
        )
      case "date":
        return (
          <Input
            type="date"
            value={fieldDef.defaultValue || ""}
            onChange={(e) => handleFieldChange("defaultValue", e.target.value)}
          />
        )
      case "array":
        return (
          <Textarea
            value={Array.isArray(fieldDef.defaultValue) ? fieldDef.defaultValue.join(", ") : ""}
            onChange={(e) =>
              handleFieldChange(
                "defaultValue",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="item1, item2, item3"
            className="min-h-[60px]"
          />
        )
      default:
        return (
          <Input
            value={fieldDef.defaultValue || ""}
            onChange={(e) => handleFieldChange("defaultValue", e.target.value)}
            placeholder="Default value"
          />
        )
    }
  }

  const renderValidationInputs = () => {
    switch (fieldDef.dataType) {
      case "string":
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="minLength">Min Length</Label>
                <Input
                  id="minLength"
                  type="number"
                  value={fieldDef.validation?.min || ""}
                  onChange={(e) => handleValidationChange("min", Number(e.target.value))}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="maxLength">Max Length</Label>
                <Input
                  id="maxLength"
                  type="number"
                  value={fieldDef.validation?.max || ""}
                  onChange={(e) => handleValidationChange("max", Number(e.target.value))}
                  placeholder="255"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pattern">Pattern (Regex)</Label>
              <Input
                id="pattern"
                value={fieldDef.validation?.pattern || ""}
                onChange={(e) => handleValidationChange("pattern", e.target.value)}
                placeholder="^[A-Za-z0-9]+$"
              />
            </div>
            <div>
              <Label>Allowed Values (Optional)</Label>
              <div className="space-y-2">
                {validationOptions.map((option, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateValidationOption(index, e.target.value)}
                      placeholder="Option value"
                    />
                    <Button type="button" variant="outline" size="icon" onClick={() => removeValidationOption(index)}>
                      <Minus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addValidationOption} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Option
                </Button>
              </div>
            </div>
          </div>
        )
      case "number":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="minValue">Min Value</Label>
              <Input
                id="minValue"
                type="number"
                value={fieldDef.validation?.min || ""}
                onChange={(e) => handleValidationChange("min", Number(e.target.value))}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="maxValue">Max Value</Label>
              <Input
                id="maxValue"
                type="number"
                value={fieldDef.validation?.max || ""}
                onChange={(e) => handleValidationChange("max", Number(e.target.value))}
                placeholder="100"
              />
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Custom Field</DialogTitle>
          <DialogDescription>
            Define a new custom field to add to products. Specify the data type, validation rules, and default value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="font-medium">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fieldName">Field Name *</Label>
                <Input
                  id="fieldName"
                  value={fieldDef.name || ""}
                  onChange={(e) => handleFieldChange("name", e.target.value)}
                  placeholder="Display name"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label htmlFor="fieldKey">Field Key *</Label>
                <Input
                  id="fieldKey"
                  value={fieldDef.key || ""}
                  onChange={(e) => handleFieldChange("key", e.target.value)}
                  placeholder="field_key"
                  className={errors.key ? "border-red-500" : ""}
                />
                {errors.key && <p className="text-sm text-red-500 mt-1">{errors.key}</p>}
              </div>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={fieldDef.description || ""}
                onChange={(e) => handleFieldChange("description", e.target.value)}
                placeholder="Optional description of this field"
                className="min-h-[60px]"
              />
            </div>
          </div>

          {/* Data Type */}
          <div className="space-y-4">
            <h4 className="font-medium">Data Type</h4>
            <Select onValueChange={handleDataTypeChange} value={fieldDef.dataType}>
              <SelectTrigger>
                <SelectValue placeholder="Select data type" />
              </SelectTrigger>
              <SelectContent>
                {dataTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Default Value */}
          <div className="space-y-4">
            <h4 className="font-medium">Default Value</h4>
            {renderDefaultValueInput()}
            {errors.defaultValue && <p className="text-sm text-red-500">{errors.defaultValue}</p>}
          </div>

          {/* Validation Rules */}
          <div className="space-y-4">
            <h4 className="font-medium">Validation Rules</h4>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="required"
                checked={fieldDef.required || false}
                onCheckedChange={(checked) => handleFieldChange("required", checked)}
              />
              <Label htmlFor="required">Required field</Label>
            </div>
            {renderValidationInputs()}
            {errors.validation && <p className="text-sm text-red-500">{errors.validation}</p>}
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <h4 className="font-medium">Preview</h4>
            <div className="rounded-lg border p-4 bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{fieldDef.dataType}</Badge>
                {fieldDef.required && <Badge variant="destructive">Required</Badge>}
              </div>
              <div className="font-medium">{fieldDef.name || "Field Name"}</div>
              <div className="text-sm text-muted-foreground">Key: {fieldDef.key || "field_key"}</div>
              {fieldDef.description && <div className="text-sm text-muted-foreground mt-1">{fieldDef.description}</div>}
              <div className="text-sm mt-2">
                Default: <code className="bg-muted px-1 rounded">{JSON.stringify(fieldDef.defaultValue)}</code>
              </div>
            </div>
          </div>

          {errors.general && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Error:</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{errors.general}</p>
            </div>
          )}

          {Object.keys(errors).length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Please fix the following errors:</span>
              </div>
              <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                {Object.values(errors).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Adding Field...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add Field
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
