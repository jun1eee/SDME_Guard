"use client"

import { useState } from "react"
import { Heart, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { VendorDetailView, INITIAL_VENDORS, type Vendor } from "@/components/views/vendors-view"

interface WishlistItem {
  id: string
  vendorId: string
  category: string
  name: string
  location: string
  rating: number
  reviewCount: number
  price: string
  imageColor: string
  savedAt: string
}

const initialItems: WishlistItem[] = [
  {
    id: "1",
    vendorId: "3",
    category: "웨딩홀",
    name: "더 그랜드 파빌리온",
    location: "서울 강남구",
    rating: 4.8,
    reviewCount: 124,
    price: "900만원~",
    imageColor: "bg-rose-100",
    savedAt: "2026-02-10",
  },
  {
    id: "2",
    vendorId: "1",
    category: "스튜디오",
    name: "루미에르 스튜디오",
    location: "서울 강남구",
    rating: 4.9,
    reviewCount: 87,
    price: "2,800,000원",
    imageColor: "bg-purple-100",
    savedAt: "2026-02-15",
  },
  {
    id: "3",
    vendorId: "2",
    category: "드레스",
    name: "메종 블랑쉬 아틀리에",
    location: "서울 강남구",
    rating: 4.7,
    reviewCount: 63,
    price: "4,500,000원",
    imageColor: "bg-pink-100",
    savedAt: "2026-02-20",
  },
  {
    id: "4",
    vendorId: "4",
    category: "메이크업",
    name: "글로우 뷰티",
    location: "서울 강남구",
    rating: 4.6,
    reviewCount: 95,
    price: "100만원~",
    imageColor: "bg-amber-100",
    savedAt: "2026-02-22",
  },
]

const categoryColors: Record<string, string> = {
  웨딩홀: "bg-rose-50 text-rose-600",
  스튜디오: "bg-purple-50 text-purple-600",
  드레스: "bg-pink-50 text-pink-600",
  메이크업: "bg-amber-50 text-amber-600",
  기타: "bg-gray-50 text-gray-600",
}

const categoryEmoji: Record<string, string> = {
  웨딩홀: "🏛️",
  스튜디오: "📷",
  드레스: "👗",
  메이크업: "💄",
}

export function WishlistView() {
  const [items, setItems] = useState<WishlistItem[]>(initialItems)
  const [filter, setFilter] = useState("전체")
  const [modalVendor, setModalVendor] = useState<Vendor | null>(null)

  const categories = ["전체", "웨딩홀", "스튜디오", "드레스", "메이크업"]
  const filtered = filter === "전체" ? items : items.filter(i => i.category === filter)

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const openDetail = (vendorId: string) => {
    const vendor = INITIAL_VENDORS.find(v => v.id === vendorId)
    if (vendor) setModalVendor(vendor)
  }

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <Heart className="size-6 fill-primary text-primary" />
              <h1 className="text-2xl font-bold text-foreground">찜목록</h1>
            </div>
            <p className="mt-1 text-muted-foreground">관심 있는 업체를 모아보세요</p>
          </div>

          {/* Category Filter */}
          <div className="mb-5 flex gap-2 flex-wrap">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
                {cat !== "전체" && (
                  <span className="ml-1 text-xs opacity-70">
                    ({items.filter(i => i.category === cat).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Items */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Heart className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">찜한 업체가 없습니다</p>
              <p className="text-sm text-muted-foreground/70 mt-1">마음에 드는 업체를 찜해보세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map(item => (
                <div
                  key={item.id}
                  className="group cursor-pointer overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md"
                  onClick={() => openDetail(item.vendorId)}
                >
                  {/* Image area */}
                  <div className={`relative h-52 ${item.imageColor}`}>
                    <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoryColors[item.category] ?? categoryColors["기타"]}`}>
                        {item.category}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(item.id) }}
                        className="rounded-full p-1.5 bg-white/80 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="찜 해제"
                      >
                        <Heart className="size-3.5 fill-red-500 text-red-500" />
                      </button>
                    </div>
                    <div className="flex h-full items-center justify-center text-5xl">
                      {categoryEmoji[item.category]}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-semibold text-foreground">{item.name}</h3>
                    <div className="mt-1 flex items-center gap-1 text-sm">
                      <Star className="size-4 fill-yellow-400 text-yellow-400" />
                      <span className="font-medium text-foreground">{item.rating}</span>
                      <span className="text-muted-foreground">({item.reviewCount})</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-base font-bold text-foreground">{item.price}</span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => { e.stopPropagation(); openDetail(item.vendorId) }}
                      >
                        상세보기
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {filtered.length > 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              총 {filtered.length}개 업체
            </p>
          )}
        </div>
      </div>

      {/* Vendor Detail Bottom Sheet */}
      {modalVendor && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setModalVendor(null)}
          />
          {/* Sheet */}
          <div className="relative animate-in slide-in-from-bottom duration-300 flex flex-col rounded-t-2xl bg-background shadow-2xl w-full max-w-2xl" style={{ maxHeight: "92%" }}>
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex-1 min-h-0">
              <VendorDetailView
                vendor={modalVendor}
                onBack={() => setModalVendor(null)}
                onToggleFavorite={() =>
                  setModalVendor(prev => prev ? { ...prev, isFavorite: !prev.isFavorite } : null)
                }
                onAddReview={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
