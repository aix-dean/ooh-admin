import { db } from "./firebase"
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  endBefore,
  limitToLast,
  doc,
  getDoc,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore"

export interface Member {
  id: string
  email: string
  firstName: string
  middleName?: string
  lastName: string
  displayName: string
  phoneNumber?: string
  gender?: string
  photoUrl?: string
  photoURL?: string
  companyId?: string
  companyInfo?: CompanyInfo
  companyContact?: string
  companyEmail?: string
  companyName?: string
  type: string
  active: boolean
  deleted: boolean
  createdTime: Date
  updated?: Date
  ipAddress?: string
  location?: string
  position?: string
  onboarding: boolean
  uid?: string
}

export interface CompanyInfo {
  company_name?: string
  company_position?: string
  company_address?: string
}

export interface OHPlusMember {
  id: string
  email: string
  firstName: string
  middleName?: string
  lastName: string
  displayName: string
  phoneNumber?: string
  gender?: string
  photoUrl?: string
  photoURL?: string
  companyId?: string
  companyName?: string
  type: string
  active: boolean
  activeDate?: Date
  created?: Date
  createdTime: Date
  updated?: Date
  location?: { latitude: number; longitude: number }
  followers: number
  products: number
  product: number
  productsCount?: {
    merchandise?: number
    rental?: number
  }
  rating: number
  onboarding: boolean
  uid?: string
}

export interface SellahMember {
  id: string
  email: string
  firstName: string
  middleName?: string
  lastName: string
  displayName: string
  phoneNumber?: string
  gender?: string
  photoUrl?: string
  photoURL?: string
  companyId?: string
  companyName?: string
  type: string
  active: boolean
  activeDate?: Date
  created?: Date
  created_at?: Date
  createdTime: Date
  updated?: Date
  followers: number
  product: number
  products: number
  rating: number
  onboarding: boolean
  uid?: string
}

export interface PaginationInfo {
  currentPage: number
  totalPages: number
  totalMembers: number
  hasNextPage: boolean
  hasPreviousPage: false
  pageSize: number
}

export interface PaginatedMembersResult {
  members: Member[]
  pagination: PaginationInfo
  firstDoc?: QueryDocumentSnapshot<DocumentData>
  lastDoc?: QueryDocumentSnapshot<DocumentData>
}

export interface PaginatedOHPlusMembersResult {
  members: OHPlusMember[]
  pagination: PaginationInfo
  firstDoc?: QueryDocumentSnapshot<DocumentData>
  lastDoc?: QueryDocumentSnapshot<DocumentData>
}

export interface PaginatedSellahMembersResult {
  members: SellahMember[]
  pagination: PaginationInfo
  firstDoc?: QueryDocumentSnapshot<DocumentData>
  lastDoc?: QueryDocumentSnapshot<DocumentData>
}

export interface PaginationOptions {
  page?: number
  pageSize?: number
  startAfterDoc?: QueryDocumentSnapshot<DocumentData>
  endBeforeDoc?: QueryDocumentSnapshot<DocumentData>
  direction?: "next" | "previous"
}

// Cache for pagination results (5 minute TTL)
const CACHE_TTL = 5 * 60 * 1000
const paginationCache = new Map<string, any>()
const ohPlusPaginationCache = new Map<string, any>()
const sellahPaginationCache = new Map<string, any>()

// Company name cache (10 minute TTL)
const COMPANY_CACHE_TTL = 10 * 60 * 1000
const companyNameCache = new Map<string, { name: string; timestamp: number }>()

// Helper function to generate cache key
function getCacheKey(page: number, pageSize: number, platform = "members"): string {
  return `${platform}-${page}-${pageSize}`
}

// Helper function to check if cache entry is valid
function isCacheValid(entry: any): boolean {
  return Date.now() - entry.timestamp < CACHE_TTL
}

// Helper function to check if company cache entry is valid
function isCompanyCacheValid(entry: { name: string; timestamp: number }): boolean {
  return Date.now() - entry.timestamp < COMPANY_CACHE_TTL
}

