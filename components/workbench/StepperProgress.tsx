'use client'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'

export type StepId = 1 | 2 | 3

interface WorkflowStepperProps {
  currentStep: StepId
  maxUnlockedStep: StepId
  onStepClick: (step: StepId) => void
  labels: { step1: string; step2: string; step3: string }
  stepActions?: Partial<Record<StepId, React.ReactNode>>
  className?: string
}

export function StepperProgress({
  currentStep,
  maxUnlockedStep,
  onStepClick,
  labels,
  stepActions,
  className,
}: WorkflowStepperProps) {
  const step1 = { id: 1 as StepId, label: labels.step1 }
  const step2 = { id: 2 as StepId, label: labels.step2 }
  const step3 = { id: 3 as StepId, label: labels.step3 }

  // Helper to render individual step node
  const renderStep = (step: { id: StepId; label: string }) => {
    const isCompleted = step.id < currentStep
    const isCurrent = step.id === currentStep
    const isLocked = step.id > maxUnlockedStep
    const customAction = stepActions?.[step.id]

    return (
      <div
        className={cn(
          'group flex items-center gap-2 focus:outline-none transition-colors duration-200 shrink-0 z-10',
          !customAction && !isLocked ? 'cursor-pointer' : '',
          // V7 Fix: Only appear locked/disabled if there is NO embedded action
          (isLocked && !customAction) ? 'cursor-not-allowed opacity-50' : ''
        )}
        onClick={() => !customAction && !isLocked && onStepClick(step.id)}
      >
        {/* Circle Indicator */}
        <span className="flex items-center shrink-0">
          {isCompleted ? (
            <div className="h-6 w-6 rounded-full bg-background border-2 border-muted flex items-center justify-center group-hover:border-primary transition-colors">
              <span className="text-[10px] font-mono text-muted-foreground group-hover:text-primary transition-colors">
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
          ) : (isLocked && !customAction) ? (
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

        {/* Content: Label OR Custom Action */}
        {customAction ? (
          <>
            {/* Mobile: Show Label */}
            <span
              className={cn(
                'text-sm font-medium whitespace-nowrap lg:hidden',
                isCurrent ? 'text-primary' : 'text-muted-foreground',
                !isLocked && !isCurrent && 'group-hover:text-foreground'
              )}
              onClick={(e) => {
                e.stopPropagation()
                if (!isLocked) onStepClick(step.id)
              }}
            >
              {step.label}
            </span>

            {/* Desktop: Show Action (Seamlessly Embedded) */}
            <div
              className="hidden lg:block ml-1"
              onClick={(e) => e.stopPropagation()}
            >
              {customAction}
            </div>
          </>
        ) : (
          <span
            className={cn(
              'text-sm font-medium whitespace-nowrap',
              isCurrent ? 'text-primary' : 'text-muted-foreground',
              !isLocked && !isCurrent && 'group-hover:text-foreground'
            )}
          >
            {step.label}
          </span>
        )}
      </div>
    )
  }

  // Helper to render connecting line (fills remaining space in grid col)
  const renderLine = (fromStepId: StepId) => {
    // Line is active if the FROM step is completed/unlocked
    const isActive = fromStepId < maxUnlockedStep
    return (
      <div className="flex-1 mx-3 h-[2px] bg-border overflow-hidden rounded-full min-w-[20px]">
        <div
          className={cn(
            'h-full transition-all duration-500 ease-in-out',
            isActive ? 'w-full bg-primary' : 'w-0 bg-transparent'
          )}
        />
      </div>
    )
  }

  return (
    <nav aria-label="progress" className={cn('w-full', className)}>
      {/* V7.2 Grid Layout: Forced mathematical centering */}
      {/* Col 1 (1fr) | Col 2 (auto) | Col 3 (1fr) */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">

        {/* Left Column: Step 1 + Flexible Line */}
        <div className="flex items-center min-w-0 pr-2">
          {renderStep(step1)}
          {renderLine(step1.id)}
        </div>

        {/* Center Column: Step 2 (Strictly Centered) */}
        <div className="flex justify-center shrink-0 px-2">
          {renderStep(step2)}
        </div>

        {/* Right Column: Flexible Line + Step 3 */}
        <div className="flex items-center min-w-0 pl-2">
          {renderLine(step2.id)}
          <div className="ml-auto">
            {renderStep(step3)}
          </div>
        </div>

      </div>
    </nav>
  )
}
