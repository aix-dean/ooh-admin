"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Mail, Phone, MapPin, Building, Star, Copy, Check, User, Hash, Globe } from "lucide-react"
import type { Member } from "@/lib/members-service"

interface MemberDetailDialogProps {
  member: Member | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MemberDetailDialog({ member, open, onOpenChange }: MemberDetailDialogProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!member) return null

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
      // Handle timestamp objects
      if (value.seconds || value._seconds) {
        return <span>{formatDate(value)}</span>
      }

      // Handle location objects
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

      // Handle other objects by showing their properties
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

  const formatLocation = (location: any) => {
    if (!location) return "Not provided"

    if (typeof location === "string") {
      return location
    }

    if (typeof location === "object") {
      if (location.address) return location.address
      if (location.city && location.country) return `${location.city}, ${location.country}`
      if (location.latitude && location.longitude) return `${location.latitude}, ${location.longitude}`
    }

    return "Location available"
  }

  // Separate core fields from additional fields
  const coreFields = [
    "id",
    "email",
    "displayName",
    "phoneNumber",
    "location",
    "photoURL",
    "companyName",
    "position",
    "companyContact",
    "followersCount",
    "productsCount",
    "rating",
    "active",
    "createdTime",
    "createdAt",
    "updatedAt",
    "lastLogin",
    "emailVerified",
  ]

  const additionalFields = Object.entries(member).filter(([key]) => !coreFields.includes(key))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={member.photoURL || undefined} alt={member.displayName || "Member"} />
              <AvatarFallback className="bg-primary/10 text-primary font-medium text-lg">
                {(member.displayName || member.email || "")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{member.displayName || member.email || "Unknown Member"}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={member.active ? "default" : "secondary"}>{member.active ? "Active" : "Inactive"}</Badge>
                {member.emailVerified && (
                  <Badge variant="outline" className="text-green-600 border-green-600">
                    ✓ Verified
                  </Badge>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Contact Information */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Contact Information
                </h3>
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-medium">Email:</span>
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
                        <span className="text-sm font-medium">Phone:</span>
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
                        <span className="text-sm font-medium">Location:</span>
                      </div>
                      <div className="text-sm text-right max-w-[200px]">{formatValue(member.location)}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Company Information */}
              {(member.companyName || member.position || member.companyContact) && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Building className="h-5 w-5" />
                    Company Information
                  </h3>
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                    {member.companyName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Company:</span>
                        <span className="text-sm">{member.companyName}</span>
                      </div>
                    )}
                    {member.position && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Position:</span>
                        <span className="text-sm">{member.position}</span>
                      </div>
                    )}
                    {member.companyContact && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Company Contact:</span>
                        <span className="text-sm">{member.companyContact}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Account Information */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Account Information
                </h3>
                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Member ID:</span>
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

                  {(member.createdTime || member.createdAt) && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Joined:</span>
                      <span className="text-sm">{formatDate(member.createdTime || member.createdAt)}</span>
                    </div>
                  )}

                  {member.lastLogin && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Last Login:</span>
                      <span className="text-sm">{formatDate(member.lastLogin)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status:</span>
                    <Badge variant={member.active ? "default" : "secondary"}>
                      {member.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Statistics */}
              {(typeof member.followersCount === "number" ||
                typeof member.productsCount === "number" ||
                typeof member.rating === "number") && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Star className="h-5 w-5" />
                    Statistics
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    {typeof member.followersCount === "number" && (
                      <div className="bg-blue-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-blue-600">{member.followersCount.toLocaleString()}</div>
                        <div className="text-sm text-blue-600">Followers</div>
                      </div>
                    )}
                    {typeof member.productsCount === "number" && (
                      <div className="bg-green-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-green-600">{member.productsCount.toLocaleString()}</div>
                        <div className="text-sm text-green-600">Products</div>
                      </div>
                    )}
                    {typeof member.rating === "number" && (
                      <div className="bg-yellow-50 p-4 rounded-lg text-center">
                        <div className="text-2xl font-bold text-yellow-600 flex items-center justify-center gap-1">
                          {member.rating}
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        </div>
                        <div className="text-sm text-yellow-600">Rating</div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Additional Information */}
              {additionalFields.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <Hash className="h-5 w-5" />
                    Additional Information
                  </h3>
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
              )}
            </div>
          </div>
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