// NEW: Function to get company name by company_id
export async function getCompanyNameById(companyId: string): Promise<string> {
  if (!companyId) return "No Company"

  // Check cache first
  const cached = companyNameCache.get(companyId)
  if (cached && isCompanyCacheValid(cached)) {
    return cached.name
  }

  try {
    const companyDoc = await getDoc(doc(db, "companies", companyId))

    if (companyDoc.exists()) {
      const companyData = companyDoc.data()
      const companyName = companyData.name || "Unknown Company"

      // Cache the result
      companyNameCache.set(companyId, {
        name: companyName,
        timestamp: Date.now(),
      })

      return companyName
    } else {
      // Cache the "not found" result to avoid repeated queries
      companyNameCache.set(companyId, {
        name: "Company Not Found",
        timestamp: Date.now(),
      })
      return "Company Not Found"
    }
  } catch (error) {
    console.error(`Error fetching company name for ID ${companyId}:`, error)
    return "Error Loading Company"
  }
}

// NEW: Function to batch fetch company names for multiple company IDs
export async function batchGetCompanyNames(companyIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>()
  const uncachedIds: string[] = []

  // Check cache first
  for (const companyId of companyIds) {
    if (!companyId) {
      result.set(companyId, "No Company")
      continue
    }

    const cached = companyNameCache.get(companyId)
    if (cached && isCompanyCacheValid(cached)) {
      result.set(companyId, cached.name)
    } else {
      uncachedIds.push(companyId)
    }
  }

  // Fetch uncached company names
  if (uncachedIds.length > 0) {
    try {
      const promises = uncachedIds.map(async (companyId) => {
        try {
          const companyDoc = await getDoc(doc(db, "companies", companyId))

          if (companyDoc.exists()) {
            const companyData = companyDoc.data()
            const companyName = companyData.name || "Unknown Company"

            // Cache the result
            companyNameCache.set(companyId, {
              name: companyName,
              timestamp: Date.now(),
            })

            return { companyId, name: companyName }
          } else {
            // Cache the "not found" result
            companyNameCache.set(companyId, {
              name: "Company Not Found",
              timestamp: Date.now(),
            })
            return { companyId, name: "Company Not Found" }
          }
        } catch (error) {
          console.error(`Error fetching company name for ID ${companyId}:`, error)
          return { companyId, name: "Error Loading Company" }
        }
      })

      const results = await Promise.all(promises)
      results.forEach(({ companyId, name }) => {
        result.set(companyId, name)
      })
    } catch (error) {
      console.error("Error in batch company name fetch:", error)
      // Set error values for uncached IDs
      uncachedIds.forEach((companyId) => {
        result.set(companyId, "Error Loading Company")
      })
    }
  }

  return result
}

