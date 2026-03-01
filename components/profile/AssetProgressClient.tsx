'use client'

import { useEffect, useState } from 'react'

type AssetProgressClientProps = {
  initialProgress: number
  lead: string
  level0: string
  level60: string
  level100: string
}

export function AssetProgressClient({
  initialProgress,
  lead,
  level0,
  level60,
  level100,
}: AssetProgressClientProps) {
  const [progress, setProgress] = useState(initialProgress)

  useEffect(() => {
    setProgress(initialProgress)
  }, [initialProgress])

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail || {}
      const taskTemplateId = detail.taskTemplateId as string | undefined
      const summaryJson = detail.summaryJson
      if (!summaryJson) return
      if (taskTemplateId === 'resume_summary') {
        setProgress((prev) => (prev >= 60 ? prev : 60))
      }
      if (taskTemplateId === 'detailed_resume_summary') {
        setProgress(100)
      }
    }
    window.addEventListener('resume:summary', handler)
    return () => window.removeEventListener('resume:summary', handler)
  }, [])

  return (
    <div className="p-6 sm:p-8">
      <div className="text-lg md:text-xl text-slate-600 dark:text-slate-400 font-medium tracking-wide mb-6">
        {lead}
      </div>
      <div className="space-y-3">
        <div className="h-2 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-slate-900 dark:bg-white transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs">
          <span
            className={`${
              progress === 0
                ? 'text-slate-900 dark:text-white font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {progress === 0 && (
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 dark:bg-white shadow-[0_0_8px_rgba(59,130,246,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse mr-2" />
            )}
            0% {level0}
          </span>
          <span
            className={`${
              progress >= 60
                ? 'text-slate-900 dark:text-white font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {progress >= 60 && progress < 100 && (
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 dark:bg-white shadow-[0_0_8px_rgba(59,130,246,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse mr-2" />
            )}
            60% {level60}
          </span>
          <span
            className={`${
              progress === 100
                ? 'text-slate-900 dark:text-white font-medium'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {progress === 100 && (
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 dark:bg-white shadow-[0_0_8px_rgba(59,130,246,0.8)] dark:shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse mr-2" />
            )}
            100% {level100}
          </span>
        </div>
      </div>
    </div>
  )
}
