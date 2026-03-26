"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import { getPreference, getCouplePreferences, updateTastes, updateSharedInfo, disconnectCouple, withdraw, editUser, getCards, deleteCard, getTossClientKey, registerCard, getMcpToken, refreshMcpToken, uploadProfileImage, updateBudgetTotal } from "@/lib/api"
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
  CreditCard,
  Trash2,
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
  userRole?: "groom" | "bride"
  onCoupleConnect?: (inviteCode: string) => void
  onUpdateProfile: (data: {
    groomName: string
    brideName: string
    groomNickname?: string
    brideNickname?: string
    groomPhoto?: string
    bridePhoto?: string
  }) => void
  onDeleteAccount?: () => void
  onCoupleDisconnect?: () => void
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
  userRole = "groom",
  onCoupleConnect,
  onUpdateProfile,
  onDeleteAccount,
  onCoupleDisconnect,
}: MyPageViewProps) {
  // ── 커플 해제 / 회원탈퇴 확인 상태 ──────────────────────────
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)
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
      onCoupleConnect?.(partnerCode.trim())
      setPartnerCode("")
    }
  }

  // ── 프로필 편집 상태 ──────────────────────────────────────────
  const [editing, setEditing] = useState(false)
  const [tempGroomName, setTempGroomName] = useState(groomName)
  const [tempGroomNickname, setTempGroomNickname] = useState(groomNickname ?? "")
  const [tempBrideName, setTempBrideName] = useState(brideName)
  const [tempBrideNickname, setTempBrideNickname] = useState(brideNickname ?? "")

  // props 변경 시 동기화 (커플 매칭 후 즉시 반영)
  useEffect(() => {
    setTempGroomName(groomName)
    setTempGroomNickname(groomNickname ?? "")
    setTempBrideName(brideName)
    setTempBrideNickname(brideNickname ?? "")
  }, [groomName, groomNickname, brideName, brideNickname])

  // ── 사진 상태 ─────────────────────────────────────────────────
  const [groomPhotoData, setGroomPhotoData] = useState<string>(groomPhoto ?? "")
  const [bridePhotoData, setBridePhotoData] = useState<string>(bridePhoto ?? "")
  const groomInputRef = useRef<HTMLInputElement>(null)
  const brideInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (v: string) => void
  ) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await uploadProfileImage(file)
      if (res.data) {
        setter(res.data)
      }
    } catch {
      // 업로드 실패 시 로컬 미리보기로 폴백
      const reader = new FileReader()
      reader.onload = (ev) => setter(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    const newNickname = userRole === "groom" ? tempGroomNickname : tempBrideNickname
    try {
      await editUser({ nickname: newNickname })
    } catch {
      alert("닉네임 수정에 실패했습니다.")
    }
    setEditing(false)
  }

  // ── 선호도 보기 대상 (내 것 / 파트너) ────────────────────────
  const [viewingTarget, setViewingTarget] = useState<"groom" | "bride">(userRole)
  const isViewingMyOwn = viewingTarget === userRole
  const [partnerPreferences, setPartnerPreferences] = useState<PreferenceSection[] | null>(null)

  // ── 취향 선호도 ───────────────────────────────────────────────
  const ALL_SUGGESTIONS: Record<string, string[]> = {
    style: ["클래식", "모던", "빈티지", "가든", "미니멀", "보헤미안"],
    color: ["화이트", "골드", "블러쉬핑크", "네이비", "아이보리", "그린"],
    mood: ["로맨틱", "우아함", "캐주얼", "럭셔리", "따뜻한", "심플"],
    food: ["한식뷔페", "양식코스", "중식", "퓨전", "디저트바", "칵테일"],
  }

  const buildPreferences = useCallback((styles: string[], colors: string[], moods: string[], foods: string[]): PreferenceSection[] => [
    {
      id: "style",
      title: "웨딩 스타일",
      icon: <Sparkles className="size-5" />,
      selected: styles,
      suggestions: ALL_SUGGESTIONS.style.filter(s => !styles.includes(s)),
    },
    {
      id: "color",
      title: "컬러 테마",
      icon: <Palette className="size-5" />,
      selected: colors,
      suggestions: ALL_SUGGESTIONS.color.filter(s => !colors.includes(s)),
    },
    {
      id: "mood",
      title: "분위기",
      icon: <Heart className="size-5" />,
      selected: moods,
      suggestions: ALL_SUGGESTIONS.mood.filter(s => !moods.includes(s)),
    },
    {
      id: "food",
      title: "식사 선호",
      icon: <Utensils className="size-5" />,
      selected: foods,
      suggestions: ALL_SUGGESTIONS.food.filter(s => !foods.includes(s)),
    },
  ], [])

  const [preferences, setPreferences] = useState<PreferenceSection[]>(() => buildPreferences([], [], [], []))
  const [expandedSections, setExpandedSections] = useState<string[]>(["style", "color"])

  // API에서 선호도 불러오기
  useEffect(() => {
    getPreference()
      .then((res) => {
        const d = res.data
        setPreferences(buildPreferences(
          d.styles ?? [], d.colors ?? [], d.moods ?? [], d.foods ?? []
        ))
        setInfo({
          weddingDate: d.weddingDate || "",
          guestCount: d.guestCount ?? 0,
          budgetAmount: d.totalBudget ?? 0,
          preferredAreas: d.preferredRegions
            ? d.preferredRegions.map((r: { city: string; districts: string[] }) =>
                r.districts?.length ? `${r.city} ${r.districts[0]}` : r.city
              )
            : [],
        })
      })
      .catch(() => {})
  }, [buildPreferences])

  // 파트너 선호도 불러오기
  const loadPartnerPreference = useCallback(() => {
    if (partnerPreferences) return // 이미 로드됨
    getCouplePreferences()
      .then((res) => {
        const partner = userRole === "groom" ? res.data.bride : res.data.groom
        setPartnerPreferences(buildPreferences(
          partner.styles ?? [], partner.colors ?? [], partner.moods ?? [], partner.foods ?? []
        ))
      })
      .catch(() => {
        setPartnerPreferences(buildPreferences([], [], [], []))
      })
  }, [partnerPreferences, buildPreferences, userRole])

  const handleSelectTarget = (target: "groom" | "bride") => {
    setViewingTarget(target)
    if (target !== userRole) {
      loadPartnerPreference()
    }
  }

  const displayPreferences = isViewingMyOwn ? preferences : (partnerPreferences ?? preferences)

  const toggleSection = (id: string) =>
    setExpandedSections((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )

  const saveTastes = (updated: PreferenceSection[]) => {
    const find = (id: string) => updated.find(s => s.id === id)?.selected ?? []
    const payload = {
      styles: find("style"),
      colors: find("color"),
      moods: find("mood"),
      foods: find("food"),
    }
    console.log("[saveTastes] 저장 요청:", payload)
    updateTastes(payload)
      .then((res) => console.log("[saveTastes] 저장 성공:", res))
      .catch((err) => console.error("[saveTastes] 저장 실패:", err))
  }

  const addTag = (sectionId: string, tag: string) => {
    setPreferences((prev) => {
      const updated = prev.map((section) =>
        section.id === sectionId && !section.selected.includes(tag)
          ? { ...section, selected: [...section.selected, tag], suggestions: section.suggestions.filter((s) => s !== tag) }
          : section
      )
      saveTastes(updated)
      return updated
    })
  }

  const removeTag = (sectionId: string, tag: string) => {
    setPreferences((prev) => {
      const updated = prev.map((section) =>
        section.id === sectionId
          ? { ...section, selected: section.selected.filter((s) => s !== tag), suggestions: [...section.suggestions, tag] }
          : section
      )
      saveTastes(updated)
      return updated
    })
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
    weddingDate: "",
    guestCount: 0,
    budgetAmount: 0,
    preferredAreas: [],
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

        {/* 프로필 카드 */}
        <div className="mb-6 rounded-2xl bg-card p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">{coupleConnected ? "커플 프로필" : "내 프로필"}</h2>
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
            {/* 본인 프로필 (항상 표시) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => !editing && coupleConnected && handleSelectTarget(userRole)}
              onKeyDown={(e) => e.key === "Enter" && !editing && coupleConnected && handleSelectTarget(userRole)}
              className={`flex flex-col items-center gap-3 rounded-2xl p-3 transition-all ${
                !editing && coupleConnected && viewingTarget === userRole
                  ? "bg-primary/5 ring-2 ring-primary/30"
                  : !editing && coupleConnected ? "hover:bg-muted/50 cursor-pointer" : ""
              }`}
            >
              <Avatar
                photoData={userRole === "groom" ? groomPhotoData : bridePhotoData}
                name={userRole === "groom" ? tempGroomName : tempBrideName}
                inputRef={userRole === "groom" ? groomInputRef : brideInputRef}
                onPhotoChange={(e) => handlePhotoChange(e, userRole === "groom" ? setGroomPhotoData : setBridePhotoData)}
              />
              <div className="text-center">
                <p className="font-medium text-foreground">{userRole === "groom" ? tempGroomName : tempBrideName}</p>
                {editing ? (
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">@</span>
                    <Input
                      value={userRole === "groom" ? tempGroomNickname : tempBrideNickname}
                      onChange={(e) => (userRole === "groom" ? setTempGroomNickname : setTempBrideNickname)(e.target.value)}
                      className="h-7 w-28 pl-6 text-center text-xs"
                      placeholder="닉네임"
                    />
                  </div>
                ) : (
                  (userRole === "groom" ? tempGroomNickname : tempBrideNickname) && (
                    <p className="text-xs text-muted-foreground">@{userRole === "groom" ? tempGroomNickname : tempBrideNickname}</p>
                  )
                )}
              </div>
              <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                userRole === "groom"
                  ? (viewingTarget === "groom" ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-600")
                  : (viewingTarget === "bride" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")
              }`}>{userRole === "groom" ? "신랑" : "신부"}</span>
            </div>

            {/* 파트너 프로필 (매칭 후에만 표시) */}
            {coupleConnected && (
              <>
                <div className="mt-8">
                  <Heart className="size-6 fill-primary text-primary" />
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => !editing && handleSelectTarget(userRole === "groom" ? "bride" : "groom")}
                  onKeyDown={(e) => e.key === "Enter" && !editing && handleSelectTarget(userRole === "groom" ? "bride" : "groom")}
                  className={`flex flex-col items-center gap-3 rounded-2xl p-3 transition-all ${
                    !editing && viewingTarget === (userRole === "groom" ? "bride" : "groom")
                      ? "bg-primary/5 ring-2 ring-primary/30"
                      : !editing ? "hover:bg-muted/50 cursor-pointer" : ""
                  }`}
                >
                  <Avatar
                    photoData={userRole === "groom" ? bridePhotoData : groomPhotoData}
                    name={userRole === "groom" ? tempBrideName : tempGroomName}
                    inputRef={userRole === "groom" ? brideInputRef : groomInputRef}
                    onPhotoChange={(e) => handlePhotoChange(e, userRole === "groom" ? setBridePhotoData : setGroomPhotoData)}
                  />
                  <div className="text-center">
                    <p className="font-medium text-foreground">{userRole === "groom" ? tempBrideName : tempGroomName}</p>
                    {(userRole === "groom" ? tempBrideNickname : tempGroomNickname) && (
                      <p className="text-xs text-muted-foreground">@{userRole === "groom" ? tempBrideNickname : tempGroomNickname}</p>
                    )}
                  </div>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${
                    userRole === "groom"
                      ? (viewingTarget === "bride" ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")
                      : (viewingTarget === "groom" ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-600")
                  }`}>{userRole === "groom" ? "신부" : "신랑"}</span>
                </div>
              </>
            )}
          </div>

          {coupleConnected && !editing && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              클릭하여 {viewingTarget === "groom" ? "신랑" : "신부"}의 취향을 보고 있습니다
            </p>
          )}

          {editing && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              📷 카메라 버튼을 눌러 사진을 변경할 수 있습니다
            </p>
          )}
        </div>

        {/* 취향 & 선호도 카드 */}
        <div className="mb-6 rounded-2xl bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {isViewingMyOwn ? "취향 & 선호도" : `${viewingTarget === "groom" ? "신랑" : "신부"}의 취향`}
            </h2>
            {!isViewingMyOwn && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">보기 전용</span>
            )}
          </div>
          <div className="space-y-4">
            {displayPreferences.map((section) => {
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
                            {isViewingMyOwn && (
                              <button onClick={() => removeTag(section.id, tag)} className="ml-1 hover:text-red-300">
                                <X className="size-3" />
                              </button>
                            )}
                          </span>
                        ))}
                        {isViewingMyOwn && (
                          <button className="flex items-center gap-1 rounded-full border-2 border-dashed border-muted-foreground px-3 py-1.5 text-sm text-muted-foreground hover:border-primary hover:text-primary">
                            <Plus className="size-3" />
                            추가
                          </button>
                        )}
                        {!isViewingMyOwn && section.selected.length === 0 && (
                          <span className="text-sm text-muted-foreground">선택된 항목이 없습니다</span>
                        )}
                      </div>
                      {isViewingMyOwn && (
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
                      )}
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
                  onClick={() => {
                    setInfo(tempInfo)
                    setEditingInfo(false)
                    updateSharedInfo({
                      weddingDate: tempInfo.weddingDate,
                      totalBudget: tempInfo.budgetAmount,
                      guestCount: tempInfo.guestCount,
                      preferredRegions: tempInfo.preferredAreas.map((a) => ({ city: a, districts: [] })),
                    })
                      .then(() => console.log("[추가정보] 저장 + 커플 동기화 성공"))
                      .catch((err) => console.error("[추가정보] 저장 실패:", err))
                  }}
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
                <span className="text-sm font-medium text-foreground">{info.weddingDate ? displayDate(info.weddingDate) : "미설정"}</span>
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
                <span className="text-sm font-medium text-foreground">{info.guestCount ? `${info.guestCount.toLocaleString("ko-KR")}명` : "미설정"}</span>
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
                    {info.budgetAmount ? `${info.budgetAmount.toLocaleString("ko-KR")}만원` : "미설정"}
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

        {/* 커플 매칭 해제 */}
        {coupleConnected && (
          <div className="mt-10 border-t border-border pt-6">
            {!disconnectConfirm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">커플 매칭 해제</p>
                  <p className="mt-0.5 text-xs text-muted-foreground/60">파트너와의 연결이 해제됩니다</p>
                </div>
                <button
                  onClick={() => setDisconnectConfirm(true)}
                  className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground/60 transition-colors hover:bg-muted hover:text-muted-foreground"
                >
                  해제하기
                </button>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-muted/30 p-5">
                <p className="mb-1 text-sm font-medium text-foreground">정말 커플 매칭을 해제하시겠어요?</p>
                <p className="mb-4 text-xs text-muted-foreground">
                  파트너와의 연결이 해제되며, 커플 채팅 등 공유 데이터에 접근할 수 없게 됩니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDisconnectConfirm(false)}
                    className="flex-1 rounded-xl border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    취소
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        await disconnectCouple()
                        setDisconnectConfirm(false)
                        onCoupleDisconnect?.()
                      } catch {
                        alert("매칭 해제에 실패했습니다.")
                      }
                    }}
                    className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
                  >
                    해제 확인
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI 어시스턴트 연동 */}
        <McpTokenSection />

        {/* 회원탈퇴 */}
        <div className={`${coupleConnected ? "mt-6" : "mt-10"} border-t border-border pt-6`}>
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
                  onClick={async () => {
                    try {
                      await withdraw()
                      setDeleteConfirm(false)
                      onDeleteAccount?.()
                    } catch {
                      alert("회원탈퇴에 실패했습니다.")
                    }
                  }}
                  className="flex-1 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-100"
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

// ─── AI 어시스턴트 연동 섹션 ──────────────────────────────────────────

function McpTokenSection() {
  const [mcpToken, setMcpToken] = useState("")
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)

  const mcpUrl = mcpToken ? `https://j14a105.p.ssafy.io/mcp/?token=${mcpToken}` : ""

  const fetchToken = useCallback(async () => {
    try {
      setLoading(true)
      const res = await getMcpToken()
      setMcpToken(res.data.token)
    } catch {
      // 토큰 없음
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchToken()
  }, [fetchToken])

  const handleRefresh = async () => {
    try {
      setLoading(true)
      const res = await refreshMcpToken()
      setMcpToken(res.data.token)
    } catch {
      alert("토큰 재발급에 실패했습니다.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(mcpUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      <h2 className="mb-3 text-lg font-semibold text-foreground">AI 어시스턴트 연동</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Claude Desktop에서 SDM Guard를 자연어로 사용할 수 있습니다.
      </p>

      {mcpToken ? (
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">내 MCP 연동 URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-background px-3 py-2 text-xs text-foreground">
                {mcpUrl}
              </code>
              <button
                onClick={handleCopy}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              토큰이 유출된 경우 재발급하세요.
            </p>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {loading ? "발급 중..." : "재발급"}
            </button>
          </div>

          <details className="rounded-xl border border-border bg-muted/10 p-4">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">연동 방법 보기</summary>
            <ol className="mt-3 space-y-2 text-xs text-muted-foreground">
              <li>1. <a href="https://claude.ai/download" target="_blank" rel="noopener noreferrer" className="text-primary underline">Claude Desktop</a>을 설치하세요</li>
              <li>2. 위 URL을 복사하세요</li>
              <li>3. Claude Desktop → 설정 → 커넥터 → 커스텀 커넥터 추가</li>
              <li>4. 이름: <strong>SDM Guard</strong>, URL: 복사한 URL 붙여넣기</li>
              <li>5. &quot;내 예약 보여줘&quot; 라고 말해보세요!</li>
            </ol>
          </details>
        </div>
      ) : (
        <button
          onClick={fetchToken}
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {loading ? "발급 중..." : "토큰 발급하기"}
        </button>
      )}
    </div>
  )
}

// ─── 카드 관리 섹션 ──────────────────────────────────────────────────

const CARD_BRANDS: Record<string, string> = {
  "3K": "기업BC", "46": "광주", "71": "롯데", "30": "산업", "31": "BC", "51": "삼성",
  "38": "새마을", "41": "신한", "62": "신협", "36": "씨티", "33": "우리", "W1": "우리",
  "37": "우체국", "39": "저축", "35": "전북", "42": "제주", "15": "카카오뱅크",
  "3A": "케이뱅크", "24": "토스뱅크", "21": "하나", "61": "현대", "11": "KB국민",
  "91": "NH농협", "34": "Sh수협",
}

const CARD_GRADIENTS: Record<string, string> = {
  "41": "from-[#0052CC] to-[#0073E6]",       // 신한
  "11": "from-[#FFB800] to-[#FF8C00]",       // KB국민
  "51": "from-[#1A1A2E] to-[#16213E]",       // 삼성
  "61": "from-[#2C3E50] to-[#1A252F]",       // 현대
  "71": "from-[#C0392B] to-[#922B21]",       // 롯데
  "21": "from-[#00847F] to-[#005F5B]",       // 하나
  "33": "from-[#003087] to-[#001F5B]",       // 우리
  "W1": "from-[#003087] to-[#001F5B]",       // 우리
  "15": "from-[#FAE100] to-[#F0CC00]",       // 카카오뱅크
  "24": "from-[#0064FF] to-[#0040CC]",       // 토스뱅크
  "91": "from-[#009B4E] to-[#006B36]",       // NH농협
  "36": "from-[#003DA5] to-[#002580]",       // 씨티
  "3A": "from-[#00A3E0] to-[#0077A8]",       // 케이뱅크
}

function getCardGradient(brand: string): string {
  return CARD_GRADIENTS[brand] ?? "from-[#7C3AED] to-[#5B21B6]"
}

function getCardTextColor(brand: string): string {
  return brand === "15" ? "text-gray-800" : "text-white"
}

function CreditCardVisual({ card, onDelete }: {
  card: { id: number; cardBrand: string; cardLast4: string; ownerName: string; createdAt: string }
  onDelete: () => void
}) {
  const [showDelete, setShowDelete] = useState(false)
  const brandName = CARD_BRANDS[card.cardBrand] || card.cardBrand || "카드"
  const gradient = getCardGradient(card.cardBrand)
  const textColor = getCardTextColor(card.cardBrand)
  const isKakao = card.cardBrand === "15"
  const registeredYear = card.createdAt ? card.createdAt.substring(2, 4) : "25"
  const registeredMonth = card.createdAt ? card.createdAt.substring(5, 7) : "01"

  return (
    <div className="relative">
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-5 shadow-lg`}
        style={{ aspectRatio: "1.586 / 1" }}
        onClick={() => setShowDelete((v) => !v)}
      >
        {/* 배경 장식 원 */}
        <div className="absolute -right-8 -top-8 size-36 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -right-4 size-48 rounded-full bg-white/5" />

        {/* 상단: 칩 + 브랜드명 */}
        <div className="relative flex items-start justify-between">
          {/* IC 칩 */}
          <div className="flex flex-col gap-px">
            <div className={`h-5 w-7 rounded-sm border ${isKakao ? "border-gray-400 bg-gray-300" : "border-yellow-300/60 bg-yellow-200/80"}`}>
              <div className={`mx-auto mt-1 h-px w-5 ${isKakao ? "bg-gray-500/40" : "bg-yellow-400/40"}`} />
              <div className={`mx-auto mt-0.5 h-px w-5 ${isKakao ? "bg-gray-500/40" : "bg-yellow-400/40"}`} />
              <div className={`mx-auto mt-0.5 h-px w-5 ${isKakao ? "bg-gray-500/40" : "bg-yellow-400/40"}`} />
            </div>
          </div>
          {/* NFC 아이콘 */}
          <svg viewBox="0 0 24 24" className={`size-5 ${isKakao ? "text-gray-600/50" : "text-white/40"}`} fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M8.25 9a3.75 3.75 0 0 1 0 6M12 7.5a6 6 0 0 1 0 9M15.75 6a9.75 9.75 0 0 1 0 12" strokeLinecap="round" />
          </svg>
        </div>

        {/* 카드번호 */}
        <div className={`relative mt-4 font-mono text-lg font-semibold tracking-widest ${textColor}`}>
          •••• •••• •••• {card.cardLast4}
        </div>

        {/* 하단: 소유자 + 유효기간 + 브랜드 */}
        <div className="relative mt-3 flex items-end justify-between">
          <div>
            <p className={`text-[10px] font-medium uppercase tracking-widest ${isKakao ? "text-gray-500" : "text-white/50"}`}>CARD HOLDER</p>
            <p className={`mt-0.5 text-sm font-semibold tracking-wide ${textColor}`}>
              {card.ownerName || "—"}
            </p>
          </div>
          <div className="text-right">
            <p className={`text-[10px] font-medium uppercase tracking-widest ${isKakao ? "text-gray-500" : "text-white/50"}`}>REGISTERED</p>
            <p className={`mt-0.5 text-sm font-semibold ${textColor}`}>{registeredMonth} / {registeredYear}</p>
          </div>
        </div>

        {/* 브랜드명 워터마크 */}
        <div className={`absolute bottom-4 right-5 text-xs font-bold tracking-wider ${isKakao ? "text-gray-600/40" : "text-white/20"}`}>
          {brandName}
        </div>

        {/* 삭제 오버레이 */}
        {showDelete && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
            <button
              onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="flex items-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-red-600"
            >
              <Trash2 className="size-4" />
              카드 삭제
            </button>
          </div>
        )}
      </div>

      {/* 카드 정보 레이블 */}
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="text-sm font-medium text-foreground">{brandName} 카드</span>
        <span className="text-xs text-muted-foreground">탭하여 삭제</span>
      </div>
    </div>
  )
}

function CardManagementSection() {
  const [cards, setCards] = useState<{ id: number; cardBrand: string; cardLast4: string; ownerName: string; createdAt: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [registering, setRegistering] = useState(false)

  useEffect(() => {
    getCards()
      .then((res) => setCards(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (cardId: number) => {
    if (!confirm("이 카드를 삭제하시겠습니까?")) return
    try {
      await deleteCard(cardId)
      setCards((prev) => prev.filter((c) => c.id !== cardId))
    } catch {
      alert("카드 삭제에 실패했습니다.")
    }
  }

  const handleRegister = async () => {
    setRegistering(true)
    try {
      const keyRes = await getTossClientKey()
      const clientKey = keyRes.data.clientKey
      const customerKey = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8)

      const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk")
      const toss = await loadTossPayments(clientKey)
      const payment = toss.payment({ customerKey })

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: window.location.origin + "/cards/success",
        failUrl: window.location.origin + "/cards/fail",
      })
    } catch (err: any) {
      if (err?.code !== "USER_CANCEL") {
        alert("카드 등록에 실패했습니다.")
      }
    } finally {
      setRegistering(false)
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-card p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">결제 수단</h2>
          {!loading && cards.length > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{cards.length}장</span>
          )}
        </div>
        <button
          onClick={handleRegister}
          disabled={registering}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-50"
        >
          <Plus className="size-3.5" />
          {registering ? "등록 중..." : "카드 추가"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : cards.length === 0 ? (
        <button
          onClick={handleRegister}
          disabled={registering}
          className="group w-full"
        >
          <div className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border py-10 transition-colors hover:border-primary/40 hover:bg-primary/5">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
              <CreditCard className="size-7 text-muted-foreground/50 transition-colors group-hover:text-primary/60" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">등록된 카드가 없어요</p>
              <p className="mt-1 text-xs text-muted-foreground">탭하여 카드를 등록하고 간편하게 결제하세요</p>
            </div>
          </div>
        </button>
      ) : (
        <div className="space-y-4">
          {cards.map((card) => (
            <CreditCardVisual
              key={card.id}
              card={card}
              onDelete={() => handleDelete(card.id)}
            />
          ))}
          <p className="text-center text-xs text-muted-foreground">카드를 탭하면 삭제할 수 있어요</p>
        </div>
      )}
    </div>
  )
}
