"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { Users, Bot, BotOff, Star, MapPin, Lock, Store, DollarSign, Calendar, Heart, Send, X } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"
import { Client } from "@stomp/stompjs"
import SockJS from "sockjs-client"
import { getChatMessages, getAiChatSessions, getCoupleAiSessions, selectCoupleAiSession, clearCoupleAiSession, sendCoupleAiChat, saveCoupleChatMessage, uploadChatImage } from "@/lib/api"
import { RecommendationCarousel } from "@/components/recommendation-carousel"

export interface VendorShare {
  id: string
  vendorId: string
  sourceId?: string
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
  comment?: string
}

interface Message {
  id: string
  role: "assistant" | "user" | "groom" | "bride" | "system"
  content: string
  sender?: string
  vendorShare?: VendorShare
  vendorShares?: VendorShare[]
  recommendations?: import("@/lib/api").AiRecommendation[]
  suggestions?: string[]
  comment?: string
  createdAt?: string
  imageUrl?: string
}

interface CoupleChatViewProps {
  groomName: string
  brideName: string
  currentUser: "groom" | "bride"
  coupleId?: number | null
  userId?: number | null
  sharedVendors?: VendorShare[]
  onAddToVote?: (vendor: VendorShare) => void
  onOpenTab?: (type: string) => void
  onVendorShared?: (vendor: VendorShare) => void
  onFavoriteVendor?: (vendor: VendorShare) => void
  onUnfavoriteVendor?: (vendorId: string) => void
  favoriteVendorIds?: string[]
  onShareVendorFromDrop?: (vendor: { id: string; name: string; category: string; price: string; rating: number; address: string; tags: string[]; description: string }) => void
  voteBadge?: number
  onUnshareVendor?: (vendorId: string) => void
}

interface PendingVendor {
  id: string
  name: string
  category: string
  categoryLabel: string
  price: string
  rating: number
  address: string
  tags: string[]
  description: string
}

