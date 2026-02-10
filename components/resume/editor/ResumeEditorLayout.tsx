'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useResumeStore } from '@/store/resume-store'
import { StructureOutline } from './StructureOutline'
import { RightPropertyPanel } from './RightPropertyPanel'
import { ResumePreview } from './ResumePreview'
import { ResumeToolbar } from './ResumeToolbar'
import { Button } from '@/components/ui/button'
import { Edit2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MobileEditorSheet } from './MobileEditorSheet'
import { MobileControlFab } from './MobileControlFab'

export function ResumeEditorLayout({
  ctaAction,
}: {
  ctaAction?: React.ReactNode
}) {
  const {
    resumeData,
    sectionConfig,
    currentTemplate,
    isStructureOpen,
    isAIPanelOpen,
  } = useResumeStore()
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false)
  const printRef = useRef<HTMLDivElement>(null)

  // Ref for the center container to measure available width
  const centerContainerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [contentHeight, setContentHeight] = useState<number | null>(null)
  const [isMobileView, setIsMobileView] = useState(false)

  // Measure content height to fix truncation/whitespace issues
  useEffect(() => {
    const el = printRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.contentRect.height)
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 1. Force Global Sidebar to collapse when entering Editor (Step 2)
  // This ensures we have maximum screen real estate.
  // Also force internal sidebars to collapse on initial load for a clean view
  useLayoutEffect(() => {
    // Check if global sidebar is open
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === '1'
    if (!isCollapsed) {
      // Collapse it
      localStorage.setItem('sidebar_collapsed', '1')
      window.dispatchEvent(new CustomEvent('sidebar:collapsed-changed'))
    }

    // Collapse internal sidebars on mount (Step 2 entry) to focus on canvas
    useResumeStore.getState().setStructureOpen(false)
    useResumeStore.getState().setAIPanelOpen(false)

    // Cleanup: When unmounting (leaving Step 2), we might want to expand it back
    // IF the user is going back to Step 1.
    return () => {
      // Optional: Restore sidebar if navigating away?
      // For now, let Step 1's own logic handle expansion (which we added in ServiceDisplay)
    }
  }, [])

  // 2. Responsive Layout Logic (Drawer Mode vs Column Mode)
  // Threshold: 1500px. Below this, we force "Immersive Drawer Mode".
  // Above this, we allow "3-Column Mode" if space permits.
  const [isDrawerMode, setIsDrawerMode] = useState(false)

  useEffect(() => {
    const checkLayoutMode = () => {
      const width = window.innerWidth
      // Use 1500px as breakpoint as agreed
      setIsDrawerMode(width < 1500)
      setIsMobileView(width < 768)
    }

    // Initial check
    checkLayoutMode()

    window.addEventListener('resize', checkLayoutMode)
    return () => window.removeEventListener('resize', checkLayoutMode)
  }, [])

  // Debug info state
  const [debugInfo, setDebugInfo] = useState<any>({})

  // 3. Smart Auto-Scale Logic (Only active in Column Mode)
  useEffect(() => {
    const calculateScale = () => {
      if (!centerContainerRef.current) return

      const containerWidth = centerContainerRef.current.clientWidth
      const containerHeight = centerContainerRef.current.clientHeight
      const scrollHeight = centerContainerRef.current.scrollHeight

      // A4 width ~794px + margin
      // Mobile: Use simpler ratio to fill width
      const isMobile = window.innerWidth < 768
      const resumeWidth = 794 // Base A4 width

      let newScale = 1
      if (containerWidth < resumeWidth) {
        // Mobile: Use window width directly to ensure full usage minus minimal safety margin
        // We subtract 16px (8px padding on each side) for a tight but safe fit
        const availableWidth = isMobile
          ? window.innerWidth - 16
          : containerWidth - 40
        newScale = Math.max(0.25, availableWidth / 794)
      } else {
        // Desktop: Scale down slightly (0.85) to be less intrusive, as requested
        newScale = 0.85
      }

      setScale(newScale)

      // Update debug info
      setDebugInfo({
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        containerW: containerWidth,
        containerH: containerHeight,
        scrollH: scrollHeight,
        scale: newScale.toFixed(3),
        pb: '50vh',
      })
    }

    calculateScale()
    const observer = new ResizeObserver(calculateScale)
    if (centerContainerRef.current) observer.observe(centerContainerRef.current)

    window.addEventListener('resize', calculateScale)
    // Add scroll listener to update debug info dynamically
    const scrollEl = centerContainerRef.current
    const handleScroll = () => {
      if (scrollEl) {
        setDebugInfo((prev: any) => ({
          ...prev,
          scrollTop: scrollEl.scrollTop,
          scrollH: scrollEl.scrollHeight,
        }))
      }
    }
    if (scrollEl) scrollEl.addEventListener('scroll', handleScroll)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', calculateScale)
      if (scrollEl) scrollEl.removeEventListener('scroll', handleScroll)
    }
  }, [isStructureOpen, isAIPanelOpen, isDrawerMode])

  return (
    <div
      className={cn(
        'flex w-full bg-gray-50/50 dark:bg-zinc-950 relative flex-col h-full overflow-hidden',
      )}
    >
      {/* Debug Overlay - REMOVED */}

      {/* Top Toolbar - Hidden on Mobile */}
      <div className="hidden md:block">
        <ResumeToolbar printRef={printRef as any} />
      </div>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative w-full">
        {/* Left Sidebar - Column Mode (Hidden in Drawer Mode) */}
        {!isDrawerMode && (
          <div
            className={cn(
              'bg-white dark:bg-popover border-r dark:border-zinc-800 z-20 transition-all duration-[800ms] ease-in-out overflow-hidden flex-shrink-0 relative flex flex-col',
              isStructureOpen
                ? 'w-[280px] translate-x-0 opacity-100 shadow-sm'
                : 'w-0 -translate-x-full opacity-0 border-none',
            )}
          >
            <div className="w-[280px] h-full relative overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-800">
              <StructureOutline />
            </div>
          </div>
        )}

        {/* Left Sidebar - Drawer Mode (Overlay) */}
        {isDrawerMode && (
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 z-50 bg-white dark:bg-popover border-r dark:border-zinc-800 transition-transform duration-[800ms] ease-out flex flex-col hidden md:flex',
              isStructureOpen
                ? 'translate-x-0 shadow-2xl'
                : '-translate-x-full',
            )}
            style={{ width: '280px' }}
          >
            {/* Drawer Header / Close Button if needed, or just content */}
            <div className="w-full h-full relative overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-800">
              <StructureOutline />
            </div>

            {/* Backdrop for closing */}
            {isStructureOpen && (
              <div
                className="fixed inset-0 bg-black/20 z-[-1] backdrop-blur-sm"
                style={{ left: '280px', width: 'calc(100vw - 280px)' }}
                onClick={() =>
                  useResumeStore.getState().setStructureOpen(false)
                }
              />
            )}
          </div>
        )}

        {/* Center: Canvas (Flexible) */}
        {/* Solution C: Single Scroll Source */}
        <main
          ref={centerContainerRef}
          className={cn(
            'flex-1 bg-gray-50/50 dark:bg-zinc-950 relative flex flex-col items-stretch md:items-center pb-32',
            'overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent',
            // Fix mobile scrolling by enabling touch scrolling explicitly and ensuring height is constrained
            isMobileView && 'h-full touch-auto',
          )}
          onClick={(e) => {
            // Close sidebars when clicking on the workspace background
            const {
              isStructureOpen,
              isAIPanelOpen,
              setStructureOpen,
              setAIPanelOpen,
              setActive,
            } = useResumeStore.getState()

            // If sidebars are open, close them
            if (isStructureOpen || isAIPanelOpen) {
              if (isStructureOpen) setStructureOpen(false)
              if (isAIPanelOpen) setAIPanelOpen(false)
            }

            // Also deselect any active item/section
            setActive(null)
          }}
        >
          {/* 
            Canvas Wrapper 
            - min-h-full ensures it fills height
            - py-8 adds top margin (aligned with design)
            - transform-origin-top ensures scaling happens from top center
          */}
          <div
            className={cn(
              'min-h-full flex flex-col items-stretch md:items-center transition-all duration-[800ms] ease-out origin-top w-full md:w-auto overflow-x-hidden md:overflow-visible',
              isMobileView ? 'py-0' : 'py-8',
            )}
            onClick={(e) => e.stopPropagation()}
            style={{
              transform: isMobileView ? 'none' : `scale(${scale})`,
              // Fix truncation/whitespace by syncing layout height with visual scaled height
              // We add buffer for padding (py-8 = 32px * 2 = 64px)
              // We use a safe buffer (50px) to prevent truncation while minimizing empty space
              height: isMobileView
                ? 'auto'
                : contentHeight
                  ? `${contentHeight * scale + 50}px`
                  : 'auto',
            }}
          >
            <ResumePreview
              ref={printRef as any}
              templateId={currentTemplate}
              data={resumeData}
              config={sectionConfig}
            />
          </div>
        </main>

        {/* Right Sidebar - Column Mode (Hidden in Drawer Mode) */}
        {!isDrawerMode && (
          <div
            className={cn(
              'bg-white dark:bg-popover shadow-2xs dark:border-zinc-800 z-20 transition-all duration-[800ms] ease-in-out overflow-hidden flex-shrink-0 relative flex flex-col',
              isAIPanelOpen
                ? 'w-[350px] translate-x-0 opacity-100'
                : 'w-0 translate-x-full opacity-0 border-none',
            )}
          >
            <div className="w-[350px] h-full relative overflow-hidden">
              <RightPropertyPanel />
            </div>
          </div>
        )}

        {/* Right Sidebar - Drawer Mode (Overlay) */}
        {isDrawerMode && (
          <div
            className={cn(
              'absolute right-0 top-0 bottom-0 z-50 bg-white dark:bg-popover shadow-xs border-l dark:border-zinc-800 transition-transform duration-[800ms] ease-out flex flex-col hidden md:flex',
              isAIPanelOpen ? 'translate-x-0' : 'translate-x-full',
            )}
            style={{ width: '350px' }}
          >
            <div className="w-full h-full relative overflow-hidden">
              <RightPropertyPanel />
            </div>

            {/* Backdrop for closing */}
            {isAIPanelOpen && (
              <div
                className="fixed inset-0 bg-black/20 z-[-1] backdrop-blur-sm"
                style={{
                  right: '350px',
                  width: 'calc(100vw - 350px)',
                  left: 'auto',
                }}
                onClick={() => useResumeStore.getState().setAIPanelOpen(false)}
              />
            )}
          </div>
        )}

        {/* Mobile Edit FAB (New) */}
        <MobileControlFab printRef={printRef as any} />

        {/* Mobile Editor Sheet (Legacy - Removing usage but keeping file if needed elsewhere, though usually safe to remove from view) */}
        {/* <MobileEditorSheet open={isMobileSheetOpen} onOpenChange={setIsMobileSheetOpen} /> */}
      </div>
    </div>
  )
}
