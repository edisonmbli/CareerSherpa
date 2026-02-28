'use client'

import React from 'react'
import { TemplateProps, TemplateConfig } from './types'
import { useResumeTheme } from './hooks/useResumeTheme'
import {
  renderDescription,
  formatDate,
  getSectionTitle,
  renderSocialItem,
} from './utils'
import { cn } from '@/lib/utils'
import { Mail, Phone, Github, MapPin, ExternalLink } from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'
import { ResumeAvatar } from './ResumeAvatar'

/**
 * Corporate 模板 - 企业蓝调
 * 特点：深沉稳重、强模块化分割、权威感排版
 */
export function TemplateCorporate({
  data,
  config,
  styleConfig,
}: TemplateProps) {
  const {
    basics,
    workExperiences,
    projectExperiences,
    educations,
    skills,
    certificates,
    hobbies,
    customSections,
    sectionTitles,
  } = data
  const theme = useResumeTheme({
    ...styleConfig,
    // Apply template-specific overrides if not present in styleConfig (fallback)
    // But since styleConfig comes from store, we should rely on store defaults.
    // However, to ensure "Corporate" look, we might want to enforce some if they are "default".
  })

  // Destructure theme for easier access
  const { isMobile } = theme

  // 辅助组件：企业级模块标题 (带有主色调背景的横条)
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mb-4 mt-6 first:mt-0 break-after-avoid">
      <div
        className="px-3 py-1 flex items-center justify-between"
        style={{ backgroundColor: theme.themeColor }}
      >
        <h3
          className="font-bold text-white uppercase tracking-[0.1em]"
          style={{ fontSize: '0.85em' }}
        >
          {title}
        </h3>
      </div>
    </div>
  )

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null, // Rendered separately in header
    summary: basics.summary && (
      <InteractiveSection sectionKey="summary">
        <section style={theme.section}>
          <SectionHeader
            title={getSectionTitle(
              'summary',
              basics.lang,
              sectionTitles?.['summary']
            )}
          />
          <div
            className="leading-relaxed text-gray-700 text-justify px-1"
            style={theme.text}
          >
            {renderDescription(basics.summary)}
          </div>
        </section>
      </InteractiveSection>
    ),
    skills: skills && (
      <InteractiveSection sectionKey="skills">
        <section style={theme.section}>
          <SectionHeader
            title={getSectionTitle(
              'skills',
              basics.lang,
              sectionTitles?.['skills']
            )}
          />
          <div className="px-1 space-y-3">
            {skills.split('\n').map((line, idx) => {
              const trimmed = line.trim()
              if (!trimmed) return null
              // Detect colon for label:content format
              const colonIndex = trimmed.indexOf('：') !== -1
                ? trimmed.indexOf('：')
                : trimmed.indexOf(':')
              if (colonIndex > 0) {
                const label = trimmed.slice(0, colonIndex)
                const content = trimmed.slice(colonIndex + 1).trim()
                return (
                  <div key={idx} className="text-gray-700" style={theme.text}>
                    <span
                      className="font-bold mr-2"
                      style={{ color: theme.themeColor }}
                    >
                      {label}
                    </span>
                    <span>{content}</span>
                  </div>
                )
              }
              // Fallback: plain line
              return (
                <div key={idx} className="text-gray-700" style={theme.text}>
                  {trimmed.replace(/^[-•]\s*/, '')}
                </div>
              )
            })}
          </div>
        </section>
      </InteractiveSection>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader
            title={getSectionTitle('workExperiences', basics.lang)}
          />
        </InteractiveSection>
        <div className="item-gap px-1">
          {workExperiences.map((item) => (
            <div key={item.id} className="group page-break-fix">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="flex justify-between items-baseline mb-1">
                  <h4
                    className="font-bold text-gray-900 uppercase"
                    style={{ fontSize: '1.1em' }}
                  >
                    {item.company}
                  </h4>
                  <span
                    className="font-semibold text-gray-500 italic"
                    style={{ fontSize: '0.85em' }}
                  >
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Present'}
                  </span>
                </div>
                <div className="font-medium text-gray-600 mb-2 flex justify-between">
                  <span
                    style={{
                      ...theme.text,
                      color: theme.themeColor,
                      fontWeight: 600,
                    }}
                  >
                    {item.position}
                  </span>
                </div>
                <div
                  className="text-gray-700 leading-normal"
                  style={theme.text}
                >
                  {renderDescription(item.description)}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: projectExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="projectExperiences">
          <SectionHeader
            title={getSectionTitle('projectExperiences', basics.lang)}
          />
        </InteractiveSection>
        <div className="item-gap px-1">
          {projectExperiences.map((item) => (
            <div key={item.id} className="page-break-fix">
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div className="flex justify-between items-baseline mb-1">
                  <h4
                    className="font-bold text-gray-800"
                    style={{ fontSize: '1em' }}
                  >
                    {item.projectName}
                  </h4>
                  <span
                    className="text-gray-400 font-mono"
                    style={{ fontSize: '0.8em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                {item.role && (
                  <div className="font-medium text-gray-500 mb-1">
                    <span
                      style={{
                        ...theme.text,
                        color: theme.themeColor,
                        fontWeight: 600,
                      }}
                    >
                      {item.role}
                    </span>
                  </div>
                )}

                {/* Project Links - Optimized for Corporate style */}
                {(item.githubUrl || item.demoUrl) && (
                  <div
                    className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 mb-2 font-mono text-gray-500"
                    style={{ fontSize: '0.8em' }}
                  >
                    {item.demoUrl && (
                      <div className="flex items-center gap-1.5 max-w-full overflow-hidden">
                        <ExternalLink size={12} className="shrink-0" />
                        <a
                          href={item.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-sky-700 hover:underline truncate"
                        >
                          {item.demoUrl.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                    {item.githubUrl && (
                      <div className="flex items-center gap-1.5 max-w-full overflow-hidden">
                        <Github size={12} className="shrink-0" />
                        <a
                          href={item.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:text-sky-700 hover:underline truncate"
                        >
                          {item.githubUrl.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                <div className="text-gray-700" style={theme.text}>
                  {renderDescription(item.description)}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    educations: educations?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="educations">
          <SectionHeader
            title={getSectionTitle(
              'educations',
              basics.lang,
              sectionTitles?.['educations']
            )}
          />
        </InteractiveSection>
        <div className="item-gap px-1">
          {educations.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-start page-break-fix"
            >
              <InteractiveSection
                sectionKey="educations"
                itemId={item.id}
                className="w-full"
              >
                <div className="flex justify-between items-start w-full">
                  <div className="flex flex-col">
                    <span
                      className="font-bold text-gray-900"
                      style={{ fontSize: '1em' }}
                    >
                      {item.school}
                    </span>
                    <span
                      className="text-gray-600"
                      style={{ ...theme.text, fontSize: '0.9em' }}
                    >
                      {item.major} {item.degree && `| ${item.degree}`}
                    </span>
                  </div>
                  <span
                    className="text-gray-500 font-medium whitespace-nowrap ml-4"
                    style={{ fontSize: '0.85em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                {item.description && (
                  <div className="text-gray-600 mt-1" style={theme.text}>
                    {renderDescription(item.description)}
                  </div>
                )}
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    certificates: certificates && (
      <InteractiveSection sectionKey="certificates">
        <section style={theme.section}>
          <SectionHeader title={getSectionTitle('certificates', basics.lang)} />
          <div
            className="px-1 text-gray-700 leading-relaxed"
            style={theme.text}
          >
            {renderDescription(certificates)}
          </div>
        </section>
      </InteractiveSection>
    ),
    hobbies: hobbies && (
      <InteractiveSection sectionKey="hobbies">
        <section style={theme.section}>
          <SectionHeader title={getSectionTitle('hobbies', basics.lang)} />
          <div
            className="px-1 text-gray-700 leading-relaxed"
            style={theme.text}
          >
            {renderDescription(hobbies)}
          </div>
        </section>
      </InteractiveSection>
    ),
    customSections: customSections?.length > 0 && (
      <InteractiveSection sectionKey="customSections">
        <>
          {customSections.map((item) => (
            <section key={item.id} style={theme.section}>
              <SectionHeader title={item.title || 'Untitled'} />
              <div
                className="px-1 text-gray-700 leading-relaxed"
                style={theme.text}
              >
                {renderDescription(item.description)}
              </div>
            </section>
          ))}
        </>
      </InteractiveSection>
    ),
  }

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300 relative',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* 装饰性左边缘线 - 增加设计感 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[4px]"
        style={{ backgroundColor: theme.themeColor }}
      />

      {/* Header: Responsive Executive Layout */}
      <InteractiveSection sectionKey="basics">
        <header className="mb-10 pl-4 pr-2 pt-2">
          {/* Unified responsive layout */}
          <div className="flex justify-between items-stretch relative mb-6">
            {/* Content Container - Responsive */}
            <div className="flex-1 flex items-stretch px-3 md:px-0 py-3 md:py-0 gap-3 md:gap-6">
              {/* Avatar - Handled by ResumeAvatar to gracefully hide if broken/missing */}
              <ResumeAvatar
                photoUrl={basics.photoUrl}
                name={basics.name}
                containerClassName="w-20 h-24 md:w-24 md:h-32 shrink-0 bg-gray-100 border border-gray-200 shadow-sm print:bg-transparent print:shadow-none bg-clip-padding"
                imageClassName="w-full h-full object-cover"
              />

              {/* Info Column - Mobile: right-aligned compact, Desktop: left-aligned expanded */}
              <div className="flex flex-col items-end md:items-start text-right md:text-left min-w-0 flex-1 justify-between md:justify-center">
                {/* Name */}
                <h1
                  className="font-black uppercase tracking-tight text-2xl md:text-4xl leading-tight mb-0 md:mb-2"
                  style={{ color: theme.themeColor }}
                >
                  {basics.name}
                </h1>

                {/* Contacts - Mobile: compact right-aligned, Desktop: hidden (shown in right column) */}
                <div className="flex flex-col items-end gap-0.5 w-full mt-1 md:hidden">
                  {basics.mobile && (
                    <div className="flex flex-row-reverse items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                      <Phone size={12} style={{ color: theme.themeColor }} />
                      <span>{basics.mobile}</span>
                    </div>
                  )}
                  {basics.email && (
                    <div className="flex flex-row-reverse items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                      <Mail size={12} style={{ color: theme.themeColor }} />
                      <span className="truncate max-w-[140px]">
                        {basics.email}
                      </span>
                    </div>
                  )}
                  {(basics.address || basics.location) && (
                    <div className="flex flex-row-reverse items-center gap-1.5 text-[11px] text-gray-600 font-medium">
                      <MapPin size={12} style={{ color: theme.themeColor }} />
                      <span>{basics.address || basics.location}</span>
                    </div>
                  )}
                  {/* Social links - compact mobile */}
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1 justify-end text-[10px] text-gray-500 font-mono">
                    {[
                      'website',
                      'github',
                      'linkedin',
                      'twitter',
                      'dribbble',
                      'behance',
                    ].map((key) => {
                      const val = basics[key as keyof typeof basics]
                      if (!val) return null
                      const social = renderSocialItem(key, val)
                      if (!social) return null
                      const { href, icon: Icon, displayLabel } = social
                      return (
                        <a
                          key={key}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-row-reverse items-center gap-1 hover:text-gray-900 transition-colors"
                        >
                          <Icon size={11} />
                          <span>{displayLabel}</span>
                        </a>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Desktop only: Contacts */}
            <div
              className="hidden md:flex flex-col items-end gap-1.5 pt-2 border-r-4 pr-4"
              style={{ borderColor: theme.themeColor }}
            >
              {basics.mobile && (
                <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium">
                  {basics.mobile}{' '}
                  <Phone size={14} style={{ color: theme.themeColor }} />
                </div>
              )}
              {basics.email && (
                <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium">
                  {basics.email}{' '}
                  <Mail size={14} style={{ color: theme.themeColor }} />
                </div>
              )}
              {(basics.address || basics.location) && (
                <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium">
                  {basics.address || basics.location}{' '}
                  <MapPin size={14} style={{ color: theme.themeColor }} />
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 justify-end text-[11px] text-gray-500 font-mono">
                {[
                  'website',
                  'github',
                  'linkedin',
                  'twitter',
                  'dribbble',
                  'behance',
                ].map((key) => {
                  const val = basics[key as keyof typeof basics]
                  if (!val) return null
                  const social = renderSocialItem(key, val)
                  if (!social) return null
                  const { href, icon: Icon, displayLabel } = social
                  return (
                    <a
                      key={key}
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Icon size={14} />
                      <span>{displayLabel}</span>
                    </a>
                  )
                })}
              </div>
            </div>

            {/* Right Line - Mobile only */}
            <div
              className="w-[5px] shrink-0 md:hidden"
              style={{ backgroundColor: theme.themeColor }}
            />
          </div>
        </header>
      </InteractiveSection>

      {/* Main Content Sections */}
      <div className="flex flex-col pl-4 pr-2">
        {config.order.map((key) => {
          if (config.hidden.includes(key) || key === 'basics') return null
          return <React.Fragment key={key}>{sectionMap[key]}</React.Fragment>
        })}
      </div>
      <footer
        className="mt-12 pt-4 border-t border-gray-100 flex justify-between items-center font-mono text-slate-400/60 tracking-[0.25em]"
        style={{ fontSize: '0.8em' }}
      >
        <span>PORTFOLIO {new Date().getFullYear()}</span>
        <span>By AI CareerSherpa</span>
      </footer>
    </div>
  )
}

export const CorporateDefaults: TemplateConfig = {
  themeColor: '#2454d6', // Royal Blue - Trust & Modern
  fontFamily: 'serif', // Noto Serif / Song 权威感
  fontSize: 1,
  baseFontSize: 14,
  lineHeight: 1.6,
  pageMargin: 12,
  sectionSpacing: 24,
  itemSpacing: 24,
}
