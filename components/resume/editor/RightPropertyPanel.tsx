'use client'

import { useResumeStore } from '@/store/resume-store'
import { Button } from '@/components/ui/button'
import { X, ArrowLeft, Bot } from 'lucide-react'
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

// Helper to detect and strip labels (支持中英文)
const detectLabel = (text: string): { type: 'adjust' | 'reason' | null, content: string } => {
  // Adjust / 调整
  const adjustMatch = text.match(/^[\*]*(Adjust|调整)[:：]\s*[\*]*/i)
  if (adjustMatch) {
    return {
      type: 'adjust',
      content: text.replace(/^[\*]*(Adjust|调整)[:：]\s*[\*]*/i, '')
    }
  }

  // Reason / Why / 理由
  const reasonMatch = text.match(/^[\*]*(Reason|Why|理由)[:：]\s*[\*]*/i)
  if (reasonMatch) {
    return {
      type: 'reason',
      content: text.replace(/^[\*]*(Reason|Why|理由)[:：]\s*[\*]*/i, '')
    }
  }

  return { type: null, content: text }
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
               * DESIGN V5.5: Final Polish based on User Feedback
               * - Removed borders
               * - Enhanced "Sky" gradient for better visibility
               * - Dark mode numbers match title color (Blue-400)
               * - Reduced font sizes and weights to align with toolbar
               */
              <div className="relative">
                {/* Subtle decorative top glow */}
                <div className="absolute -top-2 left-0 right-0 h-16 bg-gradient-to-b from-background via-background/50 to-transparent pointer-events-none rounded-t-lg" />

                {/* Content container */}
                <div className="relative space-y-4 pl-3 text-zinc-500/80 dark:text-zinc-300/80  border-l-[0.1px] border-border">
                  <ReactMarkdown
                    components={{
                      // H3 = Main title
                      h3: ({ node, children, ...props }) => (
                        isMobile ? null : (
                          <div className="mb-2">
                            <h3
                              className="text-sm font-semibold tracking-tight text-foreground"
                              {...props}
                            >
                              {children}
                            </h3>
                          </div>
                        )
                      ),
                      // H1/H2 fallback
                      h1: ({ node, ...props }) => (
                        <h3 className="text-sm font-serif font-bold text-foreground mt-4 mb-2" {...props} />
                      ),
                      h2: ({ node, ...props }) => (
                        <h4 className="text-xs font-serif font-bold text-foreground/90 mt-3 mb-2" {...props} />
                      ),
                      // Ordered list = Main items container (Cards)
                      ol: ({ node, ...props }) => (
                        <ol
                          className={cn(
                            "space-y-5 my-6 text-xs list-none [counter-reset:suggestion-counter]",
                            // CARD STYLING (Main List Items Only) - No Border, Stronger Gradient
                            "[&>li]:relative [&>li]:pl-6 [&>li]:pr-4 [&>li]:pt-4 [&>li]:pb-2 [&>li]:rounded-xl [&>li]:overflow-visible",
                            // Enhanced Gradient: Sky/Blue tint in light mode for better contrast
                            "[&>li]:bg-gradient-to-b [&>li]:from-sky-50/80 [&>li]:via-sky-50/40 [&>li]:to-transparent",
                            "[&>li]:dark:from-blue-300/10 [&>li]:dark:via-blue-300/5 [&>li]:dark:to-transparent",
                            // Counter Logic
                            "[&>li]:[counter-increment:suggestion-counter]",
                            // Big Number via Pseudo-element
                            "[&>li::before]:content-[counter(suggestion-counter,decimal-leading-zero)]",
                            "[&>li::before]:absolute [&>li::before]:top-1 [&>li::before]:-left-1",
                            "[&>li::before]:text-[1.6rem] [&>li::before]:font-bold [&>li::before]:font-mono [&>li::before]:leading-none",
                            // Number Color: Zinc-200 in light, Blue-400 in dark (matches titles)
                            "[&>li::before]:text-zinc-200 dark:[&>li::before]:text-blue-500",
                            "[&>li::before]:z-20", // Ensure it sits above the card background
                            "[&>li]:z-0" // Establish stacking context
                          )}
                          {...props}
                        />
                      ),
                      // Unordered list = Sub-items container (Text)
                      ul: ({ node, ...props }) => (
                        <ul
                          className="space-y-3 mt-2 ml-0.5 list-none relative z-10"
                          {...props}
                        />
                      ),
                      // Paragraphs with refined typography
                      p: ({ node, children, ...props }) => {
                        const text = String(children || '')
                        const { type, content } = detectLabel(text)

                        // 调整 label
                        if (type === 'adjust') {
                          return (
                            <div className="relative pl-3 py-1 my-1.5 border-l-2 border-primary/20 bg-primary/5 rounded-r-sm">
                              <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 font-normal" {...props}>
                                <span className="font-semibold text-primary dark:text-blue-400 mr-1.5">Adjust:</span>
                                <span>{content}</span>
                              </p>
                            </div>
                          )
                        }

                        // 理由 label
                        if (type === 'reason') {
                          return (
                            <div className="relative pl-3 my-1">
                              <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 italic font-serif" {...props}>
                                <span className="not-italic font-medium mr-1 text-zinc-400">Why:</span>
                                <span>{content}</span>
                              </p>
                            </div>
                          )
                        }

                        // Regular paragraph (Section Titles) - Reduced size/weight
                        return (
                          <p className="text-xs font-normal leading-relaxed mb-1 text-zinc-800 dark:text-zinc-100" {...props}>
                            {children}
                          </p>
                        )
                      },
                      // Bold text - Reduced weight impact
                      strong: ({ node, ...props }) => (
                        <strong className="font-semibold text-primary dark:text-blue-400" {...props} />
                      ),
                      // Emphasis
                      em: ({ node, ...props }) => (
                        <em className="italic text-muted-foreground" {...props} />
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
        </div >
      </div >
    )
  }

  // Get section label from dictionary
  const sectionLabel = activeSectionKey ? (dict.sections[activeSectionKey] || dict.forms.editContent) : dict.forms.editContent

  return (
    <div className="flex flex-col h-full bg-card transition-colors">
      <div
        className={cn(
          'flex items-center justify-between sticky top-0 bg-card z-10 border-b border-border',
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
              'font-semibold text-foreground',
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
              ? 'h-8 w-8 text-muted-foreground hover:text-foreground bg-accent/50 rounded-full'
              : 'h-8 w-8 text-muted-foreground hover:text-foreground'
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
