import { cn } from '@/lib/utils'
import { Lightbulb, CheckCircle2 } from 'lucide-react'

interface ResumeExampleCardProps {
    items: {
        label: string
        content: string
    }[]
    className?: string
}

export function ResumeExampleCard({
    items,
    className,
}: ResumeExampleCardProps) {
    return (
        <div className={cn("w-full space-y-3", className)}>
            {items.map((item, idx) => {
                return (
                    <div 
                        key={idx} 
                        className="group relative overflow-hidden rounded-lg border bg-slate-50/50 p-4 hover:bg-slate-50 transition-colors dark:bg-slate-900/20 dark:hover:bg-slate-900/30"
                    >
                        {/* Left accent border */}
                        <div className="absolute left-0 top-0 h-full w-[3px] bg-blue-500/30 group-hover:bg-blue-500 transition-colors" />

                        <div className="flex gap-3">
                            {/* Number/Icon Indicator */}
                            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blue-100 text-[10px] font-bold text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 mt-0.5">
                                {idx + 1}
                            </div>

                            <div className="space-y-1.5 flex-1 min-w-0">
                                {/* Title/Label */}
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                        {item.label}
                                    </h4>
                                </div>
                                
                                {/* Content */}
                                <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-normal">
                                    {item.content}
                                </p>
                            </div>
                        </div>
                    </div>
                )
            })}
            
            {/* Helpful Tip Footer */}
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-700/80 dark:bg-amber-900/10 dark:text-amber-400">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>建议使用 STAR 法则 (情境-任务-行动-结果) 来量化您的工作成果。</span>
            </div>
        </div>
    )
}