// FIXED: Get total count of OOH! Shop members with optional date filtering
export async function getMembersCount(startDate?: Date, endDate?: Date): Promise<number> {
  try {
    const membersRef = collection(db, "users")

    // ISSUE FOUND: The original query was too restrictive
    // Instead of filtering by type and deleted, let's first check what types exist
    console.log("🔍 Debugging OOH! Shop members count...")

    // First, let's see all unique types in the users collection
    const allUsersSnapshot = await getDocs(membersRef)
    const typeStats = new Map<string, number>()
    const deletedStats = { true: 0, false: 0, undefined: 0 }

    allUsersSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      const type = data.type || "NO_TYPE"
      const deleted = data.deleted

      typeStats.set(type, (typeStats.get(type) || 0) + 1)

      if (deleted === true) deletedStats.true++
      else if (deleted === false) deletedStats.false++
      else deletedStats.undefined++
    })

    console.log("📊 Type distribution in users collection:", Object.fromEntries(typeStats))
    console.log("📊 Deleted field distribution:", deletedStats)

    // FIXED QUERY: More inclusive approach for OOH! Shop members
    // Remove the deleted filter since it might be excluding valid members
    const countQuery = query(membersRef)

    // Try different type variations that might exist
    const possibleOOHTypes = ["MEMBERS", "Members", "members", "MEMBER", "Member", "member", "USER", "User", "user"]
    let totalOOHCount = 0

    for (const typeVariant of possibleOOHTypes) {
      try {
        const typeQuery = query(membersRef, where("type", "==", typeVariant))
        const typeSnapshot = await getDocs(typeQuery)

        if (typeSnapshot.size > 0) {
          console.log(`✅ Found ${typeSnapshot.size} members with type: "${typeVariant}"`)

          // Apply date filtering if provided
          if (startDate && endDate) {
            let filteredCount = 0
            typeSnapshot.docs.forEach((doc) => {
              const data = doc.data()
              const createdTime = data.created_time?.toDate()

              if (createdTime && createdTime >= startDate && createdTime <= endDate) {
                filteredCount++
              }
            })
            totalOOHCount += filteredCount
          } else {
            totalOOHCount += typeSnapshot.size
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error querying type "${typeVariant}":`, error)
      }
    }

    // If no specific types found, try without type filter (might be OOH members without type field)
    if (totalOOHCount === 0) {
      console.log("🔍 No typed members found, checking members without type field...")
      const noTypeQuery = query(membersRef, where("type", "==", null))
      const noTypeSnapshot = await getDocs(noTypeQuery)

      if (noTypeSnapshot.size > 0) {
        console.log(`✅ Found ${noTypeSnapshot.size} members without type field`)
        totalOOHCount = noTypeSnapshot.size
      }
    }

    console.log(`📈 Total OOH! Shop members count: ${totalOOHCount}`)
    return totalOOHCount
  } catch (error) {
    console.error("❌ Error getting members count:", error)
    return 0
  }
}

// FIXED: Get total count of OH! Plus members with optional date filtering
export async function getOHPlusMembersCount(startDate?: Date, endDate?: Date): Promise<number> {
  try {
    const membersRef = collection(db, "iboard_users")

    console.log("🔍 Debugging OH! Plus members count...")

    // Check what types exist in iboard_users collection
    const allSnapshot = await getDocs(membersRef)
    const typeStats = new Map<string, number>()

    allSnapshot.docs.forEach((doc) => {
      const data = doc.data()
      const type = data.type || "NO_TYPE"
      typeStats.set(type, (typeStats.get(type) || 0) + 1)
    })

    console.log("📊 Type distribution in iboard_users collection:", Object.fromEntries(typeStats))

    // Try different variations of OHPLUS
    const possibleOHPlusTypes = ["OHPLUS", "OHPlus", "ohplus", "OH_PLUS", "oh_plus", "PLUS", "Plus"]
    let totalOHPlusCount = 0

    for (const typeVariant of possibleOHPlusTypes) {
      try {
        const typeQuery = query(membersRef, where("type", "==", typeVariant))
        const typeSnapshot = await getDocs(typeQuery)

        if (typeSnapshot.size > 0) {
          console.log(`✅ Found ${typeSnapshot.size} OH! Plus members with type: "${typeVariant}"`)

          // Apply date filtering if provided
          if (startDate && endDate) {
            let filteredCount = 0
            typeSnapshot.docs.forEach((doc) => {
              const data = doc.data()
              const createdTime = data.created?.toDate()

              if (createdTime && createdTime >= startDate && createdTime <= endDate) {
                filteredCount++
              }
            })
            totalOHPlusCount += filteredCount
          } else {
            totalOHPlusCount += typeSnapshot.size
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error querying OH! Plus type "${typeVariant}":`, error)
      }
    }

    console.log(`📈 Total OH! Plus members count: ${totalOHPlusCount}`)
    return totalOHPlusCount
  } catch (error) {
    console.error("❌ Error getting OH! Plus members count:", error)
    return 0
  }
}

// FIXED: Get total count of Sellah members with optional date filtering
export async function getSellahMembersCount(startDate?: Date, endDate?: Date): Promise<number> {
  try {
    const membersRef = collection(db, "iboard_users")

    console.log("🔍 Debugging Sellah members count...")

    // Try different variations of SELLAH
    const possibleSellahTypes = ["SELLAH", "Sellah", "sellah", "SELLER", "Seller", "seller"]
    let totalSellahCount = 0

    for (const typeVariant of possibleSellahTypes) {
      try {
        const typeQuery = query(membersRef, where("type", "==", typeVariant))
        const typeSnapshot = await getDocs(typeQuery)

        if (typeSnapshot.size > 0) {
          console.log(`✅ Found ${typeSnapshot.size} Sellah members with type: "${typeVariant}"`)

          // Apply date filtering if provided
          if (startDate && endDate) {
            let filteredCount = 0
            typeSnapshot.docs.forEach((doc) => {
              const data = doc.data()
              // Try both created_at and created fields for Sellah members
              const createdTime = data.created_at?.toDate() || data.created?.toDate()

              if (createdTime && createdTime >= startDate && createdTime <= endDate) {
                filteredCount++
              }
            })
            totalSellahCount += filteredCount
          } else {
            totalSellahCount += typeSnapshot.size
          }
        }
      } catch (error) {
        console.warn(`⚠️ Error querying Sellah type "${typeVariant}":`, error)
      }
    }

    console.log(`📈 Total Sellah members count: ${totalSellahCount}`)
    return totalSellahCount
  } catch (error) {
    console.error("❌ Error getting Sellah members count:", error)
    return 0
  }
}

