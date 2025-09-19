"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { ProfileForm } from "@/components/profile/profile-form"
import { ProfileHeader } from "@/components/profile/profile-header"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export default function ProfilePage() {
  const { user, userData, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState("personal")
  const [containerHeight, setContainerHeight] = useState("calc(100vh - 180px)")

  // Calculate available height on mount and window resize
  useEffect(() => {
    const updateHeight = () => {
      // Account for header (64px), page title area (~60px), and some padding
      const availableHeight = window.innerHeight - 180
      setContainerHeight(`${availableHeight}px`)
    }

    updateHeight()
    window.addEventListener("resize", updateHeight)
    return () => window.removeEventListener("resize", updateHeight)
  }, [])

  // Redirect to login if not authenticated
  if (!loading && !user) {
    router.push("/login")
    return null
  }

  // Show loading state
  if (loading || !userData) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Account Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your account settings and profile information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1" style={{ height: containerHeight }}>
        {/* Left column - Profile header */}
        <div className="lg:col-span-1">
          <ProfileHeader userData={userData} />
        </div>

        {/* Right column - Tabs and content */}
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <Tabs defaultValue="personal" className="flex-1 flex flex-col" onValueChange={setActiveTab}>
              <TabsList className="mx-4 mt-4 mb-2">
                <TabsTrigger value="personal">Personal Information</TabsTrigger>
                <TabsTrigger value="preferences">Preferences</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-hidden px-4 pb-4">
                <TabsContent
                  value="personal"
                  className="h-full m-0 data-[state=active]:flex data-[state=active]:flex-col"
                >
                  <ProfileForm userData={userData} />
                </TabsContent>

                <TabsContent value="preferences" className="h-full m-0 overflow-auto">
                  <div className="p-4 bg-white rounded-md">
                    <h3 className="text-lg font-medium mb-2">Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      Preference settings will be available in a future update.
                    </p>
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>
  )
}
