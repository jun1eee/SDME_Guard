import type { Vendor } from "@/components/views/vendors-view"

interface VisitInfo {
  address: string | null
  phone: string | null
  closedDays: string | null
  transport: string | null
  parking: string | null
  hours: string | null
  lunchBreak: string | null
  floor: string | null
}

interface PackageInclude {
  label: string
  value: string
}

interface PackageTab {
  tabName: string
  price: number | null
  includes: PackageInclude[]
}

interface AdditionalProductItem {
  name: string
  price: number | null
  condition: string | null
}

interface AdditionalProductGroup {
  category: string
  items: AdditionalProductItem[]
}

interface DetailField {
  label: string
  value: string
}

interface VendorExtra {
  profile: string | null
  details: DetailField[]
}

interface HallItem {
  id: number
  name: string
  guestMin: number | null
  guestMax: number | null
  hallType: string | null
  style: string | null
  mealType: string | null
  mealPrice: number | null
  ceremonyType: string | null
  ceremonyIntervalMin: number | null
  ceremonyIntervalMax: number | null
  hasSubway: boolean | null
  hasParking: boolean | null
  hasValet: boolean | null
  hasVirginRoad: boolean | null
}

interface HallFacility {
  name: string
}

export interface VendorDetailResponse {
  id: number
  name: string
  category: "studio" | "dress" | "makeup" | "hall"
  price: number | null
  rating: number | null
  image: string | null
  description: string | null
  hashtags: string[]
  isDressShop: boolean
  visitInfo: VisitInfo | null
  packageTabs: PackageTab[]
  additionalProducts: AdditionalProductGroup[]
  images: string[]
  booked: boolean
  studioExtra: VendorExtra | null
  dressExtra: VendorExtra | null
  makeupExtra: VendorExtra | null
  halls: HallItem[] | null
  hallEvent: unknown | null
  hallFacilities: HallFacility[] | null
}

interface VendorDetailApiEnvelope {
  status?: number
  message?: string
  data?: VendorDetailResponse
}

export function formatVendorPrice(value: number | null | undefined) {
  if (value === null || value === undefined) return "문의"
  return `${value.toLocaleString("ko-KR")}원`
}

function normalizeResponse(payload: VendorDetailApiEnvelope | VendorDetailResponse): VendorDetailResponse {
  if ("data" in payload && payload.data) return payload.data
  return payload as VendorDetailResponse
}

function buildPackages(detail: VendorDetailResponse) {
  return (detail.packageTabs ?? []).map((pkg, index) => ({
    id: `${detail.id}-pkg-${index}`,
    name: pkg.tabName,
    price: pkg.price ?? 0,
    mainItems: (pkg.includes ?? []).map((item) => ({
      name: item.label,
      value: item.value,
    })),
  }))
}

function buildAddons(detail: VendorDetailResponse) {
  return (detail.additionalProducts ?? []).flatMap((group, groupIndex) =>
    (group.items ?? []).map((item, itemIndex) => ({
      id: `${detail.id}-addon-${groupIndex}-${itemIndex}`,
      name: item.name,
      price: item.price ?? 0,
      description: [group.category, item.condition, item.price === null ? "가격 문의" : null]
        .filter(Boolean)
        .join(" / "),
    }))
  )
}

function buildMemo(detail: VendorDetailResponse) {
  const activeExtra = detail.studioExtra ?? detail.dressExtra ?? detail.makeupExtra
  const sections: string[] = []

  if (activeExtra?.profile) sections.push(activeExtra.profile)

  if (activeExtra?.details?.length) {
    sections.push(activeExtra.details.map((item) => `${item.label}: ${item.value}`).join("\n"))
  }

  if (detail.isDressShop) sections.push("드레스샵 전용 업체")

  return sections.filter(Boolean).join("\n\n") || undefined
}

export function mapDetailToVendor(detail: VendorDetailResponse): Vendor {
  return {
    id: String(detail.id),
    category: detail.category === "hall" ? "venue" : detail.category,
    name: detail.name,
    tags: detail.hashtags ?? [],
    description: detail.category === "hall" ? "" : (detail.description ?? ""),
    contact: detail.visitInfo?.phone ?? "문의 필요",
    address: detail.visitInfo?.address ?? "주소 정보 없음",
    transit: detail.visitInfo?.transport ?? undefined,
    parking: detail.visitInfo?.parking ?? undefined,
    hours:
      [
        detail.visitInfo?.hours,
        detail.visitInfo?.closedDays ? `휴무: ${detail.visitInfo.closedDays}` : null,
        detail.visitInfo?.lunchBreak ? `점심시간: ${detail.visitInfo.lunchBreak}` : null,
      ]
        .filter(Boolean)
        .join(" / ") || undefined,
    floor: detail.visitInfo?.floor ?? undefined,
    rating: Number(((detail.rating ?? 0) / 20).toFixed(1)),
    reviewCount: 0,
    paymentStep: 1,
    price: formatVendorPrice(detail.price),
    isFavorite: false,
    packages: buildPackages(detail),
    addons: buildAddons(detail),
    reviews: [],
    memoContent: buildMemo(detail),
    halls: detail.halls ?? undefined,
    hallFacilities: detail.hallFacilities?.map((f) => f.name) ?? undefined,
    coverUrl: detail.image ?? detail.images?.[0] ?? undefined,
    logoUrl: detail.image ?? undefined,
  }
}

interface ReviewApiItem {
  id: number | null
  rating: number
  authorName: string | null
  content: string
  reviewedAt: string | null
}

interface ReviewApiEnvelope {
  status?: number
  data?: ReviewApiItem[]
}

async function fetchVendorReviews(vendorId: string | number): Promise<Vendor["reviews"]> {
  try {
    const res = await fetch(`/api/vendors/${vendorId}/reviews`, { credentials: "include" })
    if (!res.ok) return []
    const json = (await res.json()) as ReviewApiEnvelope | ReviewApiItem[]
    const items: ReviewApiItem[] = Array.isArray(json) ? json : (json.data ?? [])
    return items.map((r, i) => ({
      id: r.id != null ? String(r.id) : `crawled-${i}`,
      authorName: r.authorName ?? "익명",
      rating: r.rating,
      content: r.content,
      date: r.reviewedAt?.split(/[T ]/)[0] ?? "",
    }))
  } catch {
    return []
  }
}

export async function fetchVendorDetail(vendorId: string | number): Promise<Vendor> {
  const response = await fetch(`/api/vendors/${vendorId}`, { credentials: "include" })
  if (!response.ok) throw new Error(String(response.status))
  const result = normalizeResponse((await response.json()) as VendorDetailApiEnvelope | VendorDetailResponse)
  const vendor = mapDetailToVendor(result)
  vendor.reviews = await fetchVendorReviews(vendorId)
  return vendor
}

