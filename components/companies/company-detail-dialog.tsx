"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Building2, MapPin, Phone, Mail, Globe, Calendar, Copy, Check, AlertCircle } from "lucide-react"
import { getCompanyById } from "@/lib/company-service"

interface Company {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  website?: string
  description?: string
  industry?: string
  size?: string
  founded?: Date
  status?: string
  createdAt?: Date
  updatedAt?: Date
  [key: string]: any // For additional fields
}

interface CompanyDetailDialogProps {
  companyId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CompanyDetailDialog({ companyId, open, onOpenChange }: CompanyDetailDialogProps) {
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    if (open && companyId) {
      fetchCompanyDetails()
    }
  }, [open, companyId])

  const fetchCompanyDetails = async () => {
    if (!companyId) return

    setLoading(true)
    setError(null)

    try {
      const companyData = await getCompanyById(companyId)
      setCompany(companyData)
    } catch (err) {
      console.error("Error fetching company details:", err)
      setError("Failed to load company details")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const formatDate = (date: any) => {
    if (!date) return "Not available"

    try {
      let dateObj: Date
      if (date.toDate && typeof date.toDate === "function") {
        dateObj = date.toDate()
      } else if (date.seconds) {
        dateObj = new Date(date.seconds * 1000)
      } else {
        dateObj = new Date(date)
      }

      if (isNaN(dateObj.getTime())) {
        return "Invalid date"
      }

      return dateObj.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    } catch (error) {
      return "Invalid date"
    }
  }

  const formatValue = (value: any): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">Not provided</span>
    }

    if (typeof value === "boolean") {
      return <Badge variant={value ? "default" : "secondary"}>{value ? "Yes" : "No"}</Badge>
    }

    if (typeof value === "number") {
      return <span className="font-mono">{value.toLocaleString()}</span>
    }

    if (typeof value === "string") {
      if (value.trim() === "") {
        return <span className="text-gray-400 italic">Empty</span>
      }

      // Check if it's a URL
      if (value.startsWith("http://") || value.startsWith("https://")) {
        return (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
          >
            <Globe className="h-3 w-3" />
            {value.length > 40 ? `${value.substring(0, 40)}...` : value}
          </a>
        )
      }

      // Check if it's an email
      if (value.includes("@") && value.includes(".")) {
        return (
          <a href={`mailto:${value}`} className="text-blue-600 hover:text-blue-800 underline flex items-center gap-1">
            <Mail className="h-3 w-3" />
            {value}
          </a>
        )
      }

      return <span>{value}</span>
    }

    if (typeof value === "object") {
      // Handle timestamp objects
      if (value.seconds || value._seconds) {
        return <span>{formatDate(value)}</span>
      }

      // Handle other objects
      const entries = Object.entries(value).filter(([_, v]) => v !== null && v !== undefined)
      if (entries.length === 0) {
        return <span className="text-gray-400 italic">Empty object</span>
      }

      return (
        <div className="space-y-2 bg-gray-50 p-3 rounded border-l-2 border-gray-200">
          {entries.map(([key, val]) => (
            <div key={key} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </span>
              <div className="ml-2">{formatValue(val)}</div>
            </div>
          ))}
        </div>
      )
    }

    return <span>{String(value)}</span>
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-blue-100">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{loading ? "Loading..." : company?.name || "Company Details"}</h2>
              <p className="text-sm text-gray-500 mt-1">Company ID: {companyId}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          {loading ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-4">
                  <Skeleton className="h-6 w-32" />
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <AlertCircle className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Company</h3>
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchCompanyDetails} variant="outline">
                Try Again
              </Button>
            </div>
          ) : company ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Information */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Basic Information
                  </h3>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium">Name:</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{company.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(company.name, "name")}
                        >
                          {copiedField === "name" ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {company.industry && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Industry:</span>
                        <span className="text-sm">{company.industry}</span>
                      </div>
                    )}

                    {company.size && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Size:</span>
                        <span className="text-sm">{company.size}</span>
                      </div>
                    )}

                    {company.status && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Status:</span>
                        <Badge variant={company.status === "active" ? "default" : "secondary"}>{company.status}</Badge>
                      </div>
                    )}

                    {company.founded && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Founded:</span>
                        <span className="text-sm">{formatDate(company.founded)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Contact Information
                  </h3>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    {company.email && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Email:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a href={`mailto:${company.email}`} className="text-sm text-blue-600 hover:text-blue-800">
                            {company.email}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(company.email, "email")}
                          >
                            {copiedField === "email" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {company.phone && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Phone:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{company.phone}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(company.phone, "phone")}
                          >
                            {copiedField === "phone" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {company.website && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Website:</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <a
                            href={company.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            {company.website.replace(/^https?:\/\//, "")}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(company.website, "website")}
                          >
                            {copiedField === "website" ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    {company.address && (
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium">Address:</span>
                        </div>
                        <div className="text-sm text-right max-w-[200px]">{formatValue(company.address)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Additional Information */}
              <div className="space-y-6">
                {company.description && (
                  <div>
                    <h3 className="text-lg font-medium mb-3">Description</h3>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-700">{company.description}</p>
                    </div>
                  </div>
                )}

                {/* System Information */}
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    System Information
                  </h3>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Company ID:</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono">{company.id}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(company.id, "id")}
                        >
                          {copiedField === "id" ? (
                            <Check className="h-3 w-3 text-green-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {company.createdAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Created:</span>
                        <span className="text-sm">{formatDate(company.createdAt)}</span>
                      </div>
                    )}

                    {company.updatedAt && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Updated:</span>
                        <span className="text-sm">{formatDate(company.updatedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Fields */}
                {(() => {
                  const coreFields = [
                    "id",
                    "name",
                    "address",
                    "phone",
                    "email",
                    "website",
                    "description",
                    "industry",
                    "size",
                    "founded",
                    "status",
                    "createdAt",
                    "updatedAt",
                  ]
                  const additionalFields = Object.entries(company).filter(([key]) => !coreFields.includes(key))

                  if (additionalFields.length === 0) return null

                  return (
                    <div>
                      <h3 className="text-lg font-medium mb-3">Additional Information</h3>
                      <div className="space-y-4 bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
                        {additionalFields.map(([key, value]) => (
                          <div key={key} className="border-b border-gray-200 pb-3 last:border-b-0 last:pb-0">
                            <div className="flex flex-col gap-2">
                              <span className="text-sm font-medium text-gray-700 capitalize">
                                {key.replace(/([A-Z])/g, " $1").trim()}:
                              </span>
                              <div className="ml-2">{formatValue(value)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
                <Building2 className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Company Data</h3>
              <p className="text-gray-500">Company information is not available</p>
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
