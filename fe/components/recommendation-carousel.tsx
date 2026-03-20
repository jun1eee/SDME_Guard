"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Star, MapPin, Phone } from "lucide-react"
import type { AiRecommendation } from "@/lib/api"

interface RecommendationCarouselProps {
  recommendations: AiRecommendation[]
  onCardClick?: (rec: AiRecommendation) => void
}

export function RecommendationCarousel({ recommendations, onCardClick }: RecommendationCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  if (!recommendations || recommendations.length === 0) return null

  const canPrev = currentIndex > 0
  const canNext = currentIndex < recommendations.length - 1

  const prev = () => canPrev && setCurrentIndex((i) => i - 1)
  const next = () => canNext && setCurrentIndex((i) => i + 1)

  const categoryLabel: Record<string, string> = {
    studio: "스튜디오",
    dress: "드레스",
    makeup: "메이크업",
    venue: "웨딩홀",
  }

  const formatPrice = (price: number | null) => {
    if (!price) return null
    if (price >= 10000) return `${Math.round(price / 10000)}만원`
    return `${price.toLocaleString()}원`
  }

  return (
    <div className="my-3 w-full">
      <div className="relative">
        {/* 좌우 화살표 */}
        {canPrev && (
          <button
            onClick={prev}
            className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        {canNext && (
          <button
            onClick={next}
            className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md border border-border hover:bg-muted transition-colors"
          >
            <ChevronRight className="size-4" />
          </button>
        )}

        {/* 카드 컨테이너 */}
        <div ref={containerRef} className="overflow-hidden rounded-xl">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentIndex * 80}%)` }}
          >
            {recommendations.map((rec, idx) => (
              <div
                key={`${rec.id}-${idx}`}
                className="w-[80%] flex-shrink-0 px-1.5"
              >
                <div
                  onClick={() => {
                    if (idx !== currentIndex) {
                      setCurrentIndex(idx)
                    } else {
                      onCardClick?.(rec)
                    }
                  }}
                  className={cn(
                    "cursor-pointer rounded-xl border bg-card p-4 shadow-sm transition-all duration-200",
                    "hover:shadow-lg hover:border-primary/40 hover:-translate-y-1 hover:bg-primary/5",
                    "active:scale-[0.98] active:shadow-sm",
                    idx === currentIndex ? "opacity-100 scale-100 border-primary/20" : "opacity-60 scale-95"
                  )}
                >
                  {/* 이미지 */}
                  {rec.imageUrl && (
                    <div className="mb-3 overflow-hidden rounded-lg">
                      <img
                        src={rec.imageUrl}
                        alt={rec.name}
                        className="h-32 w-full object-cover"
                      />
                    </div>
                  )}

                  {/* 카테고리 뱃지 */}
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {categoryLabel[rec.category] || rec.category}
                    </span>
                    {rec.rating && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="size-3 fill-yellow-400 text-yellow-400" />
                        {rec.rating}
                      </span>
                    )}
                  </div>

                  {/* 이름 */}
                  <h3 className="mb-1 text-sm font-semibold text-foreground truncate">
                    {rec.name}
                  </h3>

                  {/* 가격 */}
                  {rec.price && (
                    <p className="mb-1 text-sm font-medium text-primary">
                      {formatPrice(rec.price)}
                    </p>
                  )}

                  {/* 추천 사유 */}
                  {rec.reason && (
                    <p className="mb-2 text-xs text-muted-foreground line-clamp-2">
                      {rec.reason}
                    </p>
                  )}

                  {/* 연락처 */}
                  {rec.contact && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="size-3" />
                      {rec.contact}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 페이지 인디케이터 — 양 끝으로 갈수록 작게 */}
        {recommendations.length > 1 && (
          <div className="mt-2 flex items-center justify-center gap-1">
            {recommendations.map((_, idx) => {
              const distance = Math.abs(idx - currentIndex)
              const size = distance === 0 ? "size-2" : distance === 1 ? "size-1.5" : "size-1"
              const opacity = distance === 0 ? "opacity-100" : distance === 1 ? "opacity-60" : "opacity-30"
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    size, opacity,
                    idx === currentIndex ? "bg-primary" : "bg-muted-foreground/50"
                  )}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
