"use client"

import { useRef, useState } from "react"
import {
  Heart,
  Palette,
  Utensils,
  Sparkles,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Camera,
  Copy,
  Check,
  Link2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"

interface MyPageViewProps {
  groomName: string
  groomNickname?: string
  brideName: string
  brideNickname?: string
  groomPhoto?: string
  bridePhoto?: string
  coupleConnected?: boolean
  myInviteCode?: string
  onCoupleConnect?: () => void
  onUpdateProfile: (data: {
    groomName: string
    brideName: string
    groomNickname?: string
    brideNickname?: string
    groomPhoto?: string
    bridePhoto?: string
  }) => void
  onDeleteAccount?: () => void
}

interface PreferenceSection {
  id: string
  title: string
  icon: React.ReactNode
  selected: string[]
  suggestions: string[]
}

export function MyPageView({
  groomName,
  groomNickname,
  brideName,
  brideNickname,
  groomPhoto,
  bridePhoto,
  coupleConnected = false,
  myInviteCode = "",
  onCoupleConnect,
  onUpdateProfile,
  onDeleteAccount,
}: MyPageViewProps) {
  // ── 회원탈퇴 확인 상태 ────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  // ── 파트너 연결 상태 ──────────────────────────────────────────
  const [connectTab, setConnectTab] = useState<"send" | "enter">("send")
  const [partnerCode, setPartnerCode] = useState("")
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(myInviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConnect = (e: React.FormEvent) => {
    e.preventDefault()
    if (partnerCode.trim().length === 6) {
      onCoupleConnect?.()
      setPartnerCode("")
    }
  }

  // ── 프로필 편집 상태 ──────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [tempGroomName, setTempGroomName] = useState(groomName)
  const [tempGroomNickname, setTempGroomNickname] = useState(groomNickname ?? "")
  const [tempBrideName, setTempBrideName] = useState(brideName)
  const [tempBrideNickname, setTempBrideNickname] = useState(brideNickname ?? "")

  // ── 사진 상태 ─────────────────────────────────────────────────
  const [groomPhotoData, setGroomPhotoData] = useState<string>(groomPhoto ?? "")
  const [bridePhotoData, setBridePhotoData] = useState<string>(bridePhoto ?? "")
  const groomInputRef = useRef<HTMLInputElement>(null)
  const brideInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setter(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = () => {
    onUpdateProfile({
      groomName: tempGroomName,
      brideName: tempBrideName,
      groomNickname: tempGroomNickname,
      brideNickname: tempBrideNickname,
      groomPhoto: groomPhotoData,
      bridePhoto: bridePhotoData,
    })
    setEditing(false)
  }

  // ── 취향 선호도 ───────────────────────────────────────────────
  const [preferences, setPreferences] = useState<PreferenceSection[]>([
    {
      id: "style",
      title: "웨딩 스타일",
      icon: <Sparkles className="size-5" />,
      selected: ["클래식", "모던"],
      suggestions: ["빈티지", "가든", "미니멀", "보헤미안"],
    },
    {
      id: "color",
      title: "컬러 테마",
      icon: <Palette className="size-5" />,
      selected: ["화이트", "골드"],
      suggestions: ["블러쉬핑크", "네이비", "아이보리", "그린"],
    },
    {
      id: "mood",
      title: "분위기",
      icon: <Heart className="size-5" />,
      selected: ["로맨틱", "우아함"],
      suggestions: ["캐주얼", "럭셔리", "따뜻한", "심플"],
    },
    {
      id: "food",
      title: "식사 선호",
      icon: <Utensils className="size-5" />,
      selected: ["한식뷔페", "양식코스"],
      suggestions: ["중식", "퓨전", "디저트바", "칵테일"],
    },
  ])
  const [expandedSections, setExpandedSections] = useState<string[]>(["style", "color"])

  const toggleSection = (id: string) =>
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )

  const addTag = (sectionId: string, tag: string) => {
    setPreferences((prev) =>
      prev.map((section) =>
        section.id === sectionId && !section.selected.includes(tag)
          ? { ...section, selected: [...section.selected, tag], suggestions: section.suggestions.filter((s) => s !== tag) }
          : section
      )
    )
  }

  const removeTag = (sectionId: string, tag: string) => {
    setPreferences((prev) =>
      prev.map((section) =>
        section.id === sectionId
          ? { ...section, selected: section.selected.filter((s) => s !== tag), suggestions: [...section.suggestions, tag] }
          : section
      )
    )
  }

  // ── 추가 정보 ─────────────────────────────────────────────────
  interface AdditionalInfo {
    weddingDate: string
    guestCount: number
    budgetAmount: number
    preferredAreas: string[]
  }
  const AREA_OPTIONS = [
    "서울 강남/서초", "서울 마포/홍대", "서울 종로/중구",
    "서울 강북/노원", "서울 강서/목동", "서울 강동/송파", "서울 기타",
    "경기 북부", "경기 남부", "인천", "부산", "대구", "대전", "광주", "기타",
  ]
  const [info, setInfo] = useState<AdditionalInfo>({
    weddingDate: "2026-08-06",
    guestCount: 200,
    budgetAmount: 5000,
    preferredAreas: ["서울 강남/서초"],
  })
  const [editingInfo, setEditingInfo] = useState(false)
  const [tempInfo, setTempInfo] = useState<AdditionalInfo>(info)

  const displayDate = (d: string) => {
    if (!d) return "미정"
    const dt = new Date(d + "T00:00:00")
    return `${dt.getFullYear()}년 ${dt.getMonth() + 1}월 ${dt.getDate()}일`
  }

  const toggleArea = (area: string) => {
    setTempInfo((p) => ({
      ...p,
      preferredAreas: p.preferredAreas.includes(area)
        ? p.preferredAreas.filter((a) => a !== area)
        : [...p.preferredAreas, area],
    }))
  }

  // ── 아바타 컴포넌트 ───────────────────────────────────────────
  const Avatar = ({
    photoData,
    name,
    inputRef,
    onPhotoChange,
  }: {
    photoData: string
    name: string
    inputRef: React.RefObject<HTMLInputElement | null>
    onPhotoChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  }) => (
    <div className="relative">
      {photoData ? (
        <Image
          src={photoData}
          alt={name}
          width={88}
          height={88}
          className="size-22 rounded-full border-2 border-primary/20 object-cover"
          style={{ width: 88, height: 88 }}
        />
      ) : (
        <div className="flex size-[88px] items-center justify-center rounded-full border-2 border-primary/20 bg-muted text-2xl font-medium text-muted-foreground">
          {name.charAt(0)}
        </div>
      )}
      {/* 히든 파일 인풋 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onPhotoChange}
      />
      {/* 카메라 버튼 */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute bottom-0.5 right-0.5 flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-opacity hover:bg-primary/90"
        title="사진 변경"
      >
        <Camera className="size-3.5" />
      </button>
    </div>
  )

  // ── 렌더 ──────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* 헤더 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">마이페이지</h1>
          <p className="mt-1 text-sm text-muted-foreground">내 정보와 웨딩 취향을 관리하세요</p>
        </div>

        {/* 파트너 연결 카드 - 미연결 상태일 때만 표시 */}
        {!coupleConnected && (
          <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10">
                <Link2 className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">파트너 연결</h2>
                <p className="text-xs text-muted-foreground">초대 코드로 커플을 맺어보세요</p>
              </div>
            </div>

            {/* 탭 */}
            <div className="mb-4 flex rounded-xl border border-border bg-background p-1">
              <button
                onClick={() => setConnectTab("send")}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  connectTab === "send" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                내 초대 코드
              </button>
              <button
                onClick={() => setConnectTab("enter")}
                className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${
                  connectTab === "enter" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                코드 입력
              </button>
            </div>

            {connectTab === "send" ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  아래 코드를 파트너에게 공유하세요
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                  <span className="flex-1 text-center text-lg font-bold tracking-[0.25em] text-foreground">
                    {myInviteCode || "------"}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border transition-colors hover:bg-muted"
                  >
                    {copied
                      ? <Check className="size-3.5 text-primary" />
                      : <Copy className="size-3.5 text-muted-foreground" />
                    }
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConnect} className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  파트너에게 받은 6자리 초대 코드를 입력하세요
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="XXXXXX"
                    maxLength={6}
                    className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-center text-base font-bold tracking-[0.2em] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <button
                    type="submit"
                    disabled={partnerCode.trim().length !== 6}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-40"
                  >
                    <Heart className="size-3.5 fill-white" />
                    연결
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 연결 완료 배너 */}
        {coupleConnected && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 dark:border-green-900 dark:bg-green-950/30">
            <Heart className="size-4 fill-green-500 text-green-500 shrink-0" />
            <p className="text-sm font-medium text-green-700 dark:text-green-400">파트너와 연결되었습니다</p>
          </div>
        )}

        {/* 커플 프로필 카드 */}
        <div className="mb-6 rounded-2xl bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">커플 프로필</h2>
            {editing ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  취소
                </button>
                <button
                  onClick={handleSave}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  저장
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                수정
              </button>
            )}
          </div>

          <div className="flex items-start justify-center gap-10">
            {/* 신랑 */}
            <div className="flex flex-col items-center gap-3">
              <Avatar
                photoData={groomPhotoData}
                name={tempGroomName}
                inputRef={groomInputRef}
                onPhotoChange={(e) => handlePhotoChange(e, setGroomPhotoData)}
              />
              {editing ? (
                <div className="flex w-28 flex-col gap-1.5">
                  <Input
                    value={tempGroomName}
                    onChange={(e) => setTempGroomName(e.target.value)}
                    className="h-8 text-center text-sm"
                    placeholder="이름"
                  />
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">@</span>
                    <Input
                      value={tempGroomNickname}
                      onChange={(e) => setTempGroomNickname(e.target.value)}
                      className="h-7 pl-6 text-center text-xs"
                      placeholder="닉네임"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-medium text-foreground">{tempGroomName}</p>
                  {tempGroomNickname && (
                    <p className="text-xs text-muted-foreground">@{tempGroomNickname}</p>
                  )}
                </div>
              )}
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">신랑</span>
            </div>

            {/* 하트 */}
            <div className="mt-8">
              <Heart className="size-6 fill-primary text-primary" />
            </div>

            {/* 신부 */}
            <div className="flex flex-col items-center gap-3">
              <Avatar
                photoData={bridePhotoData}
                name={tempBrideName}
                inputRef={brideInputRef}
                onPhotoChange={(e) => handlePhotoChange(e, setBridePhotoData)}
              />
              {editing ? (
                <div className="flex w-28 flex-col gap-1.5">
                  <Input
                    value={tempBrideName}
                    onChange={(e) => setTempBrideName(e.target.value)}
                    className="h-8 text-center text-sm"
                    placeholder="이름"
                  />
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">@</span>
                    <Input
                      value={tempBrideNickname}
                      onChange={(e) => setTempBrideNickname(e.target.value)}
                      className="h-7 pl-6 text-center text-xs"
                      placeholder="닉네임"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <p className="font-medium text-foreground">{tempBrideName}</p>
                  {tempBrideNickname && (
                    <p className="text-xs text-muted-foreground">@{tempBrideNickname}</p>
                  )}
                </div>
              )}
              <span className="rounded-full bg-primary/10 px-3 py-0.5 text-xs font-medium text-primary">신부</span>
            </div>
          </div>

          {editing && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              📷 카메라 버튼을 눌러 사진을 변경할 수 있습니다
            </p>
          )}
        </div>

        {/* 취향 & 선호도 카드 */}
        <div className="mb-6 rounded-2xl bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-foreground">취향 & 선호도</h2>
          <div className="space-y-4">
            {preferences.map((section) => {
              const isExpanded = expandedSections.includes(section.id)
              return (
                <div key={section.id} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex w-full items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-primary">{section.icon}</span>
                      <span className="font-semibold text-primary">{section.title}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {section.selected.length}개
                      </span>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-5 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {section.selected.map((tag) => (
                          <span
                            key={tag}
                            className="flex items-center gap-1 rounded-full bg-foreground px-3 py-1.5 text-sm font-medium text-background"
                          >
                            {tag}
                            <button onClick={() => removeTag(section.id, tag)} className="ml-1 hover:text-red-300">
                              <X className="size-3" />
                            </button>
                          </span>
                        ))}
                        <button className="flex items-center gap-1 rounded-full border-2 border-dashed border-muted-foreground px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                          <Plus className="size-3" />
                          추가
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {section.suggestions.map((tag) => (
                          <button
                            key={tag}
                            onClick={() => addTag(section.id, tag)}
                            className="rounded-full border border-dashed border-muted-foreground px-3 py-1 text-sm text-muted-foreground hover:border-primary hover:text-primary"
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 추가 정보 */}
        <div className="rounded-2xl bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">추가 정보</h2>
            {editingInfo ? (
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingInfo(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted"
                >
                  취소
                </button>
                <button
                  onClick={() => { setInfo(tempInfo); setEditingInfo(false) }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  저장
                </button>
              </div>
            ) : (
              <button
                onClick={() => { setTempInfo(info); setEditingInfo(true) }}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                수정
              </button>
            )}
          </div>

          <div className="divide-y divide-border">
            {/* 결혼 예정일 */}
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground">결혼 예정일</span>
              {editingInfo ? (
                <input
                  type="date"
                  value={tempInfo.weddingDate}
                  onChange={(e) => setTempInfo((p) => ({ ...p, weddingDate: e.target.value }))}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              ) : (
                <span className="text-sm font-medium text-foreground">{displayDate(info.weddingDate)}</span>
              )}
            </div>

            {/* 예상 하객 수 */}
            <div className="flex items-center justify-between py-3.5">
              <span className="text-sm text-muted-foreground">예상 하객 수</span>
              {editingInfo ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setTempInfo((p) => ({ ...p, guestCount: Math.max(10, p.guestCount - 10) }))}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted text-base font-bold"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    value={tempInfo.guestCount}
                    onChange={(e) => setTempInfo((p) => ({ ...p, guestCount: Math.max(10, parseInt(e.target.value) || 10) }))}
                    className="h-8 w-16 rounded-lg border border-border bg-background text-center text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    min={10}
                    step={10}
                  />
                  <button
                    type="button"
                    onClick={() => setTempInfo((p) => ({ ...p, guestCount: p.guestCount + 10 }))}
                    className="flex size-7 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted text-base font-bold"
                  >
                    +
                  </button>
                  <span className="text-sm text-muted-foreground">명</span>
                </div>
              ) : (
                <span className="text-sm font-medium text-foreground">{info.guestCount.toLocaleString("ko-KR")}명</span>
              )}
            </div>

            {/* 스드메·홀 예산 */}
            <div className="py-3.5">
              <div className="mb-1 flex items-center justify-between">
                <div>
                  <span className="text-sm text-muted-foreground">스드메 + 홀 예산</span>
                </div>
                {editingInfo ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={tempInfo.budgetAmount}
                      onChange={(e) => setTempInfo((p) => ({ ...p, budgetAmount: Math.max(1, parseInt(e.target.value) || 1) }))}
                      className="h-8 w-24 rounded-lg border border-border bg-background px-2 text-right text-sm font-medium text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      min={1}
                    />
                    <span className="text-sm text-muted-foreground">만원</span>
                  </div>
                ) : (
                  <span className="text-sm font-medium text-foreground">
                    {info.budgetAmount.toLocaleString("ko-KR")}만원
                  </span>
                )}
              </div>
            </div>

            {/* 선호 지역 */}
            <div className="py-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">선호 지역</span>
                {!editingInfo && (
                  <div className="flex flex-wrap justify-end gap-1 max-w-[60%]">
                    {info.preferredAreas.length > 0 ? info.preferredAreas.map((a) => (
                      <span key={a} className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{a}</span>
                    )) : (
                      <span className="text-sm font-medium text-muted-foreground">미설정</span>
                    )}
                  </div>
                )}
              </div>
              {editingInfo && (
                <div className="flex flex-wrap gap-1.5">
                  {AREA_OPTIONS.map((area) => {
                    const selected = tempInfo.preferredAreas.includes(area)
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleArea(area)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                        }`}
                      >
                        {area}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 회원탈퇴 */}
        <div className="mt-10 border-t border-border pt-6">
          {!deleteConfirm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">회원탈퇴</p>
                <p className="mt-0.5 text-xs text-muted-foreground/60">탈퇴 시 모든 데이터가 삭제됩니다</p>
              </div>
              <button
                onClick={() => setDeleteConfirm(true)}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
              >
                탈퇴하기
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-muted/30 p-5">
              <p className="mb-1 text-sm font-medium text-foreground">정말 탈퇴하시겠어요?</p>
              <p className="mb-4 text-xs text-muted-foreground">
                커플 연결 정보, 채팅 기록, 즐겨찾기 등 모든 데이터가 영구 삭제됩니다.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(false)}
                  className="flex-1 rounded-xl border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    setDeleteConfirm(false)
                    onDeleteAccount?.()
                  }}
                  className="flex-1 rounded-xl border border-border bg-background py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                >
                  탈퇴 확인
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
