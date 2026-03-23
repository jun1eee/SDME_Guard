"use client"

import { useState, useEffect } from "react"
import { CreditCard, Plus, Trash2, ChevronRight, X, Receipt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getCards, deleteCard, getPayments, getTossClientKey, registerCard } from "@/lib/api"

interface Card {
  id: number
  cardBrand: string
  cardLast4: string
  ownerName: string
  createdAt: string
}

interface PaymentItem {
  id: number
  vendorId: number
  vendorName: string
  vendorCategory: string
  vendorImage: string
  reservationId: number
  type: string
  amount: number
  status: string
  paymentKey: string
  cardBrand: string
  cardLast4: string
  requestedAt: string
  approvedAt: string
}

const CARD_BRANDS: Record<string, string> = {
  "3K": "기업BC", "46": "광주", "71": "롯데", "30": "산업", "31": "BC", "51": "삼성",
  "38": "새마을", "41": "신한", "62": "신협", "36": "씨티", "33": "우리", "W1": "우리",
  "37": "우체국", "39": "저축", "35": "전북", "42": "제주", "15": "카카오뱅크",
  "3A": "케이뱅크", "24": "토스뱅크", "21": "하나", "61": "현대", "11": "KB국민",
  "91": "NH농협", "34": "Sh수협",
}

const CARD_THEME: Record<string, { bg: string; accent: string }> = {
  "11": { bg: "from-amber-500 to-amber-700", accent: "bg-amber-400/30" },       // KB국민
  "41": { bg: "from-blue-500 to-blue-700", accent: "bg-blue-400/30" },           // 신한
  "51": { bg: "from-blue-600 to-indigo-800", accent: "bg-indigo-400/30" },       // 삼성
  "21": { bg: "from-teal-500 to-teal-700", accent: "bg-teal-400/30" },           // 하나
  "61": { bg: "from-gray-800 to-gray-950", accent: "bg-gray-600/30" },           // 현대
  "33": { bg: "from-sky-500 to-sky-700", accent: "bg-sky-400/30" },              // 우리
  "W1": { bg: "from-sky-500 to-sky-700", accent: "bg-sky-400/30" },              // 우리
  "71": { bg: "from-red-500 to-red-700", accent: "bg-red-400/30" },              // 롯데
  "91": { bg: "from-green-600 to-green-800", accent: "bg-green-400/30" },        // NH농협
  "31": { bg: "from-rose-500 to-rose-700", accent: "bg-rose-400/30" },           // BC
  "15": { bg: "from-yellow-400 to-yellow-600", accent: "bg-yellow-300/30" },     // 카카오뱅크
  "24": { bg: "from-blue-400 to-blue-600", accent: "bg-blue-300/30" },           // 토스뱅크
}
const DEFAULT_CARD_THEME = { bg: "from-slate-600 to-slate-800", accent: "bg-slate-500/30" }

const statusStyle: Record<string, string> = {
  DONE: "bg-emerald-50 text-emerald-600",
  CANCELED: "bg-red-50 text-red-500",
  READY: "bg-amber-50 text-amber-600",
  IN_PROGRESS: "bg-blue-50 text-blue-600",
  ABORTED: "bg-red-50 text-red-500",
}

const statusLabel: Record<string, string> = {
  DONE: "완료",
  CANCELED: "취소",
  READY: "대기",
  IN_PROGRESS: "진행중",
  ABORTED: "실패",
}

const typeLabel: Record<string, string> = {
  DEPOSIT: "계약금",
  BALANCE: "잔금",
}

const formatAmount = (amount: number) => amount.toLocaleString("ko-KR") + "원"

