"use client"

import { useState } from "react"
import { 
  Plus, 
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ScheduleItem {
  id: string
  title: string
  date: string
  time: string
  location: string
  category: string
  status: "진행중" | "대기중" | "완료"
}

const initialSchedule: ScheduleItem[] = [
  { 
    id: "1", 
    title: "드레스 피팅", 
    date: "2026-04-20", 
    time: "11:00",
    location: "메종 블랑쉬 아틀리에",
    category: "피팅",
    status: "진행중"
  },
  { 
    id: "2", 
    title: "메이크업 리허설", 
    date: "2026-05-01", 
    time: "10:00",
    location: "글로우 뷰티",
    category: "리허설",
    status: "대기중"
  },
  { 
    id: "3", 
    title: "식사 시식회", 
    date: "2026-05-10", 
    time: "18:00",
    location: "더 그랜드 파빌리온",
    category: "시식",
    status: "대기중"
  },
  { 
    id: "4", 
    title: "스튜디오 촬영", 
    date: "2026-05-15", 
    time: "09:00",
    location: "로앤스튜디오",
    category: "촬영",
    status: "대기중"
  },
]

const DAYS = ["일", "월", "화", "수", "목", "금", "토"]

const statusColors = {
  "진행중": "bg-primary text-primary-foreground",
  "대기중": "bg-muted text-muted-foreground",
  "완료": "bg-green-100 text-green-700",
}

export function ScheduleView() {
  const [items, setItems] = useState<ScheduleItem[]>(initialSchedule)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 9)) // March 2026
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Calendar calculations
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startingDay = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return `${date.getMonth() + 1}월 ${date.getDate()}일`
  }

  // Get events for a specific date
  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    return items.filter(item => item.date === dateStr)
  }

  // Upcoming events (sorted by date)
  const upcomingEvents = [...items]
    .filter(item => new Date(item.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5)

  // Generate calendar days
  const calendarDays = []
  for (let i = 0; i < startingDay; i++) {
    calendarDays.push(null)
  }
  for (let day = 1; day <= totalDays; day++) {
    calendarDays.push(day)
  }

  const today = new Date()
  const isToday = (day: number) => 
    today.getFullYear() === year && 
    today.getMonth() === month && 
    today.getDate() === day

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-semibold text-foreground">일정</h1>
          <p className="mt-2 text-sm text-muted-foreground">웨딩 준비 일정을 한눈에 관리하세요</p>
        </div>

        {/* Calendar Card */}
        <div className="mb-6 rounded-3xl border border-border bg-card p-6 shadow-md">
          {/* Calendar Header */}
          <div className="mb-6 flex items-center justify-between">
            <button
              onClick={prevMonth}
              className="rounded-full p-2 hover:bg-muted"
            >
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="text-lg font-semibold text-foreground">
              {year}년 {month + 1}월
            </h2>
            <button
              onClick={nextMonth}
              className="rounded-full p-2 hover:bg-muted"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>

          {/* Day Headers */}
          <div className="mb-2 grid grid-cols-7 gap-2">
            {DAYS.map((day, index) => (
              <div
                key={day}
                className={`py-2 text-center text-sm font-medium ${
                  index === 0 ? "text-red-500" : "text-muted-foreground"
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return <div key={`empty-${index}`} className="aspect-square" />
              }

              const events = getEventsForDate(day)
              const dayOfWeek = (startingDay + day - 1) % 7

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(new Date(year, month, day))}
                  className={`relative flex aspect-square items-center justify-center rounded-full text-sm transition-colors hover:bg-muted ${
                    isToday(day) ? "bg-muted" : ""
                  } ${dayOfWeek === 0 ? "text-red-500" : "text-foreground"}`}
                >
                  <span className={`${isToday(day) ? "font-semibold" : ""}`}>
                    {day}
                  </span>
                  {events.length > 0 && (
                    <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                      {events.slice(0, 3).map((_, i) => (
                        <div key={i} className="size-1 rounded-full bg-primary" />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Add Schedule Button */}
        <div className="mb-6">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-5" />
            일정 추가
          </Button>
        </div>

        {showAddForm && (
          <AddScheduleForm
            onAdd={(item) => {
              setItems([...items, { ...item, id: Date.now().toString() }])
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Upcoming Events */}
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-primary">다가오는 일정</h2>
          
          <div className="space-y-4">
            {upcomingEvents.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border border-border p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full bg-foreground" />
                    <span className="text-sm text-muted-foreground">{event.category}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[event.status]}`}>
                      {event.status}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">{formatDate(event.date)}</span>
                </div>
                
                <h3 className="mt-2 text-lg font-semibold text-foreground">{event.title}</h3>
                
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="size-4" />
                    <span>{event.time}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="size-4" />
                    <span>{event.location}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {upcomingEvents.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">예정된 일정이 없습니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AddScheduleForm({
  onAdd,
  onCancel,
}: {
  onAdd: (item: Omit<ScheduleItem, "id">) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [location, setLocation] = useState("")
  const [category, setCategory] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !date) return
    
    onAdd({
      title,
      date,
      time: time || "00:00",
      location: location || "미정",
      category: category || "기타",
      status: "대기중",
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">새 일정 추가</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted-foreground">일정명</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 드레스 피팅"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">날짜</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">시간</label>
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">장소</label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="예: 메종 블랑쉬 아틀리에"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">카테고리</label>
          <Input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="예: 피팅, 리허설, 시식"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="bg-primary text-primary-foreground">
          추가
        </Button>
      </div>
    </form>
  )
}
