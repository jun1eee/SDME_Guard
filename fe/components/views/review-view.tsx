"use client"

import { useEffect, useState } from "react"
import { Star, Edit2, Trash2, X, Check, Loader2 } from "lucide-react"
import { getMyReviews, updateReview, deleteReview, type MyReviewItem } from "@/lib/api"
import { toast } from "sonner"

const categoryLabel: Record<string, string> = {
  STUDIO: "스튜디오",
  DRESS: "드레스",
  MAKEUP: "메이크업",
  HALL: "웨딩홀",
}

const categoryIcon: Record<string, string> = {
  STUDIO: "📷",
  DRESS: "👗",
  MAKEUP: "💄",
  HALL: "🏛️",
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

export function ReviewView({ onVendorClick }: { onVendorClick?: (vendorId: string) => void }) {
  const [reviews, setReviews] = useState<MyReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editRating, setEditRating] = useState(0)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    getMyReviews()
      .then(res => setReviews(res.data))
      .catch(() => toast.error("리뷰를 불러오지 못했습니다."))
      .finally(() => setLoading(false))
  }, [])

  const startEdit = (review: MyReviewItem) => {
    setEditingId(review.id)
    setEditContent(review.content)
    setEditRating(review.rating)
  }

  const cancelEdit = () => {
    setEditingId(null)
  }

  const saveEdit = async (id: number) => {
    if (!editContent.trim()) return
    setSaving(true)
    try {
      const res = await updateReview(id, { rating: editRating, content: editContent.trim() })
      setReviews(prev =>
        prev.map(r =>
          r.id === id
            ? { ...r, rating: res.data.rating, content: res.data.content, reviewedAt: res.data.reviewedAt }
            : r
        )
      )
      setEditingId(null)
      toast.success("리뷰가 수정되었습니다.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "리뷰 수정에 실패했습니다.")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeletingId(id)
    try {
      await deleteReview(id)
      setReviews(prev => prev.filter(r => r.id !== id))
      toast.success("리뷰가 삭제되었습니다.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "리뷰 삭제에 실패했습니다.")
    } finally {
      setDeletingId(null)
    }
  }

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : "-"

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Star className="size-6 fill-amber-400 text-amber-400" />
            <h1 className="text-2xl font-bold text-foreground">리뷰관리</h1>
          </div>
          <p className="mt-1 text-muted-foreground">이용한 업체의 리뷰를 관리하세요</p>
        </div>

        {/* Summary */}
        <div className="mb-6 flex gap-3">
          <div className="flex-1 rounded-xl bg-card p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{reviews.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">작성완료</p>
          </div>
          <div className="flex-1 rounded-xl bg-card p-4 shadow-sm text-center">
            <p className="text-2xl font-bold text-foreground">{avgRating}</p>
            <p className="text-xs text-muted-foreground mt-0.5">평균 평점</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Star className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">아직 작성한 리뷰가 없습니다</p>
            <p className="mt-1 text-xs text-muted-foreground">예약 완료 후 업체 페이지에서 리뷰를 작성할 수 있어요</p>
          </div>
        ) : (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              작성한 리뷰
            </h2>
            <div className="space-y-4">
              {reviews.map(review => (
                <div key={review.id} className="rounded-2xl bg-card p-5 shadow-sm">
                  {editingId === review.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{categoryIcon[review.vendorCategory] ?? "📋"}</span>
                        <div>
                          <button
                            type="button"
                            onClick={() => onVendorClick?.(String(review.vendorId))}
                            className="font-semibold text-foreground hover:text-primary hover:underline text-left"
                          >
                            {review.vendorName}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {categoryLabel[review.vendorCategory] ?? review.vendorCategory}
                          </p>
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
                          onClick={cancelEdit}
                          disabled={saving}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <X className="size-4" />
                          취소
                        </button>
                        <button
                          onClick={() => void saveEdit(review.id)}
                          disabled={saving || !editContent.trim()}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        >
                          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                          저장
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{categoryIcon[review.vendorCategory] ?? "📋"}</span>
                          <div>
                            <button
                              type="button"
                              onClick={() => onVendorClick?.(String(review.vendorId))}
                              className="font-semibold text-foreground hover:text-primary hover:underline text-left"
                            >
                              {review.vendorName}
                            </button>
                            <p className="text-xs text-muted-foreground">
                              {categoryLabel[review.vendorCategory] ?? review.vendorCategory}
                              {" · "}
                              {review.reviewedAt.split("T")[0]}
                            </p>
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
                            onClick={() => void handleDelete(review.id)}
                            disabled={deletingId === review.id}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                          >
                            {deletingId === review.id
                              ? <Loader2 className="size-4 animate-spin" />
                              : <Trash2 className="size-4" />}
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
      </div>
    </div>
  )
}
