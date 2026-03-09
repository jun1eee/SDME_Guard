"use client"

import { useState } from "react"
import { Send, Plus, Mic } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

export function ChatInput({ onSend, disabled, placeholder = "메시지를 입력하세요..." }: ChatInputProps) {
  const [value, setValue] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim() && !disabled) {
      onSend(value.trim())
      setValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl p-4">
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
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
            disabled={!value.trim() || disabled}
            className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            <Send className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          SDME Guard는 웨딩 플래닝에 대한 조언을 제공합니다
        </p>
      </form>
    </div>
  )
}
