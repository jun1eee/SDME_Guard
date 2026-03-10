"use client"

import { cn } from "@/lib/utils"
import { Sparkles } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

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
          ) : isUser ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/15 px-4 py-3 text-sm leading-relaxed text-foreground">
              {content}
            </div>
          ) : (
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
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
