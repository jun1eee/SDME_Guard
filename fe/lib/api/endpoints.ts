const VENDOR_API_BASE = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api`

export function buildVendorListEndpoint(params?: {
  cursor?: string
  size?: number
  category?: string
  keyword?: string
  minPrice?: number
  maxPrice?: number
  rating?: number
  sort?: string
}) {
  const searchParams = new URLSearchParams()

  if (params?.cursor) searchParams.set("cursor", params.cursor)
  if (params?.size !== undefined) searchParams.set("size", String(params.size))
  if (params?.category) searchParams.set("category", params.category)
  if (params?.keyword) searchParams.set("keyword", params.keyword)
  if (params?.minPrice !== undefined) searchParams.set("minPrice", String(params.minPrice))
  if (params?.maxPrice !== undefined) searchParams.set("maxPrice", String(params.maxPrice))
  if (params?.rating !== undefined) searchParams.set("rating", String(params.rating))
  if (params?.sort) searchParams.set("sort", params.sort)

  const query = searchParams.toString()
  return query ? `${VENDOR_API_BASE}/vendors?${query}` : `${VENDOR_API_BASE}/vendors`
}

export function buildVendorDetailEndpoint(vendorId: string | number) {
  return `${VENDOR_API_BASE}/vendors/${vendorId}`
}

export const API_ENDPOINTS = {
  vendors: `${VENDOR_API_BASE}/vendors`,
  buildVendorListEndpoint,
  buildVendorDetailEndpoint,
} as const

