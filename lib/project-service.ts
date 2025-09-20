import { db } from "./firebase"
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { ProjectData } from "../types/project"

export async function getProjectById(projectId: string): Promise<ProjectData> {
  if (!projectId) {
    throw new Error("Project ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const projectDoc = await getDoc(doc(db, "projects", projectId))

    if (!projectDoc.exists()) {
      throw new Error("Project not found")
    }

    const data = projectDoc.data()

    const project: ProjectData = {
      id: projectDoc.id,
      uid: data.uid || "",
      license_key: data.license_key || "",
      project_name: data.project_name || "",
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

    return project
  } catch (error) {
    console.error("Error fetching project by ID:", error)
    throw error
  }
}

export async function getProjectsByTenantId(tenantId: string): Promise<ProjectData[]> {
  if (!tenantId) {
    throw new Error("Tenant ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "projects"),
      where("tenant_id", "==", tenantId),
      where("deleted", "==", false),
      orderBy("updated", "desc")
    )

    const querySnapshot = await getDocs(q)
    const projects: ProjectData[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      projects.push({
        id: doc.id,
        uid: data.uid || "",
        license_key: data.license_key || "",
        project_name: data.project_name || "",
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

    return projects
  } catch (error) {
    console.error("Error fetching projects by tenant ID:", error)
    throw error
  }
}

export async function getAllProjects(limitCount: number = 50): Promise<ProjectData[]> {
  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "projects"),
      where("deleted", "==", false),
      orderBy("updated", "desc"),
      limit(limitCount)
    )

    const querySnapshot = await getDocs(q)
    const projects: ProjectData[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      projects.push({
        id: doc.id,
        uid: data.uid || "",
        license_key: data.license_key || "",
        project_name: data.project_name || "",
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

    return projects
  } catch (error) {
    console.error("Error fetching all projects:", error)
    throw error
  }
}