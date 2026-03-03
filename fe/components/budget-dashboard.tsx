"use client"

import { useState } from "react"
import { useWedding, getProgressBadgeText } from "@/lib/wedding-store"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { CreditCard, Sparkles, ExternalLink, Check, Store } from "lucide-react"
import { cn } from "@/lib/utils"

function CircularBudget({ spent, total }: { spent: number; total: number }) {
  const percentage = Math.min((spent / total) * 100, 100)
  const remaining = total - spent
  const radius = 80
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative size-52">
        <svg className="size-full -rotate-90" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
          <circle cx="100" cy="100" r={radius} fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="text-foreground transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground uppercase tracking-widest">잔여 예산</span>
          <span className="text-3xl font-light tracking-tight mt-1">{remaining.toLocaleString()}원</span>
          <span className="text-xs text-muted-foreground mt-1">/ {total.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  )
}

function CategoryRow({ name, allocated, spent }: { name: string; allocated: number; spent: number }) {
  const percentage = allocated > 0 ? Math.min((spent / allocated) * 100, 100) : 0
  return (
    <div className="flex flex-col gap-2 py-4 border-b border-border/50 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">{spent.toLocaleString()} / {allocated.toLocaleString()}원</span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  )
}

const cardRecommendations = [
  {
    id: "c1",
    name: "삼성 웨딩카드",
    company: "삼성카드",
    benefit: "웨딩홀 결제 시 5% 캐시백",
    description: "웨딩 관련 업종 할인 및 무이자 할부 12개월",
    highlight: "최대 60만원 캐시백",
  },
  {
    id: "c2",
    name: "현대 M포인트",
    company: "현대카드",
    benefit: "스튜디오/드레스 10% 포인트 적립",
    description: "결혼 준비 전 업종 M포인트 2배 적립",
    highlight: "최대 30만 포인트",
  },
  {
    id: "c3",
    name: "KB 웨딩 특별혜택",
    company: "KB국민카드",
    benefit: "웨딩 업종 무이자 할부 24개월",
    description: "웨딩홀, 스튜디오, 드레스 업종 할부 수수료 면제",
    highlight: "무이자 24개월",
  },
]

const catLabel: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", hall: "웨딩홀" }

function VendorProgressOverview({ vendors }: { vendors: { id: string; category: string; name: string; progress: { currentStep: string } }[] }) {
  const categoryVendors = ["studio", "dress", "makeup", "hall"].map((cat) => {
    const booked = vendors.find((v) => v.category === cat && (v.progress.currentStep === "completed" || v.progress.currentStep === "balance"))
    return { category: cat, name: catLabel[cat], vendor: booked }
  })
  const completedCount = categoryVendors.filter((c) => c.vendor).length
  const totalCount = categoryVendors.length
  const pct = Math.round((completedCount / totalCount) * 100)

  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Store className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">전체 진행률</span>
        </div>
        <span className="text-xs text-muted-foreground">{completedCount}개 / {totalCount}개 완료 ({pct}%)</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex flex-col gap-2">
        {categoryVendors.map((c) => (
          <div key={c.category} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{c.name}</span>
            {c.vendor ? (
              <span className="flex items-center gap-1 text-foreground font-medium"><Check className="size-3" />{c.vendor.name}</span>
            ) : (
              <span className="text-muted-foreground/50">미확정</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function BudgetDashboard() {
  const { totalBudget, setTotalBudget, categories, vendors } = useWedding()
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(totalBudget.toString())

  const totalSpent = categories.reduce((sum, cat) => sum + cat.spent, 0)
  const totalAllocated = categories.reduce((sum, cat) => sum + cat.allocated, 0)

  const handleBudgetSave = () => {
    const val = parseInt(editValue, 10)
    if (!isNaN(val) && val > 0) setTotalBudget(val)
    setIsEditing(false)
  }

  return (
    <div className="px-6 py-8 flex flex-col gap-8">
      {/* Budget Header */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-xs text-muted-foreground uppercase tracking-widest">총 예산</span>
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleBudgetSave()} onBlur={handleBudgetSave} className="w-40 text-center text-lg h-10 rounded-2xl" autoFocus />
          </div>
        ) : (
          <button onClick={() => { setEditValue(totalBudget.toString()); setIsEditing(true) }} className="text-4xl font-light tracking-tight hover:text-muted-foreground transition-colors" aria-label="총 예산 수정">
            {totalBudget.toLocaleString()}원
          </button>
        )}
      </div>

      {/* Circular Chart */}
      <CircularBudget spent={totalSpent} total={totalBudget} />

      {/* Overall Vendor Progress */}
      <VendorProgressOverview vendors={vendors} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">지출</span>
          <p className="text-2xl font-light mt-1">{totalSpent.toLocaleString()}원</p>
        </div>
        <div className="bg-card rounded-3xl p-5 border border-border/50 shadow-sm">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">배정</span>
          <p className="text-2xl font-light mt-1">{totalAllocated.toLocaleString()}원</p>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-card rounded-3xl p-6 border border-border/50 shadow-sm">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">카테고리별 예산</h2>
        {categories.map((cat) => (
          <CategoryRow key={cat.id} name={cat.name} allocated={cat.allocated} spent={cat.spent} />
        ))}
      </div>

      {/* Card Recommendations */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-foreground" />
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">AI 추천 카드</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">예산과 지출 패턴을 분석하여 최적의 결제 카드를 추천합니다</p>

        <div className="flex flex-col gap-3">
          {cardRecommendations.map((card) => (
            <div key={card.id} className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-start gap-4">
                <div className="size-12 rounded-2xl bg-foreground text-background flex items-center justify-center shrink-0">
                  <CreditCard className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{card.name}</h3>
                    <span className="bg-[var(--brand-pink)] text-foreground rounded-full px-2.5 py-0.5 text-[10px] font-medium">{card.highlight}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.company}</p>
                  <p className="text-xs font-medium mt-2">{card.benefit}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{card.description}</p>
                </div>
              </div>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-3 ml-16">
                <ExternalLink className="size-3" />자세히 보기
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
