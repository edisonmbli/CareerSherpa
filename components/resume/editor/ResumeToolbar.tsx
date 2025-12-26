'use client'

import { useResumeStore } from '@/store/resume-store'
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

interface ResumeToolbarProps {
  printRef: React.RefObject<HTMLDivElement>
  ctaAction?: React.ReactNode
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
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (val: number) => void
  formatValue?: (val: number) => string
}) => (
  <div className="space-y-2">
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
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black dark:accent-white"
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

export function ResumeToolbar({ printRef, ctaAction }: ResumeToolbarProps) {
  const {
    resumeData,
    styleConfig,
    updateStyleConfig,
    currentTemplate,
    setTemplate,
    isStructureOpen,
    setStructureOpen,
    isAIPanelOpen,
    setAIPanelOpen,
    resetToOriginal,
    setActive,
    statusMessage,
    viewMode,
    setViewMode,
  } = useResumeStore()

  const [isResetOpen, setIsResetOpen] = useState(false)
  const colorInputRef = useRef<HTMLInputElement>(null)
  const [recentColors, setRecentColors] = useState<string[]>([])
  const [isStyleOpen, setIsStyleOpen] = useState(false)
  const commitTimerRef = useRef<number | null>(null)

  const handleColorCommit = () => {
    const color = colorInputRef.current?.value
    if (color && !PRESET_COLORS.includes(color)) {
      setRecentColors((prev) => {
        const newColors = [color, ...prev.filter((c) => c !== color)].slice(
          0,
          3
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

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${resumeData?.basics?.name || 'resume'}_CareerShaper`,
    // @ts-expect-error - onBeforeGetContent is supported in v3 but types might be outdated
    onBeforeGetContent: () => {
      setActive(null)
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

  const currentTemplateName =
    RESUME_TEMPLATES.find((t) => t.id === currentTemplate)?.name || '标准通用'

  return (
    <header className="flex h-12 items-center justify-between border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 px-3 mt-2 mx-2 shrink-0 z-30 shadow-sm transition-colors no-print relative">
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-r flex-1 mr-4 ">
        {/* Left Sidebar Toggle - Chapters */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-8 text-muted-foreground hover:text-foreground shrink-0 px-2"
          onClick={() => setStructureOpen(!isStructureOpen)}
        >
          <PanelLeft
            className={cn(
              'h-4 w-4',
              isStructureOpen ? 'text-blue-600 dark:text-blue-400' : ''
            )}
          />
          <span className="hidden lg:inline">章节</span>
        </Button>

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* Template Selector */}
        <TemplateSelector />

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* Style Tweaks */}
        <Popover open={isStyleOpen} onOpenChange={setIsStyleOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-2 text-muted-foreground hover:text-foreground shrink-0 px-2"
            >
              <Palette className="h-4 w-4" />
              <span className="hidden lg:inline">样式</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4 relative" align="start">
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
                    主色调
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] gap-1.5 px-2"
                      onClick={() => colorInputRef.current?.click()}
                    >
                      <Pipette className="w-3.5 h-3.5 text-indigo-500" />
                      取色器
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
                              : 'hover:border-gray-400'
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
                                  : 'hover:border-gray-400'
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
                  字体
                </label>
                <Select
                  value={styleConfig.fontFamily}
                  onValueChange={(v) => updateStyleConfig({ fontFamily: v })}
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
                    <SelectItem value="ibm-plex-mono">IBM Plex Mono</SelectItem>
                    <SelectItem value="lato">Lato</SelectItem>
                    <SelectItem value="open-sans">Open Sans</SelectItem>
                    <SelectItem value="playfair">Playfair Display</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="h-px bg-border" />
              {/* Compact & Smart Fill Row */}
              <TooltipProvider>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      紧凑模式
                    </label>
                    <button
                      role="switch"
                      aria-checked={styleConfig.compactMode}
                      onClick={() =>
                        updateStyleConfig({
                          compactMode: !styleConfig.compactMode,
                        })
                      }
                      className={cn(
                        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                        styleConfig.compactMode ? 'bg-primary' : 'bg-input'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                          styleConfig.compactMode
                            ? 'translate-x-4'
                            : 'translate-x-0'
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      智能填充
                    </label>
                    <button
                      role="switch"
                      aria-checked={styleConfig.smartFill}
                      onClick={() =>
                        updateStyleConfig({ smartFill: !styleConfig.smartFill })
                      }
                      className={cn(
                        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
                        styleConfig.smartFill ? 'bg-primary' : 'bg-input'
                      )}
                    >
                      <span
                        className={cn(
                          'pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform',
                          styleConfig.smartFill
                            ? 'translate-x-4'
                            : 'translate-x-0'
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
                        智能微调当前页的行高与段间距，以减少页尾空白
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </TooltipProvider>

              <div className="h-px bg-border" />

              {/* Sliders */}
              <RangeControl
                label="字体大小 (倍率)"
                value={styleConfig.fontSize}
                min={0.8}
                max={1.2}
                step={0.05}
                onChange={(v) => updateStyleConfig({ fontSize: v })}
                formatValue={(v) => `${v.toFixed(2)}x`}
              />

              <RangeControl
                label="行间距"
                value={styleConfig.lineHeight}
                min={1.0}
                max={2.0}
                step={0.1}
                onChange={(v) => updateStyleConfig({ lineHeight: v })}
                formatValue={(v) => v.toFixed(1)}
              />

              <RangeControl
                label="段落间距 (px)"
                value={styleConfig.sectionSpacing}
                min={6}
                max={48}
                step={2}
                onChange={(v) => updateStyleConfig({ sectionSpacing: v })}
                formatValue={(v) => `${v}px`}
              />

              <RangeControl
                label="页面边距 (mm)"
                value={styleConfig.pageMargin}
                min={10}
                max={30}
                step={2}
                onChange={(v) => updateStyleConfig({ pageMargin: v })}
                formatValue={(v) => `${v}mm`}
              />
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* Reset */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-8 text-muted-foreground hover:text-foreground shrink-0 px-2"
          onClick={() => setIsResetOpen(true)}
        >
          <RotateCcw className="h-4 w-4" />
          <span className="hidden lg:inline">重置</span>
        </Button>

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* Export */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 h-8 text-muted-foreground hover:text-foreground shrink-0 px-2"
            >
              <Download className="h-4 w-4" />
              <span className="hidden lg:inline">导出</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handlePrint}>
              <FileText className="mr-2 h-4 w-4" />
              <span>导出为 PDF</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportMarkdown}>
              <FileJson className="mr-2 h-4 w-4" />
              <span>导出为 Markdown</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-gray-200 dark:bg-zinc-700 mx-1 shrink-0" />

        {/* View Mode Toggle - Moved to be part of the left group */}
        <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-md p-0.5 border border-transparent mx-1">
          <button
            onClick={() => setViewMode('web')}
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded-sm transition-all',
              viewMode === 'web'
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Web
          </button>
          <button
            onClick={() => setViewMode('print')}
            className={cn(
              'px-2 py-0.5 text-[10px] font-medium rounded-sm transition-all',
              viewMode === 'print'
                ? 'bg-white dark:bg-zinc-700 shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            打印
          </button>
        </div>

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
              <DialogTitle>确认重置简历？</DialogTitle>
              <DialogDescription>
                此操作将清除所有二次编辑的内容，恢复到AI生成的初始版本。此操作无法撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsResetOpen(false)}>
                取消
              </Button>
              <Button
                className="bg-red-600/70 dark:bg-red-500/70 hover:bg-red-700 text-white"
                onClick={() => {
                  resetToOriginal()
                  setIsResetOpen(false)
                }}
              >
                确认重置
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Right Actions - AI & CTA */}
      <div className="flex items-center gap-0 pl-4 shrink-0">
        {/* AI Suggestions - Now Primary Weight */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'gap-2 h-8 px-3 hover:bg-blue-500 hover:text-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium rounded-md transition-colors'
          )}
          onClick={() => setAIPanelOpen(!isAIPanelOpen)}
        >
          <Sparkles className="h-4 w-4" />
          <span>AI 建议</span>
        </Button>

        {/* Divider - Vertically centered */}
        <div className="flex items-center h-full mx-3">
          <div className="h-4 w-px bg-border/80" />
        </div>

        {/* CTA Zone */}
        {ctaAction}
      </div>
    </header>
  )
}
