"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Users, UserPlus, Store, RefreshCw, Calendar, Clock, TrendingUp, Activity } from "lucide-react"
import { getMembersCount, getOHPlusMembersCount, getSellahMembersCount } from "@/lib/members-service"

interface MembersAnalyticsProps {
  className?: string
}

export function MembersAnalytics({ className }: MembersAnalyticsProps) {
  const [oohShopCount, setOohShopCount] = useState<number>(0)
  const [ohPlusCount, setOhPlusCount] = useState<number>(0)
  const [sellahCount, setSellahCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  const [isFiltering, setIsFiltering] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Date range states
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [dateError, setDateError] = useState("")
  const [isAllTime, setIsAllTime] = useState(false)

  // Initialize with last 30 days
  useEffect(() => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    setStartDate(thirtyDaysAgo.toISOString().slice(0, 16))
    setEndDate(today.toISOString().slice(0, 16))

    // Fetch initial data for last 30 days
    fetchMemberCounts(thirtyDaysAgo.toISOString().slice(0, 16), today.toISOString().slice(0, 16))
  }, [])

  const fetchMemberCounts = async (startDate?: string, endDate?: string, allTime = false) => {
    try {
      setError(null)

      // Convert to Date objects if dates are provided and not in all-time mode
      const startDateObj = !allTime && startDate ? new Date(startDate) : undefined
      const endDateObj = !allTime && endDate ? new Date(endDate) : undefined

      console.log("Fetching member counts:", {
        startDate: startDateObj,
        endDate: endDateObj,
        allTime,
      })

      const [oohShop, ohPlus, sellah] = await Promise.all([
        getMembersCount(startDateObj, endDateObj),
        getOHPlusMembersCount(startDateObj, endDateObj),
        getSellahMembersCount(startDateObj, endDateObj),
      ])

      setOohShopCount(oohShop)
      setOhPlusCount(ohPlus)
      setSellahCount(sellah)
    } catch (err) {
      console.error("Error fetching member counts:", err)
      setError("Failed to fetch member analytics. Please try again.")
    } finally {
      setLoading(false)
      setIsFiltering(false)
    }
  }

  const handleDateRangeFilter = () => {
    if (!startDate || !endDate) {
      setDateError("Please select both start and end dates")
      return
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    if (start > end) {
      setDateError("Start date must be before end date")
      return
    }

    if (end > new Date()) {
      setDateError("End date cannot be in the future")
      return
    }

    setDateError("")
    setIsFiltering(true)
    setIsAllTime(false)
    fetchMemberCounts(startDate, endDate)
  }

  const handleAllTimeFilter = () => {
    setIsAllTime(true)
    setIsFiltering(true)
    setDateError("")
    fetchMemberCounts(undefined, undefined, true)
  }

  const handleCustomRangeFilter = () => {
    setIsAllTime(false)
    // Don't automatically filter, let user set dates first
  }

  const handleLast30Days = () => {
    const today = new Date()
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    setStartDate(thirtyDaysAgo.toISOString().slice(0, 16))
    setEndDate(today.toISOString().slice(0, 16))
    setIsAllTime(false)
    setIsFiltering(true)
    setDateError("")

    fetchMemberCounts(thirtyDaysAgo.toISOString().slice(0, 16), today.toISOString().slice(0, 16))
  }

  const handleRefresh = () => {
    setIsFiltering(true)
    if (isAllTime) {
      fetchMemberCounts(undefined, undefined, true)
    } else {
      fetchMemberCounts(startDate, endDate)
    }
  }

  const totalMembers = oohShopCount + ohPlusCount + sellahCount

  const formatDateRange = () => {
    if (isAllTime) {
      return "All Time"
    }
    if (startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString()
      const end = new Date(endDate).toLocaleDateString()
      return `${start} - ${end}`
    }
    return "Select date range"
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            <p>{error}</p>
            <Button onClick={handleRefresh} className="mt-2">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Filter Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Member Analytics Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Type Toggle */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={isAllTime ? "default" : "outline"}
              size="sm"
              onClick={handleAllTimeFilter}
              disabled={isFiltering}
              className="flex items-center gap-2"
            >
              <Clock className="h-4 w-4" />
              All Time
            </Button>
            <Button
              variant={!isAllTime ? "default" : "outline"}
              size="sm"
              onClick={handleCustomRangeFilter}
              disabled={isFiltering}
              className="flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" />
              Custom Range
            </Button>
          </div>

          {/* Date Range Inputs - Only show when not in all-time mode */}
          {!isAllTime && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label htmlFor="start-date" className="block text-sm font-medium mb-1">
                  Start Date & Time
                </label>
                <input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isFiltering}
                />
              </div>

              <div>
                <label htmlFor="end-date" className="block text-sm font-medium mb-1">
                  End Date & Time
                </label>
                <input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isFiltering}
                />
              </div>

              <Button
                onClick={handleDateRangeFilter}
                disabled={isFiltering || !startDate || !endDate}
                className="flex items-center gap-2"
              >
                {isFiltering ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                Apply Filter
              </Button>

              <Button
                variant="outline"
                onClick={handleLast30Days}
                disabled={isFiltering}
                className="flex items-center gap-2 bg-transparent"
              >
                <Calendar className="h-4 w-4" />
                Last 30 Days
              </Button>
            </div>
          )}

          {/* Error Display */}
          {dateError && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{dateError}</div>}

          {/* Current Filter Display */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Current Filter: {formatDateRange()}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isFiltering}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFiltering ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || isFiltering ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totalMembers.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">All platforms combined</p>
          </CardContent>
        </Card>

        {/* OOH! Shop Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OOH! Shop Members</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || isFiltering ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">{oohShopCount.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Regular shop members</p>
          </CardContent>
        </Card>

        {/* OH! Plus Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OH! Plus Members</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || isFiltering ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{ohPlusCount.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Premium members</p>
          </CardContent>
        </Card>

        {/* Sellah Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sellah Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading || isFiltering ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold text-purple-600">{sellahCount.toLocaleString()}</div>
            )}
            <p className="text-xs text-muted-foreground">Seller members</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Quick Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading || isFiltering ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {totalMembers > 0 ? ((oohShopCount / totalMembers) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">OOH! Shop Share</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {totalMembers > 0 ? ((ohPlusCount / totalMembers) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">OH! Plus Share</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {totalMembers > 0 ? ((sellahCount / totalMembers) * 100).toFixed(1) : 0}%
                </div>
                <div className="text-sm text-muted-foreground">Sellah Share</div>
              </div>
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex flex-wrap gap-2 justify-center">
            <Badge variant="outline" className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Period: {formatDateRange()}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Total: {totalMembers.toLocaleString()}
            </Badge>
            {!loading && !isFiltering && (
              <Badge variant="outline" className="flex items-center gap-1 text-green-600">
                <Activity className="h-3 w-3" />
                Live Data
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
