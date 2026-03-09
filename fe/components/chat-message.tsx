"use client"

import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"

interface ChatMessageProps {
  role: "assistant" | "user"
  content: string
  isTyping?: boolean
}

export function ChatMessage({ role, content, isTyping }: ChatMessageProps) {
  const isUser = role === "user"

  return (
    <div
      className={cn(
        "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}>
        {/* Avatar */}
        {!isUser && (
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-4 text-primary" />
          </div>
        )}

        {/* Message */}
        <div className={cn(isUser ? "max-w-[75%]" : "max-w-[65ch]")}>
          {isTyping ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-2 animate-bounce rounded-full bg-current" />
            </div>
          ) : (
            <div
              className={cn(
                "whitespace-pre-wrap text-sm leading-relaxed text-foreground",
                isUser
                  ? "rounded-2xl border border-primary/20 bg-primary/15 px-4 py-3 text-foreground"
                  : "px-1"
              )}
            >
              {content}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
