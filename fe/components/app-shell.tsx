"use client"

import { useState } from "react"
import { Sparkles, Store, CalendarDays, Wallet, UserCircle, Menu, X, UserCog, Heart, Star, CreditCard, ClipboardList, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"

type SubPage = "main" | "edit-profile" | "favorites" | "payments" | "reservations" | "my-reviews" | "my-cards"

interface AppShellProps {
  activeTab: string
  onTabChange: (tab: string) => void
  children: React.ReactNode
  onNavigateMyPageSub?: (page: SubPage) => void
}

const tabs = [
  { id: "budget", label: "예산", icon: Wallet },
  { id: "vendors", label: "업체", icon: Store },
  { id: "chat", label: "AI", icon: Sparkles },
  { id: "calendar", label: "일정", icon: CalendarDays },
  { id: "mypage", label: "MY", icon: UserCircle },
]

function HamburgerMenu({ onNavigate, onClose, onTabChange }: {
  onNavigate: (page: SubPage) => void
  onClose: () => void
  onTabChange: (tab: string) => void
}) {
  const menuItems: { icon: React.ElementType; label: string; page: SubPage }[] = [
    { icon: UserCog, label: "내 정보 수정", page: "edit-profile" },
    { icon: Heart, label: "찜 목록", page: "favorites" },
    { icon: Wallet, label: "나의 업체별 결제 내역", page: "payments" },
    { icon: ClipboardList, label: "예약 관리", page: "reservations" },
    { icon: Star, label: "리뷰 관리", page: "my-reviews" },
    { icon: CreditCard, label: "내 카드 등록", page: "my-cards" },
  ]

  return (
    <div className="fixed inset-0 z-[60] animate-in fade-in duration-200" onClick={onClose}>
      <div className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" />
      <div className="absolute top-0 right-0 h-full w-72 bg-background border-l border-border/50 shadow-2xl animate-in slide-in-from-right duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <span className="text-sm font-medium">메뉴</span>
          <button onClick={onClose} className="size-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors" aria-label="메뉴 닫기"><X className="size-4" /></button>
        </div>
        <div className="flex flex-col py-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.page}
                onClick={() => {
                  onTabChange("mypage")
                  onNavigate(item.page)
                  onClose()
                }}
                className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-secondary transition-colors text-left"
              >
                <Icon className="size-4 text-muted-foreground" />{item.label}
              </button>
            )
          })}
        </div>
        <div className="border-t border-border/50 mt-auto">
          <button className="flex items-center gap-3 px-5 py-3.5 text-sm text-destructive hover:bg-secondary transition-colors w-full text-left">
            <LogOut className="size-4" />로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppShell({ activeTab, onTabChange, children, onNavigateMyPageSub }: AppShellProps) {
  const [showMenu, setShowMenu] = useState(false)

  return (
    <div className="flex flex-col min-h-[100dvh] max-w-lg mx-auto bg-background relative">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-6 py-4">
          <h1 className="font-serif text-xl tracking-tight">Sudme Gaurd</h1>
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-muted-foreground tracking-widest uppercase">AI 웨딩 플래너</span>
            <button onClick={() => setShowMenu(true)} className="size-9 rounded-full hover:bg-secondary flex items-center justify-center transition-colors" aria-label="메뉴">
              <Menu className="size-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        {children}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 bg-background/80 backdrop-blur-xl border-t border-border/50">
        <div className="flex items-center justify-around px-1 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            const isCenter = tab.id === "chat"
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 relative",
                  isCenter && isActive ? "bg-foreground text-background scale-105"
                    : isCenter && !isActive ? "bg-foreground/10 text-foreground"
                    : isActive ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label={tab.label}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={cn("size-5", isCenter && "size-[22px]")} strokeWidth={isActive ? 2 : 1.5} />
                <span className="text-[10px] font-medium tracking-wide">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      {/* Global Hamburger Menu */}
      {showMenu && (
        <HamburgerMenu
          onNavigate={(page) => { if (onNavigateMyPageSub) onNavigateMyPageSub(page) }}
          onClose={() => setShowMenu(false)}
          onTabChange={onTabChange}
        />
      )}
    </div>
  )
}
