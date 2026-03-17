"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft, Star, Heart, Share2, MapPin, Clock, Phone,
  Navigation, Car, Building2, Flag, ChevronDown, ChevronUp,
  MessageCircle, Copy, Check, Search, Send, X, Sparkles, Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { fetchVendorDetail } from "@/lib/api/vendor-detail"
import { buildVendorListEndpoint } from "@/lib/api/endpoints"

// ─── Types ─────────────────────────────────────────────────────────────────

interface VendorPackageItem {
  name: string
  value: string
}

interface VendorPackageOption {
  name: string
  price: number
  note?: string
}

interface VendorPackageSection {
  title: string
  items: VendorPackageItem[]
  options?: VendorPackageOption[]
}

interface VendorPackage {
  id: string
  name: string
  price: number
  mainItems: VendorPackageItem[]
  sections?: VendorPackageSection[]
}

interface VendorAddon {
  id: string
  name: string
  price: number
  description?: string
}

interface VendorReview {
  id: string
  authorName: string
  rating: number
  content: string
  date: string
}

interface VendorBenefit {
  uuid: string
  type: number
  title: string
  content: string
  iconUrl: string
  badge: string
  linkUrl: string | null
}

export interface VendorHall {
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

interface Vendor {
  id: string
  category: "studio" | "dress" | "makeup" | "venue"
  name: string
  tags: string[]
  description: string
  contact: string
  address: string
  transit?: string
  parking?: string
  hours?: string
  floor?: string
  rating: number
  reviewCount: number
  paymentStep: 1 | 2 | 3 | 4 | 5
  price: string
  isFavorite: boolean
  packages?: VendorPackage[]
  addons?: VendorAddon[]
  reviews?: VendorReview[]
  aiReviewSummary?: {
    totalCount: number
    highlights: string[]
    summary: string
  }
  newDays?: number
  styleFilter?: string[]
  memoContent?: string
  benefits?: VendorBenefit[]
  logoUrl?: string
  coverUrl?: string
  halls?: VendorHall[]
  hallFacilities?: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────

const PAYMENT_STEPS = [
  { step: 1, label: "상담중" },
  { step: 2, label: "계약금 10% 납입 완료" },
  { step: 3, label: "서비스 진행중" },
  { step: 4, label: "잔금 90% 납입 완료" },
  { step: 5, label: "서비스 완료" },
]

const CATEGORIES = [
  { id: "all", label: "전체" },
  { id: "studio", label: "스튜디오" },
  { id: "dress", label: "드레스" },
  { id: "makeup", label: "메이크업" },
  { id: "venue", label: "웨딩홀" },
] as const

type CategoryType = typeof CATEGORIES[number]["id"]

const VENDOR_PAGE_SIZE = 20

const API_CATEGORY_MAP: Record<CategoryType, string | undefined> = {
  all: undefined,
  studio: "STUDIO",
  dress: "DRESS",
  makeup: "MAKEUP",
  venue: "HALL",
}

interface VendorListItem {
  id: number
  name: string
  category: string
  price: number | null
  rating: number | null
  image: string | null
  hashtags: string[]
  description?: string | null
}

interface VendorListPage {
  content?: VendorListItem[]
  nextCursor?: string | null
  hasNext?: boolean
}

interface VendorListEnvelope {
  status?: number
  message?: string
  data?: VendorListPage | VendorListItem[]
  content?: VendorListItem[]
  nextCursor?: string | null
}

function parseListResponse(json: VendorListEnvelope): { items: VendorListItem[]; nextCursor: string | null } {
  if (json.data && !Array.isArray(json.data)) {
    const page = json.data as VendorListPage
    return { items: page.content ?? [], nextCursor: page.nextCursor ?? null }
  }
  if (Array.isArray(json.data)) {
    return { items: json.data, nextCursor: json.nextCursor ?? null }
  }
  return { items: json.content ?? [], nextCursor: json.nextCursor ?? null }
}

function mapListItemToVendor(item: VendorListItem): Vendor {
  const catMap: Record<string, Vendor["category"]> = {
    STUDIO: "studio", DRESS: "dress", MAKEUP: "makeup", HALL: "venue",
    studio: "studio", dress: "dress", makeup: "makeup", venue: "venue",
  }
  return {
    id: String(item.id),
    category: catMap[item.category] ?? "studio",
    name: item.name,
    tags: item.hashtags ?? [],
    description: item.description ?? "",
    contact: "문의 필요",
    address: "주소 정보 없음",
    rating: Number(((item.rating ?? 0) / 20).toFixed(1)),
    reviewCount: 0,
    paymentStep: 1,
    price: item.price != null ? `${item.price.toLocaleString("ko-KR")}원` : "문의",
    isFavorite: false,
    coverUrl: item.image ?? undefined,
    logoUrl: item.image ?? undefined,
  }
}

const STYLE_FILTERS: Record<string, string[]> = {
  studio: ["다양한컨셉", "인물중심", "배경중심", "클래식", "트렌디", "내추럴", "러블리", "그리너리", "심플한"],
  venue: ["호텔예식", "채플", "일반컨벤션", "밝은", "어두운"],
  dress: ["화려한", "심플한", "러블리", "유니크", "세련된", "클래식", "트렌디"],
  makeup: ["러블리", "포인트", "스모키", "깨끗한", "화려한", "내추럴", "음영"],
}

// ─── Sample Data ──────────────────────────────────────────────────────────

const INITIAL_VENDORS: Vendor[] = [
  {
    id: "1",
    category: "studio",
    name: "루미에르 스튜디오",
    tags: ["감성적인", "자연광", "시네마틱", "프리미엄"],
    description:
      "감성적인 촬영 스타일로 유명한 프리미엄 웨딩 스튜디오입니다. 자연광을 활용한 촬영과 시네마틱 영상을 전문으로 합니다.",
    contact: "02-1234-5678",
    address: "서울 강남구 신사동 123-4 루미에르빌딩 3층",
    transit: "3호선 신사역 8번 출구 도보 5분",
    parking: "건물 내 주차 가능 (2시간 무료), 발렛 없음",
    hours: "10:00 ~ 19:00 (휴무: 매주 월요일) / 점심: 12:00 ~ 13:00",
    floor: "3층",
    rating: 4.9,
    reviewCount: 2,
    paymentStep: 1,
    price: "2,800,000원",
    isFavorite: false,
    styleFilter: ["다양한컨셉", "인물중심", "내추럴"],
    packages: [
      {
        id: "p1",
        name: "리허설+본식",
        price: 2800000,
        mainItems: [
          { name: "앨범", value: "20P 앨범 1권" },
          { name: "액자", value: "20R 액자 1개" },
          { name: "원본", value: "원본 구매 필수 (USB 제공)" },
          { name: "야외씬", value: "1곳 포함" },
        ],
        sections: [
          {
            title: "리허설촬영 구성",
            items: [
              { name: "앨범", value: "20P 앨범 1권" },
              { name: "액자", value: "20R 액자 1개" },
              { name: "원본 구매", value: "필수" },
            ],
            options: [
              { name: "잠수교", price: 220000 },
              { name: "한강반포지구", price: 220000, note: "2곳째부터 +110,000원" },
              { name: "용산가족공원", price: 220000, note: "의상 1벌 제한" },
            ],
          },
        ],
      },
      {
        id: "p2",
        name: "본식",
        price: 1800000,
        mainItems: [
          { name: "앨범", value: "10P 앨범 1권" },
          { name: "액자", value: "20R 액자 1개" },
          { name: "원본", value: "원본 구매 필수 (USB 제공)" },
        ],
      },
    ],
    addons: [
      { id: "a1", name: "USB 원본 파일", price: 300000 },
      { id: "a2", name: "영상 편집 추가", price: 500000 },
      { id: "a3", name: "야외 추가 촬영", price: 220000, description: "2곳째부터" },
    ],
    reviews: [
      {
        id: "r1",
        authorName: "김지현",
        rating: 5,
        content: "감성적인 촬영 퀄리티가 정말 좋았어요. 자연광 활용이 탁월합니다.",
        date: "2025-12-15",
      },
      {
        id: "r2",
        authorName: "이수민",
        rating: 5,
        content: "사진 보정도 자연스럽고, 스태프분들이 너무 친절했어요.",
        date: "2025-11-20",
      },
    ],
    aiReviewSummary: {
      totalCount: 2,
      highlights: ["감성적인 촬영 퀄리티가 정말 좋아요", "사진 보정도 자연스럽고"],
      summary:
        "2개의 리뷰를 분석한 결과 전반적인 평가가 매우 긍정적입니다. 대부분의 고객이 만족스러운 서비스를 경험했습니다.",
    },
  },
  {
    id: "2",
    category: "dress",
    name: "메종 블랑쉬 아틀리에",
    tags: ["고급스러운", "맞춤제작", "엔틱한"],
    description:
      "맞춤 제작 드레스 전문 아틀리에입니다. 신부의 체형과 취향에 맞는 드레스를 세심하게 제작합니다.",
    contact: "02-3456-7890",
    address: "서울 강남구 신사동 456 블랑쉬빌딩 2층",
    transit: "3호선 신사역 5번 출구 도보 3분",
    parking: "건물 내 주차 가능 (1시간 무료)",
    hours: "10:00 ~ 19:00 (휴무: 매주 일요일)",
    floor: "2층",
    rating: 4.8,
    reviewCount: 15,
    paymentStep: 2,
    price: "4,500,000원",
    isFavorite: false,
    newDays: 3,
    styleFilter: ["화려한", "러블리", "세련된"],
    packages: [
      {
        id: "p1",
        name: "맞춤 드레스",
        price: 4500000,
        mainItems: [
          { name: "피팅 횟수", value: "3회 (기본)" },
          { name: "제작 기간", value: "3~4개월" },
          { name: "수선", value: "2회 포함" },
        ],
      },
      {
        id: "p2",
        name: "기성품 드레스",
        price: 2000000,
        mainItems: [
          { name: "피팅 횟수", value: "1회" },
          { name: "수선", value: "1회 포함" },
        ],
      },
    ],
    addons: [
      { id: "a1", name: "추가 피팅", price: 100000, description: "회당" },
      { id: "a2", name: "악세사리 세트", price: 200000 },
    ],
    reviews: [
      {
        id: "r1",
        authorName: "박서준",
        rating: 5,
        content: "드레스가 너무 아름다웠어요. 맞춤 제작이라 핏이 완벽했습니다.",
        date: "2025-12-01",
      },
    ],
    aiReviewSummary: {
      totalCount: 15,
      highlights: ["맞춤 제작으로 핏이 완벽해요", "스타일리스트가 꼼꼼하게 케어해줍니다"],
      summary: "15개의 리뷰를 분석한 결과 전반적인 평가가 매우 긍정적입니다.",
    },
  },
  {
    id: "3",
    category: "venue",
    name: "더 그랜드 파빌리온",
    tags: ["모던한", "넓은", "고급스러운"],
    description:
      "모던하고 세련된 분위기의 프리미엄 웨딩홀입니다. 다양한 규모의 홀을 보유하고 있어 소규모부터 대규모 예식까지 가능합니다.",
    contact: "02-0000-5678",
    address: "서울 강남구 청담동 789 파빌리온빌딩",
    transit: "7호선 청담역 2번 출구 도보 10분",
    parking: "전용 주차장 완비 (무제한 무료)",
    hours: "09:00 ~ 21:00",
    floor: "B1, 1~3층",
    rating: 4.8,
    reviewCount: 256,
    paymentStep: 1,
    price: "900만원~",
    isFavorite: true,
    styleFilter: ["채플", "밝은"],
    packages: [
      {
        id: "p1",
        name: "그랜드홀",
        price: 9000000,
        mainItems: [
          { name: "수용 인원", value: "최대 400명" },
          { name: "면적", value: "700평" },
          { name: "식사", value: "호텔 뷔페 포함" },
          { name: "주차", value: "무제한 무료" },
        ],
      },
      {
        id: "p2",
        name: "로즈홀",
        price: 6500000,
        mainItems: [
          { name: "수용 인원", value: "최대 200명" },
          { name: "면적", value: "350평" },
          { name: "식사", value: "뷔페 포함" },
          { name: "주차", value: "무제한 무료" },
        ],
      },
      {
        id: "p3",
        name: "가든홀",
        price: 5000000,
        mainItems: [
          { name: "수용 인원", value: "최대 120명" },
          { name: "면적", value: "200평" },
          { name: "식사", value: "뷔페 포함" },
          { name: "주차", value: "무제한 무료" },
        ],
      },
    ],
    addons: [
      { id: "a1", name: "사진 촬영 (기본)", price: 500000 },
      { id: "a2", name: "영상 촬영", price: 800000 },
      { id: "a3", name: "꽃장식 추가", price: 300000 },
    ],
    reviews: [
      {
        id: "r1",
        authorName: "최민준",
        rating: 5,
        content: "세련된 인테리어가 인상적이에요. 직원들도 매우 친절합니다.",
        date: "2025-11-01",
      },
    ],
    aiReviewSummary: {
      totalCount: 256,
      highlights: ["세련된 인테리어가 인상적이에요", "직원들이 매우 친절합니다"],
      summary:
        "256개의 리뷰를 분석한 결과 전반적인 평가가 매우 긍정적입니다.",
    },
  },
  {
    id: "4",
    category: "makeup",
    name: "글로우 뷰티",
    tags: ["자연스러운", "지속력", "피부표현"],
    description:
      "자연스러운 웨딩 메이크업을 전문으로 합니다. 신부의 피부 타입에 맞는 맞춤형 메이크업을 제공합니다.",
    contact: "02-4567-8901",
    address: "서울 강남구 청담동 101 글로우빌딩 4층",
    transit: "7호선 청담역 1번 출구 도보 7분",
    parking: "건물 내 주차 가능 (2시간 무료)",
    hours: "09:00 ~ 18:00 (휴무: 매주 일요일)",
    floor: "4층",
    rating: 4.6,
    reviewCount: 98,
    paymentStep: 3,
    price: "100만원~",
    isFavorite: false,
    styleFilter: ["내추럴", "깨끗한", "러블리"],
    packages: [
      {
        id: "p1",
        name: "기본 패키지",
        price: 1000000,
        mainItems: [
          { name: "메이크업", value: "본식 1회" },
          { name: "헤어", value: "본식 1회" },
        ],
      },
      {
        id: "p2",
        name: "리허설+본식",
        price: 1500000,
        mainItems: [
          { name: "메이크업", value: "리허설+본식" },
          { name: "헤어", value: "리허설+본식" },
        ],
      },
    ],
    addons: [
      { id: "a1", name: "속눈썹 연장", price: 50000 },
      { id: "a2", name: "헤어피스 추가", price: 80000 },
    ],
    reviews: [
      {
        id: "r1",
        authorName: "이지은",
        rating: 5,
        content: "자연스러운 메이크업이 정말 좋았어요. 하루 종일 지속됐어요.",
        date: "2025-10-15",
      },
    ],
    aiReviewSummary: {
      totalCount: 98,
      highlights: ["자연스러운 메이크업이 좋아요", "지속력이 뛰어납니다"],
      summary: "98개의 리뷰를 분석한 결과 전반적으로 긍정적입니다.",
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR") + "원"
}

function stepBadgeStyle(step: number): string {
  switch (step) {
    case 1: return "text-red-500"
    case 2: return "bg-red-100 text-red-600"
    case 3: return "bg-blue-100 text-blue-600"
    case 4: return "bg-green-100 text-green-700"
    default: return "bg-muted text-muted-foreground"
  }
}

// ─── Main Export ──────────────────────────────────────────────────────────

export function VendorsView({ onShareVendor, onAddToVote, currentUser, onFavoriteChange, initialVendorId, favoriteVendorIds }: {
  onShareVendor?: (vendor: Vendor) => void
  onAddToVote?: (vendor: Vendor) => void
  currentUser?: "groom" | "bride"
  onFavoriteChange?: (vendor: Vendor, isFavorite: boolean) => void
  initialVendorId?: string | null
  favoriteVendorIds?: string[]
}) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("all")
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [isDetailLoading, setIsDetailLoading] = useState(false)
  const detailAbortRef = useRef<AbortController | null>(null)

  const openVendorDetail = (vendor: Vendor) => {
    detailAbortRef.current?.abort()
    const controller = new AbortController()
    detailAbortRef.current = controller
    setSelectedVendor(vendor)
    setIsDetailLoading(true)
    fetchVendorDetail(vendor.id)
      .then((detail) => { if (!controller.signal.aborted) setSelectedVendor({ ...detail, isFavorite: vendor.isFavorite }) })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setIsDetailLoading(false) })
  }

