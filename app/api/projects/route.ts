import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { ProjectData } from "@/types/project"

// GET /api/projects - List projects with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")
    const licenseKey = searchParams.get("licenseKey")

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    let projectsQuery = query(
      collection(db, "projects"),
      where("deleted", "==", false),
      orderBy("created", "desc")
    )

    // Add filters
    if (companyId) {
      // Note: We need to find projects by company name since projects don't have companyId
      // This is a limitation of the current data structure
      projectsQuery = query(projectsQuery, where("company_name", "==", companyId))
    }

    if (userId) {
      projectsQuery = query(projectsQuery, where("uid", "==", userId))
    }

    if (licenseKey) {
      projectsQuery = query(projectsQuery, where("license_key", "==", licenseKey))
    }

    const querySnapshot = await getDocs(projectsQuery)
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
        social_media: data.social_media || {
          facebook: "",
          instagram: "",
          youtube: "",
        },
        created: data.created || "",
        updated: data.updated || "",
        deleted: data.deleted || false,
        tenant_id: data.tenant_id || "",
      })
    })

    return NextResponse.json({ projects })
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    )
  }
}
