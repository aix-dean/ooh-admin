"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Users,
  ShoppingCart,
  FileText,
  MessageSquare,
  BarChart3,
  Settings2,
  Package,
  Search,
  ExternalLink,
  TrendingUp,
  Activity,
} from "lucide-react"

interface QuickAccessCollection {
  name: string
  displayName: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  category: string
  priority: "high" | "medium" | "low"
  estimatedDocs?: number
}

const quickAccessCollections: QuickAccessCollection[] = [
  {
    name: "users",
    displayName: "Users",
    description: "Main user accounts and profiles",
    icon: Users,
    category: "User Management",
    priority: "high",
    estimatedDocs: 1000,
  },
  {
    name: "products",
    displayName: "Products",
    description: "Product catalog and inventory",
    icon: Package,
    category: "E-commerce",
    priority: "high",
    estimatedDocs: 500,
  },
  {
    name: "orders",
    displayName: "Orders",
    description: "Customer orders and transactions",
    icon: ShoppingCart,
    category: "E-commerce",
    priority: "high",
    estimatedDocs: 2000,
  },
  {
    name: "content_media",
    displayName: "Content Media",
    description: "Media files and content assets",
    icon: FileText,
    category: "Content & Media",
    priority: "high",
    estimatedDocs: 300,
  },
  {
    name: "analytics",
    displayName: "Analytics",
    description: "User behavior and app analytics",
    icon: BarChart3,
    category: "Analytics & Tracking",
    priority: "medium",
    estimatedDocs: 5000,
  },
  {
    name: "chat_messages",
    displayName: "Chat Messages",
    description: "Real-time messaging data",
    icon: MessageSquare,
    category: "Communication",
    priority: "medium",
    estimatedDocs: 10000,
  },
  {
    name: "app_config",
    displayName: "App Configuration",
    description: "Application settings and configuration",
    icon: Settings2,
    category: "Configuration",
    priority: "medium",
    estimatedDocs: 50,
  },
  {
    name: "categories",
    displayName: "Categories",
    description: "Product and content categories",
    icon: Package,
    category: "E-commerce",
    priority: "medium",
    estimatedDocs: 100,
  },
]

export function QuickAccessDashboard() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const handleCollectionClick = (collectionName: string) => {
    const encodedPath = encodeURIComponent(collectionName)
    router.push(`/dashboard/products/collections/${encodedPath}`)
  }

  const filteredCollections = quickAccessCollections.filter((collection) => {
    const matchesSearch =
      collection.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      collection.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCategory = selectedCategory === "all" || collection.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(quickAccessCollections.map((c) => c.category)))

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-50 border-red-200"
      case "medium":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      case "low":
        return "text-green-600 bg-green-50 border-green-200"
      default:
        return "text-gray-600 bg-gray-50 border-gray-200"
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quick Access</h2>
          <p className="text-muted-foreground">Frequently used collections and data sources</p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/products?tab=explorer")}>
          <Search className="h-4 w-4 mr-2" />
          View All Collections
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search collections..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedCategory === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-red-600">
                  {quickAccessCollections.filter((c) => c.priority === "high").length}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">
                  {quickAccessCollections.reduce((sum, c) => sum + (c.estimatedDocs || 0), 0).toLocaleString()}
                </p>
              </div>
              <Activity className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categories</p>
                <p className="text-2xl font-bold">{categories.length}</p>
              </div>
              <Package className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCollections.map((collection) => {
          const Icon = collection.icon
          return (
            <Card
              key={collection.name}
              className="cursor-pointer hover:shadow-md transition-all duration-200 hover:scale-105"
              onClick={() => handleCollectionClick(collection.name)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <Icon className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{collection.displayName}</CardTitle>
                      <Badge variant="outline" className={getPriorityColor(collection.priority)}>
                        {collection.priority}
                      </Badge>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="mb-3">{collection.description}</CardDescription>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{collection.category}</span>
                  {collection.estimatedDocs && (
                    <Badge variant="secondary">{collection.estimatedDocs.toLocaleString()} docs</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredCollections.length === 0 && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No collections match your search criteria</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
