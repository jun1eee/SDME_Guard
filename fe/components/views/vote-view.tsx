"use client"

import { useState, useRef, useEffect } from "react"
import {
  Lock, CheckCircle2, Clock,
  Sparkles, Heart, MessageSquareDiff,
  RotateCcw, Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

// ─── Types ──────────────────────────────────────────────────────────────────

type VoteScore = "great" | "good" | "neutral" | "bad" | "discuss"

interface VoteOption {
  value: VoteScore
  label: string
  emoji: string
  color: string
  selectedBg: string
  selectedText: string
  selectedRing: string
}

const VOTE_OPTIONS: VoteOption[] = [
  {
    value: "great",
    label: "매우 좋음",
    emoji: "💕",
    color: "text-rose-500",
    selectedBg: "bg-rose-50 dark:bg-rose-950/40",
    selectedText: "text-rose-600 dark:text-rose-400",
    selectedRing: "ring-2 ring-rose-400",
  },
  {
    value: "good",
    label: "좋음",
    emoji: "😊",
    color: "text-pink-500",
    selectedBg: "bg-pink-50 dark:bg-pink-950/40",
    selectedText: "text-pink-600 dark:text-pink-400",
    selectedRing: "ring-2 ring-pink-400",
  },
  {
    value: "neutral",
    label: "보통",
    emoji: "😐",
    color: "text-amber-500",
    selectedBg: "bg-amber-50 dark:bg-amber-950/40",
    selectedText: "text-amber-600 dark:text-amber-400",
    selectedRing: "ring-2 ring-amber-400",
  },
  {
    value: "bad",
    label: "별로",
    emoji: "😕",
    color: "text-slate-500",
    selectedBg: "bg-slate-50 dark:bg-slate-800/60",
    selectedText: "text-slate-600 dark:text-slate-400",
    selectedRing: "ring-2 ring-slate-400",
  },
  {
    value: "discuss",
    label: "개별로",
    emoji: "🤝",
    color: "text-purple-500",
    selectedBg: "bg-purple-50 dark:bg-purple-950/40",
    selectedText: "text-purple-600 dark:text-purple-400",
    selectedRing: "ring-2 ring-purple-400",
  },
]

const scoreLabel: Record<VoteScore, string> = {
  great: "💕 매우 좋음",
  good: "😊 좋음",
  neutral: "😐 보통",
  bad: "😕 별로",
  discuss: "🤝 개별로",
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

const INITIAL_ITEMS: VendorItem[] = [
  {
    id: "1",
    category: "웨딩홀",
    name: "더 그랜드 파빌리온",
    location: "서울 강남구",
    price: "800~1,000만원",
    source: "ai",
    imageEmoji: "🏛️",
    imageBg: "bg-rose-100",
    partnerVoted: true,
  },
  {
    id: "2",
    category: "스튜디오",
    name: "로앤스튜디오",
    location: "서울 마포구",
    price: "200~350만원",
    source: "my-wish",
    imageEmoji: "📷",
    imageBg: "bg-purple-100",
    partnerVoted: false,
  },
  {
    id: "3",
    category: "드레스",
    name: "모니카블랑쉬",
    location: "서울 서초구",
    price: "150~300만원",
    source: "partner-share",
    imageEmoji: "👗",
    imageBg: "bg-pink-100",
    partnerVoted: true,
  },
  {
    id: "4",
    category: "메이크업",
    name: "글로우 뷰티",
    location: "서울 강남구",
    price: "80~150만원",
    source: "ai",
    imageEmoji: "💄",
    imageBg: "bg-amber-100",
    partnerVoted: true,
  },
  {
    id: "5",
    category: "웨딩홀",
    name: "아펠가모 청담",
    location: "서울 강남구",
    price: "600~900만원",
    source: "ai",
    imageEmoji: "💍",
    imageBg: "bg-emerald-100",
    partnerVoted: false,
  },
]

// ─── Source Badge ─────────────────────────────────────────────────────────────

function SourceBadge({ source }: { source: Source }) {
  if (source === "ai") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-600 dark:bg-violet-950/50 dark:text-violet-400">
        <Sparkles className="size-3" />
        AI 추천
      </span>
    )
  }
  if (source === "my-wish") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
        <Heart className="size-3 fill-current" />
        내가 찜
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
      <MessageSquareDiff className="size-3" />
      파트너 공유
    </span>
  )
}

