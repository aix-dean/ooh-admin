"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  getImmigrationStatistics,
  getLatestImmigrationStatistics,
  type ImmigrationStatistics,
  CATEGORIES,
} from "@/lib/immigration-statistics"
import { formatDate } from "@/lib/date-utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Users, ShoppingBag, Smartphone } from "lucide-react"

export function ImmigrationStatisticsDisplay() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statistics, setStatistics] = useState<Record<string, ImmigrationStatistics[]>>({
    OHPLUS: [],
    SELLAH: [],
    OHSHOP: [],
  })
  const [latestStats, setLatestStats] = useState<Record<string, ImmigrationStatistics | null>>({
    OHPLUS: null,
    SELLAH: null,
    OHSHOP: null,
  })

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const [allStats, latest] = await Promise.all([getImmigrationStatistics(), getLatestImmigrationStatistics()])
        setStatistics(allStats)
        setLatestStats(latest)
        setError(null)
      } catch (err) {
        console.error("Error fetching immigration statistics:", err)
        setError("Failed to load immigration statistics. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Calculate device distribution percentages
  const calculateDevicePercentage = (stats: ImmigrationStatistics | null) => {
    if (!stats) return { android: 0, ios: 0, web: 0 }

    const { android, ios, web } = stats.user_device
    const total = android + ios + web

    if (total === 0) return { android: 0, ios: 0, web: 0 }

    return {
      android: Math.round((android / total) * 100),
      ios: Math.round((ios / total) * 100),
      web: Math.round((web / total) * 100),
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-8 w-64" />
          </CardTitle>
          <CardDescription>
            <Skeleton className="h-4 w-96" />
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  // Check if we have any data
  const hasData = CATEGORIES.some((category) => statistics[category].length > 0)

  if (!hasData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>No Data</AlertTitle>
        <AlertDescription>
          No immigration statistics data found. Please check the Firestore collection.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Immigration Statistics</CardTitle>
        <CardDescription>User statistics and metrics for OH applications</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="comparison">
          <TabsList className="mb-4">
            <TabsTrigger value="comparison">Comparison</TabsTrigger>
            {CATEGORIES.map((category) => (
              <TabsTrigger key={category} value={category}>
                {category}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Comparison View */}
          <TabsContent value="comparison">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {CATEGORIES.map((category) => {
                const stats = latestStats[category]
                const devicePercentages = calculateDevicePercentage(stats)

                return (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{category}</CardTitle>
                      <CardDescription>Last updated: {stats ? formatDate(stats.updated) : "N/A"}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {stats ? (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Total Users</span>
                              <span className="text-2xl font-bold">{stats.total_users.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Active Users</span>
                              <span className="text-2xl font-bold">{stats.active_users.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Male Users</span>
                              <span className="text-xl font-semibold">{stats.male_users.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Female Users</span>
                              <span className="text-xl font-semibold">{stats.female_users.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">App Store</span>
                              <span className="text-xl font-semibold">{stats.app_store.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-muted-foreground">Play Store</span>
                              <span className="text-xl font-semibold">{stats.play_store.toLocaleString()}</span>
                            </div>
                          </div>

                          <div>
                            <h4 className="text-sm font-medium mb-2">Device Distribution</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Android</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-green-500 rounded-full"
                                      style={{ width: `${devicePercentages.android}%` }}
                                    />
                                  </div>
                                  <span className="text-sm">{devicePercentages.android}%</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">iOS</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-blue-500 rounded-full"
                                      style={{ width: `${devicePercentages.ios}%` }}
                                    />
                                  </div>
                                  <span className="text-sm">{devicePercentages.ios}%</span>
                                </div>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm">Web</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-purple-500 rounded-full"
                                      style={{ width: `${devicePercentages.web}%` }}
                                    />
                                  </div>
                                  <span className="text-sm">{devicePercentages.web}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="flex items-center justify-center h-40">
                          <p className="text-muted-foreground">No data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </TabsContent>

          {/* Individual Category Views */}
          {CATEGORIES.map((category) => (
            <TabsContent key={category} value={category}>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Summary Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        User Statistics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestStats[category] ? (
                        <div className="grid grid-cols-2 gap-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Total Users</p>
                            <p className="text-2xl font-bold">{latestStats[category]?.total_users.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Active Users</p>
                            <p className="text-2xl font-bold">{latestStats[category]?.active_users.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Male</p>
                            <p className="text-xl">{latestStats[category]?.male_users.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Female</p>
                            <p className="text-xl">{latestStats[category]?.female_users.toLocaleString()}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No data available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Downloads Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5" />
                        App Downloads
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestStats[category] ? (
                        <div className="grid grid-cols-2 gap-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">App Store</p>
                            <p className="text-2xl font-bold">{latestStats[category]?.app_store.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Play Store</p>
                            <p className="text-2xl font-bold">{latestStats[category]?.play_store.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Total Downloads</p>
                            <p className="text-xl">
                              {(latestStats[category]?.app_store + latestStats[category]?.play_store).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No data available</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Device Distribution Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2">
                        <Smartphone className="h-5 w-5" />
                        Device Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {latestStats[category] ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-sm text-muted-foreground">Android</p>
                              <p className="text-xl font-medium">
                                {latestStats[category]?.user_device.android.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">iOS</p>
                              <p className="text-xl font-medium">
                                {latestStats[category]?.user_device.ios.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-muted-foreground">Web</p>
                              <p className="text-xl font-medium">
                                {latestStats[category]?.user_device.web.toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {Object.entries(calculateDevicePercentage(latestStats[category])).map(
                              ([device, percentage]) => (
                                <div key={device} className="flex justify-between items-center">
                                  <span className="text-sm capitalize">{device}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          device === "android"
                                            ? "bg-green-500"
                                            : device === "ios"
                                              ? "bg-blue-500"
                                              : "bg-purple-500"
                                        }`}
                                        style={{ width: `${percentage}%` }}
                                      />
                                    </div>
                                    <span className="text-sm">{percentage}%</span>
                                  </div>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No data available</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Visitors Section */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Visitors</CardTitle>
                    <CardDescription>Registered vs. Unregistered visitors</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {latestStats[category] ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Registered Visitors</p>
                          <p className="text-2xl font-bold">
                            {latestStats[category]?.registered_visitors.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Unregistered Visitors</p>
                          <p className="text-2xl font-bold">
                            {latestStats[category]?.unregistered_visitors.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No data available</p>
                    )}
                  </CardContent>
                </Card>

                {/* Historical Data Table */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle>Historical Data</CardTitle>
                    <CardDescription>Past statistics for {category}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statistics[category].length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Total Users</TableHead>
                              <TableHead>Active Users</TableHead>
                              <TableHead>Male/Female</TableHead>
                              <TableHead>App/Play Store</TableHead>
                              <TableHead>Visitors (Reg/Unreg)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {statistics[category].map((stat) => (
                              <TableRow key={stat.id}>
                                <TableCell>
                                  <div className="font-medium">{formatDate(stat.created)}</div>
                                  <div className="text-xs text-muted-foreground">ID: {stat.id}</div>
                                </TableCell>
                                <TableCell>{stat.total_users.toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="bg-green-50">
                                    {stat.active_users.toLocaleString()}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {stat.male_users.toLocaleString()} / {stat.female_users.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {stat.app_store.toLocaleString()} / {stat.play_store.toLocaleString()}
                                </TableCell>
                                <TableCell>
                                  {stat.registered_visitors.toLocaleString()} /{" "}
                                  {stat.unregistered_visitors.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No historical data available</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
}
