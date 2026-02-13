'use client'

import { useResumeStore, TemplateDefaultsMap } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Download,
  RotateCcw,
  Palette,
  FileText,
  FileJson,
  PanelLeft,
  Sparkles,
  Pipette,
  Check,
  Share2,
} from 'lucide-react'
import { RESUME_TEMPLATES, TemplateId } from '../constants'
import { TemplateSelector } from './TemplateSelector'
import { cn } from '@/lib/utils'
import { useState, useEffect, useRef } from 'react'
import { useReactToPrint } from 'react-to-print'
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import { SaveIndicator } from '@/components/ui/SaveIndicator'
import { useResumeDict } from '../ResumeDictContext'
import { ShareResumeDialog } from '@/components/resume/share/ShareResumeDialog'

interface ResumeToolbarProps {
  printRef: React.RefObject<HTMLDivElement>
}

// Helper for Range Input
const RangeControl = ({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue,
  disabled,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (val: number) => void
  formatValue?: (val: number) => string
  disabled?: boolean
}) => (
  <div className={cn('space-y-2', disabled && 'opacity-50')}>
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">
        {formatValue ? formatValue(value) : value}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={cn(
        'w-full h-1.5 bg-gray-200 rounded-lg appearance-none accent-black dark:accent-white',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    />
  </div>
)

// Define preset colors constant
const PRESET_COLORS = [
  '#000000', // Black
  '#3f3f46', // Zinc 700
  '#155e75', // Cyan 900
  '#0369a1', // Sky 700
  '#1d4ed8', // Blue 700
  '#be123c', // Rose 700
]

export function ResumeToolbar({ printRef }: ResumeToolbarProps) {
  const {
    serviceId,
    resumeData,
    styleConfig,
    updateStyleConfig,
    currentTemplate,
    setTemplate,
    layoutInfo,
    setLayoutInfo,
    isStructureOpen,
    setStructureOpen,
    isAIPanelOpen,
    setAIPanelOpen,
    resetToOriginal,
    setActive,
    statusMessage,
    setStatusMessage,
  } = useResumeStore()

  const [isResetOpen, setIsResetOpen] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [isStyleOpen, setIsStyleOpen] = useState(false)
  const commitTimerRef = useRef<number | null>(null)

  const dict = useResumeDict()

  // Helper to round to 1 decimal place
  const roundVal = (val: number) => Math.round(val * 10) / 10

  const handleCompactMode = () => {
    const newCompact = !styleConfig.compactMode
    const defaults =
      TemplateDefaultsMap[currentTemplate] || TemplateDefaultsMap['standard']

    if (newCompact) {
      updateStyleConfig({
        compactMode: true,
        lineHeight: roundVal(Math.max(defaults.lineHeight * 0.85, 1.0)),
        itemSpacing: roundVal(Math.max(defaults.itemSpacing * 0.6, 2)),
        sectionSpacing: roundVal(Math.max(defaults.sectionSpacing * 0.6, 6)),
        pageMargin: roundVal(Math.max(defaults.pageMargin * 0.7, 5)),
      })
    } else {
      updateStyleConfig({
        compactMode: false,
        lineHeight: defaults.lineHeight,
        itemSpacing: defaults.itemSpacing,
        sectionSpacing: defaults.sectionSpacing,
        pageMargin: defaults.pageMargin,
      })
    }
  }

  // 等比缩放：开关切换
  // 开启时：使用 scaleFactor 从模板默认值计算参数
  // 关闭时：保留当前缩放后的值，scaleFactor 重置为 1.0
  const handleProportionalScaleToggle = () => {
    const newEnabled = !styleConfig.proportionalScale
    if (newEnabled) {
      // 开启：初始化 scaleFactor 为 1.0，从当前模板默认值开始
      updateStyleConfig({
        proportionalScale: true,
        scaleFactor: 1.0,
      })
    } else {
      // 关闭：保留当前值，重置 scaleFactor
      updateStyleConfig({
        proportionalScale: false,
        scaleFactor: 1.0,
      })
    }
  }

  // 等比缩放：总控制条变化时，基于模板默认值计算所有联动参数
  // 联动参数: fontSize, lineHeight, itemSpacing, sectionSpacing
  // pageMargin 不参与
  const handleMasterScaleChange = (newScaleFactor: number) => {
    const defaults =
      TemplateDefaultsMap[currentTemplate] || TemplateDefaultsMap['standard']

    // 基于模板默认值 × scaleFactor 计算新值
    const newFontSize = roundVal(1 * newScaleFactor) // fontSize 默认倍率为 1
    const newLineHeight = roundVal(defaults.lineHeight * newScaleFactor)
    const newItemSpacing = Math.round(defaults.itemSpacing * newScaleFactor)
    const newSectionSpacing = Math.round(
      defaults.sectionSpacing * newScaleFactor,
    )

    updateStyleConfig({
      scaleFactor: newScaleFactor,
      fontSize: Math.max(0.7, Math.min(1.3, newFontSize)),
      lineHeight: Math.max(0.8, Math.min(3.0, newLineHeight)),
      itemSpacing: Math.max(0, Math.min(48, newItemSpacing)),
      sectionSpacing: Math.max(0, Math.min(64, newSectionSpacing)),
    })
  }

  const handleColorCommit = () => {
    const color = colorInputRef.current?.value
    if (color && !PRESET_COLORS.includes(color)) {
      setRecentColors((prev) => {
        const newColors = [color, ...prev.filter((c) => c !== color)].slice(
          0,
          3,
        )
        return newColors
      })
    }
  }

  useEffect(() => {
    if (!isStyleOpen) return
    const input = colorInputRef.current
    if (!input) return
    input.addEventListener('change', handleColorCommit)
    return () => {
      input.removeEventListener('change', handleColorCommit)
    }
  }, [isStyleOpen])

  const printPageStyle = `
@page { margin: var(--resume-page-margin, 10mm); }
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${resumeData?.basics?.name || 'resume'}_CareerShaper`,
    ignoreGlobalStyles: false,
    pageStyle: printPageStyle,
    // @ts-expect-error - onBeforeGetContent is supported in v3 but types might be outdated
    onBeforeGetContent: async () => {
      // Direct store access to ensure immediate state update
      useResumeStore.getState().setActive(null, null)

      // Force close sidebars to ensure clean print layout and no overlapping UI
      useResumeStore.getState().setAIPanelOpen(false)
      useResumeStore.getState().setStructureOpen(false)

      // Wait for:
      // 1. State updates to propagate (immediate)
      // 2. Sidebar closing animation to finish (800ms in CSS)
      // 3. Layout to stabilize after width change
      await new Promise((resolve) => setTimeout(resolve, 1000))

      return Promise.resolve()
    },
  })

  const handleExportMarkdown = () => {
    if (!resumeData) return

    // Basic implementation of Markdown generation
    let md = `# ${resumeData.basics.name}\n\n`
    md += `${resumeData.basics.mobile || ''} | ${
      resumeData.basics.email || ''
    }\n\n`

    if (resumeData.basics.summary) {
      md += `## 个人总结\n${resumeData.basics.summary}\n\n`
    }

    if (resumeData.workExperiences?.length > 0) {
      md += `## 工作经历\n`
      resumeData.workExperiences.forEach((item) => {
        md += `### ${item.company} | ${item.position} (${item.startDate} - ${item.endDate})\n`
        md += `${item.description}\n\n`
      })
    }

    // ... add other sections as needed ...

    // Trigger download
    const blob = new Blob([md], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${resumeData.basics.name}_resume.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Template name now comes from dictionary via TemplateSelector component

  return (
    <header className="shrink-0 z-30 transition-colors no-print relative">
      <div className="w-full px-3 md:px-4">
        <div className="mx-auto w-full max-w-[1180px]">
          <div className="flex h-10 items-center justify-between rounded-md border border-border/60 bg-card/70 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-r flex-1 mr-4">
            {/* Left Sidebar Toggle - Chapters */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 px-2 transition-colors cursor-pointer"
              onClick={() => setStructureOpen(!isStructureOpen)}
            >
              <PanelLeft
                className={cn(
                  'h-4 w-4',
                  isStructureOpen ? 'text-zinc-900 dark:text-zinc-100' : '',
                )}
              />
              <span className="hidden lg:inline">{dict.toolbar.chapters}</span>
            </Button>

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />

            {/* Template Selector */}
            <TemplateSelector />

            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1 shrink-0" />

            {/* Style Tweaks */}
            <Popover open={isStyleOpen} onOpenChange={setIsStyleOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 text-muted-foreground hover:text-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 px-2 transition-colors cursor-pointer"
                >
                  <Palette className="h-4 w-4" />
                  <span className="hidden lg:inline">{dict.toolbar.style}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-80 p-4 relative max-h-[80vh] overflow-y-auto"
                align="end"
                alignOffset={-70}
              >
                {/* Native Color Input positioned relative to Popover Content */}
                <input
                  ref={colorInputRef}
                  type="color"
                  value={styleConfig.themeColor}
                  onChange={(e) => {
                    const val = e.target.value
                    updateStyleConfig({ themeColor: val })
                    if (commitTimerRef.current) {
                      window.clearTimeout(commitTimerRef.current)
                    }
                    commitTimerRef.current = window.setTimeout(() => {
                      handleColorCommit()
                      commitTimerRef.current = null
                    }, 400)
                  }}
                  onBlur={() => handleColorCommit()}
                  className="sr-only"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    opacity: 0,
                    pointerEvents: 'none',
                    zIndex: -1,
                  }}
                  tabIndex={-1}
                />

                <div className="space-y-6">
                  {/* Theme Color */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-muted-foreground">
                        {dict.toolbar.themeColor}
                      </label>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px] gap-1.5 px-2"
                          onClick={() => colorInputRef.current?.click()}
                        >
                          <Pipette className="w-3.5 h-3.5 text-indigo-500" />
                          {dict.toolbar.colorPicker}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        {/* Presets */}
                        <div className="flex gap-1.5">
                          {PRESET_COLORS.map((color) => (
                            <button
                              key={color}
                              className={cn(
                                'w-6 h-6 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-110 flex items-center justify-center',
                                styleConfig.themeColor === color
                                  ? 'scale-110 ring-1 ring-offset-1'
                                  : 'hover:border-gray-400',
                              )}
                              style={{
                                backgroundColor: color,
                                ...(styleConfig.themeColor === color
                                  ? {
                                      boxShadow: `0 0 0 2px white, 0 0 0 3px ${color}`,
                                    }
                                  : {}),
                              }}
                              onClick={() =>
                                updateStyleConfig({ themeColor: color })
                              }
                            >
                              {styleConfig.themeColor === color && (
                                <Check className="w-3 h-3 text-white drop-shadow-md" />
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Divider & Recent Colors */}
                        {recentColors.length > 0 && (
                          <>
                            <div className="w-px h-6 bg-border shrink-0" />
                            <div className="flex gap-1.5">
                              {recentColors.map((color) => (
                                <button
                                  key={color}
                                  className={cn(
                                    'w-6 h-6 rounded-full border border-gray-200 shadow-sm transition-all hover:scale-110 flex items-center justify-center',
                                    styleConfig.themeColor === color
                                      ? 'scale-110 ring-1 ring-offset-1'
                                      : 'hover:border-gray-400',
                                  )}
                                  style={{
                                    backgroundColor: color,
                                    ...(styleConfig.themeColor === color
                                      ? {
                                          boxShadow: `0 0 0 2px white, 0 0 0 3px ${color}`,
                                        }
                                      : {}),
                                  }}
                                  onClick={() =>
                                    updateStyleConfig({ themeColor: color })
                                  }
                                >
                                  {styleConfig.themeColor === color && (
                                    <Check className="w-3 h-3 text-white drop-shadow-md" />
                                  )}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      {dict.toolbar.font}
                    </label>
                    <Select
                      value={styleConfig.fontFamily}
                      onValueChange={(v) =>
                        updateStyleConfig({ fontFamily: v })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="roboto">
                          Roboto / Inter (默认)
                        </SelectItem>
                        <SelectItem value="inter">Inter (Modern)</SelectItem>
                        <SelectItem value="sans">System Sans</SelectItem>
                        <SelectItem value="serif">Noto Serif / Song</SelectItem>
                        <SelectItem value="jetbrains-mono">
                          JetBrains Mono
                        </SelectItem>
                        <SelectItem value="ibm-plex-mono">
                          IBM Plex Mono
                        </SelectItem>
                        <SelectItem value="lato">Lato</SelectItem>
                        <SelectItem value="open-sans">Open Sans</SelectItem>
                        <SelectItem value="playfair">
                          Playfair Display
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="h-px bg-border" />
                  {/* Compact & Smart Fill Row */}
                  <TooltipProvider>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          {dict.toolbar.compactMode}
                        </label>
                        <button
                          role="switch"
                          aria-checked={styleConfig.compactMode}
                          onClick={handleCompactMode}
                          className={cn(
                            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                            styleConfig.compactMode ? 'bg-primary' : 'bg-input',
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                              styleConfig.compactMode
                                ? 'translate-x-4'
                                : 'translate-x-0',
                            )}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-muted-foreground">
                          {dict.toolbar.proportionalScale}
                        </label>
                        <button
                          role="switch"
                          aria-checked={styleConfig.proportionalScale}
                          onClick={handleProportionalScaleToggle}
                          className={cn(
                            'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                            styleConfig.proportionalScale
                              ? 'bg-primary'
                              : 'bg-input',
                          )}
                        >
                          <span
                            className={cn(
                              'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                              styleConfig.proportionalScale
                                ? 'translate-x-4'
                                : 'translate-x-0',
                            )}
                          />
                        </button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 rounded-full hover:bg-muted"
                            >
                              <HelpCircle className="h-3 w-3 text-muted-foreground/50" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs text-muted-foreground bg-popover border shadow-sm">
                            {dict.toolbar.proportionalTip}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </TooltipProvider>

                  <div className="h-px bg-border" />

                  {/* 等比缩放总控制条 - 仅在启用时显示 */}
                  {styleConfig.proportionalScale && (
                    <div className="space-y-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                      <RangeControl
                        label={dict.toolbar.masterScale}
                        value={styleConfig.scaleFactor ?? 1.0}
                        min={0.7}
                        max={1.3}
                        step={0.01}
                        onChange={handleMasterScaleChange}
                        formatValue={(v) => `${v.toFixed(2)}x`}
                      />
                      <p className="text-[10px] text-muted-foreground/70">
                        {dict.toolbar.masterScaleTip}
                      </p>
                    </div>
                  )}

                  {/* 独立样式滑块 - 等比缩放开启时 disabled */}
                  <RangeControl
                    label={dict.toolbar.fontSize}
                    value={styleConfig.fontSize}
                    min={0.7}
                    max={1.3}
                    step={0.01}
                    disabled={!!styleConfig.proportionalScale}
                    onChange={(v) => updateStyleConfig({ fontSize: v })}
                    formatValue={(v) => `${v.toFixed(2)}x`}
                  />

                  <RangeControl
                    label={dict.toolbar.lineHeight}
                    value={styleConfig.lineHeight}
                    min={0.8}
                    max={3.0}
                    step={0.05}
                    disabled={!!styleConfig.proportionalScale}
                    onChange={(v) => updateStyleConfig({ lineHeight: v })}
                    formatValue={(v) => v.toFixed(2)}
                  />

                  <RangeControl
                    label={dict.toolbar.itemSpacing}
                    value={styleConfig.itemSpacing}
                    min={0}
                    max={48}
                    step={1}
                    disabled={!!styleConfig.proportionalScale}
                    onChange={(v) => updateStyleConfig({ itemSpacing: v })}
                    formatValue={(v) => `${v}px`}
                  />

                  <RangeControl
                    label={dict.toolbar.sectionSpacing}
                    value={styleConfig.sectionSpacing}
                    min={0}
                    max={64}
                    step={2}
                    disabled={!!styleConfig.proportionalScale}
                    onChange={(v) => updateStyleConfig({ sectionSpacing: v })}
                    formatValue={(v) => `${v}px`}
                  />

                  <RangeControl
                    label={dict.toolbar.pageMargin}
                    value={styleConfig.pageMargin}
                    min={5}
                    max={35}
                    step={1}
                    onChange={(v) => updateStyleConfig({ pageMargin: v })}
                    formatValue={(v) => `${v}mm`}
                  />
                </div>
              </PopoverContent>
            </Popover>

            <div className="h-4 w-px bg-border mx-1 shrink-0" />

            {/* Reset */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 px-2 transition-colors cursor-pointer"
              onClick={() => setIsResetOpen(true)}
            >
              <RotateCcw className="h-4 w-4" />
              <span className="hidden lg:inline">{dict.toolbar.reset}</span>
            </Button>

            <div className="h-4 w-px bg-border mx-1 shrink-0" />

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 px-2 transition-colors cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden lg:inline">
                    {dict.toolbar.export}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={handlePrint}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>{dict.toolbar.exportPdf}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportMarkdown}>
                  <FileJson className="mr-2 h-4 w-4" />
                  <span>{dict.toolbar.exportMd}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="h-4 w-px bg-border mx-1 shrink-0" />

            {serviceId && (
              <ShareResumeDialog
                serviceId={serviceId}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 h-8 text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 px-2 transition-colors cursor-pointer"
                  >
                    <Share2 className="h-4 w-4" />
                    <span className="hidden lg:inline">{dict.share.button}</span>
                  </Button>
                }
              />
            )}

            {/* Save Indicator - Shows when dirty */}
            <SaveIndicator variant="inline" />

            {/* Status Message In-Flow */}
            {statusMessage && (
              <div className="ml-4 animate-in fade-in slide-in-from-left-2 duration-300 whitespace-nowrap">
                <div className="px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-xs text-muted-foreground flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5" />
                  {statusMessage.text}
                </div>
              </div>
            )}

            <div className="flex-1" />

            <Dialog open={isResetOpen} onOpenChange={setIsResetOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{dict.toolbar.resetConfirm}</DialogTitle>
                  <DialogDescription>
                    {dict.toolbar.resetDesc}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsResetOpen(false)}
                  >
                    {dict.toolbar.cancel}
                  </Button>
                  <Button
                    className="bg-red-600/70 dark:bg-red-500/70 hover:bg-red-700 text-white"
                    onClick={() => {
                      resetToOriginal()
                      setIsResetOpen(false)
                    }}
                  >
                    {dict.toolbar.confirmReset}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Right Actions - AI Only */}
          <div className="flex items-center gap-0 pl-4 pr-2 shrink-0">
            {/* AI Suggestions - Premium Chip Style */}
            {/* AI Suggestions - Obsidian & Pearl Style */}
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'gap-2 h-8 px-3 rounded-lg transition-all duration-300 cursor-pointer overflow-hidden group relative',
                // Base: Solid Pearl/Obsidian
                'bg-background',
                // Border: Refined
                'border-b border-blue-100 dark:border-blue-900',
                // Text: Blue
                'text-blue-500/90 hover:text-blue-500/100 dark:text-blue-100 font-semibold',
                // Interaction: Lift & Glow Shadow
                'shadow-[0_1px_6px_rgba(99,102,241,0.15)] hover:shadow-[0_4px_12px_rgba(99,102,241,0.3)]',
                'hover:-translate-y-0.5',
              )}
              onClick={() => setAIPanelOpen(!isAIPanelOpen)}
            >
              <span className="relative z-10 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110" />
                <span className="text-xs tracking-wide">
                  {dict.toolbar.aiSuggestions}
                </span>
              </span>
              {/* Shimmer Effect */}
              <div className="absolute inset-0 z-0 bg-gradient-to-r from-transparent via-blue-400/10 dark:via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
            </Button>
          </div>
          </div>
        </div>
      </div>
    </header>
  )
}
