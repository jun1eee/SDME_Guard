"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchVendorDetail } from "@/lib/api/vendor-detail"
import { VendorDetailView, type Vendor } from "@/components/views/vendors-view"

export function VendorDetailPage({ vendorId }: { vendorId: string }) {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const loadDetail = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const result = await fetchVendorDetail(vendorId)
        if (!cancelled) setVendor(result)
      } catch {
        if (!cancelled) setError("?낆껜 ?곸꽭 ?뺣낫瑜?遺덈윭?ㅼ? 紐삵뻽?듬땲??")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void loadDetail()
    return () => {
      cancelled = true
    }
  }, [vendorId])

  if (isLoading) {
    return <div className="min-h-screen bg-background px-4 py-10 text-sm text-muted-foreground">?낆껜 ?뺣낫瑜?遺덈윭?ㅻ뒗 以묒엯?덈떎.</div>
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <Button asChild variant="outline" className="rounded-full">
          <Link href="/vendor"><ArrowLeft className="mr-2 size-4" />紐⑸줉?쇰줈</Link>
        </Button>
        <p className="mt-4 text-sm text-muted-foreground">{error ?? "?낆껜 ?뺣낫瑜?李얠쓣 ???놁뒿?덈떎."}</p>
      </div>
    )
  }

  return (
    <VendorDetailView
      vendor={vendor}
      onBack={() => window.history.back()}
      onToggleFavorite={() => setVendor((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : prev))}
      onAddReview={() => undefined}
    />
  )
}

