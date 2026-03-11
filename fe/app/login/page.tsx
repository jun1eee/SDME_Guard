'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 3C6.477 3 2 6.463 2 10.691c0 2.722 1.804 5.108 4.508 6.458-.163.6-.591 2.175-.677 2.512-.106.417.153.41.322.299.133-.088 2.116-1.44 2.975-2.027.27.038.547.058.828.067h.044c.281 0 .558-.01.828-.029C17.523 17.891 22 14.462 22 10.691 22 6.463 17.523 3 12 3Z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()

  const handleKakaoLogin = () => {
    router.push('/signup')
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="w-full max-w-lg space-y-10">
        {/* 로고 & 타이틀 */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-secondary">
            <span className="text-4xl">💒</span>
          </div>
          <h1 className="font-serif text-3xl">Sudme Gaurd</h1>
          <p className="text-sm text-muted-foreground">
            AI가 함께하는 스마트 웨딩 플래너
          </p>
        </div>

        {/* 카카오 로그인 버튼 */}
        <div className="space-y-4">
          <Button
            onClick={handleKakaoLogin}
            className="w-full rounded-full h-12 bg-[#FEE500] text-[#191919] hover:bg-[#FEE500]/90 font-medium text-sm"
          >
            <KakaoIcon className="size-5 mr-2" />
            카카오로 시작하기
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            계속 진행하면{' '}
            <span className="underline">이용약관</span> 및{' '}
            <span className="underline">개인정보처리방침</span>에
            동의하는 것으로 간주합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
