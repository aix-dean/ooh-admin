import type { Timestamp } from "firebase/firestore"

export interface MainCategory {
  id: string
  name: string
  photo_url: string
  created: Timestamp
  active: boolean
  description: string
  updated: Timestamp
  featured: boolean
  position: number
  date_deleted?: Timestamp
  deleted: boolean
}

export interface MainCategoryFormData {
  name: string
  description: string
  photo_url: string
  active: boolean
  featured: boolean
  position: number
}

export interface MainCategoryFilter {
  searchTerm?: string
  featured?: boolean
  active?: boolean
  sortBy?: keyof MainCategory
  sortDirection?: "asc" | "desc"
  page?: number
  limit?: number
  showDeleted?: boolean
}

export type MainCategoryValidationErrors = Partial<Record<keyof MainCategoryFormData, string>>
