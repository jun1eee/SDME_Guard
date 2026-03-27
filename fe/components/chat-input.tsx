"use client"

import { useState } from "react"
import { Send, Store, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface DroppedVendor {
  id: string
  name: string
  category: string
  categoryLabel: string
  price: string
  rating: number
  coverUrl?: string
}

interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
  /** 외부에서 주입된 업체 목록 (드롭 시) */
  attachedVendors?: DroppedVendor[]
  onRemoveVendor?: (id: string) => void
  onVendorDrop?: (vendor: DroppedVendor) => void
  /** 전송 버튼 왼쪽에 추가 버튼 (AI 토글 등) */
  extraButton?: React.ReactNode
}

export function ChatInput({
  onSend,
  disabled,
  placeholder = "메시지를 입력하세요...",
  attachedVendors = [],
  onRemoveVendor,
  onVendorDrop,
  extraButton,
}: ChatInputProps) {
  const [value, setValue] = useState("")
  const [dragOver, setDragOver] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const hasText = value.trim().length > 0
    const hasVendorsAttached = attachedVendors.length > 0

    if (!hasText && !hasVendorsAttached) return
    if (disabled) return

    onSend(value.trim())
    setValue("")
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
    onVendorDrop?.(vendor)
  }

  const hasVendors = attachedVendors.length > 0

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
          여기에 놓아서 업체 추가하기
        </div>
      )}

      {/* 첨부된 업체 칩 */}
      {hasVendors && (
        <div className="mx-auto flex max-w-3xl flex-wrap gap-1.5 px-4 pt-3">
          {attachedVendors.map((v) => (
            <span
              key={v.id}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
            >
              <Store className="size-3" />
              {v.name}
              {onRemoveVendor && (
                <button
                  type="button"
                  onClick={() => onRemoveVendor(v.id)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mx-auto max-w-3xl p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="flex shrink-0 items-center gap-1.5">
            {extraButton}

            <Button
              type="submit"
              size="icon"
              disabled={(!value.trim() && !hasVendors) || disabled}
              className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="size-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          SDM Guard는 웨딩 플래닝에 대한 조언을 제공합니다
        </p>
      </form>
    </div>
  )
}
