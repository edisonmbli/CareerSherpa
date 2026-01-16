import { cn } from '@/lib/utils'
import { Lightbulb, CheckCircle2 } from 'lucide-react'

interface ResumeExampleCardProps {
    items: {
        label: string
        content: string
    }[]
    className?: string
    tips?: {
        star: string
        detail: string
    } | undefined
}

export function ResumeExampleCard({
    items,
    className,
    tips,
}: ResumeExampleCardProps) {
    return (
        <div className={cn("w-full space-y-4", className)}>
            {/* Single Cohesive Card */}
            <div className="relative overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4 sm:p-5 shadow-sm">
                <div className="space-y-3">
                    {items.map((item, idx) => (
                        <div key={idx} className="flex gap-2">
                            <span className={cn(
                                "shrink-0 text-xs font-bold uppercase tracking-wider mt-0.5 w-[75px] sm:w-[85px]",
                                idx === 0 ? "text-blue-600/50 dark:text-blue-400/50" :
                                    idx === 1 ? "text-blue-600/60 dark:text-blue-400/60" :
                                        idx === 2 ? "text-blue-600/70 dark:text-blue-400/70" :
                                            "text-blue-600/80 dark:text-blue-400/80"
                            )}>
                                {item.label}
                            </span>
                            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                                {item.content}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Helpful Tip Footer - Editorial Style */}
            {tips && (
                <div className="flex flex-wrap items-start gap-2 rounded-md bg-amber-50/80 p-3 text-xs text-amber-900/60 dark:bg-amber-200/10 dark:text-amber-400/60">
                    <div className="flex items-start gap-1">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{tips.star}</span>
                    </div>
                    <div className="flex items-start gap-1">
                        <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                        <span>{tips.detail}</span>
                    </div>
                </div>
            )}
        </div>
    )
}
