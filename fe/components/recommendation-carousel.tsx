"use client"

import { useState, useRef, useCallback } from "react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Star, Phone, MapPin } from "lucide-react"
import type { AiRecommendation } from "@/lib/api"

interface RecommendationCarouselProps {
  recommendations: AiRecommendation[]
  onCardClick?: (rec: AiRecommendation) => void
}

export function RecommendationCarousel({ recommendations, onCardClick }: RecommendationCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const dragRef = useRef({ startX: 0, isDragging: false, moved: false })

  if (!recommendations || recommendations.length === 0) return null

  const total = recommendations.length
  const CARD_WIDTH = 70 // % per card slide

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(((idx % total) + total) % total)
  }, [total])

  const prev = () => goTo(currentIndex - 1)
  const next = () => goTo(currentIndex + 1)

  // ── 드래그 핸들러 ──
  const onPointerDown = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, isDragging: true, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return
    const diff = Math.abs(e.clientX - dragRef.current.startX)
    if (diff > 8) dragRef.current.moved = true
  }

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.isDragging) return
    const diff = e.clientX - dragRef.current.startX
    dragRef.current.isDragging = false
    if (Math.abs(diff) > 40) {
      diff > 0 ? prev() : next()
    }
  }

  // ── 유틸 ──
  const categoryLabel: Record<string, string> = {
    studio: "STUDIO", dress: "DRESS", makeup: "MAKEUP", venue: "HALL",
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

  const shortenAddress = (addr: string | null): string | null => {
    if (!addr) return null
    let short = addr
      .replace(/특별시|광역시/g, "")
      .replace(/\d+층/g, "")
      .replace(/\s+지하\d?F?/gi, "")
      .replace(/\(.*?\)/g, "")
      .replace(/\d+-\d+/g, "")
      .replace(/\s+\d+$/, "")
      .trim()
    const parts = short.split(/\s+/)
    if (parts.length > 3) short = parts.slice(0, 3).join(" ")
    return short || null
  }

  const parseTags = (rec: AiRecommendation): string[] => {
    const src = rec.hashtags || rec.reason || ""
    const isValid = (tag: string) =>
      tag.length >= 2 && tag.length <= 15 &&
      !/^\d+$/.test(tag) && !/\d+원/.test(tag) && !/식대\s*\d/.test(tag)
    return src.split(/[|,]/).map((t) => t.trim()).filter(isValid).slice(0, 5)
  }

  const cleanDescription = (desc: string | null): string | null => {
    if (!desc) return null
    let cleaned = desc
      .replace(/[\u{1F3F0}\u{1F4CB}\u{2728}\u{1F389}\u{1F490}\u{1F48D}]/gu, "")
      .replace(/[🏰📋✨🎉💐💍🏠🌿🌸💒👰🤵]/g, "")
      .replace(/\s*-\s*/g, " · ")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (cleaned.length > 120) cleaned = cleaned.slice(0, 120) + "..."
    return cleaned || null
  }

  return (
    <div className="my-3 w-full select-none">
      <div className="relative">
        {/* 좌우 화살표 */}
        {total > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md border border-border hover:bg-muted transition-colors"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={next}
              className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background/90 p-1.5 shadow-md border border-border hover:bg-muted transition-colors"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}

        {/* 캐러셀 본체 */}
        <div
          className="overflow-hidden rounded-xl touch-pan-y"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div
            className="flex transition-transform duration-300 ease-out"
            style={{ transform: `translateX(-${currentIndex * CARD_WIDTH}%)` }}
          >
            {recommendations.map((rec, idx) => {
              const tags = parseTags(rec)
              const desc = cleanDescription(rec.description)
              const priceStr = formatPrice(rec.price)
              const isActive = idx === currentIndex

              return (
                <div
                  key={`${rec.id}-${idx}`}
                  className="flex-shrink-0 px-1.5"
                  style={{ width: `${CARD_WIDTH}%` }}
                >
                  <div
                    onClick={() => {
                      if (dragRef.current.moved) return
                      if (!isActive) goTo(idx)
                      onCardClick?.(rec)
                    }}
                    className={cn(
                      "cursor-pointer rounded-xl border bg-card shadow-sm transition-all duration-200 overflow-hidden",
                      "hover:shadow-lg hover:border-primary/40",
                      isActive
                        ? "opacity-100 scale-100 border-primary/20"
                        : "opacity-50 scale-[0.92]"
                    )}
                  >
                    {rec.imageUrl && (
                      <img src={rec.imageUrl} alt={rec.name} className="h-36 w-full object-cover" draggable={false} />
                    )}
                    <div className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide",
                          categoryColor[rec.category] || "bg-gray-50 text-gray-600 border-gray-200"
                        )}>
                          {categoryLabel[rec.category] || rec.category}
                        </span>
                        {rec.rating != null && rec.rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs font-medium text-foreground/70">
                            <Star className="size-3 fill-yellow-400 text-yellow-400" />
                            {rec.rating > 5 ? (rec.rating / 20).toFixed(1) : rec.rating}
                            {rec.reviewCount != null && rec.reviewCount > 0 && (
                              <span className="text-muted-foreground text-[10px]">({rec.reviewCount})</span>
                            )}
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-foreground leading-tight truncate">{rec.name}</h3>

                      {priceStr && <p className="text-sm font-semibold text-primary">{priceStr}</p>}

                      {rec.address && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <MapPin className="size-2.5 flex-shrink-0" />
                          <span className="truncate">{shortenAddress(rec.address)}</span>
                        </div>
                      )}

                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag, i) => (
                            <span key={i} className="rounded-full bg-muted/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {desc && (
                        <p className="text-[11px] leading-relaxed text-muted-foreground/80 line-clamp-2">{desc}</p>
                      )}

                      {rec.contact && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
                          <Phone className="size-2.5 flex-shrink-0" />
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

        {/* 인디케이터 */}
        {total > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
            {recommendations.map((_, idx) => (
              <button
                key={idx}
                onClick={() => goTo(idx)}
                className={cn(
                  "rounded-full transition-all duration-200",
                  idx === currentIndex
                    ? "w-5 h-2 bg-primary"
                    : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
