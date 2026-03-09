"use client"

import { useState } from "react"
import { Heart, ArrowRight, Copy, Check } from "lucide-react"

interface SetupScreenProps {
  onComplete: (name: string, nickname: string, coupleConnected: boolean, inviteCode: string) => void
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [name, setName] = useState("")
  const [nickname, setNickname] = useState("")
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [inviteCode] = useState(generateCode)
  const [partnerCode, setPartnerCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<"send" | "enter">("send")

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) setStep(2)
  }

  const handleStep2 = (e: React.FormEvent) => {
    e.preventDefault()
    setStep(3)
  }

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault()
    if (partnerCode.trim().length === 6) {
      onComplete(name.trim(), nickname.trim() || name.trim(), true, inviteCode)
    }
  }

  const handleSkip = () => {
    onComplete(name.trim(), nickname.trim() || name.trim(), false, inviteCode)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      {/* 브랜드 */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Heart className="size-7 fill-primary text-primary" />
        </div>
        <span className="text-lg font-semibold text-foreground tracking-tight">SDME Guard</span>
      </div>

      <div className="w-full max-w-sm">
        {/* 진행 표시 */}
        <div className="mb-8 flex items-center gap-2">
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step >= 3 ? "bg-primary" : "bg-muted"}`} />
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">안녕하세요!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                웨딩 플래너를 시작하기 위해 이름을 알려주세요
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                이름 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                autoFocus
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
            >
              다음
              <ArrowRight className="size-4" />
            </button>
          </form>
        ) : step === 2 ? (
          <form onSubmit={handleStep2} className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">반가워요, {name}님!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                서비스에서 사용할 닉네임을 설정해주세요
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                닉네임
                <span className="ml-1.5 text-xs text-muted-foreground">(선택사항)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={name.toLowerCase().replace(/\s/g, "")}
                  autoFocus
                  className="w-full rounded-xl border border-border bg-card py-3 pl-8 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                미입력 시 이름이 닉네임으로 사용됩니다
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="submit"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">파트너 연결</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                상대방과 초대 코드를 공유해 커플로 연결하세요
              </p>
            </div>

            {/* 탭 */}
            <div className="flex rounded-xl border border-border p-1">
              <button
                onClick={() => setTab("send")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === "send" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                초대 코드 공유
              </button>
              <button
                onClick={() => setTab("enter")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === "enter" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                코드 입력
              </button>
            </div>

            {tab === "send" ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  아래 코드를 파트너에게 공유하세요. 파트너가 코드를 입력하면 연결됩니다.
                </p>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-4">
                  <span className="flex-1 text-center text-2xl font-bold tracking-[0.3em] text-foreground">
                    {inviteCode}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted"
                  >
                    {copied
                      ? <Check className="size-4 text-primary" />
                      : <Copy className="size-4 text-muted-foreground" />
                    }
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  파트너가 코드를 입력하면 자동으로 연결됩니다
                </p>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  파트너에게 받은 6자리 초대 코드를 입력하세요.
                </p>
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="XXXXXX"
                  autoFocus
                  maxLength={6}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-center text-xl font-bold tracking-[0.3em] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="submit"
                  disabled={partnerCode.trim().length !== 6}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
                >
                  연결하기
                  <Heart className="size-4 fill-white" />
                </button>
              </form>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                나중에 연결
              </button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        AI가 함께하는 스마트 웨딩 플래닝
      </p>
    </div>
  )
}
