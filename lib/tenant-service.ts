/**
 * Tenant Management Service
 * Handles operations related to GCP tenant configuration and management
 */

import { getAuth } from "firebase/auth"
import { collection, doc, getDoc, setDoc, updateDoc } from "firebase/firestore"
import { firebaseApp, getDb } from "./firebase"

// Tenant configuration
export const tenantConfig = {
  tenantId: process.env.TENANT_ID, // Updated tenant ID
  displayName: "OH Shop Admin",
  environment: "production",
  region: "asia-southeast1",
  parentResource: "organizations/414953599697",
}

// Tenant access levels
export enum TenantAccessLevel {
  ADMIN = "ADMIN",
  EDITOR = "EDITOR",
  VIEWER = "VIEWER",
}

// Get tenant collection prefix
export function getTenantCollectionPrefix() {
  return `tenants/${tenantConfig.tenantId}`
}

// Initialize Firebase Auth with tenant ID
export function getTenantAuth() {
  const auth = getAuth(firebaseApp)

  // Instead of using auth.tenantId(), we'll just return the auth instance
  // The tenant ID will be handled at the application level
  // This is because Firebase JS SDK doesn't directly support tenant ID setting like this
  return auth
}

// Tenant metadata collection reference
const tenantMetadataRef = collection(getDb(), "tenant-metadata")

// Function to get current tenant ref, only if tenantId exists
const getCurrentTenantRef = () => {
  if (!tenantConfig.tenantId) {
    throw new Error("Tenant ID not configured")
  }
  return doc(tenantMetadataRef, tenantConfig.tenantId)
}

// Check if tenant exists and is properly configured
export async function verifyTenantConfiguration(): Promise<boolean> {
  try {
    if (!tenantConfig.tenantId) {
      console.warn("Tenant ID not configured, skipping tenant verification")
      return false
    }

    const tenantDoc = await getDoc(getCurrentTenantRef())

    if (!tenantDoc.exists()) {
      console.warn("Tenant configuration not found. Creating default configuration...")
      await initializeTenantConfiguration()
      return true
    }

    return true
  } catch (error) {
    console.error("Error verifying tenant configuration:", error)
    return false
  }
}

// Initialize tenant configuration if it doesn't exist
export async function initializeTenantConfiguration(): Promise<void> {
  try {
    if (!tenantConfig.tenantId) {
      throw new Error("Tenant ID not configured")
    }

    await setDoc(getCurrentTenantRef(), {
      tenantId: tenantConfig.tenantId,
      displayName: tenantConfig.displayName,
      environment: tenantConfig.environment,
      region: tenantConfig.region,
      parentResource: tenantConfig.parentResource,
      createdAt: new Date(),
      status: {
        auth: true,
        firestore: true,
        storage: true,
        functions: true,
      },
      accessControls: {
        defaultAccessLevel: TenantAccessLevel.VIEWER,
      },
    })

    console.log("Tenant configuration initialized successfully")
  } catch (error) {
    console.error("Error initializing tenant configuration:", error)
    throw error
  }
}

// Get tenant configuration
export async function getTenantMetadata() {
  try {
    if (!tenantConfig.tenantId) {
      throw new Error("Tenant ID not configured")
    }

    const tenantDoc = await getDoc(getCurrentTenantRef())

    if (!tenantDoc.exists()) {
      throw new Error("Tenant configuration not found")
    }

    return tenantDoc.data()
  } catch (error) {
    console.error("Error getting tenant metadata:", error)
    throw error
  }
}

// Update tenant configuration
export async function updateTenantMetadata(updates: Partial<any>) {
  try {
    if (!tenantConfig.tenantId) {
      throw new Error("Tenant ID not configured")
    }

    await updateDoc(getCurrentTenantRef(), updates)
    console.log("Tenant configuration updated successfully")
  } catch (error) {
    console.error("Error updating tenant metadata:", error)
    throw error
  }
}

// Get tenant-specific collection
export function getTenantCollection(collectionName: string) {
  const tenantPrefix = getTenantCollectionPrefix()
  return collection(getDb(), `${tenantPrefix}/${collectionName}`)
}
