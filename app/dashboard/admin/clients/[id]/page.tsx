"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Edit, Building, CreditCard, FolderOpen, Mail, Phone, Globe, MapPin, User, Calendar } from "lucide-react"
import { Company } from "@/lib/company-service"
import { Subscription } from "@/types/subscription"
import { ProjectData } from "@/types/project"

export default function ClientDetailsPage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params.id as string

  const [company, setCompany] = useState<Company | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [project, setProject] = useState<ProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchClientDetails = async () => {
      try {
        setLoading(true)

        // Fetch company details
        const companyResponse = await fetch(`/api/clients/${clientId}`)
        if (!companyResponse.ok) {
          throw new Error("Failed to fetch company details")
        }
        const companyData = await companyResponse.json()
        setCompany(companyData.company)

        // Fetch subscription details (if company has subscription)
        if (companyData.company) {
          const company = companyData.company

          try {
            const subscriptionResponse = await fetch(`/api/subscriptions?companyId=${clientId}`)
            if (subscriptionResponse.ok) {
              const subscriptionData = await subscriptionResponse.json()
              if (subscriptionData.subscriptions && subscriptionData.subscriptions.length > 0) {
                setSubscription(subscriptionData.subscriptions[0])
              }
            }
          } catch (subError) {
            console.warn("Could not fetch subscription details:", subError)
          }

          // Fetch project details (if company has project)
          try {
            // Use company name to find projects since projects don't have companyId
            const projectResponse = await fetch(`/api/projects?companyId=${encodeURIComponent(company.name)}`)
            if (projectResponse.ok) {
              const projectData = await projectResponse.json()
              if (projectData.projects && projectData.projects.length > 0) {
                setProject(projectData.projects[0])
              }
            }
          } catch (projError) {
            console.warn("Could not fetch project details:", projError)
          }
        }

      } catch (err) {
        console.error("Error fetching client details:", err)
        setError(err instanceof Error ? err.message : "Failed to load client details")
      } finally {
        setLoading(false)
      }
    }

    if (clientId) {
      fetchClientDetails()
    }
  }, [clientId])

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "N/A"
    const d = typeof date === "string" ? new Date(date) : date
    if (!(d instanceof Date) || isNaN(d.getTime())) return "N/A"
    return d.toLocaleDateString()
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toLocaleString()}`
  }

  const maskLicenseKey = (key: string) => {
    if (!key || key.length < 8) return key
    const firstPart = key.substring(0, 4)
    const lastPart = key.substring(key.length - 4)
    const maskedLength = key.length - 8
    const mask = '*'.repeat(maskedLength)
    return `${firstPart}${mask}${lastPart}`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading client details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Client Not Found</h1>
          <p className="text-gray-600 mb-6">{error || "The requested client could not be found."}</p>
          <Link href="/dashboard/admin/clients">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/admin/clients">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{company.name}</h1>
            <p className="text-gray-600">Client Details & Information</p>
          </div>
        </div>
        <Link href={`/dashboard/admin/clients/${clientId}/edit`}>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Edit className="h-4 w-4 mr-2" />
            Edit Client
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Company Information */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Company Name</label>
                  <p className="text-lg font-semibold text-gray-900">{company.name}</p>
                </div>
                {company.business_type && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Business Type</label>
                    <p className="text-gray-900">{company.business_type}</p>
                  </div>
                )}
              </div>

              {company.industry && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Industry</label>
                  <p className="text-gray-900">{company.industry}</p>
                </div>
              )}

              {company.size && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Company Size</label>
                  <p className="text-gray-900">{company.size}</p>
                </div>
              )}

              {company.website && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Website</label>
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <Globe className="h-4 w-4" />
                    {company.website}
                  </a>
                </div>
              )}

              {company.description && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="text-gray-900">{company.description}</p>
                </div>
              )}

              <Separator />

              <div>
                <label className="text-sm font-medium text-gray-500 mb-2 block">Address</label>
                {company.address ? (
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-gray-900">{company.address.street}</p>
                      <p className="text-gray-900">{company.address.city}, {company.address.province}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-500">No address provided</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Created</label>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(company.created_at || company.createdAt)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Last Updated</label>
                  <p className="text-gray-900 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {formatDate(company.updated_at || company.updatedAt)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Point Person Information */}
          {company.point_person && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Point Person
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Name</label>
                    <p className="text-lg font-semibold text-gray-900">
                      {company.point_person.first_name} {company.point_person.last_name}
                    </p>
                  </div>
                  {company.point_person.position && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Position</label>
                      <p className="text-gray-900">{company.point_person.position}</p>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.point_person.email && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Email</label>
                      <a
                        href={`mailto:${company.point_person.email}`}
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        <Mail className="h-4 w-4" />
                        {company.point_person.email}
                      </a>
                    </div>
                  )}
                  {company.phone && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <a
                        href={`tel:${company.phone}`}
                        className="text-blue-600 hover:underline flex items-center gap-2"
                      >
                        <Phone className="h-4 w-4" />
                        {company.phone}
                      </a>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar with Subscription & Project */}
        <div className="space-y-6">
          {/* Subscription Information */}
          {subscription ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Plan</label>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{subscription.planType}</p>
                    <Badge variant={subscription.status === "active" ? "default" : "secondary"}>
                      {subscription.status}
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Billing Cycle</label>
                  <p className="text-gray-900 capitalize">{subscription.billingCycle}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Max Products</label>
                    <p className="text-gray-900">{subscription.maxProducts}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Max Users</label>
                    <p className="text-gray-900">{subscription.maxUsers}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">License Key</label>
                  <p className="text-sm font-mono text-gray-900 bg-gray-100 p-2 rounded">
                    {maskLicenseKey(subscription.licenseKey)}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Start Date</label>
                    <p className="text-gray-900">{formatDate(subscription.startDate)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">End Date</label>
                    <p className="text-gray-900">
                      {subscription.endDate ? formatDate(subscription.endDate) : "Lifetime"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">No active subscription found</p>
              </CardContent>
            </Card>
          )}

          {/* Project Information */}
          {project ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  License
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Project Name</label>
                  <p className="font-semibold text-gray-900">{project.project_name}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">License Key</label>
                  <p className="text-sm font-mono text-gray-900 bg-gray-100 p-2 rounded">
                    {maskLicenseKey(project.license_key)}
                  </p>
                </div>

                {project.company_website && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Company Website</label>
                    <a
                      href={project.company_website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {project.company_website}
                    </a>
                  </div>
                )}

                {project.company_location && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Location</label>
                    <p className="text-gray-900">{project.company_location}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-gray-900">{formatDate(project.created)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Updated</label>
                    <p className="text-gray-900">{formatDate(project.updated)}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <Badge variant={project.deleted ? "destructive" : "default"}>
                    {project.deleted ? "Deleted" : "Active"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  License
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">No license found</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
