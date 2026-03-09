"use client"

import { Heart, CalendarDays } from "lucide-react"
import Image from "next/image"

interface CoupleProfileProps {
  groomName: string
  brideName: string
  groomPhoto?: string
  bridePhoto?: string
  dDay: number
  collapsed?: boolean
}

export function CoupleProfile({
  groomName,
  brideName,
  groomPhoto,
  bridePhoto,
  dDay,
  collapsed = false,
}: CoupleProfileProps) {

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 border-b border-sidebar-border py-4">
        <div className="relative">
          <div className="flex -space-x-2">
            {groomPhoto ? (
              <Image
                src={groomPhoto}
                alt={groomName}
                width={24}
                height={24}
                className="size-6 rounded-full border-2 border-sidebar object-cover"
              />
            ) : (
              <div className="flex size-6 items-center justify-center rounded-full border-2 border-sidebar bg-muted text-[10px] font-medium text-muted-foreground">
                {groomName[0]}
              </div>
            )}
            {bridePhoto ? (
              <Image
                src={bridePhoto}
                alt={brideName}
                width={24}
                height={24}
                className="size-6 rounded-full border-2 border-sidebar object-cover"
              />
            ) : (
              <div className="flex size-6 items-center justify-center rounded-full border-2 border-sidebar bg-muted text-[10px] font-medium text-muted-foreground">
                {brideName[0]}
              </div>
            )}
          </div>
          <Heart className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 fill-primary text-primary" />
        </div>
        <span className="text-xs font-medium text-primary">D-{dDay}</span>
      </div>
    )
  }

  return (
    <div className="border-b border-sidebar-border p-4">
      <div className="flex flex-col items-center gap-3">
        {/* Couple Photos */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-center gap-1.5">
            {groomPhoto ? (
              <Image
                src={groomPhoto}
                alt={groomName}
                width={48}
                height={48}
                className="size-12 rounded-full border-2 border-primary/20 object-cover"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary/20 bg-muted text-base font-medium text-muted-foreground">
                {groomName[0]}
              </div>
            )}
            <span className="text-sm font-medium text-foreground">{groomName}</span>
          </div>
          
          <Heart className="size-4 fill-primary text-primary" />
          
          <div className="flex flex-col items-center gap-1.5">
            {bridePhoto ? (
              <Image
                src={bridePhoto}
                alt={brideName}
                width={48}
                height={48}
                className="size-12 rounded-full border-2 border-primary/20 object-cover"
              />
            ) : (
              <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary/20 bg-muted text-base font-medium text-muted-foreground">
                {brideName[0]}
              </div>
            )}
            <span className="text-sm font-medium text-foreground">{brideName}</span>
          </div>
        </div>

        {/* D-Day Badge Only */}
        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <CalendarDays className="size-4" />
          <span>D-{dDay}</span>
        </div>
      </div>
    </div>
  )
}
