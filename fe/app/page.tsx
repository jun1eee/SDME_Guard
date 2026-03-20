"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAccessToken, tryReissue, getMyInfo } from "@/lib/api"

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const redirect = async () => {
      // 브라우저 세션 체크
      if (!sessionStorage.getItem("loggedIn")) {
        router.replace("/login")
        return
      }
      // 로그인 상태 확인
      if (getAccessToken() || (await tryReissue())) {
        try {
          const res = await getMyInfo()
          if (res.data.role) {
            router.replace("/main")
            return
          }
          router.replace("/signup")
          return
        } catch {
          // 토큰 무효
        }
      }
      router.replace("/login")
    }
    redirect()
  }, [router])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted-foreground">로딩 중...</p>
    </div>
  )
}
