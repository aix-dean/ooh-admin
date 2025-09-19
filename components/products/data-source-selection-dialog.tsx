"use client"

import { useState, useEffect } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Database,
  Globe,
  Calculator,
  FileText,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Eye,
  Settings,
  Zap,
  TrendingUp,
  AlertTriangle,
} from "lucide-react"
import type {
  DataSource,
  DataMapping,
  DataMappingPreview,
  DataSourceField,
  TransformationConfig,
} from "@/types/data-source"
import type { CustomFieldDefinition } from "@/types/custom-field"
import { DataSourceService } from "@/lib/data-source-service"

interface DataSourceSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fieldDefinition: CustomFieldDefinition
  onConfirm: (mapping: DataMapping) => Promise<void>
  loading?: boolean
}

export function DataSourceSelectionDialog({
  open,
  onOpenChange,
  fieldDefinition,
  onConfirm,
  loading = false,
}: DataSourceSelectionDialogProps) {
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [selectedSource, setSelectedSource] = useState<DataSource | null>(null)
  const [selectedField, setSelectedField] = useState<DataSourceField | null>(null)
  const [mapping, setMapping] = useState<DataMapping>({
    source_field: "",
    target_field: fieldDefinition.key,
    transformation: {
      type: "direct",
      config: {},
    },
  })
  const [preview, setPreview] = useState<DataMappingPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [currentTab, setCurrentTab] = useState("source")
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      loadDataSources()
    }
  }, [open])

  useEffect(() => {
    if (selectedSource && selectedField && mapping.source_field) {
      generatePreview()
    }
  }, [selectedSource, selectedField, mapping])

  const loadDataSources = async () => {
    try {
      const sources = await DataSourceService.getAvailableDataSources()
      setDataSources(sources)
    } catch (error) {
      console.error("Error loading data sources:", error)
      setErrors({ general: "Failed to load data sources" })
    }
  }

  const generatePreview = async () => {
    if (!selectedSource || !mapping.source_field) return

    try {
      setPreviewLoading(true)
      const previewData = await DataSourceService.previewDataMapping(selectedSource.id, mapping, 10)
      setPreview(previewData)
    } catch (error) {
      console.error("Error generating preview:", error)
      setErrors({ preview: "Failed to generate preview" })
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSourceSelect = (source: DataSource) => {
    setSelectedSource(source)
    setSelectedField(null)
    setMapping({
      ...mapping,
      source_field: "",
    })
    setPreview(null)
    setCurrentTab("field")
  }

  const handleFieldSelect = (field: DataSourceField) => {
    setSelectedField(field)
    setMapping({
      ...mapping,
      source_field: field.key,
    })
    setCurrentTab("transform")
  }

  const handleTransformationChange = (type: string, config: TransformationConfig) => {
    setMapping({
      ...mapping,
      transformation: {
        type: type as any,
        config,
      },
    })
  }

  const handleConfirm = async () => {
    try {
      await onConfirm(mapping)
      onOpenChange(false)
    } catch (error) {
      console.error("Error confirming mapping:", error)
      setErrors({ general: "Failed to apply data mapping" })
    }
  }

  const getSourceIcon = (type: string) => {
    switch (type) {
      case "existing_field":
        return <Database className="h-4 w-4" />
      case "external_api":
        return <Globe className="h-4 w-4" />
      case "computed":
        return <Calculator className="h-4 w-4" />
      case "static":
        return <FileText className="h-4 w-4" />
      default:
        return <Database className="h-4 w-4" />
    }
  }

  const getTypeCompatibility = (sourceType: string, targetType: string) => {
    const compatibilityMatrix: Record<string, string[]> = {
      string: ["string", "number", "boolean"],
      number: ["number", "string", "boolean"],
      boolean: ["boolean", "string", "number"],
      date: ["date", "string"],
      array: ["array", "string"],
      object: ["object", "string"],
    }

    const compatible = compatibilityMatrix[sourceType]?.includes(targetType)
    return {
      compatible,
      level: compatible ? (sourceType === targetType ? "perfect" : "good") : "poor",
    }
  }

  const renderSourceSelection = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Select Data Source</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose where the data for "{fieldDefinition.name}" will come from.
        </p>
      </div>

      <div className="grid gap-3">
        {dataSources.map((source) => (
          <Card
            key={source.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              selectedSource?.id === source.id ? "ring-2 ring-primary" : ""
            } ${!source.available ? "opacity-50" : ""}`}
            onClick={() => source.available && handleSourceSelect(source)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getSourceIcon(source.type)}
                  <div>
                    <CardTitle className="text-base">{source.name}</CardTitle>
                    <CardDescription className="text-sm">{source.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {source.available ? (
                    <Badge variant="outline" className="text-green-600 border-green-200">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Available
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-red-600 border-red-200">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Unavailable
                    </Badge>
                  )}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </CardHeader>
            {source.schema && (
              <CardContent className="pt-0">
                <div className="text-xs text-muted-foreground">
                  {source.schema.fields.length} fields available
                  {source.schema.total_records && ` • ${source.schema.total_records} records`}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )

  const renderFieldSelection = () => {
    if (!selectedSource?.schema) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">No fields available for this data source</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Select Source Field</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Choose which field from "{selectedSource.name}" to map to "{fieldDefinition.name}".
          </p>
        </div>

        <ScrollArea className="h-96">
          <div className="space-y-2">
            {selectedSource.schema.fields.map((field) => {
              const compatibility = getTypeCompatibility(field.type, fieldDefinition.dataType)

              return (
                <Card
                  key={field.key}
                  className={`cursor-pointer transition-all hover:shadow-sm ${
                    selectedField?.key === field.key ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleFieldSelect(field)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{field.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {field.type}
                          </Badge>
                          {compatibility.compatible ? (
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                compatibility.level === "perfect"
                                  ? "text-green-600 border-green-200"
                                  : "text-blue-600 border-blue-200"
                              }`}
                            >
                              {compatibility.level === "perfect" ? "Perfect Match" : "Compatible"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                              Type Conversion Required
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{field.description || `Key: ${field.key}`}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {field.unique_count && <span>{field.unique_count} unique values</span>}
                          {field.null_count !== undefined && <span>{field.null_count} null values</span>}
                          {field.nullable && <span>Nullable</span>}
                        </div>
                        {field.sample_values && field.sample_values.length > 0 && (
                          <div className="mt-2">
                            <span className="text-xs text-muted-foreground">Sample values: </span>
                            <span className="text-xs">
                              {field.sample_values
                                .slice(0, 3)
                                .map((v) => JSON.stringify(v))
                                .join(", ")}
                              {field.sample_values.length > 3 && "..."}
                            </span>
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </ScrollArea>
      </div>
    )
  }

  const renderTransformationConfig = () => (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-2">Configure Data Transformation</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Specify how to transform data from "{selectedField?.name}" to "{fieldDefinition.name}".
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label htmlFor="transformationType">Transformation Type</Label>
          <Select
            value={mapping.transformation?.type || "direct"}
            onValueChange={(value) => handleTransformationChange(value, {})}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select transformation type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="direct">Direct Copy</SelectItem>
              <SelectItem value="format">Format Value</SelectItem>
              <SelectItem value="calculate">Calculate</SelectItem>
              <SelectItem value="lookup">Lookup Table</SelectItem>
              <SelectItem value="conditional">Conditional</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mapping.transformation?.type === "format" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="formatString">Format String</Label>
              <Input
                id="formatString"
                placeholder="e.g., {value} USD"
                value={mapping.transformation.config.format_string || ""}
                onChange={(e) =>
                  handleTransformationChange("format", {
                    ...mapping.transformation!.config,
                    format_string: e.target.value,
                  })
                }
              />
            </div>
            {fieldDefinition.dataType === "number" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="decimals">Decimal Places</Label>
                  <Input
                    id="decimals"
                    type="number"
                    placeholder="2"
                    value={mapping.transformation.config.number_format?.decimals || ""}
                    onChange={(e) =>
                      handleTransformationChange("format", {
                        ...mapping.transformation!.config,
                        number_format: {
                          ...mapping.transformation!.config.number_format,
                          decimals: Number(e.target.value),
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    placeholder="USD"
                    value={mapping.transformation.config.number_format?.currency || ""}
                    onChange={(e) =>
                      handleTransformationChange("format", {
                        ...mapping.transformation!.config,
                        number_format: {
                          ...mapping.transformation!.config.number_format,
                          currency: e.target.value,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {mapping.transformation?.type === "calculate" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="expression">Expression</Label>
              <Input
                id="expression"
                placeholder="e.g., {price} / {quantity}"
                value={mapping.transformation.config.expression || ""}
                onChange={(e) =>
                  handleTransformationChange("calculate", {
                    ...mapping.transformation!.config,
                    expression: e.target.value,
                  })
                }
              />
              <p className="text-xs text-muted-foreground mt-1">Use {`{field_name}`} to reference other fields</p>
            </div>
          </div>
        )}

        {mapping.transformation?.type === "lookup" && (
          <div className="space-y-3">
            <div>
              <Label htmlFor="lookupTable">Lookup Table (JSON)</Label>
              <Textarea
                id="lookupTable"
                placeholder='{"old_value": "new_value", "another": "mapped"}'
                value={JSON.stringify(mapping.transformation.config.lookup_table || {})}
                onChange={(e) => {
                  try {
                    const lookupTable = JSON.parse(e.target.value)
                    handleTransformationChange("lookup", {
                      ...mapping.transformation!.config,
                      lookup_table: lookupTable,
                    })
                  } catch (error) {
                    // Invalid JSON, ignore
                  }
                }}
                className="min-h-[100px]"
              />
            </div>
            <div>
              <Label htmlFor="defaultValue">Default Value</Label>
              <Input
                id="defaultValue"
                placeholder="Value when no match found"
                value={mapping.transformation.config.default_value || ""}
                onChange={(e) =>
                  handleTransformationChange("lookup", {
                    ...mapping.transformation!.config,
                    default_value: e.target.value,
                  })
                }
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderPreview = () => {
    if (!preview) {
      return (
        <div className="text-center py-8">
          <Eye className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-muted-foreground">Configure mapping to see preview</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium mb-2">Data Mapping Preview</h3>
          <p className="text-sm text-muted-foreground mb-4">Preview of how your data will be transformed.</p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{preview.statistics.successful_mappings}</div>
                  <div className="text-xs text-muted-foreground">Successful</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <div>
                  <div className="text-2xl font-bold">{preview.statistics.failed_mappings}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-blue-600" />
                <div>
                  <div className="text-2xl font-bold">{preview.statistics.type_conversions}</div>
                  <div className="text-xs text-muted-foreground">Conversions</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <div>
                  <div className="text-2xl font-bold">{preview.statistics.data_quality_score.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Quality Score</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sample Data */}
        <div>
          <h4 className="font-medium mb-2">Sample Transformations</h4>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source Value</TableHead>
                  <TableHead>Transformed Value</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.source_sample.slice(0, 5).map((sourceRow, index) => {
                  const mappedRow = preview.mapped_sample[index]
                  const sourceValue = sourceRow[mapping.source_field]
                  const mappedValue = mappedRow?.[mapping.target_field]
                  const hasError = preview.validation_errors.some((e) => e.row_index === index)

                  return (
                    <TableRow key={index}>
                      <TableCell className="font-mono text-sm">{JSON.stringify(sourceValue)}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {mappedValue !== undefined ? JSON.stringify(mappedValue) : "—"}
                      </TableCell>
                      <TableCell>
                        {hasError ? (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                            Success
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Validation Errors */}
        {preview.validation_errors.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-red-600">Validation Errors</h4>
            <div className="space-y-2">
              {preview.validation_errors.slice(0, 3).map((error, index) => (
                <div key={index} className="rounded-md bg-red-50 border border-red-200 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">
                      Row {error.row_index + 1}: {error.error_message}
                    </span>
                  </div>
                  <div className="text-xs text-red-700 mt-1">Source value: {JSON.stringify(error.source_value)}</div>
                </div>
              ))}
              {preview.validation_errors.length > 3 && (
                <p className="text-sm text-muted-foreground">
                  And {preview.validation_errors.length - 3} more errors...
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Configure Data Source</DialogTitle>
          <DialogDescription>Set up data mapping for custom field "{fieldDefinition.name}"</DialogDescription>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="source" disabled={!selectedSource && currentTab !== "source"}>
              1. Source
            </TabsTrigger>
            <TabsTrigger value="field" disabled={!selectedSource}>
              2. Field
            </TabsTrigger>
            <TabsTrigger value="transform" disabled={!selectedField}>
              3. Transform
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!selectedField}>
              4. Preview
            </TabsTrigger>
          </TabsList>

          <div className="mt-4 flex-1 overflow-auto">
            <TabsContent value="source" className="mt-0">
              {renderSourceSelection()}
            </TabsContent>

            <TabsContent value="field" className="mt-0">
              {renderFieldSelection()}
            </TabsContent>

            <TabsContent value="transform" className="mt-0">
              {renderTransformationConfig()}
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              {previewLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-muted-foreground">Generating preview...</p>
                </div>
              ) : (
                renderPreview()
              )}
            </TabsContent>
          </div>
        </Tabs>

        {errors.general && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">{errors.general}</span>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !selectedField || !preview || preview.statistics.data_quality_score < 50}
          >
            {loading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Applying Mapping...
              </>
            ) : (
              <>
                <Settings className="mr-2 h-4 w-4" />
                Apply Data Mapping
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
