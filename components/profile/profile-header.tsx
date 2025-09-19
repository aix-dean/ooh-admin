"use client"

import type React from "react"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Camera, Loader2 } from "lucide-react"
import { updateProfileImage } from "@/lib/profile"
import { useAuth } from "@/contexts/auth-context"
import { useToast } from "@/hooks/use-toast"

interface ProfileHeaderProps {
  userData: any
}

export function ProfileHeader({ userData }: ProfileHeaderProps) {
  const { refreshUserData } = useAuth()
  const { toast } = useToast()
  const [uploading, setUploading] = useState(false)

  // Get user initials for avatar fallback
  const initials = userData.display_name
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .substring(0, 2)

  // Handle profile image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPEG, PNG, etc.)",
        variant: "destructive",
      })
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 5MB",
        variant: "destructive",
      })
      return
    }

    setUploading(true)

    try {
      await updateProfileImage(file)
      await refreshUserData()
      toast({
        title: "Profile image updated",
        description: "Your profile image has been updated successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error updating profile image",
        description: error.message || "An error occurred while updating your profile image",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="flex flex-col items-center text-center h-full">
          <div className="relative my-4">
            <Avatar className="h-24 w-24 border-4 border-white shadow-md">
              <AvatarImage src={userData.photo_url || "/placeholder.svg"} alt={userData.display_name} />
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-2 -right-2">
              <label htmlFor="profile-image" className="cursor-pointer">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-white shadow-md hover:bg-primary/90">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </div>
                <input
                  type="file"
                  id="profile-image"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col items-center text-center space-y-2 mt-2">
            <h2 className="text-xl font-bold">{userData.display_name}</h2>
            <p className="text-sm text-muted-foreground">{userData.email}</p>

            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {userData.role?.map((role: string) => (
                <Badge key={role} variant="outline" className="capitalize">
                  {role}
                </Badge>
              ))}
            </div>

            <Badge variant="secondary" className="mt-1">
              {userData.type}
            </Badge>

            <div className="mt-auto pt-4">
              <div className="flex flex-col items-center">
                <span className="text-lg font-medium">{userData.active ? "Active" : "Inactive"}</span>
                <span className="text-xs text-muted-foreground">Status</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
