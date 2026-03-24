"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  ArrowLeft, Star, Heart, Share2, MapPin, Clock, Phone,
  Navigation, Car, Building2, Flag, ChevronDown, ChevronUp,
  MessageCircle, Copy, Check, Search, Send, X, Sparkles, Lock, CalendarCheck, CreditCard,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { fetchVendorDetail } from "@/lib/api/vendor-detail"
import { buildVendorListEndpoint } from "@/lib/api/endpoints"
import {createReservation, createReview, getBookedTimes, getCards, requestPayment, reportVendor, type AiRecommendation} from "@/lib/api"

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
  id: string | null  // null = 크롤링 리뷰, string = 사용자 작성 리뷰
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
  rentalPrice: number | null
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
  paymentStep: 0 | 1 | 2 | 3 | 4 | 5
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
  scheduleSlots?: string[]
  closedDays?: string
}

// ─── Constants ────────────────────────────────────────────────────────────

const PAYMENT_STEPS = [
  { step: 1, label: "계약금 10% 납입 완료" },
  { step: 2, label: "서비스 진행중" },
  { step: 3, label: "잔금 90% 납입 완료" },
  { step: 4, label: "서비스 완료" },
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
  price?: number | null
  rating: number | null
  reviewCount?: number
  imageUrl?: string | null
  hashtags?: string[]
  description?: string | null
}

interface VendorListPage {
  items?: VendorListItem[]
  content?: VendorListItem[]
  nextCursor?: string | null
  hasNext?: boolean
}

interface VendorListEnvelope {
  status?: number
  message?: string
  data?: VendorListPage | VendorListItem[]
  items?: VendorListItem[]
  content?: VendorListItem[]
  nextCursor?: string | null
}

