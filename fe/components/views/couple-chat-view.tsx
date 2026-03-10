"use client"

import { useState, useRef, useEffect } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { Users, Bot, BotOff, Star, MapPin, Lock } from "lucide-react"

export interface VendorShare {
  id: string
  vendorId: string
  name: string
  category: "studio" | "dress" | "makeup" | "venue"
  categoryLabel: string
  price: string
  rating: number
  address: string
  tags: string[]
  description: string
  coverUrl?: string
  sharedBy: "groom" | "bride"
}

interface Message {
  id: string
  role: "assistant" | "user" | "groom" | "bride"
  content: string
  sender?: string
  vendorShare?: VendorShare
}

interface CoupleChatViewProps {
  groomName: string
  brideName: string
  currentUser: "groom" | "bride"
  sharedVendors?: VendorShare[]
  onAddToVote?: (vendor: VendorShare) => void
}

export function CoupleChatView({ groomName, brideName, currentUser, sharedVendors = [], onAddToVote }: CoupleChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `안녕하세요! ${groomName}님과 ${brideName}님의 커플 채팅방입니다.\n\n기본은 두 분만의 대화 공간이에요. AI 플래너의 도움이 필요할 땐 두 가지 방법을 사용해보세요:\n\n• **@AI** 를 메시지 앞에 붙이면 언제든 AI에게 물어볼 수 있어요\n• 우측 상단 AI 버튼을 켜면 모든 대화에 AI가 함께해요`,
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevSharedLengthRef = useRef(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // 새 업체 공유가 들어오면 메시지로 추가
  useEffect(() => {
    if (sharedVendors.length > prevSharedLengthRef.current) {
      const newShares = sharedVendors.slice(prevSharedLengthRef.current)
      setMessages((prev) => [
        ...prev,
        ...newShares.map((vs) => ({
          id: vs.id,
          role: vs.sharedBy as "groom" | "bride",
          content: "",
          sender: vs.sharedBy === "groom" ? groomName : brideName,
          vendorShare: vs,
        })),
      ])
      prevSharedLengthRef.current = sharedVendors.length
    }
  }, [sharedVendors, groomName, brideName])

  const triggerAiResponse = (content: string) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getCoupleChatResponse(content, currentUser, groomName, brideName),
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 1500)
  }

  const handleSend = (content: string) => {
    const isAiMention = content.trimStart().toLowerCase().startsWith("@ai")
    const cleanContent = isAiMention ? content.trimStart().slice(3).trim() : content

    const userMessage: Message = {
      id: Date.now().toString(),
      role: currentUser,
      content,
      sender: currentUser === "groom" ? groomName : brideName,
    }
    setMessages((prev) => [...prev, userMessage])

    if (aiMode || isAiMention) {
      triggerAiResponse(cleanContent || content)
    }
  }

  const inputPlaceholder = aiMode
    ? `${currentUser === "groom" ? groomName : brideName}(으)로 메시지 보내기... (AI 동행 중)`
    : `${currentUser === "groom" ? groomName : brideName}(으)로 메시지 보내기... (@AI 로 AI 호출)`

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Couple Chat</h1>
            <p className="text-sm text-muted-foreground">함께 웨딩을 준비하세요</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* AI 토글 */}
          <button
            onClick={() => setAiMode((prev) => !prev)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              aiMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {aiMode ? <Bot className="size-4" /> : <BotOff className="size-4" />}
            AI {aiMode ? "ON" : "OFF"}
          </button>

          {/* Current user indicator */}
          <div className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
            currentUser === "groom"
              ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
              : "bg-primary/10 text-primary"
          }`}>
            <div className={`size-2 rounded-full ${currentUser === "groom" ? "bg-blue-400" : "bg-primary"}`} />
            {currentUser === "groom" ? groomName : brideName}
          </div>
        </div>
      </div>

      {/* AI 모드 배너 */}
      {aiMode && (
        <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-6 py-2 text-xs text-primary">
          <Bot className="size-3.5" />
          AI 동행 모드 — 모든 메시지에 AI 플래너가 함께 응답합니다
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          {messages.map((message) => (
            <CoupleChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              sender={message.sender}
              vendorShare={message.vendorShare}
              onAddToVote={onAddToVote}
            />
          ))}
          {isTyping && (
            <ChatMessage role="assistant" content="" isTyping />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={isTyping}
        placeholder={inputPlaceholder}
      />
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  studio: "bg-violet-100 text-violet-700",
  dress: "bg-pink-100 text-pink-700",
  makeup: "bg-orange-100 text-orange-700",
  venue: "bg-blue-100 text-blue-700",
}

function VendorShareCard({ vendor, onAddToVote }: { vendor: VendorShare; onAddToVote?: (v: VendorShare) => void }) {
  const [voteAdded, setVoteAdded] = useState(false)

  return (
    <div className="w-64 overflow-hidden rounded-2xl border border-border bg-background shadow-sm">
      {vendor.coverUrl && (
        <img src={vendor.coverUrl} alt={vendor.name} className="h-32 w-full object-cover" />
      )}
      {!vendor.coverUrl && (
        <div className="flex h-24 items-center justify-center bg-muted">
          <span className="text-3xl">{
            vendor.category === "studio" ? "📷" :
            vendor.category === "dress" ? "👗" :
            vendor.category === "makeup" ? "💄" : "🏛️"
          }</span>
        </div>
      )}
      <div className="p-3">
        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[vendor.category] ?? "bg-muted text-muted-foreground"}`}>
          {vendor.categoryLabel}
        </span>
        <h3 className="mt-1.5 font-semibold text-sm text-foreground">{vendor.name}</h3>
        <div className="mt-0.5 flex items-center gap-1">
          <Star className="size-3 fill-yellow-400 text-yellow-400" />
          <span className="text-xs text-muted-foreground">{vendor.rating}</span>
        </div>
        <p className="mt-1.5 text-xs font-bold text-primary">{vendor.price}</p>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{vendor.description}</p>
        <div className="mt-1.5 flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-1">{vendor.address}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {vendor.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs text-muted-foreground">#{tag}</span>
          ))}
        </div>
        {onAddToVote && (
          <button
            onClick={() => {
              if (!voteAdded) {
                onAddToVote(vendor)
                setVoteAdded(true)
              }
            }}
            className={`mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors ${
              voteAdded
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
            }`}
          >
            <Lock className="size-3" />
            {voteAdded ? "비밀 투표에 추가됨" : "비밀 투표 제안"}
          </button>
        )}
      </div>
    </div>
  )
}

