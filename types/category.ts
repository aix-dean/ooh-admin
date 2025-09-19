import type { Timestamp } from "firebase/firestore"

export interface Category {
  id: string
  name: string
  photo_url: string
  active: boolean
  clicked: number
  created: Timestamp
  deleted: boolean
  featured: boolean
  main_category_id: string[]
  position: number
  type: string
}

export interface CategoryFormData {
  name: string
  photo_url: string
  active: boolean
  featured: boolean
  main_category_id: string[]
  position: number
  type: string
}

export interface CategoryFilter {
  searchTerm?: string
  featured?: boolean
  active?: boolean
  mainCategoryId?: string
  type?: string
  sortBy?: keyof Category
  sortDirection?: "asc" | "desc"
  page?: number
  limit?: number
  showDeleted?: boolean
}

export type CategoryValidationErrors = Partial<Record<keyof CategoryFormData, string>>
