"use client"

import { Calendar, DollarSign, Heart, Gem } from "lucide-react"

interface ChatHeaderProps {
  groomName: string
  brideName: string
  dDay: number
  budget: number
  weddingStyle: string
}

export function ChatHeader({ groomName, brideName, dDay, budget, weddingStyle }: ChatHeaderProps) {
  const formatBudget = (amount: number) => {
    return new Intl.NumberFormat("ko-KR").format(amount)
  }

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm">
      <div className="mx-auto max-w-3xl px-4 py-4">
        {/* Main Title */}
        <div className="mb-3 text-center">
          <h1 className="text-xl font-semibold text-foreground">SDME Guard</h1>
          <p className="text-sm text-muted-foreground">AI Wedding Planner</p>
        </div>

        {/* Couple Display */}
        <div className="mb-3 flex items-center justify-center gap-2">
          <span className="text-lg font-medium text-primary">{groomName}</span>
          <Heart className="size-4 fill-primary text-primary" />
          <span className="text-lg font-medium text-primary">{brideName}</span>
        </div>

        {/* Info Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">D-{dDay}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <DollarSign className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{"₩"}{formatBudget(budget)}</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5">
            <Gem className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{weddingStyle}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