// Enhanced paginated OOH! Shop members (filtered by type only)
export async function getPaginatedMembers(options: PaginationOptions = {}): Promise<PaginatedMembersResult> {
  const { page = 1, pageSize = 10, startAfterDoc, endBeforeDoc, direction = "next" } = options

  console.log(`getPaginatedMembers called with page: ${page}, pageSize: ${pageSize}, direction: ${direction}`)

  try {
    const membersRef = collection(db, "users")
    // Filter exclusively by type for OOH! Shop members and exclude deleted
    let membersQuery = query(
      membersRef,
      where("type", "in", ["MEMBERS", "Members"]),
      where("deleted", "==", false),
      orderBy("created_time", "desc"),
    )

    // Apply pagination cursor
    if (direction === "next" && startAfterDoc) {
      console.log("Using startAfter cursor for next page")
      membersQuery = query(membersQuery, startAfter(startAfterDoc), limit(pageSize))
    } else if (direction === "previous" && endBeforeDoc) {
      console.log("Using endBefore cursor for previous page")
      membersQuery = query(membersQuery, endBefore(endBeforeDoc), limitToLast(pageSize))
    } else {
      console.log("Using direct page access")
      // For direct page access, we need to skip documents
      const skipCount = (page - 1) * pageSize
      if (skipCount > 0) {
        // Get documents to skip
        const skipQuery = query(membersQuery, limit(skipCount))
        const skipSnapshot = await getDocs(skipQuery)
        if (skipSnapshot.docs.length > 0) {
          const lastSkipDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1]
          membersQuery = query(membersQuery, startAfter(lastSkipDoc), limit(pageSize))
        } else {
          membersQuery = query(membersQuery, limit(pageSize))
        }
      } else {
        membersQuery = query(membersQuery, limit(pageSize))
      }
    }

    const [snapshot, totalCount] = await Promise.all([getDocs(membersQuery), getMembersCount()])

    console.log(`Fetched ${snapshot.docs.length} OOH! Shop members, total count: ${totalCount}`)

    let members = snapshot.docs.map(docToMember)
    let firstDoc = snapshot.docs[0]
    let lastDoc = snapshot.docs[snapshot.docs.length - 1]

    // If we queried in reverse order for previous page, reverse the results
    if (direction === "previous" && endBeforeDoc) {
      members = members.reverse()
      firstDoc = snapshot.docs[snapshot.docs.length - 1]
      lastDoc = snapshot.docs[0]
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    const pagination: PaginationInfo = {
      currentPage: page,
      totalPages,
      totalMembers: totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      pageSize,
    }

    console.log(`Returning OOH! Shop pagination info:`, pagination)

    return {
      members,
      pagination,
      firstDoc,
      lastDoc,
    }
  } catch (error) {
    console.error("Error fetching paginated OOH! Shop members:", error)
    return {
      members: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalMembers: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize,
      },
    }
  }
}

