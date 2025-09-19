export interface ContentMedia {
  id: string
  created: string
  title: string
  author: string
  uid: string
  description: string
  views: number
  likes: number
  shares: number
  hpv: string
  type: string
  category_id: string
  updated: string
  video_url?: string
  author_id: string
  active: boolean
  position: number
  deleted: boolean
  start_date?: string
  end_date?: string
  orientation?: string
  public: boolean
  episode?: number
  start_time?: string
  end_time?: string
  thumbnail?: string
  rating?: number
  synopsis?: string
  media?: MediaContent[]
  link_ref?: string[]
  featured: boolean
  pinned?: boolean
}

export interface MediaContent {
  created: string
  description: string
  url: string
}

export interface ContentMediaFilter {
  category_id?: string
  type?: string
  showDeleted?: boolean
  searchQuery?: string
  featured?: boolean
  active?: boolean
  pinned?: boolean
}
