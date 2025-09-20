export type SubscriptionPlanType = "solo" | "family" | "membership" | "enterprise" | "trial" | "graphic-expo-event"

export type BillingCycle = "monthly" | "annually"

export type SubscriptionStatus = "active" | "inactive" | "trialing" | "cancelled" | "expired"

export interface Subscription {
  id: string
  licenseKey: string
  planType: SubscriptionPlanType
  billingCycle: BillingCycle
  uid: string // User ID
  startDate: Date // When the subscription started
  endDate: Date | null // When the subscription ends (null for lifetime or ongoing)
  status: SubscriptionStatus
  maxProducts: number // Max products allowed for this subscription
  maxUsers: number // Max users allowed for this subscription
  trialEndDate: Date | null // End date of the trial period, if applicable
  companyId: string | null // Company ID field
  createdAt: Date // Timestamp of creation
  updatedAt: Date // Last updated timestamp
}

export interface SubscriptionPlan {
  id: string
  name: string
  description: string // Added description for plans
  price: number // Price per month/year depending on context, or 0 for free/trial
  billingCycle: BillingCycle | "N/A" // Added billing cycle to plan definition
  features: string[]
  buttonText: string // Added button text for plans
}