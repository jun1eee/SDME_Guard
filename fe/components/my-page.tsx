"use client"

import { useState } from "react"
import { useWedding, type VendorReview } from "@/lib/wedding-store"
import {
  Heart,
  Palette,
  Utensils,
  Users,
  MapPin,
  Pencil,
  Check,
  X,
  Sparkles,
  Camera,
  ArrowLeft,
  CreditCard,
  Star,
  ChevronDown,
  ChevronUp,
  Store,
  Wallet,
  ClipboardList,
  Trash2,
  Link2,
  Send,
  CalendarCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/* ── Sub-page type ─────────────────────────────────────── */
export type SubPage =
  | "main"
  | "edit-profile"
  | "favorites"
  | "payments"
  | "reservations"
  | "my-reviews"
  | "my-cards"

/* ── D-Day Counter ─────────────────────────────────────── */
function DdayCounter({ weddingDate }: { weddingDate: string }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const wedding = new Date(weddingDate + "T00:00:00"); wedding.setHours(0, 0, 0, 0)
  const diff = Math.ceil((wedding.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-widest">D-Day</span>
      <span className="text-5xl font-light tracking-tight font-serif">
        {diff > 0 ? `D-${diff}` : diff === 0 ? "D-Day" : `D+${Math.abs(diff)}`}
      </span>
      <span className="text-xs text-muted-foreground mt-1">
        {new Date(weddingDate + "T00:00:00").toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}
      </span>
    </div>
  )
}

/* ── Profile Card ──────────────────────────────────────── */
function ProfileCard({ label, name, onChangeName, photo, onChangePhoto }: {
  label: string; name: string; onChangeName: (name: string) => void; photo: string; onChangePhoto: (photo: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)

  const handlePhotoUpload = (file: File) => {
    if (file.type.startsWith("image/")) { const reader = new FileReader(); reader.onload = (e) => onChangePhoto(e.target?.result as string); reader.readAsDataURL(file) }
  }

  const handleSave = () => { onChangeName(editValue); setIsEditing(false) }

  return (
    <div className="flex flex-col items-center gap-3 flex-1">
      <label className="relative cursor-pointer group">
        <div className="size-20 rounded-full bg-secondary border-2 border-border/50 overflow-hidden flex items-center justify-center transition-all group-hover:border-foreground/30">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt={label} className="size-full object-cover" />
          ) : (
            <Camera className="size-6 text-muted-foreground/50" />
          )}
        </div>
        <div className="absolute bottom-0 right-0 size-6 bg-foreground text-background rounded-full flex items-center justify-center shadow-md"><Pencil className="size-3" /></div>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(file) }} />
      </label>
      <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{label}</span>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} className="h-8 w-24 text-center text-sm rounded-xl" autoFocus />
          <button onClick={handleSave} className="size-6 rounded-full bg-foreground text-background flex items-center justify-center" aria-label="저장"><Check className="size-3" /></button>
        </div>
      ) : (
        <button onClick={() => { setEditValue(name); setIsEditing(true) }} className="text-sm font-medium hover:text-muted-foreground transition-colors">{name || "이름 입력"}</button>
      )}
    </div>
  )
}

/* ── Preference Tag ────────────────────────────────────── */
function PreferenceTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-secondary rounded-full px-3 py-1.5 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="text-muted-foreground hover:text-foreground transition-colors" aria-label={`${label} 삭제`}><X className="size-3" /></button>
    </span>
  )
}

