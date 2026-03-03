"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

/* ── Types ─────────────────────────────────────────────── */

export interface BudgetCategory {
  id: string
  name: string
  allocated: number
  spent: number
}

export interface VendorReview {
  id: string
  vendorId: string
  userName: string
  rating: number
  text: string
  date: string
}

/* ── Wedding Hall specific ─────────────────────────────── */
export interface WeddingHall {
  id: string
  name: string
  photo: string
  interval: string
  timeSlots: string[]
  guaranteeGuests: number
  seatingCapacity: number
  standingCapacity: number
  rentalFee: number
  mealAdult: number
  mealChild: number
  drink: string
  style: string
  ceilingHeight: string
  virginRoad: boolean
  stage: boolean
  serviceFeeIncluded: boolean
  vatIncluded: boolean
  flowerIncluded: boolean
}

export interface HallEvent {
  period: string
  condition: string
  discounts: { item: string; original: string; discounted: string }[]
  perks: string[]
  note: string
}

export interface HallFacility {
  name: string
  detail: string
}

/* ── Additional product pricing ────────────────────────── */
export interface AdditionalProduct {
  category: string
  items: { name: string; price: string; condition?: string }[]
}

/* ── Visit info ────────────────────────────────────────── */
export interface VisitInfo {
  address: string
  transport: string
  parking: string
  hours: string
  closedDays: string
  lunchBreak: string
  floor: string
  phone: string
}

/* ── Package tabs ──────────────────────────────────────── */
export interface PackageTab {
  tabName: string // 리허설+본식 / 리허설 / 본식
  price: number
  includes: { label: string; value: string }[]
}

/* ── Payment progress ──────────────────────────────────── */
export type VendorProgressStep = "consulting" | "deposit" | "in-service" | "balance" | "completed"

export interface VendorProgress {
  currentStep: VendorProgressStep
  completedAt?: { [key in VendorProgressStep]?: string }
}

/* ── Studio specific ───────────────────────────────────── */
export interface StudioExtra {
  rehearsalAlbum: string
  rehearsalFrame: string
  originalRequired: boolean
  outdoorLocations: { name: string; fee: number; note?: string }[]
}

/* ── Dress specific ────────────────────────────────────── */
export interface DressExtra {
  rehearsalWhite: number
  rehearsalColor: number
  ceremonyWhite: number
  ceremonyColor: number
  helperFees: { condition: string; fee: number }[]
}

/* ── Makeup specific ───────────────────────────────────── */
export interface MakeupExtra {
  rehearsalSessions: number
  ceremonySessions: number
  groomIncluded: boolean
  startTimeFees: { time: string; fee: number }[]
}

