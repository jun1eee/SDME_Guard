"use client"

import { useState } from "react"
import {
  Heart,
  CreditCard,
  CalendarCheck,
  Star,
  LogOut,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AccountPopoverProps {
  userName: string
  userNickname?: string
  collapsed: boolean
  onNavigate: (view: string) => void
  onLogout: () => void
}

interface MenuItem {
  icon: React.ReactNode
  label: string
  action: string
  danger?: boolean
}

export function AccountPopover({
  userName,
  userNickname,
  collapsed,
  onNavigate,
  onLogout,
}: AccountPopoverProps) {
  const handle = userNickname
    ? userNickname.toLowerCase().replace(/\s/g, "")
    : userName.toLowerCase().replace(/\s/g, "")
  const [open, setOpen] = useState(false)

  const menuItems: MenuItem[] = [
    { icon: <Heart className="size-4" />, label: "찜목록", action: "wishlist" },
    { icon: <CreditCard className="size-4" />, label: "결제내역", action: "payment" },
    { icon: <CalendarCheck className="size-4" />, label: "예약관리", action: "reservation" },
    { icon: <Star className="size-4" />, label: "리뷰관리", action: "reviews" },
  ]

  const handleItemClick = (action: string) => {
    setOpen(false)
    onNavigate(action)
  }

  const handleLogout = () => {
    setOpen(false)
    onLogout()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-3 text-sm transition-colors",
            "hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          {/* Avatar */}
          <div className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
            {userName.charAt(0)}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 text-left">
                <p className="font-medium text-sidebar-foreground">{userName}</p>
              </div>
              <ChevronUp className={cn(
                "size-4 text-muted-foreground transition-transform",
                open && "rotate-180"
              )} />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0"
        side={collapsed ? "right" : "top"}
        align={collapsed ? "end" : "start"}
        sideOffset={8}
      >
        {/* User Info Header — 클릭 시 마이페이지 이동 */}
        <button
          className="w-full border-b border-border p-4 text-left transition-colors hover:bg-muted/50"
          onClick={() => handleItemClick("my-page")}
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground">@{handle}</p>
            </div>
            <span className="text-xs text-muted-foreground">마이페이지 →</span>
          </div>
        </button>

        {/* Menu Items */}
        <div className="p-2">
          {menuItems.map((item) => (
            <button
              key={item.action}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
              onClick={() => handleItemClick(item.action)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-2 h-px bg-border" />

        {/* Logout */}
        <div className="p-2">
          <button
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="size-4" />
            <span>로그아웃</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
