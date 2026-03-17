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
        if (res.data.isNewUser) {
          sessionStorage.setItem("kakaoNickname", res.data.kakaoNickname || "")
          sessionStorage.setItem("kakaoProfileImage", res.data.kakaoProfileImage || "")
          router.replace('/signup') // 신규 → 회원가입
        } else {
          router.replace('/main') // 기존 → 메인
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
