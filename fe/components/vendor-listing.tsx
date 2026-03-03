"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import {
  useWedding,
  type Vendor,
  type VendorReview,
  type WeddingHall,
  progressSteps,
  getProgressIndex,
  getProgressBadgeText,
} from "@/lib/wedding-store"
import {
  Star,
  ChevronDown,
  ChevronUp,
  Bot,
  ArrowLeft,
  Check,
  Upload,
  RotateCcw,
  Move3D,
  Sparkles,
  Heart,
  Phone,
  MapPin,
  Flag,
  Send,
  ChevronRight,
  Clock,
  Car,
  Copy,
  Navigation,
  Gift,
  Building2,
  Ruler,
  Users,
  UtensilsCrossed,
  Wine,
  Palette,
  Crown,
  Flower2,
  BadgePercent,
  X,
  SlidersHorizontal,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

/* ── helpers ────────────────────────────────────────────── */
const catLabel: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", hall: "웨딩홀" }

/* ── 3D Dress Preview ──────────────────────────────────── */
function DressPreviewInline() {
  const [image, setImage] = useState<string | null>(null)
  const [rotation, setRotation] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const animationRef = useRef<number | null>(null)
  const lastXRef = useRef(0)

  const handleFileUpload = useCallback((file: File) => {
    if (file.type.startsWith("image/")) { const reader = new FileReader(); reader.onload = (e) => { setImage(e.target?.result as string); setRotation(0) }; reader.readAsDataURL(file) }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) handleFileUpload(file) }, [handleFileUpload])

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!image) return; lastXRef.current = e.clientX; (e.target as HTMLElement).setPointerCapture(e.pointerId)
    const onMove = (ev: PointerEvent) => { const dx = ev.clientX - lastXRef.current; lastXRef.current = ev.clientX; setRotation((prev) => prev + dx * 0.5) }
    const onUp = () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp) }
    document.addEventListener("pointermove", onMove); document.addEventListener("pointerup", onUp)
  }

  const toggleAutoRotate = () => {
    if (isAnimating) { setIsAnimating(false); if (animationRef.current) cancelAnimationFrame(animationRef.current) } else setIsAnimating(true)
  }

  useEffect(() => {
    if (!isAnimating) return
    let lastTime = performance.now()
    const animate = (time: number) => { const delta = time - lastTime; lastTime = time; setRotation((prev) => prev + delta * 0.03); animationRef.current = requestAnimationFrame(animate) }
    animationRef.current = requestAnimationFrame(animate)
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current) }
  }, [isAnimating])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2"><Sparkles className="size-4 text-foreground" /><h3 className="text-sm font-medium">3D 드레스 미리보기</h3></div>
      <p className="text-xs text-muted-foreground">2D 드레스 사진을 업로드하면 3D로 변환하여 다양한 각도에서 확인할 수 있습니다</p>
      <div
        onDrop={handleDrop} onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }} onDragLeave={() => setIsDragging(false)}
        className={cn("relative aspect-[3/4] rounded-3xl border-2 border-dashed overflow-hidden transition-all duration-300 cursor-grab active:cursor-grabbing", isDragging ? "border-foreground bg-secondary/50" : image ? "border-transparent bg-secondary" : "border-border bg-card")}
        style={{ perspective: "1000px" }}
      >
        {image ? (
          <div onPointerDown={handlePointerDown} className="absolute inset-0 flex items-center justify-center select-none" style={{ transform: `rotateY(${rotation}deg)`, transformStyle: "preserve-3d" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="드레스 3D 미리보기" className="max-h-full max-w-full object-contain drop-shadow-2xl" draggable={false} />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-32 h-4 bg-foreground/10 rounded-full blur-xl" style={{ transform: `translateX(${Math.sin((rotation * Math.PI) / 180) * 20}px)` }} />
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
            <div className="size-14 rounded-full bg-secondary flex items-center justify-center"><Upload className="size-5 text-muted-foreground" /></div>
            <div className="text-center"><p className="text-sm font-medium">드레스 사진 업로드</p><p className="text-xs text-muted-foreground mt-1">드래그 앤 드롭 또는 클릭</p></div>
            <label>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFileUpload(file) }} />
              <span className="inline-flex items-center px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-medium cursor-pointer hover:opacity-90 transition-opacity">이미지 선택</span>
            </label>
          </div>
        )}
      </div>
      {image && (
        <div className="flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Button onClick={toggleAutoRotate} variant={isAnimating ? "default" : "outline"} className="flex-1 rounded-full h-10 gap-2 text-xs"><RotateCcw className={cn("size-3.5", isAnimating && "animate-spin")} />{isAnimating ? "회전 중지" : "자동 회전"}</Button>
          <Button variant="outline" onClick={() => setRotation(0)} className="rounded-full h-10 px-4 gap-2 text-xs"><Move3D className="size-3.5" />초기화</Button>
        </div>
      )}
      {image && <Button variant="outline" onClick={() => { setImage(null); setRotation(0); setIsAnimating(false) }} className="rounded-full h-10 text-xs">다른 이미지 업로드</Button>}
    </div>
  )
}

