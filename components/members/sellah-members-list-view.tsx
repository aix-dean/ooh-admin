"use client"

import { useState } from "react"
import { type SellahMember, formatFullName } from "@/lib/members-service"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Search, Mail, Phone, MoreHorizontal, UserCheck, UserX, Building2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

interface SellahMembersListViewProps {
  members: SellahMember[]
  loading?: boolean
}

export function SellahMembersListView({ members, loading = false }: SellahMembersListViewProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Filter members based on search query
  const filteredMembers = members.filter((member) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      member.email?.toLowerCase().includes(searchLower) ||
      member.displayName?.toLowerCase().includes(searchLower) ||
      formatFullName(member.firstName, member.middleName, member.lastName).toLowerCase().includes(searchLower) ||
      member.phoneNumber?.toLowerCase().includes(searchLower) ||
      member.companyId?.toLowerCase().includes(searchLower)
    )
  })

  // Get initials for avatar fallback
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Format date
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A"
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date)
    } catch (e) {
      return "Invalid date"
    }
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search Sellah members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Stats</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src="/placeholder.svg" alt={member.displayName} />
                      <AvatarFallback>{getInitials(member.displayName || member.firstName)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.displayName}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatFullName(member.firstName, member.middleName, member.lastName)}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{member.email}</span>
                    </div>
                    {member.phoneNumber && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{member.phoneNumber}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{member.companyId || "No Company"}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <div>{member.followers} followers</div>
                    <div>{member.products} products</div>
                    <div>⭐ {member.rating}/5</div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Badge variant={member.active ? "default" : "outline"}>
                      {member.active ? (
                        <span className="flex items-center gap-1">
                          <UserCheck className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <UserX className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                    </Badge>
                    <div className="text-xs text-muted-foreground">
                      Joined {formatDate(member.created || member.createdTime)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
