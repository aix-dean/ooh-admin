import { db } from "./firebase"
import { doc, getDoc, collection, getDocs, query, where, orderBy, limit } from "firebase/firestore"
import { Subscription, SubscriptionPlan, SubscriptionStatus } from "../types/subscription"

export async function getSubscriptionById(subscriptionId: string): Promise<Subscription> {
  if (!subscriptionId) {
    throw new Error("Subscription ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const subscriptionDoc = await getDoc(doc(db, "subscriptions", subscriptionId))

    if (!subscriptionDoc.exists()) {
      throw new Error("Subscription not found")
    }

    const data = subscriptionDoc.data()

    // Convert Firebase timestamps to dates
    const convertTimestamp = (timestamp: any) => {
      if (!timestamp) return null
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        return timestamp.toDate()
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000)
      }
      return new Date(timestamp)
    }

    const subscription: Subscription = {
      id: subscriptionDoc.id,
      licenseKey: data.licenseKey || "",
      planType: data.planType || "trial",
      billingCycle: data.billingCycle || "monthly",
      uid: data.uid || "",
      startDate: convertTimestamp(data.startDate) || new Date(),
      endDate: convertTimestamp(data.endDate),
      status: data.status || "inactive",
      maxProducts: data.maxProducts || 0,
      maxUsers: data.maxUsers || 1,
      trialEndDate: convertTimestamp(data.trialEndDate),
      companyId: data.companyId || null,
      createdAt: convertTimestamp(data.createdAt) || new Date(),
      updatedAt: convertTimestamp(data.updatedAt) || new Date(),
    }

    return subscription
  } catch (error) {
    console.error("Error fetching subscription by ID:", error)
    throw error
  }
}

export async function getSubscriptionsByUserId(userId: string): Promise<Subscription[]> {
  if (!userId) {
    throw new Error("User ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "subscriptions"),
      where("uid", "==", userId),
      orderBy("createdAt", "desc")
    )

    const querySnapshot = await getDocs(q)
    const subscriptions: Subscription[] = []

    // Convert Firebase timestamps to dates
    const convertTimestamp = (timestamp: any) => {
      if (!timestamp) return null
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        return timestamp.toDate()
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000)
      }
      return new Date(timestamp)
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      subscriptions.push({
        id: doc.id,
        licenseKey: data.licenseKey || "",
        planType: data.planType || "trial",
        billingCycle: data.billingCycle || "monthly",
        uid: data.uid || "",
        startDate: convertTimestamp(data.startDate) || new Date(),
        endDate: convertTimestamp(data.endDate),
        status: data.status || "inactive",
        maxProducts: data.maxProducts || 0,
        maxUsers: data.maxUsers || 1,
        trialEndDate: convertTimestamp(data.trialEndDate),
        companyId: data.companyId || null,
        createdAt: convertTimestamp(data.createdAt) || new Date(),
        updatedAt: convertTimestamp(data.updatedAt) || new Date(),
      })
    })

    return subscriptions
  } catch (error) {
    console.error("Error fetching subscriptions by user ID:", error)
    throw error
  }
}

export async function getSubscriptionsByCompanyId(companyId: string): Promise<Subscription[]> {
  if (!companyId) {
    throw new Error("Company ID is required")
  }

  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "subscriptions"),
      where("companyId", "==", companyId),
      orderBy("createdAt", "desc")
    )

    const querySnapshot = await getDocs(q)
    const subscriptions: Subscription[] = []

    // Convert Firebase timestamps to dates
    const convertTimestamp = (timestamp: any) => {
      if (!timestamp) return null
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        return timestamp.toDate()
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000)
      }
      return new Date(timestamp)
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      subscriptions.push({
        id: doc.id,
        licenseKey: data.licenseKey || "",
        planType: data.planType || "trial",
        billingCycle: data.billingCycle || "monthly",
        uid: data.uid || "",
        startDate: convertTimestamp(data.startDate) || new Date(),
        endDate: convertTimestamp(data.endDate),
        status: data.status || "inactive",
        maxProducts: data.maxProducts || 0,
        maxUsers: data.maxUsers || 1,
        trialEndDate: convertTimestamp(data.trialEndDate),
        companyId: data.companyId || null,
        createdAt: convertTimestamp(data.createdAt) || new Date(),
        updatedAt: convertTimestamp(data.updatedAt) || new Date(),
      })
    })

    return subscriptions
  } catch (error) {
    console.error("Error fetching subscriptions by company ID:", error)
    throw error
  }
}

export async function getActiveSubscriptions(): Promise<Subscription[]> {
  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "subscriptions"),
      where("status", "==", "active"),
      orderBy("updatedAt", "desc"),
      limit(100)
    )

    const querySnapshot = await getDocs(q)
    const subscriptions: Subscription[] = []

    // Convert Firebase timestamps to dates
    const convertTimestamp = (timestamp: any) => {
      if (!timestamp) return null
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        return timestamp.toDate()
      }
      if (timestamp.seconds) {
        return new Date(timestamp.seconds * 1000)
      }
      return new Date(timestamp)
    }

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      subscriptions.push({
        id: doc.id,
        licenseKey: data.licenseKey || "",
        planType: data.planType || "trial",
        billingCycle: data.billingCycle || "monthly",
        uid: data.uid || "",
        startDate: convertTimestamp(data.startDate) || new Date(),
        endDate: convertTimestamp(data.endDate),
        status: data.status || "inactive",
        maxProducts: data.maxProducts || 0,
        maxUsers: data.maxUsers || 1,
        trialEndDate: convertTimestamp(data.trialEndDate),
        companyId: data.companyId || null,
        createdAt: convertTimestamp(data.createdAt) || new Date(),
        updatedAt: convertTimestamp(data.updatedAt) || new Date(),
      })
    })

    return subscriptions
  } catch (error) {
    console.error("Error fetching active subscriptions:", error)
    throw error
  }
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  if (!db) {
    throw new Error("Firestore is not initialized")
  }

  try {
    const q = query(
      collection(db, "subscription_plans"),
      orderBy("price", "asc")
    )

    const querySnapshot = await getDocs(q)
    const plans: SubscriptionPlan[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      plans.push({
        id: doc.id,
        name: data.name || "",
        description: data.description || "",
        price: data.price || 0,
        billingCycle: data.billingCycle || "monthly",
        features: data.features || [],
        buttonText: data.buttonText || "Subscribe",
      })
    })

    return plans
  } catch (error) {
    console.error("Error fetching subscription plans:", error)
    throw error
  }
}