// ─── Category Badge ───────────────────────────────────────────────────────────

const categoryStyle: Record<string, string> = {
  웨딩홀: "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400",
  스튜디오: "bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400",
  드레스: "bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400",
  메이크업: "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400",
}

// ─── Vote Card ────────────────────────────────────────────────────────────────

function VoteCard({
  item,
  myVote,
  currentUser,
  onVoteSubmit,
  onVoteDelete,
  onItemDelete,
}: {
  item: VendorItem
  myVote: MyVote | null
  currentUser: "groom" | "bride"
  onVoteSubmit: (id: string, score: VoteScore, reason: string) => void
  onVoteDelete: (id: string) => void
  onItemDelete: (id: string) => void
}) {
  const [isEditing, setIsEditing] = useState(!myVote)
  const [selectedScore, setSelectedScore] = useState<VoteScore | null>(myVote?.score ?? null)
  const [reason, setReason] = useState(myVote?.reason ?? "")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmItemDelete, setConfirmItemDelete] = useState(false)

  const bothVoted = myVote && item.partnerVoted
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

  const currentOption = VOTE_OPTIONS.find(o => o.value === selectedScore)

  return (
    <div className={`overflow-hidden rounded-2xl bg-card shadow-sm transition-shadow hover:shadow-md ${
      isVoted && !isEditing ? "border border-border" : "border-2 border-primary/20"
    }`}>
      {/* Vendor Info */}
      <div className="flex items-start gap-3 p-4">
        <div className={`flex size-14 shrink-0 items-center justify-center rounded-xl text-2xl ${item.imageBg}`}>
          {item.imageEmoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${categoryStyle[item.category] ?? ""}`}>
              {item.category}
            </span>
            <SourceBadge source={item.source} />
            {myVote?.isEdited && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <RotateCcw className="size-2.5" />
                수정됨
              </span>
            )}
          </div>
          <h3 className="font-semibold text-foreground truncate">{item.name}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{item.location} · {item.price}</p>
        </div>
        {/* Item delete button */}
        <button
          onClick={() => setConfirmItemDelete(true)}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
          aria-label="투표 항목 삭제"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Item delete confirm */}
      {confirmItemDelete && (
        <div className="mx-4 mb-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
          <p className="text-sm text-foreground font-medium">이 항목을 목록에서 삭제할까요?</p>
          <p className="text-xs text-muted-foreground">투표 목록에서 완전히 제거돼요.</p>
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
              삭제하기
            </button>
          </div>
        </div>
      )}

      {/* Partner Status Strip */}
      <div className="mx-4 mb-3 flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
            currentUser === "groom"
              ? "bg-pink-100 text-pink-600"
              : "bg-blue-100 text-blue-600"
          }`}>
            {currentUser === "groom" ? "신" : "신"}
          </div>
          <span className="text-xs text-muted-foreground">
            {currentUser === "groom" ? "신부" : "신랑"}의 투표
          </span>
        </div>
        {item.partnerVoted ? (
          <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            투표 완료
            {!bothVoted && <Lock className="size-3 ml-0.5 opacity-60" />}
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" />
            아직 투표 안 함
          </div>
        )}
      </div>

      {/* Both Voted Badge */}
      {bothVoted && (
        <div className="mx-4 mb-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle2 className="size-3.5" />
          둘 다 투표 완료!
        </div>
      )}

      {/* My Vote Form / Result */}
      <div className="px-4 pb-4">
        <div className="rounded-xl bg-background border border-border/60 p-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              내 투표
            </p>
            {isVoted && !isEditing && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <RotateCcw className="size-3" />
                  수정하기
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3" />
                  삭제
                </button>
              </div>
            )}
          </div>

          {/* Voted Summary (not editing) */}
          {isVoted && !isEditing && myVote && !confirmDelete && (
            <div className="space-y-2">
              <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ${
                VOTE_OPTIONS.find(o => o.value === myVote.score)?.selectedBg ?? ""
              } ${
                VOTE_OPTIONS.find(o => o.value === myVote.score)?.selectedText ?? ""
              }`}>
                {scoreLabel[myVote.score]}
              </div>
              {myVote.reason && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "{myVote.reason}"
                </p>
              )}
            </div>
          )}

          {/* Delete confirm */}
          {confirmDelete && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2.5">
              <p className="text-sm text-foreground font-medium">투표를 삭제할까요?</p>
              <p className="text-xs text-muted-foreground">삭제하면 내 투표 내용이 사라져요.</p>
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
                  삭제하기
                </button>
              </div>
            </div>
          )}

          {/* Vote Form */}
          {isEditing && (
            <div className="space-y-3">
              {/* Score Options */}
              <div className="grid grid-cols-5 gap-1.5">
                {VOTE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => setSelectedScore(option.value)}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center transition-all ${
                      selectedScore === option.value
                        ? `${option.selectedBg} ${option.selectedRing} scale-105`
                        : "bg-muted/60 hover:bg-muted"
                    }`}
                  >
                    <span className="text-xl leading-none">{option.emoji}</span>
                    <span className={`text-[10px] font-medium leading-tight ${
                      selectedScore === option.value ? option.selectedText : "text-muted-foreground"
                    }`}>
                      {option.label}
                    </span>
                  </button>
                ))}
              </div>

              {/* Reason Input */}
              <div>
                <Textarea
                  placeholder="이유를 적어보세요 (선택사항)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={2}
                  className="resize-none text-sm bg-muted/40 border-border/60 placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Actions */}
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
      </div>
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
        {/* My progress */}
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
              style={{ width: `${(myCount / total) * 100}%` }}
            />
          </div>
        </div>
        {/* Partner progress */}
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
              style={{ width: `${(partnerCount / total) * 100}%` }}
            />
          </div>
        </div>
      </div>
      {myCount === total && partnerCount === total && (
        <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
          <CheckCircle2 className="size-4" />
          두 분 모두 투표 완료! 결과를 확인해보세요 🎉
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function VoteView({
  currentUser,
  pendingItems = [],
}: {
  currentUser: "groom" | "bride"
  pendingItems?: VendorItem[]
}) {
  const [items, setItems] = useState<VendorItem[]>(INITIAL_ITEMS)
  const prevPendingLengthRef = useRef(0)

  useEffect(() => {
    if (pendingItems.length > prevPendingLengthRef.current) {
      const newItems = pendingItems.slice(prevPendingLengthRef.current)
      setItems(prev => {
        const existingIds = new Set(prev.map(i => i.id))
        return [...prev, ...newItems.filter(i => !existingIds.has(i.id))]
      })
      prevPendingLengthRef.current = pendingItems.length
    }
  }, [pendingItems])

  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>({})
  const [filter, setFilter] = useState<"전체" | "미투표" | "투표완료">("전체")

  const handleVoteSubmit = (id: string, score: VoteScore, reason: string) => {
    setMyVotes(prev => ({
      ...prev,
      [id]: {
        score,
        reason,
        isEdited: !!prev[id],
      },
    }))
  }

  const handleVoteDelete = (id: string) => {
    setMyVotes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleItemDelete = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
    setMyVotes(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const myVoteCount = Object.keys(myVotes).length
  const partnerVoteCount = items.filter(i => i.partnerVoted).length

  const filteredItems = items.filter(item => {
    if (filter === "미투표") return !myVotes[item.id]
    if (filter === "투표완료") return !!myVotes[item.id]
    return true
  })

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
            AI가 추천한 업체에 대해 각자 비밀리에 투표해요. 상대방의 투표는 볼 수 없어요.
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
        <div className="flex items-start gap-2 rounded-xl bg-violet-50/60 border border-violet-100 px-3 py-2.5 dark:bg-violet-950/20 dark:border-violet-900">
          <Lock className="size-3.5 text-violet-500 mt-0.5 shrink-0" />
          <p className="text-xs text-violet-600 dark:text-violet-400 leading-relaxed">
            내 투표 내용은 상대방에게 보이지 않아요. 둘 다 투표를 완료하면 결과를 함께 확인할 수 있어요.
            투표는 언제든지 수정 가능해요.
          </p>
        </div>

        {/* Vote cards */}
        {filteredItems.length === 0 ? (
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
            {filteredItems.map(item => (
              <VoteCard
                key={item.id}
                item={item}
                myVote={myVotes[item.id] ?? null}
                currentUser={currentUser}
                onVoteSubmit={handleVoteSubmit}
                onVoteDelete={handleVoteDelete}
                onItemDelete={handleItemDelete}
              />
            ))}
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
