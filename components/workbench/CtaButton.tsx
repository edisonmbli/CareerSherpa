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
            setTabValue('interview')
            onInterview()
        } else if (cta.action === 'retry_match') {
            onRetryMatch()
        }
    }

    const cost = getTaskCost(
        tabValue === 'interview' ||
            (tabValue === 'customize' && customizeStatus === 'COMPLETED')
            ? 'interview_prep'
            : 'resume_customize'
    )

    return (
        <div className="flex items-center gap-2">
            <Button
                onClick={handleClick}
                disabled={cta.disabled}
                aria-label={cta.label}
                size="sm"
                className="font-semibold shadow-sm h-8 px-4 gap-2 cursor-pointer"
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
