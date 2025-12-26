'use client'

import { useResumeStore } from '@/store/resume-store'
import { cn } from '@/lib/utils'
import { Edit2 } from 'lucide-react'

interface InteractiveSectionProps {
  sectionKey: string
  itemId?: string
  children: React.ReactNode
  className?: string
}

export function InteractiveSection({
  sectionKey,
  itemId,
  children,
  className,
}: InteractiveSectionProps) {
  const { activeSectionKey, activeItemId, setActive, sectionConfig } =
    useResumeStore()

  // Strict matching if itemId is provided
  const isActive = itemId
    ? activeSectionKey === sectionKey && activeItemId === itemId
    : activeSectionKey === sectionKey && !activeItemId

  const configKey = itemId || sectionKey
  const hasPageBreak = sectionConfig.pageBreaks?.[configKey]

  // If this is a section container (no itemId) and a child item is active,
  // we might want to show a subtle state or nothing.
  // For now, simple strict equality.

  return (
    <div
      className={cn(
        'relative group transition-all duration-200 rounded-sm cursor-pointer border border-transparent',
        // Only apply padding/margin adjustment if it's an item or simple section
        // To avoid layout shift, we might need a different approach, but -mx-3 px-3 is standard trick
        '-mx-2 px-2 py-1.5',
        isActive
          ? 'border-blue-500 bg-blue-50/10'
          : 'hover:border-gray-300 hover:bg-gray-50/50',
        hasPageBreak &&
          "break-after-page mb-8 border-b-2 border-dashed border-red-300 print:border-none relative after:content-['分页符'] after:absolute after:right-0 after:-bottom-5 after:text-xs after:text-red-400 print:after:hidden",
        className
      )}
      onClick={(e) => {
        // Disable interaction on mobile (< 768px)
        if (window.innerWidth < 768) return
        e.stopPropagation()
        setActive(sectionKey, itemId)
      }}
    >
      {/* Edit Label - Top Right */}
      <div
        className={cn(
          'absolute right-2 top-2 flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded opacity-0 transition-opacity z-10 pointer-events-none',
          // Only show if THIS specific item is hovered or active
          isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        )}
      >
        <Edit2 className="w-3 h-3" />
        <span>编辑</span>
      </div>

      {children}
    </div>
  )
}
