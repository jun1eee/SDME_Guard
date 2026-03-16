"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { MessageCircle } from "lucide-react"
import { getAccessToken, tryReissue, getMyInfo } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      // 이미 accessToken이 있거나 refreshToken으로 재발급 가능하면
      if (getAccessToken() || (await tryReissue())) {
        try {
          const res = await getMyInfo()
          if (res.data.role) {
            router.replace("/main") // 가입 완료 → 메인
          } else {
            router.replace("/signup") // 카카오 로그인은 됐지만 가입 미완료
          }
          return
        } catch {
          // 토큰 무효 → 로그인 화면 보여줌
        }
      }
      setChecking(false)
    }
    check()
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
          <img src="/favicon.png" alt="SDME Guard" className="size-9 object-contain" />
        </div>
        <span className="text-lg font-semibold tracking-tight text-foreground">SDME Guard</span>
      </div>

      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">카카오톡으로 시작하기</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            먼저 로그인한 뒤 프로필을 설정하고 사전질문을 진행해주세요.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=d143e4e938c56d6325443d24bbebb2ac&redirect_uri=${encodeURIComponent("http://localhost:3000/login/callback")}&response_type=code`
          }}
          className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#FEE500] py-3 text-sm font-medium text-[#191919] transition-all hover:bg-[#FEE500]/90"
        >
          <MessageCircle className="size-5 fill-current" />
          카카오톡 로그인
        </button>

        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-sm text-muted-foreground">
            로그인 후 이름, 닉네임, 역할과 몇 가지 결혼 준비 질문에 답하게 됩니다.
          </p>
        </div>
      </div>

      <p className="mt-10 text-center text-xs text-muted-foreground">
        AI 기반 일정 관리로 결혼 준비를 더 차분하게 정리해보세요.
      </p>
    </div>
  )
}
