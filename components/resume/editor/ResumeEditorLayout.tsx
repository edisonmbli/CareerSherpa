'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { useResumeStore } from '@/lib/stores/resume-store'
import { StructureOutline } from './StructureOutline'
import { RightPropertyPanel } from './RightPropertyPanel'
import { ResumePreview } from './ResumePreview'
import { ResumeToolbar } from './ResumeToolbar'
import { Button } from '@/components/ui/button'
import { Edit2 } from 'lucide-react'
import { cn, getMatchThemeColor, getMatchThemeClass } from '@/lib/utils'
import { MobileEditorSheet } from './MobileEditorSheet'
import { MobileControlFab } from './MobileControlFab'
import {
  RESUME_SCREEN_BASE_WIDTH_PX,
  RESUME_SCREEN_DESKTOP_PADDING_PX,
  RESUME_SCREEN_DESKTOP_SCALE,
  RESUME_SCREEN_MIN_SCALE,
  RESUME_SCREEN_MOBILE_BREAKPOINT_PX,
  RESUME_SCREEN_MOBILE_PADDING_PX,
} from '@/lib/constants'

export function ResumeEditorLayout({
  ctaAction,
  matchScore,
}: {
  ctaAction?: React.ReactNode
  matchScore?: number | undefined
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

  // Derive theme class based on matchScore, defaulting to neutral
  const themeColor = matchScore !== undefined ? getMatchThemeColor(matchScore) : undefined
  const matchThemeClass = themeColor ? getMatchThemeClass(themeColor) : 'match-theme-neutral'

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

  // 3. Smart Auto-Scale Logic (Only active in Column Mode)
  useEffect(() => {
    const calculateScale = () => {
      if (!centerContainerRef.current) return

      const containerWidth = centerContainerRef.current.clientWidth

      // A4 width ~794px + margin
      // Mobile: Use simpler ratio to fill width
      const isMobile = window.innerWidth < RESUME_SCREEN_MOBILE_BREAKPOINT_PX
      const resumeWidth = RESUME_SCREEN_BASE_WIDTH_PX

      let newScale = 1
      if (containerWidth < resumeWidth) {
        const availableWidth = isMobile
          ? window.innerWidth - RESUME_SCREEN_MOBILE_PADDING_PX
          : containerWidth - RESUME_SCREEN_DESKTOP_PADDING_PX
        newScale = Math.max(
          RESUME_SCREEN_MIN_SCALE,
          availableWidth / RESUME_SCREEN_BASE_WIDTH_PX,
        )
      } else {
        newScale = RESUME_SCREEN_DESKTOP_SCALE
      }

      setScale(newScale)
    }

    calculateScale()
    const observer = new ResizeObserver(calculateScale)
    if (centerContainerRef.current) observer.observe(centerContainerRef.current)

    window.addEventListener('resize', calculateScale)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', calculateScale)
    }
  }, [isStructureOpen, isAIPanelOpen, isDrawerMode])

  return (
    <div
      className={cn(
        'flex w-full bg-transparent relative flex-col h-full overflow-hidden',
      )}
    >
      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden relative w-full">
        {/* Left Sidebar - Column Mode (Hidden in Drawer Mode) */}
        {!isDrawerMode && (
          <div
            className={cn(
              'mt-4 mb-12 ml-4 md:ml-8 lg:ml-12', // Match vertical margin of center card, plus outer margin
              'rounded-[2rem] overflow-hidden', // Match border radius of center card
              'bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl', // De-box: softer transparent glass
              'ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl', // De-box: subtle shadow instead of hard borders
              'z-20 transition-all duration-[800ms] ease-in-out flex-shrink-0 relative flex flex-col',
              isStructureOpen
                ? 'w-[280px] translate-x-0 opacity-100'
                : 'w-0 -translate-x-full opacity-0',
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
              'absolute left-4 top-4 bottom-12 z-50 transition-transform duration-[800ms] ease-out flex flex-col hidden md:flex',
              'rounded-[2rem] overflow-hidden',
              'bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl',
              'ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-2xl', // Drawer needs more shadow to separate from content below
              isStructureOpen
                ? 'translate-x-0 opacity-100'
                : '-translate-x-[120%] opacity-0',
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
                className="fixed inset-0 bg-black/10 z-[-1] backdrop-blur-[2px]"
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
            'flex-1 bg-transparent relative flex flex-col items-stretch md:items-center pb-32 md:pb-8',
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
          {/* ResultCard match style Wrapper */}
          <div
            className={cn(
              // 1. Centered "Page" with max-width (Letterhead feel)
              'max-w-none sm:max-w-[880px] w-full mx-0 sm:mx-auto relative mt-4 mb-24 md:mb-12 overflow-visible animate-in fade-in slide-in-from-bottom-6 duration-[800ms] ease-out',
              // 2. Tinted Neutral Background - Transparent on mobile for seamless edge-to-edge blend
              'bg-transparent sm:bg-white/70 dark:bg-transparent sm:dark:bg-white/[0.03]',
              // 3. Double Border & Shadow Effect - Hidden on mobile to avoid cutting the screen
              'border-transparent sm:border-[0.5px] sm:border-black/5 sm:dark:border-white/10',
              'shadow-none sm:shadow-[inset_0_2px_5px_rgba(255,255,255,0.9),0_40px_80px_-20px_rgba(14,165,233,0.15)] sm:dark:shadow-2xl',
              'rounded-none sm:rounded-[2rem] sm:backdrop-blur-2xl',
              // Copy Score Match Theme from Step 1
              matchThemeClass,
              // Layout inside card
              'flex flex-col items-center',
              isMobileView ? 'py-0' : 'pt-6 pb-12 px-6 md:pt-8 md:pb-16 md:px-10 lg:px-12'
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Fine Noise Texture for the glass */}
            <div aria-hidden="true" className="hidden sm:block absolute inset-0 mix-blend-overlay opacity-10 pointer-events-none rounded-sm sm:rounded-[2rem] z-0" style={{ backgroundImage: 'url("/noise.svg")', backgroundRepeat: 'repeat' }} />

            <div className="relative z-10 flex flex-col items-center w-full">
              {/* Top Toolbar inside the Card - Hidden on Mobile */}
              <div className="hidden md:block w-full mb-6">
                <ResumeToolbar printRef={printRef as any} />
              </div>

              {/* Resume Preview Canvas */}
              <div
                className={cn(
                  'resume-scale-wrapper min-h-full flex flex-col items-stretch md:items-center transition-all duration-[800ms] ease-out origin-top w-full overflow-x-hidden md:overflow-visible',
                  'sm:shadow-[0_0_40px_rgba(0,0,0,0.06)] sm:ring-1 sm:ring-black/5 sm:dark:shadow-none sm:dark:ring-0 sm:bg-white sm:dark:bg-transparent'
                )}
                style={{
                  transform: isMobileView ? 'none' : `scale(${scale})`,
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
            </div>
          </div>
        </main>

        {/* Right Sidebar - Column Mode (Hidden in Drawer Mode) */}
        {!isDrawerMode && (
          <div
            className={cn(
              'mt-4 mb-12 mr-4 md:mr-8 lg:mr-12', // Match vertical margin of center card, plus outer margin
              'rounded-[2rem] overflow-hidden', // Match border radius of center card
              'bg-white/40 dark:bg-white/[0.02] backdrop-blur-xl', // De-box: softer transparent glass
              'ring-1 ring-black/5 dark:ring-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-2xl', // De-box: subtle shadow instead of hard borders
              'z-20 transition-all duration-[800ms] ease-in-out flex-shrink-0 relative flex flex-col',
              isAIPanelOpen
                ? 'w-[350px] translate-x-0 opacity-100'
                : 'w-0 translate-x-full opacity-0',
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
              'absolute right-4 top-4 bottom-12 z-50 transition-transform duration-[800ms] ease-out flex flex-col hidden md:flex',
              'rounded-[2rem] overflow-hidden',
              'bg-white/60 dark:bg-white/[0.03] backdrop-blur-2xl',
              'ring-1 ring-black/5 dark:ring-white/10 shadow-2xl dark:shadow-2xl', // Drawer needs more shadow to separate from content below
              isAIPanelOpen
                ? 'translate-x-0 opacity-100'
                : 'translate-x-[120%] opacity-0',
            )}
            style={{ width: '350px' }}
          >
            <div className="w-full h-full relative overflow-hidden">
              <RightPropertyPanel />
            </div>

            {/* Backdrop for closing */}
            {isAIPanelOpen && (
              <div
                className="fixed inset-0 bg-black/10 z-[-1] backdrop-blur-[2px]"
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
