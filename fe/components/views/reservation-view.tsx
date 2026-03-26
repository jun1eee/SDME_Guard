"use client"

import { useState, useEffect } from "react"
import { CalendarCheck, Clock, ChevronRight, X, Check, Pencil } from "lucide-react"
import { getReservations, cancelReservation, updateReservation, getBookedTimes } from "@/lib/api"
import { fetchVendorDetail } from "@/lib/api/vendor-detail"
import { VendorDetailView } from "@/components/views/vendors-view"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"

interface Reservation {
  id: string
  vendorId: string
  vendorName: string
  category: string
  imageUrl: string
  date: string
  time: string
  status: "예정" | "완료" | "취소"
  progress: string
  notes?: string
}

const statusStyle: Record<string, { badge: string; dot: string }> = {
  예정: { badge: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
  완료: { badge: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  취소: { badge: "bg-red-50 text-red-500", dot: "bg-red-400" },
}

const progressLabel: Record<string, string> = {
  CONSULTING: "예약 완료",
  DEPOSIT_PAID: "계약금 납입 완료",
  IN_PROGRESS: "서비스 진행중",
  BALANCE_PAID: "서비스 이용 완료",
  COMPLETED: "서비스 이용 완료",
}

const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"]

interface ReservationViewProps {
  onNavigateToSchedule?: () => void
}

export function ReservationView({ onNavigateToSchedule }: ReservationViewProps) {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filter, setFilter] = useState<"전체" | "예정" | "완료" | "취소">("전체")
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [modalVendor, setModalVendor] = useState<any>(null)
  const [vendorLoading, setVendorLoading] = useState(false)

  const openVendorModal = async (vendorId: string) => {
    setVendorLoading(true)
    try {
      const v = await fetchVendorDetail(vendorId)
      setModalVendor(v)
    } catch {
      setModalVendor(null)
    } finally {
      setVendorLoading(false)
    }
  }

  useEffect(() => {
    getReservations()
      .then((res) => {
        const mapped: Reservation[] = res.data.map((r) => {
          let status: "예정" | "완료" | "취소" = "예정"
          if (r.status === "CANCELLED") status = "취소"
          else if (r.progress === "BALANCE_PAID" || r.progress === "COMPLETED") status = "완료"

          return {
            id: r.id.toString(),
            vendorId: r.vendorId.toString(),
            vendorName: r.vendorName || `업체 #${r.vendorId}`,
            category: r.category || "",
            imageUrl: r.imageUrl || "",
            date: r.reservationDate || r.serviceDate || "",
            time: r.reservationTime || "",
            status,
            progress: r.progress || "",
            notes: r.memo || undefined,
          }
        })
        setReservations(mapped)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = filter === "전체" ? reservations : reservations.filter(r => r.status === filter)

  const handleCancel = async (id: string) => {
    try {
      await cancelReservation(Number(id))
      setReservations(prev =>
        prev.map(r => (r.id === id ? { ...r, status: "취소" as const } : r))
      )
    } catch {
      alert("예약 취소에 실패했습니다.")
    }
  }

  const handleUpdate = async (id: string, data: { date: string; time: string; memo: string }) => {
    try {
      await updateReservation(Number(id), {
        reservationDate: data.date,
        serviceDate: data.date,
        reservationTime: data.time,
        memo: data.memo || undefined,
      })
      setReservations(prev =>
        prev.map(r => (r.id === id ? { ...r, date: data.date, time: data.time, notes: data.memo || undefined } : r))
      )
      setEditingId(null)
    } catch {
      alert("예약 변경에 실패했습니다.")
    }
  }

  const counts = {
    전체: reservations.length,
    예정: reservations.filter(r => r.status === "예정").length,
    완료: reservations.filter(r => r.status === "완료").length,
    취소: reservations.filter(r => r.status === "취소").length,
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  const editingReservation = editingId ? reservations.find(r => r.id === editingId) : null

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <CalendarCheck className="size-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">예약관리</h1>
          </div>
          <p className="mt-1 text-muted-foreground">업체 방문 예약을 확인하고 관리하세요</p>
        </div>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {(["예정", "완료", "취소"] as const).map(s => (
            <div key={s} className="rounded-xl bg-card p-4 shadow-sm text-center">
              <p className="text-2xl font-bold text-foreground">{counts[s]}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s}</p>
            </div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="mb-5 flex gap-2">
          {(["전체", "예정", "완료", "취소"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {f} {counts[f] > 0 && <span className="opacity-70">({counts[f]})</span>}
            </button>
          ))}
        </div>

        {/* Reservation List */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CalendarCheck className="size-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">예약 내역이 없습니다</p>
            <p className="text-sm text-muted-foreground/70 mt-1">업체 상세에서 예약을 생성해보세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                <div
                  className={`flex w-full items-center gap-4 px-4 py-4 text-left ${r.status !== "취소" ? "cursor-pointer" : ""}`}
                  onClick={() => r.status !== "취소" && setExpanded(expanded === r.id ? null : r.id)}
                >
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt={r.vendorName} className="size-11 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                      📋
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p
                        className="font-semibold truncate text-primary cursor-pointer hover:underline"
                        onClick={(e) => { e.stopPropagation(); openVendorModal(r.vendorId) }}
                      >{r.vendorName}</p>
                      {r.category && (
                        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {r.category === "studio" ? "스튜디오" : r.category === "dress" ? "드레스" : r.category === "makeup" ? "메이크업" : r.category === "hall" ? "웨딩홀" : r.category}
                        </span>
                      )}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[r.status].badge}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="size-3" />
                        {r.date}
                      </span>
                      {r.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {r.time}
                        </span>
                      )}
                    </div>
                    {r.progress && (
                      <p className="mt-1 text-xs text-primary">{progressLabel[r.progress] || r.progress}</p>
                    )}
                  </div>
                  {r.status !== "취소" && (
                    <ChevronRight
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded === r.id ? "rotate-90" : ""}`}
                    />
                  )}
                </div>

                {expanded === r.id && (
                  <div className="border-t border-border px-4 py-4 space-y-3">
                    {r.notes && (
                      <div className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                        {r.notes}
                      </div>
                    )}

                    {r.status === "예정" && (
                      <div className="space-y-2 pt-1">
                        {r.progress === "CONSULTING" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); openVendorModal(r.vendorId) }}
                            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            💳 계약금 결제하기
                          </button>
                        )}
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleCancel(r.id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive py-2 text-sm text-destructive hover:bg-destructive/5"
                          >
                            <X className="size-4" />
                            예약 취소
                          </button>
                          <button
                            onClick={() => setEditingId(r.id)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-primary py-2 text-sm text-primary hover:bg-primary/5"
                          >
                            <Pencil className="size-4" />
                            예약 변경
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 예약 변경 모달 */}
      {editingReservation && (
        <EditReservationModal
          reservation={editingReservation}
          onClose={() => setEditingId(null)}
          onSave={handleUpdate}
        />
      )}

      {/* 업체 상세 모달 */}
      {(modalVendor || vendorLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalVendor(null)} />
          <div className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-background shadow-2xl" style={{ maxHeight: "85vh" }}>
            <div className="flex justify-between items-center px-4 pt-3 pb-1 shrink-0">
              <div />
              <button onClick={() => setModalVendor(null)} className="flex size-8 items-center justify-center rounded-full hover:bg-muted">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            {vendorLoading ? (
              <div className="flex items-center justify-center py-20">
                <p className="text-sm text-muted-foreground">불러오는 중...</p>
              </div>
            ) : modalVendor && (
              <div className="flex-1 min-h-0 overflow-y-auto [&_.sticky]:hidden">
                <VendorDetailView
                  vendor={modalVendor}
                  onBack={() => setModalVendor(null)}
                  onToggleFavorite={() => {
                    setModalVendor((p: any) => p ? { ...p, isFavorite: !p.isFavorite } : null)
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 예약 변경 모달 ──────────────────────────────────────────────────────

function EditReservationModal({
  reservation,
  onClose,
  onSave,
}: {
  reservation: Reservation
  onClose: () => void
  onSave: (id: string, data: { date: string; time: string; memo: string }) => Promise<void>
}) {
  const parseDate = (str: string) => {
    const [y, m, d] = str.split("-").map(Number)
    return new Date(y, m - 1, d)
  }

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    reservation.date ? parseDate(reservation.date) : undefined
  )
  const [time, setTime] = useState(reservation.time || "")
  const [memo, setMemo] = useState(reservation.notes || "")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookedTimes, setBookedTimes] = useState<string[]>([])
  const [loadingTimes, setLoadingTimes] = useState(false)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const formatDateStr = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  }

  const date = selectedDate ? formatDateStr(selectedDate) : ""

  const loadBookedTimes = async (dateStr: string) => {
    setLoadingTimes(true)
    try {
      const res = await getBookedTimes(Number(reservation.vendorId), dateStr)
      // 현재 예약 시간은 제외 (자기 자신은 선택 가능)
      setBookedTimes(res.data.filter((t: string) => !(dateStr === reservation.date && t === reservation.time)))
    } catch {
      setBookedTimes([])
    } finally {
      setLoadingTimes(false)
    }
  }

  useEffect(() => {
    if (date) loadBookedTimes(date)
  }, [])

  const handleSubmit = async () => {
    if (!date || !time || isSubmitting) return
    setIsSubmitting(true)
    try {
      await onSave(reservation.id, { date, time, memo })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="mx-4 w-full max-w-md rounded-2xl bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">예약 변경</h2>
          <button onClick={onClose}><X className="size-5 text-muted-foreground" /></button>
        </div>
        <p className="mb-5 text-sm text-muted-foreground">{reservation.vendorName}</p>

        <div className="space-y-5">
          {/* 날짜 선택 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">방문 날짜</label>
            <div className="flex justify-center rounded-xl border border-border p-1">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(day) => {
                  setSelectedDate(day)
                  setTime("")
                  if (day) loadBookedTimes(formatDateStr(day))
                  else setBookedTimes([])
                }}
                disabled={[{ before: today }]}
                className="!w-full"
                classNames={{ today: "" }}
              />
            </div>
            {selectedDate && (
              <p className="mt-2 text-center text-sm font-medium text-foreground">{date}</p>
            )}
          </div>

          {/* 시간 선택 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">방문 시간</label>
            {loadingTimes ? (
              <p className="py-4 text-center text-sm text-muted-foreground">예약 가능 시간 확인 중...</p>
            ) : !date ? (
              <p className="py-4 text-center text-sm text-muted-foreground">날짜를 먼저 선택해주세요</p>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {TIME_SLOTS.map((t) => {
                  const isBooked = bookedTimes.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => !isBooked && setTime(t)}
                      disabled={isBooked}
                      className={`rounded-xl border py-2.5 text-sm font-medium transition-all ${
                        isBooked
                          ? "border-border bg-muted text-muted-foreground/50 cursor-not-allowed"
                          : time === t
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      {t}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 메모 */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-foreground">
              메모 <span className="text-xs text-muted-foreground font-normal">(선택)</span>
            </label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="상담 내용, 질문 사항, 요청 사항 등을 적어주세요"
              rows={3}
              className="rounded-xl"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={onClose}>취소</Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-foreground text-background hover:bg-foreground/90"
            onClick={handleSubmit}
            disabled={!date || !time || isSubmitting}
          >
            {isSubmitting ? "변경 중..." : "예약 변경"}
          </Button>
        </div>
      </div>
    </div>
  )
}
