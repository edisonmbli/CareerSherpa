'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { X, Lightbulb, ArrowLeft, Sparkles, Bot } from 'lucide-react'
import { BasicsForm } from '../forms/BasicsForm'
import { SummaryForm } from '../forms/SummaryForm'
import { WorkExperienceForm } from '../forms/WorkExperienceForm'
import { ProjectExperienceForm } from '../forms/ProjectExperienceForm'
import { EducationForm } from '../forms/EducationForm'
import { CustomSectionForm } from '../forms/CustomSectionForm'
import { SimpleSectionForm } from '../forms/SimpleSectionForm'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

const SECTION_LABELS: Record<string, string> = {
  basics: '基本信息',
  summary: '个人总结',
  workExperiences: '工作经历',
  projectExperiences: '项目经历',
  educations: '教育经历',
  skills: '技能特长',
  certificates: '证书奖项',
  hobbies: '兴趣爱好',
  customSections: '自定义板块',
}

export function RightPropertyPanel({
  isMobile,
  onClose,
  showAI,
}: {
  isMobile?: boolean
  onClose?: () => void
  showAI?: boolean
}) {
  const {
    activeSectionKey,
    activeItemId,
    setActive,
    optimizeSuggestion,
    setAIPanelOpen,
    isAIPanelOpen,
  } = useResumeStore()

  const handleBack = () => {
    if (activeItemId) {
      // If in item detail view, go back to list view
      setActive(activeSectionKey, null)
    } else {
      // If in list view, go back to structure
      setActive(null, null)
    }
  }

  const renderForm = () => {
    switch (activeSectionKey) {
      case 'basics':
        return <BasicsForm />
      case 'summary':
        return <SummaryForm />
      case 'workExperiences':
        return <WorkExperienceForm />
      case 'projectExperiences':
        return <ProjectExperienceForm />
      case 'educations':
        return <EducationForm />
      case 'skills':
        return (
          <SimpleSectionForm
            sectionKey="skills"
            label="技能特长"
            placeholder="列出你的核心技能..."
          />
        )
      case 'certificates':
        return (
          <SimpleSectionForm
            sectionKey="certificates"
            label="证书奖项"
            placeholder="列出获得的证书或奖项..."
          />
        )
      case 'hobbies':
        return (
          <SimpleSectionForm
            sectionKey="hobbies"
            label="兴趣爱好"
            placeholder="列出你的兴趣爱好..."
          />
        )
      case 'customSections':
        return <CustomSectionForm />
      default:
        return null
    }
  }

  if (!activeSectionKey) {
    // If panel is not open (closing) and not forced to show AI, don't render content to avoid flash
    if (!isAIPanelOpen && !showAI) return null

    return (
      <div className="flex flex-col h-full bg-white dark:bg-zinc-900 transition-colors">
        <div className="flex items-center justify-end p-2 sticky top-0 bg-white dark:bg-zinc-900 z-10 close-button">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            onClick={() => setAIPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* AI Suggestions with native scrolling for better reliability */}
        <div
          className="flex-1 overflow-y-auto min-h-0"
          data-vaul-no-drag
          style={{
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehavior: 'contain',
          }}
        >
          <div className="px-6 pb-24 pt-4">
            {optimizeSuggestion ? (
              <div className="space-y-6">
                <div className="flex items-start gap-3 bg-gradient-to-r from-blue-50/80 to-blue-200/80 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-100 dark:border-blue-900/30">
                  <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                    基于简历内容与目标岗位的匹配分析，我为您整理了以下优化建议，希望能帮助您脱颖而出。
                  </div>
                </div>

                <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert">
                  <ReactMarkdown
                    components={{
                      h1: ({ node, ...props }) => (
                        <h3
                          className="text-base font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h4
                          className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-3 mb-2"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h5
                          className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-2 mb-1"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul className="list-disc pl-5 space-y-2" {...props} />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="list-decimal pl-5 space-y-2"
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }) => (
                        <li
                          className="leading-relaxed pl-1 text-sm"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }) => (
                        <p
                          className="mb-4 leading-relaxed text-sm"
                          {...props}
                        />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong
                          className="font-bold text-gray-900 dark:text-gray-100"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {optimizeSuggestion}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center space-y-4 opacity-60">
                <Bot className="w-12 h-12 text-gray-300 dark:text-zinc-600" />
                <p className="text-sm text-muted-foreground">
                  暂无优化建议，请先生成简历
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900 transition-colors">
      <div
        className={cn(
          'flex items-center justify-between sticky top-0 bg-white dark:bg-zinc-900 z-10 dark:border-zinc-800',
          isMobile ? 'p-3 h-10' : 'p-2'
        )}
      >
        <div className="flex items-center gap-2 pl-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'text-muted-foreground hover:text-foreground',
              isMobile ? 'h-9 w-9 -ml-1' : 'h-8 w-8 -ml-2'
            )}
            onClick={handleBack}
          >
            <ArrowLeft className={cn('h-4 w-4', isMobile && 'h-5 w-5')} />
          </Button>
          <span
            className={cn(
              'font-semibold text-gray-900 dark:text-gray-100',
              isMobile ? 'text-lg' : 'text-base'
            )}
          >
            {SECTION_LABELS[activeSectionKey] || '编辑内容'}
          </span>
        </div>

        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            isMobile
              ? 'h-8 w-8 text-muted-foreground hover:text-foreground bg-gray-100/50 dark:bg-zinc-800/50 rounded-full'
              : 'h-8 w-8 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100'
          )}
          onClick={() => {
            if (isMobile && onClose) {
              onClose()
            } else {
              setAIPanelOpen(false)
              setActive(null, null)
            }
          }}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content Area with native scrolling for better reliability */}
      <div
        className="flex-1 overflow-y-auto min-h-0"
        data-vaul-no-drag
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-y',
          overscrollBehavior: 'contain',
        }}
      >
        <div className={cn('pb-24', isMobile ? 'p-4' : 'p-6')}>
          {renderForm()}
        </div>
      </div>
    </div>
  )
}
