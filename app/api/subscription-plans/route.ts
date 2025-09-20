import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/firebase"
import { collection, getDocs, query, orderBy } from "firebase/firestore"
import { SubscriptionPlan } from "@/types/subscription"

// GET /api/subscription-plans - Get all available subscription plans
export async function GET(request: NextRequest) {
  try {
    if (!db) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 })
    }

    // Try to get plans from Firestore first
    try {
      const plansQuery = query(
        collection(db, "subscription_plans"),
        orderBy("price", "asc")
      )

      const querySnapshot = await getDocs(plansQuery)

      if (!querySnapshot.empty) {
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

        return NextResponse.json({ plans })
      }
    } catch (error) {
      console.warn("Could not fetch plans from Firestore, using default plans:", error)
    }

    // Fallback to default plans if Firestore collection doesn't exist or is empty
    const defaultPlans: SubscriptionPlan[] = [
      {
        id: "trial",
        name: "Trial",
        description: "Perfect for trying out our services",
        price: 0,
        billingCycle: "N/A",
        features: [
          "Up to 3 products",
          "Up to 12 user accounts",
          "Basic support",
          "30-day trial"
        ],
        buttonText: "Start Trial"
      },
      {
        id: "solo",
        name: "Solo",
        description: "Great for individual entrepreneurs",
        price: 29,
        billingCycle: "monthly",
        features: [
          "Up to 3 products",
          "Up to 12 user accounts",
          "Email support",
          "Basic analytics"
        ],
        buttonText: "Start Solo"
      },
      {
        id: "family",
        name: "Family",
        description: "Ideal for small businesses",
        price: 79,
        billingCycle: "monthly",
        features: [
          "Up to 5 products",
          "Up to 12 user accounts",
          "Priority support",
          "Advanced analytics",
          "Custom branding"
        ],
        buttonText: "Start Family"
      },
      {
        id: "membership",
        name: "Membership",
        description: "For growing businesses",
        price: 199,
        billingCycle: "monthly",
        features: [
          "Up to 8 products",
          "Up to 12 user accounts",
          "24/7 support",
          "Advanced analytics",
          "API access",
          "Custom integrations"
        ],
        buttonText: "Start Membership"
      },
      {
        id: "enterprise",
        name: "Enterprise",
        description: "For large organizations",
        price: 499,
        billingCycle: "monthly",
        features: [
          "Unlimited products",
          "Unlimited user accounts",
          "Dedicated support",
          "Custom analytics",
          "API access",
          "White-label solution",
          "Custom integrations",
          "SLA guarantee"
        ],
        buttonText: "Contact Sales"
      },
      {
        id: "graphic-expo-event",
        name: "Graphic Expo Event",
        description: "Special package for events",
        price: 149,
        billingCycle: "annually",
        features: [
          "Up to 5 products",
          "Up to 12 user accounts",
          "Event-specific features",
          "Priority support",
          "Custom branding"
        ],
        buttonText: "Start Event Package"
      }
    ]

    return NextResponse.json({ plans: defaultPlans })
  } catch (error) {
    console.error("Error fetching subscription plans:", error)
    return NextResponse.json(
      { error: "Failed to fetch subscription plans" },
      { status: 500 }
    )
  }
}