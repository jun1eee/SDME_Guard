"use client"

import { useMemo, useState, useEffect } from "react"
import {
  Plus,
  Check,
  Pencil,
  Trash2,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getBudget, updateBudgetTotal, addBudgetItem, updateBudgetItem, deleteBudgetItem } from "@/lib/api"

interface BudgetItem {
  id: string
  category: string
  name: string
  amount: number
  isPaid: boolean
  isCustom?: boolean
}

interface BudgetViewProps {
  totalBudget: number
}

// ── 색상 팔레트 (핑크 모노톤) ──────────────────────────────────
const PALETTE = [
  { stroke: "#d6336c", bg: "#ffe0ec", text: "#a61e4d" }, // 웨딩홀 - 진한 핫핑크
  { stroke: "#f06595", bg: "#ffe8f0", text: "#c2255c" }, // 스튜디오 - 코랄 핑크
  { stroke: "#862e9c", bg: "#f3d9fa", text: "#6a1b7a" }, // 드레스 - 보라 핑크
  { stroke: "#ff8fab", bg: "#fff0f6", text: "#e64980" }, // 메이크업 - 밝은 핑크
  { stroke: "#a3004f", bg: "#fce4ec", text: "#880e4f" }, // 허니문 - 딥 마젠타
  { stroke: "#e8a0bf", bg: "#fdf2f8", text: "#b05080" }, // 기타 - 파스텔 핑크
]
const REMAINING_COLOR = { stroke: "#dfe6e9", bg: "#f5f6fa", text: "#636e72" } // 회색 (남은 예산)

const PRESET_CATEGORIES = ["웨딩홀", "스튜디오", "드레스", "메이크업", "허니문", "기타"]


// ── 도넛 차트 계산 ─────────────────────────────────────────────
const RADIUS = 80
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 502.655
const GAP = 4  // 세그먼트 사이 간격 (svg units)

function buildSegments(
  categoryTotals: { category: string; amount: number }[],
  total: number,
  totalBudget: number,
  colorMap: Record<string, number>
) {
  if (total === 0 && totalBudget === 0) return []
  const base = Math.max(total, totalBudget)
  let cumulativeArc = 0
  const segs = categoryTotals.map((cat) => {
    const fraction = cat.amount / base
    const fullArc = fraction * CIRCUMFERENCE
    const arcLength = Math.max(0, fullArc - GAP)
    const dashOffset = CIRCUMFERENCE / 4 - cumulativeArc
    cumulativeArc += fullArc
    const colorIdx = colorMap[cat.category] ?? 0
    return {
      ...cat,
      fraction,
      arcLength,
      dashOffset,
      color: PALETTE[colorIdx % PALETTE.length],
      isRemaining: false,
    }
  })
  // 남은 예산 회색 세그먼트
  const remaining = totalBudget - total
  if (remaining > 0) {
    const fraction = remaining / base
    const fullArc = fraction * CIRCUMFERENCE
    const arcLength = Math.max(0, fullArc - GAP)
    const dashOffset = CIRCUMFERENCE / 4 - cumulativeArc
    segs.push({
      category: "남은 예산",
      amount: remaining,
      fraction,
      arcLength,
      dashOffset,
      color: REMAINING_COLOR,
      isRemaining: true,
    })
  }
  return segs
}

// ── 유틸 ──────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat("ko-KR").format(n)

