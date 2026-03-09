"use client"

import { useState } from "react"
import { Heart, MapPin, Star, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WishlistItem {
  id: string
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
    category: "웨딩홀",
    name: "더 그랜드 파빌리온",
    location: "서울 강남구",
    rating: 4.8,
    reviewCount: 124,
    price: "800~1,000만원",
    imageColor: "bg-rose-100",
    savedAt: "2026-02-10",
  },
  {
    id: "2",
    category: "스튜디오",
    name: "로앤스튜디오",
    location: "서울 마포구",
    rating: 4.9,
    reviewCount: 87,
    price: "200~350만원",
    imageColor: "bg-purple-100",
    savedAt: "2026-02-15",
  },
  {
    id: "3",
    category: "드레스",
    name: "모니카블랑쉬",
    location: "서울 서초구",
    rating: 4.7,
    reviewCount: 63,
    price: "150~300만원",
    imageColor: "bg-pink-100",
    savedAt: "2026-02-20",
  },
  {
    id: "4",
    category: "메이크업",
    name: "글로우 뷰티",
    location: "서울 강남구",
    rating: 4.6,
    reviewCount: 95,
    price: "80~150만원",
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

export function WishlistView() {
  const [items, setItems] = useState<WishlistItem[]>(initialItems)
  const [filter, setFilter] = useState("전체")

  const categories = ["전체", "웨딩홀", "스튜디오", "드레스", "메이크업"]

  const filtered = filter === "전체" ? items : items.filter(i => i.category === filter)

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  return (
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
          <div className="space-y-4">
            {filtered.map(item => (
              <div
                key={item.id}
                className="group flex gap-4 rounded-2xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Thumbnail */}
                <div className={`flex size-20 shrink-0 items-center justify-center rounded-xl ${item.imageColor} text-3xl`}>
                  {item.category === "웨딩홀" && "🏛️"}
                  {item.category === "스튜디오" && "📷"}
                  {item.category === "드레스" && "👗"}
                  {item.category === "메이크업" && "💄"}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[item.category] ?? categoryColors["기타"]}`}>
                          {item.category}
                        </span>
                        <h3 className="mt-1 font-semibold text-foreground">{item.name}</h3>
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        aria-label="찜 해제"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="size-3.5" />
                      <span>{item.location}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-1 text-sm">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-medium text-foreground">{item.rating}</span>
                      <span className="text-muted-foreground">({item.reviewCount}개 리뷰)</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-primary">{item.price}</span>
                    <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                      <ExternalLink className="size-3" />
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
  )
}
