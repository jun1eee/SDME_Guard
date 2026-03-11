"use client"

import { useState, useRef, useEffect } from "react"
import {
  Plus,
  DollarSign,
  Store,
  Calendar,
  MessagesSquare,
  ChevronLeft,
  MoreHorizontal,
  Pin,
  Trash2,
  Lock,
} from "lucide-react"

// 미니멀 말풍선 + 하트 커스텀 아이콘
function CoupleChatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4 2h16a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H9l-4 4v-4H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3z" />
      <path d="M12 14l-1.5-1.4C8.2 10.7 6.5 9.3 6.5 7.6 6.5 6.2 7.6 5 9 5c.8 0 1.6.4 2.1 1L12 7l.9-1C13.4 5.4 14.2 5 15 5c1.4 0 2.5 1.2 2.5 2.6 0 1.7-1.7 3.1-4.5 5L12 14z" />
    </svg>
  )
}
import { cn } from "@/lib/utils"
import { CoupleProfile } from "@/components/couple-profile"
import { AccountPopover } from "@/components/account-popover"

type ViewType = "chat" | "couple-chat" | "budget" | "vendors" | "schedule" | "my-chats" | "my-page" | "wishlist" | "payment" | "reservation" | "reviews" | "vote"

export interface ChatMessage {
  id: string
  role: "assistant" | "user"
  content: string
}

export interface ChatSession {
  id: string
  title: string
  preview: string
  createdAt: Date
  isPinned: boolean
  messages: ChatMessage[]
}

interface ChatSidebarProps {
  onNewChat: () => void
  collapsed: boolean
  onToggle: () => void
  groomName: string
  brideName: string
  groomPhoto?: string
  bridePhoto?: string
  dDay: number
  currentView: ViewType
  activeSessionId: string | null
  chatHistory: ChatSession[]
  userNickname?: string
  voteBadge?: number
  coupleChatBadge?: number
  onViewChange: (view: ViewType) => void
  onAccountNavigate: (view: string) => void
  onLogout: () => void
  onLoadChat: (id: string) => void
  onPinChat: (id: string) => void
  onDeleteChat: (id: string) => void
  openFloatingWindows?: string[]
}

interface SidebarItem {
  icon: React.ReactNode
  label: string
  view: ViewType
}

