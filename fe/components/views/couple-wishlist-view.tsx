"use client"

import { useState } from "react"
import { Heart, Star, MapPin, Calendar, Route, Store, Share2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { VendorShare } from "@/components/views/couple-chat-view"
import { VendorDetailView, INITIAL_VENDORS, type Vendor } from "@/components/views/vendors-view"

type TabId = "final" | "venue" | "studio" | "dress" | "makeup"

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "final", label: "최종", emoji: "💍" },
  { id: "venue", label: "웨딩홀", emoji: "🏛️" },
  { id: "studio", label: "스튜디오", emoji: "📷" },
  { id: "dress", label: "드레스", emoji: "👗" },
  { id: "makeup", label: "메이크업", emoji: "💄" },
]

interface CoupleWishlistViewProps {
  sharedVendors: VendorShare[]
  groomName: string
  brideName: string
  onOpenVendor?: () => void
  onOpenSchedule?: () => void
  onUnfavorite?: (vendorId: string) => void
  onShareVendor?: (vendor: VendorShare) => void
}

export function CoupleWishlistView({
  sharedVendors,
  groomName,
  brideName,
  onOpenVendor,
  onOpenSchedule,
  onUnfavorite,
  onShareVendor,
}: CoupleWishlistViewProps) {
  const [activeTab, setActiveTab] = useState<TabId>("final")
  const [modalVendor, setModalVendor] = useState<Vendor | null>(null)

  // vendorId별 누가 찜했는지 수집
  const vendorShareMap = new Map<string, Set<string>>()
  for (const v of sharedVendors) {
    if (!vendorShareMap.has(v.vendorId)) {
      vendorShareMap.set(v.vendorId, new Set())
    }
    vendorShareMap.get(v.vendorId)!.add(v.sharedBy)
  }

  // 중복 제거
  const uniqueVendors = sharedVendors.filter(
    (v, i, arr) => arr.findIndex((x) => x.vendorId === v.vendorId) === i
  )

  const finalVendors = uniqueVendors.filter(
    (v) => vendorShareMap.get(v.vendorId)?.size === 2
  )

  const vendorsByCategory = (cat: VendorShare["category"]) =>
    uniqueVendors.filter((v) => v.category === cat)

  const groomVendorsByCategory = (cat: VendorShare["category"]) =>
    sharedVendors
      .filter((v) => v.category === cat && v.sharedBy === "groom")
      .filter((v, i, arr) => arr.findIndex((x) => x.vendorId === v.vendorId) === i)

  const brideVendorsByCategory = (cat: VendorShare["category"]) =>
    sharedVendors
      .filter((v) => v.category === cat && v.sharedBy === "bride")
      .filter((v, i, arr) => arr.findIndex((x) => x.vendorId === v.vendorId) === i)

  const tabCounts: Record<TabId, number> = {
    final: finalVendors.length,
    venue: vendorsByCategory("venue").length,
    studio: vendorsByCategory("studio").length,
    dress: vendorsByCategory("dress").length,
    makeup: vendorsByCategory("makeup").length,
  }

  const openDetail = (vendorId: string) => {
    const v = INITIAL_VENDORS.find((x) => x.id === vendorId)
    if (v) setModalVendor({ ...v, isFavorite: true })
  }

  const cardProps = { onOpenDetail: openDetail, onUnfavorite, onShareVendor }

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden bg-background">
        {/* 헤더 */}
        <div className="border-b border-border bg-card px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-red-50">
              <Heart className="size-5 fill-red-500 text-red-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">커플 찜목록</h1>
              <p className="text-xs text-muted-foreground">{groomName} & {brideName}</p>
            </div>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-card px-4 pt-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-sm">{tab.emoji}</span>
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  activeTab === tab.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {tabCounts[tab.id]}
                </span>
              )}
              {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
            </button>
          ))}
        </div>

        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {activeTab === "final" ? (
            <FinalTab vendors={finalVendors} onOpenSchedule={onOpenSchedule} {...cardProps} />
          ) : (
            <CategoryTab
              groomVendors={groomVendorsByCategory(activeTab as VendorShare["category"])}
              brideVendors={brideVendorsByCategory(activeTab as VendorShare["category"])}
              groomName={groomName}
              brideName={brideName}
              vendorShareMap={vendorShareMap}
              {...cardProps}
            />
          )}
        </div>
      </div>

      {/* 상세정보 모달 */}
      {modalVendor && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalVendor(null)} />
          <div className="relative flex w-full max-w-2xl flex-col rounded-t-2xl bg-background shadow-2xl animate-in slide-in-from-bottom duration-300" style={{ maxHeight: "92%" }}>
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex-1 min-h-0">
              <VendorDetailView
                vendor={modalVendor}
                onBack={() => setModalVendor(null)}
                onToggleFavorite={() => {
                  const wasFavorite = modalVendor.isFavorite
                  setModalVendor((p) => p ? { ...p, isFavorite: !p.isFavorite } : null)
                  if (wasFavorite) onUnfavorite?.(modalVendor.id)
                }}
                onAddReview={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── 드래그 데이터 생성 ──────────────────────────────
function makeDragData(vendor: VendorShare) {
  return JSON.stringify({
    id: vendor.vendorId,
    name: vendor.name,
    category: vendor.category,
    categoryLabel: vendor.categoryLabel,
    price: vendor.price,
    rating: vendor.rating,
  })
}

// ── 공통 카드 props 타입 ────────────────────────────
interface CardActions {
  onOpenDetail: (vendorId: string) => void
  onUnfavorite?: (vendorId: string) => void
  onShareVendor?: (vendor: VendorShare) => void
}

// ── 최종 탭 ──────────────────────────────────────
function FinalTab({
  vendors,
  onOpenSchedule,
  onOpenDetail,
  onUnfavorite,
  onShareVendor,
}: { vendors: VendorShare[]; onOpenSchedule?: () => void } & CardActions) {
  if (vendors.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Store className="size-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">아직 둘 다 찜한 업체가 없습니다</p>
        <p className="text-xs text-muted-foreground/60">같은 업체를 둘 다 찜하면 자동으로 최종에 올라가요</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {vendors.map((v) => (
        <FinalVendorCard
          key={v.vendorId}
          vendor={v}
          onOpenDetail={onOpenDetail}
          onScheduleSuggest={onOpenSchedule}
          onUnfavorite={onUnfavorite}
          onShareVendor={onShareVendor}
        />
      ))}
    </div>
  )
}

// ── 카테고리 탭 (왼쪽 신랑 / 오른쪽 신부) ──────────
function CategoryTab({
  groomVendors,
  brideVendors,
  groomName,
  brideName,
  vendorShareMap,
  onOpenDetail,
  onUnfavorite,
  onShareVendor,
}: {
  groomVendors: VendorShare[]
  brideVendors: VendorShare[]
  groomName: string
  brideName: string
  vendorShareMap: Map<string, Set<string>>
} & CardActions) {
  const hasAny = groomVendors.length > 0 || brideVendors.length > 0

  if (!hasAny) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <Store className="size-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">이 카테고리에 찜한 업체가 없습니다</p>
        <p className="text-xs text-muted-foreground/60">업체에서 하트를 눌러 찜해보세요</p>
      </div>
    )
  }

  return (
    <div className="flex h-full gap-4">
      {/* 왼쪽: 신랑 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-blue-100">
            <Heart className="size-3 fill-blue-500 text-blue-500" />
          </div>
          <span className="text-sm font-semibold text-blue-600">{groomName}</span>
          <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-500">
            {groomVendors.length}
          </span>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {groomVendors.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground/60">아직 찜한 업체가 없어요</p>
          ) : (
            groomVendors.map((v) => (
              <CompactVendorCard
                key={v.vendorId}
                vendor={v}
                bothLiked={vendorShareMap.get(v.vendorId)?.size === 2}
                onOpenDetail={onOpenDetail}
                onUnfavorite={onUnfavorite}
                onShareVendor={onShareVendor}
              />
            ))
          )}
        </div>
      </div>

      <div className="w-px shrink-0 bg-border" />

      {/* 오른쪽: 신부 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-pink-100">
            <Heart className="size-3 fill-pink-500 text-pink-500" />
          </div>
          <span className="text-sm font-semibold text-pink-600">{brideName}</span>
          <span className="rounded-full bg-pink-50 px-1.5 py-0.5 text-[10px] font-bold text-pink-500">
            {brideVendors.length}
          </span>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto pl-1">
          {brideVendors.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground/60">아직 찜한 업체가 없어요</p>
          ) : (
            brideVendors.map((v) => (
              <CompactVendorCard
                key={v.vendorId}
                vendor={v}
                bothLiked={vendorShareMap.get(v.vendorId)?.size === 2}
                onOpenDetail={onOpenDetail}
                onUnfavorite={onUnfavorite}
                onShareVendor={onShareVendor}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

// ── 카테고리 카드 (드래그 + 공유 + 찜취소) ──────────
function CompactVendorCard({
  vendor,
  bothLiked,
  onOpenDetail,
  onUnfavorite,
  onShareVendor,
}: {
  vendor: VendorShare
  bothLiked: boolean
  onOpenDetail: (vendorId: string) => void
  onUnfavorite?: (vendorId: string) => void
  onShareVendor?: (vendor: VendorShare) => void
}) {
  const emoji =
    vendor.category === "studio" ? "📷" :
    vendor.category === "dress" ? "👗" :
    vendor.category === "makeup" ? "💄" : "🏛️"

  return (
    <div
      className={cn(
        "group cursor-pointer overflow-hidden rounded-xl border shadow-sm transition-all hover:shadow-md",
        bothLiked ? "border-primary/30" : "border-border"
      )}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/vendor-card", makeDragData(vendor))
        e.dataTransfer.effectAllowed = "copy"
      }}
      onClick={() => onOpenDetail(vendor.vendorId)}
    >
      {vendor.coverUrl ? (
        <img src={vendor.coverUrl} alt={vendor.name} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 w-full items-center justify-center bg-muted">
          <span className="text-4xl">{emoji}</span>
        </div>
      )}

      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{vendor.name}</span>
          {bothLiked && <span className="shrink-0 text-xs">💍</span>}
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="size-3 fill-yellow-400 text-yellow-400" />
          <span>{vendor.rating}</span>
          <span>·</span>
          <span className="font-medium text-foreground">{vendor.price}</span>
        </div>

        {/* 액션 버튼 */}
        <div className="mt-2 flex gap-1.5">
          {onShareVendor && (
            <button
              onClick={(e) => { e.stopPropagation(); onShareVendor(vendor) }}
              className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Share2 className="size-3" />
              공유
            </button>
          )}
          {onUnfavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnfavorite(vendor.vendorId) }}
              className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500"
            >
              <Heart className="size-3 fill-red-400 text-red-400" />
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 최종 업체 카드 ──────────────────────────────────
function FinalVendorCard({
  vendor,
  onOpenDetail,
  onScheduleSuggest,
  onUnfavorite,
  onShareVendor,
}: {
  vendor: VendorShare
  onOpenDetail: (vendorId: string) => void
  onScheduleSuggest?: () => void
  onUnfavorite?: (vendorId: string) => void
  onShareVendor?: (vendor: VendorShare) => void
}) {
  const emoji =
    vendor.category === "studio" ? "📷" :
    vendor.category === "dress" ? "👗" :
    vendor.category === "makeup" ? "💄" : "🏛️"

  const catLabel =
    vendor.category === "studio" ? "스튜디오" :
    vendor.category === "dress" ? "드레스" :
    vendor.category === "makeup" ? "메이크업" : "웨딩홀"

  return (
    <div
      className="cursor-pointer overflow-hidden rounded-xl border-2 border-primary/20 bg-primary/5 shadow-sm transition-colors hover:bg-primary/10"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/vendor-card", makeDragData(vendor))
        e.dataTransfer.effectAllowed = "copy"
      }}
      onClick={() => onOpenDetail(vendor.vendorId)}
    >
      {vendor.coverUrl ? (
        <img src={vendor.coverUrl} alt={vendor.name} className="h-40 w-full object-cover" />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-white">
          <span className="text-5xl">{emoji}</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-primary">{catLabel}</span>
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">💍 최종</span>
        </div>
        <span className="mt-1 block truncate text-sm font-semibold text-foreground">{vendor.name}</span>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Star className="size-3 fill-yellow-400 text-yellow-400" />
          <span>{vendor.rating}</span>
          <span>·</span>
          <span className="font-medium text-foreground">{vendor.price}</span>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onScheduleSuggest?.() }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
          >
            <Calendar className="size-3.5" />
            일정 제안
          </button>
          {onShareVendor && (
            <button
              onClick={(e) => { e.stopPropagation(); onShareVendor(vendor) }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-white px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/5"
            >
              <Share2 className="size-3.5" />
              공유
            </button>
          )}
          {onUnfavorite && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnfavorite(vendor.vendorId) }}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              <Heart className="size-3.5 fill-red-400" />
              취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
