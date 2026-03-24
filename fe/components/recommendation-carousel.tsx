"use client"

import { useState, useRef } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Star, Phone, MapPin } from "lucide-react"
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
    studio: "STUDIO",
    dress: "DRESS",
    makeup: "MAKEUP",
    venue: "HALL",
  }

  const categoryColor: Record<string, string> = {
    studio: "bg-blue-50 text-blue-600 border-blue-200",
    dress: "bg-pink-50 text-pink-600 border-pink-200",
    makeup: "bg-purple-50 text-purple-600 border-purple-200",
    venue: "bg-amber-50 text-amber-600 border-amber-200",
  }

  const formatPrice = (price: number | null) => {
    if (!price) return null
    if (price >= 10000) return `${Math.round(price / 10000)}만원`
    return `${price.toLocaleString()}원`
  }

  const parseTags = (rec: AiRecommendation): string[] => {
    const src = rec.hashtags || rec.reason || ""
    const isValidTag = (tag: string): boolean => {
      if (/^\d+$/.test(tag)) return false
      if (/^\d{1,3}(,\d{3})+$/.test(tag)) return false
      if (/식대\s*\d/.test(tag)) return false
      if (/\d+원/.test(tag)) return false
      if (tag.length < 2 || tag.length > 15) return false
      return true
    }
    return src
      .split(",")
      .map((t) => t.trim())
      .filter(isValidTag)
      .slice(0, 5)
  }

  const cleanDescription = (desc: string | null): string | null => {
    if (!desc) return null
    let cleaned = desc
      .replace(/[\u{1F3F0}\u{1F4CB}\u{2728}\u{1F389}\u{1F490}\u{1F48D}]/gu, "")
      .replace(/[🏰📋✨🎉💐💍🏠🌿🌸💒👰🤵]/g, "")
      .replace(/\s*-\s*/g, " · ")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (cleaned.length > 150) cleaned = cleaned.slice(0, 150) + "..."
    return cleaned || null
  }

  return (
    <div className="my-3 w-full">
      <div className="relative">
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

        <div ref={containerRef} className="overflow-hidden rounded-xl">
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentIndex * 80}%)` }}
          >
            {recommendations.map((rec, idx) => {
              const tags = parseTags(rec)
              const desc = cleanDescription(rec.description)
              const priceStr = formatPrice(rec.price)

              return (
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
                      "cursor-pointer rounded-xl border bg-card shadow-sm transition-all duration-200 overflow-hidden",
                      "hover:shadow-lg hover:border-primary/40 hover:-translate-y-1",
                      "active:scale-[0.98] active:shadow-sm",
                      idx === currentIndex ? "opacity-100 scale-100 border-primary/20" : "opacity-60 scale-95"
                    )}
                  >
                    {/* 이미지 */}
                    {rec.imageUrl && (
                      <img
                        src={rec.imageUrl}
                        alt={rec.name}
                        className="h-40 w-full object-cover"
                      />
                    )}

                    <div className="p-3.5 space-y-2">
                      {/* 상단: 카테고리 + 평점 */}
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
                          categoryColor[rec.category] || "bg-gray-50 text-gray-600 border-gray-200"
                        )}>
                          {categoryLabel[rec.category] || rec.category}
                        </span>
                        {rec.rating != null && rec.rating > 0 && (
                          <span className="flex items-center gap-1 text-xs font-medium text-foreground/70">
                            <Star className="size-3.5 fill-yellow-400 text-yellow-400" />
                            {rec.rating}
                            {rec.reviewCount != null && rec.reviewCount > 0 && (
                              <span className="text-muted-foreground">({rec.reviewCount})</span>
                            )}
                          </span>
                        )}
                      </div>

                      {/* 업체명 */}
                      <h3 className="text-[15px] font-bold text-foreground leading-tight">
                        {rec.name}
                      </h3>

                      {/* 가격 + 위치 (한 줄에) */}
                      <div className="flex items-center justify-between gap-2">
                        {priceStr && (
                          <span className="text-sm font-semibold text-primary">{priceStr}</span>
                        )}
                        {rec.address && (
                          <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground truncate">
                            <MapPin className="size-3 flex-shrink-0" />
                            {rec.address}
                          </span>
                        )}
                      </div>

                      {/* 태그 뱃지 */}
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag, i) => (
                            <span
                              key={i}
                              className="rounded-full bg-muted/80 px-2 py-0.5 text-[11px] text-muted-foreground"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 설명 */}
                      {desc && (
                        <p className="text-xs leading-relaxed text-muted-foreground/80 line-clamp-3">
                          {desc}
                        </p>
                      )}

                      {/* 연락처 */}
                      {rec.contact && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-2 border-t border-border/40">
                          <Phone className="size-3 flex-shrink-0" />
                          <span>{rec.contact}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 페이지 인디케이터 */}
        {recommendations.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {recommendations.map((_, idx) => {
              const distance = Math.abs(idx - currentIndex)
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "rounded-full transition-all duration-200",
                    idx === currentIndex
                      ? "w-5 h-2 bg-primary"
                      : distance === 1
                        ? "w-2 h-2 bg-muted-foreground/40"
                        : "w-1.5 h-1.5 bg-muted-foreground/20"
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
