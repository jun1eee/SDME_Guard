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
  coupleConnected?: boolean
  userRole?: "groom" | "bride"
}

export function CoupleProfile({
  groomName,
  brideName,
  groomPhoto,
  bridePhoto,
  dDay,
  collapsed = false,
  coupleConnected = false,
  userRole = "groom",
}: CoupleProfileProps) {
  const myName = userRole === "groom" ? groomName : brideName
  const myPhoto = userRole === "groom" ? groomPhoto : bridePhoto
  const partnerName = userRole === "groom" ? brideName : groomName
  const partnerPhoto = userRole === "groom" ? bridePhoto : groomPhoto

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 border-b border-sidebar-border py-4">
        <div className="relative">
          <div className="flex -space-x-2">
            {myPhoto ? (
              <Image src={myPhoto} alt={myName} width={24} height={24}
                className="size-6 rounded-full border-2 border-sidebar object-cover" />
            ) : (
              myName && (
                <div className="flex size-6 items-center justify-center rounded-full border-2 border-sidebar bg-muted text-[10px] font-medium text-muted-foreground">
                  {myName[0]}
                </div>
              )
            )}
            {coupleConnected && (partnerPhoto ? (
              <Image src={partnerPhoto} alt={partnerName} width={24} height={24}
                className="size-6 rounded-full border-2 border-sidebar object-cover" />
            ) : (
              partnerName && (
                <div className="flex size-6 items-center justify-center rounded-full border-2 border-sidebar bg-muted text-[10px] font-medium text-muted-foreground">
                  {partnerName[0]}
                </div>
              )
            ))}
          </div>
          {coupleConnected && (
            <Heart className="absolute -bottom-1 left-1/2 size-3 -translate-x-1/2 fill-primary text-primary" />
          )}
        </div>
        <span className="text-xs font-medium text-primary">D-{dDay}</span>
      </div>
    )
  }

  return (
    <div className="border-b border-sidebar-border p-4">
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          {/* 본인 */}
          <div className="flex flex-col items-center gap-1.5">
            {myPhoto ? (
              <Image src={myPhoto} alt={myName} width={48} height={48}
                className="size-12 rounded-full border-2 border-primary/20 object-cover" />
            ) : (
              myName && (
                <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary/20 bg-muted text-base font-medium text-muted-foreground">
                  {myName[0]}
                </div>
              )
            )}
            <span className="text-sm font-medium text-foreground">{myName}</span>
          </div>

          {coupleConnected && (
            <>
              <Heart className="size-4 fill-primary text-primary" />

              {/* 파트너 */}
              <div className="flex flex-col items-center gap-1.5">
                {partnerPhoto ? (
                  <Image src={partnerPhoto} alt={partnerName} width={48} height={48}
                    className="size-12 rounded-full border-2 border-primary/20 object-cover" />
                ) : (
                  partnerName && (
                    <div className="flex size-12 items-center justify-center rounded-full border-2 border-primary/20 bg-muted text-base font-medium text-muted-foreground">
                      {partnerName[0]}
                    </div>
                  )
                )}
                <span className="text-sm font-medium text-foreground">{partnerName}</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <CalendarDays className="size-4" />
          <span>D-{dDay}</span>
        </div>
      </div>
    </div>
  )
}