/* ── Review Card / Summary / WriteReview / Report (shared) ─ */
function ReviewCard({ review }: { review: VendorReview }) {
  return (
    <div className="bg-secondary/30 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2"><span className="text-xs font-medium">{review.userName}</span><span className="text-[10px] text-muted-foreground">{review.date}</span></div>
      <div className="flex items-center gap-0.5 mb-2">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("size-3", i < review.rating ? "fill-foreground text-foreground" : "text-border")} />)}</div>
      <p className="text-xs text-muted-foreground leading-relaxed">{review.text}</p>
    </div>
  )
}

function ReviewSummary({ reviews }: { reviews: VendorReview[] }) {
  if (reviews.length === 0) return null
  const avg = (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: reviews.filter((r) => r.rating === star).length }))
  return (
    <div className="flex items-center gap-5">
      <div className="flex flex-col items-center gap-1">
        <span className="text-3xl font-light">{avg}</span>
        <div className="flex gap-0.5">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn("size-3", i < Math.round(Number(avg)) ? "fill-foreground text-foreground" : "text-border")} />)}</div>
        <span className="text-[10px] text-muted-foreground">{reviews.length}개 리뷰</span>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        {counts.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2"><span className="text-[10px] text-muted-foreground w-3">{star}</span><div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-foreground rounded-full transition-all" style={{ width: `${reviews.length > 0 ? (count / reviews.length) * 100 : 0}%` }} /></div></div>
        ))}
      </div>
    </div>
  )
}

