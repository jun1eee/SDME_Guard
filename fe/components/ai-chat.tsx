"use client"

import { useState, useRef, useEffect } from "react"
import { useWedding } from "@/lib/wedding-store"
import { Send, Bot, User, Sparkles, Calendar, Store, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

const quickActions = [
  { label: "예산 분석", icon: Wallet, prompt: "현재 예산 상태를 분석해주세요. 절약할 수 있는 부분이 있을까요?" },
  { label: "업체 추천", icon: Store, prompt: "우리 취향에 맞는 웨딩 업체를 추천해주세요." },
  { label: "일정 제안", icon: Calendar, prompt: "남은 준비 기간을 고려해서 최적의 준비 일정을 짜주세요." },
  { label: "자유 질문", icon: Sparkles, prompt: "" },
]

export function AiChat() {
  const { messages, addMessage } = useWedding()
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (text?: string) => {
    const content = text || input.trim()
    if (!content) return
    addMessage({ role: "user", content })
    setInput("")
    setIsTyping(true)
    setTimeout(() => setIsTyping(false), 1400)
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-8rem)]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
        {messages.length === 1 && (
          <div className="flex flex-col items-center gap-4 py-6 mb-4">
            <div className="size-16 rounded-full bg-foreground text-background flex items-center justify-center">
              <Sparkles className="size-7" />
            </div>
            <div className="text-center">
              <h2 className="font-serif text-xl">AI 웨딩 플래너</h2>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-[260px] leading-relaxed">
                예산 관리부터 업체 추천, 일정 조율까지 모든 웨딩 준비를 AI가 도와드립니다
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs mt-2">
              {quickActions.slice(0, 3).map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={action.label}
                    onClick={() => handleSend(action.prompt)}
                    className="flex items-center gap-2 bg-card border border-border/50 rounded-2xl px-4 py-3 text-xs font-medium hover:bg-secondary transition-colors text-left"
                  >
                    <Icon className="size-4 text-muted-foreground shrink-0" />
                    {action.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
              msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div
              className={cn(
                "size-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === "assistant"
                  ? "bg-foreground text-background"
                  : "bg-[var(--brand-pink)] text-white"
              )}
            >
              {msg.role === "assistant" ? (
                <Bot className="size-4" />
              ) : (
                <User className="size-4" />
              )}
            </div>
            <div
              className={cn(
                "rounded-3xl px-5 py-3.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "bg-[var(--brand-pink)] text-white rounded-br-lg shadow-sm"
                  : "bg-card border border-border/50 text-foreground rounded-bl-lg shadow-sm"
              )}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 mr-auto animate-in fade-in duration-300">
            <div className="size-8 rounded-full bg-foreground text-background flex items-center justify-center shrink-0">
              <Bot className="size-4" />
            </div>
            <div className="bg-card border border-border/50 rounded-3xl rounded-bl-lg px-5 py-3.5 shadow-sm">
              <div className="flex gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:0ms]" />
                <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:150ms]" />
                <span className="size-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 bg-card border border-border/50 rounded-full px-4 py-2 shadow-sm">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="AI 플래너에게 질문하세요..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            aria-label="채팅 메시지 입력"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className={cn(
              "size-9 rounded-full flex items-center justify-center transition-all duration-200",
              input.trim()
                ? "bg-[var(--brand-pink)] text-white"
                : "bg-secondary text-muted-foreground"
            )}
            aria-label="메시지 보내기"
          >
            <Send className="size-4" />
          </button>
        </div>
        <p className="text-center text-[10px] text-muted-foreground/50 mt-2">
          AI가 업체와 직접 소통하고, 최적의 웨딩을 플래닝합니다
        </p>
      </div>
    </div>
  )
}
