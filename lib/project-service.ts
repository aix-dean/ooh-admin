import { db } from "./firebase"
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { LicenseData } from "../types/license"

export async function getLicenseById(licenseId: string): Promise<LicenseData> {
  if (!licenseId) {
    throw new Error("License ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const licenseDoc = await getDoc(doc(db, "licenses", licenseId))

    if (!licenseDoc.exists()) {
      throw new Error("License not found")
    }

    const data = licenseDoc.data()

    const license: LicenseData = {
      id: licenseDoc.id,
      uid: data.uid || "",
      license_key: data.license_key || "",
      license_name: data.license_name || data.project_name || "", // Handle both old and new field names
      company_name: data.company_name || "",
      company_location: data.company_location || "",
      company_website: data.company_website || "",
      social_media: {
        facebook: data.social_media?.facebook || "",
        instagram: data.social_media?.instagram || "",
        youtube: data.social_media?.youtube || "",
      },
      created: data.created || "",
      updated: data.updated || "",
      deleted: data.deleted || false,
      tenant_id: data.tenant_id,
    }

    return license
  } catch (error) {
    console.error("Error fetching project by ID:", error)
    throw error
  }
}

export async function getLicensesByTenantId(tenantId: string): Promise<LicenseData[]> {
  if (!tenantId) {
    throw new Error("Tenant ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "licenses"),
      where("tenant_id", "==", tenantId),
      where("deleted", "==", false),
      orderBy("updated", "desc")
    )

    const querySnapshot = await getDocs(q)
    const licenses: LicenseData[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      licenses.push({
        id: doc.id,
        uid: data.uid || "",
        license_key: data.license_key || "",
        license_name: data.license_name || data.project_name || "",
        company_name: data.company_name || "",
        company_location: data.company_location || "",
        company_website: data.company_website || "",
        social_media: {
          facebook: data.social_media?.facebook || "",
          instagram: data.social_media?.instagram || "",
          youtube: data.social_media?.youtube || "",
        },
        created: data.created || "",
        updated: data.updated || "",
        deleted: data.deleted || false,
        tenant_id: data.tenant_id,
      })
    })

    return licenses
  } catch (error) {
    console.error("Error fetching projects by tenant ID:", error)
    throw error
  }
}

export async function getAllLicenses(limitCount: number = 50): Promise<LicenseData[]> {
  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "licenses"),
      where("deleted", "==", false),
      orderBy("updated", "desc"),
      limit(limitCount)
    )

    const querySnapshot = await getDocs(q)
    const licenses: LicenseData[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      licenses.push({
        id: doc.id,
        uid: data.uid || "",
        license_key: data.license_key || "",
        license_name: data.license_name || data.project_name || "",
        company_name: data.company_name || "",
        company_location: data.company_location || "",
        company_website: data.company_website || "",
        social_media: {
          facebook: data.social_media?.facebook || "",
          instagram: data.social_media?.instagram || "",
          youtube: data.social_media?.youtube || "",
        },
        created: data.created || "",
        updated: data.updated || "",
        deleted: data.deleted || false,
        tenant_id: data.tenant_id,
      })
    })

    return licenses
  } catch (error) {
    console.error("Error fetching all projects:", error)
    throw error
  }
}
