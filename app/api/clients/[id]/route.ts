import { NextRequest, NextResponse } from "next/server"
import { db, auth } from "@/lib/firebase"
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore"
import { Company } from "@/lib/company-service"

// Helper function to get current user ID
function getCurrentUserId(): string {
  if (!auth) {
    throw new Error("Authentication not initialized")
  }

  const user = auth.currentUser
  if (!user) {
    throw new Error("User not authenticated")
  }

  return user.uid
}

// GET /api/clients/[id] - Get specific company
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    const companyDoc = await getDoc(doc(db, "companies", id))

    if (!companyDoc.exists()) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    const data = companyDoc.data()
    const company: Company = {
      id: companyDoc.id,
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
      email: data.email,
      description: data.description,
      industry: data.industry,
      size: data.size,
      founded: data.founded?.toDate?.() || new Date(data.founded),
      status: data.status,
      createdAt: data.created_at?.toDate?.() || new Date(data.created_at),
      updatedAt: data.updated_at?.toDate?.() || new Date(data.updated_at),
    }

    return NextResponse.json({ company })
  } catch (error) {
    console.error("Error fetching company:", error)
    return NextResponse.json(
      { error: "Failed to fetch company" },
      { status: 500 }
    )
  }
}

// PUT /api/clients/[id] - Update company
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    // Check if company exists
    const companyRef = doc(db, "companies", id)
    const companyDoc = await getDoc(companyRef)

    if (!companyDoc.exists()) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get current user ID from authentication
    const currentUserId = getCurrentUserId()

    // Update company data
    const updateData = {
      ...body,
      updated_at: serverTimestamp(),
      updated_by: currentUserId,
    }

    // Remove id from update data if present
    delete updateData.id

    await updateDoc(companyRef, updateData)

    // Fetch updated company
    const updatedDoc = await getDoc(companyRef)
    const data = updatedDoc.data()

    const updatedCompany: Company = {
      id: updatedDoc.id,
      name: data?.name || "",
      address: data?.address,
      business_type: data?.business_type,
      created_at: data?.created_at?.toDate?.() || new Date(data?.created_at),
      created_by: data?.created_by,
      point_person: data?.point_person,
      updated_at: data?.updated_at?.toDate?.() || new Date(data?.updated_at),
      updated_by: data?.updated_by,
      website: data?.website,
      phone: data?.phone,
      description: data?.description,
      industry: data?.industry,
      size: data?.size,
      founded: data?.founded?.toDate?.() || new Date(data?.founded),
      status: data?.status,
      createdAt: data?.created_at?.toDate?.() || new Date(data?.created_at),
      updatedAt: data?.updated_at?.toDate?.() || new Date(data?.updated_at),
    }

    return NextResponse.json({ company: updatedCompany })
  } catch (error) {
    console.error("Error updating company:", error)
    return NextResponse.json(
      { error: "Failed to update company" },
      { status: 500 }
    )
  }
}

// DELETE /api/clients/[id] - Delete company
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    // Check if company exists
    const companyRef = doc(db, "companies", id)
    const companyDoc = await getDoc(companyRef)

    if (!companyDoc.exists()) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 })
    }

    // Get current user ID from authentication
    const currentUserId = getCurrentUserId()

    // Soft delete by updating the document instead of hard delete
    await updateDoc(companyRef, {
      deleted: true,
      updated_at: serverTimestamp(),
      updated_by: currentUserId,
    })

    return NextResponse.json({ success: true, message: "Company deleted successfully" })
  } catch (error) {
    console.error("Error deleting company:", error)
    return NextResponse.json(
      { error: "Failed to delete company" },
      { status: 500 }
    )
  }
}
