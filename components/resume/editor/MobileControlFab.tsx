'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  LayoutTemplate,
  Palette,
  Sparkles,
  Download,
  RotateCcw,
  ChevronLeft,
  Menu,
  X,
  PanelLeft,
  AlertTriangle,
  FileText,
  FileJson,
} from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'
import { useResumeStore } from '@/store/resume-store'
import { StructureOutline } from './StructureOutline'
import { RightPropertyPanel } from './RightPropertyPanel'
import { RESUME_TEMPLATES } from '../constants'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useReactToPrint } from 'react-to-print'
import { generateMarkdown } from '@/lib/export-utils'
import { toast } from 'sonner'

interface MobileControlFabProps {
  printRef?: React.RefObject<HTMLDivElement> | React.RefObject<any>
}

export function MobileControlFab({ printRef }: MobileControlFabProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeView, setActiveView] = useState<
    | 'menu'
    | 'chapters'
    | 'style'
    | 'templates'
    | 'ai'
    | 'export'
    | 'reset-confirm'
  >('menu')
  const [isCopied, setIsCopied] = useState(false)

  const {
    currentTemplate,
    setTemplate,
    resetToOriginal,
    isAIPanelOpen,
    setAIPanelOpen,
    isStructureOpen,
    setStructureOpen,
    activeSectionKey,
    setActive,
    resumeData,
  } = useResumeStore()

  const SubmenuHeader = ({
    title,
    onBack,
    onClose,
  }: {
    title?: string
    onBack: () => void
    onClose: () => void
  }) => (
    <div className="flex items-center justify-between px-4 py-3 border-gray-100 dark:border-zinc-800 shrink-0">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="h-8 px-2 gap-1 text-sm text-gray-400 hover:text-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium"
      >
        <ChevronLeft className="h-4 w-4" />
        <span>返回菜单</span>
      </Button>
      {/* Title is intentionally omitted or minimal based on design */}
      {title && <span className="font-semibold text-sm">{title}</span>}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="h-8 w-8 text-gray-400 hover:text-gray-600"
      >
        <X className="h-5 w-5" />
      </Button>
    </div>
  )

  // Helper to open specific view
  const openView = (view: typeof activeView) => {
    setActiveView(view)
    if (view === 'menu') {
      // Reset sidebar states when going back to menu
      setStructureOpen(false)
      setAIPanelOpen(false)
      setActive(null, null)
    } else if (view === 'chapters') {
      // Don't trigger desktop sidebar
      setAIPanelOpen(false)
    } else if (view === 'ai') {
      // Do NOT set global AI Panel state to avoid desktop sidebar sliding out
      // Just use local drawer view
      setAIPanelOpen(false)
      setStructureOpen(false)
    }
  }

  // Handle Close
  const handleClose = () => {
    setIsOpen(false)
    setActiveView('menu')
    // Reset internal states
    setStructureOpen(false)
    setAIPanelOpen(false)
    // Clear active section highlighting on canvas
    setActive(null, null)
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef as any,
    documentTitle: `${resumeData?.basics?.name || 'resume'}_CareerShaper`,
    onAfterPrint: () => handleClose(),
  })

  const handleExportMarkdown = async () => {
    if (!resumeData) return
    const md = generateMarkdown(resumeData)
    try {
      await navigator.clipboard.writeText(md)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      toast.error('复制失败，请手动复制')
    }
  }

  const menuItems = [
    {
      id: 'chapters',
      label: '内容编辑',
      icon: PanelLeft,
      // Default style
    },
    {
      id: 'templates',
      label: '切换模板',
      icon: LayoutTemplate,
    },
    {
      id: 'export',
      label: '导出简历',
      icon: Download,
    },
    {
      id: 'reset',
      label: '重置内容',
      icon: RotateCcw,
      // Removed danger style to match others
      onClick: () => setActiveView('reset-confirm'),
    },
  ]

  return (
    <>
      {/* FAB - Raised to avoid overlap with bottom CTA */}
      {!isOpen && (
        <Button
          size="icon"
          className={cn(
            'fixed bottom-[85px] right-4 h-10 w-10 rounded-full shadow-lg z-40 transition-all duration-300 md:hidden bg-gradient-to-r from-blue-200 to-blue-300 text-blue-600 hover:from-blue-200 hover:to-blue-300 active:scale-95 border border-blue-200'
          )}
          onClick={() => setIsOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Main Drawer */}
      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleClose()
          } else {
            setIsOpen(true)
          }
        }}
      >
        <DrawerContent className="max-h-[85vh] h-auto outline-none bg-white dark:bg-zinc-950 border-none">
          <DrawerDescription className="sr-only">
            Mobile Editor Menu
          </DrawerDescription>
          {/* Menu View */}
          {activeView === 'menu' && (
            <div className="p-4 space-y-4">
              <DrawerHeader className="p-0 text-left">
                <DrawerTitle className="text-base font-bold">
                  编辑器菜单
                </DrawerTitle>
                <DrawerDescription className="text-xs">
                  选择操作以调整简历
                </DrawerDescription>
              </DrawerHeader>

              {/* AI Feature - Prominent Card */}
              <button
                onClick={() => openView('ai')}
                className="w-full group relative overflow-hidden rounded-xl p-4 text-left transition-all active:scale-[0.98] bg-gradient-to-r from-blue-50/80 to-blue-200/80 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-100 dark:border-blue-900/30"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-base mb-1 flex items-center gap-2 text-blue-700 dark:text-blue-300">
                      AI 优化建议
                    </div>
                    <div className="text-blue-600/80 dark:text-blue-400/80 text-xs font-medium">
                      获取针对性的修改建议与优化方案
                    </div>
                  </div>
                  <div className="bg-white/50 dark:bg-blue-300/90 p-2 rounded-full backdrop-blur-sm group-hover:bg-white/60 transition-colors">
                    <Sparkles className="w-5 h-5 text-blue-500" />
                  </div>
                </div>
              </button>

              {/* Grid Menu */}
              <div className="grid grid-cols-2 gap-3">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={item.onClick || (() => openView(item.id as any))}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border transition-all active:scale-[0.98] text-left bg-gray-50/60 hover:bg-gray-100 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 text-foreground dark:text-foreground border-gray-200 dark:border-zinc-800'
                    )}
                  >
                    <div className={cn('p-1.5 rounded-md text-foreground')}>
                      <item.icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-normal text-muted-foreground">
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chapters View */}
          {activeView === 'chapters' && (
            <div className="flex flex-col h-[65vh]">
              {!activeSectionKey && (
                <SubmenuHeader
                  onBack={() => setActiveView('menu')}
                  onClose={handleClose}
                />
              )}
              {activeSectionKey ? (
                <div className="flex-1 overflow-hidden relative">
                  <RightPropertyPanel isMobile onClose={handleClose} />
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto">
                    <StructureOutline isMobile onClose={handleClose} />
                  </div>
                </>
              )}
            </div>
          )}

          {/* AI View */}
          {activeView === 'ai' && (
            <div className="flex flex-col h-[65vh] [&_.close-button]:hidden [&_.pb-20]:pb-6 [&_.p-6]:p-4">
              <SubmenuHeader
                onBack={() => setActiveView('menu')}
                onClose={handleClose}
              />
              <div className="sr-only">
                <DrawerTitle>AI Optimization</DrawerTitle>
                <DrawerDescription>
                  AI suggestions for your resume
                </DrawerDescription>
              </div>
              <div className="flex-1 overflow-hidden relative px-2 pt-0">
                <RightPropertyPanel
                  showAI={true}
                  isMobile
                  onClose={handleClose}
                />
              </div>
            </div>
          )}

          {/* Templates View */}
          {activeView === 'templates' && (
            <div className="flex flex-col h-[80vh] px-0 py-0">
              <SubmenuHeader
                onBack={() => setActiveView('menu')}
                onClose={handleClose}
              />
              <DrawerHeader className="p-0 text-left pb-2 hidden">
                <DrawerTitle className="text-base font-bold hidden">
                  选择模板
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                  Choose Template
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex-1 overflow-y-auto px-4 pt-4">
                <div className="grid grid-cols-2 gap-4 pb-20">
                  {RESUME_TEMPLATES.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => {
                        setTemplate(t.id)
                        handleClose()
                      }}
                      className={cn(
                        'border rounded-lg p-3 text-center cursor-pointer active:scale-95 transition-all',
                        currentTemplate === t.id
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-zinc-800'
                      )}
                    >
                      <div className="aspect-[210/297] bg-gray-200 dark:bg-zinc-700 rounded mb-2" />
                      <span className="text-sm font-medium">{t.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Export View */}
          {activeView === 'export' && (
            <div className="px-0 py-0 space-y-0 h-auto flex flex-col">
              <SubmenuHeader
                onBack={() => setActiveView('menu')}
                onClose={handleClose}
              />
              <div className="px-4 py-4 space-y-4">
                <DrawerHeader className="p-0 text-left hidden">
                  <DrawerTitle className="text-base font-bold hidden">
                    导出简历
                  </DrawerTitle>
                  <DrawerDescription className="text-xs">
                    选择导出格式
                  </DrawerDescription>
                </DrawerHeader>

                <div className="grid gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="justify-start h-14"
                    onClick={() => {
                      handlePrint()
                    }}
                  >
                    <FileText className="mr-3 h-5 w-5 text-blue-500" />
                    <div className="text-left">
                      <div className="text-sm font-normal">导出为 PDF</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        适合打印和投递
                      </div>
                    </div>
                  </Button>

                  <Button
                    variant="outline"
                    size="lg"
                    className="justify-start h-14 w-full relative"
                    onClick={handleExportMarkdown}
                  >
                    <FileJson className="mr-3 h-5 w-5 text-blue-500" />
                    <div className="text-left">
                      <div className="text-sm font-normal">导出为 Markdown</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        点击复制内容
                      </div>
                    </div>
                    {isCopied && (
                      <span className="absolute right-4 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full animate-in fade-in zoom-in duration-200 flex items-center gap-1 border border-green-100">
                        已复制 ✅
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Reset Confirm View */}
          {activeView === 'reset-confirm' && (
            <div className="px-4 py-4 space-y-6 h-auto flex flex-col items-center text-center">
              <DrawerHeader className="p-0 w-full">
                <DrawerTitle className="sr-only">重置确认</DrawerTitle>
                <DrawerDescription className="sr-only">
                  Reset Confirmation
                </DrawerDescription>
              </DrawerHeader>

              <div className="w-16 h-16 rounded-full bg-red-100/50 dark:bg-red-900/30 flex items-center justify-center mb-2">
                <AlertTriangle className="h-8 w-8 text-red-600/70  dark:text-red-500/70" />
              </div>

              <div className="space-y-2">
                <h3 className="font-bold text-lg">确定要重置所有内容吗？</h3>
                <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                  将清除所有二次编辑的信息并恢复到AI生成的初始版本。此操作
                  <span className="text-red-600/70 dark:text-red-500/70 font-medium">
                    无法撤销
                  </span>
                  。
                </p>
              </div>

              <div className="grid gap-3 w-full pt-2">
                <Button
                  variant="destructive"
                  size="lg"
                  className="w-full h-12 font-medium bg-red-600/70 dark:bg-red-500/70 hover:bg-red-700 text-white"
                  onClick={() => {
                    resetToOriginal()
                    handleClose()
                  }}
                >
                  确认重置
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-12"
                  onClick={() => setActiveView('menu')}
                >
                  取消
                </Button>
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>
    </>
  )
}