/* ── Accordion Preference Section ──────────────────────── */
function AccordionPreference({ icon: Icon, title, items, onRemove, onAdd, suggestions }: {
  icon: React.ElementType; title: string; items: string[]; onRemove: (index: number) => void; onAdd: (item: string) => void; suggestions: string[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [addValue, setAddValue] = useState("")
  const availableSuggestions = suggestions.filter((s) => !items.includes(s))

  const handleAdd = () => { if (addValue.trim()) { onAdd(addValue.trim()); setAddValue(""); setIsAdding(false) } }

  return (
    <div className="border-b border-border/50 last:border-0">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between py-4 text-left">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          <span className="text-[10px] text-muted-foreground">{items.length}개</span>
        </div>
        {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      </button>
      {isOpen && (
        <div className="pb-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-2">
            {items.map((item, idx) => <PreferenceTag key={item} label={item} onRemove={() => onRemove(idx)} />)}
            {isAdding ? (
              <div className="flex items-center gap-1.5">
                <Input value={addValue} onChange={(e) => setAddValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleAdd()} className="h-8 w-24 text-xs rounded-xl" placeholder="직접 입력" autoFocus />
                <button onClick={handleAdd} className="size-6 rounded-full bg-foreground text-background flex items-center justify-center" aria-label="추가"><Check className="size-3" /></button>
                <button onClick={() => { setIsAdding(false); setAddValue("") }} className="size-6 rounded-full bg-secondary flex items-center justify-center" aria-label="취소"><X className="size-3" /></button>
              </div>
            ) : (
              <button onClick={() => setIsAdding(true)} className="inline-flex items-center gap-1 bg-transparent border border-dashed border-border rounded-full px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all">+ 추가</button>
            )}
          </div>
          {availableSuggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {availableSuggestions.slice(0, 4).map((s) => (
                <button key={s} onClick={() => onAdd(s)} className="text-[10px] text-muted-foreground/60 hover:text-foreground border border-transparent hover:border-border rounded-full px-2 py-1 transition-all">+ {s}</button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── QuickInfoRow ──────────────────────────────────────── */
function QuickInfoRow({ icon: Icon, label, value, onChange }: { icon: React.ElementType; label: string; value: string; onChange: (val: string) => void }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value)
  const handleSave = () => { onChange(editValue); setIsEditing(false) }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">{label}</span></div>
      {isEditing ? (
        <div className="flex items-center gap-1.5">
          <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSave()} className="h-7 w-28 text-xs text-right rounded-lg" autoFocus />
          <button onClick={handleSave} className="size-5 rounded-full bg-foreground text-background flex items-center justify-center" aria-label="저장"><Check className="size-2.5" /></button>
        </div>
      ) : (
        <button onClick={() => { setEditValue(value); setIsEditing(true) }} className="text-sm font-medium hover:text-muted-foreground transition-colors">{value || "입력하기"}</button>
      )}
    </div>
  )
}

/* ═══ Sub-Pages ═══════════════════════════════════════════ */

function SubPageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button onClick={onBack} className="size-8 rounded-full hover:bg-secondary flex items-center justify-center transition-colors" aria-label="돌아가기"><ArrowLeft className="size-4" /></button>
      <h2 className="text-lg font-medium">{title}</h2>
    </div>
  )
}

/* ── Edit Profile Page ─────────────────────────────────── */
function EditProfilePage({ onBack }: { onBack: () => void }) {
  const { coupleProfile, updateCoupleProfile } = useWedding()
  const [showUnlink, setShowUnlink] = useState(false)
  const [showDelete, setShowDelete] = useState(false)

  return (
    <div className="px-6 py-6 flex flex-col gap-6">
      <SubPageHeader title="내 정보 수정" onBack={onBack} />

      <div className="bg-card rounded-3xl border border-border/50 p-5 shadow-sm flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">신랑 이름</label>
          <Input value={coupleProfile.groomName} onChange={(e) => updateCoupleProfile({ groomName: e.target.value })} className="rounded-xl h-10" placeholder="신랑 이름" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">신부 이름</label>
          <Input value={coupleProfile.brideName} onChange={(e) => updateCoupleProfile({ brideName: e.target.value })} className="rounded-xl h-10" placeholder="신부 이름" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">결혼 예정일</label>
          <Input type="date" value={coupleProfile.weddingDate} onChange={(e) => updateCoupleProfile({ weddingDate: e.target.value })} className="rounded-xl h-10" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={() => setShowUnlink(true)} variant="outline" className="w-full rounded-full h-11 text-sm">커플 매칭 해제</Button>
        <Button onClick={() => setShowDelete(true)} variant="outline" className="w-full rounded-full h-11 text-sm text-destructive border-destructive/30 hover:bg-destructive/5">회원 탈퇴</Button>
      </div>

      <Dialog open={showUnlink} onOpenChange={setShowUnlink}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle>커플 매칭 해제</DialogTitle><DialogDescription>정말로 커플 매칭을 해제하시겠습니까? 상대방에게도 알림이 전달됩니다.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button variant="destructive" onClick={() => setShowUnlink(false)} className="w-full rounded-full h-11">해제하기</Button>
            <Button variant="outline" onClick={() => setShowUnlink(false)} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle>회원 탈퇴</DialogTitle><DialogDescription>정말로 탈퇴하시겠습니까? 모든 데이터가 삭제되며 복구할 수 없습니다.</DialogDescription></DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button variant="destructive" onClick={() => setShowDelete(false)} className="w-full rounded-full h-11">탈퇴하기</Button>
            <Button variant="outline" onClick={() => setShowDelete(false)} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Favorites Page ────────────────────────────────────── */
function FavoritesPage({ onBack }: { onBack: () => void }) {
  const { vendors, favoriteIds, toggleFavorite } = useWedding()
  const favVendors = vendors.filter((v) => favoriteIds.includes(v.id))

  return (
    <div className="px-6 py-6 flex flex-col gap-6">
      <SubPageHeader title="찜 목록" onBack={onBack} />
      {favVendors.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/50 p-12 text-center shadow-sm">
          <Heart className="size-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">찜한 업체가 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {favVendors.map((v) => (
            <div key={v.id} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm flex items-center gap-4">
              <div className="size-14 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                <Store className="size-5 text-muted-foreground/40" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium truncate">{v.name}</h4>
                <p className="text-xs text-muted-foreground">{v.category === "studio" ? "스튜디오" : v.category === "dress" ? "드레스" : v.category === "makeup" ? "메이크업" : "웨딩홀"}</p>
              </div>
              <button onClick={() => toggleFavorite(v.id)} aria-label="찜 해제">
                <Heart className="size-5 fill-foreground text-foreground" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Payments Page ─────────────────────────────────────── */
function PaymentsPage({ onBack }: { onBack: () => void }) {
  const { payments } = useWedding()
  const total = payments.filter((p) => p.status === "completed").reduce((s, p) => s + p.amount, 0)

  return (
    <div className="px-6 py-6 flex flex-col gap-6">
      <SubPageHeader title="나의 결제 내역" onBack={onBack} />
      {payments.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/50 p-12 text-center shadow-sm">
          <Wallet className="size-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">결제 내역이 없습니다</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {payments.map((p) => (
              <div key={p.id} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{p.vendorName}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium",
                    p.status === "completed" ? "bg-foreground text-background" : p.status === "pending" ? "bg-secondary text-muted-foreground" : "bg-destructive/10 text-destructive"
                  )}>
                    {p.status === "completed" ? "결제완료" : p.status === "pending" ? "결제예정" : "취소"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.date}</span>
                  <span>{p.type === "deposit" ? "계약금" : "잔금"}</span>
                </div>
                <p className="text-lg font-light mt-2">{p.amount.toLocaleString()}원</p>
              </div>
            ))}
          </div>
          <div className="bg-foreground text-background rounded-3xl p-5">
            <span className="text-xs opacity-70">총 결제 금액</span>
            <p className="text-2xl font-light mt-1">{total.toLocaleString()}원</p>
          </div>
        </>
      )}
    </div>
  )
}

/* ── Reservations Page ─────────────────────────────────── */
function ReservationsPage({ onBack }: { onBack: () => void }) {
  const { reservations, updateReservation, cancelReservation } = useWedding()
  const catLabel: Record<string, string> = { studio: "스튜디오", dress: "드레스", makeup: "메이크업", hall: "웨딩홀" }
  const [changeTargetId, setChangeTargetId] = useState<string | null>(null)
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null)
  const [newServiceDate, setNewServiceDate] = useState("")

  const handleChange = () => {
    if (!changeTargetId || !newServiceDate) return
    updateReservation(changeTargetId, { serviceDate: newServiceDate })
    setChangeTargetId(null)
    setNewServiceDate("")
  }

  return (
    <div className="px-6 py-6 flex flex-col gap-6">
      <SubPageHeader title="예약 관리" onBack={onBack} />
      {reservations.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/50 p-12 text-center shadow-sm">
          <ClipboardList className="size-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">예약 내역이 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {reservations.map((r) => (
            <div key={r.id} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm flex gap-4">
              <div className="size-16 rounded-2xl bg-secondary flex items-center justify-center shrink-0">
                <Store className="size-5 text-muted-foreground/40" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">{r.vendorName}</h4>
                <span className="text-[10px] text-muted-foreground">{catLabel[r.category] || r.category}</span>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>예약일: {r.reservationDate}</span>
                </div>
                <div className="text-xs text-muted-foreground">서비스일: {r.serviceDate}</div>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 rounded-full h-8 text-xs gap-1"
                    onClick={() => { setNewServiceDate(r.serviceDate); setChangeTargetId(r.id) }}
                  >
                    <CalendarCheck className="size-3" />예약 변경
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 rounded-full h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setCancelTargetId(r.id)}
                  >
                    예약 취소
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 예약 변경 Dialog */}
      <Dialog open={!!changeTargetId} onOpenChange={(open) => { if (!open) { setChangeTargetId(null); setNewServiceDate("") } }}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>예약 변경</DialogTitle>
            <DialogDescription>변경할 서비스 날짜를 선택해주세요</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5 py-2">
            <label className="text-xs text-muted-foreground font-medium">서비스 날짜</label>
            <Input type="date" value={newServiceDate} onChange={(e) => setNewServiceDate(e.target.value)} className="rounded-xl h-10" />
          </div>
          <DialogFooter className="flex-col gap-2">
            <Button onClick={handleChange} disabled={!newServiceDate} className="w-full rounded-full h-11">변경하기</Button>
            <Button variant="outline" onClick={() => { setChangeTargetId(null); setNewServiceDate("") }} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 예약 취소 Dialog */}
      <Dialog open={!!cancelTargetId} onOpenChange={(open) => { if (!open) setCancelTargetId(null) }}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>예약 취소</DialogTitle>
            <DialogDescription>예약을 취소하면 되돌릴 수 없습니다. 정말 취소하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button variant="destructive" onClick={() => { if (cancelTargetId) { cancelReservation(cancelTargetId); setCancelTargetId(null) } }} className="w-full rounded-full h-11">예약 취소</Button>
            <Button variant="outline" onClick={() => setCancelTargetId(null)} className="w-full rounded-full h-11">돌아가기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── My Reviews Page ───────────────────────────────────── */
function MyReviewsPage({ onBack }: { onBack: () => void }) {
  const { reviews, updateReview, removeReview, vendors } = useWedding()
  const myReviews = reviews.filter((r) => r.userName === "나")
  const [editTarget, setEditTarget] = useState<{ id: string; rating: number; text: string } | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  const handleEditSave = () => {
    if (!editTarget || !editTarget.text.trim()) return
    updateReview(editTarget.id, { rating: editTarget.rating, text: editTarget.text.trim() })
    setEditTarget(null)
  }

  return (
    <div className="px-6 py-6 flex flex-col gap-6">
      <SubPageHeader title="리뷰 관리" onBack={onBack} />
      {myReviews.length === 0 ? (
        <div className="bg-card rounded-3xl border border-border/50 p-12 text-center shadow-sm">
          <Star className="size-8 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">작성한 리뷰가 없습니다</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {myReviews.map((r) => {
            const vendor = vendors.find((v) => v.id === r.vendorId)
            return (
              <div key={r.id} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{vendor?.name ?? r.vendorId}</span>
                  <span className="text-[10px] text-muted-foreground">{r.date}</span>
                </div>
                <div className="flex items-center gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={cn("size-3", i < r.rating ? "fill-foreground text-foreground" : "text-border")} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{r.text}</p>
                <div className="flex gap-2 mt-3">
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 rounded-full h-8 text-xs gap-1"
                    onClick={() => setEditTarget({ id: r.id, rating: r.rating, text: r.text })}
                  >
                    <Pencil className="size-3" />수정
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    className="flex-1 rounded-full h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setDeleteTargetId(r.id)}
                  >
                    <Trash2 className="size-3" />삭제
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 리뷰 수정 Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null) }}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle>리뷰 수정</DialogTitle></DialogHeader>
          {editTarget && (
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">별점</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => setEditTarget({ ...editTarget, rating: s })} className="p-0.5" aria-label={`별점 ${s}점`}>
                      <Star className={cn("size-6 transition-colors", s <= editTarget.rating ? "fill-foreground text-foreground" : "text-border")} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground font-medium">후기</label>
                <textarea
                  value={editTarget.text}
                  onChange={(e) => setEditTarget({ ...editTarget, text: e.target.value })}
                  className="h-24 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}
          <DialogFooter className="flex-col gap-2">
            <Button onClick={handleEditSave} disabled={!editTarget?.text.trim()} className="w-full rounded-full h-11">저장하기</Button>
            <Button variant="outline" onClick={() => setEditTarget(null)} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 리뷰 삭제 Dialog */}
      <Dialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null) }}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle>리뷰 삭제</DialogTitle>
            <DialogDescription>이 리뷰를 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2">
            <Button variant="destructive" onClick={() => { if (deleteTargetId) { removeReview(deleteTargetId); setDeleteTargetId(null) } }} className="w-full rounded-full h-11">삭제하기</Button>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)} className="w-full rounded-full h-11">취소</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── My Cards Page ─────────────────────────────────────── */
function MyCardsPage({ onBack }: { onBack: () => void }) {
  const { registeredCards, addCard, removeCard } = useWedding()
  const [showAddCard, setShowAddCard] = useState(false)
  const [cardStep, setCardStep] = useState<"company" | "number">("company")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [cardNumber, setCardNumber] = useState("")

  const companies = ["삼성카드", "신한카드", "현대카드", "KB국민카드", "롯데카드", "하나카드", "우리카드", "NH농협카드"]

  const handleAddCard = () => {
    if (!cardNumber || cardNumber.length < 4) return
    addCard({ company: selectedCompany, lastFour: cardNumber.slice(-4), nickname: `${selectedCompany} ${cardNumber.slice(-4)}` })
    setShowAddCard(false); setCardStep("company"); setSelectedCompany(""); setCardNumber("")
  }

  return (
    <div className="px-6 py-6 flex flex-col gap-6">
      <SubPageHeader title="내 카드 등록" onBack={onBack} />

      {registeredCards.length > 0 && (
        <div className="flex flex-col gap-3">
          {registeredCards.map((card) => (
            <div key={card.id} className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm flex items-center gap-4">
              <div className="size-12 rounded-xl bg-foreground text-background flex items-center justify-center shrink-0"><CreditCard className="size-5" /></div>
              <div className="flex-1">
                <h4 className="text-sm font-medium">{card.company}</h4>
                <p className="text-xs text-muted-foreground">**** {card.lastFour}</p>
              </div>
              <button onClick={() => removeCard(card.id)} className="text-muted-foreground hover:text-destructive transition-colors" aria-label="카드 삭제"><Trash2 className="size-4" /></button>
            </div>
          ))}
        </div>
      )}

      <Button onClick={() => setShowAddCard(true)} variant="outline" className="w-full rounded-full h-11 text-sm gap-2">
        <CreditCard className="size-4" />카드 추가하기
      </Button>

      <Dialog open={showAddCard} onOpenChange={(open) => { setShowAddCard(open); if (!open) { setCardStep("company"); setSelectedCompany(""); setCardNumber("") } }}>
        <DialogContent className="rounded-3xl max-w-sm mx-auto">
          <DialogHeader><DialogTitle>{cardStep === "company" ? "카드사 선택" : "카드 번호 입력"}</DialogTitle></DialogHeader>
          {cardStep === "company" ? (
            <div className="grid grid-cols-2 gap-2 py-2">
              {companies.map((c) => (
                <button key={c} onClick={() => { setSelectedCompany(c); setCardStep("number") }}
                  className="rounded-2xl border border-border/50 p-3 text-sm font-medium hover:bg-secondary transition-colors text-center">{c}</button>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4 py-2">
              <p className="text-xs text-muted-foreground">{selectedCompany} 선택됨</p>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, "").slice(0, 16))} placeholder="카드 번호 16자리" className="rounded-xl h-10 text-center tracking-widest" maxLength={16} />
              <DialogFooter className="flex-col gap-2">
                <Button onClick={handleAddCard} disabled={cardNumber.length < 13} className="w-full rounded-full h-11">등록하기</Button>
                <Button variant="outline" onClick={() => setCardStep("company")} className="w-full rounded-full h-11">카드사 다시 선택</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Invite Dialog ─────────────────────────────────────── */
function InviteDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [phone, setPhone] = useState("")
  const [sent, setSent] = useState(false)

  const handleSend = () => {
    if (!phone.trim()) return
    setSent(true)
    setTimeout(() => { setSent(false); setPhone(""); onOpenChange(false) }, 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>상대방 초대하기</DialogTitle>
          <DialogDescription>신랑 또는 신부의 전화번호를 입력하면 초대 링크가 전송됩니다</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="py-8 text-center">
            <Check className="size-10 mx-auto text-foreground mb-3" />
            <p className="text-sm font-medium">초대 링크를 발송했습니다</p>
          </div>
        ) : (
          <>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="rounded-xl h-10" />
            <DialogFooter className="flex-col gap-2">
              <Button onClick={handleSend} disabled={!phone.trim()} className="w-full rounded-full h-11 gap-2"><Send className="size-4" />초대 링크 발송</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full rounded-full h-11">취소</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

/* ═══ Main MyPage ════════════════════════════════════════ */

export function MyPage({ subPage, onSubPageChange }: { subPage: SubPage; onSubPageChange: (page: SubPage) => void }) {
  const { coupleProfile, updateCoupleProfile, updatePreferences } = useWedding()
  const [showInvite, setShowInvite] = useState(false)

  const handleRemovePreference = (key: keyof typeof coupleProfile.preferences, index: number) => {
    const current = coupleProfile.preferences[key]
    if (Array.isArray(current)) { const updated = [...current]; updated.splice(index, 1); updatePreferences({ [key]: updated }) }
  }

  const handleAddPreference = (key: keyof typeof coupleProfile.preferences, item: string) => {
    const current = coupleProfile.preferences[key]
    if (Array.isArray(current) && !current.includes(item)) updatePreferences({ [key]: [...current, item] })
  }

  /* Sub-page routing */
  if (subPage === "edit-profile") return <EditProfilePage onBack={() => onSubPageChange("main")} />
  if (subPage === "favorites") return <FavoritesPage onBack={() => onSubPageChange("main")} />
  if (subPage === "payments") return <PaymentsPage onBack={() => onSubPageChange("main")} />
  if (subPage === "reservations") return <ReservationsPage onBack={() => onSubPageChange("main")} />
  if (subPage === "my-reviews") return <MyReviewsPage onBack={() => onSubPageChange("main")} />
  if (subPage === "my-cards") return <MyCardsPage onBack={() => onSubPageChange("main")} />

  return (
    <div className="px-6 py-8 flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl">마이페이지</h2>
        <p className="text-sm text-muted-foreground mt-1">두 분의 웨딩 정보와 취향을 관리하세요</p>
      </div>

      {/* Couple Profiles */}
      <div className="bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
        <div className="flex items-center justify-center gap-6">
          <ProfileCard label="신랑" name={coupleProfile.groomName} onChangeName={(name) => updateCoupleProfile({ groomName: name })} photo={coupleProfile.groomPhoto} onChangePhoto={(photo) => updateCoupleProfile({ groomPhoto: photo })} />
          <div className="flex flex-col items-center gap-1 shrink-0"><Heart className="size-5 text-muted-foreground/40" /></div>
          <ProfileCard label="신부" name={coupleProfile.brideName} onChangeName={(name) => updateCoupleProfile({ brideName: name })} photo={coupleProfile.bridePhoto} onChangePhoto={(photo) => updateCoupleProfile({ bridePhoto: photo })} />
        </div>
        <div className="flex justify-center mt-4">
          <Button onClick={() => setShowInvite(true)} variant="outline" size="sm" className="rounded-full h-8 gap-1.5 text-xs">
            <Link2 className="size-3" />상대방 초대하기
          </Button>
        </div>
      </div>

      {/* D-Day */}
      <div className="bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
        <DdayCounter weddingDate={coupleProfile.weddingDate} />
      </div>

      {/* AI Info */}
      <div className="bg-foreground text-background rounded-3xl p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="size-5 shrink-0 mt-0.5 opacity-80" />
          <div>
            <p className="text-xs font-medium">AI 맞춤 추천에 활용됩니다</p>
            <p className="text-xs opacity-70 mt-1 leading-relaxed">아래 취향 정보를 상세하게 입력할수록 AI가 더 정확한 업체 추천과 웨딩 플래닝을 제공합니다.</p>
          </div>
        </div>
      </div>

      {/* Preferences (Accordion) */}
      <div className="bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-2">취향 & 선호도</h3>
        <AccordionPreference icon={Palette} title="웨딩 스타일" items={coupleProfile.preferences.style} onRemove={(idx) => handleRemovePreference("style", idx)} onAdd={(item) => handleAddPreference("style", item)} suggestions={["클래식", "모던", "빈티지", "가든", "미니멀", "보헤미안", "럭셔리"]} />
        <AccordionPreference icon={Palette} title="컬러 테마" items={coupleProfile.preferences.colors} onRemove={(idx) => handleRemovePreference("colors", idx)} onAdd={(item) => handleAddPreference("colors", item)} suggestions={["화이트", "골드", "블러쉬핑크", "네이비", "아이보리", "그린", "버건디"]} />
        <AccordionPreference icon={Heart} title="분위기" items={coupleProfile.preferences.mood} onRemove={(idx) => handleRemovePreference("mood", idx)} onAdd={(item) => handleAddPreference("mood", item)} suggestions={["우아한", "로맨틱", "캐주얼", "화려한", "차분한", "유니크", "따뜻한"]} />
        <AccordionPreference icon={Utensils} title="식사 선호" items={coupleProfile.preferences.food} onRemove={(idx) => handleRemovePreference("food", idx)} onAdd={(item) => handleAddPreference("food", item)} suggestions={["한식 뷔페", "양식 코스", "한정식", "중식", "디저트 바", "칵테일 파티"]} />
      </div>

      {/* Quick Info */}
      <div className="bg-card rounded-3xl border border-border/50 p-6 shadow-sm">
        <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">기본 정보</h3>
        <div className="flex flex-col gap-4">
          <QuickInfoRow icon={Users} label="예상 하객 수" value={coupleProfile.preferences.guestCount} onChange={(val) => updatePreferences({ guestCount: val })} />
          <QuickInfoRow icon={MapPin} label="선호 장소" value={coupleProfile.preferences.venue} onChange={(val) => updatePreferences({ venue: val })} />
        </div>
      </div>

      <InviteDialog open={showInvite} onOpenChange={setShowInvite} />
    </div>
  )
}