function CoupleChatMessage({
  role,
  content,
  sender,
  vendorShare,
  onAddToVote,
}: {
  role: "assistant" | "user" | "groom" | "bride"
  content: string
  sender?: string
  vendorShare?: VendorShare
  onAddToVote?: (vendor: VendorShare) => void
}) {
  const isAssistant = role === "assistant"
  const isGroom = role === "groom"

  return (
    <div className={`flex gap-3 ${isAssistant ? "" : "flex-row-reverse"}`}>
      {isAssistant ? (
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <span className="text-sm">AI</span>
        </div>
      ) : (
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
          isGroom ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
        }`}>
          <span className="text-sm font-medium">{sender?.[0]}</span>
        </div>
      )}
      <div className={`max-w-[80%] ${isAssistant ? "" : "text-right"}`}>
        {!isAssistant && (
          <span className={`mb-1 block text-xs font-medium ${
            isGroom ? "text-blue-600" : "text-pink-600"
          }`}>
            {sender}
          </span>
        )}
        {vendorShare ? (
          <VendorShareCard vendor={vendorShare} onAddToVote={onAddToVote} />
        ) : (
          <div
            className={
              isAssistant
                ? "px-1 text-foreground"
                : isGroom
                  ? "rounded-2xl bg-blue-500 px-4 py-3 text-white"
                  : "rounded-2xl bg-primary px-4 py-3 text-white"
            }
          >
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function getCoupleChatResponse(content: string, sender: "groom" | "bride", groomName: string, brideName: string): string {
  const otherPerson = sender === "groom" ? brideName : groomName

  if (content.includes("예산") || content.includes("돈") || content.includes("비용")) {
    return `${sender === "groom" ? groomName : brideName}님이 예산에 대해 이야기하셨네요!\n\n예산 논의는 커플이 함께 하는 것이 가장 좋아요. ${otherPerson}님의 의견도 들어보시는 건 어떨까요?\n\n**예산 논의 팁:**\n- 총 예산 한도 설정하기\n- 우선순위 항목 정하기\n- 각자 양가 분담 비율 논의하기`
  }

  if (content.includes("웨딩홀") || content.includes("예식장")) {
    return `웨딩홀 선택은 두 분의 취향이 모두 반영되어야 해요!\n\n${otherPerson}님은 어떤 스타일을 선호하시나요?\n\n**함께 고려할 점:**\n- 위치 (양가 접근성)\n- 분위기 (모던 vs 클래식)\n- 수용 인원\n- 예산`
  }

  return `두 분의 의견을 함께 들으니 좋네요!\n\n${sender === "groom" ? groomName : brideName}님의 생각을 ${otherPerson}님과 나눠보시면 더 좋은 결정을 하실 수 있을 거예요.\n\n무엇이든 도움이 필요하시면 말씀해주세요!`
}
