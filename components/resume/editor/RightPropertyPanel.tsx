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
import { useResumeDict } from '../ResumeDictContext'

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

  const dict = useResumeDict()

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
            label={dict.sections['skills'] || 'Skills'}
            placeholder={dict.forms.skillsPlaceholder}
          />
        )
      case 'certificates':
        return (
          <SimpleSectionForm
            sectionKey="certificates"
            label={dict.sections['certificates'] || 'Certifications'}
            placeholder={dict.forms.certificatesPlaceholder}
          />
        )
      case 'hobbies':
        return (
          <SimpleSectionForm
            sectionKey="hobbies"
            label={dict.sections['hobbies'] || 'Interests'}
            placeholder={dict.forms.hobbiesPlaceholder}
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
              /*
               * DESIGN V5.2: "Magic Scroll" Premium Reference Style
               * - Blue-600 color matching toolbar "AI 建议"
               * - Hide header on mobile (redundant with drawer nav)
               * - Subtle premium visual: soft glow, decorative accents
               */
              <div className="relative">
                {/* Subtle decorative top glow - "scroll unfolding" effect */}
                <div className="absolute -top-2 left-0 right-0 h-16 bg-gradient-to-b from-blue-50/50 via-blue-50/25 to-transparent dark:from-blue-950/30 dark:via-blue-950/10 pointer-events-none rounded-t-lg" />

                {/* Content container with subtle left accent line */}
                <div className="relative space-y-4 pl-3 border-l-2 border-blue-100 dark:border-blue-900/50">
                  <ReactMarkdown
                    components={{
                      // H3 = Main title - hide on mobile (redundant with drawer header)
                      h3: ({ node, children, ...props }) => (
                        isMobile ? null : (
                          <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-200 dark:border-zinc-700">
                            <h3
                              className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
                              {...props}
                            >
                              {children}
                            </h3>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 -mr-2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                              onClick={() => setAIPanelOpen(false)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )
                      ),
                      // H1/H2 fallback
                      h1: ({ node, ...props }) => (
                        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-4 mb-2" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h4 className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-3 mb-2" {...props} />
                      ),
                      // Ordered list = Main items container (numbered, with counter)
                      ol: ({ node, ...props }) => (
                        <ol
                          className="ai-main-list space-y-4 my-4"
                          style={{ counterReset: 'suggestion-counter', listStyle: 'none' }}
                          {...props}
                        />
                      ),
                      // Unordered list = Sub-items container (nested under main items)
                      ul: ({ node, ...props }) => (
                        <ul
                          className="ai-sub-list space-y-2 mt-2 ml-1"
                          style={{ listStyle: 'none' }}
                          {...props}
                        />
                      ),
                      // List items - styling determined by parent (ol = main, ul = sub)
                      // No content-based detection needed - structure tells us the type
                      li: ({ node, children, ...props }) => (
                        <li className="ai-list-item relative" {...props}>
                          {/* Number decoration for main items - rendered via CSS */}
                          <span className="ai-suggestion-number" />
                          {/* Content wrapper */}
                          <div className="ai-item-content">
                            {children}
                          </div>
                        </li>
                      ),
                      // Paragraphs with smart 调整/理由 detection
                      p: ({ node, children, ...props }) => {
                        const text = String(children || '')

                        // 调整 label - blue left bar
                        if (text.match(/^[\*]*调整[:：]/)) {
                          return (
                            <div className="relative pl-3 py-2 my-2 bg-blue-50 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-400 rounded-r">
                              <p className="text-xs leading-relaxed" {...props}>
                                <span className="font-semibold text-blue-700 dark:text-blue-400">调整：</span>
                                <span className="text-zinc-700 dark:text-zinc-300">
                                  {text.replace(/^[\*]*调整[:：]\s*[\*]*/, '')}
                                </span>
                              </p>
                            </div>
                          )
                        }

                        // 理由 label - purple left bar  
                        if (text.match(/^[\*]*理由[:：]/)) {
                          return (
                            <div className="relative pl-3 py-2 my-2 bg-purple-50 dark:bg-purple-950/30 border-l-2 border-purple-500 dark:border-purple-400 rounded-r">
                              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400" {...props}>
                                <span className="font-semibold text-purple-700 dark:text-purple-400">理由：</span>
                                <span>{text.replace(/^[\*]*理由[:：]\s*[\*]*/, '')}</span>
                              </p>
                            </div>
                          )
                        }

                        // Regular paragraph - inherit color from parent container
                        return (
                          <p className="text-xs leading-relaxed mb-2" {...props}>
                            {children}
                          </p>
                        )
                      },
                      // Bold text - inherit color from parent to respect container styling
                      strong: ({ node, ...props }) => (
                        <strong className="font-semibold" {...props} />
                      ),
                      // Emphasis - inherit color
                      em: ({ node, ...props }) => (
                        <em className="italic" {...props} />
                      ),
                      // Inline code
                      code: ({ node, ...props }) => (
                        <code className="text-xs px-1 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-indigo-600 dark:text-indigo-400 font-mono" {...props} />
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
                  {dict.forms.noSuggestions}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Get section label from dictionary
  const sectionLabel = activeSectionKey ? (dict.sections[activeSectionKey] || dict.forms.editContent) : dict.forms.editContent

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
            {sectionLabel}
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
