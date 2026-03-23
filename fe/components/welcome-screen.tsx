"use client"

import { useState } from "react"
import { Send, Plus, Heart, Gem, Store, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { DroppedVendor } from "@/components/chat-input"

interface WelcomeScreenProps {
  onStartChat: (message: string) => void
  groomName: string
  brideName: string
  dDay: number
}

const suggestionChips = [
  "강남역 근처 웨딩홀 추천해줘",
  "자연스러운 느낌의 스튜디오 찾아줘",
  "예산 3000만원대 웨딩홀 있어?",
  "내 취향에 맞는 드레스샵 추천해줘",
]

export function WelcomeScreen({ onStartChat, groomName, brideName, dDay }: WelcomeScreenProps) {
  const [value, setValue] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [vendors, setVendors] = useState<DroppedVendor[]>([])

  const hasVendors = vendors.length > 0

  const buildMessage = (text?: string) => {
    const vendorNames = vendors.map((v) => `"${v.name}"`).join(", ")
    const prefix = vendorNames ? `[${vendorNames}] ` : ""
    if (text) return `${prefix}${text}`
    if (vendorNames) return `${prefix}이 업체${vendors.length > 1 ? "들" : ""}에 대해 알려줘`
    return ""
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const msg = buildMessage(value.trim() || undefined)
    if (msg) {
      onStartChat(msg)
      setValue("")
      setVendors([])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onStartChat(buildMessage(suggestion) || suggestion)
    setVendors([])
  }

  const handleVendorDrop = (vendor: DroppedVendor) => {
    setVendors((prev) => prev.some((v) => v.id === vendor.id) ? prev : [...prev, vendor])
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col items-center justify-center bg-background px-4 transition-colors",
        dragOver && "bg-primary/5"
      )}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/vendor-card")) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
          setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const data = e.dataTransfer.getData("application/vendor-card")
        if (!data) return
        handleVendorDrop(JSON.parse(data) as DroppedVendor)
      }}
    >
      {/* 드래그 오버 인디케이터 */}
      {dragOver && (
        <div className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-primary">
          <Store className="size-4" />
          업체를 놓아서 질문에 추가하기
        </div>
      )}

      <div className="w-full max-w-2xl">
        {/* Couple Display */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="text-2xl font-medium text-foreground">{groomName}</span>
            <Heart className="size-6 fill-primary text-primary" />
            <span className="text-2xl font-medium text-foreground">{brideName}</span>
          </div>

          {/* D-Day Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2">
            <Gem className="size-4 text-primary" />
            <span className="text-sm font-medium text-primary">D-{dDay}</span>
          </div>
        </div>

        {/* Main Question */}
        <h1 className="mb-12 text-center text-3xl font-semibold text-foreground sm:text-4xl">
          무엇을 도와드릴까요?
        </h1>

        {/* Suggestion Chips */}
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {suggestionChips.map((chip) => (
            <button
              key={chip}
              onClick={() => handleSuggestionClick(chip)}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* 첨부된 업체 칩 */}
        {hasVendors && (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
            {vendors.map((v) => (
              <span
                key={v.id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                <Store className="size-3" />
                {v.name}
                <button
                  type="button"
                  onClick={() => setVendors((prev) => prev.filter((x) => x.id !== v.id))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Plus className="size-5" />
              <span className="sr-only">Add attachment</span>
            </Button>

            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={hasVendors ? "질문을 입력하거나 바로 전송하세요..." : "무엇이든 물어보세요"}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />

            <Button
              type="submit"
              size="icon"
              disabled={!value.trim() && !hasVendors}
              className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="size-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          SDME Guard는 웨딩 플래닝에 대한 조언을 제공합니다
        </p>
      </div>
    </div>
  )
}
