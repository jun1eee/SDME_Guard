"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { getVoteItems, deleteVote, deleteVoteItem } from "@/lib/api"
import {
  Lock, CheckCircle2, Clock,
  Sparkles, Heart, MessageSquareDiff,
  RotateCcw, Trash2, ChevronDown,
  ThumbsUp, ThumbsDown, Minus, EyeOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// ─── Types ──────────────────────────────────────────────────────────────────

type VoteScore = "great" | "good" | "neutral" | "bad" | "discuss"

interface VoteOption {
  value: VoteScore
  label: string
  icon: "heart" | "thumbsUp" | "minus" | "thumbsDown" | "messageCircle"
  selectedBg: string
  selectedText: string
  selectedRing: string
}

const VOTE_OPTIONS: VoteOption[] = [
  {
    value: "great",
    label: "강추",
    icon: "heart",
    selectedBg: "bg-slate-50 dark:bg-slate-800/60",
    selectedText: "text-slate-600 dark:text-slate-400",
    selectedRing: "ring-2 ring-slate-400",
  },
  {
    value: "good",
    label: "좋아요",
    icon: "thumbsUp",
    selectedBg: "bg-slate-50 dark:bg-slate-800/60",
    selectedText: "text-slate-600 dark:text-slate-400",
    selectedRing: "ring-2 ring-slate-400",
  },
  {
    value: "neutral",
    label: "글쎄",
    icon: "minus",
    selectedBg: "bg-slate-50 dark:bg-slate-800/60",
    selectedText: "text-slate-600 dark:text-slate-400",
    selectedRing: "ring-2 ring-slate-400",
  },
  {
    value: "bad",
    label: "별로",
    icon: "thumbsDown",
    selectedBg: "bg-slate-50 dark:bg-slate-800/60",
    selectedText: "text-slate-600 dark:text-slate-400",
    selectedRing: "ring-2 ring-slate-400",
  },
  {
    value: "discuss",
    label: "관심없음",
    icon: "messageCircle",
    selectedBg: "bg-slate-50 dark:bg-slate-800/60",
    selectedText: "text-slate-600 dark:text-slate-400",
    selectedRing: "ring-2 ring-slate-400",
  },
]

const VOTE_ICONS: Record<VoteOption["icon"], typeof Heart> = {
  heart: Heart,
  thumbsUp: ThumbsUp,
  minus: Minus,
  thumbsDown: ThumbsDown,
  messageCircle: EyeOff,
}

const scoreLabel: Record<VoteScore, { icon: VoteOption["icon"]; label: string; badgeBg: string; badgeText: string }> = {
  great: { icon: "heart", label: "강추", badgeBg: "bg-rose-50 dark:bg-rose-950/40", badgeText: "text-rose-600 dark:text-rose-400" },
  good: { icon: "thumbsUp", label: "좋아요", badgeBg: "bg-blue-50 dark:bg-blue-950/40", badgeText: "text-blue-600 dark:text-blue-400" },
  neutral: { icon: "minus", label: "글쎄", badgeBg: "bg-amber-50 dark:bg-amber-950/40", badgeText: "text-amber-600 dark:text-amber-400" },
  bad: { icon: "thumbsDown", label: "별로", badgeBg: "bg-slate-100 dark:bg-slate-800/60", badgeText: "text-slate-500 dark:text-slate-400" },
  discuss: { icon: "messageCircle", label: "관심없음", badgeBg: "bg-purple-50 dark:bg-purple-950/40", badgeText: "text-purple-600 dark:text-purple-400" },
}

type Source = "ai" | "my-wish" | "partner-share"

export interface VendorItem {
  id: string
  category: "웨딩홀" | "스튜디오" | "드레스" | "메이크업"
  name: string
  location: string
  price: string
  source: Source
  imageEmoji: string
  imageBg: string
  partnerVoted: boolean
}

interface MyVote {
  score: VoteScore
  reason: string
  isEdited: boolean
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const INITIAL_ITEMS: VendorItem[] = []

const CATEGORY_ORDER = ["웨딩홀", "스튜디오", "드레스", "메이크업"] as const

const CATEGORY_ICON: Record<string, string> = {
  웨딩홀: "🏛️",
  스튜디오: "📷",
  드레스: "👗",
  메이크업: "💄",
}


// ─── Compact Vote Row ────────────────────────────────────────────────────────

function CompactVoteRow({
  item,
  myVote,
  isExpanded,
  onToggle,
  currentUser,
  onVoteSubmit,
  onVoteDelete,
  onItemDelete,
}: {
  item: VendorItem
  myVote: MyVote | null
  isExpanded: boolean
  onToggle: () => void
  currentUser: "groom" | "bride"
  onVoteSubmit: (id: string, score: VoteScore, reason: string) => void
  onVoteDelete: (id: string) => void
  onItemDelete: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedScore, setSelectedScore] = useState<VoteScore | null>(myVote?.score ?? null)
  const [reason, setReason] = useState(myVote?.reason ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmItemDelete, setConfirmItemDelete] = useState(false)

  const isVoted = !!myVote

  const handleSubmit = () => {
    if (!selectedScore) return
    onVoteSubmit(item.id, selectedScore, reason)
    setIsEditing(false)
  }

  const handleEdit = () => {
    setSelectedScore(myVote?.score ?? null)
    setReason(myVote?.reason ?? "")
    setIsEditing(true)
  }

  const handleCancel = () => {
    if (!myVote) return
    setSelectedScore(myVote.score)
    setReason(myVote.reason)
    setIsEditing(false)
  }

  // 펼칠 때 미투표면 자동으로 편집 모드
  useEffect(() => {
    if (isExpanded && !myVote) {
      setIsEditing(true)
    }
  }, [isExpanded, myVote])

  return (
    <div className="border-b border-border last:border-b-0">
      {/* 컴팩트 행 */}
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/30"
      >
        {/* 업체명 + 가격 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground">{item.location} · {item.price}</p>
        </div>

        {/* 투표 상태 뱃지 */}
        <div className="shrink-0">
          {myVote ? (() => {
            const sl = scoreLabel[myVote.score]
            const Icon = VOTE_ICONS[sl.icon]
            return (
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${sl.badgeBg} ${sl.badgeText}`}>
                <Icon className="size-3" />
                {sl.label}
              </span>
            )
          })() : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              미투표
            </span>
          )}
        </div>

        {/* 파트너 투표 여부 */}
        <div className="shrink-0">
          {item.partnerVoted ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            <Clock className="size-4 text-muted-foreground/40" />
          )}
        </div>

        {/* 펼치기 화살표 */}
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {/* 펼쳐진 영역 */}
      {isExpanded && (
        <div className="border-t border-border/60 bg-muted/20 px-4 py-3 space-y-3">
          {/* 파트너 상태 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.partnerVoted ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                <span>{currentUser === "groom" ? "신부" : "신랑"} 투표 완료</span>
                {!myVote && <Lock className="size-3 opacity-60" />}
              </>
            ) : (
              <>
                <Clock className="size-3.5" />
                <span>{currentUser === "groom" ? "신부" : "신랑"} 아직 투표 안 함</span>
              </>
            )}
          </div>

          {/* 항목 삭제 확인 */}
          {confirmItemDelete && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
              <p className="text-sm text-foreground font-medium">이 항목을 삭제할까요?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmItemDelete(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => onItemDelete(item.id)}
                  className="flex-1 rounded-lg bg-destructive py-2 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          {/* 투표 결과 (투표 완료 + 편집 아닌 상태) */}
          {isVoted && !isEditing && myVote && !confirmDelete && (
            <div className="rounded-xl bg-background border border-border/60 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {(() => {
                    const sl = scoreLabel[myVote.score]
                    const Icon = VOTE_ICONS[sl.icon]
                    return (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${sl.badgeBg} ${sl.badgeText}`}>
                        <Icon className="size-3.5" />
                        {sl.label}
                      </span>
                    )
                  })()}
                  {myVote.reason && (
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">"{myVote.reason}"</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleEdit}
                    className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => setConfirmDelete(true)}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 투표 삭제 확인 */}
          {confirmDelete && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
              <p className="text-sm text-foreground font-medium">투표를 삭제할까요?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    onVoteDelete(item.id)
                    setSelectedScore(null)
                    setReason("")
                    setConfirmDelete(false)
                    setIsEditing(true)
                  }}
                  className="flex-1 rounded-lg bg-destructive py-2 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                >
                  삭제
                </button>
              </div>
            </div>
          )}

          {/* 투표 폼 */}
          {isEditing && (
            <div className="space-y-3">
              <div className="grid grid-cols-5 gap-1.5">
                {VOTE_OPTIONS.map(option => {
                  const Icon = VOTE_ICONS[option.icon]
                  const isSelected = selectedScore === option.value
                  return (
                    <button
                      key={option.value}
                      onClick={() => setSelectedScore(option.value)}
                      className={`flex flex-col items-center gap-1.5 rounded-xl p-2.5 text-center transition-all ${
                        isSelected
                          ? `${option.selectedBg} ${option.selectedRing} scale-105`
                          : "bg-background hover:bg-muted"
                      }`}
                    >
                      <Icon className={`size-5 ${
                        isSelected ? option.selectedText : "text-muted-foreground"
                      }`} />
                      <span className={`text-[10px] font-medium leading-tight ${
                        isSelected ? option.selectedText : "text-muted-foreground"
                      }`}>
                        {option.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              <Textarea
                placeholder="이유를 적어보세요 (선택사항)"
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={2}
                className="resize-none text-sm bg-background border-border/60 placeholder:text-muted-foreground/60"
              />

              <div className="flex gap-2">
                {myVote && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="flex-1 text-muted-foreground"
                  >
                    취소
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!selectedScore}
                  className={`${myVote ? "flex-1" : "w-full"} bg-primary hover:bg-primary/90 text-white disabled:opacity-40`}
                >
                  {myVote ? "수정 완료" : "투표하기"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Progress Summary Bar ─────────────────────────────────────────────────────

function VoteProgressBar({
  total,
  myCount,
  partnerCount,
  currentUser,
}: {
  total: number
  myCount: number
  partnerCount: number
  currentUser: "groom" | "bride"
}) {
  const myLabel = currentUser === "groom" ? "신랑" : "신부"
  const partnerLabel = currentUser === "groom" ? "신부" : "신랑"

  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">투표 현황</h2>
        <span className="text-xs text-muted-foreground">{total}개 업체</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className={`font-medium ${currentUser === "groom" ? "text-blue-600" : "text-primary"}`}>
              {myLabel} (나)
            </span>
            <span className="text-muted-foreground">{myCount}/{total}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                currentUser === "groom" ? "bg-blue-400" : "bg-primary"
              }`}
              style={{ width: `${total > 0 ? (myCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className={`font-medium ${currentUser === "groom" ? "text-primary" : "text-blue-600"}`}>
              {partnerLabel}
            </span>
            <span className="text-muted-foreground">{partnerCount}/{total}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                currentUser === "groom" ? "bg-primary" : "bg-blue-400"
              }`}
              style={{ width: `${total > 0 ? (partnerCount / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
      {myCount === total && partnerCount === total && total > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          두 분 모두 투표 완료! 결과를 확인해보세요
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function VoteView({
  currentUser,
  pendingItems = [],
  refreshKey = 0,
  onVoteSubmitApi,
}: {
  currentUser: "groom" | "bride"
  pendingItems?: VendorItem[]
  refreshKey?: number
  onVoteSubmitApi?: (vendorId: string, score: string, reason: string) => void
}) {
  const [items, setItems] = useState<VendorItem[]>([])
  const prevPendingLengthRef = useRef(0)

  const CATEGORY_MAP: Record<string, VendorItem["category"]> = {
    STUDIO: "스튜디오", DRESS: "드레스", MAKEUP: "메이크업", HALL: "웨딩홀",
    studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀",
  }
  const EMOJI_MAP: Record<string, string> = {
    "웨딩홀": "🏛️", "스튜디오": "📷", "드레스": "👗", "메이크업": "💄",
  }
  const BG_MAP: Record<string, string> = {
    "웨딩홀": "bg-rose-100", "스튜디오": "bg-purple-100", "드레스": "bg-pink-100", "메이크업": "bg-amber-100",
  }

  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({})

  // DB에서 투표 항목 로드
  useEffect(() => {
    getVoteItems()
      .then((res) => {
        const loaded: VendorItem[] = res.data.map((v) => {
          const cat = CATEGORY_MAP[v.category] ?? "웨딩홀"
          return {
            id: v.id.toString(),
            category: cat,
            name: v.vendorName || "",
            location: "",
            price: v.price ? `${v.price.toLocaleString()}원` : "",
            source: (v.sourceType === "my_wish" ? "my-wish" : v.sourceType === "partner_share" ? "partner-share" : "ai") as Source,
            imageEmoji: EMOJI_MAP[cat] || "🏛️",
            imageBg: BG_MAP[cat] || "bg-rose-100",
            partnerVoted: v.partnerVoted,
          }
        })
        setItems(loaded)
        // 기존 투표 복원
        const votes: Record<string, MyVote> = {}
        res.data.forEach((v) => {
          if (v.myScore) {
            votes[v.id.toString()] = { score: v.myScore as VoteScore, reason: v.myReason || "", isEdited: false }
          }
        })
        setMyVotes(votes)
      })
      .catch(() => {})
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // 로컬에서 추가된 항목 반영
  useEffect(() => {
    if (pendingItems.length > prevPendingLengthRef.current) {
      const newItems = pendingItems.slice(prevPendingLengthRef.current)
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id))
        return [...prev, ...newItems.filter(i => !existingIds.has(i.id))]
      })
    }
    prevPendingLengthRef.current = pendingItems.length
  }, [pendingItems])
  const [filter, setFilter] = useState<"전체" | "미투표" | "투표완료">("전체")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER))
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<string | null>(null)

  const handleVoteSubmit = (id: string, score: VoteScore, reason: string) => {
    setMyVotes(prev => ({
      ...prev,
      [id]: { score, reason, isEdited: !!prev[id] },
    }))
    // DB에도 저장
    const item = items.find(i => i.id === id)
    if (item) {
      onVoteSubmitApi?.(item.id, score, reason)
    }
  }

  const handleVoteDelete = (id: string) => {
    setMyVotes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    const numId = Number(id)
    if (numId) deleteVote(numId).catch(() => {})
  }

  const handleItemDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    setMyVotes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    if (expandedId === id) setExpandedId(null)
    const numId = Number(id)
    if (numId) deleteVoteItem(numId).catch(() => {})
  }

  const myVoteCount = Object.keys(myVotes).length
  const partnerVoteCount = items.filter(i => i.partnerVoted).length

  const filteredItems = items.filter(item => {
    if (filter === "미투표") return !myVotes[item.id]
    if (filter === "투표완료") return !!myVotes[item.id]
    return true
  })

  // 카테고리별 그룹핑
  const grouped = useMemo(() => {
    const map: Record<string, VendorItem[]> = {}
    for (const item of filteredItems) {
      if (!map[item.category]) map[item.category] = []
      map[item.category].push(item)
    }
    return CATEGORY_ORDER
      .filter(cat => map[cat] && map[cat].length > 0)
      .map(cat => ({ category: cat, items: map[cat] }))
  }, [filteredItems])

  const categories = ["전체", "미투표", "투표완료"] as const

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 space-y-5">

        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Lock className="size-4 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">비밀 투표</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            각자 비밀리에 투표해요. 투표 결과는 AI 추천에 반영돼요.
          </p>
        </div>

        {/* Progress */}
        <VoteProgressBar
          total={items.length}
          myCount={myVoteCount}
          partnerCount={partnerVoteCount}
          currentUser={currentUser}
        />

        {/* Filter tabs */}
        <div className="flex gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === cat
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
              {cat === "미투표" && (
                <span className="ml-1 text-xs opacity-80">
                  ({items.length - myVoteCount})
                </span>
              )}
              {cat === "투표완료" && (
                <span className="ml-1 text-xs opacity-80">
                  ({myVoteCount})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 rounded-xl bg-muted/60 border border-border px-3 py-2.5">
          <Lock className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            내 투표는 상대방에게 보이지 않아요.
          </p>
        </div>

        {/* 카테고리별 그룹 */}
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="size-12 text-primary/30 mb-3" />
            <p className="font-medium text-foreground">
              {filter === "미투표" ? "모든 업체에 투표했어요!" : "투표한 업체가 없어요"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {filter === "미투표" ? "파트너도 투표를 마치길 기다려보세요." : "업체에 투표해보세요."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map(({ category, items: catItems }) => {
              const votedCount = catItems.filter(i => myVotes[i.id]).length
              return (
                <div key={category} className="overflow-hidden rounded-2xl bg-card border border-border shadow-sm">
                  {/* 카테고리 헤더 */}
                  <div className="flex w-full items-center justify-between px-4 py-3 bg-muted/30">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setCollapsedCategories(prev => {
                          const next = new Set(prev)
                          next.has(category) ? next.delete(category) : next.add(category)
                          return next
                        })}
                        className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
                      >
                        <h3 className="text-sm font-semibold text-foreground">
                          <span className="mr-1.5">{CATEGORY_ICON[category]}</span>
                          {category}
                        </h3>
                      </button>
                      {/* 카테고리 항목 삭제 버튼 */}
                      <button
                        onClick={() => setConfirmDeleteCategory(category)}
                        className="rounded p-1 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        title="항목 삭제"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => setCollapsedCategories(prev => {
                        const next = new Set(prev)
                        next.has(category) ? next.delete(category) : next.add(category)
                        return next
                      })}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <span className="text-xs text-muted-foreground">
                        {votedCount}/{catItems.length} 투표
                      </span>
                      <ChevronDown className={`size-4 text-muted-foreground transition-transform ${collapsedCategories.has(category) ? "-rotate-90" : ""}`} />
                    </button>
                  </div>

                  {/* 카테고리 항목 삭제 확인 */}
                  {confirmDeleteCategory === category && (
                    <div className="mx-3 mb-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
                      <p className="text-sm text-foreground font-medium">
                        {catItems.length === 1 ? "이 항목을 삭제할까요?" : `${category} 항목 ${catItems.length}개를 모두 삭제할까요?`}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setConfirmDeleteCategory(null)}
                          className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => {
                            catItems.forEach(i => handleItemDelete(i.id))
                            setConfirmDeleteCategory(null)
                          }}
                          className="flex-1 rounded-lg bg-destructive py-2 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 업체 리스트 */}
                  {!collapsedCategories.has(category) && catItems.map(item => (
                    <CompactVoteRow
                      key={item.id}
                      item={item}
                      myVote={myVotes[item.id] ?? null}
                      isExpanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      currentUser={currentUser}
                      onVoteSubmit={handleVoteSubmit}
                      onVoteDelete={handleVoteDelete}
                      onItemDelete={handleItemDelete}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
