"use client"

import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { RecommendationCarousel } from "./recommendation-carousel"
import type { AiRecommendation } from "@/lib/api"

interface ChatMessageProps {
  role: "assistant" | "user"
  content: string
  isTyping?: boolean
  recommendations?: AiRecommendation[]
  suggestions?: string[]
  onCardClick?: (rec: AiRecommendation) => void
  onSuggestionClick?: (text: string) => void
}

export function ChatMessage({ role, content, isTyping, recommendations, suggestions, onCardClick, onSuggestionClick }: ChatMessageProps) {
  const isUser = role === "user"
  const hasRecs = recommendations && recommendations.length > 0

  // 추천 카드가 있고, 코드 포맷(**N. 이름**)이 아닌 경우만 번호 리스트 제거
  const isCodeFormatted = content.includes("**1.")
  const displayContent = hasRecs && !isCodeFormatted
    ? content.replace(/\n*(\d+\.\s*.+\n?){2,}/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : content
  const hasSuggestions = suggestions && suggestions.length > 0 && !isUser

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
        <div className={cn(isUser ? "max-w-[75%]" : "max-w-[85%] w-full")}>
          {isTyping ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
              <span className="size-2 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
              <span className="size-2 animate-bounce rounded-full bg-current" />
            </div>
          ) : isUser ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/15 px-4 py-3 text-sm leading-relaxed text-foreground">
              {content}
            </div>
          ) : (
            <>
              {/* 추천 카드 캐러셀 (텍스트보다 먼저 표시) */}
              {hasRecs && (
                <RecommendationCarousel
                  recommendations={recommendations}
                  onCardClick={onCardClick}
                />
              )}

              {/* 텍스트 답변 */}
              <div className="px-1 text-sm leading-relaxed text-foreground prose-chat">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
                    h2: ({ children }) => <h2 className="mb-1.5 text-sm font-bold">{children}</h2>,
                    h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                    table: ({ children }) => (
                      <div className="mb-2 overflow-x-auto">
                        <table className="w-full border-collapse text-sm">{children}</table>
                      </div>
                    ),
                    thead: ({ children }) => <thead className="bg-muted/50">{children}</thead>,
                    th: ({ children }) => (
                      <th className="border border-border px-3 py-1.5 text-left text-xs font-semibold">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-3 py-1.5 text-xs">{children}</td>
                    ),
                    code: ({ children }) => (
                      <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">{children}</code>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">{children}</blockquote>
                    ),
                    hr: () => <hr className="my-2 border-border" />,
                    a: ({ href, children }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/70">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {displayContent}
                </ReactMarkdown>
              </div>

              {/* 후속 질문 버튼 */}
              {hasSuggestions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((text, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSuggestionClick?.(text)}
                      className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 hover:border-primary/50 active:scale-95"
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
