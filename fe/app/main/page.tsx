"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { getMyInfo, getCoupleProfile, getAccessToken, setAccessToken, tryReissue, logout, clearAccessToken, createInviteCode, connectCouple, addFavorite, removeFavorite, getAllCoupleFavorites } from "@/lib/api"
import { ChatSidebar, type ChatSession, type ChatMessage as SessionMessage } from "@/components/chat-sidebar"
import { ChatMessage } from "@/components/chat-message"
import { ChatInput, type DroppedVendor } from "@/components/chat-input"
import { WelcomeScreen } from "@/components/welcome-screen"
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
import { CoupleWishlistView } from "@/components/views/couple-wishlist-view"
import { SplitPanel, type PanelState, type PanelTab, type PanelTabType } from "@/components/split-panel"
import { Store, DollarSign, Calendar, Sparkles, Send, X } from "lucide-react"

// 패널 탭으로 열 수 있는 뷰
const PANEL_VIEWS: Record<string, PanelTabType> = {
  "couple-chat": "couple-chat",
  "vendors": "vendors",
  "chat": "chat",
  "schedule": "schedule",
  "vote": "vote",
  "budget": "budget",
  "couple-wishlist": "couple-wishlist",
}

// 풀페이지로만 보여줄 뷰
type ViewType = "chat" | "couple-chat" | "budget" | "vendors" | "schedule" | "my-chats" | "my-page" | "wishlist" | "payment" | "reservation" | "reviews" | "vote"

const TAB_LABELS: Record<PanelTabType, string> = {
  chat: "AI 채팅",
  "couple-chat": "커플 채팅",
  vendors: "업체",
  schedule: "일정",
  vote: "비밀 투표",
  budget: "예산",
  "couple-wishlist": "커플 찜목록",
}

interface Message {
  id: string
  role: "assistant" | "user"
  content: string
}