// Enhanced paginated OH! Plus members (filtered by type only)
export async function getPaginatedOHPlusMembers(
  options: PaginationOptions = {},
): Promise<PaginatedOHPlusMembersResult> {
  const { page = 1, pageSize = 10, startAfterDoc, endBeforeDoc, direction = "next" } = options

  console.log(`getPaginatedOHPlusMembers called with page: ${page}, pageSize: ${pageSize}, direction: ${direction}`)

  try {
    const membersRef = collection(db, "iboard_users")
    // Filter exclusively by type for OH! Plus members
    let membersQuery = query(membersRef, where("type", "==", "OHPLUS"), orderBy("created", "desc"))

    // Apply pagination cursor
    if (direction === "next" && startAfterDoc) {
      console.log("Using startAfter cursor for next page")
      membersQuery = query(membersQuery, startAfter(startAfterDoc), limit(pageSize))
    } else if (direction === "previous" && endBeforeDoc) {
      console.log("Using endBefore cursor for previous page")
      membersQuery = query(membersQuery, endBefore(endBeforeDoc), limitToLast(pageSize))
    } else {
      console.log("Using direct page access")
      // For direct page access, we need to skip documents
      const skipCount = (page - 1) * pageSize
      if (skipCount > 0) {
        // Get documents to skip
        const skipQuery = query(membersQuery, limit(skipCount))
        const skipSnapshot = await getDocs(skipQuery)
        if (skipSnapshot.docs.length > 0) {
          const lastSkipDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1]
          membersQuery = query(membersQuery, startAfter(lastSkipDoc), limit(pageSize))
        } else {
          membersQuery = query(membersQuery, limit(pageSize))
        }
      } else {
        membersQuery = query(membersQuery, limit(pageSize))
      }
    }

    const [snapshot, totalCount] = await Promise.all([getDocs(membersQuery), getOHPlusMembersCount()])

    console.log(`Fetched ${snapshot.docs.length} OH! Plus members, total count: ${totalCount}`)

    let members = snapshot.docs.map(docToOHPlusMember)

    // NEW: Batch fetch company names for OH! Plus members
    const companyIds = members.map((member) => member.companyId).filter(Boolean)
    if (companyIds.length > 0) {
      const companyNames = await batchGetCompanyNames(companyIds)
      members = members.map((member) => ({
        ...member,
        companyName: member.companyId ? companyNames.get(member.companyId) || "Unknown Company" : undefined,
      }))
    }

    let firstDoc = snapshot.docs[0]
    let lastDoc = snapshot.docs[snapshot.docs.length - 1]

    // If we queried in reverse order for previous page, reverse the results
    if (direction === "previous" && endBeforeDoc) {
      members = members.reverse()
      firstDoc = snapshot.docs[snapshot.docs.length - 1]
      lastDoc = snapshot.docs[0]
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    const pagination: PaginationInfo = {
      currentPage: page,
      totalPages,
      totalMembers: totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      pageSize,
    }

    console.log(`Returning OH! Plus pagination info:`, pagination)

    return {
      members,
      pagination,
      firstDoc,
      lastDoc,
    }
  } catch (error) {
    console.error("Error fetching paginated OH! Plus members:", error)
    return {
      members: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalMembers: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize,
      },
    }
  }
}

// Enhanced paginated Sellah members (filtered by type only)
export async function getPaginatedSellahMembers(
  options: PaginationOptions = {},
): Promise<PaginatedSellahMembersResult> {
  const { page = 1, pageSize = 10, startAfterDoc, endBeforeDoc, direction = "next" } = options

  console.log(`getPaginatedSellahMembers called with page: ${page}, pageSize: ${pageSize}, direction: ${direction}`)

  try {
    const membersRef = collection(db, "iboard_users")
    // Filter exclusively by type for Sellah members
    let membersQuery = query(membersRef, where("type", "==", "SELLAH"), orderBy("created_at", "desc"))

    // Apply pagination cursor
    if (direction === "next" && startAfterDoc) {
      console.log("Using startAfter cursor for next page")
      membersQuery = query(membersQuery, startAfter(startAfterDoc), limit(pageSize))
    } else if (direction === "previous" && endBeforeDoc) {
      console.log("Using endBefore cursor for previous page")
      membersQuery = query(membersQuery, endBefore(endBeforeDoc), limitToLast(pageSize))
    } else {
      console.log("Using direct page access")
      // For direct page access, we need to skip documents
      const skipCount = (page - 1) * pageSize
      if (skipCount > 0) {
        // Get documents to skip
        const skipQuery = query(membersQuery, limit(skipCount))
        const skipSnapshot = await getDocs(skipQuery)
        if (skipSnapshot.docs.length > 0) {
          const lastSkipDoc = skipSnapshot.docs[skipSnapshot.docs.length - 1]
          membersQuery = query(membersQuery, startAfter(lastSkipDoc), limit(pageSize))
        } else {
          membersQuery = query(membersQuery, limit(pageSize))
        }
      } else {
        membersQuery = query(membersQuery, limit(pageSize))
      }
    }

    const [snapshot, totalCount] = await Promise.all([getDocs(membersQuery), getSellahMembersCount()])

    console.log(`Fetched ${snapshot.docs.length} Sellah members, total count: ${totalCount}`)

    let members = snapshot.docs.map(docToSellahMember)

    // NEW: Batch fetch company names for Sellah members
    const companyIds = members.map((member) => member.companyId).filter(Boolean)
    if (companyIds.length > 0) {
      const companyNames = await batchGetCompanyNames(companyIds)
      members = members.map((member) => ({
        ...member,
        companyName: member.companyId ? companyNames.get(member.companyId) || "Unknown Company" : undefined,
      }))
    }

    let firstDoc = snapshot.docs[0]
    let lastDoc = snapshot.docs[snapshot.docs.length - 1]

    // If we queried in reverse order for previous page, reverse the results
    if (direction === "previous" && endBeforeDoc) {
      members = members.reverse()
      firstDoc = snapshot.docs[snapshot.docs.length - 1]
      lastDoc = snapshot.docs[0]
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    const pagination: PaginationInfo = {
      currentPage: page,
      totalPages,
      totalMembers: totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      pageSize,
    }

    console.log(`Returning Sellah pagination info:`, pagination)

    return {
      members,
      pagination,
      firstDoc,
      lastDoc,
    }
  } catch (error) {
    console.error("Error fetching paginated Sellah members:", error)
    return {
      members: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalMembers: 0,
        hasNextPage: false,
        hasPreviousPage: false,
        pageSize,
      },
    }
  }
}