export function CoupleChatView({ groomName, brideName, currentUser, coupleId, userId, sharedVendors = [], onAddToVote, onOpenTab, onVendorShared, onFavoriteVendor, onUnfavoriteVendor, favoriteVendorIds = [], onShareVendorFromDrop, voteBadge = 0, onUnshareVendor }: CoupleChatViewProps) {
  const [vendorDragOver, setVendorDragOver] = useState(false)
  const [unshareTarget, setUnshareTarget] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `안녕하세요! ${groomName}님과 ${brideName}님의 커플 채팅방입니다.\n\n기본은 두 분만의 대화 공간이에요. AI 플래너의 도움이 필요할 땐 두 가지 방법을 사용해보세요:\n\n• **@AI** 를 메시지 앞에 붙이면 언제든 AI에게 물어볼 수 있어요\n• 우측 상단 AI 버튼을 켜면 모든 대화에 AI가 함께해요`,
    },
  ])
  const [isTyping, setIsTyping] = useState(false)
  const [aiMode, setAiMode] = useState(false)
  const [aiSessions, setAiSessions] = useState<{ groomAiSessionId: string | null; brideAiSessionId: string | null }>({ groomAiSessionId: null, brideAiSessionId: null })
  const [myAiSessions, setMyAiSessions] = useState<Array<{ sessionId: string; firstMessage: string; messageCount: number; lastDate: string }>>([])
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [attachedVendors, setAttachedVendors] = useState<import("@/components/chat-input").DroppedVendor[]>([])
  const [coupleAiSessionId, setCoupleAiSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const stompClientRef = useRef<Client | null>(null)

  // 채팅 히스토리 로드
  useEffect(() => {
    if (!coupleId) return
    getChatMessages()
      .then((res) => {
        const CATEGORY_MAP: Record<string, "studio" | "dress" | "makeup" | "venue"> = {
          STUDIO: "studio", DRESS: "dress", MAKEUP: "makeup", HALL: "venue",
          studio: "studio", dress: "dress", makeup: "makeup", venue: "venue",
        }
        const CAT_LABEL: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀" }

        const loaded = res.data.reduce<Message[]>((acc, m) => {
          if (m.messageType === "ai_response") {
            try {
              const data = JSON.parse(m.content)
              if ((data.vendors?.length > 0) || data.question) {
                acc.push({
                  id: `${m.id}-req`,
                  role: m.senderRole as "groom" | "bride",
                  content: data.question || "",
                  sender: m.senderName,
                  vendorShares: data.vendors?.length > 0 ? data.vendors : undefined,
                  createdAt: m.createdAt,
                })
              }
              acc.push({
                id: `${m.id}-res`,
                role: "assistant" as const,
                content: data.answer || "",
                recommendations: data.recommendations || [],
                createdAt: m.createdAt,
              })
              return acc
            } catch { /* fall through */ }
          }
          if (m.messageType === "vendor_share") {
            try {
              const vendorInfo = JSON.parse(m.content)
              const cat = CATEGORY_MAP[vendorInfo.category] ?? "studio"
              const vs: VendorShare = {
                id: `vs-${m.id}`,
                vendorId: vendorInfo.vendorId?.toString() || "",
                name: vendorInfo.name || "",
                category: cat,
                categoryLabel: CAT_LABEL[cat] || "",
                price: vendorInfo.price || "",
                rating: vendorInfo.rating || 0,
                address: "",
                tags: [],
                description: "",
                coverUrl: vendorInfo.coverUrl || undefined,
                sharedBy: m.senderRole as "groom" | "bride",
                comment: vendorInfo.comment || undefined,
              }
              acc.push({
                id: m.id.toString(),
                role: m.senderRole as "groom" | "bride",
                content: "",
                sender: m.senderName,
                vendorShare: vs,
                comment: vendorInfo.comment || undefined,
                createdAt: m.createdAt,
              })
              return acc
            } catch { /* fall through */ }
          }
          if (m.messageType === "image") {
            acc.push({
              id: m.id.toString(),
              role: m.senderRole as "groom" | "bride",
              content: "",
              sender: m.senderName,
              imageUrl: m.content,
              createdAt: m.createdAt,
            })
            return acc
          }
          if (m.messageType === "system") {
            acc.push({
              id: m.id.toString(),
              role: "system" as const,
              content: m.content,
              sender: "시스템",
              createdAt: m.createdAt,
            })
            return acc
          }
          acc.push({
            id: m.id.toString(),
            role: m.senderRole as "groom" | "bride",
            content: m.content,
            sender: m.senderName,
            createdAt: m.createdAt,
          })
          return acc
        }, [])
        if (loaded.length > 0) {
          setMessages((prev) => [prev[0], ...loaded])
        }
      })
      .catch(() => {})
  }, [coupleId])

  // WebSocket 연결
  useEffect(() => {
    if (!coupleId) return

    const client = new Client({
      webSocketFactory: () => new SockJS(window.location.hostname !== "localhost" ? `${window.location.origin}/ws` : "http://localhost:8080/ws"),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/couple/${coupleId}`, (message) => {
          const data = JSON.parse(message.body)
          console.log("[WS 수신]", data.type || data.messageType, data)

          // 공유 취소 신호
          if (data.type === "vendor_unshare") {
            setMessages((prev) => prev.filter((m) => !(m.vendorShare?.vendorId === String(data.vendorId))))
            return
          }

          // 내가 보낸 메시지는 이미 로컬에 추가했으므로 무시 (일반 메시지만)
          if (data.senderId === userId && data.messageType !== "vendor_share" && data.messageType !== "image") return

          if (data.messageType === "image") {
            if (data.senderId === userId) {
              // 내가 보낸 이미지: optimistic 메시지를 서버 URL로 교체
              setMessages((prev) => prev.map((m) =>
                m.id.startsWith("img-temp-") && m.role === (data.senderRole as "groom" | "bride")
                  ? { ...m, id: data.id.toString(), imageUrl: data.content }
                  : m
              ))
            } else {
              setMessages((prev) => [...prev, {
                id: data.id.toString(),
                role: data.senderRole as "groom" | "bride",
                content: "",
                sender: data.senderName,
                imageUrl: data.content,
                createdAt: data.createdAt,
              }])
            }
            return
          }

          if (data.messageType === "ai_response") {
            try {
              const aiData = JSON.parse(data.content)
              const newMsgs: Message[] = []
              if ((aiData.vendors?.length > 0) || aiData.question) {
                newMsgs.push({
                  id: `ws-req-${data.id}`,
                  role: data.senderRole as "groom" | "bride",
                  content: aiData.question || "",
                  sender: data.senderName,
                  vendorShares: aiData.vendors?.length > 0 ? aiData.vendors : undefined,
                  createdAt: data.createdAt,
                })
              }
              newMsgs.push({
                id: `ws-res-${data.id}`,
                role: "assistant" as const,
                content: aiData.answer || "",
                recommendations: aiData.recommendations || [],
                createdAt: data.createdAt,
              })
              setMessages((prev) => [...prev, ...newMsgs])
            } catch { /* ignore */ }
            return
          }

          if (data.messageType === "vendor_share") {
            try {
              const vendorInfo = JSON.parse(data.content)
              // 업체 공유 메시지
              const CATEGORY_MAP: Record<string, "studio" | "dress" | "makeup" | "venue"> = {
                STUDIO: "studio", DRESS: "dress", MAKEUP: "makeup", HALL: "venue",
                studio: "studio", dress: "dress", makeup: "makeup", venue: "venue",
              }
              const cat = CATEGORY_MAP[vendorInfo.category] ?? "studio"
              const CAT_LABEL: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀" }
              const vs: VendorShare = {
                id: `vs-${data.id}`,
                vendorId: vendorInfo.vendorId?.toString() || "",
                name: vendorInfo.name || "",
                category: cat,
                categoryLabel: CAT_LABEL[cat] || "",
                price: vendorInfo.price || "",
                rating: vendorInfo.rating || 0,
                address: "",
                tags: [],
                description: "",
                coverUrl: vendorInfo.coverUrl || undefined,
                sharedBy: data.senderRole as "groom" | "bride",
                comment: vendorInfo.comment || undefined,
              }
              const newMsg: Message = {
                id: data.id.toString(),
                role: data.senderRole as "groom" | "bride",
                content: "",
                sender: data.senderName,
                vendorShare: vs,
                comment: vendorInfo.comment || undefined,
                createdAt: data.createdAt,
              }
              setMessages((prev) => [...prev, newMsg])
            } catch { /* ignore */ }
          } else {
            const newMsg: Message = {
              id: data.id.toString(),
              role: data.senderRole as "groom" | "bride",
              content: data.content,
              sender: data.senderName,
              createdAt: data.createdAt,
            }
            setMessages((prev) => [...prev, newMsg])
          }
        })
      },
    })
    client.activate()
    stompClientRef.current = client
    ;(window as any).__stompClient = client

    return () => {
      client.deactivate()
      ;(window as any).__stompClient = null
    }
  }, [coupleId, userId])

  // AI 모드 켜질 때 세션 정보 로드
  useEffect(() => {
    if (!aiMode) return
    getCoupleAiSessions()
      .then((res) => setAiSessions(res.data))
      .catch(() => {})
    getAiChatSessions()
      .then((res) => {
        const grouped = new Map<string, { firstMessage: string; count: number; lastDate: string }>()
        for (const item of res.data) {
          const existing = grouped.get(item.sessionId)
          if (!existing) {
            // 첫 user 메시지를 미리보기로 사용
            const preview = item.role === "user" ? item.content : ""
            grouped.set(item.sessionId, { firstMessage: preview, count: 1, lastDate: item.createdAt })
          } else {
            existing.count++
            if (!existing.firstMessage && item.role === "user") {
              existing.firstMessage = item.content
            }
            existing.lastDate = item.createdAt
          }
        }
        setMyAiSessions(
          Array.from(grouped.entries()).map(([sessionId, info]) => ({
            sessionId,
            firstMessage: info.firstMessage?.slice(0, 40) || "AI 상담",
            messageCount: info.count,
            lastDate: new Date(info.lastDate).toLocaleDateString("ko-KR", { month: "short", day: "numeric" }),
          }))
        )
      })
      .catch(() => {})
  }, [aiMode])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  const triggerAiResponse = async (content: string, vendors: typeof attachedVendors = [], vendorShares: VendorShare[] = []) => {
    setIsTyping(true)
    try {
      let messageToSend = content
      if (vendors.length > 0) {
        const catLabel: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀", STUDIO: "스튜디오", DRESS: "드레스", MAKEUP: "메이크업", HALL: "웨딩홀" }
        const vendorInfo = vendors.map(v =>
          `${v.name} (${catLabel[v.category] || v.category}${v.price ? `, ${v.price}` : ""}${v.rating ? `, ⭐${v.rating}` : ""})`
        ).join(", ")
        messageToSend = `${content || (vendors.length >= 2 ? "비교해줘" : "이 업체에 대해 알려줘")} [업체: ${vendorInfo}]`
      }
      const res = await sendCoupleAiChat({ message: messageToSend, sessionId: coupleAiSessionId })
      if (res.data.sessionId) {
        setCoupleAiSessionId(res.data.sessionId)
      }
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.data.answer,
        recommendations: res.data.recommendations || [],
        suggestions: res.data.suggestions || [],
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, aiResponse])

      // AI 응답을 REST API로 DB 저장 (ai_response 타입: 질문+업체+답변 포함)
      console.log("[AI save] coupleId:", coupleId, "userId:", userId)
      if (coupleId && userId) {
        const savePayload = {
          senderId: userId,
          coupleId: coupleId,
          content: JSON.stringify({
            question: content,
            vendors: vendorShares,
            answer: res.data.answer,
            recommendations: res.data.recommendations || [],
          }),
          messageType: "ai_response",
        }
        saveCoupleChatMessage(savePayload).catch((e) => {
          console.error("[AI save 실패] 재시도 중...", e)
          setTimeout(() => saveCoupleChatMessage(savePayload).catch(console.error), 2000)
        })
      }
    } catch {
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "AI 응답을 가져오는 데 실패했습니다. 잠시 후 다시 시도해주세요.",
        createdAt: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errorResponse])
    } finally {
      setIsTyping(false)
    }
  }

  const generateComparisonResponse = (vendors: typeof attachedVendors, userMsg: string) => {
    const header = `**${vendors.map(v => v.name).join(" vs ")}** 비교해드릴게요!\n\n`
    const catLabel: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀", STUDIO: "스튜디오", DRESS: "드레스", MAKEUP: "메이크업", HALL: "웨딩홀" }

    let table = "| 항목 |"
    vendors.forEach(v => { table += ` ${v.name} |` })
    table += "\n|---|"
    vendors.forEach(() => { table += "---|" })

    table += "\n| 카테고리 |"
    vendors.forEach(v => { table += ` ${catLabel[v.category] || v.category} |` })

    table += "\n| 가격 |"
    vendors.forEach(v => { table += ` ${v.price || "문의"} |` })

    table += "\n| 평점 |"
    vendors.forEach(v => { table += ` ⭐ ${v.rating || "-"} |` })

    const footer = "\n\n궁금한 점이 있으면 더 물어보세요! 상세 비교가 필요하면 업체명을 클릭해서 상세 정보를 확인해보세요."
    return header + table + footer
  }

  const handleVendorDrop = (vendor: PendingVendor | { id: string; name: string; category: string; categoryLabel: string; price: string; rating: number }) => {
    if (aiMode) {
      // AI 모드: 첨부 목록에 추가 (중복 방지)
      setAttachedVendors((prev) =>
        prev.some((v) => v.id === vendor.id) ? prev : [...prev, {
          id: vendor.id,
          name: vendor.name,
          category: vendor.category,
          categoryLabel: vendor.categoryLabel || "",
          price: vendor.price || "",
          rating: vendor.rating || 0,
          coverUrl: ("coverUrl" in vendor ? (vendor as any).coverUrl : undefined),
        }]
      )
    } else {
      const full = { address: "", tags: [] as string[], description: "", ...vendor }
      onShareVendorFromDrop?.(full)
    }
  }

  const handleImagePaste = async (file: File) => {
    const tempId = `img-temp-${Date.now()}`
    const blobUrl = URL.createObjectURL(file)

    // optimistic: 즉시 화면에 표시
    setMessages((prev) => [...prev, {
      id: tempId,
      role: currentUser,
      content: "",
      sender: currentUser === "groom" ? groomName : brideName,
      imageUrl: blobUrl,
      createdAt: new Date().toISOString(),
    }])

    try {
      await uploadChatImage(coupleId!, file)
      // WebSocket으로 서버 응답이 오면 optimistic 메시지를 교체함
    } catch (err) {
      console.error("[이미지 업로드 실패]", err)
      // 실패 시 optimistic 메시지 제거
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    } finally {
      URL.revokeObjectURL(blobUrl)
    }
  }

  const handleSend = (content: string) => {
    if (!content.trim() && attachedVendors.length === 0) return
    const isAiMention = content.trimStart().toLowerCase().startsWith("@ai")
    const cleanContent = isAiMention ? content.trimStart().slice(3).trim() : content
    const senderName = currentUser === "groom" ? groomName : brideName

    // AI 모드에서 업체가 첨부되어 있으면 카드 형태로 메시지에 포함
    const currentAttached = aiMode ? [...attachedVendors] : []
    const catLabelMap: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀", STUDIO: "스튜디오", DRESS: "드레스", MAKEUP: "메이크업", HALL: "웨딩홀" }
    const vendorSharesForMsg: VendorShare[] = currentAttached.map((v) => ({
      id: `attached-${v.id}`,
      vendorId: v.id,
      name: v.name,
      category: (v.category === "HALL" ? "venue" : v.category.toLowerCase()) as VendorShare["category"],
      categoryLabel: catLabelMap[v.category] || v.categoryLabel || v.category,
      price: v.price,
      rating: v.rating,
      address: "",
      tags: [],
      description: "",
      coverUrl: v.coverUrl,
      sharedBy: currentUser as "groom" | "bride",
    }))

    const displayContent = content.trim()

    const userMessage: Message = {
      id: Date.now().toString(),
      role: currentUser,
      content: displayContent,
      sender: senderName,
      vendorShares: vendorSharesForMsg.length > 0 ? vendorSharesForMsg : undefined,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])

    if (aiMode) {
      // AI 모드: AI 응답만, 상대방에게 안 보냄
      triggerAiResponse(cleanContent || content, currentAttached, vendorSharesForMsg)
      setAttachedVendors([])
    } else if (isAiMention) {
      // @AI 멘션: 상대방에게도 보내고 AI 응답도
      if (stompClientRef.current?.connected && coupleId && userId) {
        stompClientRef.current.publish({
          destination: "/app/chat.send",
          body: JSON.stringify({
            senderId: userId,
            coupleId: coupleId,
            content: content,
            messageType: "text",
          }),
        })
      }
      triggerAiResponse(cleanContent || content)
    } else {
      // 일반 메시지: 상대방에게만
      if (stompClientRef.current?.connected && coupleId && userId) {
        stompClientRef.current.publish({
          destination: "/app/chat.send",
          body: JSON.stringify({
            senderId: userId,
            coupleId: coupleId,
            content: content,
            messageType: "text",
          }),
        })
      }
    }
  }

  const inputPlaceholder = aiMode
    ? "AI에게 무엇이든 물어보세요..."
    : `${currentUser === "groom" ? groomName : brideName}(으)로 메시지 보내기... (@AI 로 AI 호출)`

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Users className="size-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">커플 채팅</h1>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 커플 찜목록 */}
          <button
            onClick={() => onOpenTab?.("couple-wishlist")}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="커플 찜목록"
          >
            <Heart className="size-4" />
          </button>
          {/* 비밀 투표 */}
          <button
            onClick={() => onOpenTab?.("vote")}
            className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="비밀 투표"
          >
            <Lock className="size-4" />
            {voteBadge > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                {voteBadge > 9 ? "9+" : voteBadge}
              </span>
            )}
          </button>

        </div>
      </div>

      {/* AI 모드 배너 */}
      {aiMode && (
        <div className="border-b border-primary/20 bg-primary/5 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-primary">
              <Bot className="size-3.5" />
              AI 동행 모드
            </div>
            <button
              onClick={() => setShowSessionModal(true)}
              className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
            >
              개인 상담 연동
            </button>
          </div>
          {/* 선택된 세션 요약 배너 */}
          {(aiSessions.groomAiSessionId || aiSessions.brideAiSessionId) && (
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-blue-400" />
                신랑: {aiSessions.groomAiSessionId
                  ? myAiSessions.find((s) => s.sessionId === aiSessions.groomAiSessionId)?.firstMessage || "연동됨"
                  : "미선택"}
              </span>
              <span className="text-border">|</span>
              <span className="inline-flex items-center gap-1">
                <span className="size-2 rounded-full bg-pink-400" />
                신부: {aiSessions.brideAiSessionId
                  ? myAiSessions.find((s) => s.sessionId === aiSessions.brideAiSessionId)?.firstMessage || "연동됨"
                  : "미선택"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* 세션 선택 모달 */}
      {showSessionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowSessionModal(false)}>
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">개인 AI 상담 연동</h3>
                <p className="mt-0.5 text-[11px] text-muted-foreground">내 개인 상담 내용을 커플 AI에 공유합니다</p>
              </div>
              <button onClick={() => setShowSessionModal(false)} className="flex size-7 items-center justify-center rounded-full hover:bg-muted transition-colors">
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {/* 세션 목록 */}
            <div className="max-h-64 overflow-y-auto px-5 py-3">
              {myAiSessions.length === 0 ? (
                <div className="py-8 text-center">
                  <Bot className="mx-auto size-8 text-muted-foreground/40" />
                  <p className="mt-2 text-xs text-muted-foreground">개인 AI 상담 내역이 없습니다</p>
                  <p className="mt-1 text-[10px] text-muted-foreground/60">먼저 개인 AI 채팅에서 상담을 진행해주세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {myAiSessions.map((session) => {
                    const isSelected =
                      (currentUser === "groom" && aiSessions.groomAiSessionId === session.sessionId) ||
                      (currentUser === "bride" && aiSessions.brideAiSessionId === session.sessionId)
                    return (
                      <button
                        key={session.sessionId}
                        onClick={async () => {
                          try {
                            if (isSelected) {
                              await clearCoupleAiSession()
                              setAiSessions((prev) =>
                                currentUser === "groom"
                                  ? { ...prev, groomAiSessionId: null }
                                  : { ...prev, brideAiSessionId: null }
                              )
                            } else {
                              await selectCoupleAiSession(session.sessionId)
                              setAiSessions((prev) =>
                                currentUser === "groom"
                                  ? { ...prev, groomAiSessionId: session.sessionId }
                                  : { ...prev, brideAiSessionId: session.sessionId }
                              )
                            }
                            // couple_context는 Java 백엔드가 매 요청마다 DB에서 조회하므로 세션 리셋 불필요
                            setShowSessionModal(false)
                          } catch (e) { console.error("세션 선택 실패:", e) }
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? "bg-primary/10 ring-1 ring-primary/30"
                            : "hover:bg-muted/60"
                        }`}
                      >
                        <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                          isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                        }`}>
                          <Bot className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate text-sm ${isSelected ? "font-semibold text-primary" : "font-medium text-foreground"}`}>
                            {session.firstMessage}
                          </p>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {session.lastDate} · 메시지 {session.messageCount}개
                          </p>
                        </div>
                        {isSelected && (
                          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-white">연동중</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 모달 하단 */}
            <div className="border-t border-border px-5 py-3">
              <button
                onClick={() => setShowSessionModal(false)}
                className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
          <div
            className={cn(
              "flex-1 overflow-y-auto transition-colors",
              vendorDragOver && "bg-primary/5"
            )}
            onDragOver={(e) => {
              if (e.dataTransfer.types.includes("application/vendor-card") || e.dataTransfer.types.includes("application/fitting-image")) {
                e.preventDefault()
                e.dataTransfer.dropEffect = "copy"
                setVendorDragOver(true)
              }
            }}
            onDragLeave={() => setVendorDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault()
              setVendorDragOver(false)
              const vendorData = e.dataTransfer.getData("application/vendor-card")
              if (vendorData) {
                handleVendorDrop(JSON.parse(vendorData) as PendingVendor)
                return
              }
              const imageUrl = e.dataTransfer.getData("application/fitting-image")
              if (imageUrl) {
                try {
                  const res = await fetch(imageUrl)
                  const blob = await res.blob()
                  const file = new File([blob], "fitting-result.png", { type: "image/png" })
                  handleImagePaste(file)
                } catch (err) {
                  console.error("[피팅 이미지 드롭 실패]", err)
                }
              }
            }}
          >
            {vendorDragOver && (
              <div className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary">
                <Store className="size-4" />
                여기에 놓아서 업체 공유하기
              </div>
            )}
            <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
              {messages.map((message, index) => {
                // 날짜 구분선
                let dateSeparator = null
                if (message.createdAt) {
                  const msgDateObj = new Date(message.createdAt)
                  const msgDateKey = `${msgDateObj.getFullYear()}-${msgDateObj.getMonth()}-${msgDateObj.getDate()}`
                  const msgDate = msgDateObj.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" })
                  const prevMsg = messages[index - 1]
                  let prevDateKey = ""
                  if (prevMsg?.createdAt) {
                    const prevDateObj = new Date(prevMsg.createdAt)
                    prevDateKey = `${prevDateObj.getFullYear()}-${prevDateObj.getMonth()}-${prevDateObj.getDate()}`
                  }
                  if (msgDateKey !== prevDateKey) {
                    dateSeparator = (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 border-t border-border" />
                        <span className="text-xs text-muted-foreground">{msgDate}</span>
                        <div className="flex-1 border-t border-border" />
                      </div>
                    )
                  }
                }

                return (
                  <div key={message.id}>
                    {dateSeparator}
                    <CoupleChatMessage
                      role={message.role}
                      content={message.content}
                      sender={message.sender}
                      currentUser={currentUser}
                      createdAt={message.createdAt}
                      vendorShare={message.vendorShare}
                      vendorShares={message.vendorShares}
                      recommendations={message.recommendations}
                      comment={message.comment}
                      imageUrl={message.imageUrl}
                      onAddToVote={onAddToVote}
                      onFavoriteVendor={onFavoriteVendor}
                      onUnfavoriteVendor={onUnfavoriteVendor}
                      favoriteVendorIds={favoriteVendorIds}
                      onOpenVendor={(vendorId) => onOpenTab?.(`vendor:${vendorId}`)}
                      onCardClick={(rec) => { if (rec.id) onOpenTab?.(`vendor:${rec.id}`) }}
                      isMine={!!message.vendorShare && message.role === currentUser}
                      onUnshare={(vendorId) => setUnshareTarget(vendorId)}
                    />
                  </div>
                )
              })}
              {isTyping && (
                <ChatMessage role="assistant" content="" isTyping />
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <ChatInput
        onSend={handleSend}
        onImagePaste={handleImagePaste}
        disabled={isTyping}
        placeholder={inputPlaceholder}
        attachedVendors={aiMode ? attachedVendors : []}
        onRemoveVendor={aiMode ? (id) => setAttachedVendors((prev) => prev.filter((v) => v.id !== id)) : undefined}
        onVendorDrop={(vendor) => handleVendorDrop(vendor)}
        extraButton={
          <button
            type="button"
            onClick={() => {
              const next = !aiMode
              setAiMode(next)
              if (next) setShowSessionModal(true)
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              aiMode
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {aiMode ? <Bot className="size-3.5" /> : <BotOff className="size-3.5" />}
            AI {aiMode ? "ON" : "OFF"}
          </button>
        }
      />

      {/* 공유 취소 확인 모달 */}
      {unshareTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setUnshareTarget(null)}>
          <div className="mx-4 w-full max-w-xs rounded-2xl bg-card p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-center text-sm font-semibold text-foreground">공유를 취소할까요?</p>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">채팅방에서 업체 카드가 사라져요</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setUnshareTarget(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                아니요
              </button>
              <button
                onClick={() => {
                  setMessages(prev => prev.filter(m => !(m.vendorShare?.vendorId === unshareTarget && m.role === currentUser)))
                  onUnshareVendor?.(unshareTarget)
                  setUnshareTarget(null)
                }}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
              >
                취소하기
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ── 연속 업체 메시지 그룹핑 ──────────────────────────────
interface MessageGroup {
  type: "single" | "vendor-group"
  messages: Message[]
}

function groupMessages(messages: Message[]): MessageGroup[] {
  const groups: MessageGroup[] = []
  let i = 0
  while (i < messages.length) {
    const msg = messages[i]
    if (msg.vendorShare) {
      // 같은 발신자의 연속 vendor 메시지 수집
      const vendorMsgs: Message[] = [msg]
      let j = i + 1
      while (j < messages.length && messages[j].vendorShare && messages[j].role === msg.role) {
        vendorMsgs.push(messages[j])
        j++
      }
      groups.push({
        type: vendorMsgs.length > 1 ? "vendor-group" : "single",
        messages: vendorMsgs,
      })
      i = j
    } else {
      groups.push({ type: "single", messages: [msg] })
      i++
    }
  }
  return groups
}

function VendorShareGroup({
  messages,
  onAddToVote,
  onFavoriteVendor,
  onUnfavoriteVendor,
  favoriteVendorIds = [],
  onOpenVendor,
}: {
  messages: Message[]
  onAddToVote?: (vendor: VendorShare) => void
  onFavoriteVendor?: (vendor: VendorShare) => void
  onUnfavoriteVendor?: (vendorId: string) => void
  favoriteVendorIds?: string[]
  onOpenVendor?: (vendorId: string) => void
}) {
  const first = messages[0]
  const isGroom = first.role === "groom"

  return (
    <div className={`flex gap-3 ${first.role === "assistant" ? "" : "flex-row-reverse"}`}>
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
        isGroom ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
      }`}>
        <span className="text-sm font-medium">{first.sender?.[0]}</span>
      </div>
      <div className={`max-w-[85%] ${first.role === "assistant" ? "" : "text-right"}`}>
        <span className={`mb-1 block text-xs font-medium ${
          isGroom ? "text-blue-600" : "text-pink-600"
        }`}>
          {first.sender}
        </span>
        {first.comment && (
          <div className={`mb-2 inline-block rounded-2xl px-4 py-2.5 text-sm ${isGroom ? "bg-blue-500 text-white" : "bg-primary text-white"}`}>
            <p className="whitespace-pre-wrap leading-relaxed">{first.comment}</p>
          </div>
        )}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {messages.map((msg) => msg.vendorShare && (
            <div key={msg.id} className="shrink-0">
              <VendorShareCard
                vendor={msg.vendorShare}
                onAddToVote={onAddToVote}
                onFavorite={onFavoriteVendor}
                onUnfavorite={onUnfavoriteVendor}
                initialLiked={favoriteVendorIds.includes(msg.vendorShare.vendorId)}
                onOpenVendor={() => onOpenVendor?.(msg.vendorShare!.vendorId)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  studio: "bg-violet-100 text-violet-700",
  dress: "bg-pink-100 text-pink-700",
  makeup: "bg-orange-100 text-orange-700",
  venue: "bg-blue-100 text-blue-700",
}

function VendorShareCard({ vendor, comment, onAddToVote, onFavorite, onUnfavorite, initialLiked = false, onOpenVendor, isMine = false, onUnshare }: {
  vendor: VendorShare
  comment?: string
  onAddToVote?: (v: VendorShare) => void
  onFavorite?: (v: VendorShare) => void
  onUnfavorite?: (vendorId: string) => void
  initialLiked?: boolean
  onOpenVendor?: () => void
  isMine?: boolean
  onUnshare?: (vendorId: string) => void
}) {
  const [voteAdded, setVoteAdded] = useState(false)
  const [liked, setLiked] = useState(initialLiked)

  // 외부에서 찜 상태가 변경되면 동기화
  useEffect(() => {
    setLiked(initialLiked)
  }, [initialLiked])

  return (
    <div
      className="relative w-64 cursor-pointer overflow-hidden rounded-2xl border border-border bg-background shadow-sm transition-shadow hover:shadow-md"
      onClick={onOpenVendor}
    >
      {/* 공유 취소 X 버튼 */}
      {isMine && onUnshare && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onUnshare(vendor.vendorId)
          }}
          className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      )}
      {vendor.coverUrl ? (
        <img src={vendor.coverUrl} alt={vendor.name} className="h-32 w-full object-cover" />
      ) : (
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

        {/* 코멘트 메모 */}
        {comment && (
          <div className="mt-2 overflow-hidden rounded-lg bg-pink-50 border border-pink-200/60 px-3 py-2">
            <p className="text-xs text-pink-700 leading-relaxed whitespace-pre-wrap break-words">💬 {comment}</p>
          </div>
        )}

        {/* 좋아요 + 비밀투표 버튼 */}
        <div className="mt-2.5 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation()
              if (liked) {
                onUnfavorite?.(vendor.vendorId)
                setLiked(false)
              } else {
                onFavorite?.(vendor)
                setLiked(true)
              }
            }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors ${
              liked
                ? "bg-red-50 text-red-500"
                : "bg-muted text-muted-foreground hover:bg-red-50 hover:text-red-500"
            }`}
          >
            <Heart className={`size-3 ${liked ? "fill-red-500" : ""}`} />
            {liked ? "찜 완료" : "찜하기"}
          </button>
          {onAddToVote && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (!voteAdded) {
                  onAddToVote(vendor)
                  setVoteAdded(true)
                }
              }}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-1.5 text-xs font-medium transition-colors ${
                voteAdded
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <Lock className="size-3" />
              {voteAdded ? "추가됨" : "투표 제안"}
            </button>
          )}
        </div>

        {/* 공유 취소 (본인 공유만) */}
      </div>
    </div>
  )
}

function CoupleChatMessage({
  role,
  content,
  sender,
  currentUser,
  createdAt,
  vendorShare,
  vendorShares,
  recommendations,
  comment,
  imageUrl,
  onAddToVote,
  onFavoriteVendor,
  onUnfavoriteVendor,
  favoriteVendorIds = [],
  onOpenVendor,
  onCardClick,
  isMine = false,
  onUnshare,
}: {
  role: "assistant" | "user" | "groom" | "bride" | "system"
  content: string
  sender?: string
  currentUser?: "groom" | "bride"
  createdAt?: string
  vendorShare?: VendorShare
  vendorShares?: VendorShare[]
  recommendations?: import("@/lib/api").AiRecommendation[]
  comment?: string
  imageUrl?: string
  onAddToVote?: (vendor: VendorShare) => void
  onFavoriteVendor?: (vendor: VendorShare) => void
  onUnfavoriteVendor?: (vendorId: string) => void
  favoriteVendorIds?: string[]
  onOpenVendor?: (vendorId: string) => void
  onCardClick?: (rec: import("@/lib/api").AiRecommendation) => void
  isMine?: boolean
  onUnshare?: (vendorId: string) => void
}) {
  const isSystem = role === "system"
  const isAssistant = role === "assistant"
  const isGroom = role === "groom"
  const isMe = role === currentUser

  if (isSystem) {
    return (
      <div className="flex justify-center py-2">
        <div className="max-w-sm rounded-2xl bg-amber-50 border border-amber-200 px-5 py-4 text-center">
          <p className="text-sm text-amber-800 whitespace-pre-line">{content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex gap-3 ${isAssistant ? "" : isMe ? "flex-row-reverse" : ""}`}>
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
      <div className={`max-w-[80%] ${isAssistant ? "" : isMe ? (vendorShare ? "text-left" : "text-right") : "text-left"}`}>
        {!isAssistant && (
          <span className={`mb-1 block text-xs font-medium ${
            isGroom ? "text-blue-600" : "text-pink-600"
          }`}>
            {sender}
          </span>
        )}
        {vendorShares && vendorShares.length > 0 ? (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {vendorShares.map((vs) => (
                <div key={vs.id} className="shrink-0">
                  <VendorShareCard vendor={vs} onAddToVote={onAddToVote} onFavorite={onFavoriteVendor} onUnfavorite={onUnfavoriteVendor} initialLiked={favoriteVendorIds.includes(vs.vendorId)} onOpenVendor={() => onOpenVendor?.(vs.vendorId)} />
                </div>
              ))}
            </div>
            {content && (
              isAssistant ? (
                <div className="mt-2 px-1 text-sm leading-relaxed text-foreground">
                  <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]}>
                    {content}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className={`mt-2 ${isMe ? "rounded-2xl bg-primary px-4 py-3 text-white" : "rounded-2xl bg-muted px-4 py-3"}`}>
                  <p className="text-sm whitespace-pre-line">{content}</p>
                </div>
              )
            )}
          </div>
        ) : imageUrl ? (
          <div className="rounded-2xl overflow-hidden">
            <img
              src={imageUrl}
              alt="공유 이미지"
              className="max-w-[300px] max-h-[300px] rounded-2xl object-cover cursor-pointer"
              onClick={() => window.open(imageUrl, "_blank")}
            />
          </div>
        ) : vendorShare ? (
          <VendorShareCard vendor={vendorShare} comment={comment} onAddToVote={onAddToVote} onFavorite={onFavoriteVendor} onUnfavorite={onUnfavoriteVendor} initialLiked={favoriteVendorIds.includes(vendorShare.vendorId)} onOpenVendor={() => onOpenVendor?.(vendorShare.vendorId)} isMine={isMine} onUnshare={onUnshare} />
        ) : isAssistant ? (
          <div className="px-1 text-sm leading-relaxed text-foreground">
            <ReactMarkdown
              remarkPlugins={[[remarkGfm, { singleTilde: false }]]}
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                li: ({ children }) => <li className="text-sm">{children}</li>,
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
              }}
            >
              {content}
            </ReactMarkdown>
            {recommendations && recommendations.length > 0 && (
              <RecommendationCarousel recommendations={recommendations} onCardClick={onCardClick} />
            )}
          </div>
        ) : (
          <div className={isGroom ? "rounded-2xl bg-blue-500 px-4 py-3 text-white" : "rounded-2xl bg-primary px-4 py-3 text-white"}>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{content}</p>
          </div>
        )}
        {createdAt && !isAssistant && (
          <span className={`mt-1 block text-[10px] text-muted-foreground ${isMe ? "text-right" : "text-left"}`}>
            {new Date(createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" })}
          </span>
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

