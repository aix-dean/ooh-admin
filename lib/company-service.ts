import { db } from "./firebase"
import { doc, getDoc } from "firebase/firestore"

export interface Company {
  id: string
  name: string
  address?: {
    city: string
    province: string
    street: string
  }
  business_type?: string
  created_at?: Date
  created_by?: string
  point_person?: {
    email: string
    first_name: string
    last_name: string
    position: string
    password: string
  }
  updated_at?: Date
  updated_by?: string
  website?: string
  phone?: string
  email?: string
  description?: string
  industry?: string
  size?: string
  founded?: Date
  status?: string
  createdAt?: Date
  updatedAt?: Date
  [key: string]: any // For additional fields
}

export async function getCompanyById(companyId: string): Promise<Company> {
  if (!companyId) {
    throw new Error("Company ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const companyDoc = await getDoc(doc(db, "companies", companyId))

    if (!companyDoc.exists()) {
      throw new Error("Company not found")
    }

    const data = companyDoc.data()

    // Convert Firebase timestamps to dates
    const convertTimestamp = (timestamp: any) => {
      if (!timestamp) return undefined
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        return timestamp.toDate()
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000)
      }
      return new Date(timestamp)
    }

    const company: Company = {
      id: companyDoc.id,
      name: data.name || "Unknown Company",
      address: data.address,
      business_type: data.business_type,
      created_at: convertTimestamp(data.created_at),
      created_by: data.created_by,
      point_person: data.point_person,
      updated_at: convertTimestamp(data.updated_at),
      updated_by: data.updated_by,
      website: data.website,
      phone: data.phone,
      email: data.email,
      description: data.description,
      industry: data.industry,
      size: data.size,
      founded: convertTimestamp(data.founded),
      status: data.status,
      createdAt: convertTimestamp(data.created_at || data.createdAt),
      updatedAt: convertTimestamp(data.updated_at || data.updatedAt),
      // Include any additional fields
      ...Object.fromEntries(
        Object.entries(data).filter(
          ([key]) =>
            ![
              "name",
              "address",
              "business_type",
              "created_at",
              "created_by",
              "point_person",
              "updated_at",
              "updated_by",
              "website",
              "phone",
              "email",
              "description",
              "industry",
              "size",
              "founded",
              "status",
              "createdAt",
              "updatedAt",
            ].includes(key),
        ),
      ),
    }

    return company
  } catch (error) {
    console.error("Error fetching company by ID:", error)
    throw error
  }
}