// Clear cache functions
export function clearMembersCache(): void {
  paginationCache.clear()
}

export function clearOHPlusMembersCache(): void {
  ohPlusPaginationCache.clear()
}

export function clearSellahMembersCache(): void {
  sellahPaginationCache.clear()
}

export function clearAllMembersCache(): void {
  paginationCache.clear()
  ohPlusPaginationCache.clear()
  sellahPaginationCache.clear()
}

// NEW: Clear company name cache
export function clearCompanyNameCache(): void {
  companyNameCache.clear()
}

// Document conversion functions
function docToMember(doc: QueryDocumentSnapshot<DocumentData>): Member {
  const data = doc.data()

  // Handle company_info as a map object (not array)
  let companyInfo: CompanyInfo | undefined
  try {
    if (data.company_info && typeof data.company_info === "object") {
      companyInfo = {
        company_name: data.company_info.company_name || "",
        company_position: data.company_info.company_position || "",
        company_address: data.company_info.company_address || "",
      }
    }
  } catch (error) {
    console.warn(`Error extracting company info for user ${doc.id}:`, error)
  }

  return {
    id: doc.id,
    email: data.email || "",
    firstName: data.first_name || "",
    middleName: data.middle_name || "",
    lastName: data.last_name || "",
    displayName: data.display_name || "",
    phoneNumber: data.phone_number || "",
    gender: data.gender || "",
    photoUrl: data.photo_url || "",
    photoURL: data.photoURL || "",
    companyId: data.company_id || "",
    companyInfo,
    companyContact: data.company_contact || "",
    companyEmail: data.company_email || "",
    companyName: data.company_name || "",
    type: data.type || "",
    active: data.active === true,
    deleted: data.deleted === true,
    createdTime: data.created_time?.toDate() || new Date(),
    updated: data.updated?.toDate(),
    ipAddress: data.ip_address || "",
    location: "",
    position: data.position || "",
    onboarding: data.onboarding === true,
    uid: data.uid || "",
  }
}

function docToOHPlusMember(doc: QueryDocumentSnapshot<DocumentData>): OHPlusMember {
  const data = doc.data()

  let createdTime = new Date()
  // Handle both 'created_time' and 'created' fields
  const createdField = data.created_time || data.created
  if (createdField) {
    if (typeof createdField.toDate === "function") {
      createdTime = createdField.toDate()
    } else if (createdField.seconds) {
      createdTime = new Date(createdField.seconds * 1000)
    } else if (createdField instanceof Date) {
      createdTime = createdField
    } else if (typeof createdField === "string" || typeof createdField === "number") {
      createdTime = new Date(createdField)
    }
  }

  let created: Date | undefined
  if (data.created) {
    if (typeof data.created.toDate === "function") {
      created = data.created.toDate()
    } else if (data.created.seconds) {
      created = new Date(data.created.seconds * 1000)
    } else if (data.created instanceof Date) {
      created = data.created
    } else if (typeof data.created === "string" || typeof data.created === "number") {
      created = new Date(data.created)
    }
  }

  let activeDate: Date | undefined
  if (data.active_date) {
    if (typeof data.active_date.toDate === "function") {
      activeDate = data.active_date.toDate()
    } else if (data.active_date.seconds) {
      activeDate = new Date(data.active_date.seconds * 1000)
    } else if (data.active_date instanceof Date) {
      activeDate = data.active_date
    } else if (typeof data.active_date === "string" || typeof data.active_date === "number") {
      activeDate = new Date(data.active_date)
    }
  }

  let updated: Date | undefined
  if (data.updated) {
    if (typeof data.updated.toDate === "function") {
      updated = data.updated.toDate()
    } else if (data.updated.seconds) {
      updated = new Date(data.updated.seconds * 1000)
    } else if (data.updated instanceof Date) {
      updated = data.updated
    } else if (data.updated instanceof Date) {
      updated = data.updated
    } else if (typeof data.updated === "string" || typeof data.updated === "number") {
      updated = new Date(data.updated)
    }
  }

  return {
    id: doc.id,
    email: data.email || "",
    firstName: data.first_name || "",
    middleName: data.middle_name || "",
    lastName: data.last_name || "",
    displayName: data.display_name || data.first_name || data.email || "",
    phoneNumber: data.phone_number || "",
    gender: data.gender || "",
    photoUrl: data.photo_url || "",
    photoURL: data.photoURL || "",
    companyId: data.company_id || "",
    companyName: undefined, // Will be populated by batch fetch
    type: data.type || "",
    active: data.active !== undefined ? data.active === true : true, // Default to true if not specified
    activeDate,
    created,
    createdTime,
    updated,
    location: data.location ? { latitude: data.location.latitude, longitude: data.location.longitude } : undefined,
    followers: data.followers || 0,
    products: data.products || 0,
    product: data.product || 0,
    productsCount: data.products_count || {},
    rating: data.rating || 0,
    onboarding: data.onboarding === true,
    uid: data.uid || "",
  }
}

