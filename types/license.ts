export interface LicenseData {
  id: string
  uid: string
  license_key: string
  license_name: string
  company_name: string
  company_location: string
  company_website: string
  social_media: {
    facebook: string
    instagram: string
    youtube: string
  }
  created: string
  updated: string
  deleted: boolean
  tenant_id?: string
}