function parseListResponse(json: VendorListEnvelope): { items: VendorListItem[]; nextCursor: string | null } {
  // { status, message, data: { items: [...], nextCursor } }
  if (json.data && !Array.isArray(json.data)) {
    const page = json.data as VendorListPage
    return { items: page.items ?? page.content ?? [], nextCursor: page.nextCursor ?? null }
  }
  if (Array.isArray(json.data)) {
    return { items: json.data, nextCursor: json.nextCursor ?? null }
  }
  return { items: json.items ?? json.content ?? [], nextCursor: json.nextCursor ?? null }
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
    reviewCount: item.reviewCount ?? 0,
    paymentStep: 0,
    price: item.price != null ? `${item.price.toLocaleString("ko-KR")}원` : "문의",
    isFavorite: false,
    coverUrl: item.imageUrl ?? undefined,
    logoUrl: item.imageUrl ?? undefined,
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

export function VendorsView({ onShareVendor, onAddToVote, currentUser, onFavoriteChange, initialVendorId, favoriteVendorIds, aiRecommendations }: {
  onShareVendor?: (vendor: Vendor) => void
  onAddToVote?: (vendor: Vendor) => void
  currentUser?: "groom" | "bride"
  onFavoriteChange?: (vendor: Vendor, isFavorite: boolean) => void
  initialVendorId?: string | null
  favoriteVendorIds?: string[]
  aiRecommendations?: AiRecommendation[]
}) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("all")
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAiOnly, setShowAiOnly] = useState(false)
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

  // 검색어 디바운스
  const [debouncedSearch, setDebouncedSearch] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // 카테고리/검색어 변경 시 업체 목록 재조회
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      setVendors([])
      setNextCursor(null)
      try {
        const apiCategory = API_CATEGORY_MAP[selectedCategory]
        const url = buildVendorListEndpoint({
          size: VENDOR_PAGE_SIZE,
          ...(apiCategory ? { category: apiCategory } : {}),
          ...(debouncedSearch ? { keyword: debouncedSearch } : {}),
        })
        const res = await fetch(url, { credentials: "include" })
        if (!res.ok) {
          console.error("업체 목록 조회 실패:", res.status, res.statusText)
          return
        }
        const json = (await res.json()) as VendorListEnvelope
        const { items, nextCursor: cursor } = parseListResponse(json)
        if (!cancelled) {
          const mapped = items.map(mapListItemToVendor).map((v) => ({
            ...v,
            isFavorite: favoriteVendorIds?.includes(v.id) ?? false,
          }))
          const deduped = mapped.filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
          // 결제 현황 반영: 실제 결제가 있는 업체만 paymentStep 업데이트
          import("@/lib/api").then(({ getPayments }) => {
            getPayments()
              .then((payRes) => {
                const paymentMap: Record<string, number> = {}
                payRes.data.forEach((p: any) => {
                  if (p.status !== "DONE") return
                  const vid = String(p.vendorId)
                  if (p.type === "BALANCE") {
                    paymentMap[vid] = Math.max(paymentMap[vid] ?? 0, 3) // 잔금 완료
                  } else if (p.type === "DEPOSIT") {
                    paymentMap[vid] = Math.max(paymentMap[vid] ?? 0, 1) // 계약금 완료 → 서비스 진행중
                  }
                })
                if (!cancelled) {
                  setVendors(deduped.map((v) =>
                    paymentMap[v.id] != null ? { ...v, paymentStep: paymentMap[v.id] as Vendor["paymentStep"] } : v
                  ))
                }
              })
              .catch(() => { if (!cancelled) setVendors(deduped) })
          }).catch(() => { if (!cancelled) setVendors(deduped) })
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
  }, [selectedCategory, debouncedSearch])

  // 무한 스크롤
  useEffect(() => {
    const el = loadMoreRef.current
    if (!el || !nextCursor || isFetchingMore || searchQuery.trim()) return
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
            setVendors((prev) => {
              const existingIds = new Set(prev.map((v) => v.id))
              const newItems = items.map(mapListItemToVendor).filter((v) => !existingIds.has(v.id))
              return [...prev, ...newItems]
            })
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
      if (v) {
        openVendorDetail(v)
      } else {
        // AI 추천 카드에서 온 ID는 sourceId → /source/{sourceId}로 조회
        const isSourceId = Number(initialVendorId) >= 1_000_000
        if (isSourceId) {
          import("@/lib/api/vendor-detail").then(({ fetchVendorDetailBySource }) => {
            fetchVendorDetailBySource(initialVendorId)
              .then((detail) => setSelectedVendor(detail))
              .catch(() => {
                // sourceId 조회 실패 시 일반 조회 시도
                fetchVendorDetail(initialVendorId)
                  .then((detail) => setSelectedVendor(detail))
                  .catch(() => {})
              })
          })
        } else {
          fetchVendorDetail(initialVendorId)
            .then((detail) => setSelectedVendor(detail))
            .catch(() => {})
        }
      }
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

  // AI 추천 업체를 Vendor 형식으로 변환 (중복 제거, 최신순)
  const aiVendors: Vendor[] = (() => {
    if (!aiRecommendations?.length) return []
    const catMap: Record<string, Vendor["category"]> = {
      studio: "studio", dress: "dress", makeup: "makeup", venue: "venue",
    }
    const seen = new Set<string>()
    const result: Vendor[] = []
    // 역순으로 순회해서 최신 추천이 앞에 오도록
    for (let i = aiRecommendations.length - 1; i >= 0; i--) {
      const rec = aiRecommendations[i]
      const key = rec.name
      if (!key || seen.has(key)) continue
      seen.add(key)
      result.push({
        id: rec.id != null ? String(rec.id) : `ai-${i}`,
        category: catMap[rec.category] ?? "studio",
        name: rec.name,
        tags: rec.hashtags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [],
        description: rec.description ?? "",
        contact: rec.contact ?? "문의 필요",
        address: "주소 정보 없음",
        rating: rec.rating != null ? Number((rec.rating / 20).toFixed(1)) : 0,
        reviewCount: rec.reviewCount ?? 0,
        paymentStep: 0,
        price: rec.price != null ? `${rec.price.toLocaleString("ko-KR")}원` : "문의",
        isFavorite: favoriteVendorIds?.includes(String(rec.id)) ?? false,
        coverUrl: rec.imageUrl ?? undefined,
        logoUrl: rec.imageUrl ?? undefined,
      })
    }
    return result
  })()

  const filtered = (showAiOnly ? aiVendors : vendors).filter((v) => {
    const catOk = selectedCategory === "all" || v.category === selectedCategory
    const styleOk = !selectedStyle || (v.styleFilter?.includes(selectedStyle) ?? false)
    return catOk && styleOk
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


  if (selectedVendor) {
    return (
      <VendorDetailView
        vendor={selectedVendor}
        onBack={() => { detailAbortRef.current?.abort(); setSelectedVendor(null) }}
        onToggleFavorite={() => toggleFavorite(selectedVendor.id)}
        onShareVendor={onShareVendor}
        onAddToVote={onAddToVote}
        isLoading={isDetailLoading}
      />
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background">
        <div className="mx-auto w-full max-w-4xl px-4 pt-6">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">업체</h1>
              <p className="mt-1 text-muted-foreground">AI가 엄선한 최고의 웨딩 업체</p>
            </div>
            {(aiRecommendations?.length ?? 0) > 0 && (
              <button
                onClick={() => setShowAiOnly(!showAiOnly)}
                className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  showAiOnly
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-card text-muted-foreground hover:bg-secondary"
                }`}
              >
                <Sparkles className="size-4" />
                AI추천
                <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold ${
                  showAiOnly ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
                }`}>
                  {aiVendors.length}
                </span>
              </button>
            )}
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
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 pb-6">
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
        <div className="relative mb-6 mt-4">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="업체명으로 검색..."
            className="h-12 rounded-xl bg-card pl-12 text-base"
          />
        </div>

        {/* Card Grid */}
        {isLoading && !showAiOnly ? (
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
                <div className="flex flex-col items-center gap-2">
                  {showAiOnly ? (
                    <>
                      <Sparkles className="size-8 text-muted-foreground/40" />
                      <p className="text-muted-foreground">AI 추천 업체가 없습니다</p>
                      <p className="text-sm text-muted-foreground/60">채팅에서 업체를 추천받으면 여기에 누적됩니다</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">해당 카테고리에 업체가 없습니다</p>
                  )}
                </div>
              </div>
            )}
            {!showAiOnly && (
              <>
                <div ref={loadMoreRef} className="h-4" />
                {isFetchingMore && (
                  <div className="py-4 text-center text-sm text-muted-foreground">더 불러오는 중...</div>
                )}
              </>
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
      coverUrl: vendor.coverUrl,
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
      {/* Image */}
      <div className="relative h-52 bg-[#f0eaf2]">
        {vendor.coverUrl
          ? <img src={vendor.coverUrl} alt={vendor.name} className="h-full w-full object-cover" />
          : <div className="flex h-full items-center justify-center text-sm text-muted-foreground/40">{catLabel}</div>
        }
        {stepLabel && (
          <div className="absolute inset-x-3 top-3 flex items-center justify-end">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${stepBadgeStyle(vendor.paymentStep)}`}>
              {stepLabel}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-foreground">{vendor.name}</h3>
        <div className="mt-1 flex items-center gap-1 text-sm">
          <Star className="size-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-foreground">{vendor.rating}</span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          {vendor.tags.slice(0, 3).map((tag, i) => (
            <span key={`${tag}-${i}`} className="text-xs text-muted-foreground">
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
  onShareVendor,
  onAddToVote,
  isLoading = false,
}: {
  vendor: Vendor
  onBack: () => void
  onToggleFavorite: () => void
  onShareVendor?: (v: Vendor) => void
  onAddToVote?: (v: Vendor) => void
  isLoading?: boolean
}) {
  const [selectedPkgId, setSelectedPkgId] = useState(vendor.packages?.[0]?.id ?? "")
  const [selectedHallId, setSelectedHallId] = useState(vendor.halls?.[0]?.id ?? 0)
  const [showAddons, setShowAddons] = useState(false)
  const [showReservation, setShowReservation] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [voteAdded, setVoteAdded] = useState(false)
  const [addrCopied, setAddrCopied] = useState(false)
  const [reviewPage, setReviewPage] = useState(5)
  const [reviews, setReviews] = useState<VendorReview[]>(vendor.reviews ?? [])
  const [currentPaymentStep, setCurrentPaymentStep] = useState<number>(vendor.paymentStep)
  const [reservationDate, setReservationDate] = useState<string | null>(null)
  const [hasUsedBefore, setHasUsedBefore] = useState(false)
  const vendorId = vendor.id

  // 업체의 결제 진행상태 + 예약 정보 조회
  useEffect(() => {
    import("@/lib/api").then(({ getVendorPayments, getReservations }) => {
      getVendorPayments(Number(vendorId))
        .then((res) => {
          const payments = res.data
          const hasDeposit = payments.some((p: any) => p.type === "DEPOSIT" && p.status === "DONE")
          const hasBalance = payments.some((p: any) => p.type === "BALANCE" && p.status === "DONE")
          if (hasBalance) {
            // 잔금까지 결제 완료 → 이용완료 처리
            setCurrentPaymentStep(1)
            setHasUsedBefore(true)
          } else if (hasDeposit) {
            setCurrentPaymentStep(2) // 서비스 진행중
          } else {
            setCurrentPaymentStep(1)
          }
        })
        .catch(() => {})

      // 예약일 조회 (잔금 결제 가능 여부 판단용)
      getReservations()
        .then((res) => {
          const vid = Number(vendorId)
          const existing = res.data.find((r: any) =>
            Number(r.vendorId) === vid && r.status !== "CANCELLED"
          )
          if (existing) {
            const d = (existing.reservationDate || existing.serviceDate || "").substring(0, 10)
            if (d) setReservationDate(d)
          }
        })
        .catch(() => {})
    })
  }, [vendorId])

  // vendor prop이 바뀔 때(fetchVendorDetail 완료 후) reviews 동기화
  useEffect(() => {
    if (vendor.reviews && vendor.reviews.length > 0) {
      setReviews(vendor.reviews)
      setReviewPage(5)
    }
  }, [vendor.id, vendor.reviews])

  const fetchReviews = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/vendors/${vendorId}/reviews`, { signal })
      if (!res.ok) return
      const json = await res.json() as { status?: number; data?: unknown[] } | unknown[]
      const items = Array.isArray(json) ? json : ((json as { data?: unknown[] }).data ?? [])
      setReviews((items as Array<{
        id: number | null
        rating: number
        authorName: string | null
        content: string
        reviewedAt: string | null
      }>).map((r, i) => ({
        id: r.id != null ? String(r.id) : `crawled-${i}`,
        authorName: r.authorName ?? "익명",
        rating: r.rating,
        content: r.content,
        date: r.reviewedAt?.split(" ")?.[0] ?? "",
      })))
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      // 실패 시 기존 리뷰 유지
    }
  }, [vendorId])

  useEffect(() => {
    const controller = new AbortController()
    void fetchReviews(controller.signal)
    return () => controller.abort()
  }, [fetchReviews])

  const selectedPkg = vendor.packages?.find((p) => p.id === selectedPkgId)
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
              <div className="flex items-center gap-2">
                {hasUsedBefore && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                    이용 완료
                  </span>
                )}
              <div className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5">
                <Star className="size-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold">{vendor.rating}</span>
              </div>
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

          {/* Payment progress - 계약금 결제 후에만 표시 */}
          {(currentPaymentStep >= 2 && !hasUsedBefore) && (
          <div className="mt-5 rounded-2xl bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">결제 진행 상태</h2>
              {hasUsedBefore && (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  이용 완료
                </span>
              )}
            </div>
            <div className="flex flex-col">
              {PAYMENT_STEPS.map((s, idx) => {
                const done = s.step < currentPaymentStep
                const current = s.step === currentPaymentStep
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

            {/* 잔금 결제 버튼 - 계약금 결제 후 & 이용완료 아닐 때만 */}
            {currentPaymentStep >= 2 && !hasUsedBefore && (() => {
              const today = new Date().toISOString().substring(0, 10)
              const canPayBalance = reservationDate && today >= reservationDate
              return (
                <div className="mt-3">
                  {canPayBalance ? (
                    <Button
                      onClick={() => setShowReservation(true)}
                      className="w-full bg-foreground text-background hover:bg-foreground/90"
                    >
                      잔금 결제
                    </Button>
                  ) : (
                    <Button disabled className="w-full opacity-50 cursor-not-allowed">
                      잔금 결제 ({reservationDate ? (() => { const [,m,d] = reservationDate.split("-"); return `${Number(m)}월 ${Number(d)}일` })() : "예약일"} 이후 가능)
                    </Button>
                  )}
                </div>
              )
            })()}
          </div>
          )}

          {/* Action buttons */}
          <div className="mt-5 flex gap-2">
            {(currentPaymentStep < 2 || hasUsedBefore) && (
              <Button
                onClick={() => setShowReservation(true)}
                className="flex-1 bg-foreground text-background hover:bg-foreground/90"
              >
                예약 및 계약금 결제
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

          {/* Packages */}
          {vendor.packages && vendor.packages.length > 0 && (
            <div className="mt-5 rounded-2xl bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">용도별 패키지</h2>

              {vendor.packages.length > 1 && (
                <div className="mb-4">
                  <div className="relative">
                    <select
                      value={selectedPkgId ?? ""}
                      onChange={(e) => setSelectedPkgId(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-border bg-muted px-4 py-2.5 pr-9 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {vendor.packages.map((pkg) => (
                        <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <svg className="size-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                  <p className="mt-1.5 text-right text-xs text-muted-foreground">
                    {vendor.packages.findIndex(p => p.id === selectedPkgId) + 1} / {vendor.packages.length}개 패키지
                  </p>
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
                  {selectedHall.rentalPrice !== null && selectedHall.rentalPrice > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">대관료</span>
                      <span className="font-semibold text-foreground">{selectedHall.rentalPrice.toLocaleString("ko-KR")}원</span>
                    </div>
                  )}
                  {selectedHall.mealPrice !== null && selectedHall.mealPrice > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">식대</span>
                      <span className="font-semibold text-foreground">{selectedHall.mealPrice.toLocaleString("ko-KR")}원</span>
                    </div>
                  )}
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
                      <span className="text-foreground">{selectedHall.mealType}</span>
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
                {reviews.slice(0, reviewPage).map((review, i) => (
                  <div key={review.id ?? `review-${i}`} className="border-t border-border pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{review.authorName}</span>
                      <span className="text-xs text-muted-foreground">{review.date}</span>
                    </div>
                    <div className="mt-1 flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`size-4 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground">{review.content}</p>
                  </div>
                ))}
                {reviewPage < reviews.length && (
                  <button
                    onClick={() => setReviewPage((p) => p + 5)}
                    className="mt-2 w-full rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-muted"
                  >
                    더보기 ({reviews.length - reviewPage}개 남음)
                  </button>
                )}
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
        <ReservationModal vendorId={vendor.id} vendorName={vendor.name} vendorCategory={vendor.category} vendorScheduleSlots={vendor.scheduleSlots} vendorClosedDays={vendor.closedDays} packages={vendor.packages} addons={vendor.addons} halls={vendor.halls} paymentStep={currentPaymentStep} onClose={() => setShowReservation(false)} onPaymentComplete={(step, paymentDate) => {
          if (paymentDate) setReservationDate(paymentDate)
          if (step >= 4) {
            setCurrentPaymentStep(1)
            setHasUsedBefore(true)
          } else {
            setCurrentPaymentStep(step as 1 | 2 | 3 | 4 | 5)
            setHasUsedBefore(false)
          }
        }} />
      )}
{showReview && (
        <ReviewModal
          vendorId={vendor.id}
          vendorName={vendor.name}
          onClose={() => setShowReview(false)}
          onSuccess={(newReview) => {
            setShowReview(false)
            setReviews((prev) => [newReview, ...prev])
          }}
        />
      )}
      {showReport && (
        <ReportModal vendorId={vendor.id} vendorName={vendor.name} onClose={() => setShowReport(false)} />
      )}
    </div>
  )
}

// ─── Modal Shell ──────────────────────────────────────────────────────────

function ModalShell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-6 shadow-xl sm:rounded-3xl">
        {children}
      </div>
    </div>
  )
}

// ─── Reservation Modal ────────────────────────────────────────────────────

function ReservationModal({ vendorId, vendorName, vendorCategory, vendorScheduleSlots, vendorClosedDays, packages, addons, halls, paymentStep, onClose, onPaymentComplete }: {
  vendorId: string; vendorName: string; vendorCategory?: string
  vendorScheduleSlots?: string[]; vendorClosedDays?: string
  packages?: VendorPackage[]; addons?: VendorAddon[]; halls?: VendorHall[]
  paymentStep?: number; onClose: () => void; onPaymentComplete?: (step: number, date?: string) => void
}) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [time, setTime] = useState("")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [step, setStep] = useState<"schedule" | "package" | "payment" | "done">((paymentStep ?? 1) >= 2 ? "payment" : "schedule")
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null)
  const [selectedHallId, setSelectedHallId] = useState<number | null>(null)
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [selectedMethod, setSelectedMethod] = useState("")
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null)
  const [cards, setCards] = useState<{ id: number; cardBrand: string; cardLast4: string }[]>([])
  const [loadingCards, setLoadingCards] = useState(false)
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)
  const [reservationId, setReservationId] = useState<number | null>(null)
  const [paidDepositAmount, setPaidDepositAmount] = useState(0)
  const [showConfirm, setShowConfirm] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }
  const date = selectedDate ? formatDateStr(selectedDate) : ""

  const DAY_MAP: Record<string, number> = { "일": 0, "월": 1, "화": 2, "수": 3, "목": 4, "금": 5, "토": 6 }
  const closedDayNums = (vendorClosedDays ?? "")
    .split(/[,，/·\s]+/)
    .map((d) => DAY_MAP[d.trim()])
    .filter((n) => n !== undefined)

  const disabledDays = [
    { before: today },
    ...(closedDayNums.length > 0 ? [{ dayOfWeek: closedDayNums }] : []),
  ]

  const TIME_SLOTS_BY_CATEGORY: Record<string, string[]> = {
    venue: ["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"],
    studio: ["09:00", "12:00", "15:00"],
    dress: ["10:00", "12:00", "14:00", "16:00", "18:00"],
    makeup: ["10:00", "12:00", "14:00", "16:00", "18:00"],
  }
  const timeSlots = (vendorScheduleSlots && vendorScheduleSlots.length > 0)
    ? vendorScheduleSlots
    : (TIME_SLOTS_BY_CATEGORY[vendorCategory ?? ""] || TIME_SLOTS_BY_CATEGORY.venue)

  const handleDateSelect = async (day: Date | undefined) => {
    setTime("")
    if (!day) { setSelectedDate(undefined); return }
    setSelectedDate(day)
    const dateStr = formatDateStr(day)
    setLoadingTimes(true)
    try {
      const res = await getBookedTimes(Number(vendorId), dateStr)
      setBookedTimes(res.data)
    } catch {
      setBookedTimes([])
    } finally {
      setLoadingTimes(false)
    }
  }

  const isVenue = vendorCategory === "venue"
  const [isBalancePayment] = useState((paymentStep ?? 1) >= 2)
  const hasMultipleChoices = isVenue
    ? (halls && halls.length > 1)
    : (packages && packages.length > 1)

  // 잔금 결제면 바로 카드 로드 + 기존 예약/결제 정보 조회
  useEffect(() => {
    if (isBalancePayment) {
      loadCards()
      import("@/lib/api").then(({ getVendorPayments, getReservations }) => {
        // 기존 계약금 금액 조회
        getVendorPayments(Number(vendorId))
          .then((res) => {
            const deposit = res.data.find((p: any) => p.type === "DEPOSIT" && p.status === "DONE")
            if (deposit) setPaidDepositAmount(deposit.amount)
          })
          .catch(() => {})
        // 기존 예약 정보 조회 (날짜, 시간)
        getReservations()
          .then((res) => {
            const existing = res.data.find((r: any) => String(r.vendorId) === vendorId && r.status !== "CANCELLED")
            if (existing) {
              if (existing.reservationDate) {
                const [y, m, d] = existing.reservationDate.split("-").map(Number)
                setSelectedDate(new Date(y, m - 1, d))
              }
              if (existing.reservationTime) setTime(existing.reservationTime.substring(0, 5))
              if (existing.memo) setNotes(existing.memo)
            }
          })
          .catch(() => {})
      })
    }
  }, [])

  // 카드 목록 불러오기
  const loadCards = async () => {
    setLoadingCards(true)
    try {
      const res = await getCards()
      setCards(res.data)
      if (res.data.length > 0) setSelectedCardId(res.data[0].id)
    } catch {}
    setLoadingCards(false)
  }

  // 계약금 결제 버튼 클릭 → 선택 또는 결제 화면으로
  const handleDepositClick = () => {
    if (!date || !time) return
    if (hasMultipleChoices) {
      setStep("package")
    } else {
      if (isVenue && halls && halls.length === 1) setSelectedHallId(halls[0].id)
      if (!isVenue && packages && packages.length === 1) setSelectedPkgId(packages[0].id)
      loadCards()
      setStep("payment")
    }
  }

  // 선택 후 → 결제 화면으로
  const handlePackageNext = () => {
    if (isVenue && !selectedHallId) return
    if (!isVenue && !selectedPkgId) return
    loadCards()
    setStep("payment")
  }


  // 최종 결제 (계약금: 예약 생성 → 결제 / 잔금: 기존 예약으로 결제)
  const handlePayment = async () => {
    if (!selectedCardId || isSubmitting) return
    if (!isBalancePayment && (!date || !time)) return
    setIsSubmitting(true)
    try {
      let targetReservationId: number

      if (isBalancePayment) {
        // 잔금 결제: 기존 예약 조회
        const { getReservations } = await import("@/lib/api")
        const resAll = await getReservations()
        const existing = resAll.data.find((r: any) => String(r.vendorId) === vendorId && r.status !== "CANCELLED")
        if (!existing) throw new Error("예약 정보를 찾을 수 없습니다.")
        targetReservationId = existing.id
      } else {
        // 계약금 결제: 새 예약 생성
        const resReservation = await createReservation(Number(vendorId), {
          reservationDate: date,
          serviceDate: date,
          reservationTime: time,
          memo: notes || undefined,
        })
        targetReservationId = (resReservation.data as any)?.id ?? resReservation.data
      }

      // 결제 요청
      await requestPayment({
        reservationId: targetReservationId,
        cardId: selectedCardId,
        type: isBalancePayment ? "BALANCE" : "DEPOSIT",
        amount: isBalancePayment ? balanceAmount : depositAmount,
      })

      onPaymentComplete?.(isBalancePayment ? 4 : 2, date || undefined)
      setStep("done")
      setTimeout(onClose, 2000)
    } catch (err: any) {
      alert(err.message || "결제에 실패했습니다.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedPkg = packages?.find(p => p.id === selectedPkgId)
  const selectedHall = halls?.find(h => h.id === selectedHallId)

  // 가격 계산: venue는 홀 대관료, 나머지는 패키지 가격
  const basePrice = isVenue
    ? (selectedHall?.rentalPrice ?? 0)
    : (selectedPkg?.price ?? 0)

  const addonsTotal = selectedAddons.reduce((sum, id) => {
    const addon = addons?.find(a => a.id === id)
    return sum + (addon?.price ?? 0)
  }, 0)

  const totalPrice = basePrice + addonsTotal
  const depositAmount = Math.round(totalPrice * 0.1)
  // 잔금: 기존 계약금에서 총액 역산 (계약금 = 총액 * 10%)
  const balanceAmount = isBalancePayment && paidDepositAmount > 0
    ? paidDepositAmount * 9  // 계약금의 9배 = 잔금(90%)
    : Math.round(totalPrice * 0.9)

  const toggleAddon = (id: string) => {
    setSelectedAddons(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">
          {step === "payment" ? (isBalancePayment ? "잔금 결제" : "계약금 결제") : step === "package" ? (isVenue ? "홀 선택" : "패키지 선택") : "예약 생성"}
        </h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{vendorName}</p>

      {step === "done" ? (
        <div className="py-8 text-center">
          <CalendarCheck className="mx-auto size-12 text-primary mb-3" />
          <p className="text-lg font-semibold text-foreground">
            {isBalancePayment ? "잔금 결제가 완료되었습니다!" : "계약금 결제가 완료되었습니다!"}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">{date} {time}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBalancePayment
              ? `잔금 ${formatPrice(balanceAmount)}`
              : (selectedPkg || selectedHall)
                ? `${isVenue ? selectedHall?.name : selectedPkg?.name} · 계약금 ${formatPrice(depositAmount)}`
                : ""
            }
          </p>
        </div>
      ) : step === "payment" ? (
        <>
          <div className="space-y-4">

            {/* 주문 정보 */}
            <div className="rounded-xl bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">주문 정보</p>

              {/* 선택 상품 */}
              {!isBalancePayment && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-background">
                      <Building2 className="size-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{isVenue ? (selectedHall?.name ?? "선택 없음") : (selectedPkg?.name ?? "기본 패키지")}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{basePrice ? formatPrice(basePrice) : "가격 문의"}</span>
                </div>
              )}

              {/* 예약 일시 */}
              {(date || time) && (
                <div className="flex items-center gap-2 text-sm">
                  <CalendarCheck className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{date}</span>
                  {time && <span className="text-muted-foreground">{time}</span>}
                </div>
              )}
            </div>

            {/* 예약 정보 */}
            <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">예약일</span>
                <span className="font-medium text-foreground">{date}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">시간</span>
                <span className="font-medium text-foreground">{time}</span>
              </div>
              {notes && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">메모</span>
                  <span className="font-medium text-foreground truncate max-w-[200px]">{notes}</span>
                </div>
              )}
            </div>

            {/* 결제 금액 */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="bg-muted/30 px-4 py-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">결제 금액</p>
              </div>
              <div className="p-4 space-y-2.5">
                {isBalancePayment ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">총 서비스 금액</span>
                      <span className="font-medium">{paidDepositAmount > 0 ? formatPrice(paidDepositAmount * 10) : "—"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">납입 계약금</span>
                      <span className="font-medium text-emerald-600">-{formatPrice(paidDepositAmount)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">서비스 금액</span>
                      <span className="font-medium">{formatPrice(totalPrice)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">계약금 비율</span>
                      <span className="font-medium">10%</span>
                    </div>
                  </>
                )}
                <div className="border-t border-border pt-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground">결제할 금액</span>
                    <span className="text-xl font-bold text-primary">{formatPrice(isBalancePayment ? balanceAmount : depositAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 결제 수단 */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">결제 수단</p>
              {loadingCards ? (
                <p className="py-4 text-center text-sm text-muted-foreground">카드 정보 불러오는 중...</p>
              ) : cards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <CreditCard className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground mb-1">등록된 카드가 없습니다</p>
                  <p className="text-xs text-muted-foreground mb-3">결제하려면 카드를 먼저 등록해주세요</p>
                  <button
                    onClick={async () => {
                      try {
                        const { getTossClientKey } = await import("@/lib/api")
                        const keyRes = await getTossClientKey()
                        const clientKey = keyRes.data.clientKey
                        const customerKey = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8)
                        const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk")
                        const toss = await loadTossPayments(clientKey)
                        const payment = toss.payment({ customerKey })
                        await payment.requestBillingAuth({
                          method: "CARD",
                          successUrl: window.location.origin + "/cards/success",
                          failUrl: window.location.origin + "/cards/fail",
                        })
                      } catch {}
                    }}
                    className="rounded-lg bg-foreground px-4 py-2 text-xs font-medium text-background hover:bg-foreground/90"
                  >
                    카드 등록하기
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {cards.map((card) => {
                    const BRANDS: Record<string, string> = {
                      "11": "KB국민", "41": "신한", "51": "삼성", "21": "하나", "61": "현대",
                      "33": "우리", "W1": "우리", "71": "롯데", "91": "NH농협", "31": "BC",
                      "15": "카카오뱅크", "24": "토스뱅크", "3A": "케이뱅크",
                    }
                    const BRAND_COLORS: Record<string, string> = {
                      "11": "from-amber-400 to-amber-600", "41": "from-blue-400 to-blue-600",
                      "51": "from-blue-500 to-indigo-700", "21": "from-teal-400 to-teal-600",
                      "61": "from-gray-700 to-gray-900", "33": "from-sky-400 to-sky-600",
                      "W1": "from-sky-400 to-sky-600", "71": "from-red-400 to-red-600",
                      "91": "from-green-500 to-green-700", "31": "from-rose-400 to-rose-600",
                      "15": "from-yellow-300 to-yellow-500", "24": "from-blue-300 to-blue-500",
                    }
                    const brandName = BRANDS[card.cardBrand] || card.cardBrand || "카드"
                    const brandColor = BRAND_COLORS[card.cardBrand] || "from-slate-500 to-slate-700"
                    const selected = selectedCardId === card.id
                    return (
                      <button
                        key={card.id}
                        onClick={() => setSelectedCardId(card.id)}
                        className={`flex w-full items-center gap-3.5 rounded-xl border-2 px-3.5 py-3 text-left transition-all ${
                          selected
                            ? "border-primary shadow-sm"
                            : "border-transparent bg-muted/40 hover:bg-muted/60"
                        }`}
                      >
                        {/* 미니 카드 */}
                        <div className={`relative h-10 w-14 shrink-0 rounded-lg bg-gradient-to-br ${brandColor} p-1.5 shadow-sm`}>
                          <div className="absolute top-1.5 left-1.5 size-2.5 rounded-sm bg-yellow-200/70" />
                          <div className="absolute bottom-1.5 right-1.5 flex gap-0.5">
                            <div className="size-2 rounded-full bg-white/40" />
                            <div className="size-2 rounded-full bg-white/25 -ml-1" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground">{brandName}</p>
                          <p className="text-xs text-muted-foreground">{card.cardLast4}</p>
                        </div>
                        <div className={`flex size-5 items-center justify-center rounded-full border-2 transition-colors ${
                          selected ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}>
                          {selected && <Check className="size-3 text-primary-foreground" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <Button
              className="w-full h-12 rounded-xl bg-foreground text-background hover:bg-foreground/90 text-base font-semibold"
              onClick={() => setShowConfirm(true)}
              disabled={!selectedCardId || cards.length === 0 || isSubmitting}
            >
              {isSubmitting ? "결제 중..." : `${formatPrice(isBalancePayment ? balanceAmount : depositAmount)} 결제하기`}
            </Button>
            <Button variant="ghost" className="w-full h-9 text-sm text-muted-foreground" onClick={() => {
              if (packages && packages.length > 1) setStep("package")
              else setStep("schedule")
            }}>이전으로 돌아가기</Button>
          </div>

          {/* 결제 확인 모달 */}
          {showConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={() => setShowConfirm(false)}>
              <div className="mx-4 w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-foreground text-center mb-2">결제 확인</h3>
                <p className="text-sm text-muted-foreground text-center mb-1">
                  {isBalancePayment ? "잔금" : "계약금"} 결제를 진행하시겠습니까?
                </p>
                <p className="text-2xl font-bold text-foreground text-center mb-1">
                  {formatPrice(isBalancePayment ? balanceAmount : depositAmount)}
                </p>
                <p className="text-xs text-muted-foreground text-center mb-5">
                  {cards.find(c => c.id === selectedCardId)?.cardBrand || "카드"} •••• {cards.find(c => c.id === selectedCardId)?.cardLast4}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setShowConfirm(false)}>
                    취소
                  </Button>
                  <Button
                    className="flex-1 h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90"
                    onClick={() => { setShowConfirm(false); handlePayment() }}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "결제 중..." : "결제하기"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : step === "package" ? (
        <>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isVenue ? "예약할 홀을 선택해주세요" : "결제할 패키지를 선택해주세요"}
            </p>
            {isVenue ? halls?.map((hall) => (
              <button
                key={hall.id}
                onClick={() => setSelectedHallId(hall.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selectedHallId === hall.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{hall.name}</span>
                  <span className="font-bold text-foreground">{hall.rentalPrice ? formatPrice(hall.rentalPrice) : "가격 문의"}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {hall.guestMin != null && hall.guestMax != null && (
                    <span>수용 {hall.guestMin}~{hall.guestMax}명</span>
                  )}
                  {hall.hallType && <span>{hall.hallType}</span>}
                  {hall.mealType && <span>{hall.mealType}</span>}
                  {hall.mealPrice != null && <span>식대 {formatPrice(hall.mealPrice)}</span>}
                </div>
              </button>
            )) : packages?.map((pkg) => (
              <button
                key={pkg.id}
                onClick={() => setSelectedPkgId(pkg.id)}
                className={`w-full rounded-xl border p-4 text-left transition-all ${
                  selectedPkgId === pkg.id
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{pkg.name}</span>
                  <span className="font-bold text-foreground">{pkg.price ? formatPrice(pkg.price) : "가격 문의"}</span>
                </div>
                {pkg.mainItems && pkg.mainItems.length > 0 && (
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                    {pkg.mainItems.map(i => i.name).join(" · ")}
                  </p>
                )}
              </button>
            ))}
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setStep("schedule")}>이전</Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90"
              onClick={handlePackageNext}
              disabled={isVenue ? !selectedHallId : !selectedPkgId}
            >
              다음
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">방문 날짜</label>
              {vendorClosedDays && (
                <p className="mb-2 text-xs text-muted-foreground">휴무일: 매주 {vendorClosedDays}요일</p>
              )}
              <div className="flex justify-center rounded-xl border border-border p-1">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={disabledDays}
                  className="!w-full"
                  classNames={{
                    today: "",
                  }}
                />
              </div>
              {selectedDate && (
                <p className="mt-2 text-center text-sm font-medium text-foreground">{date}</p>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">방문 시간</label>
              {loadingTimes ? (
                <p className="py-4 text-center text-sm text-muted-foreground">예약 가능 시간 확인 중...</p>
              ) : !date ? (
                <p className="py-4 text-center text-sm text-muted-foreground">날짜를 먼저 선택해주세요</p>
              ) : (
              <div className="grid grid-cols-4 gap-2">
                {timeSlots.map((t) => {
                  const isBooked = bookedTimes.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !isBooked && setTime(t)}
                      disabled={isBooked}
                      className={`rounded-xl border py-2.5 text-sm font-medium transition-all ${
                        isBooked
                          ? "border-border bg-muted text-muted-foreground/50 cursor-not-allowed"
                          : time === t
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-foreground">메모 <span className="text-xs text-muted-foreground font-normal">(선택)</span></label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="상담 내용, 질문 사항, 요청 사항 등을 적어주세요"
                rows={3}
                className="rounded-xl"
              />
            </div>
          </div>
          <div className="mt-6 flex gap-2">
            <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={onClose}>취소</Button>
            <Button
              className="flex-1 h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90"
              onClick={handleDepositClick}
              disabled={!date || !time || isSubmitting}
            >
              계약금 결제
            </Button>
          </div>
        </>
      )}
    </ModalShell>
  )
}

// ─── Review Modal ─────────────────────────────────────────────────────────

function ReviewModal({
  vendorId,
  vendorName,
  onClose,
  onSuccess,
}: {
  vendorId: string
  vendorName: string
  onClose: () => void
  onSuccess: (review: VendorReview) => void
}) {
  const [rating, setRating] = useState(5)
  const [hover, setHover] = useState(0)
  const [content, setContent] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!content.trim()) return
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await createReview(Number(vendorId), { rating, content: content.trim() })
      onSuccess({
        id: String(res.data.id),
        authorName: res.data.authorName ?? "나",
        rating: res.data.rating,
        content: res.data.content,
        date: res.data.reviewedAt?.split("T")[0] ?? new Date().toISOString().split("T")[0],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : ""
      if (msg.includes("400") || msg.toLowerCase().includes("already") || msg.includes("이미")) {
        setError("이미 리뷰를 작성했습니다.")
      } else if (msg.includes("403") || msg.includes("커플") || msg.includes("예약")) {
        setError("예약 내역이 없거나 커플 연결이 필요합니다.")
      } else {
        setError("리뷰 등록에 실패했습니다.")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

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
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
      <div className="mt-5 flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>취소</Button>
        <Button
          className="flex-1 bg-foreground text-background hover:bg-foreground/90"
          onClick={() => void handleSubmit()}
          disabled={!content.trim() || isSubmitting}
        >
          {isSubmitting ? "등록 중..." : "리뷰 등록"}
        </Button>
      </div>
    </ModalShell>
  )
}

// ─── Report Modal ─────────────────────────────────────────────────────────

function ReportModal({ vendorId, vendorName, onClose }: { vendorId: string; vendorName: string; onClose: () => void }) {
  const [reason, setReason] = useState("")
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const reasons = ["허위 정보", "불법 영업", "불쾌한 경험", "가격 사기", "기타"]

  const handleSubmit = async () => {
    if (!reason) return
    try {
      const { reportVendor } = await import("@/lib/api")
      await reportVendor(Number(vendorId), reason + (details ? `: ${details}` : ""))
      setSubmitted(true)
      setTimeout(onClose, 1500)
    } catch {
      alert("신고에 실패했습니다.")
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">업체 신고</h2>
        <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{vendorName}</p>
      {submitted ? (
        <div className="py-8 text-center">
          <p className="text-lg font-semibold text-foreground">신고가 접수되었습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">검토 후 조치하겠습니다</p>
        </div>
      ) : (
        <>
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
              onClick={handleSubmit}
              disabled={!reason}
            >
              신고 제출
            </Button>
          </div>
        </>
      )}
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
