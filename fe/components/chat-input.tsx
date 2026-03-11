"use client"

import { useState } from "react"
import { Send, Plus, Mic, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DroppedVendor {
  id: string
  name: string
  category: string
  categoryLabel: string
  price: string
  rating: number
}

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  onVendorDrop?: (vendor: DroppedVendor) => void
}

export function ChatInput({ onSend, disabled, placeholder = "메시지를 입력하세요...", onVendorDrop }: ChatInputProps) {
  const [value, setValue] = useState("")
  const [dragOver, setDragOver] = useState(false)

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

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("application/vendor-card")) {
      e.preventDefault()
      e.dataTransfer.dropEffect = "copy"
      setDragOver(true)
    }
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const data = e.dataTransfer.getData("application/vendor-card")
    if (!data) return
    const vendor = JSON.parse(data) as DroppedVendor
    if (onVendorDrop) {
      onVendorDrop(vendor)
    } else {
      // 기본 동작: 업체 이름으로 질문 텍스트 생성
      setValue(`"${vendor.name}" 업체에 대해 알려줘`)
    }
  }

  return (
    <div
      className={cn(
        "border-t border-border bg-background/80 backdrop-blur-sm transition-colors",
        dragOver && "border-t-2 border-t-primary bg-primary/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 드래그 오버 인디케이터 */}
      {dragOver && (
        <div className="flex items-center justify-center gap-2 py-2 text-sm font-medium text-primary">
          <Store className="size-4" />
          여기에 놓아서 업체 질문하기
        </div>
      )}
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