function WriteReviewDialog({ open, onOpenChange, vendorId }: { open: boolean; onOpenChange: (open: boolean) => void; vendorId: string }) {
  const { addReview } = useWedding(); const [rating, setRating] = useState(5); const [text, setText] = useState("")
  const handleSubmit = () => { if (!text.trim()) return; addReview({ vendorId, userName: "나", rating, text: text.trim(), date: new Date().toISOString().split("T")[0] }); setText(""); setRating(5); onOpenChange(false) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm mx-auto">
        <DialogHeader><DialogTitle className="text-lg">리뷰 작성</DialogTitle><DialogDescription>이 업체에 대한 솔직한 후기를 남겨주세요</DialogDescription></DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5"><label className="text-xs text-muted-foreground font-medium">별점</label><div className="flex gap-1">{[1, 2, 3, 4, 5].map((s) => <button key={s} onClick={() => setRating(s)} className="p-0.5" aria-label={`별점 ${s}점`}><Star className={cn("size-6 transition-colors", s <= rating ? "fill-foreground text-foreground" : "text-border")} /></button>)}</div></div>
          <div className="flex flex-col gap-1.5"><label className="text-xs text-muted-foreground font-medium">후기</label><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="업체 이용 후기를 작성해주세요..." className="h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring" /></div>
        </div>
        <DialogFooter className="flex-col gap-2"><Button onClick={handleSubmit} disabled={!text.trim()} className="w-full rounded-full h-11">작성 완료</Button><Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-full h-11">취소</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [reason, setReason] = useState(""); const [submitted, setSubmitted] = useState(false)
  const handleSubmit = () => { if (!reason.trim()) return; setSubmitted(true); setTimeout(() => { setSubmitted(false); setReason(""); onOpenChange(false) }, 1500) }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm mx-auto">
        <DialogHeader><DialogTitle className="text-lg">신고하기</DialogTitle><DialogDescription>부적절한 업체 정보를 신고해주세요</DialogDescription></DialogHeader>
        {submitted ? (<div className="py-8 text-center"><Check className="size-10 mx-auto text-foreground mb-3" /><p className="text-sm font-medium">신고가 접수되었습니다</p></div>) : (
          <><textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="신고 사유를 입력해주세요..." className="h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring" />
          <DialogFooter className="flex-col gap-2"><Button onClick={handleSubmit} disabled={!reason.trim()} variant="destructive" className="w-full rounded-full h-11">신고 접수</Button><Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-full h-11">취소</Button></DialogFooter></>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ── Progress Timeline ──────────────────────────────────── */
function ProgressTimeline({ vendor }: { vendor: Vendor }) {
  const currentIdx = getProgressIndex(vendor.progress.currentStep)
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">결제 진행 상태</span>
      <div className="mt-4 flex flex-col gap-0">
        {progressSteps.map((step, i) => {
          const done = i <= currentIdx
          const isCurrent = i === currentIdx
          const dateStr = vendor.progress.completedAt?.[step.key]
          return (
            <div key={step.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={cn("size-6 rounded-full flex items-center justify-center text-[10px] font-medium border-2 transition-all shrink-0", done ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border")}>
                  {done ? <Check className="size-3" /> : <span>{i + 1}</span>}
                </div>
                {i < progressSteps.length - 1 && <div className={cn("w-0.5 h-8 transition-all", done ? "bg-foreground" : "bg-border")} />}
              </div>
              <div className="pb-6">
                <p className={cn("text-xs font-medium", isCurrent ? "text-foreground" : done ? "text-muted-foreground" : "text-muted-foreground/50")}>{step.label}</p>
                {dateStr && <p className="text-[10px] text-muted-foreground mt-0.5">{dateStr}</p>}
                {isCurrent && step.key === "completed" && <p className="text-[10px] text-muted-foreground mt-0.5">리뷰를 작성해주세요!</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Visit Info Section ─────────────────────────────────── */
function VisitInfoSection({ vendor }: { vendor: Vendor }) {
  const info = vendor.visitInfo
  const [copied, setCopied] = useState(false)
  const copyAddress = () => { navigator.clipboard.writeText(info.address); setCopied(true); setTimeout(() => setCopied(false), 1500) }

  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">방문안내</span>
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <MapPin className="size-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm">{info.address}</p>
            <button onClick={copyAddress} className="text-[10px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 transition-colors">
              <Copy className="size-3" />{copied ? "복사됨!" : "주소 복사"}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3"><Navigation className="size-4 text-muted-foreground shrink-0" /><p className="text-sm">{info.transport}</p></div>
        <div className="flex items-center gap-3"><Car className="size-4 text-muted-foreground shrink-0" /><p className="text-sm">{info.parking}</p></div>
        <div className="flex items-center gap-3"><Clock className="size-4 text-muted-foreground shrink-0" /><p className="text-sm">{info.hours} (휴무: {info.closedDays}){info.lunchBreak !== "없음" && ` / 점심: ${info.lunchBreak}`}</p></div>
        <div className="flex items-center gap-3"><Building2 className="size-4 text-muted-foreground shrink-0" /><p className="text-sm">{info.floor}</p></div>
        <a href={`tel:${info.phone}`} className="flex items-center gap-3 hover:text-foreground transition-colors"><Phone className="size-4 text-muted-foreground shrink-0" /><p className="text-sm underline">{info.phone}</p></a>
      </div>
      <div className="flex gap-2">
        <button className="flex-1 rounded-full border border-border py-2.5 text-xs font-medium hover:bg-secondary transition-colors">네이버 지도</button>
        <button className="flex-1 rounded-full border border-border py-2.5 text-xs font-medium hover:bg-secondary transition-colors">카카오맵</button>
        <button className="flex-1 rounded-full border border-border py-2.5 text-xs font-medium hover:bg-secondary transition-colors">티맵</button>
      </div>
    </div>
  )
}

/* ── Package Tabs Section ───────────────────────────────── */
function PackageTabsSection({ vendor }: { vendor: Vendor }) {
  const tabs = vendor.packageTabs
  const [activeTab, setActiveTab] = useState(0)
  if (tabs.length === 0) return null
  const current = tabs[activeTab]

  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">용도별 패키지</span>
      <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
        {tabs.map((tab, i) => (
          <button key={i} onClick={() => setActiveTab(i)} className={cn("shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all", i === activeTab ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>{tab.tabName}</button>
        ))}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between"><span className="text-sm font-medium">{current.tabName}</span><span className="text-sm font-medium">{current.price.toLocaleString()}원</span></div>
        <div className="flex flex-col gap-2 mt-1">
          {current.includes.map((inc, i) => (
            <div key={i} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{inc.label}</span><span className="font-medium">{inc.value}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Additional Products Section ────────────────────────── */
function AdditionalProductsSection({ vendor }: { vendor: Vendor }) {
  const [isOpen, setIsOpen] = useState(false)
  if (vendor.additionalProducts.length === 0) return null

  return (
    <div className="bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-5 text-left" aria-expanded={isOpen}>
        <span className="text-sm font-medium">추가상품</span>
        {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="px-5 pb-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] text-muted-foreground">업체 사정에 따라 금액은 변동이 있을 수 있습니다</p>
          {vendor.additionalProducts.map((group, gi) => (
            <div key={gi}>
              <span className="text-xs font-medium text-muted-foreground">{group.category}</span>
              <div className="mt-2 flex flex-col gap-2">
                {group.items.map((item, ii) => (
                  <div key={ii} className="flex flex-col">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground">{item.name}</span>
                      <span className="font-medium">{item.price}</span>
                    </div>
                    {item.condition && <p className="text-[10px] text-muted-foreground mt-0.5">{item.condition}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-3">추가 구매상품은 예약 진행 후 직접 결제하실 수 있습니다</p>
        </div>
      )}
    </div>
  )
}

/* ── Studio Extra Section ──────────────────────────────── */
function StudioExtraSection({ vendor }: { vendor: Vendor }) {
  const extra = vendor.studioExtra
  if (!extra) return null
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">리허설촬영 구성</span>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">앨범</span><span className="font-medium">{extra.rehearsalAlbum}</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">액자</span><span className="font-medium">{extra.rehearsalFrame}</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">원본 구매</span><span className="font-medium">{extra.originalRequired ? "필수" : "선택"}</span></div>
      </div>
      {extra.outdoorLocations.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground uppercase tracking-wider mt-2">야외씬 촬영 옵션</span>
          <div className="flex flex-col gap-2">
            {extra.outdoorLocations.map((loc, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex items-center justify-between text-xs"><span className="text-foreground">{loc.name}</span><span className="font-medium">{loc.fee === 0 ? "기본 포함" : `${loc.fee.toLocaleString()}원`}</span></div>
                {loc.note && <p className="text-[10px] text-muted-foreground mt-0.5">{loc.note}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Dress Extra Section ───────────────────────────────── */
function DressExtraSection({ vendor }: { vendor: Vendor }) {
  const extra = vendor.dressExtra
  if (!extra) return null
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">포함 드레스 정보</span>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">리허설 화이트</span><span className="font-medium">{extra.rehearsalWhite}벌</span></div>
        {extra.rehearsalColor > 0 && <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">리허설 컬러</span><span className="font-medium">{extra.rehearsalColor}벌</span></div>}
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">본식 화이트</span><span className="font-medium">{extra.ceremonyWhite}벌</span></div>
        {extra.ceremonyColor > 0 && <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">본식 컬러</span><span className="font-medium">{extra.ceremonyColor}벌</span></div>}
      </div>
      {extra.helperFees.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground uppercase tracking-wider mt-2">헬퍼비 추가 발생 조건</span>
          <div className="flex flex-col gap-2">
            {extra.helperFees.map((fee, i) => (
              <div key={i} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{fee.condition}</span><span className="font-medium">{fee.fee.toLocaleString()}원</span></div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Makeup Extra Section ──────────────────────────────── */
function MakeupExtraSection({ vendor }: { vendor: Vendor }) {
  const extra = vendor.makeupExtra
  if (!extra) return null
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">서비스 구성 정보</span>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">리허설</span><span className="font-medium">{extra.rehearsalSessions}회</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">본식</span><span className="font-medium">{extra.ceremonySessions}회</span></div>
        <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">신랑 포함</span><span className="font-medium">{extra.groomIncluded ? "포함" : "미포함"}</span></div>
      </div>
      {extra.startTimeFees.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground uppercase tracking-wider mt-2">스타트 시간 추가비</span>
          <div className="flex flex-col gap-2">
            {extra.startTimeFees.map((fee, i) => (
              <div key={i} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{fee.time}</span><span className="font-medium">{fee.fee === 0 ? "추가비 없음" : `${fee.fee.toLocaleString()}원`}</span></div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ── Hall Detail Card ──────────────────────────────────── */
function HallDetailCard({ hall }: { hall: WeddingHall }) {
  const rows: { icon: React.ElementType; label: string; value: string }[] = [
    { icon: Clock, label: "예식간격", value: hall.interval },
    { icon: Clock, label: "예식시간", value: hall.timeSlots.join(" / ") },
    { icon: Users, label: "보증인원", value: `${hall.guaranteeGuests}명` },
    { icon: Users, label: "수용인원", value: `착석 ${hall.seatingCapacity}명 / 수용 ${hall.standingCapacity}명` },
    { icon: BadgePercent, label: "대관료", value: `${hall.rentalFee.toLocaleString()}원` },
    { icon: UtensilsCrossed, label: "식대 (대인)", value: `${hall.mealAdult.toLocaleString()}원` },
    { icon: UtensilsCrossed, label: "식대 (소인)", value: `${hall.mealChild.toLocaleString()}원` },
    { icon: Wine, label: "음료/주류", value: hall.drink },
    { icon: Palette, label: "스타일", value: hall.style },
    { icon: Ruler, label: "천고", value: hall.ceilingHeight },
    { icon: Crown, label: "버진로드", value: hall.virginRoad ? "있음" : "없음" },
    { icon: Crown, label: "단상", value: hall.stage ? "있음" : "없음" },
    { icon: BadgePercent, label: "봉사료", value: hall.serviceFeeIncluded ? "포함" : "별도" },
    { icon: BadgePercent, label: "부가세", value: hall.vatIncluded ? "포함" : "별도" },
    { icon: Flower2, label: "플라워", value: hall.flowerIncluded ? "포함" : "별도" },
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="aspect-[16/9] bg-secondary rounded-2xl overflow-hidden flex items-center justify-center">
        <span className="text-xs text-muted-foreground/40 uppercase tracking-widest">{hall.name}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        {rows.map((row, i) => {
          const Icon = row.icon
          return (
            <div key={i} className="flex items-start gap-2 py-1.5">
              <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <div className="min-w-0"><p className="text-[10px] text-muted-foreground">{row.label}</p><p className="text-xs font-medium truncate">{row.value}</p></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Hall Event/Discount Section ────────────────────────── */
function HallEventSection({ vendor }: { vendor: Vendor }) {
  const ev = vendor.hallEvent
  if (!ev) return null
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <div className="flex items-center gap-2"><Gift className="size-4 text-foreground" /><span className="text-sm font-medium">이벤트 혜택</span></div>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">[{ev.period}]</span>
        <p className="text-[10px] text-muted-foreground">적용 조건: {ev.condition}</p>
      </div>
      <div className="flex flex-col gap-2">
        {ev.discounts.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-foreground">{d.item}</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground line-through">{d.original}</span>
              <span className="font-medium">{d.discounted}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 mt-1">
        <span className="text-xs font-medium text-muted-foreground">계약 특전</span>
        {ev.perks.map((perk, i) => (
          <div key={i} className="flex items-center gap-2"><Check className="size-3 text-foreground shrink-0" /><span className="text-xs">{perk}</span></div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground border-t border-border/50 pt-3">{ev.note}</p>
    </div>
  )
}

/* ── Hall Types Section ─────────────────────────────────── */
function HallTypesSection({ vendor }: { vendor: Vendor }) {
  const halls = vendor.halls
  if (!halls || halls.length === 0) return null
  const [activeIdx, setActiveIdx] = useState(0)
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
      <span className="text-sm font-medium">홀 종류</span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {halls.map((h, i) => (
          <button key={h.id} onClick={() => setActiveIdx(i)} className={cn("shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all", i === activeIdx ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}>{h.name}</button>
        ))}
      </div>
      <HallDetailCard hall={halls[activeIdx]} />
    </div>
  )
}

/* ── Hall Facilities Section ────────────────────────────── */
function HallFacilitiesSection({ vendor }: { vendor: Vendor }) {
  const facs = vendor.hallFacilities
  if (!facs || facs.length === 0) return null
  return (
    <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">부대시설</span>
      <div className="grid grid-cols-2 gap-3 mt-3">
        {facs.map((f, i) => (
          <div key={i} className="flex items-start gap-2 bg-secondary/50 rounded-2xl p-3">
            <Building2 className="size-4 text-muted-foreground mt-0.5 shrink-0" />
            <div><p className="text-xs font-medium">{f.name}</p><p className="text-[10px] text-muted-foreground mt-0.5">{f.detail}</p></div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Vendor Card ─────────────────────────────────────────── */
function VendorCard({ vendor, isFavorite, onToggleFavorite, onClick }: { vendor: Vendor; isFavorite: boolean; onToggleFavorite: () => void; onClick: () => void }) {
  const badgeText = getProgressBadgeText(vendor.progress.currentStep)
  const step = vendor.progress.currentStep
  const badgeCls = step === "consulting" ? "bg-secondary text-secondary-foreground" : step === "completed" || step === "balance" ? "bg-foreground text-background" : "bg-chart-4 text-foreground"

  return (
    <div className="w-full text-left bg-card rounded-3xl border border-border/50 overflow-hidden shadow-sm transition-all duration-300 hover:shadow-md relative">
      <button onClick={onClick} className="w-full text-left">
        <div className="aspect-[16/10] bg-secondary relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30"><span className="text-xs uppercase tracking-widest">{catLabel[vendor.category]}</span></div>
          <div className="absolute top-3 right-3"><span className={cn("rounded-full px-3 py-1 text-[10px] font-medium", badgeCls)}>{badgeText}</span></div>
          {vendor.isDressShop && (
            <div className="absolute top-3 left-3 bg-background/80 backdrop-blur-sm text-foreground rounded-full px-3 py-1 text-[10px] font-medium flex items-center gap-1"><Sparkles className="size-3" />3D</div>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-medium text-sm">{vendor.name}</h3>
              <div className="flex flex-wrap gap-1 mt-1.5">{vendor.hashtags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{tag}</span>)}</div>
            </div>
            <div className="flex items-center gap-1"><Star className="size-3.5 fill-foreground" /><span className="text-xs font-medium">{vendor.rating}</span></div>
          </div>
          <div className="flex items-center justify-between mt-4"><span className="text-lg font-light">{vendor.price.toLocaleString()}원</span><ChevronRight className="size-4 text-muted-foreground" /></div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFavorite() }}
        className="absolute bottom-5 right-5 size-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-sm transition-all z-10"
        aria-label={isFavorite ? "찜 해제" : "찜하기"}
      >
        <Heart className={cn("size-4 transition-colors", isFavorite ? "fill-foreground text-foreground" : "text-muted-foreground")} />
      </button>
    </div>
  )
}

/* ── Vendor Detail ──────────────────────────────────────── */
function VendorDetail({ vendor, onBack }: { vendor: Vendor; onBack: () => void }) {
  const [showReviewDialog, setShowReviewDialog] = useState(false)
  const [showReportDialog, setShowReportDialog] = useState(false)
  const { addMessage, reviews, favoriteIds, toggleFavorite } = useWedding()
  const vendorReviews = reviews.filter((r) => r.vendorId === vendor.id)
  const isFavorite = favoriteIds.includes(vendor.id)

  return (
    <div className="px-6 py-6 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit" aria-label="돌아가기"><ArrowLeft className="size-4" />돌아가기</button>

      {/* Hero */}
      <div className="aspect-[16/10] bg-secondary rounded-3xl overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30"><span className="text-sm uppercase tracking-widest">{catLabel[vendor.category]}</span></div>
      </div>

      {/* Name + Hashtags + Fav */}
      <div>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-medium">{vendor.name}</h2>
              <button onClick={() => toggleFavorite(vendor.id)} aria-label={isFavorite ? "찜 해제" : "찜하기"}><Heart className={cn("size-5 transition-colors", isFavorite ? "fill-foreground text-foreground" : "text-muted-foreground")} /></button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">{vendor.hashtags.map((tag) => <span key={tag} className="rounded-full bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground">{tag}</span>)}</div>
          </div>
          <div className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1.5 shrink-0"><Star className="size-3.5 fill-foreground" /><span className="text-sm font-medium">{vendor.rating}</span></div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mt-4">{vendor.description}</p>
      </div>

      {/* Progress */}
      <ProgressTimeline vendor={vendor} />

      {/* Package Tabs (not for hall) */}
      {vendor.category !== "hall" && <PackageTabsSection vendor={vendor} />}

      {/* Category-specific Extras */}
      {vendor.category === "studio" && <StudioExtraSection vendor={vendor} />}
      {vendor.category === "dress" && <DressExtraSection vendor={vendor} />}
      {vendor.category === "makeup" && <MakeupExtraSection vendor={vendor} />}

      {/* Hall-specific Sections */}
      {vendor.category === "hall" && <HallEventSection vendor={vendor} />}
      {vendor.category === "hall" && <HallTypesSection vendor={vendor} />}
      {vendor.category === "hall" && <HallFacilitiesSection vendor={vendor} />}

      {/* 3D Dress Preview for dress shops */}
      {vendor.isDressShop && (
        <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm"><DressPreviewInline /></div>
      )}

      {/* Additional Products */}
      <AdditionalProductsSection vendor={vendor} />

      {/* Visit Info */}
      <VisitInfoSection vendor={vendor} />

      {/* Reviews Section */}
      <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">리뷰</span>
          <Button onClick={() => setShowReviewDialog(true)} variant="outline" size="sm" className="rounded-full h-8 gap-1.5 text-xs"><Send className="size-3" />리뷰 작성</Button>
        </div>
        <ReviewSummary reviews={vendorReviews} />
        {vendorReviews.length > 0 ? (
          <div className="flex flex-col gap-3 max-h-80 overflow-y-auto no-scrollbar">{vendorReviews.map((r) => <ReviewCard key={r.id} review={r} />)}</div>
        ) : (<p className="text-xs text-muted-foreground text-center py-4">아직 리뷰가 없습니다</p>)}
      </div>

      {/* AI Ask */}
      <Button onClick={() => { addMessage({ role: "user", content: `${vendor.name}에 대해 더 알려주세요. 예약 전에 알아야 할 사항이 있나요?` }) }} variant="outline" className="w-full rounded-full h-12 text-sm gap-2">
        <Bot className="size-4" />AI에게 이 업체 물어보기
      </Button>

      {/* Report */}
      <button onClick={() => setShowReportDialog(true)} className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60 hover:text-destructive transition-colors py-2"><Flag className="size-3" />신고하기</button>

      <WriteReviewDialog open={showReviewDialog} onOpenChange={setShowReviewDialog} vendorId={vendor.id} />
      <ReportDialog open={showReportDialog} onOpenChange={setShowReportDialog} />
    </div>
  )
}

/* ── Hall Filters Dialog ────────────────────────────────── */
const hallFilterOptions = {
  guestCount: [{ id: "all", label: "전체" }, { id: "under100", label: "100명 미만" }, { id: "100-200", label: "100~200명" }, { id: "200-300", label: "200~300명" }, { id: "over300", label: "300명 이상" }],
  style: [{ id: "all", label: "전체" }, { id: "bright", label: "밝은" }, { id: "dark", label: "어두운" }, { id: "modern", label: "모던" }, { id: "classic", label: "클래식" }],
  mealType: [{ id: "all", label: "전체" }, { id: "buffet", label: "뷔페" }, { id: "course", label: "코스" }, { id: "korean", label: "한정식" }],
  ceremonyType: [{ id: "all", label: "전체" }, { id: "separate", label: "분리예식" }, { id: "simultaneous", label: "동시예식" }],
  transport: [{ id: "all", label: "전체" }, { id: "subway5", label: "지하철 5분 이내" }, { id: "parking", label: "주차 가능" }, { id: "valet", label: "발렛파킹 가능" }],
  entrance: [{ id: "all", label: "전체" }, { id: "brideroom", label: "신부실에서 바로" }, { id: "stairs", label: "계단을 통해" }, { id: "front", label: "정면에서" }, { id: "ㄱ", label: "ㄱ자 입장" }, { id: "ㄴ", label: "ㄴ자 입장" }, { id: "ㄷ", label: "ㄷ자 입장" }],
  virginRoad: [{ id: "all", label: "전체" }, { id: "yes", label: "있음" }, { id: "no", label: "없음" }],
}

function HallFiltersDialog({ open, onOpenChange, filters, onApply }: {
  open: boolean; onOpenChange: (open: boolean) => void
  filters: Record<string, string>; onApply: (filters: Record<string, string>) => void
}) {
  const [local, setLocal] = useState(filters)
  const sections: { key: string; label: string }[] = [
    { key: "guestCount", label: "예상 하객수" },
    { key: "style", label: "스타일" },
    { key: "mealType", label: "식사 종류" },
    { key: "ceremonyType", label: "예식 형태" },
    { key: "transport", label: "교통/주차" },
    { key: "entrance", label: "입장 방법" },
    { key: "virginRoad", label: "버진로드" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm mx-auto max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-lg">웨딩홀 필터</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-5 py-2">
          {sections.map(({ key, label }) => (
            <div key={key} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{label}</span>
              <div className="flex flex-wrap gap-1.5">
                {(hallFilterOptions[key as keyof typeof hallFilterOptions] || []).map((opt) => (
                  <button key={opt.id} onClick={() => setLocal((prev) => ({ ...prev, [key]: opt.id }))}
                    className={cn("px-3 py-1.5 rounded-full text-xs font-medium transition-all", local[key] === opt.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}
                  >{opt.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="flex-col gap-2">
          <Button onClick={() => { onApply(local); onOpenChange(false) }} className="w-full rounded-full h-11">적용하기</Button>
          <Button variant="outline" onClick={() => { const reset: Record<string, string> = {}; Object.keys(hallFilterOptions).forEach((k) => { reset[k] = "all" }); setLocal(reset) }} className="w-full rounded-full h-11">초기화</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ── Vendor Listing (main) ───────────────────────────────── */
const filterCategories = [
  { id: "all", name: "전체" },
  { id: "studio", name: "스튜디오" },
  { id: "dress", name: "드레스" },
  { id: "makeup", name: "메이크업" },
  { id: "hall", name: "웨딩홀" },
]

export function VendorListing() {
  const { vendors, favoriteIds, toggleFavorite } = useWedding()
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null)
  const [filter, setFilter] = useState<string>("all")
  const [showHallFilters, setShowHallFilters] = useState(false)
  const [hallFilters, setHallFilters] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    Object.keys(hallFilterOptions).forEach((k) => { init[k] = "all" })
    return init
  })

  const activeHallFilterCount = Object.values(hallFilters).filter((v) => v !== "all").length

  const filteredVendors = filter === "all" ? vendors : vendors.filter((v) => v.category === filter)

  if (selectedVendor) {
    const current = vendors.find((v) => v.id === selectedVendor.id) || selectedVendor
    return <VendorDetail vendor={current} onBack={() => setSelectedVendor(null)} />
  }

  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl">업체</h2>
        <p className="text-sm text-muted-foreground mt-1">AI가 엄선한 최고의 웨딩 업체</p>
      </div>

      {/* Category Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
        {filterCategories.map((cat) => (
          <button key={cat.id} onClick={() => setFilter(cat.id)}
            className={cn("shrink-0 px-4 py-2 rounded-full text-xs font-medium transition-all duration-200", filter === cat.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground")}
          >{cat.name}</button>
        ))}
      </div>

      {/* Hall-specific extra filters */}
      {filter === "hall" && (
        <button onClick={() => setShowHallFilters(true)} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit">
          <SlidersHorizontal className="size-3.5" />상세 필터{activeHallFilterCount > 0 && <span className="bg-foreground text-background rounded-full px-1.5 py-0.5 text-[9px] font-medium">{activeHallFilterCount}</span>}
        </button>
      )}

      {/* Grid */}
      <div className="flex flex-col gap-4">
        {filteredVendors.map((vendor) => (
          <VendorCard key={vendor.id} vendor={vendor} isFavorite={favoriteIds.includes(vendor.id)} onToggleFavorite={() => toggleFavorite(vendor.id)} onClick={() => setSelectedVendor(vendor)} />
        ))}
      </div>

      <HallFiltersDialog open={showHallFilters} onOpenChange={setShowHallFilters} filters={hallFilters} onApply={setHallFilters} />
    </div>
  )
}