  // 카테고리 변경 시 업체 목록 재조회
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setVendors([])
      setNextCursor(null)
      try {
        const apiCategory = API_CATEGORY_MAP[selectedCategory]
        const url = buildVendorListEndpoint({ size: VENDOR_PAGE_SIZE, ...(apiCategory ? { category: apiCategory } : {}) })
        const res = await fetch(url, { credentials: "include" })
        if (!res.ok) {
          console.error("업체 목록 조회 실패:", res.status, res.statusText)
          return
        }
        const json = (await res.json()) as VendorListEnvelope
        console.log("업체 목록 응답:", JSON.stringify(json).slice(0, 300))
        const { items, nextCursor: cursor } = parseListResponse(json)
        if (!cancelled) {
          setVendors(items.map(mapListItemToVendor))
          setNextCursor(cursor)
        }
      } catch (e) {
        console.error("업체 목록 fetch 오류:", e)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [selectedCategory])

  // 무한 스크롤
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !nextCursor || isFetchingMore) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !nextCursor || isFetchingMore) return
        const load = async () => {
          setIsFetchingMore(true)
          try {
            const apiCategory = API_CATEGORY_MAP[selectedCategory]
            const url = buildVendorListEndpoint({ size: VENDOR_PAGE_SIZE, cursor: nextCursor, ...(apiCategory ? { category: apiCategory } : {}) })
            const res = await fetch(url, { credentials: "include" })
            if (!res.ok) return
            const { items, nextCursor: cursor } = parseListResponse((await res.json()) as VendorListEnvelope)
            setVendors((prev) => [...prev, ...items.map(mapListItemToVendor)])
            setNextCursor(cursor)
          } finally {
            setIsFetchingMore(false)
          }
        }
        void load()
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [nextCursor, isFetchingMore, selectedCategory])

  // initialVendorId가 바뀌면 해당 업체 상세로 이동
  useEffect(() => {
    if (initialVendorId) {
      const v = vendors.find((v) => v.id === initialVendorId)
      if (v) openVendorDetail(v)
    }
  }, [initialVendorId])

  // 외부 찜 상태 동기화 (커플채팅 등에서 찜 취소 시 반영)
  useEffect(() => {
    if (!favoriteVendorIds) return
    setVendors((prev) =>
      prev.map((v) => ({ ...v, isFavorite: favoriteVendorIds.includes(v.id) }))
    )
    setSelectedVendor((prev) =>
      prev ? { ...prev, isFavorite: favoriteVendorIds.includes(prev.id) } : prev
    )
  }, [favoriteVendorIds])

  const filtered = vendors.filter((v) => {
    const catOk = selectedCategory === "all" || v.category === selectedCategory
    const searchOk = v.name.toLowerCase().includes(searchQuery.toLowerCase())
    const styleOk = !selectedStyle || (v.styleFilter?.includes(selectedStyle) ?? false)
    return catOk && searchOk && styleOk
  })

  const currentStyleFilters = selectedCategory !== "all" ? (STYLE_FILTERS[selectedCategory] ?? []) : []

  const toggleFavorite = (id: string) => {
    const vendor = vendors.find((v) => v.id === id)
    if (vendor) {
      const newFav = !vendor.isFavorite
      onFavoriteChange?.(vendor, newFav)
    }
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, isFavorite: !v.isFavorite } : v)))
    setSelectedVendor((prev) => (prev?.id === id ? { ...prev, isFavorite: !prev.isFavorite } : prev))
  }

  const addReview = (vendorId: string, review: Omit<VendorReview, "id">) => {
    const newReview = { ...review, id: Date.now().toString() }
    setVendors((prev) =>
      prev.map((v) =>
        v.id === vendorId
          ? { ...v, reviews: [...(v.reviews ?? []), newReview], reviewCount: v.reviewCount + 1 }
          : v
      )
    )
    setSelectedVendor((prev) =>
      prev?.id === vendorId
        ? { ...prev, reviews: [...(prev.reviews ?? []), newReview], reviewCount: prev.reviewCount + 1 }
        : prev
    )
  }

  if (selectedVendor) {
    return (
      <VendorDetailView
        vendor={selectedVendor}
        onBack={() => { detailAbortRef.current?.abort(); setSelectedVendor(null) }}
        onToggleFavorite={() => toggleFavorite(selectedVendor.id)}
        onAddReview={(r) => addReview(selectedVendor.id, r)}
        onShareVendor={onShareVendor}
        onAddToVote={onAddToVote}
        isLoading={isDetailLoading}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-4xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">업체</h1>
          <p className="mt-1 text-muted-foreground">AI가 엄선한 최고의 웨딩 업체</p>
        </div>

        {/* Category Tabs */}
        <div className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { setSelectedCategory(cat.id); setSelectedStyle(null) }}
              className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Style Filter */}
        {currentStyleFilters.length > 0 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {currentStyleFilters.map((style) => (
              <button
                key={style}
                onClick={() => setSelectedStyle(selectedStyle === style ? null : style)}
                className={`whitespace-nowrap rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
                  selectedStyle === style
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/50"
                }`}
              >
                {style}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="업체명으로 검색..."
            className="h-12 rounded-xl bg-card pl-12 text-base"
          />
        </div>

        {/* Card Grid */}
        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">업체 목록을 불러오는 중...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((vendor) => (
                <VendorCard
                  key={vendor.id}
                  vendor={vendor}
                  onClick={() => openVendorDetail(vendor)}
                  onToggleFavorite={() => toggleFavorite(vendor.id)}
                  onShareToCouple={onShareVendor ? () => onShareVendor(vendor) : undefined}
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">해당 카테고리에 업체가 없습니다</p>
              </div>
            )}
            <div ref={loadMoreRef} className="h-4" />
            {isFetchingMore && (
              <div className="py-4 text-center text-sm text-muted-foreground">더 불러오는 중...</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Vendor Card ──────────────────────────────────────────────────────────

function VendorCard({
  vendor,
  onClick,
  onToggleFavorite,
  onShareToCouple,
}: {
  vendor: Vendor
  onClick: () => void
  onToggleFavorite: () => void
  onShareToCouple?: () => void
}) {
  const [shareCopied, setShareCopied] = useState(false)
  const catLabel = CATEGORIES.find((c) => c.id === vendor.category)?.label ?? ""
  const stepLabel = PAYMENT_STEPS[vendor.paymentStep - 1]?.label ?? ""

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    onShareToCouple?.()
    setShareCopied(true)
    setTimeout(() => setShareCopied(false), 2000)
  }

  const handleDragStart = (e: React.DragEvent) => {
    const vendorData = {
      id: vendor.id,
      name: vendor.name,
      category: vendor.category,
      categoryLabel: catLabel,
      price: vendor.price,
      rating: vendor.rating,
      address: vendor.address ?? "",
      tags: vendor.tags,
      description: vendor.description,
    }
    e.dataTransfer.setData("application/vendor-card", JSON.stringify(vendorData))
    e.dataTransfer.effectAllowed = "copy"
  }

  return (
    <div
      className="cursor-pointer overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
    >
      {/* Image placeholder */}
      <div className="relative h-52 bg-[#f0eaf2]">
        <div className="absolute inset-x-3 top-3 flex items-center justify-end">
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stepBadgeStyle(vendor.paymentStep)}`}>
            {stepLabel}
          </span>
        </div>
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground/40">
          {catLabel}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground">{vendor.name}</h3>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <Star className="size-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-foreground">{vendor.rating}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {vendor.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-muted-foreground">
              #{tag}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-base font-bold text-foreground">{vendor.price}</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={handleShare}
              className="rounded-full p-2 hover:bg-muted"
              title="커플 방에 공유"
            >
              {shareCopied ? (
                <Check className="size-4 text-green-500" />
              ) : (
                <Share2 className="size-4 text-muted-foreground" />
              )}
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
              className="rounded-full p-2 hover:bg-muted"
            >
              <Heart
                className={`size-4 ${vendor.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vendor Detail View ───────────────────────────────────────────────────

export { INITIAL_VENDORS }
export type { Vendor }

export function VendorDetailView({
  vendor,
  onBack,
  onToggleFavorite,
  onAddReview,
  onShareVendor,
  onAddToVote,
  isLoading = false,
}: {
  vendor: Vendor
  onBack: () => void
  onToggleFavorite: () => void
  onAddReview: (review: Omit<VendorReview, "id">) => void
  onShareVendor?: (v: Vendor) => void
  onAddToVote?: (v: Vendor) => void
  isLoading?: boolean
}) {
  const [selectedPkgId, setSelectedPkgId] = useState(vendor.packages?.[0]?.id ?? "")
  const [selectedHallId, setSelectedHallId] = useState(vendor.halls?.[0]?.id ?? 0)
  const [showAddons, setShowAddons] = useState(false)
  const [showReservation, setShowReservation] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [voteAdded, setVoteAdded] = useState(false)
  const [addrCopied, setAddrCopied] = useState(false)

  const selectedPkg = vendor.packages?.find((p) => p.id === selectedPkgId)
  const reviews = vendor.reviews ?? []
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : vendor.rating

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          돌아가기
        </button>
        {isLoading && <span className="ml-auto text-xs text-muted-foreground">불러오는 중...</span>}
      </div>

      <div className="mx-auto w-full max-w-2xl">
        {/* Hero image */}
        <div className="flex h-72 items-center justify-center overflow-hidden bg-[#f0eaf2]">
          {vendor.coverUrl
            ? <img src={vendor.coverUrl} alt={vendor.name} className="h-full w-full object-cover" />
            : <span className="text-sm text-muted-foreground/40">{CATEGORIES.find((c) => c.id === vendor.category)?.label}</span>
          }
        </div>

        <div className="px-4 pb-16">
          {/* Basic info */}
          <div className="mt-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-foreground">{vendor.name}</h1>
                <button onClick={onToggleFavorite}>
                  <Heart
                    className={`size-5 ${vendor.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{vendor.rating}</span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {vendor.tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  #{tag}
                </span>
              ))}
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{vendor.description}</p>
          </div>

          {/* Payment progress */}
          <div className="mt-5 rounded-2xl bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">결제 진행 상태</h2>
            <div className="flex flex-col">
              {PAYMENT_STEPS.map((s, idx) => {
                const done = s.step < vendor.paymentStep
                const current = s.step === vendor.paymentStep
                const last = idx === PAYMENT_STEPS.length - 1
                return (
                  <div key={s.step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex size-8 items-center justify-center rounded-full text-sm font-medium ${
                          done || current ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done || current ? <Check className="size-4" /> : s.step}
                      </div>
                      {!last && (
                        <div
                          className={`my-1 min-h-5 w-0.5 flex-1 ${done ? "bg-foreground" : "bg-muted"}`}
                        />
                      )}
                    </div>
                    <div className="pb-4 pt-1">
                      <span
                        className={`text-sm ${
                          done || current ? "font-semibold text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        {s.label}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Action buttons */}
            <div className="mt-3 flex gap-2">
              {vendor.paymentStep === 1 && (
                <Button
                  onClick={() => setShowReservation(true)}
                  className="flex-1 bg-foreground text-background hover:bg-foreground/90"
                >
                  예약 생성
                </Button>
              )}
              {vendor.paymentStep <= 3 && (
                <Button onClick={() => setShowPayment(true)} variant="outline" className="flex-1">
                  {vendor.paymentStep <= 1 ? "계약금 결제" : "잔금 결제"}
                </Button>
              )}
              {onAddToVote && (
                <button
                  onClick={() => {
                    if (!voteAdded) {
                      onAddToVote(vendor)
                      setVoteAdded(true)
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm transition-colors ${
                    voteAdded
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Lock className="size-4" />
                  {voteAdded ? "투표 추가됨" : "투표에 올리기"}
                </button>
              )}
              <button
                onClick={() => onShareVendor?.(vendor)}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                <Share2 className="size-4" />
                공유
              </button>
            </div>
          </div>

          {/* Packages */}
          {vendor.packages && vendor.packages.length > 0 && (
            <div className="mt-5 rounded-2xl bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">용도별 패키지</h2>

              {vendor.packages.length > 1 && (
                <div className="mb-4 flex gap-1.5 rounded-xl bg-muted p-1">
                  {vendor.packages.map((pkg) => (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                        selectedPkgId === pkg.id
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground"
                      }`}
                    >
                      {pkg.name}
                    </button>
                  ))}
                </div>
              )}

              {selectedPkg && (
                <>
                  <div className="mb-3 flex items-baseline justify-between">
                    <h3 className="font-semibold text-foreground">{selectedPkg.name}</h3>
                    <span className="text-lg font-bold text-foreground">
                      {formatPrice(selectedPkg.price)}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedPkg.mainItems.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="text-right text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>

                  {selectedPkg.sections?.map((section, si) => (
                    <div key={si} className="mt-5">
                      <h4 className="mb-2.5 text-sm font-medium text-muted-foreground">
                        {section.title}
                      </h4>
                      <div className="space-y-2.5">
                        {section.items.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.name}</span>
                            <span className="text-foreground">{item.value}</span>
                          </div>
                        ))}
                      </div>

                      {section.options && section.options.length > 0 && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs text-muted-foreground">야외씬 촬영 옵션</p>
                          <div className="space-y-2.5">
                            {section.options.map((opt, i) => (
                              <div key={i}>
                                <div className="flex justify-between text-sm">
                                  <span className="font-medium text-foreground">{opt.name}</span>
                                  <span className="text-foreground">{formatPrice(opt.price)}</span>
                                </div>
                                {opt.note && (
                                  <p className="mt-0.5 text-xs text-muted-foreground">{opt.note}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {/* Halls */}
          {vendor.halls && vendor.halls.length > 0 && (() => {
            const selectedHall = vendor.halls!.find((h) => h.id === selectedHallId) ?? vendor.halls![0]
            return (
              <div className="mt-5 rounded-2xl bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-foreground">홀 정보</h2>
                {vendor.halls!.length > 1 && (
                  <div className="mb-4 flex gap-1.5 overflow-x-auto rounded-xl bg-muted p-1">
                    {vendor.halls!.map((hall) => (
                      <button
                        key={hall.id}
                        onClick={() => setSelectedHallId(hall.id)}
                        className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                          selectedHallId === hall.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                        }`}
                      >
                        {hall.name}
                      </button>
                    ))}
                  </div>
                )}
                <h3 className="mb-3 font-semibold text-foreground">{selectedHall.name}</h3>
                <div className="space-y-2.5">
                  {selectedHall.hallType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">홀 종류</span>
                      <span className="text-foreground">{selectedHall.hallType}</span>
                    </div>
                  )}
                  {(selectedHall.guestMin !== null || selectedHall.guestMax !== null) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">수용 인원</span>
                      <span className="text-foreground">{selectedHall.guestMin ?? "-"} ~ {selectedHall.guestMax ?? "-"}명</span>
                    </div>
                  )}
                  {selectedHall.style && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">예식 스타일</span>
                      <span className="text-foreground">{selectedHall.style}</span>
                    </div>
                  )}
                  {selectedHall.ceremonyType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">예식 형태</span>
                      <span className="text-foreground">{selectedHall.ceremonyType}</span>
                    </div>
                  )}
                  {(selectedHall.ceremonyIntervalMin !== null || selectedHall.ceremonyIntervalMax !== null) && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">예식 간격</span>
                      <span className="text-foreground">
                        {selectedHall.ceremonyIntervalMin === selectedHall.ceremonyIntervalMax
                          ? `${selectedHall.ceremonyIntervalMin}분`
                          : `${selectedHall.ceremonyIntervalMin ?? "-"} ~ ${selectedHall.ceremonyIntervalMax ?? "-"}분`}
                      </span>
                    </div>
                  )}
                  {selectedHall.mealType && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">식사 형태</span>
                      <span className="text-foreground">
                        {selectedHall.mealType}
                        {selectedHall.mealPrice !== null && ` (식대 ${selectedHall.mealPrice.toLocaleString("ko-KR")}원)`}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {([
                    { label: "지하철", value: selectedHall.hasSubway },
                    { label: "주차", value: selectedHall.hasParking },
                    { label: "발렛", value: selectedHall.hasValet },
                    { label: "버진로드", value: selectedHall.hasVirginRoad },
                  ] as { label: string; value: boolean | null }[])
                    .filter((item) => item.value !== null)
                    .map((item) => (
                      <span key={item.label} className={`rounded-full px-3 py-1 text-xs font-medium ${item.value ? "bg-foreground/10 text-foreground" : "bg-muted text-muted-foreground line-through"}`}>
                        {item.label}
                      </span>
                    ))}
                </div>
                {vendor.hallFacilities && vendor.hallFacilities.length > 0 && (
                  <div className="mt-5 border-t border-border pt-4">
                    <p className="mb-2.5 text-sm font-medium text-muted-foreground">부대시설</p>
                    <div className="flex flex-wrap gap-1.5">
                      {vendor.hallFacilities.map((f) => (
                        <span key={f} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{f}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Addons */}
          {vendor.addons && vendor.addons.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-2xl bg-card">
              <button
                onClick={() => setShowAddons(!showAddons)}
                className="flex w-full items-center justify-between p-5"
              >
                <span className="font-semibold text-foreground">추가상품</span>
                {showAddons ? (
                  <ChevronUp className="size-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-5 text-muted-foreground" />
                )}
              </button>
              {showAddons && (
                <div className="border-t border-border px-5 pb-5">
                  <div className="mt-4 space-y-3">
                    {vendor.addons.map((addon) => (
                      <div key={addon.id} className="flex justify-between text-sm">
                        <div>
                          <span className="font-medium text-foreground">{addon.name}</span>
                          {addon.description && (
                            <p className="text-xs text-muted-foreground">{addon.description}</p>
                          )}
                        </div>
                        <span className="font-medium text-foreground">{formatPrice(addon.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Memo Content (e.g. hall info) */}
          {vendor.memoContent && (
            <div className="mt-5 rounded-2xl bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">업체 정보</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {vendor.memoContent}
              </p>
            </div>
          )}

          {/* Benefits */}
          {vendor.benefits && vendor.benefits.length > 0 && (
            <div className="mt-5 rounded-2xl bg-card p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">혜택</h2>
              <div className="space-y-3">
                {vendor.benefits.map((benefit) => (
                  <div key={benefit.uuid} className="flex items-start gap-3">
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {benefit.badge}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{benefit.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{benefit.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Visit guide */}
          <div className="mt-5 rounded-2xl bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">방문안내</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1">
                  <span className="text-sm text-foreground">{vendor.address}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(vendor.address)
                      setAddrCopied(true)
                      setTimeout(() => setAddrCopied(false), 2000)
                    }}
                    className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {addrCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                    주소 복사
                  </button>
                </div>
              </div>

              {vendor.transit && (
                <div className="flex items-start gap-3">
                  <Navigation className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">{vendor.transit}</span>
                </div>
              )}
              {vendor.parking && (
                <div className="flex items-start gap-3">
                  <Car className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">{vendor.parking}</span>
                </div>
              )}
              {vendor.hours && (
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">{vendor.hours}</span>
                </div>
              )}
              {vendor.floor && (
                <div className="flex items-start gap-3">
                  <Building2 className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
                  <span className="text-sm text-foreground">{vendor.floor}</span>
                </div>
              )}
              <div className="flex items-center gap-3">
                <Phone className="size-4 flex-shrink-0 text-muted-foreground" />
                <a href={`tel:${vendor.contact}`} className="text-sm text-foreground underline">
                  {vendor.contact}
                </a>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              {[
                { label: "네이버 지도", href: `https://map.naver.com/v5/search/${encodeURIComponent(vendor.address)}` },
                { label: "카카오맵", href: `https://map.kakao.com/?q=${encodeURIComponent(vendor.address)}` },
                { label: "티맵", href: `tmap://search?name=${encodeURIComponent(vendor.address)}` },
              ].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 rounded-xl border border-border py-2.5 text-center text-sm font-medium text-foreground hover:bg-muted"
                >
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Reviews */}
          <div className="mt-5 rounded-2xl bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">리뷰</h2>
              <button
                onClick={() => setShowReview(true)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <Send className="size-4" />
                리뷰 작성
              </button>
            </div>

            {reviews.length > 0 && (
              <div className="mb-4 flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="text-4xl font-bold text-foreground">{avgRating.toFixed(1)}</span>
                  <div className="mt-1 flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star
                        key={i}
                        className={`size-4 ${i <= Math.round(avgRating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                      />
                    ))}
                  </div>
                  <span className="mt-1 text-xs text-muted-foreground">{reviews.length}개 리뷰</span>
                </div>
                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length
                    const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="w-2 text-muted-foreground">{star}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-foreground" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* AI summary */}
            {vendor.aiReviewSummary && (
              <div className="mb-4 rounded-xl bg-muted p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Sparkles className="size-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    AI 리뷰 요약 · {vendor.aiReviewSummary.totalCount}개 분석
                  </span>
                </div>
                <p className="mb-2 text-sm leading-relaxed text-foreground">
                  {vendor.aiReviewSummary.summary}
                </p>
                <div className="space-y-1">
                  {vendor.aiReviewSummary.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="size-3 flex-shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review list */}
            {reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{review.authorName}</span>
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`size-4 ${i <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{review.content}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-4 text-center text-sm text-muted-foreground">
                아직 리뷰가 없습니다. 첫 번째 리뷰를 작성해보세요!
              </p>
            )}
          </div>

          {/* AI ask button */}
          <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-4 text-sm font-medium text-foreground hover:bg-muted">
            <MessageCircle className="size-5" />
            AI에게 이 업체 물어보기
          </button>

          {/* Report */}
          <button
            onClick={() => setShowReport(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <Flag className="size-4" />
            신고하기
          </button>
        </div>
      </div>

      {/* Modals */}
      {showReservation && (
        <ReservationModal vendorName={vendor.name} onClose={() => setShowReservation(false)} />
      )}
      {showPayment && (
        <PaymentModal
          vendorName={vendor.name}
          paymentStep={vendor.paymentStep}
          price={selectedPkg?.price ?? vendor.packages?.[0]?.price ?? 0}
          packageOptions={selectedPkg?.sections?.flatMap(s => s.options ?? [])}
          addons={vendor.addons}
          onClose={() => setShowPayment(false)}
        />
      )}
      {showReview && (
        <ReviewModal
          vendorName={vendor.name}
          onClose={() => setShowReview(false)}
          onSubmit={(r) => { onAddReview(r); setShowReview(false) }}
        />
      )}
      {showReport && (
        <ReportModal vendorName={vendor.name} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}

// ─── Modal Shell ──────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-t-3xl bg-background p-6 shadow-xl sm:rounded-3xl">
        {children}
      </div>
    </div>
  )
}

// ─── Reservation Modal ────────────────────────────────────────────────────

function ReservationModal({ vendorName, onClose }: { vendorName: string; onClose: () => void }) {
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">예약 생성</h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{vendorName}</p>
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">방문 날짜</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">방문 시간</label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">메모</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="상담 내용, 질문 사항 등"
            rows={3}
          />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
        <Button className="flex-1 bg-foreground text-background hover:bg-foreground/90" onClick={onClose}>
          예약 생성
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Payment Modal ────────────────────────────────────────────────────────

function PaymentModal({
  vendorName,
  paymentStep,
  price,
  packageOptions,
  addons,
  onClose,
}: {
  vendorName: string
  paymentStep: number
  price: number
  packageOptions?: VendorPackageOption[]
  addons?: VendorAddon[]
  onClose: () => void
}) {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [selectedMethod, setSelectedMethod] = useState("")

  const isDeposit = paymentStep <= 1

  const optionsTotal = selectedOptions.reduce((sum, name) => {
    const opt = packageOptions?.find(o => o.name === name)
    return sum + (opt?.price ?? 0)
  }, 0)

  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = addons?.find(a => a.id === id)
    return sum + (addon?.price ?? 0)
  }, 0)

  const totalPrice = price + optionsTotal + addonsTotal
  const amount = isDeposit ? Math.round(totalPrice * 0.1) : Math.round(totalPrice * 0.9)

  const toggleOption = (name: string) => {
    setSelectedOptions(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{isDeposit ? "계약금 결제" : "잔금 결제"}</h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{vendorName}</p>

      <div className="overflow-y-auto max-h-[70vh] space-y-5 pr-1">
        {/* 기본 패키지 */}
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">기본 패키지</p>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">기본 금액</span>
            <span className="font-medium">{formatPrice(price)}</span>
          </div>
        </div>

        {/* 야외씬 촬영 옵션 */}
        {packageOptions && packageOptions.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">야외씬 촬영 옵션</p>
            <div className="space-y-2">
              {packageOptions.map((opt) => {
                const checked = selectedOptions.includes(opt.name)
                return (
                  <button
                    key={opt.name}
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => toggleOption(opt.name)}
                  >
                    <div
                      className={`size-5 shrink-0 rounded border-2 flex items-center justify-center ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {checked && <Check className="size-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{opt.name}</span>
                      {opt.note && (
                        <p className="text-xs text-muted-foreground">{opt.note}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground shrink-0">
                      {formatPrice(opt.price)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 추가상품 */}
        {addons && addons.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-foreground">추가상품</p>
            <div className="space-y-2">
              {addons.map((addon) => {
                const checked = selectedAddons.includes(addon.id)
                return (
                  <button
                    key={addon.id}
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => toggleAddon(addon.id)}
                  >
                    <div
                      className={`size-5 shrink-0 rounded border-2 flex items-center justify-center ${
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {checked && <Check className="size-3" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">{addon.name}</span>
                      {addon.description && (
                        <p className="text-xs text-muted-foreground">{addon.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground shrink-0">
                      {formatPrice(addon.price)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* 결제 금액 요약 */}
        <div className="rounded-xl bg-muted p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">기본 패키지</span>
            <span className="font-medium">{formatPrice(price)}</span>
          </div>
          {selectedOptions.map(name => {
            const opt = packageOptions?.find(o => o.name === name)
            if (!opt) return null
            return (
              <div key={name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{opt.name}</span>
                <span className="font-medium">{formatPrice(opt.price)}</span>
              </div>
            )
          })}
          {selectedAddons.map(id => {
            const addon = addons?.find(a => a.id === id)
            if (!addon) return null
            return (
              <div key={id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{addon.name}</span>
                <span className="font-medium">{formatPrice(addon.price)}</span>
              </div>
            )
          })}
          <div className="border-t border-border pt-2 mt-1" />
          <div className="flex justify-between text-sm">
            <span className="font-semibold text-foreground">총 금액</span>
            <span className="font-bold text-foreground">{formatPrice(totalPrice)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{isDeposit ? "계약금 (10%)" : "잔금 (90%)"}</span>
            <span className="text-lg font-bold text-foreground">{formatPrice(amount)}</span>
          </div>
        </div>

        {/* 결제 수단 */}
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">결제 수단</p>
          <div className="space-y-2">
            {["신용카드", "계좌이체", "카카오페이"].map((method) => (
              <button
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                  selectedMethod === method
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {method}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5">
        <Button className="w-full bg-foreground text-background hover:bg-foreground/90" onClick={onClose}>
          {formatPrice(amount)} 결제하기
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Review Modal ─────────────────────────────────────────────────────────

function ReviewModal({
  vendorName,
  onClose,
  onSubmit,
}: {
  vendorName: string
  onClose: () => void
  onSubmit: (review: Omit<VendorReview, "id">) => void
}) {
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState("")

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">리뷰 작성</h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{vendorName}</p>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">별점</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                onMouseEnter={() => setHover(s)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(s)}
              >
                <Star
                  className={`size-8 ${s <= (hover || rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">리뷰 내용</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="업체에 대한 솔직한 리뷰를 작성해주세요"
            rows={4}
          />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
        <Button
          className="flex-1 bg-foreground text-background hover:bg-foreground/90"
          onClick={() =>
            onSubmit({
              authorName: "나",
              rating,
              content: content.trim(),
              date: new Date().toISOString().split("T")[0],
            })
          }
          disabled={!content.trim()}
        >
          리뷰 등록
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Report Modal ─────────────────────────────────────────────────────────

function ReportModal({ vendorName, onClose }: { vendorName: string; onClose: () => void }) {
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const reasons = ["허위 정보", "불법 영업", "불쾌한 경험", "가격 사기", "기타"]

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">업체 신고</h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{vendorName}</p>
      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">신고 사유</label>
          <div className="flex flex-wrap gap-2">
            {reasons.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className={`rounded-full border px-3 py-1.5 text-sm ${
                  reason === r
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">상세 내용</label>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="신고 내용을 자세히 작성해주세요"
            rows={3}
          />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
        <Button
          className="flex-1 bg-red-500 text-white hover:bg-red-600"
          onClick={onClose}
          disabled={!reason}
        >
          신고 제출
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Share Modal ──────────────────────────────────────────────────────────

function ShareModal({ vendor, onClose, onShareVendor }: {
  vendor: Vendor
  onClose: () => void
  onShareVendor?: (v: Vendor) => void
}) {
  const [copied, setCopied] = useState(false)
  const [shared, setShared] = useState(false)
  const shareText = `[업체 공유] ${vendor.name}\n📍 ${vendor.address}\n💰 ${vendor.price}\n⭐ ${vendor.rating}`

  const handleShareToCouple = () => {
    onShareVendor?.(vendor)
    onClose()
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">커플 방에 공유하기</h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <div className="mb-5 rounded-xl bg-muted p-4">
        <p className="whitespace-pre-line text-sm text-foreground">{shareText}</p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => {
            navigator.clipboard.writeText(shareText)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          }}
        >
          {copied ? (
            <><Check className="mr-2 size-4" />복사됨</>
          ) : (
            <><Copy className="mr-2 size-4" />링크 복사</>
          )}
        </Button>
        <Button
          className="flex-1 bg-foreground text-background hover:bg-foreground/90"
          onClick={handleShareToCouple}
        >
          {shared ? (
            <><Check className="mr-2 size-4" />공유됨!</>
          ) : (
            <><Send className="mr-2 size-4" />커플 방에 공유</>
          )}
        </Button>
      </div>
    </ModalShell>
  )
}
