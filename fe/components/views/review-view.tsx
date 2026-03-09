"use client"

import { useState } from "react"
import { Star, Edit2, Trash2, Plus, X, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Review {
  id: string
  vendor: string
  category: string
  rating: number
  content: string
  date: string
  status: "작성완료" | "임시저장"
}

const initialReviews: Review[] = [
  {
    id: "1",
    vendor: "더 그랜드 파빌리온",
    category: "웨딩홀",
    rating: 5,
    content:
      "정말 아름다운 웨딩홀이었어요. 직원분들도 너무 친절하시고, 음식도 맛있었습니다. 강력 추천드려요!",
    date: "2026-02-28",
    status: "작성완료",
  },
  {
    id: "2",
    vendor: "로앤스튜디오",
    category: "스튜디오",
    rating: 4,
    content: "사진이 너무 예쁘게 나왔어요. 다만 대기 시간이 좀 길었습니다.",
    date: "2026-02-20",
    status: "작성완료",
  },
  {
    id: "3",
    vendor: "글로우 뷰티",
    category: "메이크업",
    rating: 0,
    content: "",
    date: "",
    status: "임시저장",
  },
]

const categoryIcon: Record<string, string> = {
  웨딩홀: "🏛️",
  스튜디오: "📷",
  드레스: "👗",
  메이크업: "💄",
}

function StarRating({
  value,
  onChange,
  readonly,
}: {
  value: number
  onChange?: (v: number) => void
  readonly?: boolean
}) {
  const [hovered, setHovered] = useState(0)

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="disabled:cursor-default"
        >
          <Star
            className={`size-5 transition-colors ${
              star <= (hovered || value)
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  )
}

export function ReviewView() {
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editRating, setEditRating] = useState(0)

  const startEdit = (review: Review) => {
    setEditingId(review.id)
    setEditContent(review.content)
    setEditRating(review.rating)
  }

  const saveEdit = (id: string) => {
    setReviews(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              content: editContent,
              rating: editRating,
              status: "작성완료" as const,
              date: new Date().toISOString().slice(0, 10),
            }
          : r
      )
    )
    setEditingId(null)
  }

  const deleteReview = (id: string) => {
    setReviews(prev => prev.filter(r => r.id !== id))
  }

  const completed = reviews.filter(r => r.status === "작성완료")
  const drafts = reviews.filter(r => r.status === "임시저장")

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Star className="size-6 fill-amber-400 text-amber-400" />
            <h1 className="text-2xl font-bold text-foreground">리뷰관리</h1>
          </div>
          <p className="mt-1 text-muted-foreground">이용한 업체의 리뷰를 작성하고 관리하세요</p>
        </div>

        {/* Summary */}
        <div className="mb-6 flex gap-3">
          <div className="flex-1 rounded-xl bg-card p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{completed.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">작성완료</p>
          </div>
          <div className="flex-1 rounded-xl bg-card p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{drafts.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">미작성</p>
          </div>
          <div className="flex-1 rounded-xl bg-card p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">
              {completed.length > 0
                ? (completed.reduce((s, r) => s + r.rating, 0) / completed.length).toFixed(1)
                : "-"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">평균 평점</p>
          </div>
        </div>

        {/* Draft Reviews (미작성) */}
        {drafts.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              작성 대기
            </h2>
            <div className="space-y-3">
              {drafts.map(review => (
                <div key={review.id} className="rounded-2xl bg-card p-4 shadow-sm border-2 border-dashed border-amber-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{categoryIcon[review.category] ?? "📋"}</span>
                      <div>
                        <p className="font-semibold text-foreground">{review.vendor}</p>
                        <p className="text-xs text-muted-foreground">{review.category}</p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => startEdit(review)}
                      className="gap-1.5"
                    >
                      <Plus className="size-3.5" />
                      리뷰 작성
                    </Button>
                  </div>

                  {/* Editing inline */}
                  {editingId === review.id && (
                    <div className="mt-4 space-y-3 border-t border-border pt-4">
                      <div>
                        <p className="mb-2 text-sm font-medium text-foreground">평점</p>
                        <StarRating value={editRating} onChange={setEditRating} />
                      </div>
                      <div>
                        <p className="mb-2 text-sm font-medium text-foreground">리뷰 내용</p>
                        <textarea
                          className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          rows={4}
                          placeholder="이용 후기를 작성해주세요"
                          value={editContent}
                          onChange={e => setEditContent(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted"
                        >
                          <X className="size-4" />
                          취소
                        </button>
                        <button
                          onClick={() => saveEdit(review.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                          <Check className="size-4" />
                          등록
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Reviews */}
        {completed.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              작성한 리뷰
            </h2>
            <div className="space-y-4">
              {completed.map(review => (
                <div key={review.id} className="rounded-2xl bg-card p-5 shadow-sm">
                  {editingId === review.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{categoryIcon[review.category] ?? "📋"}</span>
                        <div>
                          <p className="font-semibold text-foreground">{review.vendor}</p>
                          <p className="text-xs text-muted-foreground">{review.category}</p>
                        </div>
                      </div>
                      <StarRating value={editRating} onChange={setEditRating} />
                      <textarea
                        className="w-full resize-none rounded-lg border border-border bg-background p-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        rows={4}
                        value={editContent}
                        onChange={e => setEditContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingId(null)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted"
                        >
                          <X className="size-4" />
                          취소
                        </button>
                        <button
                          onClick={() => saveEdit(review.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                          <Check className="size-4" />
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{categoryIcon[review.category] ?? "📋"}</span>
                          <div>
                            <p className="font-semibold text-foreground">{review.vendor}</p>
                            <p className="text-xs text-muted-foreground">{review.category} · {review.date}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(review)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Edit2 className="size-4" />
                          </button>
                          <button
                            onClick={() => deleteReview(review.id)}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3">
                        <StarRating value={review.rating} readonly />
                      </div>

                      <p className="mt-2.5 text-sm text-foreground leading-relaxed">
                        {review.content}
                      </p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {reviews.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Star className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">아직 작성한 리뷰가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}
