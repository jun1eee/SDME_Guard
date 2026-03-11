"use client"

import { useState, useRef, useEffect } from "react"
import { ChatSidebar, type ChatSession, type ChatMessage as SessionMessage } from "@/components/chat-sidebar"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput } from "@/components/chat-input"
import { WelcomeScreen } from "@/components/welcome-screen"
import { SetupScreen } from "@/components/setup-screen"
import { CoupleChatView, type VendorShare } from "@/components/views/couple-chat-view"
import { toast } from "sonner"
import { BudgetView } from "@/components/views/budget-view"
import { VendorsView } from "@/components/views/vendors-view"
import { ScheduleView } from "@/components/views/schedule-view"
import { MyPageView } from "@/components/views/my-page-view"
import { WishlistView } from "@/components/views/wishlist-view"
import { PaymentView } from "@/components/views/payment-view"
import { ReservationView } from "@/components/views/reservation-view"
import { ReviewView } from "@/components/views/review-view"
import { VoteView, type VendorItem } from "@/components/views/vote-view"
import { SplitPanel, type PanelState, type PanelTab, type PanelTabType } from "@/components/split-panel"

// 패널 탭으로 열 수 있는 뷰
const PANEL_VIEWS: Record<string, PanelTabType> = {
  "couple-chat": "couple-chat",
  "vendors": "vendors",
  "chat": "chat",
}

// 풀페이지로만 보여줄 뷰
type ViewType = "chat" | "couple-chat" | "budget" | "vendors" | "schedule" | "my-chats" | "my-page" | "wishlist" | "payment" | "reservation" | "reviews" | "vote"

const TAB_LABELS: Record<PanelTabType, string> = {
  chat: "AI 채팅",
  "couple-chat": "커플 채팅",
  vendors: "업체",
}

interface Message {
  id: string
  role: "assistant" | "user"
  content: string
}

