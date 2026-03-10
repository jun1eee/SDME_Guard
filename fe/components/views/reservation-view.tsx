"use client"

import { useState } from "react"
import { CalendarCheck, MapPin, Clock, ChevronRight, X, Check } from "lucide-react"

interface Reservation {
  id: string
  vendor: string
  category: string
  date: string
  time: string
  location: string
  status: "예정" | "완료" | "취소"
  notes?: string
}

const initialReservations: Reservation[] = [
  {
    id: "1",
    vendor: "더 그랜드 파빌리온",
    category: "웨딩홀",
    date: "2026-03-15",
    time: "14:00",
    location: "서울 강남구 테헤란로 152",
    status: "예정",
    notes: "웨딩홀 투어 및 상담 예약",
  },
  {
    id: "2",
    vendor: "로앤스튜디오",
    category: "스튜디오",
    date: "2026-03-20",
    time: "11:00",
    location: "서울 마포구 홍익로 30",
    status: "예정",
    notes: "촬영 컨셉 상담",
  },
  {
    id: "3",
    vendor: "모니카블랑쉬",
    category: "드레스",
    date: "2026-02-10",
    time: "13:00",
    location: "서울 서초구 반포대로 59",
    status: "완료",
    notes: "드레스 피팅 1차",
  },
  {
    id: "4",
    vendor: "글로우 뷰티",
    category: "메이크업",
    date: "2026-01-25",
    time: "10:00",
    location: "서울 강남구 압구정로 50",
    status: "취소",
  },
]

const statusStyle: Record<string, { badge: string; dot: string }> = {
  예정: { badge: "bg-blue-50 text-blue-600", dot: "bg-blue-500" },
  완료: { badge: "bg-emerald-50 text-emerald-600", dot: "bg-emerald-500" },
  취소: { badge: "bg-red-50 text-red-500", dot: "bg-red-400" },
}

const categoryIcon: Record<string, string> = {
  웨딩홀: "🏛️",
  스튜디오: "📷",
  드레스: "👗",
  메이크업: "💄",
}

interface ReservationViewProps {
  onNavigateToSchedule?: () => void
}

export function ReservationView({ onNavigateToSchedule }: ReservationViewProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [filter, setFilter] = useState<"전체" | "예정" | "완료" | "취소">("전체")
  const [expanded, setExpanded] = useState<string | null>(null)

  const filtered = filter === "전체" ? reservations : reservations.filter(r => r.status === filter)

  const cancelReservation = (id: string) => {
    setReservations(prev =>
      prev.map(r => (r.id === id ? { ...r, status: "취소" as const } : r))
    )
  }

  const counts = {
    전체: reservations.length,
    예정: reservations.filter(r => r.status === "예정").length,
    완료: reservations.filter(r => r.status === "완료").length,
    취소: reservations.filter(r => r.status === "취소").length,
  }

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
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <div key={r.id} className="overflow-hidden rounded-2xl bg-card shadow-sm">
                <button
                  className="flex w-full items-center gap-4 px-4 py-4 text-left"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                >
                  {/* Icon */}
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-xl">
                    {categoryIcon[r.category] ?? "📋"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground truncate">{r.vendor}</p>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusStyle[r.status].badge}`}>
                        {r.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarCheck className="size-3" />
                        {r.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {r.time}
                      </span>
                    </div>
                  </div>

                  <ChevronRight
                    className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded === r.id ? "rotate-90" : ""}`}
                  />
                </button>

                {/* Expanded Detail */}
                {expanded === r.id && (
                  <div className="border-t border-border px-4 py-4 space-y-3">
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="size-4 shrink-0 mt-0.5 text-muted-foreground" />
                      <span className="text-foreground">{r.location}</span>
                    </div>

                    {r.notes && (
                      <div className="rounded-lg bg-muted px-3 py-2.5 text-sm text-foreground">
                        {r.notes}
                      </div>
                    )}

                    {r.status === "예정" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => cancelReservation(r.id)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-destructive py-2 text-sm text-destructive hover:bg-destructive/5"
                        >
                          <X className="size-4" />
                          예약 취소
                        </button>
                        <button
                          onClick={onNavigateToSchedule}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-sm text-primary-foreground hover:bg-primary/90"
                        >
                          <Check className="size-4" />
                          일정 확인
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
