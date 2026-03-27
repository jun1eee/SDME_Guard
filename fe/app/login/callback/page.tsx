'use client'

import { Suspense, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { kakaoLogin, setAccessToken } from '@/lib/api'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const called = useRef(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code || called.current) return
    called.current = true

    kakaoLogin(code)
      .then((res) => {
        setAccessToken(res.data.accessToken)

        sessionStorage.setItem("loggedIn", "true")

        // 카카오 로그인 중 쌓인 히스토리(카카오 페이지들) 제거
        const destination = res.data.isNewUser ? "/signup" : "/main"
        if (res.data.isNewUser) {
          sessionStorage.setItem("kakaoNickname", res.data.kakaoNickname || "")
          sessionStorage.setItem("kakaoProfileImage", res.data.kakaoProfileImage || "")
        }

        // historyLengthBeforeKakao 는 카카오 이동 전 history.length
        // window.location.href 로 이동했으므로 /login 엔트리가 살아있음
        // history.go(-stepsBack) → /login 으로 돌아가면 /login 이 로그인 감지 후 /main 으로 리다이렉트
        const lengthBefore = parseInt(sessionStorage.getItem("historyLengthBeforeKakao") || "0")
        const stepsBack = lengthBefore > 0 ? window.history.length - lengthBefore : 0
        sessionStorage.removeItem("historyLengthBeforeKakao")

        if (stepsBack > 0) {
          window.history.go(-stepsBack)
        } else {
          window.location.replace(destination)
        }
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [searchParams, router])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <p className="text-sm text-muted-foreground">로그인 중...</p>
    </div>
  )
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">로그인 중...</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  )
}
