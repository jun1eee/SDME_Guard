'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft } from 'lucide-react'
import { Form } from '@/components/ui/form'
import { Button } from '@/components/ui/button'
import { StepProgress } from '@/components/signup/step-progress'
import { RoleSelection } from '@/components/signup/role-selection'
import { ProfileInput } from '@/components/signup/profile-input'
import { WeddingDetails } from '@/components/signup/wedding-details'
import {
  roleSchema,
  profileSchema,
  weddingDetailsSchema,
  stepFields,
  type SignupFormValues,
} from '@/lib/validations/signup'

const TOTAL_STEPS = 3

const stepSchemas = {
  1: roleSchema,
  2: profileSchema,
  3: weddingDetailsSchema,
} as const

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = React.useState(1)

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(stepSchemas[step as keyof typeof stepSchemas]),
    defaultValues: {
      role: undefined,
      nickname: '',
      phone: '',
      verificationCode: '',
      isPhoneVerified: undefined as unknown as true,
      weddingDate: undefined,
      budgetRange: undefined,
    },
    mode: 'onSubmit',
  })

  const handleNext = async () => {
    const fields = stepFields[step as keyof typeof stepFields]
    const valid = await form.trigger(fields as unknown as (keyof SignupFormValues)[])

    if (!valid) return

    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1)
    } else {
      router.push('/signup/match')
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1)
    } else {
      router.push('/login')
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-6 py-4">
      <div className="mx-auto w-full max-w-lg flex flex-col flex-1">
        {/* 헤더 */}
        <div className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={handleBack}
            className="flex size-10 items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="size-5" />
          </button>
          <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />
          <div className="size-10" />
        </div>

        {/* 폼 */}
        <Form {...form}>
          <form
            onSubmit={(e) => e.preventDefault()}
            className="flex flex-1 flex-col pt-8"
          >
            <div className="flex-1">
              {step === 1 && <RoleSelection form={form} />}
              {step === 2 && <ProfileInput form={form} />}
              {step === 3 && <WeddingDetails form={form} />}
            </div>

            {/* 다음 버튼 */}
            <div className="pb-8 pt-6">
              <Button
                type="button"
                onClick={handleNext}
                className="w-full rounded-full h-12 text-sm"
              >
                {step === TOTAL_STEPS ? '완료' : '다음'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}
