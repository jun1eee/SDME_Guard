"use client"

import { 
  X, 
  Settings, 
  Heart, 
  Receipt, 
  CalendarCheck, 
  Star, 
  CreditCard, 
  LogOut 
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface MenuDrawerProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (view: string) => void
}

export function MenuDrawer({ isOpen, onClose, onNavigate }: MenuDrawerProps) {
  const menuItems = [
    { icon: Settings, label: "내 정보 수정", view: "my-page" },
    { icon: Heart, label: "찜 목록", view: "favorites" },
    { icon: Receipt, label: "나의 업체별 결제 내역", view: "payments" },
    { icon: CalendarCheck, label: "예약 관리", view: "reservations" },
    { icon: Star, label: "리뷰 관리", view: "reviews" },
    { icon: CreditCard, label: "내 카드 등록", view: "cards" },
  ]

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40 bg-black/50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-80 bg-card shadow-xl">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-lg font-semibold text-foreground">메뉴</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="size-5" />
            </Button>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 px-4 py-6">
            <div className="space-y-1">
              {menuItems.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    onNavigate(item.view)
                    onClose()
                  }}
                  className="flex w-full items-center gap-4 rounded-lg px-4 py-4 text-left text-foreground transition-colors hover:bg-muted"
                >
                  <item.icon className="size-5 text-muted-foreground" />
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </nav>

          {/* Logout */}
          <div className="border-t border-border px-4 py-4">
            <button
              onClick={() => {
                // Handle logout
                onClose()
              }}
              className="flex w-full items-center gap-4 rounded-lg px-4 py-4 text-left text-red-500 transition-colors hover:bg-red-50"
            >
              <LogOut className="size-5" />
              <span className="font-medium">로그아웃</span>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
