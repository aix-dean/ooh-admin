export interface ProductMedia {
  distance: string
  isVideo: boolean
  type: string
  url: string
}

export interface ProductSpecsRental {
  audience_type: string
  audience_types: string[]
  elevation: number | null
  geopoint: [number, number] // [latitude, longitude]
  height: number
  location: string
  traffic_count: number
  width: number
}

export interface Product {
  id: string
  action: string
  action_url: string
  active: boolean
  ai_logo_tags: string[]
  ai_text_tags: string[]
  categories: string[]
  category_names: string[]
  cms: any | null
  content_type: string
  created: Date
  deleted: boolean
  description: string
  media: ProductMedia[]
  name: string
  position: number
  price: number
  seller_id: string
  seller_name: string
  site_code: string
  specs_rental: ProductSpecsRental
  status: string
  type: string
  updated: Date
}

export interface ProductFilters {
  status?: string
  type?: string
  active?: boolean
  seller_id?: string
  category?: string
  price_min?: number
  price_max?: number
  search?: string
}
