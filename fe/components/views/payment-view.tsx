"use client"

import { useState } from "react"
import { CreditCard, Plus, Trash2, CheckCircle2, ChevronRight, X, Receipt, CalendarDays, Building2, Tag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface Card {
  id: string
  brand: string
  last4: string
  expiry: string
  isDefault: boolean
  color: string
}

interface PaymentHistory {
  id: string
  date: string
  vendor: string
  category: string
  amount: number
  status: "완료" | "취소" | "대기"
  cardBrand?: string
  cardLast4?: string
  memo?: string
}

const initialCards: Card[] = [
  {
    id: "1",
    brand: "신한카드",
    last4: "4521",
    expiry: "09/27",
    isDefault: true,
    color: "from-blue-500 to-blue-700",
  },
  {
    id: "2",
    brand: "국민카드",
    last4: "8834",
    expiry: "03/26",
    isDefault: false,
    color: "from-emerald-500 to-emerald-700",
  },
]

const paymentHistory: PaymentHistory[] = [
  {
    id: "1",
    date: "2026-02-28",
    vendor: "더 그랜드 파빌리온",
    category: "웨딩홀",
    amount: 500000,
    status: "완료",
    cardBrand: "신한카드",
    cardLast4: "4521",
    memo: "계약금 10% 납입",
  },
  {
    id: "2",
    date: "2026-02-20",
    vendor: "로앤스튜디오",
    category: "스튜디오",
    amount: 300000,
    status: "완료",
    cardBrand: "국민카드",
    cardLast4: "8834",
    memo: "촬영 예약금",
  },
  {
    id: "3",
    date: "2026-03-01",
    vendor: "모니카블랑쉬",
    category: "드레스",
    amount: 200000,
    status: "대기",
    cardBrand: "신한카드",
    cardLast4: "4521",
    memo: "드레스 예약금 (결제 대기 중)",
  },
  {
    id: "4",
    date: "2026-01-15",
    vendor: "글로우 뷰티",
    category: "메이크업",
    amount: 100000,
    status: "취소",
    cardBrand: "신한카드",
    cardLast4: "4521",
    memo: "일정 변경으로 인한 취소",
  },
]

const statusStyle: Record<string, string> = {
  완료: "bg-emerald-50 text-emerald-600",
  취소: "bg-red-50 text-red-500",
  대기: "bg-amber-50 text-amber-600",
}

const categoryEmoji: Record<string, string> = {
  웨딩홀: "🏛️",
  스튜디오: "📷",
  드레스: "👗",
  메이크업: "💄",
}

export function PaymentView() {
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [showAddCard, setShowAddCard] = useState(false)
  const [newCard, setNewCard] = useState({ number: "", expiry: "", cvc: "", brand: "" })
  const [tab, setTab] = useState<"cards" | "history">("cards")
  const [selectedPayment, setSelectedPayment] = useState<PaymentHistory | null>(null)

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id))
  }

  const setDefaultCard = (id: string) => {
    setCards(prev => prev.map(c => ({ ...c, isDefault: c.id === id })))
  }

  const handleAddCard = () => {
    if (!newCard.number || !newCard.expiry || !newCard.cvc) return
    const last4 = newCard.number.replace(/\s/g, "").slice(-4)
    setCards(prev => [
      ...prev,
      {
        id: Date.now().toString(),
        brand: newCard.brand || "카드",
        last4,
        expiry: newCard.expiry,
        isDefault: prev.length === 0,
        color: "from-gray-500 to-gray-700",
      },
    ])
    setNewCard({ number: "", expiry: "", cvc: "", brand: "" })
    setShowAddCard(false)
  }

  const formatAmount = (amount: number) =>
    amount.toLocaleString("ko-KR") + "원"

  return (
    <>
      <div className="flex h-full flex-col overflow-y-auto bg-background">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <CreditCard className="size-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">결제내역</h1>
            </div>
            <p className="mt-1 text-muted-foreground">카드 관리 및 결제 내역을 확인하세요</p>
          </div>

          {/* Tab */}
          <div className="mb-6 flex rounded-xl bg-muted p-1">
            <button
              onClick={() => setTab("cards")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === "cards" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              내 카드
            </button>
            <button
              onClick={() => setTab("history")}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                tab === "history" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              결제 내역
            </button>
          </div>

          {tab === "cards" && (
            <div className="space-y-4">
              {/* Card List */}
              {cards.map(card => (
                <div key={card.id} className="group relative overflow-hidden rounded-2xl shadow-sm">
                  {/* Card Visual */}
                  <div className={`bg-gradient-to-br ${card.color} p-5 text-white`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium opacity-80">{card.brand}</p>
                        <p className="mt-3 text-xl font-bold tracking-widest">
                          •••• •••• •••• {card.last4}
                        </p>
                      </div>
                      {card.isDefault && (
                        <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium">
                          기본카드
                        </span>
                      )}
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                      <div>
                        <p className="text-xs opacity-70">유효기간</p>
                        <p className="text-sm font-medium">{card.expiry}</p>
                      </div>
                      <CreditCard className="size-8 opacity-50" />
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="flex items-center justify-between bg-card px-4 py-3">
                    {!card.isDefault ? (
                      <button
                        onClick={() => setDefaultCard(card.id)}
                        className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                      >
                        <CheckCircle2 className="size-4" />
                        기본카드로 설정
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                        <CheckCircle2 className="size-4 fill-emerald-100" />
                        기본 결제 카드
                      </div>
                    )}
                    <button
                      onClick={() => removeCard(card.id)}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      삭제
                    </button>
                  </div>
                </div>
              ))}

              {/* Add Card */}
              {showAddCard ? (
                <div className="rounded-2xl bg-card p-5 shadow-sm space-y-3">
                  <h3 className="font-semibold text-foreground">새 카드 등록</h3>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">카드 브랜드</label>
                    <Input
                      placeholder="예: 신한카드, 삼성카드"
                      value={newCard.brand}
                      onChange={e => setNewCard(p => ({ ...p, brand: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">카드 번호</label>
                    <Input
                      placeholder="0000 0000 0000 0000"
                      value={newCard.number}
                      onChange={e => setNewCard(p => ({ ...p, number: e.target.value }))}
                      maxLength={19}
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">유효기간</label>
                      <Input
                        placeholder="MM/YY"
                        value={newCard.expiry}
                        onChange={e => setNewCard(p => ({ ...p, expiry: e.target.value }))}
                        maxLength={5}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1 block text-xs text-muted-foreground">CVC</label>
                      <Input
                        placeholder="000"
                        value={newCard.cvc}
                        onChange={e => setNewCard(p => ({ ...p, cvc: e.target.value }))}
                        maxLength={3}
                        type="password"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" className="flex-1" onClick={() => setShowAddCard(false)}>
                      취소
                    </Button>
                    <Button className="flex-1" onClick={handleAddCard}>
                      등록
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddCard(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/30 py-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="size-5" />
                  카드 추가
                </button>
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {paymentHistory.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPayment(p)}
                  className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-4 shadow-sm transition-shadow hover:shadow-md text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-lg">
                      {categoryEmoji[p.category] ?? "🧾"}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{p.vendor}</p>
                      <p className="text-xs text-muted-foreground">{p.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${p.status === "취소" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {formatAmount(p.amount)}
                      </p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[p.status]}`}>
                        {p.status}
                      </span>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                </button>
              ))}

              {/* Total */}
              <div className="mt-2 rounded-2xl bg-primary/5 px-4 py-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">이번 달 결제 총액</span>
                  <span className="font-bold text-foreground">
                    {formatAmount(
                      paymentHistory
                        .filter(p => p.status === "완료")
                        .reduce((sum, p) => sum + p.amount, 0)
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Payment Detail Bottom Sheet */}
      {selectedPayment && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end items-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setSelectedPayment(null)}
          />
          {/* Sheet */}
          <div className="relative animate-in slide-in-from-bottom duration-300 flex flex-col rounded-t-2xl bg-background shadow-2xl w-full max-w-lg">
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                <h2 className="font-semibold text-foreground">결제 상세</h2>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-5 space-y-4">
              {/* Vendor & Amount */}
              <div className="flex items-center gap-4 rounded-2xl bg-muted/50 p-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-background text-3xl shadow-sm">
                  {categoryEmoji[selectedPayment.category] ?? "🧾"}
                </div>
                <div>
                  <p className="font-semibold text-foreground text-lg">{selectedPayment.vendor}</p>
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[selectedPayment.status]}`}>
                    {selectedPayment.status}
                  </span>
                </div>
                <div className="ml-auto text-right">
                  <p className={`text-xl font-bold ${selectedPayment.status === "취소" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {formatAmount(selectedPayment.amount)}
                  </p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <CalendarDays className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">결제일</p>
                    <p className="text-sm font-medium text-foreground">{selectedPayment.date}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                    <Tag className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">카테고리</p>
                    <p className="text-sm font-medium text-foreground">{selectedPayment.category}</p>
                  </div>
                </div>

                {selectedPayment.cardBrand && (
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <CreditCard className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">결제 카드</p>
                      <p className="text-sm font-medium text-foreground">
                        {selectedPayment.cardBrand} •••• {selectedPayment.cardLast4}
                      </p>
                    </div>
                  </div>
                )}

                {selectedPayment.memo && (
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="size-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">메모</p>
                      <p className="text-sm font-medium text-foreground">{selectedPayment.memo}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="px-5 pb-6">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedPayment(null)}
              >
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
