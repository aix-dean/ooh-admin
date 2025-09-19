export type NewstickerStatus = "draft" | "published" | "archived"

export interface Newsticker {
  id: string
  uid: string
  created: Date
  title: string
  content: string
  position: number
  status: NewstickerStatus
  start_time: Date
  end_time: Date
  timestamp: Date
  deleted: boolean
  updated: Date
}

export interface NewstickerFormData {
  title: string
  content: string
  start_time: string | Date
  end_time: string | Date
  position: number
  status: NewstickerStatus
}

export interface NewstickerFilter {
  status?: NewstickerStatus
  showDeleted: boolean
  searchQuery: string
}
