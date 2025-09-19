export type ContentCategoryStatus = "active" | "inactive"

export interface ContentCategory {
  id: string
  created: Date
  type: string
  position: number
  description: string
  name: string
  active: boolean
  pinned_content: boolean
  logo: string
  updated: Date
  deleted: boolean
  featured: boolean
  pinned_contents: string[]
}

export interface ContentCategoryFormData {
  type: string
  position: number
  description: string
  name: string
  active: boolean
  pinned_content: boolean
  featured: boolean
  pinned_contents: string[]
  logo?: File | null
}

export interface ContentCategoryFilter {
  type?: string
  showDeleted: boolean
  searchQuery: string
  featured?: boolean
  active?: boolean
}
