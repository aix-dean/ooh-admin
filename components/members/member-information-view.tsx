"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  Building,
  Star,
  Copy,
  Check,
  User,
  Hash,
  Globe,
  Users,
  Package,
  UserCheck,
  UserX,
} from "lucide-react"
import { getMemberById, type Member, type OHPlusMember, type SellahMember } from "@/lib/members-service"

interface MemberInformationViewProps {
  memberId: string
  platform: string
}

type AnyMember = Member | OHPlusMember | SellahMember

export function MemberInformationView({ memberId, platform }: MemberInformationViewProps) {
  const router = useRouter()
  const [member, setMember] = useState<AnyMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  useEffect(() => {
    const fetchMember = async () => {
      try {
        setLoading(true)
        const memberData = await getMemberById(memberId, platform)
        setMember(memberData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load member information")
      } finally {
        setLoading(false)
      }
    }

    fetchMember()
  }, [memberId, platform])

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  const formatDate = (timestamp: any) => {
    try {
      let date
      if (timestamp?.seconds) {
        date = new Date(timestamp.seconds * 1000)
      } else if (timestamp?.toDate) {
        date = timestamp.toDate()
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp)
      } else if (typeof timestamp === "number") {
        date = new Date(timestamp)
      } else {
        date = new Date(timestamp)
      }

      if (isNaN(date.getTime())) {
        return "Unknown"
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch (error) {
      return "Unknown"
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

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return <span className="text-gray-400 italic">Empty list</span>
      }
      return (
        <div className="space-y-1">
          {value.map((item, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <span className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                {index + 1}
              </span>
              {formatValue(item)}
            </div>
          ))}
        </div>
      )
    }

    if (typeof value === "object") {
      if (value.seconds || value._seconds) {
        return <span>{formatDate(value)}</span>
      }

      if (value.latitude && value.longitude) {
        return (
          <div className="space-y-1">
            <div className="text-sm">
              📍 {value.latitude}, {value.longitude}
            </div>
            {value.address && <div className="text-xs text-gray-600">{value.address}</div>}
          </div>
        )
      }

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

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "oh-plus":
        return "from-secondary/20 to-secondary/10"
      case "sellah":
        return "from-purple-100 to-purple-50"
      default:
        return "from-primary/10 to-primary/5"
    }
  }

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case "oh-plus":
        return "OH! Plus"
      case "sellah":
        return "Sellah"
      default:
        return "OOH! Shop"
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-gray-200 rounded-full"></div>
            <div className="space-y-2">
              <div className="h-8 w-64 bg-gray-200 rounded"></div>
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900 mb-1">Member not found</h3>
          <p className="text-muted-foreground mb-4">{error || "The requested member could not be found."}</p>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  // Separate core fields from additional fields
  const coreFields = [
    "id",
    "email",
    "displayName",
    "firstName",
    "middleName",
    "lastName",
    "phoneNumber",
    "location",
    "photoUrl",
    "photoURL",
    "companyName",
    "companyId",
    "position",
    "companyContact",
    "followersCount",
    "followers",
    "productsCount",
    "products",
    "product",
    "rating",
    "active",
    "createdTime",
    "created",
    "createdAt",
    "updatedAt",
    "activeDate",
    "lastLogin",
    "emailVerified",
    "type",
  ]

  const additionalFields = Object.entries(member).filter(([key]) => !coreFields.includes(key))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 pb-0">
        <div className="flex items-center gap-4 mb-6">
          <Button onClick={() => router.back()} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Badge variant="outline">{getPlatformName(platform)}</Badge>
        </div>

        <div className={`bg-gradient-to-r ${getPlatformColor(platform)} p-6 rounded-lg`}>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-4 border-white shadow-lg">
              <AvatarImage
                src={member.photoUrl || member.photoURL || "/placeholder.svg"}
                alt={member.displayName || "Member"}
              />
              <AvatarFallback className="text-lg font-semibold">
                {(member.displayName || member.firstName || member.email || "")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900">
                {member.displayName ||
                  `${member.firstName || ""} ${member.lastName || ""}`.trim() ||
                  member.email ||
                  "Unknown Member"}
              </h1>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={member.active ? "default" : "secondary"}>
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
                {member.companyId && (
                  <Badge variant="outline" className="font-mono">
                    ID: {member.companyId}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">Email:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{member.email || "Not provided"}</span>
                    {member.email && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(member.email, "email")}
                      >
                        {copiedField === "email" ? (
                          <Check className="h-3 w-3 text-green-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {member.phoneNumber && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Phone:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{member.phoneNumber}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(member.phoneNumber, "phone")}
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

                {member.location && (
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">Location:</span>
                    </div>
                    <div className="text-sm text-right max-w-[200px]">{formatValue(member.location)}</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Company Information */}
            {(member.companyName || member.companyId || member.position) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {member.companyId && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Company ID:</span>
                      <span className="text-sm font-mono">{member.companyId}</span>
                    </div>
                  )}
                  {member.companyName && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Company:</span>
                      <span className="text-sm">{member.companyName}</span>
                    </div>
                  )}
                  {member.position && (
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Position:</span>
                      <span className="text-sm">{member.position}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">Member ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono">{member.id}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(member.id, "id")}
                    >
                      {copiedField === "id" ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>

                {(member.createdTime || member.created || member.createdAt) && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Joined:</span>
                    <span className="text-sm">
                      {formatDate(
                        (member as any).created_at || member.createdTime || member.created || member.createdAt,
                      )}
                    </span>
                  </div>
                )}

                {member.activeDate && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Active Since:</span>
                    <span className="text-sm">{formatDate(member.activeDate)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-medium">Status:</span>
                  <Badge variant={member.active ? "default" : "secondary"}>
                    {member.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Statistics */}
            {(typeof (member as any).followersCount === "number" ||
              typeof (member as any).followers === "number" ||
              typeof (member as any).productsCount === "number" ||
              typeof (member as any).products === "number" ||
              typeof (member as any).rating === "number") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 gap-4">
                    {(typeof (member as any).followersCount === "number" ||
                      typeof (member as any).followers === "number") && (
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {((member as any).followersCount || (member as any).followers || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-blue-600 flex items-center justify-center gap-1">
                          <Users className="h-4 w-4" />
                          Followers
                        </div>
                      </div>
                    )}
                    {(typeof (member as any).productsCount === "number" ||
                      typeof (member as any).products === "number") && (
                      <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {((member as any).productsCount || (member as any).products || 0).toLocaleString()}
                        </div>
                        <div className="text-sm text-green-600 flex items-center justify-center gap-1">
                          <Package className="h-4 w-4" />
                          Products
                        </div>
                      </div>
                    )}
                    {typeof (member as any).rating === "number" && (
                      <div className="bg-yellow-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                          {(member as any).rating}
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        </div>
                        <div className="text-sm text-yellow-600">Rating</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional Information */}
            {additionalFields.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Additional Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
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
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
