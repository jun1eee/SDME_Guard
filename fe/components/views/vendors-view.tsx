"use client"

import { useState } from "react"
import { 
  Plus, 
  Phone,
  MapPin,
  Star,
  Heart,
  Check,
  Clock,
  ExternalLink,
  Search,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"

interface Vendor {
  id: string
  category: "all" | "studio" | "dress" | "makeup" | "venue"
  name: string
  contact: string
  location: string
  rating: number
  reviewCount: number
  status: "confirmed" | "pending" | "considering"
  price: string
  image?: string
  isFavorite: boolean
}

const initialVendors: Vendor[] = [
  { 
    id: "1", 
    category: "venue",
    name: "더 그랜드 파빌리온", 
    contact: "02-1234-5678",
    location: "서울 강남구 청담동",
    rating: 4.8,
    reviewCount: 256,
    status: "confirmed",
    price: "900만원~",
    isFavorite: true,
  },
  { 
    id: "2", 
    category: "studio",
    name: "로앤스튜디오", 
    contact: "02-2345-6789",
    location: "서울 강남구 논현동",
    rating: 4.9,
    reviewCount: 189,
    status: "pending",
    price: "250만원~",
    isFavorite: true,
  },
  { 
    id: "3", 
    category: "dress",
    name: "메종 블랑쉬 아틀리에", 
    contact: "02-3456-7890",
    location: "서울 강남구 신사동",
    rating: 4.7,
    reviewCount: 143,
    status: "pending",
    price: "200만원~",
    isFavorite: false,
  },
  { 
    id: "4", 
    category: "makeup",
    name: "글로우 뷰티", 
    contact: "02-4567-8901",
    location: "서울 강남구 청담동",
    rating: 4.6,
    reviewCount: 98,
    status: "considering",
    price: "100만원~",
    isFavorite: false,
  },
  { 
    id: "5", 
    category: "studio",
    name: "아이디스튜디오", 
    contact: "02-5678-9012",
    location: "서울 서초구 반포동",
    rating: 4.5,
    reviewCount: 167,
    status: "considering",
    price: "200만원~",
    isFavorite: false,
  },
  { 
    id: "6", 
    category: "dress",
    name: "로자스피사", 
    contact: "02-6789-0123",
    location: "서울 강남구 압구정동",
    rating: 4.8,
    reviewCount: 212,
    status: "considering",
    price: "250만원~",
    isFavorite: true,
  },
]

const categories = [
  { id: "all", label: "전체" },
  { id: "studio", label: "스튜디오" },
  { id: "dress", label: "드레스" },
  { id: "makeup", label: "메이크업" },
  { id: "venue", label: "웨딩홀" },
] as const

type CategoryType = typeof categories[number]["id"]

const statusConfig = {
  confirmed: { label: "확정", color: "bg-primary text-primary-foreground" },
  pending: { label: "검토중", color: "bg-yellow-100 text-yellow-700" },
  considering: { label: "고려중", color: "bg-muted text-muted-foreground" },
}

export function VendorsView() {
  const [vendors, setVendors] = useState<Vendor[]>(initialVendors)
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddForm, setShowAddForm] = useState(false)

  const filteredVendors = vendors.filter(vendor => {
    const matchesCategory = selectedCategory === "all" || vendor.category === selectedCategory
    const matchesSearch = vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleFavorite = (id: string) => {
    setVendors(vendors.map(v => 
      v.id === id ? { ...v, isFavorite: !v.isFavorite } : v
    ))
  }

  const updateStatus = (id: string, status: Vendor["status"]) => {
    setVendors(vendors.map(v => v.id === id ? { ...v, status } : v))
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">업체</h1>
          <p className="mt-1 text-muted-foreground">AI가 엄선한 최고의 웨딩 업체</p>
        </div>

        {/* Category Tabs */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                selectedCategory === cat.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-6 relative">
          <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="업체명으로 검색..."
            className="h-12 rounded-xl bg-card pl-12 text-base"
          />
        </div>

        {/* Add Button */}
        <div className="mb-6">
          <Button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-5" />
            업체 추가
          </Button>
        </div>

        {showAddForm && (
          <AddVendorForm
            onAdd={(vendor) => {
              setVendors([...vendors, { ...vendor, id: Date.now().toString() }])
              setShowAddForm(false)
            }}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {/* Vendor Cards */}
        <div className="space-y-4">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="rounded-2xl bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex gap-4">
                {/* Image placeholder */}
                <div className="size-24 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                  {vendor.image ? (
                    <Image
                      src={vendor.image}
                      alt={vendor.name}
                      width={96}
                      height={96}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-2xl text-muted-foreground">
                      {vendor.name[0]}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground">{vendor.name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusConfig[vendor.status].color}`}>
                          {statusConfig[vendor.status].label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm">
                        <Star className="size-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-foreground">{vendor.rating}</span>
                        <span className="text-muted-foreground">({vendor.reviewCount})</span>
                      </div>
                    </div>
                    <button
                      onClick={() => toggleFavorite(vendor.id)}
                      className="rounded-full p-2 hover:bg-muted"
                    >
                      <Heart 
                        className={`size-5 ${vendor.isFavorite ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} 
                      />
                    </button>
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="size-4" />
                      <span>{vendor.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="size-4" />
                      <span>{vendor.contact}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-primary">{vendor.price}</span>
                    <div className="flex gap-2">
                      {vendor.status !== "confirmed" && (
                        <button
                          onClick={() => updateStatus(vendor.id, "confirmed")}
                          className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
                        >
                          확정
                        </button>
                      )}
                      <button className="rounded-lg bg-muted px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/80">
                        상세보기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredVendors.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">해당 카테고리에 업체가 없습니다</p>
          </div>
        )}
      </div>
    </div>
  )
}

function AddVendorForm({
  onAdd,
  onCancel,
}: {
  onAdd: (vendor: Omit<Vendor, "id">) => void
  onCancel: () => void
}) {
  const [category, setCategory] = useState<CategoryType>("studio")
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [location, setLocation] = useState("")
  const [price, setPrice] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !contact) return
    
    onAdd({
      category,
      name,
      contact,
      location,
      rating: 0,
      reviewCount: 0,
      status: "considering",
      price,
      isFavorite: false,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-2xl bg-card p-4 shadow-sm">
      <h3 className="mb-4 font-semibold text-foreground">새 업체 추가</h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">카테고리</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as CategoryType)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
          >
            {categories.filter(c => c.id !== "all").map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">업체명</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 로앤스튜디오"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">연락처</label>
          <Input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="02-1234-5678"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-muted-foreground">위치</label>
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="서울 강남구"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-sm text-muted-foreground">가격대</label>
          <Input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="200만원~"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="bg-primary text-primary-foreground">
          추가
        </Button>
      </div>
    </form>
  )
}