// ── 채팅 히스토리 아이템 ──────────────────────────────────────
function ChatHistoryItem({
  session,
  isActive,
  onLoad,
  onPin,
  onDelete,
}: {
  session: ChatSession
  isActive: boolean
  onLoad: (id: string) => void
  onPin: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menuOpen])

  return (
    <div className="group relative">
      <button
        onClick={() => onLoad(session.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 pr-8 text-left text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-foreground"
            : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        {session.isPinned && (
          <Pin className="size-3 shrink-0 rotate-45 text-primary" />
        )}
        <span className="flex-1 truncate leading-snug">{session.title}</span>
      </button>

      {/* "..." 버튼 */}
      <div className="absolute right-1 top-1/2 -translate-y-1/2" ref={menuRef}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen((p) => !p) }}
          className={cn(
            "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-all hover:bg-muted hover:text-foreground",
            menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <MoreHorizontal className="size-3.5" />
        </button>

        {/* 드롭다운 */}
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
            <button
              onClick={() => { onPin(session.id); setMenuOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Pin className="size-3.5 text-muted-foreground" />
              {session.isPinned ? "고정 해제" : "채팅 고정"}
            </button>
            <div className="mx-2 h-px bg-border" />
            <button
              onClick={() => { onDelete(session.id); setMenuOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 사이드바 ──────────────────────────────────────────────
export function ChatSidebar({
  onNewChat,
  collapsed,
  onToggle,
  groomName,
  brideName,
  groomPhoto,
  bridePhoto,
  dDay,
  currentView,
  activeSessionId,
  chatHistory,
  userNickname,
  voteBadge = 0,
  coupleChatBadge = 0,
  onViewChange,
  onAccountNavigate,
  onLogout,
  onLoadChat,
  onPinChat,
  onDeleteChat,
  openFloatingWindows = [],
}: ChatSidebarProps) {
  // 드래그 가능한 뷰 (플로팅 윈도우로 열 수 있는 항목)
  const draggableViews = ["couple-chat", "vendors"]

  const mainMenuItems: SidebarItem[] = [
    { icon: <CoupleChatIcon className="size-4" />, label: "커플 채팅", view: "couple-chat" },
    { icon: <DollarSign className="size-4" />, label: "예산", view: "budget" },
    { icon: <Store className="size-4" />, label: "업체", view: "vendors" },
    { icon: <Calendar className="size-4" />, label: "일정", view: "schedule" },
    { icon: <Lock className="size-4" />, label: "비밀 투표", view: "vote" },
  ]

  // 고정 채팅 먼저, 최신순
  const sortedHistory = [...chatHistory].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
    return b.createdAt.getTime() - a.createdAt.getTime()
  })

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
        collapsed ? "w-16" : "w-72"
      )}
    >
      {/* 로고 */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        {!collapsed ? (
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-opacity hover:opacity-70"
            aria-label="사이드바 닫기"
          >
            <div className="flex size-8 items-center justify-center rounded-lg">
              <img src="/favicon.png" alt="SDME Guard" className="size-6 object-contain" />
            </div>
            <span className="font-semibold text-sidebar-foreground">SDME Guard</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="mx-auto flex size-8 items-center justify-center rounded-lg"
            aria-label="Open sidebar"
          >
            <img src="/favicon.png" alt="SDME Guard" className="size-6 object-contain" />
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="사이드바 닫기"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
      </div>

      {/* 커플 프로필 */}
      <CoupleProfile
        groomName={groomName}
        brideName={brideName}
        groomPhoto={groomPhoto}
        bridePhoto={bridePhoto}
        dDay={dDay}
        collapsed={collapsed}
      />

      {/* 내비게이션 */}
      <nav className="flex flex-1 flex-col overflow-hidden p-3">
        <div className="space-y-1">
          {/* New Chat */}
          <button
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              openFloatingWindows.includes("chat")
                ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                : "bg-primary/10 text-primary hover:bg-primary/20",
              collapsed && "justify-center px-0"
            )}
            onClick={onNewChat}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("application/floating-window", "chat")
              e.dataTransfer.effectAllowed = "copy"
            }}
          >
            <Plus className="size-4" />
            {!collapsed && <span className="font-medium">New Chat</span>}
          </button>

          <div className="my-3 h-px bg-sidebar-border" />

          {/* 메인 메뉴 */}
          {mainMenuItems.map((item) => {
            const isDraggable = draggableViews.includes(item.view)
            const isFloatingOpen = openFloatingWindows.includes(
              item.view === "couple-chat" ? "couple-chat" : item.view === "vendors" ? "vendors" : ""
            )
            const isActive = currentView === item.view || isFloatingOpen

            return (
            <button
              key={item.view}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isFloatingOpen
                  ? "bg-primary/15 text-primary font-medium ring-1 ring-primary/20"
                  : isActive
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed && "justify-center px-0",
                isDraggable && "cursor-grab active:cursor-grabbing"
              )}
              onClick={() => onViewChange(item.view)}
              draggable={isDraggable}
              onDragStart={isDraggable ? (e) => {
                e.dataTransfer.setData("application/floating-window", item.view === "couple-chat" ? "couple-chat" : "vendors")
                e.dataTransfer.effectAllowed = "copy"
              } : undefined}
            >
              <div className="relative shrink-0">
                {item.icon}
                {item.view === "vote" && voteBadge > 0 && collapsed && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {voteBadge > 9 ? "9+" : voteBadge}
                  </span>
                )}
                {item.view === "couple-chat" && coupleChatBadge > 0 && collapsed && (
                  <span className="absolute -right-1 -top-1 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                    {coupleChatBadge > 9 ? "9+" : coupleChatBadge}
                  </span>
                )}
              </div>
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
              {!collapsed && item.view === "vote" && voteBadge > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {voteBadge > 9 ? "9+" : voteBadge}
                </span>
              )}
              {!collapsed && item.view === "couple-chat" && coupleChatBadge > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-white leading-none">
                  {coupleChatBadge > 9 ? "9+" : coupleChatBadge}
                </span>
              )}
            </button>
            )
          })}
        </div>

        <div className="my-3 h-px bg-sidebar-border" />

        {/* My Chats 섹션 */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {collapsed ? (
            <button
              className="flex w-full items-center justify-center rounded-lg px-0 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={onToggle}
              title="채팅 목록 열기"
            >
              <MessagesSquare className="size-4" />
            </button>
          ) : (
            <>
              <div className="mb-2 flex items-center gap-2 px-1">
                <MessagesSquare className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  My Chats
                </span>
              </div>

              <div className="flex-1 overflow-y-auto">
                {sortedHistory.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground/60">
                    아직 채팅 기록이 없습니다
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {sortedHistory.map((session) => (
                      <ChatHistoryItem
                        key={session.id}
                        session={session}
                        isActive={activeSessionId === session.id}
                        onLoad={onLoadChat}
                        onPin={onPinChat}
                        onDelete={onDeleteChat}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </nav>

      {/* 하단 계정 */}
      <div className="border-t border-sidebar-border p-3">
        <AccountPopover
          userName={groomName}
          userNickname={userNickname}
          collapsed={collapsed}
          onNavigate={onAccountNavigate}
          onLogout={onLogout}
        />
      </div>
    </aside>
  )
}
