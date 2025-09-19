"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CalendarIcon, X, Plus, Minus, RotateCcw, AlertCircle, CheckCircle, Lightbulb } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

interface DynamicFieldInputProps {
  fieldName: string
  fieldType: "string" | "number" | "boolean" | "array" | "object" | "timestamp" | "null"
  operation: "set" | "increment" | "array_union" | "array_remove" | "delete"
  value: any
  onChange: (value: any) => void
  onValidationChange?: (isValid: boolean, errors: string[], warnings: string[]) => void
  suggestions?: string[]
  placeholder?: string
  disabled?: boolean
  className?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  suggestions: string[]
}

export function DynamicFieldInput({
  fieldName,
  fieldType,
  operation,
  value,
  onChange,
  onValidationChange,
  suggestions = [],
  placeholder,
  disabled = false,
  className,
}: DynamicFieldInputProps) {
  const [internalValue, setInternalValue] = useState(value)
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    errors: [],
    warnings: [],
    suggestions: [],
  })
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [arrayItems, setArrayItems] = useState<string[]>([])
  const [objectFields, setObjectFields] = useState<Array<{ key: string; value: string }>>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value)
      if (fieldType === "array" && Array.isArray(value)) {
        setArrayItems(value.map(String))
      } else if (fieldType === "object" && typeof value === "object" && value !== null) {
        setObjectFields(Object.entries(value).map(([key, val]) => ({ key, value: String(val) })))
      }
    }
  }, [value, fieldType, internalValue])

  useEffect(() => {
    const result = validateInput(internalValue, fieldType, operation)
    setValidation(result)
    onValidationChange?.(result.isValid, result.errors, result.warnings)
  }, [internalValue, fieldType, operation])

  const validateInput = (val: any, type: string, op: string): ValidationResult => {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }

    if (op === "delete") {
      return result // No validation needed for delete operation
    }

    switch (type) {
      case "string":
        if (typeof val !== "string") {
          result.errors.push("Value must be a string")
          result.isValid = false
        } else if (val.length > 1000) {
          result.warnings.push("String is very long (>1000 characters)")
        }
        break

      case "number":
        const num = Number(val)
        if (isNaN(num)) {
          result.errors.push("Value must be a valid number")
          result.isValid = false
        } else if (op === "increment" && num === 0) {
          result.warnings.push("Incrementing by 0 will not change the value")
        } else if (Math.abs(num) > Number.MAX_SAFE_INTEGER) {
          result.warnings.push("Number is very large and may lose precision")
        }
        break

      case "boolean":
        if (typeof val !== "boolean" && val !== "true" && val !== "false") {
          result.errors.push("Value must be true or false")
          result.isValid = false
        }
        break

      case "array":
        try {
          let arrayVal = val
          if (typeof val === "string") {
            arrayVal = JSON.parse(val)
          }
          if (!Array.isArray(arrayVal)) {
            result.errors.push("Value must be a valid array")
            result.isValid = false
          } else if (arrayVal.length > 100) {
            result.warnings.push("Array has many elements (>100)")
          }
        } catch {
          result.errors.push("Invalid JSON array format")
          result.isValid = false
        }
        break

      case "object":
        try {
          let objVal = val
          if (typeof val === "string") {
            objVal = JSON.parse(val)
          }
          if (typeof objVal !== "object" || objVal === null || Array.isArray(objVal)) {
            result.errors.push("Value must be a valid object")
            result.isValid = false
          } else if (Object.keys(objVal).length > 50) {
            result.warnings.push("Object has many properties (>50)")
          }
        } catch {
          result.errors.push("Invalid JSON object format")
          result.isValid = false
        }
        break

      case "timestamp":
        const date = new Date(val)
        if (isNaN(date.getTime())) {
          result.errors.push("Value must be a valid date")
          result.isValid = false
        } else if (date.getFullYear() < 1900 || date.getFullYear() > 2100) {
          result.warnings.push("Date is outside typical range (1900-2100)")
        }
        break
    }

    // Add suggestions based on field name and type
    if (type === "string") {
      if (fieldName.toLowerCase().includes("email")) {
        result.suggestions.push("Use format: user@example.com")
      } else if (fieldName.toLowerCase().includes("url")) {
        result.suggestions.push("Use format: https://example.com")
      } else if (fieldName.toLowerCase().includes("phone")) {
        result.suggestions.push("Use format: +1234567890")
      }
    }

    return result
  }

  const handleValueChange = useCallback(
    (newValue: any) => {
      if (newValue !== internalValue) {
        setInternalValue(newValue)
        onChange(newValue)
      }
    },
    [internalValue, onChange],
  )

  const handleClear = () => {
    const defaultValue = getDefaultValue(fieldType)
    setInternalValue(defaultValue)
    onChange(defaultValue)
    if (fieldType === "array") {
      setArrayItems([])
    } else if (fieldType === "object") {
      setObjectFields([])
    }
  }

  const getDefaultValue = (type: string) => {
    switch (type) {
      case "string":
        return ""
      case "number":
        return 0
      case "boolean":
        return false
      case "array":
        return []
      case "object":
        return {}
      case "timestamp":
        return new Date().toISOString().slice(0, 16)
      case "null":
        return null
      default:
        return ""
    }
  }

  const addArrayItem = () => {
    const newItems = [...arrayItems, ""]
    setArrayItems(newItems)
    handleValueChange(newItems)
  }

  const updateArrayItem = (index: number, newValue: string) => {
    const newItems = [...arrayItems]
    newItems[index] = newValue
    setArrayItems(newItems)
    handleValueChange(newItems)
  }

  const removeArrayItem = (index: number) => {
    const newItems = arrayItems.filter((_, i) => i !== index)
    setArrayItems(newItems)
    handleValueChange(newItems)
  }

  const addObjectField = () => {
    const newFields = [...objectFields, { key: "", value: "" }]
    setObjectFields(newFields)
    updateObjectValue(newFields)
  }

  const updateObjectField = (index: number, key: string, value: string) => {
    const newFields = [...objectFields]
    newFields[index] = { key, value }
    setObjectFields(newFields)
    updateObjectValue(newFields)
  }

  const removeObjectField = (index: number) => {
    const newFields = objectFields.filter((_, i) => i !== index)
    setObjectFields(newFields)
    updateObjectValue(newFields)
  }

  const updateObjectValue = (fields: Array<{ key: string; value: string }>) => {
    const obj: Record<string, any> = {}
    fields.forEach(({ key, value }) => {
      if (key.trim()) {
        // Try to parse value as JSON, fallback to string
        try {
          obj[key] = JSON.parse(value)
        } catch {
          obj[key] = value
        }
      }
    })
    handleValueChange(obj)
  }

  const renderInput = () => {
    if (operation === "delete") {
      return (
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          <div className="text-center">
            <X className="h-8 w-8 mx-auto mb-2" />
            <p>Field will be deleted</p>
          </div>
        </div>
      )
    }

    switch (fieldType) {
      case "boolean":
        return (
          <div className="flex items-center space-x-4">
            <Switch checked={Boolean(internalValue)} onCheckedChange={handleValueChange} disabled={disabled} />
            <Label className="text-sm">{Boolean(internalValue) ? "True" : "False"}</Label>
          </div>
        )

      case "number":
        return (
          <div className="space-y-2">
            <Input
              ref={inputRef}
              type="number"
              value={internalValue}
              onChange={(e) => handleValueChange(e.target.value)}
              placeholder={placeholder || "Enter number"}
              disabled={disabled}
              className={cn(
                "transition-colors",
                !validation.isValid && "border-red-500 focus:border-red-500",
                validation.isValid && internalValue && "border-green-500",
              )}
            />
            {operation === "increment" && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleValueChange(Number(internalValue || 0) - 1)}
                  disabled={disabled}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleValueChange(Number(internalValue || 0) + 1)}
                  disabled={disabled}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        )

      case "timestamp":
        return (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !internalValue && "text-muted-foreground",
                  !validation.isValid && "border-red-500",
                  validation.isValid && internalValue && "border-green-500",
                )}
                disabled={disabled}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {internalValue ? format(new Date(internalValue), "PPP p") : "Pick a date and time"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={internalValue ? new Date(internalValue) : undefined}
                onSelect={(date) => {
                  if (date) {
                    handleValueChange(date.toISOString().slice(0, 16))
                  }
                }}
                initialFocus
              />
              <div className="p-3 border-t">
                <Input
                  type="time"
                  value={internalValue ? new Date(internalValue).toTimeString().slice(0, 5) : ""}
                  onChange={(e) => {
                    if (internalValue) {
                      const date = new Date(internalValue)
                      const [hours, minutes] = e.target.value.split(":")
                      date.setHours(Number.parseInt(hours), Number.parseInt(minutes))
                      handleValueChange(date.toISOString().slice(0, 16))
                    }
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
        )

      case "array":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Array Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addArrayItem} disabled={disabled}>
                <Plus className="h-3 w-3 mr-1" />
                Add Item
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {arrayItems.map((item, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={item}
                    onChange={(e) => updateArrayItem(index, e.target.value)}
                    placeholder={`Item ${index + 1}`}
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeArrayItem(index)}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {arrayItems.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No items in array. Click "Add Item" to start.
              </div>
            )}
          </div>
        )

      case "object":
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Object Properties</Label>
              <Button type="button" variant="outline" size="sm" onClick={addObjectField} disabled={disabled}>
                <Plus className="h-3 w-3 mr-1" />
                Add Property
              </Button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {objectFields.map((field, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={field.key}
                    onChange={(e) => updateObjectField(index, e.target.value, field.value)}
                    placeholder="Property name"
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Input
                    value={field.value}
                    onChange={(e) => updateObjectField(index, field.key, e.target.value)}
                    placeholder="Property value"
                    disabled={disabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeObjectField(index)}
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
            {objectFields.length === 0 && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No properties defined. Click "Add Property" to start.
              </div>
            )}
          </div>
        )

      case "string":
      default:
        return (
          <div className="space-y-2">
            <div className="relative">
              {internalValue && internalValue.length > 100 ? (
                <Textarea
                  value={internalValue}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={placeholder || "Enter text"}
                  disabled={disabled}
                  rows={4}
                  className={cn(
                    "transition-colors resize-none",
                    !validation.isValid && "border-red-500 focus:border-red-500",
                    validation.isValid && internalValue && "border-green-500",
                  )}
                />
              ) : (
                <Input
                  ref={inputRef}
                  value={internalValue}
                  onChange={(e) => handleValueChange(e.target.value)}
                  placeholder={placeholder || "Enter text"}
                  disabled={disabled}
                  className={cn(
                    "transition-colors",
                    !validation.isValid && "border-red-500 focus:border-red-500",
                    validation.isValid && internalValue && "border-green-500",
                  )}
                />
              )}

              {/* Suggestions dropdown */}
              {suggestions.length > 0 && showSuggestions && (
                <Card className="absolute top-full left-0 right-0 z-10 mt-1 max-h-48 overflow-y-auto">
                  <CardContent className="p-2">
                    {suggestions
                      .filter((suggestion) => suggestion.toLowerCase().includes(internalValue?.toLowerCase() || ""))
                      .slice(0, 5)
                      .map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start text-left"
                          onClick={() => {
                            handleValueChange(suggestion)
                            setShowSuggestions(false)
                          }}
                        >
                          {suggestion}
                        </Button>
                      ))}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Character count for strings */}
            {typeof internalValue === "string" && internalValue.length > 0 && (
              <div className="text-xs text-muted-foreground text-right">{internalValue.length} characters</div>
            )}
          </div>
        )
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Input field */}
      <div className="relative">
        {renderInput()}

        {/* Clear button */}
        {internalValue && operation !== "delete" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-0 right-0 h-full px-2"
            onClick={handleClear}
            disabled={disabled}
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Validation feedback */}
      {validation.errors.length > 0 && (
        <Alert className="border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <ul className="list-disc list-inside space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validation.warnings.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <ul className="list-disc list-inside space-y-1">
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {validation.suggestions.length > 0 && validation.isValid && (
        <Alert className="border-blue-200 bg-blue-50">
          <Lightbulb className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <div className="space-y-1">
              <div className="font-medium">Suggestions:</div>
              <ul className="list-disc list-inside space-y-1">
                {validation.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Success indicator */}
      {validation.isValid && internalValue && validation.errors.length === 0 && (
        <div className="flex items-center gap-2 text-green-600 text-sm">
          <CheckCircle className="h-4 w-4" />
          <span>Valid input</span>
        </div>
      )}
    </div>
  )
}