function docToSellahMember(doc: QueryDocumentSnapshot<DocumentData>): SellahMember {
  const data = doc.data()

  let createdTime = new Date()
  if (data.created_time) {
    if (typeof data.created_time.toDate === "function") {
      createdTime = data.created_time.toDate()
    } else if (data.created_time.seconds) {
      createdTime = new Date(data.created_time.seconds * 1000)
    } else if (data.created_time instanceof Date) {
      createdTime = data.created_time
    } else if (typeof data.created_time === "string" || typeof data.created_time === "number") {
      createdTime = new Date(data.created_time)
    }
  }

  let created: Date | undefined
  if (data.created) {
    if (typeof data.created.toDate === "function") {
      created = data.created.toDate()
    } else if (data.created.seconds) {
      created = new Date(data.created.seconds * 1000)
    } else if (data.created instanceof Date) {
      created = data.created
    } else if (typeof data.created === "string" || typeof data.created === "number") {
      created = new Date(data.created)
    }
  }

  // Add proper handling for created_at field
  let created_at: Date | undefined
  if (data.created_at) {
    if (typeof data.created_at.toDate === "function") {
      created_at = data.created_at.toDate()
    } else if (data.created_at.seconds) {
      created_at = new Date(data.created_at.seconds * 1000)
    } else if (data.created_at instanceof Date) {
      created_at = data.created_at
    } else if (typeof data.created_at === "string" || typeof data.created_at === "number") {
      created_at = new Date(data.created_at)
    }
  }

  let activeDate: Date | undefined
  if (data.active_date) {
    if (typeof data.active_date.toDate === "function") {
      activeDate = data.active_date.toDate()
    } else if (data.active_date.seconds) {
      activeDate = new Date(data.active_date.seconds * 1000)
    } else if (data.active_date instanceof Date) {
      activeDate = data.active_date
    } else if (typeof data.active_date === "string" || typeof data.active_date === "number") {
      activeDate = new Date(data.active_date)
    }
  }

  let updated: Date | undefined
  if (data.updated) {
    if (typeof data.updated.toDate === "function") {
      updated = data.updated.toDate()
    } else if (data.updated.seconds) {
      updated = new Date(data.updated.seconds * 1000)
    } else if (data.updated instanceof Date) {
      updated = data.updated
    } else if (typeof data.updated === "string" || typeof data.updated === "number") {
      updated = new Date(data.updated)
    }
  }

  return {
    id: doc.id,
    email: data.email || "",
    firstName: data.first_name || "",
    middleName: data.middle_name || "",
    lastName: data.last_name || "",
    displayName: data.display_name || "",
    phoneNumber: data.phone_number || "",
    gender: data.gender || "",
    photoUrl: data.photo_url || "",
    photoURL: data.photoURL || "",
    companyId: data.company_id || "",
    companyName: undefined, // Will be populated by batch fetch
    type: data.type || "",
    active: data.active === true,
    activeDate,
    created,
    created_at, // Include the created_at field
    createdTime,
    updated,
    followers: data.followers || 0,
    product: data.product || 0,
    products: data.products || 0,
    rating: data.rating || 0,
    onboarding: data.onboarding === true,
    uid: data.uid || "",
  }
}

