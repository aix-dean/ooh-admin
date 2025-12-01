import { NextRequest, NextResponse } from "next/server"
import { db, auth } from "@/lib/firebase"
import { collection, getDocs, query, orderBy, limit, startAfter, where, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore"
import { Company } from "@/lib/company-service"
import { Subscription, SubscriptionPlanType } from "@/types/subscription"
import { ProjectData } from "@/types/project"

// GET /api/clients - List companies with pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get("page") || "1")
    const pageSize = parseInt(searchParams.get("pageSize") || "15")
    const search = searchParams.get("search") || ""

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize

    let companiesQuery = query(
      collection(db, "companies"),
      orderBy("created_at", "desc")
    )

    // Add search filter if provided
    if (search) {
      companiesQuery = query(
        collection(db, "companies"),
        where("name", ">=", search),
        where("name", "<=", search + "\uf8ff"),
        orderBy("name")
      )
    }

    // Get total count for pagination
    const totalSnapshot = await getDocs(collection(db, "companies"))
    const totalCount = totalSnapshot.size

    // Apply pagination
    if (offset > 0) {
      const startAfterDoc = await getStartAfterDoc(companiesQuery, offset)
      if (startAfterDoc) {
        companiesQuery = query(companiesQuery, startAfter(startAfterDoc))
      }
    }

    companiesQuery = query(companiesQuery, limit(pageSize))

    const querySnapshot = await getDocs(companiesQuery)
    const companies: Company[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      companies.push({
        id: doc.id,
        name: data.name || "",
        address: data.address,
        business_type: data.business_type,
        created_at: data.created_at?.toDate?.() || new Date(data.created_at),
        created_by: data.created_by,
        point_person: data.point_person,
        updated_at: data.updated_at?.toDate?.() || new Date(data.updated_at),
        updated_by: data.updated_by,
        website: data.website,
        phone: data.phone,
        description: data.description,
        industry: data.industry,
        size: data.size,
        founded: data.founded?.toDate?.() || new Date(data.founded),
        status: data.status,
        createdAt: data.created_at?.toDate?.() || new Date(data.created_at),
        updatedAt: data.updated_at?.toDate?.() || new Date(data.updated_at),
      })
    })

    const totalPages = Math.ceil(totalCount / pageSize)

    return NextResponse.json({
      companies,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    console.error("Error fetching companies:", error)
    return NextResponse.json(
      { error: "Failed to fetch companies" },
      { status: 500 }
    )
  }
}

// Helper function to get the document to start after for pagination
async function getStartAfterDoc(queryRef: any, offset: number) {
  const snapshot = await getDocs(query(queryRef, limit(offset)))
  if (snapshot.docs.length > 0) {
    return snapshot.docs[snapshot.docs.length - 1]
  }
  return null
}

// POST /api/clients - Create new client (company + subscription + project)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      // Company data
      name,
      business_type,
      website,
      address,
      point_person,
      phone,
      description,
      industry,
      size,
      // Subscription data
      planType,
      billingCycle,
      product,
      // Project data
      project_name,
      // User ID from authenticated client
      uid,
    } = body

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    // Validate required fields
    if (!name || !planType || !billingCycle || !uid) {
      return NextResponse.json(
        { error: "Missing required fields: name, planType, billingCycle, uid" },
        { status: 400 }
      )
    }

    // Generate license key
    const licenseKey = generateLicenseKey(name, planType, billingCycle)

    // Calculate subscription dates
    const startDate = new Date()
    const endDate = calculateEndDate(startDate, billingCycle)

    // Get subscription plan details
    const subscriptionPlan = await getSubscriptionPlan(planType)
    if (!subscriptionPlan) {
      return NextResponse.json(
        { error: "Invalid subscription plan" },
        { status: 400 }
      )
    }

    // Create company document
    const companyData = {
      name,
      business_type,
      website,
      address,
      point_person,
      phone,
      description,
      industry,
      size,
      product: product ? product.toLowerCase() : "",
      created_at: serverTimestamp(),
      created_by: uid,
      updated_at: serverTimestamp(),
      updated_by: uid,
    }

    const companyRef = doc(collection(db, "companies"))
    await setDoc(companyRef, companyData)

    // Create subscription document
    const subscriptionData = {
      licenseKey,
      planType,
      billingCycle,
      uid,
      startDate,
      endDate,
      status: "active",
      maxProducts: subscriptionPlan.maxProducts || 100,
      maxUsers: subscriptionPlan.maxUsers || 10,
      trialEndDate: null,
      companyId: companyRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    const subscriptionRef = doc(collection(db, "subscriptions"))
    await setDoc(subscriptionRef, subscriptionData)

    // Create project document
    const projectData = {
      uid,
      license_key: licenseKey,
      project_name: project_name || `${name} Project`,
      company_name: name,
      company_location: address ? `${address.city}, ${address.province}` : "",
      company_website: website || "",
      social_media: {
        facebook: "",
        instagram: "",
        youtube: "",
      },
      created: serverTimestamp(), // Use Firestore server timestamp
      updated: serverTimestamp(), // Use Firestore server timestamp
      deleted: false,
    }

    const projectRef = doc(collection(db, "licenses"))
    await setDoc(projectRef, projectData)

    return NextResponse.json({
      success: true,
      company: { id: companyRef.id, ...companyData },
      subscription: { id: subscriptionRef.id, ...subscriptionData },
      project: { id: projectRef.id, ...projectData },
    })
  } catch (error) {
    console.error("Error creating client:", error)
    return NextResponse.json(
      { error: "Failed to create client" },
      { status: 500 }
    )
  }
}