/* ── Main Vendor type ──────────────────────────────────── */
export interface Vendor {
  id: string
  name: string
  category: string
  price: number
  rating: number
  image: string
  description: string
  hashtags: string[]
  visitInfo: VisitInfo
  packageTabs: PackageTab[]
  additionalProducts: AdditionalProduct[]
  progress: VendorProgress
  booked: boolean
  isDressShop?: boolean
  // category-specific extras
  studioExtra?: StudioExtra
  dressExtra?: DressExtra
  makeupExtra?: MakeupExtra
  // hall-specific
  halls?: WeddingHall[]
  hallEvent?: HallEvent
  hallFacilities?: HallFacility[]
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

export interface WeddingEvent {
  id: string
  title: string
  date: string
  time: string
  location: string
  memo: string
  category: "meeting" | "fitting" | "tasting" | "rehearsal" | "ceremony" | "other"
  status: "waiting" | "in-progress" | "completed"
}

export interface CoupleProfile {
  groomName: string
  brideName: string
  weddingDate: string
  groomPhoto: string
  bridePhoto: string
  groomPhone: string
  bridePhone: string
  preferences: {
    style: string[]
    colors: string[]
    mood: string[]
    food: string[]
    budget: string
    guestCount: string
    venue: string
  }
}

export interface PaymentRecord {
  id: string
  vendorId: string
  vendorName: string
  date: string
  amount: number
  type: "deposit" | "balance"
  status: "completed" | "pending" | "cancelled"
}

export interface Reservation {
  id: string
  vendorId: string
  vendorName: string
  category: string
  reservationDate: string
  serviceDate: string
  image: string
}

export interface RegisteredCard {
  id: string
  company: string
  lastFour: string
  nickname: string
}

/* ── Hall filter types ─────────────────────────────────── */
export interface HallFilters {
  guestCount: string
  style: string
  mealType: string
  ceremonyType: string
  transport: string
  entrance: string
  virginRoad: string
}

interface WeddingState {
  totalBudget: number
  setTotalBudget: (budget: number) => void
  categories: BudgetCategory[]
  updateCategory: (id: string, updates: Partial<BudgetCategory>) => void
  vendors: Vendor[]
  bookVendor: (vendorId: string) => void
  favoriteIds: string[]
  toggleFavorite: (vendorId: string) => void
  reviews: VendorReview[]
  addReview: (review: Omit<VendorReview, "id">) => void
  messages: ChatMessage[]
  addMessage: (message: Omit<ChatMessage, "id" | "timestamp">) => void
  events: WeddingEvent[]
  addEvent: (event: Omit<WeddingEvent, "id">) => void
  updateEvent: (id: string, updates: Partial<WeddingEvent>) => void
  removeEvent: (id: string) => void
  coupleProfile: CoupleProfile
  updateCoupleProfile: (updates: Partial<CoupleProfile>) => void
  updatePreferences: (updates: Partial<CoupleProfile["preferences"]>) => void
  payments: PaymentRecord[]
  reservations: Reservation[]
  registeredCards: RegisteredCard[]
  addCard: (card: Omit<RegisteredCard, "id">) => void
  removeCard: (id: string) => void
}

const WeddingContext = createContext<WeddingState | null>(null)

/* ── Progress helpers ──────────────────────────────────── */
export const progressSteps: { key: VendorProgressStep; label: string; percent: number }[] = [
  { key: "consulting", label: "상담중", percent: 0 },
  { key: "deposit", label: "계약금 10% 납입 완료", percent: 10 },
  { key: "in-service", label: "서비스 진행중", percent: 10 },
  { key: "balance", label: "잔금 90% 납입 완료", percent: 100 },
  { key: "completed", label: "서비스 완료", percent: 100 },
]

export function getProgressIndex(step: VendorProgressStep): number {
  return progressSteps.findIndex((s) => s.key === step)
}

export function getProgressBadgeText(step: VendorProgressStep): string {
  const s = progressSteps.find((p) => p.key === step)
  return s ? s.label : "상담가능"
}

/* ── Initial Data ──────────────────────────────────────── */

const initialCategories: BudgetCategory[] = [
  { id: "studio", name: "스튜디오", allocated: 3000000, spent: 0 },
  { id: "dress", name: "드레스", allocated: 5000000, spent: 0 },
  { id: "makeup", name: "메이크업", allocated: 1500000, spent: 0 },
  { id: "hall", name: "웨딩홀", allocated: 15000000, spent: 0 },
]

const initialVendors: Vendor[] = [
  {
    id: "v1",
    name: "루미에르 스튜디오",
    category: "studio",
    price: 2800000,
    rating: 4.9,
    image: "",
    description: "감성적인 촬영 스타일로 유명한 프리미엄 웨딩 스튜디오입니다. 자연광을 활용한 촬영과 시네마틱 영상을 전문으로 합니다.",
    hashtags: ["#감성적인", "#자연광", "#시네마틱", "#프리미엄"],
    visitInfo: {
      address: "서울 강남구 신사동 123-4 루미에르빌딩 3층",
      transport: "3호선 신사역 8번 출구 도보 5분",
      parking: "건물 내 주차 가능 (2시간 무료), 발렛 없음",
      hours: "10:00 ~ 19:00",
      closedDays: "매주 월요일",
      lunchBreak: "12:00 ~ 13:00",
      floor: "3층",
      phone: "02-1234-5678",
    },
    packageTabs: [
      {
        tabName: "리허설+본식",
        price: 2800000,
        includes: [
          { label: "앨범", value: "20P 앨범 1권" },
          { label: "액자", value: "20R 액자 1개" },
          { label: "원본", value: "원본 구매 필수 (USB 제공)" },
          { label: "야외씬", value: "1곳 포함" },
        ],
      },
      {
        tabName: "본식",
        price: 1500000,
        includes: [
          { label: "본식 스냅", value: "300컷 이상" },
          { label: "보정", value: "50컷 보정" },
        ],
      },
    ],
    additionalProducts: [
      {
        category: "촬영 추가",
        items: [
          { name: "야외씬 추가 (1곳)", price: "220,000원", condition: "잠수교, 한강반포지구 등" },
          { name: "야외씬 추가 (2곳째부터)", price: "110,000원" },
          { name: "촬영 시간 연장 (1시간)", price: "300,000원" },
        ],
      },
      {
        category: "앨범/액자",
        items: [
          { name: "앨범 업그레이드 (30P)", price: "350,000원" },
          { name: "추가 액자 (20R)", price: "150,000원" },
          { name: "원본 USB", price: "200,000원" },
        ],
      },
    ],
    progress: { currentStep: "consulting", completedAt: {} },
    booked: false,
    studioExtra: {
      rehearsalAlbum: "20P 앨범 1권",
      rehearsalFrame: "20R 액자 1개",
      originalRequired: true,
      outdoorLocations: [
        { name: "잠수교", fee: 220000 },
        { name: "한강반포지구", fee: 220000, note: "2곳째부터 +110,000원" },
        { name: "용산가족공원", fee: 220000, note: "의상 1벌 제한" },
      ],
    },
  },
  {
    id: "v2",
    name: "메종 블랑쉬 아틀리에",
    category: "dress",
    price: 4500000,
    rating: 4.8,
    image: "",
    description: "맞춤형 웨딩드레스 전문 아틀리에입니다. 최고급 원단으로 제작하며, 모든 드레스가 세상에 단 하나뿐인 작품입니다.",
    hashtags: ["#고급스러운", "#맞춤제작", "#엔틱한", "#우아한"],
    visitInfo: {
      address: "서울 강남구 청담동 45-6 블랑쉬타워 2층",
      transport: "7호선 청담역 10번 출구 도보 3분",
      parking: "건물 지하 주차 가능 (3시간 무료), 발렛 가능",
      hours: "10:00 ~ 20:00",
      closedDays: "매주 일요일",
      lunchBreak: "없음",
      floor: "2층",
      phone: "02-2345-6789",
    },
    packageTabs: [
      {
        tabName: "리허설+본식",
        price: 4500000,
        includes: [
          { label: "리허설 드레스", value: "화이트 3벌 + 컬러 1벌" },
          { label: "본식 드레스", value: "화이트 1벌" },
          { label: "액세서리", value: "티아라/베일 포함" },
        ],
      },
      {
        tabName: "리허설",
        price: 2500000,
        includes: [
          { label: "드레스", value: "화이트 2벌 + 컬러 1벌" },
          { label: "액세서리", value: "베일 포함" },
        ],
      },
      {
        tabName: "본식",
        price: 2000000,
        includes: [
          { label: "드레스", value: "화이트 1벌" },
          { label: "2부 드레스", value: "별도 (500,000원)" },
        ],
      },
    ],
    additionalProducts: [
      {
        category: "드레스 추가",
        items: [
          { name: "추가 드레스 (화이트)", price: "500,000원" },
          { name: "추가 드레스 (컬러)", price: "300,000원" },
          { name: "수선비", price: "300,000원" },
        ],
      },
      {
        category: "액세서리",
        items: [
          { name: "베일 업그레이드 (롱베일)", price: "200,000원" },
          { name: "티아라 대여", price: "150,000원" },
          { name: "슈즈 대여", price: "100,000원" },
        ],
      },
    ],
    progress: { currentStep: "deposit", completedAt: { consulting: "2026-01-15", deposit: "2026-02-01" } },
    booked: false,
    isDressShop: true,
    dressExtra: {
      rehearsalWhite: 3,
      rehearsalColor: 1,
      ceremonyWhite: 1,
      ceremonyColor: 0,
      helperFees: [
        { condition: "야간촬영 (17시부터)", fee: 110000 },
        { condition: "야간예식 (18시부터)", fee: 110000 },
        { condition: "촬영 5시간 이상 초과", fee: 55000 },
        { condition: "강남권 외 스튜디오 촬영", fee: 55000 },
        { condition: "2부드레스 진행 시", fee: 110000 },
        { condition: "경기지역 예식", fee: 110000 },
      ],
    },
  },
  {
    id: "v3",
    name: "글로우 뷰티",
    category: "makeup",
    price: 1200000,
    rating: 4.7,
    image: "",
    description: "프리미엄 브라이덜 뷰티 서비스. 헤어 스타일링, 메이크업 아티스트, 사전 피부관리를 포함합니다.",
    hashtags: ["#깨끗한", "#색감이예쁜", "#코랄메이크업", "#자연스러운"],
    visitInfo: {
      address: "서울 서초구 반포동 78-9 글로우빌딩 4층",
      transport: "9호선 신반포역 2번 출구 도보 7분",
      parking: "건물 앞 주차 5대 가능 (무료)",
      hours: "09:00 ~ 19:00",
      closedDays: "매주 월요일",
      lunchBreak: "12:30 ~ 13:30",
      floor: "4층",
      phone: "02-3456-7890",
    },
    packageTabs: [
      {
        tabName: "리허설+본식",
        price: 1200000,
        includes: [
          { label: "리허설", value: "1회 (헤어&메이크업)" },
          { label: "본식", value: "1회 (헤어&메이크업)" },
          { label: "신랑", value: "헤어&메이크업 포함" },
        ],
      },
      {
        tabName: "본식",
        price: 700000,
        includes: [
          { label: "본식", value: "1회 (헤어&메이크업)" },
          { label: "신랑", value: "포함" },
        ],
      },
    ],
    additionalProducts: [
      {
        category: "추가 메이크업",
        items: [
          { name: "리허설 추가 (1회)", price: "150,000원" },
          { name: "들러리 메이크업 (1인)", price: "100,000원" },
          { name: "어머니 메이크업 (1인)", price: "150,000원" },
        ],
      },
    ],
    progress: { currentStep: "consulting", completedAt: {} },
    booked: false,
    makeupExtra: {
      rehearsalSessions: 1,
      ceremonySessions: 1,
      groomIncluded: true,
      startTimeFees: [
        { time: "4:00~4:59", fee: 220000 },
        { time: "5:00~5:59", fee: 110000 },
        { time: "6:00~7:59", fee: 55000 },
        { time: "AM 8:00 이후", fee: 0 },
      ],
    },
  },
  {
    id: "v4",
    name: "더 그랜드 파빌리온",
    category: "hall",
    price: 12000000,
    rating: 4.9,
    image: "",
    description: "우아한 크리스탈 샹들리에와 넓은 정원을 겸비한 프리미엄 웨딩홀. 분리예식과 동시예식 모두 가능합니다.",
    hashtags: ["#우아한", "#클래식", "#넓은홀", "#정원있는"],
    visitInfo: {
      address: "서울 서초구 잠원동 12-3 그랜드파빌리온",
      transport: "3호선 잠원역 1번 출구 도보 3분",
      parking: "지하주차장 200대 가능 (2시간 무료), 발렛 가능 (3만원)",
      hours: "09:00 ~ 21:00",
      closedDays: "연중무휴",
      lunchBreak: "없음",
      floor: "지상 1~3층",
      phone: "02-4567-8901",
    },
    packageTabs: [],
    additionalProducts: [
      {
        category: "추가 서비스",
        items: [
          { name: "초과 시간 (1시간당)", price: "500,000원" },
          { name: "플라워 장식 업그레이드", price: "800,000원" },
          { name: "LED 연출", price: "300,000원" },
          { name: "드라이아이스 연출", price: "200,000원" },
        ],
      },
      {
        category: "식사 추가",
        items: [
          { name: "보증 초과 인원 (대인)", price: "90,000원/인" },
          { name: "보증 초과 인원 (소인)", price: "60,000원/인" },
          { name: "주류 반입비 (1병)", price: "30,000원" },
        ],
      },
    ],
    progress: { currentStep: "balance", completedAt: { consulting: "2025-12-01", deposit: "2026-01-15", "in-service": "2026-02-01", balance: "2026-03-01" } },
    booked: true,
    halls: [
      {
        id: "h1",
        name: "그랜드홀",
        photo: "",
        interval: "2시간",
        timeSlots: ["11:00", "13:00", "15:00", "17:00"],
        guaranteeGuests: 200,
        seatingCapacity: 250,
        standingCapacity: 300,
        rentalFee: 16000000,
        mealAdult: 90000,
        mealChild: 60000,
        drink: "음료 포함 / 주류 별도 (당일 소모량 정산)",
        style: "클래식 & 모던",
        ceilingHeight: "6m",
        virginRoad: true,
        stage: true,
        serviceFeeIncluded: true,
        vatIncluded: true,
        flowerIncluded: false,
      },
      {
        id: "h2",
        name: "가든홀",
        photo: "",
        interval: "2시간",
        timeSlots: ["10:00", "12:00", "14:00", "16:00"],
        guaranteeGuests: 100,
        seatingCapacity: 150,
        standingCapacity: 180,
        rentalFee: 10000000,
        mealAdult: 85000,
        mealChild: 55000,
        drink: "음료 포함 / 주류 별도",
        style: "가든 & 내추럴",
        ceilingHeight: "야외",
        virginRoad: false,
        stage: false,
        serviceFeeIncluded: true,
        vatIncluded: true,
        flowerIncluded: true,
      },
      {
        id: "h3",
        name: "루프탑 채플",
        photo: "",
        interval: "2시간 30분",
        timeSlots: ["11:00", "14:00", "17:00"],
        guaranteeGuests: 80,
        seatingCapacity: 100,
        standingCapacity: 120,
        rentalFee: 8000000,
        mealAdult: 95000,
        mealChild: 60000,
        drink: "음료 포함 / 주류 1병 포함",
        style: "모던 & 루프탑",
        ceilingHeight: "야외 (차양 있음)",
        virginRoad: true,
        stage: true,
        serviceFeeIncluded: false,
        vatIncluded: false,
        flowerIncluded: false,
      },
    ],
    hallEvent: {
      period: "2026년 1~8월 예식",
      condition: "최초 보증인원 150명 이상",
      discounts: [
        { item: "식대", original: "100,000원", discounted: "90,000원~95,000원" },
        { item: "홀대관료", original: "1,600만원", discounted: "1,010만원~1,230만원" },
        { item: "연출료", original: "200만원", discounted: "무료" },
      ],
      perks: [
        "시식 2인 제공",
        "웨딩 당일 객실 1박 제공",
        "연출료 무료",
        "플라워샤워 무료",
        "꽃장식 서비스",
        "샌딩서비스",
        "발렛서비스",
        "메뉴카드 서비스",
      ],
      note: "이벤트 내용은 사전 공지 없이 변경될 수 있습니다.",
    },
    hallFacilities: [
      { name: "주차장", detail: "지하 200대 (2시간 무료)" },
      { name: "폐백실", detail: "1층 별도 운영" },
      { name: "신부대기실", detail: "각 홀별 전용" },
      { name: "드레스룸", detail: "2층 대형 드레스룸" },
      { name: "포토존", detail: "야외 정원 + 로비" },
    ],
  },
  {
    id: "v5",
    name: "로즈 브라이덜",
    category: "dress",
    price: 3200000,
    rating: 4.7,
    image: "",
    description: "다양한 스타일의 웨딩드레스를 보유한 렌탈 전문 숍. 클래식부터 모던까지 폭넓은 선택지를 제공합니다.",
    hashtags: ["#다양한", "#렌탈전문", "#모던", "#트렌디한"],
    visitInfo: {
      address: "서울 강남구 압구정동 56-7 로즈빌딩 1층",
      transport: "3호선 압구정역 3번 출구 도보 8분",
      parking: "건물 앞 주차 3대 가능",
      hours: "10:00 ~ 19:00",
      closedDays: "매주 화요일",
      lunchBreak: "12:00 ~ 13:00",
      floor: "1층",
      phone: "02-5678-9012",
    },
    packageTabs: [
      {
        tabName: "리허설+본식",
        price: 3200000,
        includes: [
          { label: "리허설", value: "화이트 2벌 + 컬러 1벌" },
          { label: "본식", value: "화이트 1벌" },
        ],
      },
      {
        tabName: "리허설",
        price: 1800000,
        includes: [
          { label: "드레스", value: "화이트 2벌" },
        ],
      },
    ],
    additionalProducts: [
      {
        category: "드레스 추가",
        items: [
          { name: "추가 드레스 렌탈", price: "400,000원" },
          { name: "수선비", price: "200,000원" },
          { name: "액세서리 대여", price: "150,000원" },
        ],
      },
    ],
    progress: { currentStep: "consulting", completedAt: {} },
    booked: false,
    isDressShop: true,
    dressExtra: {
      rehearsalWhite: 2,
      rehearsalColor: 1,
      ceremonyWhite: 1,
      ceremonyColor: 0,
      helperFees: [
        { condition: "야간촬영 (17시부터)", fee: 100000 },
        { condition: "야간예식 (18시부터)", fee: 100000 },
        { condition: "2부드레스 진행 시", fee: 100000 },
      ],
    },
  },
  {
    id: "v6",
    name: "아뜰리에 드 라 메르",
    category: "studio",
    price: 3500000,
    rating: 4.8,
    image: "",
    description: "바다를 테마로 한 독특한 스튜디오. 제주도 촬영 패키지가 인기 있으며, 자연스럽고 편안한 분위기의 사진을 전문으로 합니다.",
    hashtags: ["#제주도", "#바다테마", "#자연스러운", "#편안한"],
    visitInfo: {
      address: "제주 서귀포시 중문동 34-5 라메르빌딩",
      transport: "제주공항에서 차량 50분",
      parking: "전용 주차장 10대 가능 (무료)",
      hours: "09:00 ~ 18:00",
      closedDays: "연중무휴 (우천 시 실내 촬영)",
      lunchBreak: "없음",
      floor: "1층",
      phone: "064-1234-5678",
    },
    packageTabs: [
      {
        tabName: "리허설+본식",
        price: 3500000,
        includes: [
          { label: "제주 촬영", value: "야외 3곳 + 실내 1곳" },
          { label: "앨범", value: "30P 앨범 1권" },
          { label: "원본", value: "전체 원본 USB" },
        ],
      },
    ],
    additionalProducts: [
      {
        category: "촬영 추가",
        items: [
          { name: "항공/숙박 패키지", price: "500,000원", condition: "왕복 항공 + 1박 숙박" },
          { name: "추가 촬영 (1시간)", price: "300,000원" },
          { name: "드론 촬영", price: "200,000원" },
        ],
      },
    ],
    progress: { currentStep: "consulting", completedAt: {} },
    booked: false,
    studioExtra: {
      rehearsalAlbum: "30P 앨범 1권",
      rehearsalFrame: "없음 (옵션 추가 가능)",
      originalRequired: false,
      outdoorLocations: [
        { name: "중문색달해변", fee: 0, note: "기본 포함" },
        { name: "협재해변", fee: 110000 },
        { name: "성산일출봉", fee: 150000, note: "일출 촬영 (새벽 5시)" },
      ],
    },
  },
  {
    id: "v7",
    name: "뷰티풀 데이",
    category: "makeup",
    price: 900000,
    rating: 4.5,
    image: "",
    description: "합리적인 가격의 브라이덜 메이크업 전문. 자연스러운 메이크업 스타일로 신부의 아름다움을 극대화합니다.",
    hashtags: ["#합리적인", "#자연스러운", "#가성비", "#깔끔한"],
    visitInfo: {
      address: "서울 마포구 연남동 89-1 뷰티풀빌딩 2층",
      transport: "2호선 홍대입구역 3번 출구 도보 10분",
      parking: "인근 공영주차장 이용 (유료)",
      hours: "10:00 ~ 19:00",
      closedDays: "매주 일요일",
      lunchBreak: "12:00 ~ 13:00",
      floor: "2층",
      phone: "02-6789-0123",
    },
    packageTabs: [
      {
        tabName: "리허설+본식",
        price: 900000,
        includes: [
          { label: "리허설", value: "1회" },
          { label: "본식", value: "1회" },
          { label: "신랑", value: "미포함 (추가 150,000원)" },
        ],
      },
    ],
    additionalProducts: [
      {
        category: "추가 메이크업",
        items: [
          { name: "신랑 메이크업", price: "150,000원" },
          { name: "리허설 추가 (1회)", price: "100,000원" },
        ],
      },
    ],
    progress: { currentStep: "consulting", completedAt: {} },
    booked: false,
    makeupExtra: {
      rehearsalSessions: 1,
      ceremonySessions: 1,
      groomIncluded: false,
      startTimeFees: [
        { time: "4:00~4:59", fee: 200000 },
        { time: "5:00~5:59", fee: 100000 },
        { time: "6:00~7:59", fee: 50000 },
        { time: "AM 8:00 이후", fee: 0 },
      ],
    },
  },
  {
    id: "v8",
    name: "라비앙로즈 웨딩홀",
    category: "hall",
    price: 8000000,
    rating: 4.6,
    image: "",
    description: "아담하고 따뜻한 분위기의 소규모 웨딩홀. 100명 내외의 프라이빗한 웨딩에 적합합니다.",
    hashtags: ["#따뜻한", "#소규모", "#프라이빗", "#아담한"],
    visitInfo: {
      address: "서울 용산구 한남동 67-8 라비앙로즈",
      transport: "6호선 한강진역 1번 출구 도보 5분",
      parking: "지하주차장 50대 가능 (1시간 무료), 발렛 가능 (2만원)",
      hours: "09:00 ~ 20:00",
      closedDays: "연중무휴",
      lunchBreak: "없음",
      floor: "지상 1~2층",
      phone: "02-7890-1234",
    },
    packageTabs: [],
    additionalProducts: [
      {
        category: "추가 서비스",
        items: [
          { name: "주말 추가비", price: "1,000,000원" },
          { name: "플라워 장식 업그레이드", price: "500,000원" },
          { name: "포토존 추가 설치", price: "300,000원" },
        ],
      },
    ],
    progress: { currentStep: "consulting", completedAt: {} },
    booked: false,
    halls: [
      {
        id: "h4",
        name: "로즈홀",
        photo: "",
        interval: "2시간",
        timeSlots: ["11:00", "13:00", "15:00", "17:00"],
        guaranteeGuests: 80,
        seatingCapacity: 120,
        standingCapacity: 150,
        rentalFee: 8000000,
        mealAdult: 80000,
        mealChild: 50000,
        drink: "음료 포함 / 주류 별도",
        style: "로맨틱 & 클래식",
        ceilingHeight: "4.5m",
        virginRoad: true,
        stage: true,
        serviceFeeIncluded: true,
        vatIncluded: false,
        flowerIncluded: true,
      },
      {
        id: "h5",
        name: "프리미엄 다이닝홀",
        photo: "",
        interval: "2시간 30분",
        timeSlots: ["12:00", "15:00", "18:00"],
        guaranteeGuests: 50,
        seatingCapacity: 70,
        standingCapacity: 80,
        rentalFee: 6000000,
        mealAdult: 100000,
        mealChild: 65000,
        drink: "음료 + 와인 1잔 포함",
        style: "모던 다이닝",
        ceilingHeight: "3.5m",
        virginRoad: false,
        stage: false,
        serviceFeeIncluded: true,
        vatIncluded: true,
        flowerIncluded: false,
      },
    ],
    hallEvent: {
      period: "2026년 3~6월 예식",
      condition: "최초 보증인원 80명 이상",
      discounts: [
        { item: "식대", original: "80,000원", discounted: "70,000원" },
        { item: "홀대관료", original: "800만원", discounted: "600만원" },
      ],
      perks: [
        "시식 2인 제공",
        "신부대기실 무료",
        "플라워샤워 무료",
        "발렛서비스",
      ],
      note: "일부 날짜는 이벤트 적용이 제한될 수 있습니다.",
    },
    hallFacilities: [
      { name: "주차장", detail: "지하 50대 (1시간 무료)" },
      { name: "폐백실", detail: "1층 별도" },
      { name: "신부대기실", detail: "전용" },
      { name: "포토존", detail: "로비 포토존" },
    ],
  },
]

const initialReviews: VendorReview[] = [
  { id: "r1", vendorId: "v1", userName: "김지현", rating: 5, text: "감성적인 촬영 퀄리티가 정말 좋았어요. 자연광 활용이 탁월합니다.", date: "2025-12-15" },
  { id: "r2", vendorId: "v1", userName: "이수민", rating: 5, text: "사진 보정도 자연스럽고, 스태프분들이 너무 친절했어요.", date: "2025-11-20" },
  { id: "r3", vendorId: "v2", userName: "박서연", rating: 4, text: "드레스가 정말 고급스러웠어요. 다만 수선 기간이 좀 길었습니다.", date: "2026-01-10" },
  { id: "r4", vendorId: "v2", userName: "최유진", rating: 5, text: "맞춤 드레스라 핏이 완벽했어요! 엄마도 너무 만족하셨어요.", date: "2025-12-28" },
  { id: "r5", vendorId: "v3", userName: "정혜리", rating: 5, text: "리허설 때 여러 스타일 테스트해주셔서 당일 메이크업이 완벽했어요.", date: "2026-01-05" },
  { id: "r6", vendorId: "v4", userName: "한소영", rating: 5, text: "홀 분위기가 정말 우아해요. 하객분들도 다 감탄했습니다.", date: "2025-10-15" },
  { id: "r7", vendorId: "v4", userName: "오지민", rating: 4, text: "시설은 최고인데 주차공간이 좀 부족한 점이 아쉬워요.", date: "2025-11-01" },
  { id: "r8", vendorId: "v5", userName: "윤서아", rating: 4, text: "드레스 선택지가 정말 다양해요. 렌탈이라 가격 대비 만족도 높습니다.", date: "2026-01-20" },
]

const initialMessages: ChatMessage[] = [
  {
    id: "m1",
    role: "assistant",
    content: "안녕하세요! Aisle AI 웨딩 플래너입니다. 예산이 4,000만원으로 설정되어 있네요. 먼저 웨딩홀 예약부터 시작하는 것이 좋을 것 같아요. 어떤 스타일의 웨딩홀을 원하시나요?",
    timestamp: new Date(),
  },
]

const initialEvents: WeddingEvent[] = [
  { id: "e1", title: "웨딩홀 투어", date: "2026-04-15", time: "14:00", location: "더 그랜드 파빌리온", memo: "주차 가능 여부 확인", category: "meeting", status: "completed" },
  { id: "e2", title: "드레스 피팅", date: "2026-04-20", time: "11:00", location: "메종 블랑쉬 아틀리에", memo: "속옷 준비, 엄마와 함께", category: "fitting", status: "in-progress" },
  { id: "e3", title: "메이크업 리허설", date: "2026-05-01", time: "10:00", location: "글로우 뷰티", memo: "참고 이미지 가져가기", category: "rehearsal", status: "waiting" },
  { id: "e4", title: "식사 시식회", date: "2026-05-10", time: "18:00", location: "더 그랜드 파빌리온", memo: "알레르기 메뉴 확인", category: "tasting", status: "waiting" },
]

const initialCoupleProfile: CoupleProfile = {
  groomName: "",
  brideName: "",
  weddingDate: "2026-10-10",
  groomPhoto: "",
  bridePhoto: "",
  groomPhone: "",
  bridePhone: "",
  preferences: {
    style: ["클래식", "모던"],
    colors: ["화이트", "골드"],
    mood: ["우아한", "로맨틱"],
    food: ["한식 뷔페", "양식 코스"],
    budget: "4000만원",
    guestCount: "200명",
    venue: "실내 홀",
  },
}

const initialPayments: PaymentRecord[] = [
  { id: "p1", vendorId: "v4", vendorName: "더 그랜드 파빌리온", date: "2026-02-15", amount: 5000000, type: "deposit", status: "completed" },
  { id: "p2", vendorId: "v4", vendorName: "더 그랜드 파빌리온", date: "2026-08-01", amount: 7000000, type: "balance", status: "pending" },
]

const initialReservations: Reservation[] = [
  { id: "res1", vendorId: "v4", vendorName: "더 그랜드 파빌리온", category: "hall", reservationDate: "2026-02-15", serviceDate: "2026-10-10", image: "" },
]

const initialCards: RegisteredCard[] = []

/* ── Provider ──────────────────────────────────────────── */

export function WeddingProvider({ children }: { children: ReactNode }) {
  const [totalBudget, setTotalBudget] = useState(40000000)
  const [categories, setCategories] = useState(initialCategories)
  const [vendors, setVendors] = useState(initialVendors)
  const [favoriteIds, setFavoriteIds] = useState<string[]>([])
  const [reviews, setReviews] = useState(initialReviews)
  const [messages, setMessages] = useState(initialMessages)
  const [events, setEvents] = useState(initialEvents)
  const [coupleProfile, setCoupleProfile] = useState(initialCoupleProfile)
  const [payments] = useState(initialPayments)
  const [reservations] = useState(initialReservations)
  const [registeredCards, setRegisteredCards] = useState(initialCards)

  const updateCategory = useCallback((id: string, updates: Partial<BudgetCategory>) => {
    setCategories((prev) => prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)))
  }, [])

  const bookVendor = useCallback(
    (vendorId: string) => {
      setVendors((prev) => prev.map((v) => (v.id === vendorId ? { ...v, booked: true, progress: { ...v.progress, currentStep: "deposit" as const } } : v)))
      const vendor = vendors.find((v) => v.id === vendorId)
      if (vendor) {
        setCategories((prev) => prev.map((cat) => (cat.id === vendor.category ? { ...cat, spent: cat.spent + vendor.price } : cat)))
        const catName = categories.find((c) => c.id === vendor.category)?.name
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: "assistant" as const,
            content: `${vendor.name}을(를) ${vendor.price.toLocaleString()}원에 예약했습니다! ${catName} 예산에서 차감되었어요.`,
            timestamp: new Date(),
          },
        ])
      }
    },
    [vendors, categories]
  )

  const toggleFavorite = useCallback((vendorId: string) => {
    setFavoriteIds((prev) => (prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]))
  }, [])

  const addReview = useCallback((review: Omit<VendorReview, "id">) => {
    setReviews((prev) => [...prev, { ...review, id: `r-${Date.now()}` }])
  }, [])

  const addMessage = useCallback(
    (message: Omit<ChatMessage, "id" | "timestamp">) => {
      const newMsg: ChatMessage = { ...message, id: `m-${Date.now()}`, timestamp: new Date() }
      setMessages((prev) => [...prev, newMsg])
      if (message.role === "user") {
        setTimeout(() => {
          const responses = [
            "분석해봤는데요, 현재 시세를 고려하면 적정한 가격이에요. 더 좋은 패키지로 협상해볼까요?",
            "남은 예산을 보면 스튜디오와 드레스를 먼저 확정하는 걸 추천드려요.",
            "취향에 맞는 옵션을 찾았어요! 자세한 정보를 보여드릴게요.",
            "좋은 질문이에요! 제 경험상 최소 6개월 전에 예약하셔야 원하는 날짜에 진행할 수 있어요.",
            "두 분의 취향을 바탕으로 분석해보면, 클래식하면서도 모던한 스타일이 잘 어울리실 것 같아요.",
          ]
          setMessages((prev) => [
            ...prev,
            { id: `m-${Date.now() + 1}`, role: "assistant", content: responses[Math.floor(Math.random() * responses.length)], timestamp: new Date() },
          ])
        }, 1200)
      }
    },
    []
  )

  const addEvent = useCallback((event: Omit<WeddingEvent, "id">) => {
    setEvents((prev) => [...prev, { ...event, id: `e-${Date.now()}` }])
  }, [])

  const updateEvent = useCallback((id: string, updates: Partial<WeddingEvent>) => {
    setEvents((prev) => prev.map((ev) => (ev.id === id ? { ...ev, ...updates } : ev)))
  }, [])

  const removeEvent = useCallback((id: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id))
  }, [])

  const updateCoupleProfile = useCallback((updates: Partial<CoupleProfile>) => {
    setCoupleProfile((prev) => ({ ...prev, ...updates }))
  }, [])

  const updatePreferences = useCallback((updates: Partial<CoupleProfile["preferences"]>) => {
    setCoupleProfile((prev) => ({ ...prev, preferences: { ...prev.preferences, ...updates } }))
  }, [])

  const addCard = useCallback((card: Omit<RegisteredCard, "id">) => {
    setRegisteredCards((prev) => [...prev, { ...card, id: `card-${Date.now()}` }])
  }, [])

  const removeCard = useCallback((id: string) => {
    setRegisteredCards((prev) => prev.filter((c) => c.id !== id))
  }, [])

  return (
    <WeddingContext.Provider
      value={{
        totalBudget, setTotalBudget, categories, updateCategory,
        vendors, bookVendor, favoriteIds, toggleFavorite,
        reviews, addReview,
        messages, addMessage, events, addEvent, updateEvent, removeEvent,
        coupleProfile, updateCoupleProfile, updatePreferences,
        payments, reservations, registeredCards, addCard, removeCard,
      }}
    >
      {children}
    </WeddingContext.Provider>
  )
}

export function useWedding() {
  const context = useContext(WeddingContext)
  if (!context) throw new Error("useWedding must be used within a WeddingProvider")
  return context
}