export default function ChatPage() {
  const router = useRouter()

  // 인증 상태
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [coupleId, setCoupleId] = useState<number | null>(null)
  const [userName, setUserName] = useState("")
  const [userNickname, setUserNickname] = useState("")
  const [userRole, setUserRole] = useState<"groom" | "bride">("groom")
  const [coupleConnected, setCoupleConnected] = useState(false)
  const [myInviteCode, setMyInviteCode] = useState("")

  // 로그인 체크: 미인증이면 /login, 미가입이면 /signup으로 리다이렉트
  useEffect(() => {
    const init = async () => {
      // 브라우저 닫으면 sessionStorage가 사라지므로 로그인 페이지로
      if (!sessionStorage.getItem("loggedIn")) {
        clearAccessToken()
        router.replace("/login")
        return
      }

      // 테스트 로그인 토큰 복원
      const testToken = sessionStorage.getItem("testAccessToken")
      if (testToken && !getAccessToken()) {
        setAccessToken(testToken)
      }

      if (!getAccessToken()) {
        const ok = await tryReissue()
        if (!ok) {
          router.replace("/login")
          return
        }
      }
      try {
        const res = await getMyInfo()
        if (!res.data.role) {
          router.replace("/signup")
          return
        }
        const r = res.data.role === "g" ? "groom" : "bride"
        setUserId(res.data.id)
        setCoupleId(res.data.coupleId)
        setUserName(res.data.name || "")
        setUserNickname(res.data.nickname || "")
        setUserRole(r)

        // 커플 프로필 조회
        if (res.data.coupleId) {
          try {
            const coupleRes = await getCoupleProfile()
            const g = coupleRes.data.groom
            const b = coupleRes.data.bride
            setCoupleConnected(coupleRes.data.status === "MATCHED" && g != null && b != null)
            setWeddingConfig((prev) => ({
              ...prev,
              groomName: g?.name || "",
              brideName: b?.name || "",
              groomNickname: g?.nickname || "",
              brideNickname: b?.nickname || "",
              groomPhoto: g?.profileImage || "",
              bridePhoto: b?.profileImage || "",
            }))
            if (coupleRes.data.status !== "MATCHED" || !g || !b) {
              createInviteCode()
                .then((inviteRes) => setMyInviteCode(inviteRes.data.inviteCode))
                .catch(() => {})
            }
          } catch {
            // 커플 정보 없음 → 본인 정보만 세팅
            setWeddingConfig((prev) => ({
              ...prev,
              groomName: r === "groom" ? (res.data.name || "") : "",
              brideName: r === "bride" ? (res.data.name || "") : "",
              groomNickname: r === "groom" ? (res.data.nickname || "") : "",
              brideNickname: r === "bride" ? (res.data.nickname || "") : "",
              groomPhoto: r === "groom" ? (res.data.profileImage || "") : "",
              bridePhoto: r === "bride" ? (res.data.profileImage || "") : "",
            }))
            createInviteCode()
              .then((inviteRes) => setMyInviteCode(inviteRes.data.inviteCode))
              .catch(() => {})
          }
        } else {
          // coupleId 없음 → 본인 정보만 세팅
          setWeddingConfig((prev) => ({
            ...prev,
            groomName: r === "groom" ? (res.data.name || "") : "",
            brideName: r === "bride" ? (res.data.name || "") : "",
            groomNickname: r === "groom" ? (res.data.nickname || "") : "",
            brideNickname: r === "bride" ? (res.data.nickname || "") : "",
            groomPhoto: r === "groom" ? (res.data.profileImage || "") : "",
            bridePhoto: r === "bride" ? (res.data.profileImage || "") : "",
          }))
          createInviteCode()
            .then((inviteRes) => setMyInviteCode(inviteRes.data.inviteCode))
            .catch(() => {})
        }
        // /mypage에서 리다이렉트된 경우 마이페이지 뷰 활성화
        const pendingView = sessionStorage.getItem("pendingView")
        if (pendingView) {
          sessionStorage.removeItem("pendingView")
          // 패널 뷰는 authChecked 후에 처리하기 위해 저장
          if (!(pendingView in PANEL_VIEWS)) {
            setCurrentView(pendingView as ViewType)
          }
          const urlMap: Record<string, string> = { "my-page": "/mypage", "couple-chat": "/couple-chat" }
          window.history.replaceState(null, "", urlMap[pendingView] || "/main")
          // 패널 뷰를 위해 임시 저장
          if (pendingView in PANEL_VIEWS) {
            sessionStorage.setItem("pendingPanel", pendingView)
          }
        }

        // DB에서 커플 전체 찜 데이터 로드
        const loadFavorites = () => {
          if (!res.data.coupleId) return
          getAllCoupleFavorites()
            .then((favRes) => {
              const CATEGORY_MAP: Record<string, "studio" | "dress" | "makeup" | "venue"> = {
                STUDIO: "studio", DRESS: "dress", MAKEUP: "makeup", HALL: "venue",
                studio: "studio", dress: "dress", makeup: "makeup", venue: "venue",
              }
              const CAT_LABEL: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", venue: "웨딩홀" }
              const myId = res.data.id
              const favs: VendorShare[] = favRes.data.map((f: any) => {
                const cat = CATEGORY_MAP[f.category] ?? "studio"
                const isMe = f.userId === myId
                return {
                  id: `fav-${f.id}`,
                  vendorId: f.vendorId.toString(),
                  name: f.name || "",
                  category: cat,
                  categoryLabel: CAT_LABEL[cat] || "",
                  price: f.price ? `${f.price.toLocaleString()}원` : "",
                  rating: f.rating || 0,
                  address: "",
                  tags: [],
                  description: f.description || "",
                  coverUrl: f.imageUrl || undefined,
                  sharedBy: isMe ? r : (r === "groom" ? "bride" : "groom"),
                }
              })
              setFavoriteVendors(favs)
            })
            .catch(() => {})
        }
        loadFavorites()
        // 3초마다 찜 데이터 폴링
        const favInterval = setInterval(loadFavorites, 3000)
        // cleanup은 컴포넌트 언마운트 시
        window.__favInterval = favInterval as any

        setAuthChecked(true)
      } catch {
        clearAccessToken()
        router.replace("/login")
      }
    }
    init()
    return () => {
      if ((window as any).__favInterval) clearInterval((window as any).__favInterval)
    }
  }, [router])

  const [messages, setMessages] = useState<Message[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [attachedVendors, setAttachedVendors] = useState<DroppedVendor[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showWelcome, setShowWelcome] = useState(true)
  const [currentView, setCurrentView] = useState<ViewType | null>(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem("openPanels")) return null
    return null
  })
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([])
  const [sharedVendors, setSharedVendors] = useState<VendorShare[]>([])
  const [favoriteVendors, setFavoriteVendors] = useState<VendorShare[]>([])
  const [pendingVoteItems, setPendingVoteItems] = useState<VendorItem[]>([])
  const [voteBadge, setVoteBadge] = useState(0)
  const [coupleChatBadge, setCoupleChatBadge] = useState(0)
  const [openVendorId, setOpenVendorId] = useState<string | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [shareModalVendor, setShareModalVendor] = useState<{ id: string; name: string; category: "studio" | "dress" | "makeup" | "venue"; price: string; rating: number; address: string; tags: string[]; description: string; coverUrl?: string } | null>(null)
  const [shareModalComment, setShareModalComment] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ── 패널 상태 ──────────────────────────────
  const [panelState, setPanelState] = useState<PanelState>(() => {
    // sessionStorage에서 패널 복원
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("openPanels")
      if (saved) {
        try {
          const panels = JSON.parse(saved) as { type: string; side: string }[]
          const leftTabs: PanelTab[] = []
          const rightTabs: PanelTab[] = []
          panels.forEach((p) => {
            const isChatType = p.type === "chat" || p.type === "couple-chat"
            const tab: PanelTab = {
              id: `${p.type}-restore-${Math.random()}`,
              type: p.type as PanelTabType,
              title: TAB_LABELS[p.type as PanelTabType] || p.type,
            }
            if (isChatType) leftTabs.push(tab)
            else rightTabs.push(tab)
          })
          if (leftTabs.length > 0 || rightTabs.length > 0) {
            return {
              left: leftTabs,
              right: rightTabs,
              activeLeftId: leftTabs[0]?.id || null,
              activeRightId: rightTabs[0]?.id || null,
              splitRatio: 0.5,
            }
          }
        } catch { /* ignore */ }
      }
    }
    return { left: [], right: [], activeLeftId: null, activeRightId: null, splitRatio: 0.5 }
  })
  const [isDraggingFromSidebar, setIsDraggingFromSidebar] = useState(false)

  const [weddingConfig, setWeddingConfig] = useState({
    groomName: "",
    groomNickname: "",
    brideName: "",
    brideNickname: "",
    groomPhoto: "",
    bridePhoto: "",
    dDay: 0,
    budget: 0,
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

      // AI채팅/커플채팅 → 항상 왼쪽, 나머지 → 항상 오른쪽
      const isChatType = type === "chat" || type === "couple-chat"
      const targetSide = isChatType ? "left" : "right"

      if (targetSide === "right") {
        return { ...prev, right: [...prev.right, tab], activeRightId: tab.id }
      }
      return { ...prev, left: [...prev.left, tab], activeLeftId: tab.id }
    })

    // 풀페이지 뷰 해제
    setCurrentView(null)
  }

  // panelState 변경 시 sessionStorage에 저장
  useEffect(() => {
    const panels = [
      ...panelState.left.map((t) => ({ type: t.type, side: "left" })),
      ...panelState.right.map((t) => ({ type: t.type, side: "right" })),
    ]
    if (panels.length > 0) {
      sessionStorage.setItem("openPanels", JSON.stringify(panels))
    } else {
      sessionStorage.removeItem("openPanels")
    }
  }, [panelState])

  // pendingPanel 처리 (리다이렉트로 돌아온 경우)
  useEffect(() => {
    if (!authChecked) return
    const pendingPanel = sessionStorage.getItem("pendingPanel")
    if (pendingPanel) {
      sessionStorage.removeItem("pendingPanel")
      if (pendingPanel in PANEL_VIEWS) {
        addPanelTab(PANEL_VIEWS[pendingPanel], "left")
      }
    }
  }, [authChecked])

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
    setAttachedVendors([])
    setIsTyping(true)
    autoOpenRelatedTab(content)

    setTimeout(() => {
      setIsTyping(false)
      const responseText = getInitialAIResponse(content)
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText,
      }
      setMessages((prev) => [...prev, aiResponse])
    }, 1500)
  }

  // 사용자 메시지 키워드 기반 관련 탭 자동 오픈
  const autoOpenRelatedTab = (userText: string) => {
    const lower = userText.toLowerCase()
    if (lower.includes("예산") || lower.includes("비용") || lower.includes("견적")) {
      addPanelTab("budget", "right")
    } else if (lower.includes("일정") || lower.includes("스케줄") || lower.includes("날짜")) {
      addPanelTab("schedule", "right")
    } else if (lower.includes("업체") || lower.includes("스튜디오") || lower.includes("드레스") || lower.includes("메이크업") || lower.includes("웨딩홀")) {
      addPanelTab("vendors", "right")
    } else if (lower.includes("투표") || lower.includes("의견")) {
      addPanelTab("vote", "right")
    }
  }

  const handleVendorDrop = (vendor: DroppedVendor) => {
    setAttachedVendors((prev) =>
      prev.some((v) => v.id === vendor.id) ? prev : [...prev, vendor]
    )
  }

  const handleRemoveVendor = (id: string) => {
    setAttachedVendors((prev) => prev.filter((v) => v.id !== id))
  }

  const handleSend = (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
    }
    setMessages((prev) => [...prev, userMessage])
    setAttachedVendors([])
    setIsTyping(true)
    autoOpenRelatedTab(content)

    setTimeout(() => {
      setIsTyping(false)
      const responseText = getAIResponse(content)
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: responseText,
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
      const panelType = PANEL_VIEWS[view]

      if (view === "couple-chat") setCoupleChatBadge(0)

      addPanelTab(panelType, "left")
      if (view === "vote") setVoteBadge(0)
      // couple-chat URL은 유지, 다른 패널 추가 시 URL 안 바꿈
      if (view === "couple-chat") {
        window.history.pushState(null, "", "/couple-chat")
      }
      return
    }

    // 풀페이지 뷰
    setCurrentView(view)
    if (view === "vote") setVoteBadge(0)
    // URL 업데이트 (페이지 이동 없이)
    const urlMap: Record<string, string> = { "my-page": "/mypage" }
    window.history.pushState(null, "", urlMap[view] || "/main")
  }

  const handleAccountNavigate = (view: string) => {
    const validViews: ViewType[] = ["my-page", "wishlist", "payment", "reservation", "reviews"]
    if (validViews.includes(view as ViewType)) {
      setCurrentView(view as ViewType)
      const urlMap: Record<string, string> = { "my-page": "/mypage" }
      window.history.pushState(null, "", urlMap[view] || "/main")
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

  const handleFavoriteChange = (vendor: { id: string; name: string; category: "studio" | "dress" | "makeup" | "venue"; price: string; rating: number; address: string; tags: string[]; description: string; coverUrl?: string }, isFavorite: boolean) => {
    if (isFavorite) {
      const fav: VendorShare = {
        id: `fav-${Date.now()}-${vendor.id}`,
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
        sharedBy: userRole,
      }
      setFavoriteVendors((prev) => [...prev, fav])
      addFavorite(Number(vendor.id)).catch(() => {})
      toast.success("찜목록에 추가됐어요", { description: vendor.name, duration: 2000 })
    } else {
      setFavoriteVendors((prev) =>
        prev.filter((v) => !(v.vendorId === vendor.id && v.sharedBy === userRole))
      )
      removeFavorite(Number(vendor.id)).catch(() => {})
      toast.success("찜목록에서 제거됐어요", { description: vendor.name, duration: 2000 })
    }
  }

  // 커플채팅에서 공유된 업체 좋아요
  const handleFavoriteVendorFromChat = (vendor: VendorShare) => {
    const alreadyFav = favoriteVendors.some(
      (v) => v.vendorId === vendor.vendorId && v.sharedBy === userRole
    )
    if (!alreadyFav) {
      const fav: VendorShare = { ...vendor, id: `fav-${Date.now()}-${vendor.vendorId}`, sharedBy: userRole }
      setFavoriteVendors((prev) => [...prev, fav])
      addFavorite(Number(vendor.vendorId)).catch(() => {})
      toast.success("찜목록에 추가됐어요", { description: vendor.name, duration: 2000 })
    }
  }

  const handleShareVendor = (vendor: { id: string; name: string; category: "studio" | "dress" | "makeup" | "venue"; price: string; rating: number; address: string; tags: string[]; description: string; coverUrl?: string }) => {
    setShareModalVendor(vendor)
    setShareModalComment("")
  }

  const confirmShareVendor = () => {
    if (!shareModalVendor) return
    const share: VendorShare = {
      id: Date.now().toString(),
      vendorId: shareModalVendor.id,
      name: shareModalVendor.name,
      category: shareModalVendor.category,
      categoryLabel: CATEGORY_LABELS[shareModalVendor.category] ?? shareModalVendor.category,
      price: shareModalVendor.price,
      rating: shareModalVendor.rating,
      address: shareModalVendor.address,
      tags: shareModalVendor.tags,
      description: shareModalVendor.description,
      coverUrl: shareModalVendor.coverUrl,
      sharedBy: userRole,
      comment: shareModalComment.trim() || undefined,
    }
    setSharedVendors((prev) => [...prev, share])
    const hasCoupleChat = [...panelState.left, ...panelState.right].some((t) => t.type === "couple-chat")
    if (!hasCoupleChat) setCoupleChatBadge((prev) => prev + 1)
    toast.success(`커플 채팅에 공유됐어요`, { description: shareModalVendor.name, duration: 3000 })
    setShareModalVendor(null)
    setShareModalComment("")
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch {
      // 서버 에러여도 로그아웃 진행
    }
    clearAccessToken()
    sessionStorage.removeItem("testAccessToken")
    sessionStorage.removeItem("loggedIn")
    router.replace("/login")
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
              {/* 헤더 */}
              <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                    <Sparkles className="size-5 text-primary" />
                  </div>
                  <h1 className="text-lg font-semibold text-foreground">AI 웨딩 플래너</h1>
                </div>
              </div>
              <WelcomeScreen
                onStartChat={(content) => {
                  setShowWelcome(false)
                  handleStartChat(content)
                }}
                groomName={weddingConfig.groomName}
                brideName={weddingConfig.brideName}
                dDay={weddingConfig.dDay}
              />
            </div>
          )
        }
        return (
          <ChatPanelWithDrop
            messages={messages}
            isTyping={isTyping}
            messagesEndRef={messagesEndRef}
            onSend={handleSend}
            attachedVendors={attachedVendors}
            onVendorDrop={handleVendorDrop}
            onRemoveVendor={handleRemoveVendor}
            onOpenTab={(type) => addPanelTab(type as PanelTabType, "right")}
          />
        )

      case "couple-chat":
        return (
          <CoupleChatView
            groomName={weddingConfig.groomName}
            brideName={weddingConfig.brideName}
            currentUser={userRole}
            coupleId={coupleId}
            userId={userId}
            sharedVendors={sharedVendors}
            onAddToVote={(v) => handleAddToVote({ ...v, id: v.vendorId }, "partner-share")}
            onOpenTab={(type) => {
              if (type.startsWith("vendor:")) {
                const vendorId = type.split(":")[1]
                setOpenVendorId(vendorId)
                addPanelTab("vendors", "right")
              } else {
                addPanelTab(type as PanelTabType, "right")
                if (type === "vote") setVoteBadge(0)
              }
            }}
            onVendorShared={(vendor) => {
              setSharedVendors((prev) => [...prev, vendor])
            }}
            onFavoriteVendor={handleFavoriteVendorFromChat}
            onUnfavoriteVendor={(vendorId) => {
              setFavoriteVendors((prev) =>
                prev.filter((v) => !(v.vendorId === vendorId && v.sharedBy === userRole))
              )
              removeFavorite(Number(vendorId)).catch(() => {})
              toast.success("찜목록에서 제거됐어요", { duration: 2000 })
            }}
            favoriteVendorIds={favoriteVendors.filter((v) => v.sharedBy === userRole).map((v) => v.vendorId)}
            voteBadge={voteBadge}
            onShareVendorFromDrop={(vendor) => {
              setShareModalVendor({
                id: vendor.id,
                name: vendor.name,
                category: vendor.category as "studio" | "dress" | "makeup" | "venue",
                price: vendor.price,
                rating: vendor.rating,
                address: vendor.address,
                tags: vendor.tags,
                description: vendor.description,
              })
              setShareModalComment("")
            }}
            onUnshareVendor={(vendorId) => {
              setSharedVendors((prev) => prev.filter((v) => !(v.vendorId === vendorId && v.sharedBy === userRole)))
              setPendingVoteItems((prev) => prev.filter((v) => !v.id.startsWith(`vote-${vendorId}-`)))
              toast.success("공유가 취소됐어요", { duration: 2000 })
            }}
          />
        )

      case "vendors":
        return (
          <VendorsView
            onShareVendor={handleShareVendor}
            onAddToVote={(v) => handleAddToVote(v, "my-wish")}
            currentUser={userRole}
            onFavoriteChange={handleFavoriteChange}
            initialVendorId={openVendorId}
            favoriteVendorIds={favoriteVendors.filter((v) => v.sharedBy === userRole).map((v) => v.vendorId)}
          />
        )

      case "schedule":
        return <ScheduleView />

      case "vote":
        return <VoteView currentUser={userRole} pendingItems={pendingVoteItems} />

      case "budget":
        return <BudgetView totalBudget={weddingConfig.budget} />

      case "couple-wishlist":
        return (
          <CoupleWishlistView
            sharedVendors={favoriteVendors}
            groomName={weddingConfig.groomName}
            brideName={weddingConfig.brideName}
            currentUser={userRole}
            onOpenVendor={() => addPanelTab("vendors", "right")}
            onOpenSchedule={() => addPanelTab("schedule", "right")}
            onUnfavorite={(vendorId) => {
              setFavoriteVendors((prev) =>
                prev.filter((v) => v.vendorId !== vendorId)
              )
              removeFavorite(Number(vendorId)).catch(() => {})
              toast.success("찜목록에서 제거됐어요", { duration: 2000 })
            }}
            onShareVendor={(vendor) => {
              setShareModalVendor({
                id: vendor.vendorId,
                name: vendor.name,
                category: vendor.category,
                price: vendor.price,
                rating: vendor.rating,
                address: vendor.address,
                tags: vendor.tags,
                description: vendor.description,
                coverUrl: vendor.coverUrl,
              })
              setShareModalComment("")
            }}
            onAlsoFavorite={(vendor) => {
              const alreadyFav = favoriteVendors.some(
                (v) => v.vendorId === vendor.vendorId && v.sharedBy === userRole
              )
              if (!alreadyFav) {
                const fav: VendorShare = { ...vendor, id: `fav-${Date.now()}-${vendor.vendorId}`, sharedBy: userRole }
                setFavoriteVendors((prev) => [...prev, fav])
                addFavorite(Number(vendor.vendorId)).catch(() => {})
                toast.success("나도 찜했어요!", { description: vendor.name, duration: 2000 })
              } else {
                toast.info("이미 찜한 업체예요", { duration: 2000 })
              }
            }}
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
            userRole={userRole}
            onCoupleConnect={async (inviteCode) => {
              try {
                const res = await connectCouple(inviteCode)
                setCoupleConnected(true)
                toast.success("파트너와 연결되었습니다!", { description: res.data.partnerNickname })
              } catch {
                toast.error("연결 실패", { description: "초대코드를 확인해주세요." })
              }
            }}
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

  // 로딩 중
  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
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
        coupleConnected={coupleConnected}
        userRole={userRole}
        currentView={currentView ?? "chat"}
        activeSessionId={activeSessionId}
        chatHistory={chatHistory}
        userName={userName}
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

        {/* 업체 공유 모달 */}
        {shareModalVendor && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setShareModalVendor(null); setShareModalComment("") }} />
            <div className="relative mx-4 w-full max-w-md rounded-2xl bg-background shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-foreground">커플 방에 공유하기</h2>
                <button onClick={() => { setShareModalVendor(null); setShareModalComment("") }} className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted">
                  <X className="size-4" />
                </button>
              </div>
              <div className="px-5 py-4">
                <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">[업체 공유] {shareModalVendor.name}</p>
                  <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                    {shareModalVendor.address && <p>📍 {shareModalVendor.address}</p>}
                    {shareModalVendor.price && <p>💰 {shareModalVendor.price}</p>}
                    {shareModalVendor.rating > 0 && <p>⭐ {shareModalVendor.rating}</p>}
                  </div>
                </div>
                <textarea
                  value={shareModalComment}
                  onChange={(e) => setShareModalComment(e.target.value)}
                  placeholder="이 업체의 어떤 점이 마음에 드셨나요? 작성하면 AI가 더 잘 추천해줄 수 있어요 (선택 사항)"
                  rows={3}
                  className="mt-4 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex gap-2 border-t border-border px-5 py-4">
                <button
                  onClick={() => { setShareModalVendor(null); setShareModalComment("") }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  취소
                </button>
                <button
                  onClick={confirmShareVendor}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  <Send className="size-3.5" />
                  커플 방에 공유
                </button>
              </div>
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

// ── AI 채팅 패널 (드래그앤드롭 지원) ──────────────────────
function ChatPanelWithDrop({
  messages,
  isTyping,
  messagesEndRef,
  onSend,
  attachedVendors,
  onVendorDrop,
  onRemoveVendor,
  onOpenTab,
}: {
  messages: Message[]
  isTyping: boolean
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  onSend: (content: string) => void
  attachedVendors: DroppedVendor[]
  onVendorDrop: (vendor: DroppedVendor) => void
  onRemoveVendor: (id: string) => void
  onOpenTab: (type: string) => void
}) {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div
      className="flex h-full flex-col"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("application/vendor-card")) {
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
          setDragOver(true)
        }
      }}
      onDragLeave={(e) => {
        // 자식 요소로의 이동은 무시
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDragOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const data = e.dataTransfer.getData("application/vendor-card")
        if (!data) return
        const vendor = JSON.parse(data) as DroppedVendor
        onVendorDrop(vendor)
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <h1 className="text-lg font-semibold text-foreground">AI 웨딩 플래너</h1>
        </div>
      </div>
      {/* 드래그 오버 시 전체 화면 인디케이터 */}
      {dragOver && (
        <div className="flex items-center justify-center gap-2 border-b border-primary/20 bg-primary/5 py-3 text-sm font-medium text-primary">
          <Store className="size-4" />
          업체를 놓아서 질문에 추가하기
        </div>
      )}
      <div className="flex-1 overflow-y-auto bg-background">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
          {messages.map((message) => (
            <ChatMessage key={message.id} role={message.role} content={message.content} />
          ))}
          {isTyping && <ChatMessage role="assistant" content="" isTyping />}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <ChatInput
        onSend={onSend}
        disabled={isTyping}
        placeholder="AI에게 질문하세요..."
        attachedVendors={attachedVendors}
        onVendorDrop={onVendorDrop}
        onRemoveVendor={onRemoveVendor}
      />
    </div>
  )
}
