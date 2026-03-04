'use client'

import { cn } from '@/lib/utils'

interface StepProgressProps {
  currentStep: number
  totalSteps: number
}

export function StepProgress({ currentStep, totalSteps }: StepProgressProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1
        const isActive = step === currentStep
        const isCompleted = step < currentStep

        return (
          <div
            key={step}
            className={cn(
              'size-2.5 rounded-full transition-all duration-300',
              isActive && 'scale-125 bg-primary',
              isCompleted && 'bg-primary/40',
              !isActive && !isCompleted && 'bg-border',
            )}
          />
        )
      })}
    </div>
  )
}
