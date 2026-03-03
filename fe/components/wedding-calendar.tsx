"use client"

import { useState } from "react"
import { useWedding, type WeddingEvent } from "@/lib/wedding-store"
import {
  Plus,
  Trash2,
  MapPin,
  Clock,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const categoryColors: Record<string, string> = {
  meeting: "bg-chart-1",
  fitting: "bg-chart-2",
  tasting: "bg-chart-3",
  rehearsal: "bg-chart-4",
  ceremony: "bg-foreground",
  other: "bg-chart-5",
}

const categoryLabels: Record<string, string> = {
  meeting: "미팅",
  fitting: "피팅",
  tasting: "시식",
  rehearsal: "리허설",
  ceremony: "본식",
  other: "기타",
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  completed: { label: "완료", cls: "bg-foreground text-background" },
  "in-progress": { label: "진행중", cls: "bg-chart-3 text-background" },
  waiting: { label: "대기중", cls: "bg-secondary text-muted-foreground" },
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"]
const MONTHS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"]

function EventCard({
  event,
  onStatusChange,
  onDelete,
  onEdit,
}: {
  event: WeddingEvent
  onStatusChange: (status: WeddingEvent["status"]) => void
  onDelete: () => void
  onEdit: () => void
}) {
  const st = statusConfig[event.status]
  const nextStatus: Record<string, WeddingEvent["status"]> = {
    waiting: "in-progress",
    "in-progress": "completed",
    completed: "waiting",
  }

  return (
    <div className={cn("bg-card rounded-2xl border border-border/50 p-4 shadow-sm transition-all duration-200", event.status === "completed" && "opacity-60")}>
      <div className="flex items-start gap-3">
        {/* Status Badge (clickable to cycle) */}
        <button
          onClick={() => onStatusChange(nextStatus[event.status])}
          className={cn("shrink-0 mt-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-all", st.cls)}
          aria-label={`상태 변경: ${st.label}`}
        >
          {st.label}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn("size-2 rounded-full shrink-0", categoryColors[event.category])} />
            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{categoryLabels[event.category]}</span>
          </div>
          <h4 className={cn("text-sm font-medium mt-1", event.status === "completed" && "line-through text-muted-foreground")}>{event.title}</h4>
          <div className="flex flex-col gap-1 mt-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3" /><span>{event.time}</span>
            </div>
            {event.location && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="size-3" /><span>{event.location}</span>
              </div>
            )}
            {event.memo && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <StickyNote className="size-3" /><span>{event.memo}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onEdit} className="text-muted-foreground/50 hover:text-foreground transition-colors" aria-label="일정 수정">
            <Pencil className="size-4" />
          </button>
          <button onClick={onDelete} className="text-muted-foreground/50 hover:text-destructive transition-colors" aria-label="일정 삭제">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function WeddingCalendar() {
  const { events, addEvent, updateEvent, removeEvent } = useWedding()
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    time: "10:00",
    location: "",
    memo: "",
    category: "meeting" as WeddingEvent["category"],
  })
  const [editingEvent, setEditingEvent] = useState<WeddingEvent | null>(null)
  const [editForm, setEditForm] = useState({
    title: "",
    time: "10:00",
    location: "",
    memo: "",
    category: "meeting" as WeddingEvent["category"],
  })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)

  const goToPrevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDate(null) }
  const goToNextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDate(null) }

  const formatDateKey = (day: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`

  const eventsOnDate = (dateKey: string) => events.filter((e) => e.date === dateKey)
  const selectedEvents = selectedDate ? eventsOnDate(selectedDate) : []

  const handleAddEvent = () => {
    if (!newEvent.title.trim() || !selectedDate) return
    addEvent({ ...newEvent, date: selectedDate, status: "waiting" })
    setNewEvent({ title: "", time: "10:00", location: "", memo: "", category: "meeting" })
    setShowAddDialog(false)
  }

  const handleEditOpen = (event: WeddingEvent) => {
    setEditingEvent(event)
    setEditForm({ title: event.title, time: event.time, location: event.location, memo: event.memo, category: event.category })
  }

  const handleEditSave = () => {
    if (!editingEvent || !editForm.title.trim()) return
    updateEvent(editingEvent.id, editForm)
    setEditingEvent(null)
  }

  const upcomingEvents = events
    .filter((e) => e.status !== "completed" && e.date >= new Date().toISOString().split("T")[0])
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 5)

  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl">일정</h2>
        <p className="text-sm text-muted-foreground mt-1">웨딩 준비 일정을 한눈에 관리하세요</p>
      </div>

      {/* Calendar */}
      <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <button onClick={goToPrevMonth} className="size-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors" aria-label="이전 달"><ChevronLeft className="size-4" /></button>
          <span className="text-sm font-medium">{year}년 {MONTHS[month]}</span>
          <button onClick={goToNextMonth} className="size-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors" aria-label="다음 달"><ChevronRight className="size-4" /></button>
        </div>

        <div className="grid grid-cols-7 gap-0 mb-2">
          {WEEKDAYS.map((day) => (
            <div key={day} className={cn("text-center text-[10px] font-medium py-1", day === "일" ? "text-destructive" : "text-muted-foreground")}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="aspect-square" />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateKey = formatDateKey(day)
            const dayEvents = eventsOnDate(dateKey)
            const isSelected = selectedDate === dateKey
            const isToday = dateKey === new Date().toISOString().split("T")[0]
            const isSunday = new Date(year, month, day).getDay() === 0

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateKey)}
                className={cn(
                  "aspect-square flex flex-col items-center justify-center rounded-xl relative transition-all duration-200",
                  isSelected ? "bg-foreground text-background" : isToday ? "bg-secondary text-foreground" : "hover:bg-secondary/50",
                  isSunday && !isSelected && "text-destructive"
                )}
              >
                <span className="text-xs font-medium">{day}</span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEvents.slice(0, 3).map((ev, idx) => (
                      <span key={idx} className={cn("size-1 rounded-full", isSelected ? "bg-background" : categoryColors[ev.category])} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
            </h3>
            <Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm" className="rounded-full h-8 gap-1.5 text-xs">
              <Plus className="size-3.5" />일정 추가
            </Button>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
              <p className="text-sm text-muted-foreground">이 날짜에 일정이 없습니다</p>
              <Button onClick={() => setShowAddDialog(true)} variant="outline" size="sm" className="rounded-full mt-3 text-xs">일정 추가하기</Button>
            </div>
          ) : (
            selectedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onStatusChange={(status) => updateEvent(event.id, { status })}
                onDelete={() => removeEvent(event.id)}
                onEdit={() => handleEditOpen(event)}
              />
            ))
          )}
        </div>
      )}

      {/* Upcoming Events */}
      {!selectedDate && upcomingEvents.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">다가오는 일정</h3>
          {upcomingEvents.map((event) => {
            const st = statusConfig[event.status]
            return (
              <div key={event.id} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={cn("size-2 rounded-full shrink-0", categoryColors[event.category])} />
                  <span className="text-[10px] text-muted-foreground font-medium">{categoryLabels[event.category]}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium ml-1", st.cls)}>{st.label}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {new Date(event.date + "T00:00:00").toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                  </span>
                </div>
                <h4 className="text-sm font-medium">{event.title}</h4>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="size-3" />{event.time}</span>
                  {event.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{event.location}</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add Event Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle className="text-lg">새 일정 추가</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">일정 제목</label>
              <Input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="예: 드레스 피팅" className="rounded-xl h-10" />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted-foreground font-medium">시간</label>
                <Input type="time" value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} className="rounded-xl h-10" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted-foreground font-medium">카테고리</label>
                <select
                  value={newEvent.category}
                  onChange={(e) => setNewEvent({ ...newEvent, category: e.target.value as WeddingEvent["category"] })}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">장소</label>
              <Input value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} placeholder="예: 강남구 OO빌딩" className="rounded-xl h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">메모</label>
              <Input value={newEvent.memo} onChange={(e) => setNewEvent({ ...newEvent, memo: e.target.value })} placeholder="예: 준비물 챙기기" className="rounded-xl h-10" />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={handleAddEvent} disabled={!newEvent.title.trim()} className="w-full rounded-full h-11">추가하기</Button>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      <Dialog open={!!editingEvent} onOpenChange={(open) => { if (!open) setEditingEvent(null) }}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle className="text-lg">일정 수정</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">일정 제목</label>
              <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} placeholder="예: 드레스 피팅" className="rounded-xl h-10" />
            </div>
            <div className="flex gap-3">
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted-foreground font-medium">시간</label>
                <Input type="time" value={editForm.time} onChange={(e) => setEditForm({ ...editForm, time: e.target.value })} className="rounded-xl h-10" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-xs text-muted-foreground font-medium">카테고리</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as WeddingEvent["category"] })}
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                >
                  {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">장소</label>
              <Input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} placeholder="예: 강남구 OO빌딩" className="rounded-xl h-10" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-muted-foreground font-medium">메모</label>
              <Input value={editForm.memo} onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })} placeholder="예: 준비물 챙기기" className="rounded-xl h-10" />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={handleEditSave} disabled={!editForm.title.trim()} className="w-full rounded-full h-11">저장하기</Button>
            <Button variant="outline" onClick={() => setEditingEvent(null)} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
