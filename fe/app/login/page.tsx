"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { getAccessToken, tryReissue, getMyInfo } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // bfcache 복원 시에도 로그인 상태 확인 (뒤로가기로 /login 복원 시)
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && sessionStorage.getItem("loggedIn")) {
        router.replace("/main")
      }
    }
    window.addEventListener("pageshow", handlePageShow)

    const check = async () => {
      // 이미 accessToken이 있거나 refreshToken으로 재발급 가능하면
      // 브라우저 세션이 살아있으면(새로고침 등) 자동 로그인 시도
      if (sessionStorage.getItem("loggedIn")) {
        if (getAccessToken() || (await tryReissue())) {
          try {
            const res = await getMyInfo()
            if (res.data.role) {
              router.replace("/main")
              return
            } else {
              router.replace("/signup")
              return
            }
          } catch {
            // 토큰 무효
          }
        }
      }
      setChecking(false)
    }
    check()
    return () => window.removeEventListener("pageshow", handlePageShow)
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">로딩 중...</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <img src="/favicon.png" alt="SDM Guard" className="size-9 object-contain" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">SDM Guard</span>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">두 사람의 특별한 날을</h1>
          <h1 className="text-2xl font-bold text-primary">함께 완성해요</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            스드메부터 웨딩홀까지, AI가 함께하는<br />
            스마트한 웨딩 플래닝을 경험해보세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            const redirectUri = `${window.location.origin}/login/callback`
            sessionStorage.setItem("historyLengthBeforeKakao", String(window.history.length))
            window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=d143e4e938c56d6325443d24bbebb2ac&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&prompt=login`
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] py-3 text-sm font-medium text-[#191919] transition-all hover:bg-[#FEE500]/90"
        >
          <MessageCircle className="size-5 fill-current" />
          카카오톡 로그인
        </button>

      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        설레는 웨딩 준비의 모든 순간, SDM Guard가 함께합니다.
      </p>
    </div>
  )
}
