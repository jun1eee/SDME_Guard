"use client"

import { useState, useEffect } from "react"
import { Heart, Star, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getMyFavorites, removeFavorite } from "@/lib/api"
import { fetchVendorDetail } from "@/lib/api/vendor-detail"
import { VendorDetailView, type Vendor } from "@/components/views/vendors-view"

interface WishlistItem {
  id: string
  vendorId: string
  category: string
  name: string
  rating: number
  price: string
  imageUrl?: string
  savedAt: string
}

const categoryColors: Record<string, string> = {
  HALL: "bg-rose-50 text-rose-600",
  STUDIO: "bg-purple-50 text-purple-600",
  DRESS: "bg-pink-50 text-pink-600",
  MAKEUP: "bg-amber-50 text-amber-600",
  venue: "bg-rose-50 text-rose-600",
  studio: "bg-purple-50 text-purple-600",
  dress: "bg-pink-50 text-pink-600",
  makeup: "bg-amber-50 text-amber-600",
}

const categoryLabel: Record<string, string> = {
  HALL: "웨딩홀", STUDIO: "스튜디오", DRESS: "드레스", MAKEUP: "메이크업",
  venue: "웨딩홀", studio: "스튜디오", dress: "드레스", makeup: "메이크업",
}

const categoryEmoji: Record<string, string> = {
  HALL: "🏛️", STUDIO: "📷", DRESS: "👗", MAKEUP: "💄",
  venue: "🏛️", studio: "📷", dress: "👗", makeup: "💄",
}

interface WishlistViewProps {
  onOpenVendor?: (vendorId: string) => void
}

export function WishlistView({ onOpenVendor }: WishlistViewProps = {}) {
  const [items, setItems] = useState<WishlistItem[]>([])
  const [filter, setFilter] = useState("전체")
  const [loading, setLoading] = useState(true)
  const [modalVendor, setModalVendor] = useState<Vendor | null>(null)

  const openDetail = (vendorId: string) => {
    fetchVendorDetail(vendorId)
      .then((vendor) => setModalVendor({ ...vendor, isFavorite: true }))
      .catch(() => {})
  }

  useEffect(() => {
    getMyFavorites()
      .then((res) => {
        const loaded: WishlistItem[] = res.data.map((f) => ({
          id: f.id.toString(),
          vendorId: f.vendorId.toString(),
          category: f.category || "",
          name: f.name || "",
          rating: f.rating || 0,
          price: f.price ? `${f.price.toLocaleString()}원` : "문의",
          imageUrl: f.imageUrl || undefined,
          savedAt: f.createdAt,
        }))
        setItems(loaded)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const categories = ["전체", "웨딩홀", "스튜디오", "드레스", "메이크업"]
  const filtered = filter === "전체" ? items : items.filter(i => categoryLabel[i.category] === filter)

  const removeItem = (item: WishlistItem) => {
    setItems(prev => prev.filter(i => i.id !== item.id))
    removeFavorite(Number(item.vendorId)).catch(() => {})
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Heart className="size-6 fill-primary text-primary" />
            <h1 className="text-2xl font-bold text-foreground">나의 찜목록</h1>
          </div>
          <p className="mt-1 text-muted-foreground">내가 관심 있는 업체를 모아보세요</p>
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
                  ({items.filter(i => categoryLabel[i.category] === cat).length})
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
                <div className="relative h-52 bg-muted">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-5xl">
                      {categoryEmoji[item.category] || "📦"}
                    </div>
                  )}
                  <div className="absolute inset-x-3 top-3 flex items-center justify-between">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${categoryColors[item.category] ?? "bg-gray-50 text-gray-600"}`}>
                      {categoryLabel[item.category] || item.category}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeItem(item) }}
                      className="rounded-full p-1.5 bg-white/80 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      aria-label="찜 해제"
                    >
                      <Heart className="size-3.5 fill-red-500 text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-semibold text-foreground">{item.name}</h3>
                  <div className="mt-1 flex items-center gap-1 text-sm">
                    <Star className="size-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-medium text-foreground">{item.rating}</span>
                  </div>
                  <div className="mt-3">
                    <span className="text-base font-bold text-foreground">{item.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 업체 상세 모달 */}
      {modalVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalVendor(null)} />
          <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-background shadow-2xl" style={{ maxHeight: "85vh" }}>
            <div className="flex justify-between items-center px-4 pt-3 pb-1 shrink-0">
              <div />
              <button onClick={() => setModalVendor(null)} className="flex size-8 items-center justify-center rounded-full hover:bg-muted">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto [&_.sticky]:hidden">
              <VendorDetailView
                vendor={modalVendor}
                onBack={() => setModalVendor(null)}
                onToggleFavorite={() => {
                  const wasFavorite = modalVendor.isFavorite
                  setModalVendor((p) => p ? { ...p, isFavorite: !p.isFavorite } : null)
                  if (wasFavorite) {
                    removeItem({ id: "", vendorId: modalVendor.id, category: "", name: "", rating: 0, price: "", savedAt: "" })
                  }
                }}
                onAddReview={() => {}}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
