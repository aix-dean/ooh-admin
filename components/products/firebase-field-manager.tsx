"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Copy,
  Eye,
  Database,
  Type,
  Hash,
  Calendar,
  ToggleLeft,
  List,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
} from "lucide-react"
import type { CustomFieldDefinition } from "@/types/custom-field"
import { CustomFieldService, type StoredCustomFieldDefinition } from "@/lib/custom-field-service"
import { FirebaseStyleFieldDialog } from "./firebase-style-field-dialog"

const FIREBASE_TYPE_ICONS = {
  string: <Type className="h-4 w-4 text-blue-600" />,
  number: <Hash className="h-4 w-4 text-green-600" />,
  boolean: <ToggleLeft className="h-4 w-4 text-purple-600" />,
  date: <Calendar className="h-4 w-4 text-orange-600" />,
  array: <List className="h-4 w-4 text-red-600" />,
  object: <Database className="h-4 w-4 text-indigo-600" />,
}

const FIREBASE_TYPE_COLORS = {
  string: "text-blue-600 bg-blue-50 border-blue-200",
  number: "text-green-600 bg-green-50 border-green-200",
  boolean: "text-purple-600 bg-purple-50 border-purple-200",
  date: "text-orange-600 bg-orange-50 border-orange-200",
  array: "text-red-600 bg-red-50 border-red-200",
  object: "text-indigo-600 bg-indigo-50 border-indigo-200",
}

interface FirebaseFieldManagerProps {
  onFieldAdded?: (field: CustomFieldDefinition) => void
}

export function FirebaseFieldManager({ onFieldAdded }: FirebaseFieldManagerProps) {
  const [fields, setFields] = useState<StoredCustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState<string>("all")
  const [addFieldDialog, setAddFieldDialog] = useState(false)
  const [stats, setStats] = useState({
    total_fields: 0,
    active_fields: 0,
    most_used: [] as StoredCustomFieldDefinition[],
    recently_added: [] as StoredCustomFieldDefinition[],
  })

  useEffect(() => {
    loadFields()
    loadStats()
  }, [])

  const loadFields = async () => {
    try {
      setLoading(true)
      const fieldData = await CustomFieldService.getFieldDefinitions()
      setFields(fieldData)
    } catch (error) {
      console.error("Error loading fields:", error)
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const statsData = await CustomFieldService.getFieldUsageStats()
      setStats(statsData)
    } catch (error) {
      console.error("Error loading stats:", error)
    }
  }

  const handleAddField = async (fieldDef: CustomFieldDefinition) => {
    try {
      await CustomFieldService.saveFieldDefinition(fieldDef, "current_user_id")
      await loadFields()
      await loadStats()
      setAddFieldDialog(false)
      onFieldAdded?.(fieldDef)
    } catch (error) {
      console.error("Error adding field:", error)
      throw error
    }
  }

  const filteredFields = fields.filter((field) => {
    const matchesSearch =
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.description?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesType = filterType === "all" || field.dataType === filterType

    return matchesSearch && matchesType
  })

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case "deprecated":
        return (
          <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-3 w-3 mr-1" />
            Deprecated
          </Badge>
        )
      case "archived":
        return (
          <Badge variant="outline" className="text-gray-600 border-gray-200 bg-gray-50">
            <Clock className="h-3 w-3 mr-1" />
            Archived
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Custom Fields</h2>
          <p className="text-gray-600">Manage custom fields for your product collection</p>
        </div>
        <Button onClick={() => setAddFieldDialog(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          Add field
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_fields}</div>
            <p className="text-xs text-muted-foreground">{stats.active_fields} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Fields</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active_fields}</div>
            <p className="text-xs text-muted-foreground">Ready to use</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Most Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.most_used.length > 0 ? stats.most_used[0].usage_count : 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats.most_used.length > 0 ? stats.most_used[0].name : "No usage yet"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.recently_added.length}</div>
            <p className="text-xs text-muted-foreground">Added this week</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fields</CardTitle>
          <CardDescription>Manage and configure custom fields for your products</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search fields..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="mr-2 h-4 w-4" />
                    Type: {filterType === "all" ? "All" : filterType}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFilterType("all")}>All Types</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setFilterType("string")}>
                    <Type className="mr-2 h-4 w-4 text-blue-600" />
                    String
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("number")}>
                    <Hash className="mr-2 h-4 w-4 text-green-600" />
                    Number
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("boolean")}>
                    <ToggleLeft className="mr-2 h-4 w-4 text-purple-600" />
                    Boolean
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("date")}>
                    <Calendar className="mr-2 h-4 w-4 text-orange-600" />
                    Date
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("array")}>
                    <List className="mr-2 h-4 w-4 text-red-600" />
                    Array
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setFilterType("object")}>
                    <Database className="mr-2 h-4 w-4 text-indigo-600" />
                    Object
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fields Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Field</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Usage</TableHead>
                  <TableHead className="font-semibold">Created</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div className="space-y-2">
                          <div className="h-4 bg-gray-200 rounded animate-pulse" />
                          <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded animate-pulse w-16" />
                      </TableCell>
                      <TableCell>
                        <div className="h-6 bg-gray-200 rounded animate-pulse w-20" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-12" />
                      </TableCell>
                      <TableCell>
                        <div className="h-4 bg-gray-200 rounded animate-pulse w-24" />
                      </TableCell>
                      <TableCell>
                        <div className="h-8 bg-gray-200 rounded animate-pulse w-8" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredFields.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Database className="h-8 w-8 text-gray-400" />
                        <p className="text-gray-500">No fields found</p>
                        <Button onClick={() => setAddFieldDialog(true)} variant="outline" size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Add your first field
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFields.map((field) => (
                    <TableRow key={field.id} className="hover:bg-gray-50">
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{field.name}</span>
                            {field.required && (
                              <Badge variant="outline" className="text-xs text-red-600 border-red-200">
                                Required
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 font-mono">{field.key}</div>
                          {field.description && (
                            <div className="text-sm text-gray-600 max-w-md truncate">{field.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {FIREBASE_TYPE_ICONS[field.dataType as keyof typeof FIREBASE_TYPE_ICONS]}
                          <Badge
                            variant="outline"
                            className={FIREBASE_TYPE_COLORS[field.dataType as keyof typeof FIREBASE_TYPE_COLORS]}
                          >
                            {field.dataType === "date"
                              ? "timestamp"
                              : field.dataType === "object"
                                ? "map"
                                : field.dataType}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(field.status)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{field.usage_count}</div>
                          <div className="text-gray-500">
                            {field.last_used ? `Last: ${formatDate(field.last_used)}` : "Never used"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-600">{formatDate(field.created)}</div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit field
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Archive field
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add Field Dialog */}
      <FirebaseStyleFieldDialog open={addFieldDialog} onOpenChange={setAddFieldDialog} onConfirm={handleAddField} />
    </div>
  )
}
