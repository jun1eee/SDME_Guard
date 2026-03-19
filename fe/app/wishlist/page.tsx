"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function WishlistRedirect() {
  const router = useRouter()

  useEffect(() => {
    sessionStorage.setItem("pendingView", "wishlist")
    router.replace("/main")
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted-foreground">로딩 중...</p>
    </div>
  )
}
