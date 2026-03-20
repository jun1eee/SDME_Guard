"use client"

import { useRouter, useSearchParams } from "next/navigation"

export default function CardFailPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get("message") || "카드 등록에 실패했습니다."

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
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
      </div>
    </div>
  )
}
