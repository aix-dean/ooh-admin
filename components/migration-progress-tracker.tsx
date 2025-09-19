"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Database,
  Users,
  Building2,
  Package,
  Calendar,
  FileText,
  MessageSquare,
  BarChart3,
} from "lucide-react"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, limit } from "firebase/firestore"

interface MigrationStatus {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: "core" | "data" | "communication"
  status: "not_started" | "in_progress" | "completed" | "error"
  progress: number
  totalItems: number
  processedItems: number
  updatedItems: number
  skippedItems: number
  errorItems: number
  lastRun?: Date
  estimatedTimeRemaining?: string
  dependencies?: string[]
}

interface OverallStats {
  totalMigrations: number
  completedMigrations: number
  inProgressMigrations: number
  notStartedMigrations: number
  errorMigrations: number
  overallProgress: number
  totalDataPoints: number
  migratedDataPoints: number
}

const migrationConfigs: Omit<
  MigrationStatus,
  "status" | "progress" | "totalItems" | "processedItems" | "updatedItems" | "skippedItems" | "errorItems"
>[] = [
  {
    id: "companies",
    name: "Company Creation",
    description: "Create companies and assign users by license key",
    icon: Building2,
    category: "core",
    dependencies: [],
  },
  {
    id: "products",
    name: "Product Companies",
    description: "Update products with seller company IDs",
    icon: Package,
    category: "data",
    dependencies: ["companies"],
  },
  {
    id: "bookings",
    name: "Booking Companies",
    description: "Update bookings with company information",
    icon: Calendar,
    category: "data",
    dependencies: ["companies"],
  },
  {
    id: "quotations",
    name: "Quotation Companies",
    description: "Update quotations with company data",
    icon: FileText,
    category: "data",
    dependencies: ["companies"],
  },
  {
    id: "followers",
    name: "Follower Companies",
    description: "Update followers with seller companies",
    icon: Users,
    category: "data",
    dependencies: ["companies"],
  },
  {
    id: "chats",
    name: "Chat Companies",
    description: "Update chats with company IDs from users",
    icon: MessageSquare,
    category: "communication",
    dependencies: ["companies"],
  },
]

