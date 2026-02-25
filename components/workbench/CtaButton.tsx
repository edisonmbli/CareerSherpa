'use client'

/**
 * CtaButton Component
 *
 * Renders the CTA (Call to Action) button for the workbench.
 * Shows action button with cost indicator.
 */

import { Button } from '@/components/ui/button'
import { Coins } from 'lucide-react'
import { getTaskCost } from '@/lib/constants'
import type { CtaConfig } from '@/lib/utils/workbench-stage'

interface CtaButtonProps {
    /** CTA configuration from deriveStage */
    cta: CtaConfig | null
    /** Current tab value for cost calculation */
    tabValue: 'match' | 'customize' | 'interview'
    /** Current customize status */
    customizeStatus: string
    /** Handler for customize action */
    onCustomize: () => void
    /** Handler for interview action */
    onInterview: () => void
    /** Handler for retry match action */
    onRetryMatch: () => void
    /** Tab setter for interview navigation */
    setTabValue: (tab: 'match' | 'customize' | 'interview') => void
}

/**
 * CTA Button with cost indicator
 */
export function CtaButton({
    cta,
    tabValue,
    customizeStatus,
    onCustomize,
    onInterview,
    onRetryMatch,
    setTabValue,
}: CtaButtonProps) {
    if (!cta) return null

    const handleClick = () => {
        if (cta.action === 'customize') {
            onCustomize()
        } else if (cta.action === 'interview') {
            onInterview()
        } else if (cta.action === 'retry_match') {
            onRetryMatch()
        }
    }

    // Calculate cost based on action type
    const cost = cta.action === 'retry_match'
        ? getTaskCost('job_match')
        : cta.action === 'interview' || (tabValue === 'interview') ||
            (tabValue === 'customize' && customizeStatus === 'COMPLETED')
            ? getTaskCost('interview_prep')
            : getTaskCost('resume_customize')

    return (
        <div className="flex items-center gap-2">
            <Button
                onClick={handleClick}
                disabled={cta.disabled}
                aria-label={cta.label}
                size="sm"
                className="font-semibold h-8 px-4 gap-2 cursor-pointer relative inline-flex items-center justify-center overflow-hidden z-10 bg-gradient-to-b from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_4px_14px_rgba(0,0,0,0.15)] dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 dark:hover:from-white dark:hover:to-slate-200 dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.6),0_4px_20px_rgba(0,0,0,0.3)] border border-slate-900/10 dark:border-white/10 active:scale-[0.98] transition-all duration-300 ease-out backdrop-blur-md"
            >
                {cta.label}
                <div className="h-3 w-px bg-white/20 mx-1" />
                <div className="flex items-center gap-1 opacity-90">
                    <Coins className="w-3.5 h-3.5 text-yellow-500" />
                    <span className="text-xs font-mono">{cost}</span>
                </div>
            </Button>
        </div>
    )
}
