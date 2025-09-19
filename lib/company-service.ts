import { db } from "./firebase"
import { doc, getDoc } from "firebase/firestore"

export interface Company {
  id: string
  name: string
  address?: string
  phone?: string
  email?: string
  website?: string
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
      phone: data.phone,
      email: data.email,
      website: data.website,
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
              "phone",
              "email",
              "website",
              "description",
              "industry",
              "size",
              "founded",
              "status",
              "created_at",
              "createdAt",
              "updated_at",
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
