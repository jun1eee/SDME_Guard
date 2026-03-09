"use client"

import { useState, useRef, useEffect } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { Heart, Users } from "lucide-react"

interface Message {
  id: string
  role: "assistant" | "user" | "groom" | "bride"
  content: string
  sender?: string
}

interface CoupleChatViewProps {
  groomName: string
  brideName: string
}

export function CoupleChatView({ groomName, brideName }: CoupleChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: `안녕하세요! ${groomName}님과 ${brideName}님의 커플 채팅방입니다.\n\n여기서 두 분이 함께 웨딩 준비에 대해 논의하고, AI 플래너에게 조언을 구할 수 있어요.\n\n무엇이든 물어보세요!`,
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [currentSender, setCurrentSender] = useState<"groom" | "bride">("groom")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const handleSend = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: currentSender,
      content,
      sender: currentSender === "groom" ? groomName : brideName,
    }
    setMessages((prev) => [...prev, userMessage])

    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getCoupleChatResponse(content, currentSender, groomName, brideName),
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 1500)
  }

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
        
        {/* Sender Toggle */}
        <div className="flex items-center gap-2 rounded-full bg-muted p-1">
          <button
            onClick={() => setCurrentSender("groom")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              currentSender === "groom"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {groomName}
          </button>
          <Heart className="size-4 text-primary" />
          <button
            onClick={() => setCurrentSender("bride")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              currentSender === "bride"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {brideName}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
          {messages.map((message) => (
            <CoupleChatMessage
              key={message.id}
              role={message.role}
              content={message.content}
              sender={message.sender}
              groomName={groomName}
              brideName={brideName}
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
        placeholder={`${currentSender === "groom" ? groomName : brideName}(으)로 메시지 보내기...`}
      />
    </div>
  )
}

function CoupleChatMessage({
  role,
  content,
  sender,
  groomName,
  brideName,
}: {
  role: "assistant" | "user" | "groom" | "bride"
  content: string
  sender?: string
  groomName: string
  brideName: string
}) {
  const isAssistant = role === "assistant"
  const isGroom = role === "groom"
  const isBride = role === "bride"

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
