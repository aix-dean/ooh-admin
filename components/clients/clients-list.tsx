"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Grid, List } from "lucide-react"
import { Company } from "@/lib/company-service"

interface ClientsListProps {
  onEdit?: (company: Company) => void
  onDelete?: (companyId: string) => void
}

interface PaginationData {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  hasNextPage: boolean
  hasPrevPage: boolean
}

export function ClientsList({ onEdit, onDelete }: ClientsListProps) {
  const router = useRouter()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [viewMode, setViewMode] = useState<"list" | "card">("list")
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: 15,
    totalCount: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })

  const handleClientClick = (companyId: string) => {
    router.push(`/dashboard/admin/clients/${companyId}`)
  }

  const fetchCompanies = async (page = 1, search = "") => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: "15",
      })

      if (search) {
        params.append("search", search)
      }

      const response = await fetch(`/api/clients?${params}`)
      const data = await response.json()

      if (response.ok) {
        setCompanies(data.companies)
        setPagination(data.pagination)
      } else {
        console.error("Error fetching companies:", data.error)
      }
    } catch (error) {
      console.error("Error fetching companies:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies(1, searchTerm)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchCompanies(1, searchTerm)
  }

  const handlePageChange = (newPage: number) => {
    fetchCompanies(newPage, searchTerm)
  }

  const handleDelete = async (companyId: string) => {
    if (!confirm("Are you sure you want to delete this company?")) {
      return
    }

    try {
      const response = await fetch(`/api/clients/${companyId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Refresh the list
        fetchCompanies(pagination.page, searchTerm)
        if (onDelete) {
          onDelete(companyId)
        }
      } else {
        console.error("Error deleting company")
      }
    } catch (error) {
      console.error("Error deleting company:", error)
    }
  }

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "N/A"
    const d = typeof date === "string" ? new Date(date) : date
    return d.toLocaleDateString()
  }

  if (loading && companies.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading companies...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-600">Manage your company clients and their subscriptions</p>
        </div>
        <div className="flex items-center gap-4">
          {/* View Toggle */}
          <div className="flex items-center border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "card" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("card")}
              className="h-8 w-8 p-0"
            >
              <Grid className="h-4 w-4" />
            </Button>
          </div>
          <Link href="/dashboard/admin/clients/add">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </Link>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Companies</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search by company name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" variant="outline">
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Companies List */}
      <Card>
        <CardHeader>
          <CardTitle>Companies ({pagination.totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No companies found.</p>
              <Link href="/dashboard/admin/clients/add">
                <Button className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Client
                </Button>
              </Link>
            </div>
          ) : viewMode === "list" ? (
            // List View
            <div className="space-y-4">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleClientClick(company.id)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {company.name}
                      </h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        {company.business_type && (
                          <p>
                            <span className="font-medium">Type:</span> {company.business_type}
                          </p>
                        )}
                        {company.website && (
                          <p>
                            <span className="font-medium">Website:</span>{" "}
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {company.website}
                            </a>
                          </p>
                        )}
                        {company.address && (
                          <p>
                            <span className="font-medium">Location:</span>{" "}
                            {company.address.city}, {company.address.province}
                          </p>
                        )}
                        {company.point_person && (
                          <p>
                            <span className="font-medium">Contact:</span>{" "}
                            {company.point_person.first_name} {company.point_person.last_name}
                            {company.point_person.email && (
                              <span className="text-blue-600"> ({company.point_person.email})</span>
                            )}
                          </p>
                        )}
                        <p>
                          <span className="font-medium">Created:</span>{" "}
                          {formatDate(company.created_at || company.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit && onEdit(company)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(company.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Card View
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {companies.map((company) => (
                <Card
                  key={company.id}
                  className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer"
                  onClick={() => handleClientClick(company.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg line-clamp-2 leading-tight">{company.name}</CardTitle>
                        {company.business_type && (
                          <Badge variant="secondary" className="mt-2 text-xs">
                            {company.business_type}
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-1 ml-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit && onEdit(company)}
                          className="h-8 w-8 p-0 hover:bg-blue-50"
                          title="Edit client"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(company.id)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete client"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {company.website && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2 text-gray-400">🌐</span>
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate"
                          title={company.website}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.website.replace(/^https?:\/\//, "")}
                        </a>
                      </div>
                    )}

                    {company.address && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2 text-gray-400">📍</span>
                        <span className="truncate" title={`${company.address.city}, ${company.address.province}`}>
                          {company.address.city}, {company.address.province}
                        </span>
                      </div>
                    )}

                    {company.point_person && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2 text-gray-400">👤</span>
                        <span className="truncate" title={`${company.point_person.first_name} ${company.point_person.last_name}`}>
                          {company.point_person.first_name} {company.point_person.last_name}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center text-sm text-gray-600">
                      <span className="font-medium mr-2 text-gray-400">📅</span>
                      <span>{formatDate(company.created_at || company.createdAt)}</span>
                    </div>

                    {company.industry && (
                      <div className="flex items-center text-sm text-gray-600">
                        <span className="font-medium mr-2 text-gray-400">🏢</span>
                        <span className="truncate" title={company.industry}>{company.industry}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1} to{" "}
            {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)} of{" "}
            {pagination.totalCount} companies
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={!pagination.hasPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-gray-700">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={!pagination.hasNextPage}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