// Helper functions
function generateLicenseKey(
  companyName?: string,
  planType?: string,
  billingCycle?: string
): string {
  const timestamp = Date.now().toString()
  const companyPrefix = companyName
    ? companyName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'X')
    : 'XXX'

  // Plan type abbreviation
  const planAbbrev = planType
    ? planType.substring(0, 2).toUpperCase()
    : 'TR'

  // Billing cycle abbreviation
  const cycleAbbrev = billingCycle === 'annually' ? 'AN' : 'MO'

  // Generate 6 random characters
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
  let randomPart = ""
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // Create base key without check digit
  const baseKey = `${companyPrefix}-${planAbbrev}-${cycleAbbrev}-${timestamp}-${randomPart}`

  // Calculate check digit
  const checkDigit = calculateCheckDigit(baseKey)

  // Format: PREFIX-PLAN-CYCLE-CREATED-RANDOM-CHECKDIGIT
  return `${baseKey}-${checkDigit}`
}

function calculateCheckDigit(key: string): number {
  let sum = 0
  const cleanKey = key.replace(/-/g, '')

  for (let i = 0; i < cleanKey.length; i++) {
    const char = cleanKey[i]
    const value = isNaN(parseInt(char))
      ? char.charCodeAt(0) - 55
      : parseInt(char)
    sum += value
  }

  return sum % 10
}

export function validateLicenseKey(key: string): boolean {
  if (!key || key.split('-').length !== 6) return false

  const parts = key.split('-')
  const baseKey = `${parts[0]}-${parts[1]}-${parts[2]}-${parts[3]}-${parts[4]}`
  const providedCheckDigit = parseInt(parts[5])
  const calculatedCheckDigit = calculateCheckDigit(baseKey)

  return providedCheckDigit === calculatedCheckDigit
}

function calculateEndDate(startDate: Date, billingCycle: string): Date | null {
  if (billingCycle === "monthly") {
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    return endDate
  } else if (billingCycle === "annually") {
    const endDate = new Date(startDate)
    endDate.setFullYear(endDate.getFullYear() + 1)
    return endDate
  }
  return null // Lifetime or other
}

export function getMaxProductsForPlan(planType: SubscriptionPlanType): number {
  switch (planType) {
    case "solo":
      return 3 // Manage up to 3 sites
    case "family":
      return 5 // Manage up to 5 sites
    case "membership":
      return 8 // Manage up to 8 sites
    case "enterprise":
      return 99999 // Unlimited for enterprise
    case "trial":
      return 3 // Example: 3 products for trial
    case "graphic-expo-event":
      return 5 // Example: 5 products for event plan
    default:
      return 0
  }
}

export function getMaxUsersForPlan(planType: SubscriptionPlanType): number {
  switch (planType) {
    case "solo":
      return 12 // Solo plan allows 12 users
    case "family":
      return 12 // Family plan allows 12 users
    case "membership":
      return 12 // Membership allows 12 users
    case "enterprise":
      return 99999 // Unlimited for enterprise
    case "trial":
      return 12 // Trial allows 12 users
    case "graphic-expo-event":
      return 12 // Event plan allows 12 users
    default:
      return 12 // Default to 12 users
  }
}

function getSubscriptionPlan(planType: SubscriptionPlanType) {
  const maxProducts = getMaxProductsForPlan(planType)
  const maxUsers = getMaxUsersForPlan(planType)

  return {
    maxProducts,
    maxUsers,
  }
}