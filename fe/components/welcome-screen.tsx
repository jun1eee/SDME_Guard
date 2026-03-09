"use client"

import { useState } from "react"
import { Send, Plus, Mic, Heart, Gem } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WelcomeScreenProps {
  onStartChat: (message: string) => void
  groomName: string
  brideName: string
  dDay: number
}

const suggestionChips = [
  "웨딩홀 추천해줘",
  "스드메 패키지 비교",
  "하객 예상 비용 계산",
  "허니문 추천",
]

export function WelcomeScreen({ onStartChat, groomName, brideName, dDay }: WelcomeScreenProps) {
  const [value, setValue] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onStartChat(value.trim())
      setValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    onStartChat(suggestion)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
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
              placeholder="무엇이든 물어보세요"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Mic className="size-5" />
              <span className="sr-only">Voice input</span>
            </Button>
            
            <Button
              type="submit"
              size="icon"
              disabled={!value.trim()}
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
