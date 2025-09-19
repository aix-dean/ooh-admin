// Tenant configuration for OH Shop Admin - Development Environment
export const tenantConfig = {
  tenantId: "ohshop-admin-prod",
  projectId: "oh-app-bcf24",
  region: "asia-southeast1",
}

// Function to get tenant-specific collection path
export const getTenantCollectionPath = (collection: string) => {
  return `tenants/${tenantConfig.tenantId}/${collection}`
}

// Function to get tenant-specific document path
export const getTenantDocumentPath = (collection: string, docId: string) => {
  return `tenants/${tenantConfig.tenantId}/${collection}/${docId}`
}

// Development environment indicator
export const isDevelopment = false
