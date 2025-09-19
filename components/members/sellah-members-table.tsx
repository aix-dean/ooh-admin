"use client"

import { useState } from "react"
import { type SellahMember, formatFullName } from "@/lib/members-service"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Mail, Phone, MapPin, Users, Package, Star, Building2, Calendar, UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { CompanyDetailDialog } from "@/components/companies/company-detail-dialog"

interface SellahMembersTableProps {
  members: SellahMember[]
  loading?: boolean
  error?: string | null
  debugInfo?: any
  onRetry?: () => void
}

export function SellahMembersTable({
  members,
  loading = false,
  error = null,
  debugInfo = null,
  onRetry,
}: SellahMembersTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [companyDialogOpen, setCompanyDialogOpen] = useState(false)

  // Handle company ID search
  const handleCompanyIdSearch = (companyId: string) => {
    console.log(`Searching for company ID: ${companyId}`)
    // You can implement the actual search logic here
    // For example, filter members by company ID or navigate to a company page
    setSearchQuery(companyId)
  }

  const handleCompanyNameClick = (companyId: string) => {
    if (companyId) {
      setSelectedCompanyId(companyId)
      setCompanyDialogOpen(true)
    }
  }

  // Filter members based on search query
  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      member.email?.toLowerCase().includes(searchLower) ||
      member.displayName?.toLowerCase().includes(searchLower) ||
      formatFullName(member.firstName, member.middleName, member.lastName).toLowerCase().includes(searchLower) ||
      member.phoneNumber?.toLowerCase().includes(searchLower) ||
      (member.companyId && member.companyId.toLowerCase().includes(searchLower)) ||
      (member.companyName && member.companyName.toLowerCase().includes(searchLower)) ||
      (member.type && member.type.toLowerCase().includes(searchLower))
    )
  })

  // Get initials for avatar fallback
  const getInitials = (member: SellahMember) => {
    // Try different name sources in order of preference
    const name =
      member.displayName ||
      formatFullName(member.firstName, member.middleName, member.lastName) ||
      member.firstName ||
      member.lastName ||
      member.email ||
      "Unknown"

    return name
      .split(" ")
      .filter((part) => part.length > 0)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Format location placeholder for Sellah (similar to OH! Plus)
  const formatLocation = () => {
    return "Location not set"
  }

  // Format date with improved timestamp handling
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"

    try {
      let date: Date

      // Handle Firebase Timestamp objects
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        date = timestamp.toDate()
      }
      // Handle Firestore timestamp objects with seconds
      else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000 + (timestamp.nanoseconds || 0) / 1000000)
      }
      // Handle regular Date objects
      else if (timestamp instanceof Date) {
        date = timestamp
      }
      // Handle string or number timestamps
      else {
        date = new Date(timestamp)
      }

      // Ensure we have a valid date
      if (isNaN(date.getTime())) {
        return "Invalid date"
      }

      // Format the date without timezone conversion issues
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    } catch (e) {
      console.error("Date formatting error:", e, "for timestamp:", timestamp)
      return "Invalid date"
    }
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-red-200">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
          <UserX className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Sellah Members</h3>
        <p className="text-red-600 mb-4">{error}</p>
        {onRetry && (
          <Button
            onClick={onRetry}
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-50 bg-transparent"
          >
            Try Again
          </Button>
        )}
        {debugInfo && (
          <details className="mt-4 text-left bg-gray-50 p-4 rounded-md">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">Debug Information</summary>
            <pre className="mt-2 text-xs text-gray-600 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Skeleton className="h-10 w-full max-w-md pl-9" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="overflow-hidden border-0 shadow-md">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-secondary/20 to-secondary/10 p-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-full" />
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 overflow-visible">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search Sellah members by name, email, company name, or company ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-10 bg-white"
        />
      </div>

      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
            <UserX className="h-8 w-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">No Sellah members found</h3>
          <p className="text-muted-foreground">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
          {filteredMembers.map((member) => {
            const initials = getInitials(member)
            return (
              <Card
                key={member.id}
                className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-200"
              >
                <CardContent className="p-0">
                  <div
                    className={`bg-gradient-to-r ${member.active ? "from-secondary/20 to-secondary/10" : "from-gray-100 to-gray-50"} p-4`}
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                        <AvatarImage
                          src={member.photoUrl || member.photoURL}
                          alt={member.displayName || "Member"}
                          onError={(e) => {
                            // Hide the image if it fails to load
                            e.currentTarget.style.display = "none"
                          }}
                        />
                        <AvatarFallback
                          className={`${member.active ? "bg-secondary/30 text-secondary-foreground" : "bg-gray-200 text-gray-600"} font-semibold`}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <h3
                          className="font-medium text-gray-900 line-clamp-1 cursor-pointer hover:text-secondary transition-colors"
                          onClick={() => {
                            window.location.href = `/dashboard/immigration/members/${member.id}?platform=sellah`
                          }}
                        >
                          {member.displayName ||
                            formatFullName(member.firstName, member.middleName, member.lastName) ||
                            member.email}
                        </h3>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    <div
                      className={`flex items-center gap-2 p-2 rounded-md border ${
                        member.companyName ? "bg-blue-50 border-blue-100" : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <Building2
                        className={`h-5 w-5 shrink-0 ${member.companyName ? "text-blue-600" : "text-gray-400"}`}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span
                          className={`text-xs font-semibold ${member.companyName ? "text-blue-700" : "text-gray-600"}`}
                        >
                          Company
                        </span>
                        {member.companyName ? (
                          <button
                            onClick={() => handleCompanyNameClick(member.companyId!)}
                            className="text-sm font-medium truncate text-blue-800 hover:text-blue-900 hover:underline cursor-pointer text-left"
                            title={`Click to view details for ${member.companyName}`}
                          >
                            {member.companyName}
                          </button>
                        ) : (
                          <span className="text-sm font-medium truncate text-gray-500 italic">No Company</span>
                        )}
                        {member.companyId && (
                          <span className="text-xs text-gray-500 font-mono truncate" title={member.companyId}>
                            ID: {member.companyId}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{member.email}</span>
                    </div>
                    {member.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{member.phoneNumber}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{member.followers} followers</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm">{member.products} products</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 shrink-0" />
                      <span className="text-sm">{member.rating}/5 rating</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{formatLocation()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-xs text-muted-foreground">
                          Created: {formatDate(member.created_at || member.created || member.createdTime)}
                        </span>
                      </div>
                      {member.activeDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-xs text-muted-foreground">Active: {formatDate(member.activeDate)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <CompanyDetailDialog companyId={selectedCompanyId} open={companyDialogOpen} onOpenChange={setCompanyDialogOpen} />
    </div>
  )
}
