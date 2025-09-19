"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { format } from "date-fns"
import { Loader2, AlertCircle, WifiOff } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useNetworkStatus } from "@/lib/network-status"
import { checkFirestoreConnection } from "@/lib/auth"

export default function DashboardPage() {
  const { user, userData, refreshUserData } = useAuth()
  const isNetworkOnline = useNetworkStatus()
  const [greeting, setGreeting] = useState("Good day")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFirestoreConnected, setIsFirestoreConnected] = useState(true)

  // Set greeting based on time of day
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting("Good morning")
    else if (hour < 18) setGreeting("Good afternoon")
    else setGreeting("Good evening")
  }, [])

  // Check Firestore connection and refresh user data if needed
  useEffect(() => {
    const checkConnection = async () => {
      if (!isNetworkOnline) {
        setIsFirestoreConnected(false)
        return
      }

      setIsLoading(true)
      try {
        const isConnected = await checkFirestoreConnection()
        setIsFirestoreConnected(isConnected)

        if (isConnected && user && !userData) {
          await refreshUserData()
        }
      } catch (error) {
        console.error("Error checking connection:", error)
        setIsFirestoreConnected(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkConnection()
  }, [isNetworkOnline, user, userData, refreshUserData])

  // Handle retry when connection fails
  const handleRetry = async () => {
    setError(null)
    setIsLoading(true)

    try {
      const isConnected = await checkFirestoreConnection()
      setIsFirestoreConnected(isConnected)

      if (isConnected) {
        await refreshUserData()
      } else {
        setError("Still unable to connect to the database. Please try again later.")
      }
    } catch (error: any) {
      setError(error.message || "An error occurred while connecting to the database")
    } finally {
      setIsLoading(false)
    }
  }

  // Use userData if available, otherwise fallback to user
  const displayName = userData?.display_name || user?.displayName || user?.email?.split("@")[0] || "User"
  const firstName = userData?.first_name || displayName.split(" ")[0]

  const today = new Date()
  const formattedDate = format(today, "EEEE")
  const formattedFullDate = format(today, "MMMM d, yyyy")

  return (
    <div className="space-y-4 pb-6">
      <div className="flex flex-col justify-between gap-2 sm:gap-4 md:flex-row">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Welcome to your <span className="font-medium">Home Dashboard</span> - the main view of OH! Shop Admin
          </p>
        </div>
        <div className="mt-2 text-left md:mt-0 md:text-right">
          <h2 className="text-lg font-bold sm:text-xl">{formattedDate}</h2>
          <p className="text-sm text-muted-foreground">{formattedFullDate}</p>
        </div>
      </div>

      {/* Network Status Alert */}
      {!isNetworkOnline && (
        <Alert variant="destructive" className="bg-amber-50 border-amber-500">
          <WifiOff className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-600 text-sm">
            You are currently offline. Please check your internet connection to see the latest data.
          </AlertDescription>
        </Alert>
      )}

      {/* Firestore Connection Alert */}
      {isNetworkOnline && !isFirestoreConnected && !isLoading && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
            <span className="text-sm">Unable to connect to the database. Some data may not be up to date.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isLoading}
              className="self-start sm:self-auto"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Checking...
                </>
              ) : (
                "Retry"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">{error}</AlertDescription>
        </Alert>
      )}

      {/* Banner Card - Responsive */}
      <Card className="overflow-hidden w-full">
        <div className="relative w-full" style={{ aspectRatio: "1469.04 / 430" }}>
          <Image
            src="/images/home-banner.png"
            alt="OH! Shop Admin"
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 1200px"
            style={{ objectFit: "contain" }}
            priority
          />
        </div>
      </Card>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : userData ? (
        <div className="hidden grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="h-full">
            <CardContent className="p-4 sm:p-6">
              <h3 className="mb-1 text-sm font-medium sm:mb-2">Followers</h3>
              <p className="text-xl font-bold sm:text-2xl">{userData.followers}</p>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-4 sm:p-6">
              <h3 className="mb-1 text-sm font-medium sm:mb-2">Rating</h3>
              <p className="text-xl font-bold sm:text-2xl">
                {userData?.rating !== undefined ? userData.rating.toFixed(1) : "-"}
              </p>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-4 sm:p-6">
              <h3 className="mb-1 text-sm font-medium sm:mb-2">Status</h3>
              <p className="text-xl font-bold sm:text-2xl">{userData.active ? "Active" : "Inactive"}</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="h-full">
            <CardContent className="p-4 sm:p-6">
              <h3 className="mb-1 text-sm font-medium sm:mb-2">Followers</h3>
              <p className="text-xl font-bold sm:text-2xl">-</p>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-4 sm:p-6">
              <h3 className="mb-1 text-sm font-medium sm:mb-2">Rating</h3>
              <p className="text-xl font-bold sm:text-2xl">-</p>
            </CardContent>
          </Card>
          <Card className="h-full">
            <CardContent className="p-4 sm:p-6">
              <h3 className="mb-1 text-sm font-medium sm:mb-2">Status</h3>
              <p className="text-xl font-bold sm:text-2xl">-</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