export default function ChatPage() {
  // 셋업
  const [isSetup, setIsSetup] = useState(false)
  const [userNickname, setUserNickname] = useState("")
  const [userRole, setUserRole] = useState<"groom" | "bride">("groom")
  const [coupleConnected, setCoupleConnected] = useState(false)
  const [myInviteCode, setMyInviteCode] = useState("")

  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [currentView, setCurrentView] = useState<ViewType | null>(null) // null = 패널 모드
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([])
  const [sharedVendors, setSharedVendors] = useState<VendorShare[]>([])
  const [pendingVoteItems, setPendingVoteItems] = useState<VendorItem[]>([])
  const [voteBadge, setVoteBadge] = useState(0)
  const [coupleChatBadge, setCoupleChatBadge] = useState(0)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── 패널 상태 ──────────────────────────────
  const [panelState, setPanelState] = useState<PanelState>({
    left: [],
    right: [],
    activeLeftId: null,
    activeRightId: null,
    splitRatio: 0.5,
  })
  const [isDraggingFromSidebar, setIsDraggingFromSidebar] = useState(false)

  const [weddingConfig, setWeddingConfig] = useState({
    groomName: "김민수",
    groomNickname: "",
    brideName: "이서연",
    brideNickname: "",
    groomPhoto: "",
    bridePhoto: "",
    dDay: 150,
    budget: 50000000,
  })

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // ── 패널 탭 관리 ──────────────────────────────
  const addPanelTab = (type: PanelTabType, side: "left" | "right" = "left", title?: string) => {
    setPanelState((prev) => {
      // 이미 열려있으면 해당 탭 활성화
      const allTabs = [...prev.left, ...prev.right]
      const existing = allTabs.find((t) => t.type === type)
      if (existing) {
        const inLeft = prev.left.some((t) => t.id === existing.id)
        return {
          ...prev,
          ...(inLeft ? { activeLeftId: existing.id } : { activeRightId: existing.id }),
        }
      }

      const tab: PanelTab = {
        id: `${type}-${Date.now()}`,
        type,
        title: title || TAB_LABELS[type],
      }

      // 자동 배치: 왼쪽에 이미 탭이 있으면 오른쪽에 배치
      const targetSide = side === "left" && prev.left.length > 0 && prev.right.length === 0
        ? "right"
        : side

      if (targetSide === "right") {
        return { ...prev, right: [...prev.right, tab], activeRightId: tab.id }
      }
      return { ...prev, left: [...prev.left, tab], activeLeftId: tab.id }
    })

    // 풀페이지 뷰 해제
    setCurrentView(null)
  }

  // ── 기존 핸들러 ──────────────────────────────
  const handleStartChat = (content: string) => {
    setShowWelcome(false)
    setActiveSessionId(null)

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }
    setMessages([userMessage])
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getInitialAIResponse(content),
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 1500)
  }

  const handleSend = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }
    setMessages((prev) => [...prev, userMessage])
    setIsTyping(true)

    setTimeout(() => {
      setIsTyping(false)
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(content),
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 1500)
  }

  const handleNewChat = () => {
    if (messages.length > 0) {
      const firstUser = messages.find((m) => m.role === "user")
      const rawTitle = firstUser?.content ?? "새 채팅"
      const title = rawTitle.length > 28 ? rawTitle.slice(0, 28) + "…" : rawTitle
      const lastMsg = messages[messages.length - 1]
      const preview = lastMsg.content.slice(0, 60)

      const session: ChatSession = {
        id: Date.now().toString(),
        title,
        preview,
        createdAt: new Date(),
        isPinned: false,
        messages: [...messages] as SessionMessage[],
      }
      setChatHistory((prev) => [session, ...prev])
    }
    setMessages([])
    setShowWelcome(true)
    setActiveSessionId(null)
    addPanelTab("chat", "left")
  }

  const handleLoadChat = (id: string) => {
    const session = chatHistory.find((s) => s.id === id)
    if (!session) return
    setMessages(session.messages as Message[])
    setActiveSessionId(id)
    setShowWelcome(false)

    // AI 채팅 탭이 패널에 있으면 활성화, 없으면 추가
    addPanelTab("chat", "left", session.title)
  }

  const handlePinChat = (id: string) => {
    setChatHistory((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isPinned: !s.isPinned } : s))
    )
  }

  const handleDeleteChat = (id: string) => {
    setChatHistory((prev) => prev.filter((s) => s.id !== id))
    if (activeSessionId === id) {
      setActiveSessionId(null)
      setMessages([])
      setShowWelcome(true)
    }
  }

  const handleViewChange = (view: ViewType) => {
    // 패널 탭으로 열 수 있는 뷰
    if (view in PANEL_VIEWS) {
      addPanelTab(PANEL_VIEWS[view], "left")
      if (view === "couple-chat") setCoupleChatBadge(0)
      return
    }

    // 풀페이지 뷰
    setCurrentView(view)
    if (view === "vote") setVoteBadge(0)
  }

  const handleAccountNavigate = (view: string) => {
    const validViews: ViewType[] = ["my-page", "wishlist", "payment", "reservation", "reviews"]
    if (validViews.includes(view as ViewType)) {
      setCurrentView(view as ViewType)
    }
  }

  const CATEGORY_LABELS: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀" }

  const VOTE_CATEGORY_MAP: Record<string, VendorItem["category"]> = {
    studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀",
  }
  const VOTE_EMOJI_MAP: Record<string, string> = {
    studio: "📷", dress: "👗", makeup: "💄", venue: "🏛️",
  }
  const VOTE_BG_MAP: Record<string, string> = {
    studio: "bg-purple-100", dress: "bg-pink-100", makeup: "bg-amber-100", venue: "bg-rose-100",
  }

  const handleAddToVote = (vendor: { id: string; name: string; category: string; price: string; address: string }, source: "my-wish" | "partner-share") => {
    const newItem: VendorItem = {
      id: `vote-${vendor.id}-${Date.now()}`,
      category: VOTE_CATEGORY_MAP[vendor.category] ?? "웨딩홀",
      name: vendor.name,
      location: vendor.address,
      price: vendor.price,
      source,
      imageEmoji: VOTE_EMOJI_MAP[vendor.category] ?? "🏛️",
      imageBg: VOTE_BG_MAP[vendor.category] ?? "bg-rose-100",
      partnerVoted: false,
    }
    setPendingVoteItems((prev) => [...prev, newItem])
    setVoteBadge((prev) => prev + 1)
    toast.success("비밀 투표에 추가됐어요", { description: vendor.name, duration: 3000 })
  }

  const handleShareVendor = (vendor: { id: string; name: string; category: "studio" | "dress" | "makeup" | "venue"; price: string; rating: number; address: string; tags: string[]; description: string; coverUrl?: string }, sharedBy: "groom" | "bride") => {
    const share: VendorShare = {
      id: Date.now().toString(),
      vendorId: vendor.id,
      name: vendor.name,
      category: vendor.category,
      categoryLabel: CATEGORY_LABELS[vendor.category] ?? vendor.category,
      price: vendor.price,
      rating: vendor.rating,
      address: vendor.address,
      tags: vendor.tags,
      description: vendor.description,
      coverUrl: vendor.coverUrl,
      sharedBy,
    }
    setSharedVendors((prev) => [...prev, share])
    const hasCoupleChat = [...panelState.left, ...panelState.right].some((t) => t.type === "couple-chat")
    if (!hasCoupleChat) setCoupleChatBadge((prev) => prev + 1)
    toast.success(`커플 채팅에 공유됐어요`, { description: vendor.name, duration: 3000 })
  }

  const handleLogout = () => {
    setMessages([])
    setChatHistory([])
    setActiveSessionId(null)
    setShowWelcome(true)
    setCurrentView(null)
    setPanelState({ left: [], right: [], activeLeftId: null, activeRightId: null, splitRatio: 0.5 })
    setIsSetup(false)
  }

  const handleUpdateProfile = (data: {
    groomName: string
    brideName: string
    groomNickname?: string
    brideNickname?: string
    groomPhoto?: string
    bridePhoto?: string
  }) => {
    setWeddingConfig(prev => ({
      ...prev,
      groomName: data.groomName,
      brideName: data.brideName,
      groomNickname: data.groomNickname ?? prev.groomNickname,
      brideNickname: data.brideNickname ?? prev.brideNickname,
      groomPhoto: data.groomPhoto ?? prev.groomPhoto,
      bridePhoto: data.bridePhoto ?? prev.bridePhoto,
    }))
  }

  // ── 패널 탭 콘텐츠 렌더링 ──────────────────────────────
  const renderPanelContent = (tab: PanelTab) => {
    switch (tab.type) {
      case "chat":
        if (showWelcome && messages.length === 0) {
          return (
            <div className="flex h-full flex-col">
              <div className="flex flex-1 items-center justify-center p-6">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">AI 웨딩 플래너</p>
                  <p className="mt-2 text-sm text-muted-foreground">무엇이든 물어보세요</p>
                </div>
              </div>
              <ChatInput onSend={(content) => {
                setShowWelcome(false)
                handleStartChat(content)
              }} disabled={isTyping} placeholder="AI에게 질문하세요..." />
            </div>
          )
        }
        return (
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto bg-background">
              <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
                {messages.map((message) => (
                  <ChatMessage key={message.id} role={message.role} content={message.content} />
                ))}
                {isTyping && <ChatMessage role="assistant" content="" isTyping />}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <ChatInput onSend={handleSend} disabled={isTyping} placeholder="AI에게 질문하세요..." />
          </div>
        )

      case "couple-chat":
        return (
          <CoupleChatView
            groomName={weddingConfig.groomName}
            brideName={weddingConfig.brideName}
            currentUser={userRole}
            sharedVendors={sharedVendors}
            onAddToVote={(v) => handleAddToVote(v, "partner-share")}
          />
        )

      case "vendors":
        return (
          <VendorsView
            onShareVendor={handleShareVendor}
            onAddToVote={(v) => handleAddToVote(v, "my-wish")}
            currentUser={userRole}
          />
        )

      default:
        return null
    }
  }

  // ── 풀페이지 메인 콘텐츠 ──────────────────────────────
  const renderFullPageContent = () => {
    switch (currentView) {
      case "budget":
        return <BudgetView totalBudget={weddingConfig.budget} />
      case "schedule":
        return <ScheduleView />
      case "my-page":
        return (
          <MyPageView
            groomName={weddingConfig.groomName}
            groomNickname={weddingConfig.groomNickname}
            brideName={weddingConfig.brideName}
            brideNickname={weddingConfig.brideNickname}
            groomPhoto={weddingConfig.groomPhoto}
            bridePhoto={weddingConfig.bridePhoto}
            coupleConnected={coupleConnected}
            myInviteCode={myInviteCode}
            onCoupleConnect={() => setCoupleConnected(true)}
            onUpdateProfile={handleUpdateProfile}
            onDeleteAccount={handleLogout}
          />
        )
      case "wishlist":
        return <WishlistView />
      case "payment":
        return <PaymentView />
      case "reservation":
        return <ReservationView onNavigateToSchedule={() => setCurrentView("schedule")} />
      case "reviews":
        return <ReviewView />
      case "vote":
        return <VoteView currentUser={userRole} pendingItems={pendingVoteItems} />
      default:
        return null
    }
  }

  // 셋업 화면
  if (!isSetup) {
    return (
      <SetupScreen
        onComplete={(name, nickname, connected, inviteCode, role) => {
          setWeddingConfig((prev) => ({
            ...prev,
            groomName: role === "groom" ? name : prev.groomName,
            brideName: role === "bride" ? name : prev.brideName,
            groomNickname: role === "groom" ? nickname : prev.groomNickname,
            brideNickname: role === "bride" ? nickname : prev.brideNickname,
          }))
          setUserNickname(nickname)
          setUserRole(role)
          setCoupleConnected(connected)
          setMyInviteCode(inviteCode)
          setIsSetup(true)
        }}
      />
    )
  }

  // 패널에 열린 탭 타입 목록
  const openPanelTypes = [...panelState.left, ...panelState.right].map((t) => t.type)
  const hasPanelTabs = panelState.left.length > 0 || panelState.right.length > 0
  const isFullPageMode = currentView !== null

  // 사이드바에서 드래그 → 메인 드롭
  const handleMainDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFromSidebar(false)
    const type = e.dataTransfer.getData("application/floating-window") as PanelTabType
    if (!type) return

    const mainRect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const dropX = e.clientX - mainRect.left
    const midX = mainRect.width / 2

    // 드롭 위치에 따라 좌/우 패널에 배치
    const side = dropX < midX ? "left" : "right"
    addPanelTab(type, side)
  }

  return (
    <div className="flex h-screen bg-background">
      <ChatSidebar
        onNewChat={handleNewChat}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        groomName={weddingConfig.groomName}
        brideName={weddingConfig.brideName}
        groomPhoto={weddingConfig.groomPhoto}
        bridePhoto={weddingConfig.bridePhoto}
        dDay={weddingConfig.dDay}
        currentView={currentView ?? "chat"}
        activeSessionId={activeSessionId}
        chatHistory={chatHistory}
        userNickname={userNickname}
        voteBadge={voteBadge}
        coupleChatBadge={coupleChatBadge}
        onViewChange={handleViewChange}
        onAccountNavigate={handleAccountNavigate}
        onLogout={handleLogout}
        onLoadChat={handleLoadChat}
        onPinChat={handlePinChat}
        onDeleteChat={handleDeleteChat}
        openFloatingWindows={openPanelTypes}
      />
      <main
        className="relative flex-1 overflow-hidden bg-background"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/floating-window")) {
            e.preventDefault()
            setIsDraggingFromSidebar(true)
          }
        }}
        onDragLeave={(e) => {
          // main 밖으로 나갔을 때만
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingFromSidebar(false)
          }
        }}
        onDrop={handleMainDrop}
      >
        {/* 풀페이지 뷰 (투표/일정/예산 등) */}
        {isFullPageMode && renderFullPageContent()}

        {/* 패널 모드 (채팅/업체 분할) */}
        {!isFullPageMode && (
          <>
            {hasPanelTabs ? (
              <SplitPanel
                state={panelState}
                onStateChange={setPanelState}
                renderContent={renderPanelContent}
                isDraggingFromSidebar={isDraggingFromSidebar}
              />
            ) : (
              // 아무 탭도 없을 때 웰컴 화면
              <WelcomeScreen
                onStartChat={(content) => {
                  addPanelTab("chat", "left")
                  setTimeout(() => handleStartChat(content), 100)
                }}
                groomName={weddingConfig.groomName}
                brideName={weddingConfig.brideName}
                dDay={weddingConfig.dDay}
              />
            )}
          </>
        )}

        {/* 드래그 오버 인디케이터 (사이드바에서 드래그 중) */}
        {isDraggingFromSidebar && !hasPanelTabs && (
          <div className="absolute inset-0 z-50 flex pointer-events-none">
            <div className="flex flex-1 items-center justify-center border-2 border-dashed border-primary/30 bg-primary/5 rounded-lg m-4">
              <p className="text-sm font-medium text-primary/70">여기에 놓아서 창 열기</p>
            </div>
          </div>
        )}
        {isDraggingFromSidebar && hasPanelTabs && (
          <div className="absolute inset-0 z-50 flex pointer-events-none">
            <div className="flex flex-1 items-center justify-center border-2 border-dashed border-primary/20 bg-primary/5 rounded-lg m-2 opacity-50">
              <p className="text-xs text-primary/50">왼쪽</p>
            </div>
            <div className="flex flex-1 items-center justify-center border-2 border-dashed border-primary/20 bg-primary/5 rounded-lg m-2 opacity-50">
              <p className="text-xs text-primary/50">오른쪽</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// Initial AI response based on first message
function getInitialAIResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()

  if (lowerMessage.includes("웨딩홀") || lowerMessage.includes("예식장")) {
    return `웨딩홀 추천을 도와드릴게요!

현재 설정된 예산과 스타일을 고려해서 추천드립니다.

**추천 웨딩홀 TOP 3**

1. **더 그랜드 파빌리온**
   - 위치: 서울 강남구
   - 예상 비용: 800~1,000만원
   - 특징: 모던하고 세련된 분위기, 최대 200명

2. **그랜드하얏트 서울**
   - 위치: 서울 용산구
   - 예상 비용: 1,200~1,500만원
   - 특징: 프리미엄 호텔 웨딩, 최대 350명

3. **아펠가모 청담**
   - 위치: 서울 강남구
   - 예상 비용: 600~900만원
   - 특징: 아늑하고 감각적인 공간, 최대 150명

더 자세한 정보가 필요하시면 말씀해주세요!`
  }

  if (lowerMessage.includes("스드메")) {
    return `스드메 패키지를 비교해드릴게요!

**스드메란?**
스튜디오(Studio) + 드레스(Dress) + 메이크업(Makeup)의 줄임말입니다.

**추천 패키지 비교**

| 구분 | 가성비형 | 프리미엄형 |
|------|----------|------------|
| 스튜디오 | 150~200만원 | 300~400만원 |
| 드레스 | 100~150만원 | 250~400만원 |
| 메이크업 | 60~80만원 | 100~150만원 |
| **총합** | **310~430만원** | **650~950만원** |

**인기 업체 추천**
- 스튜디오: 로앤스튜디오, 아이디스튜디오, 메이스튜디오
- 드레스: 로자스피사, 모니카블랑쉬, 메종 블랑쉬
- 메이크업: 글로우 뷰티, 제니하우스, 정샘물

원하시는 스타일이나 지역이 있으시면 더 맞춤 추천해드릴게요!`
  }

  if (lowerMessage.includes("하객") || lowerMessage.includes("비용") || lowerMessage.includes("계산")) {
    return `하객 예상 비용을 계산해드릴게요!

**일반적인 하객 비용 구성**

1. **식대 (1인당)**
   - 일반 뷔페: 5~7만원
   - 호텔 뷔페: 8~12만원
   - 한정식: 6~10만원

2. **답례품 (1인당)**
   - 기본: 1~2만원
   - 프리미엄: 3~5만원

**예시 계산 (하객 200명 기준)**

| 항목 | 단가 | 금액 |
|------|------|------|
| 식대 | 8만원 | 1,600만원 |
| 답례품 | 2만원 | 400만원 |
| **합계** | | **2,000만원** |

예상 하객 수를 알려주시면 더 정확하게 계산해드릴게요!`
  }

  if (lowerMessage.includes("허니문") || lowerMessage.includes("신혼여행")) {
    return `허니문 추천을 도와드릴게요!

**인기 허니문 여행지 TOP 5**

1. **몰디브** (7박 9일)
   - 예상 비용: 600~1,200만원
   - 특징: 수상빌라, 럭셔리 리조트

2. **발리** (5박 7일)
   - 예상 비용: 300~500만원
   - 특징: 문화 체험, 빌라 스테이

3. **하와이** (6박 8일)
   - 예상 비용: 500~800만원
   - 특징: 액티비티, 쇼핑

4. **유럽** (10박 12일)
   - 예상 비용: 600~1,000만원
   - 특징: 문화/역사 탐방, 다양한 도시

5. **일본** (4박 5일)
   - 예상 비용: 200~350만원
   - 특징: 가성비, 미식 여행

선호하시는 스타일(휴양/액티비티/문화)이 있으시면 말씀해주세요!`
  }

  return `안녕하세요! AI 웨딩 플래너 SDME Guard입니다.

"${userMessage}"에 대해 도움을 드릴게요.

결혼 준비에 대해 무엇이든 물어보세요:
- 웨딩홀/예식장 추천
- 스드메(스튜디오/드레스/메이크업) 정보
- 예산 계획 및 비용 계산
- 허니문 추천
- 웨딩 타임라인 관리

어떤 것이 궁금하신가요?`
}

// Subsequent AI responses
function getAIResponse(userMessage: string): string {
  const lowerMessage = userMessage.toLowerCase()

  if (lowerMessage.includes("예산") && lowerMessage.includes("5천만")) {
    return `5천만원 예산으로 강남 지역 웨딩을 준비하신다면, 아래 옵션들을 추천드려요!

**웨딩홀 추천 (예식 비용 기준)**

1. **더 그랜드 파빌리온** - 약 800~1,000만원
   - 모던하고 세련된 분위기
   - 최대 200명 수용

2. **그랜드하얏트 서울** - 약 1,200~1,500만원
   - 프리미엄 호텔 웨딩
   - 최대 350명 수용

3. **아펠가모 청담** - 약 600~900만원
   - 아늑하고 감각적인 공간
   - 최대 150명 수용

**스드메 패키지 추천**

- **스튜디오**: 로앤스튜디오, 아이디스튜디오 (200~350만원)
- **드레스**: 로자스피사, 모니카블랑쉬 (150~300만원)
- **메이크업**: 글로우 뷰티, 제니하우스 (80~150만원)

예산 내에서 충분히 퀄리티 있는 웨딩이 가능합니다.
더 자세한 정보가 필요하시면 말씀해주세요!`
  }

  if (lowerMessage.includes("하객") || lowerMessage.includes("명")) {
    return `하객 수에 따른 추천을 드릴게요!

하객 규모를 알려주시면:
- 적합한 웨딩홀 크기
- 예상 식대 비용
- 좌석 배치 추천

을 안내해 드릴 수 있어요.

몇 분 정도 예상하고 계신가요?`
  }

  if (lowerMessage.includes("일정") || lowerMessage.includes("시기") || lowerMessage.includes("날짜")) {
    return `결혼 예정 시기를 알려주시면, 준비 타임라인을 짜드릴게요!

일반적으로 웨딩 준비는 **6~12개월 전**부터 시작하는 것이 좋아요.

- **12개월 전**: 예산 설정, 웨딩홀 예약
- **9개월 전**: 스드메 계약
- **6개월 전**: 청첩장, 허니문 예약
- **3개월 전**: 최종 피팅, 식순 확정
- **1개월 전**: 최종 점검

언제쯤 결혼을 계획하고 계신가요?`
  }

  return `말씀해주신 내용을 바탕으로 맞춤 추천을 준비할게요!

더 정확한 추천을 위해 아래 정보가 있으면 좋아요:
- 결혼 예정 시기
- 예상 하객 수
- 선호하는 웨딩 스타일 (모던, 클래식, 가든 등)
- 원하는 지역

편하게 알려주세요!`
}
