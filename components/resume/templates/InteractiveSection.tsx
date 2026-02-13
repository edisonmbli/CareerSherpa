'use client'

import { useResumeStore } from '@/store/resume-store'
import { cn } from '@/lib/utils'
import { Edit2 } from 'lucide-react'
import { useSpacer } from '@/components/resume/SpacerContext'

interface InteractiveSectionProps {
  sectionKey: string
  itemId?: string
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function InteractiveSection({
  sectionKey,
  itemId,
  children,
  className,
  style,
}: InteractiveSectionProps) {
  const { activeSectionKey, activeItemId, setActive, sectionConfig, readOnly } =
    useResumeStore()

  // Generate unique ID for measurement
  const uniqueId = itemId ? `${sectionKey}-${itemId}` : sectionKey
  const spacerHeight = useSpacer(uniqueId)

  if (readOnly) {
    return (
      <div
        data-section-id={uniqueId}
        style={{
          marginTop: spacerHeight ? `${spacerHeight}px` : undefined,
          ...style,
        }}
        className={cn('relative', className)}
      >
        {children}
      </div>
    )
  }

  // Strict matching if itemId is provided
  const isActive = itemId
    ? activeSectionKey === sectionKey && activeItemId === itemId
    : activeSectionKey === sectionKey && !activeItemId

  const configKey = itemId || sectionKey
  const hasPageBreak = (
    sectionConfig.pageBreaks as Record<string, boolean | undefined>
  )?.[configKey]

  // If this is a section container (no itemId) and a child item is active,
  // we might want to show a subtle state or nothing.
  // For now, simple strict equality.

  return (
    <div
      // Attributes for measurement
      data-section-id={uniqueId}
      data-has-page-break={hasPageBreak}
      style={{
        marginTop: spacerHeight ? `${spacerHeight}px` : undefined,
        ...style,
      }}
      className={cn(
        'relative group transition-all duration-200 rounded-sm cursor-pointer border border-transparent',
        // Only apply padding/margin adjustment if it's an item or simple section
        // To avoid layout shift, we might need a different approach, but -mx-3 px-3 is standard trick
        '-mx-2 px-2 py-1.5',
        isActive
          ? 'border-blue-500 bg-blue-50/10 print:border-transparent print:bg-transparent'
          : 'hover:border-gray-300 hover:bg-gray-50/50 print:border-transparent print:bg-transparent',
        // Remove the visual dashed line if we are using spacers,
        // BUT for now keep it as a visual indicator in Web Mode if not in Print Mode?
        // Actually, the spacer logic only runs in Print Mode (viewMode === 'print').
        // So in Web Mode, spacers are 0, and we still want to see the dashed line.
        // In Print Mode, spacers are active, and we might want to hide the dashed line or keep it?
        // The user said: "移除旧的 .break-after-page 类... 但为了保险起见，打印时可以保留"
        // Let's keep the class but override in CSS if needed.
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
          'absolute right-2 top-2 flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] font-medium rounded opacity-0 transition-opacity z-10 pointer-events-none print:hidden',
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
