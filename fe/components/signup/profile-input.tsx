'use client'

import * as React from 'react'
import { UseFormReturn } from 'react-hook-form'
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp'
import type { SignupFormValues } from '@/lib/validations/signup'

interface ProfileInputProps {
  form: UseFormReturn<SignupFormValues>
}

export function ProfileInput({ form }: ProfileInputProps) {
  const [otpSent, setOtpSent] = React.useState(false)
  const [countdown, setCountdown] = React.useState(0)

  React.useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSendOtp = () => {
    const phone = form.getValues('phone')
    if (!/^01[0-9]{8,9}$/.test(phone)) {
      form.setError('phone', { message: '올바른 휴대폰 번호를 입력해주세요.' })
      return
    }
    setOtpSent(true)
    setCountdown(180)
  }

  const handleVerifyOtp = () => {
    const code = form.getValues('verificationCode')
    if (code.length === 6) {
      form.setValue('isPhoneVerified', true, { shouldValidate: true })
    }
  }

  const isVerified = form.watch('isPhoneVerified')

  const formatCountdown = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-serif text-2xl">프로필 설정</h2>
        <p className="text-sm text-muted-foreground">
          닉네임과 휴대폰 번호를 입력해주세요
        </p>
      </div>

      <div className="space-y-4">
        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>닉네임</FormLabel>
              <FormControl>
                <Input
                  placeholder="2~10자 닉네임 입력"
                  className="rounded-xl h-11"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>휴대폰 번호</FormLabel>
              <div className="flex gap-2">
                <FormControl>
                  <Input
                    placeholder="01012345678"
                    className="rounded-xl h-11 flex-1"
                    maxLength={11}
                    disabled={isVerified === true}
                    {...field}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl h-11 shrink-0 px-4"
                  onClick={handleSendOtp}
                  disabled={countdown > 0 || isVerified === true}
                >
                  {countdown > 0 ? formatCountdown(countdown) : '인증요청'}
                </Button>
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        {otpSent && isVerified !== true && (
          <FormField
            control={form.control}
            name="verificationCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>인증번호</FormLabel>
                <div className="flex items-center gap-3">
                  <FormControl>
                    <InputOTP maxLength={6} {...field}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </FormControl>
                  <Button
                    type="button"
                    className="rounded-xl h-11 shrink-0"
                    onClick={handleVerifyOtp}
                    disabled={form.watch('verificationCode')?.length !== 6}
                  >
                    확인
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isVerified === true && (
          <p className="text-sm text-green-600 font-medium">
            휴대폰 인증이 완료되었습니다.
          </p>
        )}
      </div>
    </div>
  )
}
