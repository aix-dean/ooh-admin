"use client"

import { useState } from "react"
import { type Member, formatFullName, formatDate } from "@/lib/members-service"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Mail, Phone, Building2, Calendar, MapPin, UserX } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface MembersTableProps {
  members: Member[]
  loading?: boolean
}

export function MembersTable({ members, loading = false }: MembersTableProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Enhanced filter with comprehensive company info search
  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase()

    // Search in company_info object (not array)
    const companyMatches = member.companyInfo
      ? member.companyInfo.company_name?.toLowerCase().includes(searchLower) ||
        member.companyInfo.company_position?.toLowerCase().includes(searchLower) ||
        member.companyInfo.company_address?.toLowerCase().includes(searchLower)
      : false

    // Search in direct company fields (backward compatibility)
    const directCompanyMatches =
      member.companyName?.toLowerCase().includes(searchLower) ||
      member.companyContact?.toLowerCase().includes(searchLower) ||
      member.companyEmail?.toLowerCase().includes(searchLower) ||
      member.position?.toLowerCase().includes(searchLower)

    return (
      member.email.toLowerCase().includes(searchLower) ||
      member.displayName.toLowerCase().includes(searchLower) ||
      formatFullName(member.firstName, member.middleName, member.lastName).toLowerCase().includes(searchLower) ||
      member.phoneNumber?.toLowerCase().includes(searchLower) ||
      companyMatches ||
      directCompanyMatches
    )
  })

  // Get initials for avatar fallback
  const getInitials = (member: Member) => {
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

  // Get company display info
  const getCompanyDisplay = (member: Member) => {
    if (member.companyInfo) {
      const parts = []
      if (member.companyInfo.company_position) {
        parts.push(member.companyInfo.company_position)
      }
      if (member.companyInfo.company_name) {
        parts.push(`at ${member.companyInfo.company_name}`)
      }
      return parts.join(" ") || "No Company Info"
    }

    // Fallback to direct fields
    if (member.position || member.companyName) {
      const parts = []
      if (member.position) parts.push(member.position)
      if (member.companyName) parts.push(`at ${member.companyName}`)
      return parts.join(" ") || "No Company Info"
    }

    return member.companyId || "No Company"
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
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4">
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
          placeholder="Search members by name, email, phone, company, position, or contact info..."
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
          <h3 className="text-lg font-medium text-gray-900 mb-1">No members found</h3>
          <p className="text-muted-foreground">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
          {filteredMembers.map((member) => {
            const initials = getInitials(member)
            const companyDisplay = getCompanyDisplay(member)

            return (
              <Card
                key={member.id}
                className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow duration-200"
              >
                <CardContent className="p-0">
                  <div
                    className={`bg-gradient-to-r ${member.active ? "from-primary/10 to-primary/5" : "from-gray-100 to-gray-50"} p-4`}
                  >
                    <div className="flex items-center gap-3">
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
                          className={`${member.active ? "bg-primary/20 text-primary" : "bg-gray-200 text-gray-600"} font-semibold`}
                        >
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3
                          className="font-medium text-gray-900 line-clamp-1 cursor-pointer hover:text-primary transition-colors"
                          onClick={() => {
                            window.location.href = `/dashboard/immigration/members/${member.id}?platform=ooh-shop`
                          }}
                        >
                          {member.displayName ||
                            formatFullName(member.firstName, member.middleName, member.lastName) ||
                            member.email}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {formatFullName(member.firstName, member.middleName, member.lastName) || member.email}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
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
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm truncate">{companyDisplay}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm">Joined {formatDate(member.createdTime)}</span>
                    </div>
                    {member.ipAddress && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="text-sm truncate">{member.location || member.ipAddress}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
