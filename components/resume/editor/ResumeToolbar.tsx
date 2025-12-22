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
} from 'lucide-react'
import { RESUME_TEMPLATES, TemplateId } from '../constants'
import { TemplateSelector } from './TemplateSelector'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useReactToPrint } from 'react-to-print'

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
  } = useResumeStore()

  const [isResetOpen, setIsResetOpen] = useState(false)

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${resumeData?.basics?.name || 'resume'}_CareerShaper`,
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
    <header className="flex h-12 items-center justify-between border-b bg-white dark:bg-zinc-900 dark:border-zinc-800 px-3 mt-2 mx-2 shrink-0 z-30 shadow-sm transition-colors">
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
        <Popover>
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
          <PopoverContent className="w-80 p-4" align="start">
            <div className="space-y-6">
              {/* Theme Color */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  主色调
                </label>
                <div className="flex py-2 gap-2 flex-wrap items-center">
                  {/* Professional Palette */}
                  {[
                    '#000000', // Black
                    '#71717a', // Zinc 500
                    '#155e75', // Cyan 900
                    '#0284c7', // Sky 600
                    '#0d9488', // Teal 600
                    '#9d174d', // Pink 800
                  ].map((color) => (
                    <button
                      key={color}
                      className={cn(
                        'w-6 h-6 rounded-full border-2 transition-all',
                        styleConfig.themeColor === color
                          ? 'border-zinc-300 scale-120'
                          : 'border-transparent hover:scale-110'
                      )}
                      style={{ backgroundColor: color }}
                      onClick={() => updateStyleConfig({ themeColor: color })}
                    />
                  ))}

                  {/* Custom Color Picker */}
                  <div
                    className="relative w-6 h-6 rounded-full overflow-hidden border-2 border-gray-200 hover:border-gray-900 hover:scale-110 transition-all cursor-pointer shadow-sm group"
                    title="自定义颜色"
                  >
                    <div className="absolute inset-0 bg-[conic-gradient(from_90deg,red,yellow,lime,aqua,blue,magenta,red)]" />
                    <input
                      type="color"
                      value={styleConfig.themeColor}
                      onChange={(e) =>
                        updateStyleConfig({ themeColor: e.target.value })
                      }
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200%] h-[200%] p-0 m-0 border-none cursor-pointer opacity-0"
                    />
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
                    <SelectItem value="roboto">Roboto / Inter (默认)</SelectItem>
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
                min={12}
                max={48}
                step={4}
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
