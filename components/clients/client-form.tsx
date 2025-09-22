"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { CheckCircle, Loader2 } from "lucide-react"
import { SubscriptionPlan, SubscriptionPlanType, BillingCycle } from "@/types/subscription"
import { auth } from "@/lib/firebase"

interface ClientFormData {
  // Company data
  name: string
  business_type: string
  website: string
  address: {
    city: string
    province: string
    street: string
  }
  point_person: {
    email: string
    first_name: string
    last_name: string
    position: string
    password: string
  }
  phone: string
  description: string
  industry: string
  size: string

  // Subscription data
  planType: SubscriptionPlanType
  billingCycle: BillingCycle

  // Project data
  project_name: string
}

interface ClientFormProps {
  initialData?: Partial<ClientFormData>
  onSubmit?: (data: ClientFormData) => void
}

export function ClientForm({ initialData, onSubmit }: ClientFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([])
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)

  const [formData, setFormData] = useState<ClientFormData>({
    name: initialData?.name || "",
    business_type: initialData?.business_type || "",
    website: initialData?.website || "",
    address: {
      city: initialData?.address?.city || "",
      province: initialData?.address?.province || "",
      street: initialData?.address?.street || "",
    },
    point_person: {
      email: initialData?.point_person?.email || "",
      first_name: initialData?.point_person?.first_name || "",
      last_name: initialData?.point_person?.last_name || "",
      position: initialData?.point_person?.position || "",
      password: initialData?.point_person?.password || "",
    },
    phone: initialData?.phone || "",
    description: initialData?.description || "",
    industry: initialData?.industry || "",
    size: initialData?.size || "",
    planType: initialData?.planType || "trial",
    billingCycle: initialData?.billingCycle || "monthly",
    project_name: initialData?.project_name || "",
  })

  // Fetch subscription plans
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch("/api/subscription-plans")
        const data = await response.json()
        if (response.ok) {
          setSubscriptionPlans(data.plans)
          // Set default selected plan
          if (data.plans.length > 0) {
            const defaultPlan = data.plans.find((p: SubscriptionPlan) => p.id === formData.planType) || data.plans[0]
            setSelectedPlan(defaultPlan)
          }
        }
      } catch (error) {
        console.error("Error fetching subscription plans:", error)
      }
    }

    fetchPlans()
  }, [])

  // Update selected plan when planType changes
  useEffect(() => {
    const plan = subscriptionPlans.find(p => p.id === formData.planType)
    setSelectedPlan(plan || null)
  }, [formData.planType, subscriptionPlans])

  // Auto-generate project name
  useEffect(() => {
    if (formData.name && !formData.project_name) {
      setFormData(prev => ({
        ...prev,
        project_name: `${formData.name} Project`
      }))
    }
  }, [formData.name])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        [field]: value,
      },
    }))
  }

  const handlePointPersonChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      point_person: {
        ...prev.point_person,
        [field]: value,
      },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.name.trim()) {
      alert("Company name is required")
      return
    }

    if (!formData.point_person.email.trim()) {
      alert("Point person email is required")
      return
    }

    if (!formData.point_person.password.trim()) {
      alert("Point person password is required")
      return
    }

    if (formData.point_person.password.length < 6) {
      alert("Password must be at least 6 characters long")
      return
    }

    if (!selectedPlan) {
      alert("Please select a subscription plan")
      return
    }

    // Get current authenticated user
    if (!auth) {
      alert("Authentication service not available")
      return
    }

    const currentUser = auth.currentUser
    if (!currentUser) {
      alert("You must be logged in to create a client")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          uid: currentUser.uid,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        if (onSubmit) {
          onSubmit(formData)
        } else {
          router.push("/dashboard/admin/clients")
        }
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      console.error("Error creating client:", error)
      alert("Failed to create client. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {initialData ? "Edit Client" : "Add New Client"}
          </h1>
          <p className="text-gray-600">
            {initialData
              ? "Update client information and subscription details"
              : "Create a new company client with subscription and project"
            }
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Company Information */}
        <Card>
          <CardHeader>
            <CardTitle>Company Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Company Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter company name"
                  required
                />
              </div>
              <div>
                <Label htmlFor="business_type">Business Type</Label>
                <Select
                  value={formData.business_type}
                  onValueChange={(value) => handleInputChange("business_type", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Corporation">Corporation</SelectItem>
                    <SelectItem value="LLC">LLC</SelectItem>
                    <SelectItem value="Partnership">Partnership</SelectItem>
                    <SelectItem value="Sole Proprietorship">Sole Proprietorship</SelectItem>
                    <SelectItem value="Non-profit">Non-profit</SelectItem>
                    <SelectItem value="Operator">Operator</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange("website", e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                placeholder="Brief description of the company"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="industry">Industry</Label>
                <Select
                  value={formData.industry}
                  onValueChange={(value) => handleInputChange("industry", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="advertising-agency">Advertising Agency</SelectItem>
                    <SelectItem value="operator">Operator</SelectItem>
                    <SelectItem value="media-owner">Media Owner</SelectItem>
                    <SelectItem value="outdoor-advertising">Outdoor Advertising</SelectItem>
                    <SelectItem value="digital-signage">Digital Signage</SelectItem>
                    <SelectItem value="billboard-company">Billboard Company</SelectItem>
                    <SelectItem value="marketing-agency">Marketing Agency</SelectItem>
                    <SelectItem value="real-estate">Real Estate</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="hospitality">Hospitality</SelectItem>
                    <SelectItem value="transportation">Transportation</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                    <SelectItem value="non-profit">Non-Profit</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="size">Company Size</Label>
                <Select
                  value={formData.size}
                  onValueChange={(value) => handleInputChange("size", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select company size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-10">1-10 employees</SelectItem>
                    <SelectItem value="11-50">11-50 employees</SelectItem>
                    <SelectItem value="51-200">51-200 employees</SelectItem>
                    <SelectItem value="201-500">201-500 employees</SelectItem>
                    <SelectItem value="501-1000">501-1000 employees</SelectItem>
                    <SelectItem value="1000+">1000+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Information */}
        <Card>
          <CardHeader>
            <CardTitle>Address Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="street">Street Address</Label>
              <Input
                id="street"
                value={formData.address.street}
                onChange={(e) => handleAddressChange("street", e.target.value)}
                placeholder="123 Main Street"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.address.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  placeholder="City"
                />
              </div>
              <div>
                <Label htmlFor="province">Province/State</Label>
                <Input
                  id="province"
                  value={formData.address.province}
                  onChange={(e) => handleAddressChange("province", e.target.value)}
                  placeholder="Province or State"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Point Person Information */}
        <Card>
          <CardHeader>
            <CardTitle>Point Person</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={formData.point_person.first_name}
                  onChange={(e) => handlePointPersonChange("first_name", e.target.value)}
                  placeholder="First name"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={formData.point_person.last_name}
                  onChange={(e) => handlePointPersonChange("last_name", e.target.value)}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.point_person.email}
                  onChange={(e) => handlePointPersonChange("email", e.target.value)}
                  placeholder="email@example.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.point_person.position}
                  onChange={(e) => handlePointPersonChange("position", e.target.value)}
                  placeholder="Job title"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.point_person.password}
                  onChange={(e) => handlePointPersonChange("password", e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="+63 (XXX) XXX-XXXX"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="planType">Plan Type</Label>
                <Select
                  value={formData.planType}
                  onValueChange={(value: SubscriptionPlanType) => handleInputChange("planType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan type" />
                  </SelectTrigger>
                  <SelectContent>
                    {subscriptionPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="billingCycle">Billing Cycle</Label>
                <Select
                  value={formData.billingCycle}
                  onValueChange={(value: BillingCycle) => handleInputChange("billingCycle", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select billing cycle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedPlan && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900">{selectedPlan.name}</h4>
                <p className="text-blue-700 text-sm mt-1">{selectedPlan.description}</p>
                <div className="mt-2">
                  <span className="text-2xl font-bold text-blue-900">
                    ₱{selectedPlan.price}
                  </span>
                  <span className="text-blue-600 text-sm">
                    /{selectedPlan.billingCycle === "monthly" ? "month" : "year"}
                  </span>
                </div>
                <div className="mt-2">
                  <h5 className="font-medium text-blue-900">Features:</h5>
                  <ul className="text-sm text-blue-700 mt-1">
                    {selectedPlan.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Project Information */}
        <Card>
          <CardHeader>
            <CardTitle>Project Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div>
              <Label htmlFor="project_name">Project Name</Label>
              <Input
                id="project_name"
                value={formData.project_name}
                onChange={(e) => handleInputChange("project_name", e.target.value)}
                placeholder="Project name (auto-generated from company name)"
              />
              <p className="text-sm text-gray-500 mt-1">
                This will be auto-generated from the company name if left empty
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initialData ? "Update Client" : "Create Client"}
          </Button>
        </div>
      </form>
    </div>
  )
}
