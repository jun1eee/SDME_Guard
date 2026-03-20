"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { registerCard, tryReissue } from "@/lib/api"

function SuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")

  useEffect(() => {
    const authKey = searchParams.get("authKey")
    const customerKey = searchParams.get("customerKey")

    if (!authKey || !customerKey) {
      setStatus("error")
      setMessage("카드 인증 정보가 없습니다.")
      return
    }

    tryReissue().then(() => registerCard({ authKey, customerKey }))
      .then(() => {
        setStatus("success")
        setMessage("카드가 등록되었습니다!")
        setTimeout(() => {
          sessionStorage.setItem("pendingView", "my-page")
          router.replace("/main")
        }, 1500)
      })
      .catch((err) => {
        setStatus("error")
        setMessage(err.message || "카드 등록에 실패했습니다.")
      })
  }, [searchParams, router])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        {status === "loading" && <p className="text-sm text-muted-foreground">카드 등록 중...</p>}
        {status === "success" && (
          <>
            <p className="text-lg font-semibold text-foreground">카드 등록 완료!</p>
            <p className="mt-2 text-sm text-muted-foreground">마이페이지로 이동합니다...</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-lg font-semibold text-destructive">카드 등록 실패</p>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <button
              onClick={() => {
                sessionStorage.setItem("pendingView", "my-page")
                router.replace("/main")
              }}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              돌아가기
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CardSuccessPage() {
  return (
    <Suspense fallback={<div className="flex min-h-dvh items-center justify-center"><p className="text-sm text-muted-foreground">로딩 중...</p></div>}>
      <SuccessContent />
    </Suspense>
  )
}
