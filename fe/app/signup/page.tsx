"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAccessToken, tryReissue, getMyInfo } from "@/lib/api"
import { SetupScreen } from "@/components/setup-screen"

export default function SignupPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const check = async () => {
      // accessToken 없으면 refreshToken으로 재발급 시도
      if (!getAccessToken()) {
        const ok = await tryReissue()
        if (!ok) {
          router.replace("/login") // 로그인 안 됨
          return
        }
      }
      // 이미 가입 완료된 유저인지 확인
      try {
        const res = await getMyInfo()
        if (res.data.role) {
          router.replace("/main") // 이미 가입 완료 → 메인
          return
        }
      } catch {
        router.replace("/login")
        return
      }
      setReady(true)
    }
    check()
  }, [router])

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  return (
    <SetupScreen
      onComplete={() => {
        router.replace("/main")
      }}
    />
  )
}
