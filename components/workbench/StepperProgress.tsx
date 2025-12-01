'use client'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StepId = 1 | 2 | 3

interface WorkflowStepperProps {
  currentStep: StepId
  maxUnlockedStep: StepId
  onStepClick: (step: StepId) => void
  labels: { step1: string; step2: string; step3: string }
  className?: string
}

export function StepperProgress({
  currentStep,
  maxUnlockedStep,
  onStepClick,
  labels,
  className,
}: WorkflowStepperProps) {
  const steps = [
    { id: 1 as StepId, label: labels.step1 },
    { id: 2 as StepId, label: labels.step2 },
    { id: 3 as StepId, label: labels.step3 },
  ]

  return (
    <nav aria-label="progress" className={cn('w-full', className)}>
      <ol role="list" className="flex items-center">
        {steps.map((step, stepIdx) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isLocked = step.id > maxUnlockedStep
          const isLastStep = stepIdx === steps.length - 1
          return (
            <li
              key={step.label}
              className={cn(
                isLastStep ? '' : 'flex-1',
                'relative flex items-center'
              )}
            >
              <button
                onClick={() => !isLocked && onStepClick(step.id)}
                disabled={isLocked}
                className={cn(
                  'group flex items-center gap-2 focus:outline-none transition-colors duration-200',
                  isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                )}
              >
                <span className="flex items-center">
                  {isCompleted ? (
                    <div className="h-6 w-6 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center">
                      <span className="text-[10px] font-mono text-primary-foreground">
                        {step.id}
                      </span>
                    </div>
                  ) : isCurrent ? (
                    <div className="relative flex items-center justify-center">
                      <span className="absolute h-full w-full rounded-full bg-primary/20 animate-ping" />
                      <div className="relative h-6 w-6 rounded-full border-2 border-primary bg-background flex items-center justify-center">
                        <span className="text-[10px] font-mono text-primary">
                          {step.id}
                        </span>
                      </div>
                    </div>
                  ) : isLocked ? (
                    <div className="h-6 w-6 rounded-full border-2 border-muted flex items-center justify-center bg-muted/30">
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="h-6 w-6 rounded-full border-2 border-muted flex items-center justify-center">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {step.id}
                      </span>
                    </div>
                  )}
                </span>
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCurrent ? 'text-primary' : 'text-muted-foreground',
                    !isLocked && !isCurrent && 'group-hover:text-foreground'
                  )}
                >
                  {step.label}
                </span>
              </button>
              {!isLastStep && (
                <div className="flex-1 mx-3" aria-hidden="true">
                  <div className="h-[2px] w-full bg-border overflow-hidden rounded-full">
                    <div
                      className={cn(
                        'h-full transition-all duration-500 ease-in-out',
                        step.id < maxUnlockedStep
                          ? 'w-full bg-primary'
                          : 'w-0 bg-transparent'
                      )}
                    />
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
