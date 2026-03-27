"use client"

import { useState, useEffect } from "react"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Pencil,
  Trash2,
  X,
  Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAccessToken } from "@/lib/api"
import { fetchVendorDetail } from "@/lib/api/vendor-detail"
import { VendorDetailView } from "@/components/views/vendors-view"

interface ScheduleItem {
  id: string
  title: string
  date: string
  time: string
  location: string
  category: string
  status: "진행중" | "대기중" | "완료"
  vendorId?: string
}

interface ScheduleApiItem {
  id: number
  title: string
  date: string
  time: string
  location: string
  category: string
  status: string
  vendorId?: number
}

function mapApiItem(item: ScheduleApiItem): ScheduleItem {
  return {
    id: String(item.id),
    title: item.title,
    date: item.date ?? "",
    time: item.time ?? "00:00",
    location: item.location ?? "",
    category: item.category ?? "STUDIO",
    status: (item.status as ScheduleItem["status"]) ?? "대기중",
    vendorId: item.vendorId != null ? String(item.vendorId) : undefined,
  }
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

const DAYS = ["일", "월", "화", "수", "목", "금", "토"]

const CATEGORIES = [
  { value: "STUDIO", label: "스튜디오" },
  { value: "DRESS", label: "드레스" },
  { value: "MAKEUP", label: "메이크업" },
  { value: "HALL", label: "웨딩홀" },
  { value: "ETC", label: "기타" },
] as const

const CATEGORY_COLORS: Record<string, string> = {
  STUDIO: "bg-blue-100 text-blue-700",
  DRESS: "bg-pink-100 text-pink-700",
  MAKEUP: "bg-violet-100 text-violet-700",
  HALL: "bg-amber-100 text-amber-700",
  ETC: "bg-gray-100 text-gray-700",
}

const statusColors = {
  진행중: "bg-primary text-primary-foreground",
  대기중: "bg-muted text-muted-foreground",
  완료: "bg-green-100 text-green-700",
}

// ─── 일정 셀 색상 ─────────────────────────────────────────────────────────────
const EVENT_PILL_COLORS = [
  "bg-primary/15 text-primary",
  "bg-pink-100 text-pink-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
]

function getEventColor(id: string) {
  const hash = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)
  return EVENT_PILL_COLORS[hash % EVENT_PILL_COLORS.length]
}

// ─── Edit/Add Form ────────────────────────────────────────────────────────────

