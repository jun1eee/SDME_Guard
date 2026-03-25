"use client"

import { useMemo, useState } from "react"
import { format } from "date-fns"
import { ArrowRight, CalendarIcon, Check, Copy, Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { signup, savePreference, createInviteCode, connectCouple, updateTastes } from "@/lib/api"
import { Sparkles, Palette, Heart as HeartIcon, Utensils } from "lucide-react"

interface SetupScreenProps {
  onComplete: () => void
}

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

function formatWeddingDate(date: Date | undefined) {
  if (!date) return "날짜를 선택해주세요"
  return format(date, "yyyy-MM-dd")
}

export function SetupScreen({ onComplete }: SetupScreenProps) {
  const [name, setName] = useState("")
  const [nickname, setNickname] = useState("")
  const [role, setRole] = useState<"groom" | "bride" | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [inviteCode, setInviteCode] = useState("")
  const [partnerCode, setPartnerCode] = useState("")
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<"send" | "enter">("send")
  const [isLoading, setIsLoading] = useState(false)

  const [weddingDate, setWeddingDate] = useState<Date>()
  const [totalBudget, setTotalBudget] = useState("")
  const [sdmBudget, setSdmBudget] = useState("")
  const [hallBudget, setHallBudget] = useState("")
  const [hallReserved, setHallReserved] = useState<boolean | null>(null)
  const [sdmReserved, setSdmReserved] = useState<boolean | null>(null)
  const [hallStyle, setHallStyle] = useState("")
  const [guestCount, setGuestCount] = useState("")
  const [preferredRegion, setPreferredRegion] = useState("")

  // 취향 선택
  const TASTE_CATEGORIES = [
    { id: "style", title: "웨딩 스타일", icon: <Sparkles className="size-5" />, options: ["클래식", "모던", "빈티지", "가든", "미니멀", "보헤미안"] },
    { id: "color", title: "컬러 테마", icon: <Palette className="size-5" />, options: ["화이트", "골드", "블러쉬핑크", "네이비", "아이보리", "그린"] },
    { id: "mood", title: "분위기", icon: <HeartIcon className="size-5" />, options: ["로맨틱", "우아함", "캐주얼", "럭셔리", "따뜻한", "심플"] },
    { id: "food", title: "식사 선호", icon: <Utensils className="size-5" />, options: ["한식뷔페", "양식코스", "중식", "퓨전", "디저트바", "칵테일"] },
  ]
  const [selectedTastes, setSelectedTastes] = useState<Record<string, string[]>>({
    style: [], color: [], mood: [], food: [],
  })
  const toggleTaste = (categoryId: string, option: string) => {
    setSelectedTastes((prev) => ({
      ...prev,
      [categoryId]: prev[categoryId].includes(option)
        ? prev[categoryId].filter((o) => o !== option)
        : [...prev[categoryId], option],
    }))
  }

  const shouldSkipPreferenceStep = useMemo(() => hallReserved === true, [hallReserved])
  const showProgress = step >= 1
  const isSurveyFlow = step >= 4
  const signupProgressStep = step >= 3 ? 3 : step
  const signupProgressCount = 3
  const surveyProgressStep = step >= 10 ? 6 : step - 3
  const surveyProgressCount = 6

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (partnerCode.trim().length !== 6 || isLoading) return
    setIsLoading(true)
    try {
      await connectCouple(partnerCode.trim())
      onComplete()
    } catch (err: any) {
      console.error("커플 연결 실패:", err)
      const msg = err?.data?.message || err?.message || "커플 연결에 실패했습니다. 코드를 확인해주세요."
      alert(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSkip = () => {
    onComplete()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <img src="/favicon.png" alt="SDME Guard" className="size-9 object-contain" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">SDME Guard</span>
      </div>

      <div className="w-full max-w-sm">
        {showProgress && (
          <div className="mb-8 flex items-center gap-2">
            {Array.from({ length: isSurveyFlow ? surveyProgressCount : signupProgressCount }).map((_, index) => (
              <div
                key={index}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  (isSurveyFlow ? surveyProgressStep : signupProgressStep) >= index + 1 ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
        )}

        {step === 1 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (name.trim()) setStep(2)
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">이름을 입력해주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                서비스에서 사용할 기본 이름입니다.
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
                placeholder="이름 입력"
                autoFocus
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (role) setStep(3)
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">역할을 선택해주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                더 적절한 준비 흐름을 안내하기 위해 필요해요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole("groom")}
                className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                  role === "groom"
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-950/40"
                    : "border-border bg-card hover:border-blue-200 hover:bg-blue-50/50"
                }`}
              >
                <span className="text-4xl">🤵</span>
                <span className={`font-semibold ${role === "groom" ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
                  신랑
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRole("bride")}
                className={`flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all ${
                  role === "bride"
                    ? "border-primary bg-primary/8 dark:bg-primary/15"
                    : "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
                }`}
              >
                <span className="text-4xl">👰</span>
                <span className={`font-semibold ${role === "bride" ? "text-primary" : "text-foreground"}`}>
                  신부
                </span>
              </button>
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
                disabled={!role}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : step === 3 ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (isLoading) return
              setIsLoading(true)
              try {
                await signup({
                  name: name.trim(),
                  role: role === "groom" ? "g" : "b",
                  nickname: nickname.trim() || name.trim(),
                })
                setStep(4)
              } catch (err) {
                console.error("회원가입 실패:", err)
                alert("회원가입에 실패했습니다. 다시 시도해주세요.")
              } finally {
                setIsLoading(false)
              }
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">닉네임을 설정해주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                선택 항목이며, 비워두면 이름이 그대로 사용됩니다.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                닉네임
                <span className="ml-1.5 text-xs text-muted-foreground">(선택)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">@</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder={name.toLowerCase().replace(/\s/g, "")}
                  autoFocus
                  className="w-full rounded-xl border border-border bg-card py-3 pl-8 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                나중에 상대방이 나를 구분할 때 표시되는 이름입니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
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
        ) : step === 4 ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">회원가입이 완료되었습니다!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                회원님의 맞춤형 서비스를 위해 간단한 사전질문에 답해주세요.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card px-4 py-4">
              <p className="text-sm text-muted-foreground">
                입력한 답변은 예산 계획, 웨딩홀 추천, 결혼 준비 흐름 설정에 활용됩니다.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90"
              >
                시작하기
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ) : step === 5 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (weddingDate && totalBudget.trim()) setStep(6)
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">결혼예정일과 총예산을 알려주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                전체 준비 일정과 예산 계획을 위한 기본 정보입니다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  결혼예정일 <span className="text-primary">*</span>
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={`h-11 w-full justify-start rounded-xl text-left font-normal ${
                        !weddingDate ? "text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      <CalendarIcon className="mr-2 size-4" />
                      {formatWeddingDate(weddingDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={weddingDate}
                      onSelect={setWeddingDate}
                      captionLayout="dropdown"
                      disabled={(date) => date < today}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  총예산 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  placeholder="예: 3,000만원"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={!weddingDate || !totalBudget.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : step === 6 ? (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (sdmBudget.trim() && hallBudget.trim()) setStep(7)
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">각각 예산 계획을 알려주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                스튜디오, 드레스, 메이크업에 생각 중인 예산을 입력해주세요.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                스드메 예산 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={sdmBudget}
                onChange={(e) => setSdmBudget(e.target.value)}
                placeholder="예: 150만원 ~ 250만원"
                autoFocus
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-foreground">
                웨딩홀 예산 <span className="text-primary">*</span>
              </label>
              <input
                type="text"
                value={hallBudget}
                onChange={(e) => setHallBudget(e.target.value)}
                placeholder="예: 1,000만원 ~ 1,500만원"
                className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(5)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={!sdmBudget.trim() || !hallBudget.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : step === 7 ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (hallReserved === null || sdmReserved === null || isLoading) return
              if (shouldSkipPreferenceStep) {
                setIsLoading(true)
                try {
                  const parsedTotal = parseInt(totalBudget.replace(/[^0-9]/g, "")) || 0
                  const parsedSdm = parseInt(sdmBudget.replace(/[^0-9]/g, "")) || 0
                  const parsedHall = parseInt(hallBudget.replace(/[^0-9]/g, "")) || 0
                  await savePreference({
                    weddingDate: weddingDate ? format(weddingDate, "yyyy-MM-dd") : "",
                    totalBudget: parsedTotal,
                    sdmBudget: parsedSdm,
                    hallBudget: parsedHall,
                    weddingHallReserved: hallReserved ?? false,
                    sdmReserved: sdmReserved ?? false,
                  })
                  setStep(9)
                } catch (err) {
                  console.error("저장 실패:", err)
                  alert("저장에 실패했습니다. 다시 시도해주세요.")
                } finally {
                  setIsLoading(false)
                }
              } else {
                setStep(8)
              }
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">웨딩홀과 스드메 예약 여부를 알려주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                웨딩홀이 이미 예약되어 있다면 마지막 선호 질문은 생략됩니다.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  웨딩홀 예약 여부 <span className="text-primary">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setHallReserved(true)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      hallReserved === true
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    예약 완료
                  </button>
                  <button
                    type="button"
                    onClick={() => setHallReserved(false)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      hallReserved === false
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    아직 미예약
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-foreground">
                  스드메 예약 여부 <span className="text-primary">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSdmReserved(true)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      sdmReserved === true
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    예약 완료
                  </button>
                  <button
                    type="button"
                    onClick={() => setSdmReserved(false)}
                    className={`rounded-xl border px-4 py-3 text-sm font-medium transition-all ${
                      sdmReserved === false
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                    }`}
                  >
                    아직 미예약
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(6)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={hallReserved === null || sdmReserved === null}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : step === 8 ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault()
              if (!hallStyle.trim() || !guestCount.trim() || !preferredRegion.trim() || isLoading) return
              setIsLoading(true)
              try {
                const parsedTotal = parseInt(totalBudget.replace(/[^0-9]/g, "")) || 0
                const parsedSdm = parseInt(sdmBudget.replace(/[^0-9]/g, "")) || 0
                const parsedHall = parseInt(hallBudget.replace(/[^0-9]/g, "")) || 0
                const parsedGuest = parseInt(guestCount.replace(/[^0-9]/g, "")) || 0
                const regions = preferredRegion.split(",").map((r) => r.trim()).filter(Boolean)
                await savePreference({
                  weddingDate: weddingDate ? format(weddingDate, "yyyy-MM-dd") : "",
                  totalBudget: parsedTotal,
                  sdmBudget: parsedSdm,
                  hallBudget: parsedHall,
                  weddingHallReserved: hallReserved ?? false,
                  sdmReserved: sdmReserved ?? false,
                  hallStyle: hallStyle.trim(),
                  guestCount: parsedGuest,
                  preferredRegions: regions.map((r) => ({ city: r, districts: [] })),
                })
                setStep(9)
              } catch (err) {
                console.error("저장 실패:", err)
                alert("저장에 실패했습니다. 다시 시도해주세요.")
              } finally {
                setIsLoading(false)
              }
            }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-2xl font-bold text-foreground">웨딩홀 선호 조건을 알려주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                웨딩홀과 스드메가 모두 미예약일 때만 표시되는 질문입니다.
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  웨딩홀 선호 스타일 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={hallStyle}
                  onChange={(e) => setHallStyle(e.target.value)}
                  placeholder="예: 호텔식, 채플식, 야외웨딩"
                  autoFocus
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  예상 하객수 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={guestCount}
                  onChange={(e) => setGuestCount(e.target.value)}
                  placeholder="예: 150명"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground">
                  희망 지역 <span className="text-primary">*</span>
                </label>
                <input
                  type="text"
                  value={preferredRegion}
                  onChange={(e) => setPreferredRegion(e.target.value)}
                  placeholder="예: 강남, 수원, 분당"
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(7)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="submit"
                disabled={!hallStyle.trim() || !guestCount.trim() || !preferredRegion.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </form>
        ) : step === 9 ? (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">취향을 선택해주세요</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                원하는 항목을 자유롭게 선택하세요. 마이페이지에서 수정할 수 있습니다.
              </p>
            </div>

            <div className="space-y-5">
              {TASTE_CATEGORIES.map((cat) => (
                <div key={cat.id} className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-primary">{cat.icon}</span>
                    <span className="text-sm font-semibold text-foreground">{cat.title}</span>
                    {selectedTastes[cat.id].length > 0 && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {selectedTastes[cat.id].length}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cat.options.map((opt) => {
                      const selected = selectedTastes[cat.id].includes(opt)
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => toggleTaste(cat.id, opt)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}
                        >
                          {opt}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(shouldSkipPreferenceStep ? 7 : 8)}
                className="flex-1 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                이전
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={async () => {
                  setIsLoading(true)
                  try {
                    await updateTastes({
                      styles: selectedTastes.style,
                      colors: selectedTastes.color,
                      moods: selectedTastes.mood,
                      foods: selectedTastes.food,
                    })
                    const res = await createInviteCode()
                    setInviteCode(res.data.inviteCode)
                    setStep(10)
                  } catch (err) {
                    console.error("취향 저장 실패:", err)
                    // 실패해도 다음 단계로
                    try {
                      const res = await createInviteCode()
                      setInviteCode(res.data.inviteCode)
                    } catch { /* ignore */ }
                    setStep(10)
                  } finally {
                    setIsLoading(false)
                  }
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
              >
                다음
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground">커플 연결하기</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                사전질문이 완료되었어요. 초대 코드를 보내거나 입력해서 상대방과 연결하세요.
              </p>
            </div>

            <div className="flex rounded-xl border border-border p-1">
              <button
                type="button"
                onClick={() => setTab("send")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                  tab === "send" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                코드 보내기
              </button>
              <button
                type="button"
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
                  생성된 초대 코드를 상대방에게 전달하세요.
                </p>
                <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-4 py-4">
                  <span className="flex-1 text-center text-2xl font-bold tracking-[0.3em] text-foreground">
                    {inviteCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background transition-colors hover:bg-muted"
                  >
                    {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4 text-muted-foreground" />}
                  </button>
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  카카오톡이나 메시지로 코드를 공유할 수 있습니다.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  상대방에게 받은 6자리 초대 코드를 입력해주세요.
                </p>
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase().slice(0, 6))}
                  placeholder="XXXXXX"
                  autoFocus
                  maxLength={6}
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-center text-xl font-bold tracking-[0.3em] text-foreground transition-all placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                onClick={() => setStep(9)}
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
        AI 기반 일정 관리로 결혼 준비를 더 차분하게 정리해보세요.
      </p>
    </div>
  )
}