export function PaymentView() {
  const [cards, setCards] = useState<Card[]>([])
  const [payments, setPayments] = useState<PaymentItem[]>([])
  const [tab, setTab] = useState<"cards" | "history">("cards")
  const [selectedPayment, setSelectedPayment] = useState<PaymentItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    Promise.all([
      getCards().then(res => setCards(res.data)).catch(() => {}),
      getPayments().then(res => setPayments(res.data)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleDeleteCard = async (cardId: number) => {
    if (!confirm("이 카드를 삭제하시겠습니까?")) return
    try {
      await deleteCard(cardId)
      setCards(prev => prev.filter(c => c.id !== cardId))
    } catch {
      alert("카드 삭제에 실패했습니다.")
    }
  }

  const handleRegisterCard = async () => {
    setRegistering(true)
    try {
      const keyRes = await getTossClientKey()
      const clientKey = keyRes.data.clientKey
      const customerKey = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8)

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk")
      const toss = await loadTossPayments(clientKey)
      const payment = toss.payment({ customerKey })

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: window.location.origin + "/cards/success",
        failUrl: window.location.origin + "/cards/fail",
      })
    } catch (err: any) {
      if (err?.code !== "USER_CANCEL") {
        alert("카드 등록에 실패했습니다.")
      }
    } finally {
      setRegistering(false)
    }
  }

  const getCardName = (card: Card) => CARD_BRANDS[card.cardBrand] || card.cardBrand || "카드"

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

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
              {cards.length === 0 && (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                  <CreditCard className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">등록된 카드가 없습니다</p>
                </div>
              )}

              {cards.map((card, i) => {
                const theme = CARD_THEME[card.cardBrand] || DEFAULT_CARD_THEME
                return (
                  <div key={card.id} className="flex flex-col items-center">
                    {/* 카드 본체 — 신용카드 표준 비율 85.6:54 */}
                    <div
                      className={`relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br ${theme.bg} text-white shadow-2xl`}
                      style={{ aspectRatio: "85.6 / 54" }}
                    >
                      {/* 배경 장식 원 */}
                      <div className={`absolute -right-10 -top-10 size-40 rounded-full ${theme.accent}`} />
                      <div className={`absolute -bottom-12 -right-6 size-52 rounded-full ${theme.accent}`} />

                      {/* 내부 레이아웃: 상단/중단/하단 */}
                      <div className="relative flex h-full flex-col justify-between p-6">
                        {/* 상단: 카드사명 + 기본카드 뱃지 */}
                        <div className="flex items-center justify-between">
                          <p className="text-base font-extrabold tracking-wide">{getCardName(card)}</p>
                          {i === 0 && (
                            <span className="rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-semibold backdrop-blur-sm">
                              기본카드
                            </span>
                          )}
                        </div>

                        {/* 중단: IC칩 + NFC */}
                        <div className="flex items-center justify-between">
                          {/* IC 칩 */}
                          <div className="relative h-8 w-11 overflow-hidden rounded-md bg-gradient-to-br from-yellow-200 to-yellow-400 shadow-inner">
                            <div className="absolute inset-x-1 top-[30%] h-px bg-yellow-600/30" />
                            <div className="absolute inset-x-1 top-[50%] h-px bg-yellow-600/30" />
                            <div className="absolute inset-x-1 top-[70%] h-px bg-yellow-600/30" />
                            <div className="absolute inset-y-1 left-[40%] w-px bg-yellow-600/30" />
                          </div>
                          {/* NFC 아이콘 */}
                          <svg viewBox="0 0 24 24" className="size-5 text-white/40" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M8.25 9a3.75 3.75 0 0 1 0 6M12 7.5a6 6 0 0 1 0 9M15.75 6a9.75 9.75 0 0 1 0 12" strokeLinecap="round" />
                          </svg>
                        </div>

                        {/* 하단: 카드번호 + 소유자 + 마스터카드 심볼 */}
                        <div>
                          <p className="mb-3 font-mono text-lg font-bold tracking-[0.18em]">
                            •••• •••• •••• {card.cardLast4}
                          </p>
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Card Holder</p>
                              <p className="mt-0.5 text-sm font-semibold uppercase tracking-wide">
                                {card.ownerName || "—"}
                              </p>
                            </div>
                            {/* 마스터카드 스타일 심볼 */}
                            <div className="flex items-center">
                              <div className="size-7 rounded-full bg-white/40" />
                              <div className="-ml-3 size-7 rounded-full bg-white/25" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleDeleteCard(card.id)}
                      className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                      카드 삭제
                    </button>
                  </div>
                )
              })}

              <button
                onClick={handleRegisterCard}
                disabled={registering}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-muted-foreground/30 py-5 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                <Plus className="size-5" />
                {registering ? "등록 중..." : "카드 추가"}
              </button>
            </div>
          )}

          {tab === "history" && (
            <div className="space-y-3">
              {payments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border py-10 text-center">
                  <Receipt className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">결제 내역이 없습니다</p>
                </div>
              ) : (
                <>
                  {payments.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPayment(p)}
                      className="flex w-full items-center justify-between rounded-2xl bg-card px-4 py-4 shadow-sm transition-shadow hover:shadow-md text-left"
                    >
                      <div className="flex items-center gap-3">
                        {p.vendorImage ? (
                          <img src={p.vendorImage} alt={p.vendorName} className="size-10 shrink-0 rounded-xl object-cover" />
                        ) : (
                          <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-lg">💳</div>
                        )}
                        <div>
                          <p className="font-medium text-foreground">{p.vendorName || "업체"}</p>
                          <p className="text-xs text-muted-foreground">{typeLabel[p.type] || p.type} · {p.requestedAt?.substring(0, 10)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${p.status === "CANCELED" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {formatAmount(p.amount)}
                          </p>
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[p.status] || "bg-muted text-muted-foreground"}`}>
                            {statusLabel[p.status] || p.status}
                          </span>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </div>
                    </button>
                  ))}

                  <div className="mt-2 rounded-2xl bg-primary/5 px-4 py-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">총 결제 금액</span>
                      <span className="font-bold text-foreground">
                        {formatAmount(payments.filter(p => p.status === "DONE").reduce((sum, p) => sum + p.amount, 0))}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment Detail Bottom Sheet */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelectedPayment(null)}>
          <div className="relative mx-4 w-full max-w-md rounded-2xl bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-bold text-foreground text-lg">결제 영수증</h2>
              <button onClick={() => setSelectedPayment(null)} className="rounded-full p-1.5 hover:bg-muted">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-5 space-y-5">
              {/* 업체 정보 */}
              <div className="flex items-center gap-4">
                {selectedPayment.vendorImage ? (
                  <img src={selectedPayment.vendorImage} alt={selectedPayment.vendorName} className="size-14 shrink-0 rounded-2xl object-cover" />
                ) : (
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-2xl">🏪</div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-foreground text-lg">{selectedPayment.vendorName || "업체"}</p>
                  <span className={`inline-block mt-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle[selectedPayment.status] || ""}`}>
                    {statusLabel[selectedPayment.status] || selectedPayment.status}
                  </span>
                </div>
              </div>

              {/* 구분선 (점선) */}
              <div className="border-t-2 border-dashed border-border" />

              {/* 결제 금액 */}
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">{typeLabel[selectedPayment.type] || selectedPayment.type}</p>
                <p className={`text-3xl font-bold mt-1 ${selectedPayment.status === "CANCELED" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                  {formatAmount(selectedPayment.amount)}
                </p>
              </div>

              {/* 구분선 (점선) */}
              <div className="border-t-2 border-dashed border-border" />

              {/* 상세 정보 */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">결제일시</span>
                  <span className="font-medium text-foreground">
                    {(selectedPayment.approvedAt || selectedPayment.requestedAt)?.replace("T", " ").substring(0, 16)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">결제 유형</span>
                  <span className="font-medium text-foreground">{typeLabel[selectedPayment.type] || selectedPayment.type}</span>
                </div>
                {selectedPayment.cardBrand && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">결제 수단</span>
                    <span className="font-medium text-foreground">
                      {CARD_BRANDS[selectedPayment.cardBrand] || selectedPayment.cardBrand} •••• {selectedPayment.cardLast4}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">승인 번호</span>
                  <span className="font-medium text-foreground text-xs">{selectedPayment.paymentKey?.substring(0, 20) || "-"}</span>
                </div>
              </div>
            </div>

            <div className="px-5 pb-6">
              <Button variant="outline" className="w-full" onClick={() => setSelectedPayment(null)}>
                닫기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