const fmtShort = (n: number): string => {
  if (n >= 100000000) {
    const eok = Math.floor(n / 100000000)
    const remainder = n % 100000000
    if (remainder === 0) return `${eok}억`
    return `${eok}억 ${fmtShort(remainder)}`
  }
  if (n >= 10000) {
    const man = Math.floor(n / 10000)
    const remainder = n % 10000
    if (remainder === 0) return `${fmt(man)}만`
    return `${fmt(man)}만 ${fmt(remainder)}`
  }
  return fmt(n)
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────
export function BudgetView({ totalBudget: initialBudget }: BudgetViewProps) {
  const [items, setItems] = useState<BudgetItem[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editName, setEditName] = useState("")
  const [totalBudget, setTotalBudget] = useState(initialBudget)
  const [editingBudget, setEditingBudget] = useState(false)
  const [tempBudget, setTempBudget] = useState(Math.round(initialBudget / 10000).toString())
  const [loading, setLoading] = useState(true)

  // API에서 예산 데이터 로드
  useEffect(() => {
    getBudget()
      .then((res) => {
        const data = res.data
        if (data.totalBudget > 0) setTotalBudget(data.totalBudget)
        const allItems: BudgetItem[] = data.categories.flatMap((cat) =>
          cat.items.map((item) => ({
            id: item.id.toString(),
            category: cat.name,
            name: item.name,
            amount: item.amount,
            isPaid: item.isPaid,
          }))
        )
        setItems(allItems)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // 카테고리별 색상 인덱스 (추가 순서 유지)
  const colorMap = useMemo(() => {
    const map: Record<string, number> = {}
    let idx = 0
    items.forEach((item) => {
      if (map[item.category] === undefined) {
        map[item.category] = idx++
      }
    })
    return map
  }, [items])

  // 카테고리별 합산 (체크된 항목만)
  const categoryTotals = useMemo(() => {
    const acc: Record<string, number> = {}
    items.filter((item) => item.isPaid).forEach((item) => {
      acc[item.category] = (acc[item.category] ?? 0) + item.amount
    })
    return Object.entries(acc)
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [items])

  const total = useMemo(
    () => categoryTotals.reduce((s, c) => s + c.amount, 0),
    [categoryTotals]
  )

  const segments = useMemo(
    () => buildSegments(categoryTotals, total, totalBudget, colorMap),
    [categoryTotals, total, totalBudget, colorMap]
  )

  const allItemsTotal = items.reduce((s, i) => s + i.amount, 0)
  const paidAmount = items.filter((i) => i.isPaid).reduce((s, i) => s + i.amount, 0)
  const budgetUsedPct = totalBudget > 0 ? Math.min(100, (paidAmount / totalBudget) * 100) : 0

  // ── 핸들러 (API 연동) ─────────────────────────────────────
  const togglePaid = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, isPaid: !i.isPaid } : i)))

  const handleDelete = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    deleteBudgetItem(Number(id)).catch(() => {})
  }

  const startEdit = (id: string, name: string, amount: number) => {
    setEditingId(id)
    setEditName(name)
    setEditAmount(amount.toString())
  }

  const saveEdit = (id: string) => {
    const parsed = parseInt(editAmount)
    if (!isNaN(parsed) && parsed > 0 && editName.trim()) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, name: editName.trim(), amount: parsed } : i)))
      updateBudgetItem(Number(id), { name: editName.trim(), amount: parsed }).catch(() => {})
    }
    setEditingId(null)
  }

  const saveBudget = () => {
    const parsed = parseInt(tempBudget.replace(/,/g, ""))
    if (!isNaN(parsed) && parsed > 0) {
      const newTotal = parsed * 10000
      setTotalBudget(newTotal)
      updateBudgetTotal(newTotal).catch(() => {})
    }
    setEditingBudget(false)
  }

  // ── 렌더 ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">예산 정보 불러오는 중...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-2xl px-4 py-8">

        {/* ── 헤더 ── */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">예산 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">웨딩 예산을 한눈에 파악하세요</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs text-muted-foreground">총 예산</span>
            {editingBudget ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  value={tempBudget}
                  onChange={(e) => setTempBudget(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveBudget()}
                  className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm font-bold focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  autoFocus
                  min={1}
                />
                <span className="text-sm text-muted-foreground">만원</span>
                <button onClick={saveBudget} className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90">저장</button>
                <button onClick={() => setEditingBudget(false)} className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted">취소</button>
              </div>
            ) : (
              <button
                onClick={() => { setTempBudget(Math.round(totalBudget / 10000).toString()); setEditingBudget(true) }}
                className="flex items-center gap-1 text-base font-bold text-foreground hover:text-primary"
              >
                {fmt(totalBudget)}원
                <Pencil className="size-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* ── 도넛 차트 카드 ── */}
        <div className="mb-5 overflow-hidden rounded-2xl bg-card shadow-sm">
          <div className="p-6 pb-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              예산 현황
            </p>
          </div>

          {/* 예산 대비 진행률 — full width */}
          <div className="px-6 pt-4 pb-2">
            <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
              <span>총 예산 사용률</span>
              <span className="font-medium text-foreground">{budgetUsedPct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${budgetUsedPct}%`,
                  background: budgetUsedPct > 90
                    ? "#ef4444"
                    : "linear-gradient(to right, #e28aa3, #c76a85)",
                }}
              />
            </div>
          </div>

          {/* 도넛 + 범례 같은 줄 */}
          <div className="flex flex-col items-center gap-6 px-6 py-6 sm:flex-row sm:items-center">
            {/* 도넛 SVG */}
            <div className="relative shrink-0">
              <svg width="200" height="200" viewBox="0 0 200 200">
                <circle
                  cx="100" cy="100" r={RADIUS}
                  fill="none"
                  stroke="var(--muted)"
                  strokeWidth="22"
                />
                {segments.length > 0 ? segments.map((seg) => (
                  <circle
                    key={seg.category}
                    cx="100" cy="100" r={RADIUS}
                    fill="none"
                    stroke={seg.color.stroke}
                    strokeWidth="22"
                    strokeLinecap="butt"
                    strokeDasharray={`${seg.arcLength} ${CIRCUMFERENCE - seg.arcLength}`}
                    strokeDashoffset={seg.dashOffset}
                    className="transition-all duration-500"
                  />
                )) : (
                  <circle
                    cx="100" cy="100" r={RADIUS}
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="22"
                  />
                )}
                <circle cx="100" cy="100" r="67" fill="var(--card)" />
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[38px]">
                <span className="text-[10px] text-muted-foreground">지출 합계</span>
                <span className="mt-0.5 text-lg font-bold text-foreground leading-none text-center break-keep">
                  {fmtShort(total)}원
                </span>
                <span className="mt-1 text-[10px] text-muted-foreground">
                  / {fmtShort(totalBudget)}원
                </span>
              </div>
            </div>

            {/* 범례 */}
            <div className="flex flex-1 flex-col justify-center gap-2.5 w-full">
              {segments.length === 0 ? (
                <p className="text-sm text-muted-foreground">항목을 추가하면 차트가 표시됩니다</p>
              ) : (
                segments.map((seg) => (
                  <div key={seg.category} className={`flex items-center gap-3 ${seg.isRemaining ? "mt-1 border-t border-border pt-2.5 opacity-60" : ""}`}>
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: seg.color.stroke }}
                    />
                    <span className={`flex-1 text-sm ${seg.isRemaining ? "text-muted-foreground" : "text-foreground"}`}>{seg.category}</span>
                    <span className="text-xs text-muted-foreground">
                      {(seg.fraction * 100).toFixed(1)}%
                    </span>
                    <span className={`shrink-0 whitespace-nowrap text-right text-sm font-medium ${seg.isRemaining ? "text-muted-foreground" : "text-foreground"}`}>
                      {fmt(seg.amount)}원
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ── 요약 수치 ── */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[
            { label: "총 예상", value: fmtShort(allItemsTotal), sub: "원" },
            { label: "확정 지출", value: fmtShort(paidAmount), sub: "원" },
            { label: "남은 예산", value: fmtShort(Math.max(0, totalBudget - paidAmount)), sub: "원" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl bg-card px-4 py-4 shadow-sm">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-lg font-bold text-foreground">
                {stat.value}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">{stat.sub}</span>
              </p>
            </div>
          ))}
        </div>

        {/* ── 예산 항목 ── */}
        <div className="mb-5 rounded-2xl bg-card shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">예산 항목</h2>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {showAddForm ? <X className="size-3.5" /> : <Plus className="size-3.5" />}
              {showAddForm ? "닫기" : "항목 추가"}
            </button>
          </div>

          {/* 추가 폼 */}
          {showAddForm && (
            <div className="border-b border-border px-5 py-4">
              <AddBudgetItemForm
                onAdd={(item) => {
                  const tempId = Date.now().toString()
                  setItems((prev) => [...prev, { ...item, id: tempId, isCustom: true }])
                  setShowAddForm(false)
                  addBudgetItem({ category: item.category, name: item.name, amount: item.amount })
                    .then((res) => {
                      // API 응답에서 실제 ID로 교체
                      const allItems: BudgetItem[] = res.data.categories.flatMap((cat: any) =>
                        cat.items.map((i: any) => ({ id: i.id.toString(), category: cat.name, name: i.name, amount: i.amount, isPaid: i.isPaid }))
                      )
                      setItems(allItems)
                    })
                    .catch(() => {})
                }}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          )}

          {/* 아이템 리스트 */}
          <div className="divide-y divide-border">
            {items.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                항목을 추가하세요
              </div>
            )}
            {items.map((item) => {
              const colorIdx = colorMap[item.category] ?? 0
              const color = PALETTE[colorIdx % PALETTE.length]
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                >
                  {/* 결제 토글 */}
                  <button
                    onClick={() => togglePaid(item.id)}
                    className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                      item.isPaid
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {item.isPaid && <Check className="size-3" />}
                  </button>

                  {/* 카테고리 뱃지 */}
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    {item.category}
                  </span>

                  {/* 이름 + 금액 편집 */}
                  {editingId === item.id ? (
                    <>
                    {item.isPaid ? (
                      <p className="flex-1 text-sm text-muted-foreground">{item.name}</p>
                    ) : (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 flex-1 text-sm"
                        placeholder="항목명"
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                        autoFocus
                      />
                    )}
                    <div className="flex items-center gap-1">
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={editAmount ? fmt(parseInt(editAmount) || 0) : ""}
                        onChange={(e) => setEditAmount(e.target.value.replace(/,/g, "").replace(/[^0-9]/g, ""))}
                        className="h-7 w-28 text-right text-sm"
                        placeholder="금액"
                        onKeyDown={(e) => e.key === "Enter" && saveEdit(item.id)}
                      />
                      <button
                        onClick={() => saveEdit(item.id)}
                        className="rounded-lg bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted"
                      >
                        취소
                      </button>
                    </div>
                    </>
                  ) : (
                    <>
                    <p className={`flex-1 text-sm ${item.isPaid ? "text-muted-foreground line-through" : "text-foreground"}`}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className={`text-sm font-semibold ${item.isPaid ? "text-emerald-600" : "text-foreground"}`}>
                        {fmt(item.amount)}원
                      </span>
                      <button
                        onClick={() => startEdit(item.id, item.name, item.amount)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* 합계 */}
          {items.length > 0 && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
              <span className="text-sm font-semibold text-foreground">합계</span>
              <span className="text-sm font-bold text-primary">{fmt(total)}원</span>
            </div>
          )}
        </div>


      </div>
    </div>
  )
}

// ── 추가 폼 ────────────────────────────────────────────────────
function AddBudgetItemForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: Omit<BudgetItem, "id">) => void
  onCancel: () => void
}) {
  const [category, setCategory] = useState(PRESET_CATEGORIES[0])
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !name || !amount) return
    onAdd({ category, name, amount: parseInt(amount), isPaid: false })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {/* 카테고리 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {PRESET_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* 항목명 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">항목명</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="업체 또는 항목명"
          />
        </div>

        {/* 금액 */}
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">금액 (원)</label>
          <Input
            type="text"
            inputMode="numeric"
            value={amount ? new Intl.NumberFormat("ko-KR").format(parseInt(amount.replace(/,/g, "")) || 0) : ""}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, "").replace(/[^0-9]/g, "")
              setAmount(raw)
            }}
            placeholder="1,000,000"
          />
          {amount && parseInt(amount) >= 10000 && (
            <p className="mt-1 text-xs text-muted-foreground">{fmtShort(parseInt(amount))}원</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted"
        >
          취소
        </button>
        <button
          type="submit"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          추가
        </button>
      </div>
    </form>
  )
}
