'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function MatchPage() {
  const router = useRouter()
  const [partnerPhone, setPartnerPhone] = React.useState('')
  const [sent, setSent] = React.useState(false)

  const isValidPhone = /^01[0-9]{8,9}$/.test(partnerPhone)

  const handleInvite = () => {
    if (!isValidPhone) return
    // TODO: POST /api/couples/match { phone: partnerPhone }
    setSent(true)
  }

  const handleSkip = () => {
    router.push('/')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-10">
        {/* 타이틀 */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-secondary">
            <span className="text-3xl">💍</span>
          </div>
          <h2 className="font-serif text-2xl">배우자 매칭</h2>
          <p className="text-sm text-muted-foreground">
            상대방의 휴대폰 번호를 입력하면 초대 링크가 발송됩니다
          </p>
        </div>

        {/* 전화번호 입력 */}
        <div className="rounded-2xl border border-border/50 p-6 space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">
            상대방 휴대폰 번호
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="01012345678"
              value={partnerPhone}
              onChange={(e) => setPartnerPhone(e.target.value.replace(/\D/g, ''))}
              maxLength={11}
              className="rounded-xl h-11 flex-1"
              disabled={sent}
            />
            <Button
              className="rounded-xl h-11 shrink-0 px-6"
              onClick={handleInvite}
              disabled={!isValidPhone || sent}
            >
              초대하기
            </Button>
          </div>
          {sent && (
            <p className="text-sm text-green-600 font-medium">
              초대 링크가 발송되었습니다.
            </p>
          )}
        </div>

        {/* 건너뛰기 */}
        <Button
          variant="ghost"
          className="w-full rounded-full h-12 text-muted-foreground"
          onClick={handleSkip}
        >
          나중에 할게요
        </Button>
      </div>
    </div>
  )
}
