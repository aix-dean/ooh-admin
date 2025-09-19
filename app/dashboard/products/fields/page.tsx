"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { CustomFieldService, type StoredCustomFieldDefinition } from "@/lib/custom-field-service"
import { Search, Plus, Archive, TrendingUp, Calendar, Database, RefreshCw, Eye, BarChart3 } from "lucide-react"

export default function CustomFieldsPage() {
  const [fieldDefinitions, setFieldDefinitions] = useState<StoredCustomFieldDefinition[]>([])
  const [filteredFields, setFilteredFields] = useState<StoredCustomFieldDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [stats, setStats] = useState<any>(null)

  const { toast } = useToast()

  useEffect(() => {
    loadFieldDefinitions()
    loadStats()
  }, [])

  useEffect(() => {
    filterFields()
  }, [fieldDefinitions, searchTerm])

  const loadFieldDefinitions = async () => {
    try {
      setLoading(true)
      const fields = await CustomFieldService.getFieldDefinitions(true)
      setFieldDefinitions(fields)
    } catch (error) {
      console.error("Error loading field definitions:", error)
      toast({
        title: "Error",
        description: "Failed to load custom field definitions",
        variant: "destructive",
      })
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

  const filterFields = () => {
    if (!searchTerm) {
      setFilteredFields(fieldDefinitions)
      return
    }

    const filtered = fieldDefinitions.filter(
      (field) =>
        field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        field.description?.toLowerCase().includes(searchTerm.toLowerCase()),
    )
    setFilteredFields(filtered)
  }

  const handleArchiveField = async (fieldId: string) => {
    try {
      await CustomFieldService.archiveFieldDefinition(fieldId, "current_user_id")
      toast({
        title: "Success",
        description: "Field definition archived successfully",
      })
      await loadFieldDefinitions()
      await loadStats()
    } catch (error) {
      console.error("Error archiving field:", error)
      toast({
        title: "Error",
        description: "Failed to archive field definition",
        variant: "destructive",
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      active: "default",
      deprecated: "secondary",
      archived: "outline",
    }
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Custom Fields</h1>
          <p className="text-muted-foreground">
            Manage custom field definitions and view usage statistics ({fieldDefinitions.length} total fields)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadFieldDefinitions} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Field
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Fields</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_fields}</div>
              <p className="text-xs text-muted-foreground">All custom fields</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Fields</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active_fields}</div>
              <p className="text-xs text-muted-foreground">Currently in use</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Used</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.most_used.length > 0 ? stats.most_used[0].usage_count : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.most_used.length > 0 ? stats.most_used[0].name : "No usage data"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recently Added</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recently_added.length}</div>
              <p className="text-xs text-muted-foreground">In last 30 days</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Fields</CardTitle>
          <CardDescription>Find custom field definitions by name, key, or description</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" size="icon">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Fields Table */}
      <Card>
        <CardHeader>
          <CardTitle>Field Definitions ({filteredFields.length})</CardTitle>
          <CardDescription>Manage your custom field definitions and view usage statistics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Field</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{field.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">{field.key}</div>
                        {field.description && (
                          <div className="text-sm text-muted-foreground mt-1">{field.description}</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{field.dataType}</Badge>
                        {field.required && <Badge variant="destructive">Required</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(field.status)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-medium">{field.usage_count} times</div>
                        <div className="text-muted-foreground">v{field.version}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div>{formatDate(field.created)}</div>
                      <div className="text-muted-foreground">by {field.created_by}</div>
                    </TableCell>
                    <TableCell className="text-sm">{field.last_used ? formatDate(field.last_used) : "Never"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                        {field.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleArchiveField(field.id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredFields.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12">
                <Database className="h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-semibold">No custom fields found</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "Try adjusting your search terms." : "Create your first custom field to get started."}
                </p>
                {searchTerm && (
                  <Button onClick={() => setSearchTerm("")} className="mt-4" variant="outline">
                    Clear search
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
