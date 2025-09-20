import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { Subscription } from "@/types/subscription"

// GET /api/subscriptions - List subscriptions with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const userId = searchParams.get("userId")
    const status = searchParams.get("status")

    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    let subscriptionsQuery = query(
      collection(db, "subscriptions"),
      orderBy("createdAt", "desc")
    )

    // Add filters
    if (companyId) {
      subscriptionsQuery = query(subscriptionsQuery, where("companyId", "==", companyId))
    }

    if (userId) {
      subscriptionsQuery = query(subscriptionsQuery, where("uid", "==", userId))
    }

    if (status) {
      subscriptionsQuery = query(subscriptionsQuery, where("status", "==", status))
    }

    const querySnapshot = await getDocs(subscriptionsQuery)
    const subscriptions: Subscription[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      subscriptions.push({
        id: doc.id,
        licenseKey: data.licenseKey || "",
        planType: data.planType || "trial",
        billingCycle: data.billingCycle || "monthly",
        uid: data.uid || "",
        startDate: data.startDate?.toDate?.() || new Date(data.startDate),
        endDate: data.endDate?.toDate?.(),
        status: data.status || "inactive",
        maxProducts: data.maxProducts || 0,
        maxUsers: data.maxUsers || 1,
        trialEndDate: data.trialEndDate?.toDate?.(),
        companyId: data.companyId || null,
        createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
        updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
      })
    })

    return NextResponse.json({ subscriptions })
  } catch (error) {
    console.error("Error fetching subscriptions:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    )
  }
}