export function MigrationProgressTracker() {
  const [migrations, setMigrations] = useState<MigrationStatus[]>([])
  const [overallStats, setOverallStats] = useState<OverallStats>({
    totalMigrations: 0,
    completedMigrations: 0,
    inProgressMigrations: 0,
    notStartedMigrations: 0,
    errorMigrations: 0,
    overallProgress: 0,
    totalDataPoints: 0,
    migratedDataPoints: 0,
  })
  const [loading, setLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Check migration status for each migration type
  const checkMigrationStatus = async (): Promise<MigrationStatus[]> => {
    const statusPromises = migrationConfigs.map(async (config) => {
      try {
        let status: MigrationStatus["status"] = "not_started"
        let progress = 0
        let totalItems = 0
        let processedItems = 0
        let updatedItems = 0
        const skippedItems = 0
        const errorItems = 0

        switch (config.id) {
          case "companies": {
            // Check users without company_id vs users with company_id
            const usersWithoutCompanyQuery = query(
              collection(db, "iboard_users"),
              where("license_key", "!=", null),
              limit(1000),
            )
            const usersWithoutCompanySnapshot = await getDocs(usersWithoutCompanyQuery)

            let usersWithoutCompany = 0
            let usersWithCompany = 0

            usersWithoutCompanySnapshot.docs.forEach((doc) => {
              const userData = doc.data()
              if (userData.company_id) {
                usersWithCompany++
              } else {
                usersWithoutCompany++
              }
            })

            totalItems = usersWithoutCompany + usersWithCompany
            updatedItems = usersWithCompany
            processedItems = totalItems

            if (totalItems > 0) {
              progress = (updatedItems / totalItems) * 100
              status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"
            }
            break
          }

          case "products": {
            // Check products without company_id
            const productsQuery = query(collection(db, "products"), limit(1000))
            const productsSnapshot = await getDocs(productsQuery)

            let productsWithoutCompany = 0
            let productsWithCompany = 0

            productsSnapshot.docs.forEach((doc) => {
              const productData = doc.data()
              if (productData.company_id) {
                productsWithCompany++
              } else {
                productsWithoutCompany++
              }
            })

            totalItems = productsWithoutCompany + productsWithCompany
            updatedItems = productsWithCompany
            processedItems = totalItems

            if (totalItems > 0) {
              progress = (updatedItems / totalItems) * 100
              status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"
            }
            break
          }

          case "bookings": {
            // Check bookings without company_id
            const bookingsQuery = query(collection(db, "booking"), limit(1000))
            const bookingsSnapshot = await getDocs(bookingsQuery)

            let bookingsWithoutCompany = 0
            let bookingsWithCompany = 0

            bookingsSnapshot.docs.forEach((doc) => {
              const bookingData = doc.data()
              if (bookingData.company_id) {
                bookingsWithCompany++
              } else {
                bookingsWithoutCompany++
              }
            })

            totalItems = bookingsWithoutCompany + bookingsWithCompany
            updatedItems = bookingsWithCompany
            processedItems = totalItems

            if (totalItems > 0) {
              progress = (updatedItems / totalItems) * 100
              status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"
            }
            break
          }

          case "quotations": {
            // Check quotations without company_id
            const quotationsQuery = query(collection(db, "quotation_request"), limit(1000))
            const quotationsSnapshot = await getDocs(quotationsQuery)

            let quotationsWithoutCompany = 0
            let quotationsWithCompany = 0

            quotationsSnapshot.docs.forEach((doc) => {
              const quotationData = doc.data()
              if (quotationData.company_id) {
                quotationsWithCompany++
              } else {
                quotationsWithoutCompany++
              }
            })

            totalItems = quotationsWithoutCompany + quotationsWithCompany
            updatedItems = quotationsWithCompany
            processedItems = totalItems

            if (totalItems > 0) {
              progress = (updatedItems / totalItems) * 100
              status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"
            }
            break
          }

          case "followers": {
            // Check followers without company_id
            const followersQuery = query(collection(db, "followers"), limit(1000))
            const followersSnapshot = await getDocs(followersQuery)

            let followersWithoutCompany = 0
            let followersWithCompany = 0

            followersSnapshot.docs.forEach((doc) => {
              const followerData = doc.data()
              if (followerData.company_id) {
                followersWithCompany++
              } else {
                followersWithoutCompany++
              }
            })

            totalItems = followersWithoutCompany + followersWithCompany
            updatedItems = followersWithCompany
            processedItems = totalItems

            if (totalItems > 0) {
              progress = (updatedItems / totalItems) * 100
              status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"
            }
            break
          }

          case "chats": {
            // Check chats without company_id
            const chatsQuery = query(collection(db, "chats"), limit(1000))
            const chatsSnapshot = await getDocs(chatsQuery)

            let chatsWithoutCompany = 0
            let chatsWithCompany = 0

            chatsSnapshot.docs.forEach((doc) => {
              const chatData = doc.data()
              if (chatData.company_id) {
                chatsWithCompany++
              } else {
                chatsWithoutCompany++
              }
            })

            totalItems = chatsWithoutCompany + chatsWithCompany
            updatedItems = chatsWithCompany
            processedItems = totalItems

            if (totalItems > 0) {
              progress = (updatedItems / totalItems) * 100
              status = progress === 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"
            }
            break
          }
        }

        return {
          ...config,
          status,
          progress: Math.round(progress),
          totalItems,
          processedItems,
          updatedItems,
          skippedItems,
          errorItems,
          lastRun: new Date(),
        }
      } catch (error) {
        console.error(`Error checking status for ${config.id}:`, error)
        return {
          ...config,
          status: "error" as const,
          progress: 0,
          totalItems: 0,
          processedItems: 0,
          updatedItems: 0,
          skippedItems: 0,
          errorItems: 1,
        }
      }
    })

    return Promise.all(statusPromises)
  }

  // Calculate overall statistics
  const calculateOverallStats = (migrations: MigrationStatus[]): OverallStats => {
    const totalMigrations = migrations.length
    const completedMigrations = migrations.filter((m) => m.status === "completed").length
    const inProgressMigrations = migrations.filter((m) => m.status === "in_progress").length
    const notStartedMigrations = migrations.filter((m) => m.status === "not_started").length
    const errorMigrations = migrations.filter((m) => m.status === "error").length

    const totalDataPoints = migrations.reduce((sum, m) => sum + m.totalItems, 0)
    const migratedDataPoints = migrations.reduce((sum, m) => sum + m.updatedItems, 0)

    const overallProgress = totalDataPoints > 0 ? (migratedDataPoints / totalDataPoints) * 100 : 0

    return {
      totalMigrations,
      completedMigrations,
      inProgressMigrations,
      notStartedMigrations,
      errorMigrations,
      overallProgress: Math.round(overallProgress),
      totalDataPoints,
      migratedDataPoints,
    }
  }

  // Refresh migration status
  const refreshStatus = async () => {
    setLoading(true)
    try {
      const migrationStatuses = await checkMigrationStatus()
      setMigrations(migrationStatuses)
      setOverallStats(calculateOverallStats(migrationStatuses))
      setLastUpdated(new Date())
    } catch (error) {
      console.error("Error refreshing migration status:", error)
    } finally {
      setLoading(false)
    }
  }

  // Load initial data
  useEffect(() => {
    refreshStatus()
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  const getStatusColor = (status: MigrationStatus["status"]) => {
    switch (status) {
      case "completed":
        return "text-green-600 bg-green-50"
      case "in_progress":
        return "text-blue-600 bg-blue-50"
      case "error":
        return "text-red-600 bg-red-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const getStatusIcon = (status: MigrationStatus["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "in_progress":
        return <Clock className="h-4 w-4 text-blue-600" />
      case "error":
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Database className="h-4 w-4 text-gray-600" />
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "core":
        return <Building2 className="h-4 w-4" />
      case "data":
        return <Database className="h-4 w-4" />
      case "communication":
        return <MessageSquare className="h-4 w-4" />
      default:
        return <BarChart3 className="h-4 w-4" />
    }
  }

  return (
    <div className="space-y-6">
      {/* Overall Progress Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Migration Progress Overview
              </CardTitle>
              <CardDescription>
                Track the progress of all data migrations across the system
                {lastUpdated && (
                  <span className="block text-xs mt-1">Last updated: {lastUpdated.toLocaleTimeString()}</span>
                )}
              </CardDescription>
            </div>
            <Button onClick={refreshStatus} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Overall Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Overall Migration Progress</span>
                <span className="text-muted-foreground">{overallStats.overallProgress}%</span>
              </div>
              <Progress value={overallStats.overallProgress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{overallStats.migratedDataPoints.toLocaleString()} migrated</span>
                <span>{overallStats.totalDataPoints.toLocaleString()} total records</span>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{overallStats.completedMigrations}</div>
                <div className="text-xs text-green-600">Completed</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{overallStats.inProgressMigrations}</div>
                <div className="text-xs text-blue-600">In Progress</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{overallStats.notStartedMigrations}</div>
                <div className="text-xs text-gray-600">Not Started</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{overallStats.errorMigrations}</div>
                <div className="text-xs text-red-600">Errors</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{overallStats.totalMigrations}</div>
                <div className="text-xs text-purple-600">Total</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual Migration Status */}
      <Card>
        <CardHeader>
          <CardTitle>Individual Migration Status</CardTitle>
          <CardDescription>Detailed progress for each migration type</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {migrations.map((migration) => {
              const Icon = migration.icon
              return (
                <div key={migration.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(migration.category)}
                        <Icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{migration.name}</h3>
                        <p className="text-sm text-muted-foreground">{migration.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(migration.status)}
                      <Badge className={getStatusColor(migration.status)}>{migration.status.replace("_", " ")}</Badge>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2 mb-3">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{migration.progress}%</span>
                    </div>
                    <Progress value={migration.progress} className="h-2" />
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">{migration.totalItems.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Total Items</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{migration.updatedItems.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Updated</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-yellow-600">{migration.skippedItems.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Skipped</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-red-600">{migration.errorItems.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Errors</div>
                    </div>
                  </div>

                  {/* Dependencies */}
                  {migration.dependencies && migration.dependencies.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Dependencies:</span>{" "}
                        {migration.dependencies.map((dep, index) => (
                          <span key={dep}>
                            {dep}
                            {index < migration.dependencies!.length - 1 && ", "}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Migration Recommendations */}
      {overallStats.notStartedMigrations > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Recommendation:</strong> Start with the "Company Creation" migration first, as other migrations
            depend on it. You have {overallStats.notStartedMigrations} migrations that haven't been started yet.
          </AlertDescription>
        </Alert>
      )}

      {overallStats.errorMigrations > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Attention Required:</strong> {overallStats.errorMigrations} migration(s) have errors that need to be
            resolved.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
