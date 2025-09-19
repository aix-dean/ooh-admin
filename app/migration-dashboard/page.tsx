"use client"

import { MigrationLayout } from "@/components/migration-layout"
import { MigrationProgressTracker } from "@/components/migration-progress-tracker"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BarChart3, Database, TrendingUp, AlertTriangle, CheckCircle, Clock } from "lucide-react"
import Link from "next/link"

export default function MigrationDashboardPage() {
  const quickActions = [
    {
      title: "Start Company Migration",
      description: "Begin with the foundational company setup",
      href: "/migrate-companies",
      priority: "high",
      icon: "🏢",
    },
    {
      title: "Check Progress",
      description: "View detailed migration progress",
      href: "#progress",
      priority: "medium",
      icon: "📊",
    },
    {
      title: "View All Migrations",
      description: "Access all migration tools",
      href: "#navigation",
      priority: "low",
      icon: "🔧",
    },
  ]

  const migrationTips = [
    {
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
      title: "Start with Companies",
      description: "Always begin with company creation as other migrations depend on it.",
    },
    {
      icon: <Clock className="h-5 w-5 text-blue-600" />,
      title: "Monitor Progress",
      description: "Use the progress tracker to monitor migration status in real-time.",
    },
    {
      icon: <AlertTriangle className="h-5 w-5 text-yellow-600" />,
      title: "Handle Dependencies",
      description: "Ensure prerequisite migrations are completed before starting dependent ones.",
    },
    {
      icon: <Database className="h-5 w-5 text-purple-600" />,
      title: "Backup Data",
      description: "Always backup your data before running large-scale migrations.",
    },
  ]

  return (
    <MigrationLayout showProgressTracker={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
            <BarChart3 className="h-8 w-8" />
            Migration Dashboard
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Comprehensive overview and control center for all data migrations. Track progress, manage dependencies, and
            ensure smooth data transitions across your system.
          </p>
        </div>

        {/* Progress Overview */}
        <div id="progress">
          <MigrationProgressTracker />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Quick Actions
            </CardTitle>
            <CardDescription>Common migration tasks and recommended next steps</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {quickActions.map((action, index) => (
                <Link key={index} href={action.href}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-2xl">{action.icon}</span>
                        <Badge
                          variant={
                            action.priority === "high"
                              ? "destructive"
                              : action.priority === "medium"
                                ? "default"
                                : "secondary"
                          }
                        >
                          {action.priority}
                        </Badge>
                      </div>
                      <h3 className="font-semibold mb-1">{action.title}</h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Migration Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Migration Best Practices</CardTitle>
            <CardDescription>Important tips for successful data migrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {migrationTips.map((tip, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                  {tip.icon}
                  <div>
                    <h4 className="font-medium mb-1">{tip.title}</h4>
                    <p className="text-sm text-muted-foreground">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Navigation Section */}
        <div id="navigation">
          <Card>
            <CardHeader>
              <CardTitle>All Migration Tools</CardTitle>
              <CardDescription>
                Access individual migration tools using the navigation menu above, or use the progress tracker to
                monitor overall migration status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">
                  Use the navigation menu above to access specific migration tools
                </p>
                <Button asChild>
                  <Link href="/migrate-companies">Start with Company Migration</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MigrationLayout>
  )
}