function ScheduleForm({
  initial,
  onSave,
  onCancel,
  title: formTitle,
}: {
  initial?: Omit<ScheduleItem, "id">
  onSave: (item: Omit<ScheduleItem, "id">) => void
  onCancel: () => void
  title: string
}) {
  const [title, setTitle] = useState(initial?.title ?? "")
  const [date, setDate] = useState(initial?.date ?? "")
  const [time, setTime] = useState(initial?.time ?? "")
  const [location, setLocation] = useState(initial?.location ?? "")
  const [category, setCategory] = useState(initial?.category ?? "STUDIO")
  const [status, setStatus] = useState<ScheduleItem["status"]>(initial?.status ?? "대기중")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date) return
    onSave({
      title,
      date,
      time: time || "00:00",
      location: location || "",
      category,
      status,
    })
  }

  return (
    <form onSubmit={handleSubmit} className={formTitle ? "mb-6 rounded-2xl bg-card p-5 shadow-sm border border-border" : ""}>
      {formTitle && <h3 className="mb-4 font-semibold text-foreground">{formTitle}</h3>}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted-foreground">일정명 *</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 드레스 피팅" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">날짜 *</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">시간</label>
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">장소</label>
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="예: 메종 블랑쉬 아틀리에" />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted-foreground">상태</label>
          <div className="flex gap-2">
            {(["대기중", "진행중", "완료"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  status === s ? statusColors[s] : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>취소</Button>
        <Button type="submit" className="bg-primary text-primary-foreground" disabled={!title || !date}>
          저장
        </Button>
      </div>
    </form>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export function ScheduleView() {
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [currentDate, setCurrentDate] = useState(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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
    const load = async () => {
      try {
        const res = await fetch("/api/schedules", {
          credentials: "include",
          headers: authHeaders(),
        })
        if (!res.ok) return
        const json = await res.json()
        const raw: ScheduleApiItem[] = Array.isArray(json) ? json : (json.data ?? [])
        setItems(raw.map(mapApiItem))
      } catch {
        // ignore
      }
    }
    void load()
  }, [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startingDay = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}월 ${d.getDate()}일`
  }

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return items.filter((item) => item.date === dateStr)
  }

  const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`
  const upcomingEvents = [...items]
    .filter((item) => item.date?.startsWith(currentMonthPrefix))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const calendarDays: (number | null)[] = []
  for (let i = 0; i < startingDay; i++) calendarDays.push(null)
  for (let day = 1; day <= totalDays; day++) calendarDays.push(day)

  const today = new Date()
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day

  const updateStatus = async (id: string, status: ScheduleItem["status"]) => {
    await fetch(`/api/schedules/${id}/status`, {
      method: "PUT",
      credentials: "include",
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    })
  }

  const handleAdd = async (item: Omit<ScheduleItem, "id">) => {
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          title: item.title,
          date: item.date,
          time: item.time,
          location: item.location,
          category: item.category,
        }),
      })
      if (res.ok) {
        const json = await res.json()
        const created: ScheduleApiItem = json.data ?? json
        const newItem = mapApiItem(created)
        if (item.status !== "대기중") {
          await updateStatus(newItem.id, item.status)
          newItem.status = item.status
        }
        setItems((prev) => [...prev, newItem])
      }
    } catch {
      // ignore
    }
    setShowAddForm(false)
  }

  const handleEdit = async (id: string, item: Omit<ScheduleItem, "id">) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({
          title: item.title,
          date: item.date,
          time: item.time,
          location: item.location,
          category: item.category,
        }),
      })
      if (res.ok) {
        await updateStatus(id, item.status)
        setItems((prev) => prev.map((i) => (i.id === id ? { ...item, id } : i)))
      }
    } catch {
      // ignore
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "DELETE",
        credentials: "include",
        headers: authHeaders(),
      })
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== id))
      }
    } catch {
      // ignore
    }
    setDeletingId(null)
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">일정</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">웨딩 준비 일정을 한눈에 관리하세요</p>
          </div>
          <Button
            onClick={() => { setShowAddForm(true); setEditingId(null) }}
            className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
            size="sm"
          >
            <Plus className="size-4" />
            일정 추가
          </Button>
        </div>

        {/* Calendar Card */}
        <div className="mb-5 rounded-2xl border border-border bg-card shadow-sm">
          {/* Calendar Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <button onClick={prevMonth} className="rounded-full p-1.5 hover:bg-muted">
              <ChevronLeft className="size-4" />
            </button>
            <h2 className="text-base font-semibold text-foreground">
              {year}년 {month + 1}월
            </h2>
            <button onClick={nextMonth} className="rounded-full p-1.5 hover:bg-muted">
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="p-3">
            {/* Day Headers */}
            <div className="mb-1 grid grid-cols-7">
              {DAYS.map((day, index) => (
                <div
                  key={day}
                  className={`py-1 text-center text-xs font-medium ${
                    index === 0 ? "text-red-500" : "text-muted-foreground"
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="min-h-[72px] bg-muted/20 p-1" />
                }

                const events = getEventsForDate(day)
                const dayOfWeek = (startingDay + day - 1) % 7
                const todayCell = isToday(day)

                return (
                  <div
                    key={day}
                    className={`min-h-[72px] bg-card p-1 flex flex-col ${
                      todayCell ? "bg-primary/5" : ""
                    }`}
                  >
                    {/* 날짜 숫자 */}
                    <span
                      className={`mb-0.5 flex size-5 items-center justify-center self-start rounded-full text-xs font-medium ${
                        todayCell
                          ? "bg-primary text-primary-foreground"
                          : dayOfWeek === 0
                            ? "text-red-500"
                            : "text-foreground"
                      }`}
                    >
                      {day}
                    </span>

                    {/* 일정 표시 */}
                    <div className="flex flex-col gap-0.5">
                      {events.slice(0, 2).map((ev) => (
                        <div
                          key={ev.id}
                          className={`truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight ${getEventColor(ev.id)}`}
                          title={ev.title}
                        >
                          {ev.title}
                        </div>
                      ))}
                      {events.length > 2 && (
                        <span className="px-1 text-[10px] text-muted-foreground">
                          +{events.length - 2}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Event List */}
        <div className="rounded-2xl bg-card border border-border shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold text-foreground">{month + 1}월 일정</h2>
          </div>

          {upcomingEvents.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">등록된 일정이 없어요</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {upcomingEvents.map((event) => {
                const isEditing = editingId === event.id
                const isDeleting = deletingId === event.id

                if (isEditing) {
                  return (
                    <div key={event.id} className="p-4">
                      <ScheduleForm
                        title="일정 수정"
                        initial={event}
                        onSave={(item) => handleEdit(event.id, item)}
                        onCancel={() => setEditingId(null)}
                      />
                    </div>
                  )
                }

                return (
                  <div key={event.id} className="px-5 py-4">
                    {isDeleting ? (
                      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                        <p className="text-sm font-medium text-foreground">"{event.title}" 일정을 삭제할까요?</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setDeletingId(null)}
                            className="flex-1 rounded-lg border border-border py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                          >
                            취소
                          </button>
                          <button
                            onClick={() => handleDelete(event.id)}
                            className="flex-1 rounded-lg bg-destructive py-1.5 text-xs font-medium text-white hover:bg-destructive/90 transition-colors"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        {/* 날짜 블록 */}
                        <div className="shrink-0 text-center w-10">
                          <div className="text-xs text-muted-foreground leading-none">
                            {event.date ? new Date(event.date).getMonth() + 1 : "-"}월
                          </div>
                          <div className="text-xl font-bold text-foreground leading-tight">
                            {event.date ? new Date(event.date).getDate() : "-"}
                          </div>
                          <div className="text-xs text-muted-foreground leading-none">
                            {event.date ? DAYS[new Date(event.date).getDay()] : ""}
                          </div>
                        </div>

                        {/* 구분선 */}
                        <div className={`mt-1 w-0.5 self-stretch rounded-full ${getEventColor(event.id).split(" ")[0]}`} />

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS["기타"]
                            }`}>
                              {event.category}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[event.status]}`}>
                              {event.status}
                            </span>
                          </div>
                          <h3
                            className={`font-semibold text-foreground ${event.vendorId ? "cursor-pointer text-primary hover:underline" : ""}`}
                            onClick={() => event.vendorId && openVendorModal(event.vendorId)}
                          >{event.title}</h3>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="size-3" />
                              <span>{event.time?.slice(0, 5)}</span>
                            </div>
                            {event.location && (
                              <div className="flex items-center gap-1">
                                <MapPin className="size-3" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 수정/삭제 버튼 */}
                        <div className="shrink-0 flex items-center gap-1">
                          <button
                            onClick={() => { setEditingId(event.id); setDeletingId(null) }}
                            className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                            title="수정"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            onClick={() => { setDeletingId(event.id); setEditingId(null) }}
                            className="rounded-lg p-1.5 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="h-6" />
      </div>

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

      {/* Add Schedule Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="font-semibold text-foreground">새 일정 추가</h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="rounded-full p-1.5 hover:bg-muted"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-5">
              <ScheduleForm
                title=""
                onSave={handleAdd}
                onCancel={() => setShowAddForm(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
