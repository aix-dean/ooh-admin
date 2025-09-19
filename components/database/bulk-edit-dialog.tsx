"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BulkEditService } from "@/lib/bulk-edit-service"
import type { BulkEditField, BulkEditPreview, BulkEditResult, BulkEditValidation } from "@/types/bulk-edit"
import {
  Edit,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Play,
  RefreshCw,
  Settings,
  FileText,
  TrendingUp,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { DynamicFieldInput } from "./dynamic-field-input"
import { FieldSuggestionsService } from "@/lib/field-suggestions-service"

interface BulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  collectionPath: string
  selectedDocuments: string[]
  onComplete?: (result: BulkEditResult) => void
}

export function BulkEditDialog({
  open,
  onOpenChange,
  collectionPath,
  selectedDocuments,
  onComplete,
}: BulkEditDialogProps) {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState<"configure" | "preview" | "execute" | "results">("configure")
  const [fields, setFields] = useState<BulkEditField[]>([])
  const [commonFields, setCommonFields] = useState<Array<{ name: string; type: string; frequency: number }>>([])
  const [validation, setValidation] = useState<BulkEditValidation | null>(null)
  const [preview, setPreview] = useState<BulkEditPreview[]>([])
  const [result, setResult] = useState<BulkEditResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [suggestions, setSuggestions] = useState<{ [key: number]: string[] }>({})

  const updateField = (index: number, updates: Partial<BulkEditField>) => {
    setFields((prev) => prev.map((field, i) => (i === index ? { ...field, ...updates } : field)))
  }

  useEffect(() => {
    if (open && selectedDocuments.length > 0) {
      loadCommonFields()
    }
  }, [open, selectedDocuments, collectionPath])

  const loadCommonFields = async () => {
    try {
      setLoading(true)
      const fields = await BulkEditService.getCommonFields(collectionPath, selectedDocuments)
      setCommonFields(fields)
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to analyze fields: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const addField = () => {
    const newField: BulkEditField = {
      name: "",
      type: "string",
      value: "",
      operation: "set",
      enabled: true,
    }
    setFields([...fields, newField])
  }

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index))
  }

  const addCommonField = (commonField: { name: string; type: string }) => {
    const newField: BulkEditField = {
      name: commonField.name,
      type: commonField.type as any,
      value: "",
      operation: "set",
      enabled: true,
    }
    setFields([...fields, newField])
  }

  const validateFields = async () => {
    try {
      setLoading(true)
      const validation = await BulkEditService.validateBulkEdit(collectionPath, selectedDocuments, fields)
      setValidation(validation)

      if (validation.isValid) {
        setCurrentStep("preview")
        await generatePreview()
      } else {
        toast({
          title: "Validation Failed",
          description: validation.errors[0],
          variant: "destructive",
        })
      }
    } catch (error: any) {
      toast({
        title: "Validation Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const generatePreview = async () => {
    try {
      setLoading(true)
      const preview = await BulkEditService.generatePreview(collectionPath, selectedDocuments, fields)
      setPreview(preview)
    } catch (error: any) {
      toast({
        title: "Preview Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const executeEdit = async () => {
    try {
      setLoading(true)
      setCurrentStep("execute")
      setProgress(0)

      // Show warning for large selections
      if (selectedDocuments.length > 10000) {
        toast({
          title: "Large Selection",
          description: `Processing ${selectedDocuments.length.toLocaleString()} documents. This may take several minutes.`,
        })
      }

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + 10, 90))
      }, 500)

      const result = await BulkEditService.executeBulkEdit(collectionPath, selectedDocuments, fields)

      clearInterval(progressInterval)
      setProgress(100)
      setResult(result)
      setCurrentStep("results")

      toast({
        title: "Bulk Edit Complete",
        description: `Successfully updated ${result.successful} documents`,
      })

      onComplete?.(result)
    } catch (error: any) {
      toast({
        title: "Execution Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setCurrentStep("configure")
      setFields([])
      setValidation(null)
      setPreview([])
      setResult(null)
      setProgress(0)
      onOpenChange(false)
    }
  }

  useEffect(() => {
    fields.forEach((field, index) => {
      if (field.name && field.type && !suggestions[index]) {
        getFieldSuggestions(field.name, field.type).then((sugg) => {
          setSuggestions((prev) => ({ ...prev, [index]: sugg }))
        })
      }
    })
  }, [fields.length, collectionPath])

  const getFieldSuggestions = async (fieldName: string, fieldType: string): Promise<string[]> => {
    try {
      return await FieldSuggestionsService.getFieldSuggestions(collectionPath, fieldName, fieldType)
    } catch (error) {
      console.warn("Failed to get field suggestions:", error)
      return []
    }
  }

  const getFieldPlaceholder = (fieldName: string, fieldType: string, operation: string): string => {
    if (operation === "delete") return ""

    const lowerName = fieldName.toLowerCase()

    switch (fieldType) {
      case "string":
        if (lowerName.includes("email")) return "user@example.com"
        if (lowerName.includes("url")) return "https://example.com"
        if (lowerName.includes("phone")) return "+1234567890"
        if (lowerName.includes("name")) return "Enter name"
        if (lowerName.includes("title")) return "Enter title"
        if (lowerName.includes("description")) return "Enter description"
        return "Enter text"

      case "number":
        if (operation === "increment") return "Amount to add/subtract"
        if (lowerName.includes("price")) return "0.00"
        if (lowerName.includes("quantity")) return "1"
        if (lowerName.includes("age")) return "18"
        return "Enter number"

      case "array":
        if (operation === "array_union") return "Items to add to array"
        if (operation === "array_remove") return "Items to remove from array"
        return "Array items"

      case "object":
        return "Object properties"

      case "timestamp":
        return "Select date and time"

      case "boolean":
        return ""

      default:
        return `Enter ${fieldType}`
    }
  }

  const renderFieldInput = (field: BulkEditField, index: number) => {
    return (
      <DynamicFieldInput
        fieldName={field.name}
        fieldType={field.type}
        operation={field.operation}
        value={field.value}
        onChange={(value) => updateField(index, { value })}
        onValidationChange={(isValid, errors, warnings) => {
          updateField(index, {
            _validation: { isValid, errors, warnings },
          })
        }}
        suggestions={suggestions[index] || []}
        placeholder={getFieldPlaceholder(field.name, field.type, field.operation)}
        disabled={!field.enabled}
        className="w-full"
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Bulk Edit Documents
          </DialogTitle>
          <DialogDescription>
            Edit {selectedDocuments.length.toLocaleString()} documents in {collectionPath}
            {selectedDocuments.length > 10000 && (
              <Alert className="mt-2 border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  <strong>Large Selection:</strong> You have selected {selectedDocuments.length.toLocaleString()}{" "}
                  documents. This operation may take several minutes to complete.
                </AlertDescription>
              </Alert>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={currentStep} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="configure" className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configure
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!validation?.isValid}>
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="execute" className="flex items-center gap-2" disabled={preview.length === 0}>
                <Play className="h-4 w-4" />
                Execute
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2" disabled={!result}>
                <TrendingUp className="h-4 w-4" />
                Results
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-4">
              <TabsContent value="configure" className="mt-0 space-y-6">
                {/* Selection Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Selection Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-sm font-medium">Collection</Label>
                        <div className="text-sm">{collectionPath}</div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Selected Documents</Label>
                        <div className="text-sm">{selectedDocuments.length.toLocaleString()} documents</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Common Fields */}
                {commonFields.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Common Fields</CardTitle>
                      <CardDescription>
                        Fields found in the selected documents. Click to add to edit list.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {commonFields.map((field) => (
                          <Button
                            key={field.name}
                            variant="outline"
                            size="sm"
                            onClick={() => addCommonField(field)}
                            className="justify-start"
                          >
                            <span className="truncate">{field.name}</span>
                            <Badge variant="secondary" className="ml-2 text-xs">
                              {field.type}
                            </Badge>
                            <span className="ml-auto text-xs text-muted-foreground">
                              {Math.round(field.frequency * 100)}%
                            </span>
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Edit Fields */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Edit Fields</CardTitle>
                      <Button onClick={addField} size="sm">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Field
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {fields.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No fields configured for editing</p>
                        <p className="text-sm">Add fields using the button above or select from common fields</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {fields.map((field, index) => (
                          <Card key={index} className="border-l-4 border-l-blue-500">
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-12 gap-4 items-end">
                                <div className="col-span-1">
                                  <Switch
                                    checked={field.enabled}
                                    onCheckedChange={(enabled) => updateField(index, { enabled })}
                                  />
                                </div>

                                <div className="col-span-2">
                                  <Label>Field Name</Label>
                                  <Input
                                    value={field.name}
                                    onChange={(e) => updateField(index, { name: e.target.value })}
                                    placeholder="field_name"
                                  />
                                </div>

                                <div className="col-span-2">
                                  <Label>Operation</Label>
                                  <Select
                                    value={field.operation}
                                    onValueChange={(operation: any) => updateField(index, { operation })}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="set">Set Value</SelectItem>
                                      <SelectItem value="increment">Increment</SelectItem>
                                      <SelectItem value="array_union">Add to Array</SelectItem>
                                      <SelectItem value="array_remove">Remove from Array</SelectItem>
                                      <SelectItem value="delete">Delete Field</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="col-span-2">
                                  <Label>Type</Label>
                                  <Select
                                    value={field.type}
                                    onValueChange={(type: any) => updateField(index, { type })}
                                  >
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
                                      <SelectItem value="null">Null</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="col-span-4">
                                  <Label>Value</Label>
                                  {field.operation !== "delete" && renderFieldInput(field, index)}
                                </div>

                                <div className="col-span-1">
                                  <Button variant="ghost" size="sm" onClick={() => removeField(index)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Validation */}
                {validation && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Validation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {validation.errors.length > 0 && (
                        <Alert className="mb-4">
                          <XCircle className="h-4 w-4" />
                          <AlertTitle>Validation Errors</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside space-y-1">
                              {validation.errors.map((error, index) => (
                                <li key={index}>{error}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {validation.warnings.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>Warnings</AlertTitle>
                          <AlertDescription>
                            <ul className="list-disc list-inside space-y-1">
                              {validation.warnings.map((warning, index) => (
                                <li key={index}>{warning}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}

                      {validation.isValid && (
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertTitle>Validation Passed</AlertTitle>
                          <AlertDescription>Ready to edit {validation.affectedDocuments} documents</AlertDescription>
                        </Alert>
                      )}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="preview" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Preview Changes</CardTitle>
                    <CardDescription>Review the changes that will be applied to your documents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                        Generating preview...
                      </div>
                    ) : (
                      <ScrollArea className="h-96">
                        <div className="space-y-4">
                          {preview.map((doc) => (
                            <Card key={doc.documentId} className="border-l-4 border-l-green-500">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-base">{doc.documentName || doc.documentId}</CardTitle>
                                  <div className="flex gap-2">
                                    {doc.changes.length > 0 && (
                                      <Badge variant="outline" className="text-green-600">
                                        {doc.changes.length} changes
                                      </Badge>
                                    )}
                                    {doc.warnings.length > 0 && (
                                      <Badge variant="outline" className="text-yellow-600">
                                        {doc.warnings.length} warnings
                                      </Badge>
                                    )}
                                    {doc.errors.length > 0 && (
                                      <Badge variant="outline" className="text-red-600">
                                        {doc.errors.length} errors
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </CardHeader>
                              <CardContent>
                                {doc.changes.length > 0 && (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Field</TableHead>
                                        <TableHead>Operation</TableHead>
                                        <TableHead>Current</TableHead>
                                        <TableHead>New</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {doc.changes.map((change, index) => (
                                        <TableRow key={index}>
                                          <TableCell className="font-medium">{change.field}</TableCell>
                                          <TableCell>
                                            <Badge variant="secondary">{change.operation}</Badge>
                                          </TableCell>
                                          <TableCell className="max-w-32 truncate">
                                            {JSON.stringify(change.oldValue)}
                                          </TableCell>
                                          <TableCell className="max-w-32 truncate">
                                            {JSON.stringify(change.newValue)}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}

                                {doc.warnings.length > 0 && (
                                  <Alert className="mt-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    <AlertTitle>Warnings</AlertTitle>
                                    <AlertDescription>
                                      <ul className="list-disc list-inside">
                                        {doc.warnings.map((warning, index) => (
                                          <li key={index}>{warning}</li>
                                        ))}
                                      </ul>
                                    </AlertDescription>
                                  </Alert>
                                )}

                                {doc.errors.length > 0 && (
                                  <Alert className="mt-4">
                                    <XCircle className="h-4 w-4" />
                                    <AlertTitle>Errors</AlertTitle>
                                    <AlertDescription>
                                      <ul className="list-disc list-inside">
                                        {doc.errors.map((error, index) => (
                                          <li key={index}>{error}</li>
                                        ))}
                                      </ul>
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="execute" className="mt-0">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Executing Bulk Edit</CardTitle>
                    <CardDescription>
                      Please wait while we apply changes to your {selectedDocuments.length.toLocaleString()} documents
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <Progress value={progress} className="w-full" />
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground">
                          {progress < 100 ? `Processing... ${progress}%` : "Complete!"}
                        </p>
                        {selectedDocuments.length > 1000 && progress < 100 && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Large operations are processed in batches. This may take several minutes.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="mt-0">
                {result && (
                  <div className="space-y-6">
                    {/* Summary */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Execution Results</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center">
                            <div className="text-2xl font-bold text-green-600">{result.successful}</div>
                            <div className="text-sm text-muted-foreground">Successful</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-red-600">{result.failed}</div>
                            <div className="text-sm text-muted-foreground">Failed</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold text-yellow-600">{result.skipped}</div>
                            <div className="text-sm text-muted-foreground">Skipped</div>
                          </div>
                          <div className="text-center">
                            <div className="text-2xl font-bold">{result.executionTime}ms</div>
                            <div className="text-sm text-muted-foreground">Execution Time</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Errors */}
                    {result.errors.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg text-red-600">Errors</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {result.errors.map((error, index) => (
                                <div key={index} className="flex items-start gap-2 p-2 bg-red-50 rounded">
                                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <div className="font-medium text-sm">{error.documentId}</div>
                                    <div className="text-sm text-muted-foreground">{error.error}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}

                    {/* Warnings */}
                    {result.warnings.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg text-yellow-600">Warnings</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ScrollArea className="h-48">
                            <div className="space-y-2">
                              {result.warnings.map((warning, index) => (
                                <div key={index} className="flex items-start gap-2 p-2 bg-yellow-50 rounded">
                                  <AlertTriangle className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                                  <div>
                                    <div className="font-medium text-sm">{warning.documentId}</div>
                                    <div className="text-sm text-muted-foreground">{warning.warning}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {result ? "Close" : "Cancel"}
          </Button>

          {currentStep === "configure" && (
            <Button onClick={validateFields} disabled={loading || fields.filter((f) => f.enabled).length === 0}>
              {loading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview Changes
                </>
              )}
            </Button>
          )}

          {currentStep === "preview" && (
            <Button onClick={executeEdit} disabled={loading}>
              <Play className="mr-2 h-4 w-4" />
              Execute Bulk Edit
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
