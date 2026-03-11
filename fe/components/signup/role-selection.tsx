'use client'

import { UseFormReturn } from 'react-hook-form'
import { cn } from '@/lib/utils'
import {
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/form'
import type { SignupFormValues } from '@/lib/validations/signup'

interface RoleSelectionProps {
  form: UseFormReturn<SignupFormValues>
}

export function RoleSelection({ form }: RoleSelectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="font-serif text-2xl">어떤 역할이신가요?</h2>
        <p className="text-sm text-muted-foreground">
          결혼 준비를 함께할 역할을 선택해주세요
        </p>
      </div>

      <FormField
        control={form.control}
        name="role"
        render={({ field }) => (
          <FormItem>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => field.onChange('groom')}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-200',
                  field.value === 'groom'
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : 'border-border hover:border-primary/30 hover:bg-secondary/50',
                )}
              >
                <span className="text-4xl">🤵</span>
                <span className="text-sm font-medium">신랑</span>
              </button>

              <button
                type="button"
                onClick={() => field.onChange('bride')}
                className={cn(
                  'flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-all duration-200',
                  field.value === 'bride'
                    ? 'border-primary bg-primary/5 scale-[1.02]'
                    : 'border-border hover:border-primary/30 hover:bg-secondary/50',
                )}
              >
                <span className="text-4xl">👰</span>
                <span className="text-sm font-medium">신부</span>
              </button>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
