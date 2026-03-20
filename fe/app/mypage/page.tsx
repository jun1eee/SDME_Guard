"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function MyPageRedirect() {
  const router = useRouter()

  useEffect(() => {
    // main 페이지로 이동하면서 my-page 뷰를 활성화
    sessionStorage.setItem("pendingView", "my-page")
    router.replace("/main")
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted-foreground">로딩 중...</p>
    </div>
  )
}