// Utility functions
export function formatFullName(firstName?: string, middleName?: string, lastName?: string): string {
  const parts = [firstName, middleName, lastName].filter(Boolean)
  return parts.join(" ")
}

export function formatDate(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    return "Date not available"
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

// Updated company info functions to work with map structure
export function getCurrentCompany(member: Member): CompanyInfo | null {
  return member.companyInfo || null
}

export function getCurrentPosition(member: Member): string {
  return member.companyInfo?.company_position || member.position || ""
}

export function getCurrentCompanyName(member: Member): string {
  return member.companyInfo?.company_name || member.companyName || ""
}

export function getCurrentCompanyAddress(member: Member): string {
  return member.companyInfo?.company_address || ""
}

export function getCurrentCompanyContact(member: Member): string {
  return member.companyContact || ""
}

export function getCurrentCompanyEmail(member: Member): string {
  return member.companyEmail || ""
}

export function formatCompanyPosition(member: Member): string {
  const companyInfo = getCurrentCompany(member)
  if (!companyInfo) {
    return "—"
  }

  const parts = []
  if (companyInfo.company_position) {
    parts.push(companyInfo.company_position)
  }
  if (companyInfo.company_name) {
    parts.push(`at ${companyInfo.company_name}`)
  }

  return parts.join(" ") || "—"
}

export function formatCompanyContact(member: Member): string {
  const contactParts = []
  if (member.companyContact) {
    contactParts.push(member.companyContact)
  }
  if (member.companyEmail) {
    contactParts.push(member.companyEmail)
  }

  return contactParts.join(" • ")
}

// Get member by ID function (filtered by type)
export async function getMemberById(memberId: string, platform: string): Promise<Member | OHPlusMember | SellahMember> {
  try {
    let collectionName: string

    switch (platform) {
      case "oh-plus":
        collectionName = "iboard_users"
        break
      case "sellah":
        collectionName = "iboard_users"
        break
      default:
        collectionName = "users"
        break
    }

    const memberDoc = await getDoc(doc(db, collectionName, memberId))

    if (!memberDoc.exists()) {
      throw new Error("Member not found")
    }

    switch (platform) {
      case "oh-plus":
        const ohPlusMember = docToOHPlusMember(memberDoc as QueryDocumentSnapshot<DocumentData>)
        // Fetch company name if companyId exists
        if (ohPlusMember.companyId) {
          ohPlusMember.companyName = await getCompanyNameById(ohPlusMember.companyId)
        }
        return ohPlusMember
      case "sellah":
        const sellahMember = docToSellahMember(memberDoc as QueryDocumentSnapshot<DocumentData>)
        // Fetch company name if companyId exists
        if (sellahMember.companyId) {
          sellahMember.companyName = await getCompanyNameById(sellahMember.companyId)
        }
        return sellahMember
      default:
        return docToMember(memberDoc as QueryDocumentSnapshot<DocumentData>)
    }
  } catch (error) {
    console.error("Error fetching member by ID:", error)
    throw error
  }
}

// Debug function to check Sellah data (filtered by type only)
export async function debugSellahMembers(): Promise<{
  totalCount: number
  sampleData: any[]
  querySuccess: boolean
}> {
  try {
    const membersRef = collection(db, "iboard_users")
    const debugQuery = query(membersRef, where("type", "==", "SELLAH"), limit(5))
    const snapshot = await getDocs(debugQuery)

    const sampleData = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: doc.data(),
    }))

    const totalCount = await getSellahMembersCount()

    return {
      totalCount,
      sampleData,
      querySuccess: true,
    }
  } catch (error) {
    console.error("Debug Sellah members error:", error)
    return {
      totalCount: 0,
      sampleData: [],
      querySuccess: false,
    }
  }
}

// Validate member data structure (type-based validation)
export function validateSellahMemberData(member: any): boolean {
  return (
    member &&
    typeof member.id === "string" &&
    typeof member.email === "string" &&
    typeof member.type === "string" &&
    member.type === "SELLAH"
  )
}

export function validateOHPlusMemberData(member: any): boolean {
  return (
    member &&
    typeof member.id === "string" &&
    typeof member.email === "string" &&
    typeof member.type === "string" &&
    member.type === "OHPLUS"
  )
}

export function validateMemberData(member: any): boolean {
  return (
    member &&
    typeof member.id === "string" &&
    typeof member.email === "string" &&
    typeof member.type === "string" &&
    (member.type === "MEMBERS" || member.type === "Members")
  )
}
