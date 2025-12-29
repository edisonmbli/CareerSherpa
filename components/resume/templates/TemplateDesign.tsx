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
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Globe,
  User,
  GraduationCap,
  Home,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

/**
 * Designer Template V5 - "Swiss Style" (Visual Premium)
 * Features:
 * - Brand Canvas Header (Asymmetric Split)
 * - Academic Matrix (Grid Education)
 * - Micro-Typography (Bold Spacing, Contrast)
 * - Card Layout (Projects as Artworks)
 */
export function TemplateDesign({ data, config, styleConfig }: TemplateProps) {
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

  const theme = useResumeTheme(styleConfig)

  // Helper to check if section has data
  const hasData = (key: string) => {
    if (key === 'summary') return !!basics.summary
    if (key === 'basics') return true
    const val = data[key as keyof typeof data]
    if (Array.isArray(val)) return val.length > 0
    return !!val
  }

  // Generate flat list of visible sections for correct indexing
  const getFlatOrderedKeys = () => {
    const keys: string[] = []
    config.order.forEach((key) => {
      if (config.hidden.includes(key)) return
      if (key === 'basics') return // Basics usually doesn't have a number

      if (key === 'customSections') {
        if (customSections && customSections.length > 0) {
          customSections.forEach((item) => {
            keys.push(`customSections-${item.id}`)
          })
        }
      } else {
        if (hasData(key)) {
          keys.push(key)
        }
      }
    })
    return keys
  }

  const flatOrderedKeys = getFlatOrderedKeys()

  const getDynamicIndex = (sectionKey: string) => {
    const index = flatOrderedKeys.indexOf(sectionKey)
    return index !== -1 ? (index + 1).toString().padStart(2, '0') : '00'
  }

  // Helper: Section Header with Digital Index & Geometric Line
  const SectionHeader = ({
    title,
    sectionKey,
    customIndex,
  }: {
    title: string
    sectionKey: string
    customIndex?: string
  }) => (
    <div className="mb-8 mt-4 first:mt-0 relative group break-after-avoid">
      <div className="flex items-end gap-4">
        <span
          className="font-black opacity-30 mb-1 leading-none"
          style={{ color: theme.themeColor, fontSize: '1.5em' }}
        >
          {customIndex || getDynamicIndex(sectionKey)}
        </span>
        <h3
          className="font-black uppercase tracking-tight text-gray-900 leading-none"
          style={{ fontSize: '1.25em' }}
        >
          {title}
        </h3>
      </div>
      {/* Geometric Decoration: Hairline spanning the page width (conceptually) */}
      <div className="absolute -left-12 right-0 h-[1px] bg-gray-100 top-full mt-2" />
      {/* Animated Accent Bar */}
      <div
        className="w-12 h-[3px] mt-2 rounded-full transform origin-left group-hover:scale-x-150 transition-transform duration-500"
        style={{ backgroundColor: theme.themeColor }}
      />
    </div>
  )

  // Helper: Social Icon Link (Expanded with Text)
  const SocialItem = ({
    href,
    icon: Icon,
    label,
    showFullUrl = false,
  }: {
    href?: string
    icon: any
    label: string
    showFullUrl?: boolean
  }) => {
    if (!href) return null
    // Clean URL for display
    const displayUrl = label
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')

    return (
      <a
        href={href.startsWith('http') ? href : `https://${href}`}
        target="_blank"
        rel="noreferrer"
        className="group/item flex items-center gap-2 p-1 pr-3 rounded-full bg-slate-100/80 hover:bg-slate-100 transition-all border border-slate-100 min-w-0 print-bg-reset"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-slate-500 group-hover/item:text-slate-900 shrink-0">
          <Icon size={12} />
        </div>
        <span
          className="font-medium text-slate-500 group-hover/item:text-slate-900 truncate max-w-[300px] md:max-w-full transition-colors"
          style={{ fontSize: '0.8em' }}
        >
          {showFullUrl ? displayUrl : displayUrl}
        </span>
      </a>
    )
  }

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null,
    summary: basics.summary && (
      <section style={theme.section} className="relative mb-12">
        <InteractiveSection sectionKey="summary">
          <SectionHeader
            title={getSectionTitle(
              'summary',
              basics.lang,
              sectionTitles?.['summary']
            )}
            sectionKey="summary"
          />
          <div className="pl-8 border-l-2 border-slate-50 hover:border-slate-200 transition-colors duration-300 relative py-2">
            <span
              className="absolute -left-3 -top-4 leading-none opacity-20 font-serif select-none"
              style={{ color: theme.themeColor, fontSize: '4em' }}
            >
              “
            </span>
            <div className="pt-1">
              <div
                className="leading-[1.8] text-gray-600 font-medium italic relative z-10"
                style={{ fontSize: '0.95em' }}
              >
                {basics.summary.split('\n').map((line, i) => (
                  <p key={i} className="mb-2 last:mb-0">
                    {line.replace(/^[-•]\s*/, '')}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section} className="mb-12">
        <InteractiveSection sectionKey="skills">
          <SectionHeader
            title={getSectionTitle(
              'skills',
              basics.lang,
              sectionTitles?.['skills']
            )}
            sectionKey="skills"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8 pl-8">
            {skills.split('\n').map((skillLine, idx) => {
              const [cat, items] = skillLine.includes(':')
                ? skillLine.split(':')
                : ['', skillLine]
              return (
                <div key={idx} className="flex flex-col gap-3">
                  {cat && (
                    <span
                      className="font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2"
                      style={{ fontSize: '0.75em' }}
                    >
                      {cat}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(items || '').split(/[,，]/).map((item, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-full bg-slate-50 text-gray-700 font-medium hover:bg-slate-100 transition-colors print-bg-reset"
                        style={{ fontSize: '0.85em' }}
                      >
                        {item.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </InteractiveSection>
      </section>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section} className="mb-12">
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader
            title={getSectionTitle(
              'workExperiences',
              basics.lang,
              sectionTitles?.['workExperiences']
            )}
            sectionKey="workExperiences"
          />
        </InteractiveSection>
        <div className="item-gap pl-8">
          {workExperiences.map((item) => (
            <div key={item.id} className="relative group page-break-fix">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                {/* Optimized Header for Mobile/Print: Flex Row with No-Wrap Date */}
                <div className="flex flex-row justify-between items-baseline gap-4 mb-2">
                  <div className="min-w-0 flex-1">
                    <h4
                      className="font-black text-gray-900 tracking-tighter leading-tight"
                      style={{ fontSize: '1.4em' }}
                    >
                      {item.company}
                    </h4>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                      <span
                        className="px-2 py-0.5 font-bold text-white uppercase rounded opacity-80 inline-block"
                        style={{
                          backgroundColor: theme.themeColor,
                          fontSize: '0.7em',
                        }}
                      >
                        {item.position}
                      </span>
                      {item.location && (
                        <span
                          className="text-gray-400 font-medium tracking-wide"
                          style={{ fontSize: '0.8em' }}
                        >
                          / {item.location}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Date: Right Aligned, No Wrap */}
                  <span
                    className="font-black text-gray-400 tabular-nums whitespace-nowrap shrink-0 text-right"
                    style={{ fontSize: '0.8em' }}
                  >
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Now'}
                  </span>
                </div>

                <div
                  className="text-gray-600 leading-[1.8] max-w-3xl mt-3"
                  style={{ fontSize: '0.9em' }}
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
      <section style={theme.section} className="mb-12">
        <InteractiveSection sectionKey="projectExperiences">
          <SectionHeader
            title={getSectionTitle(
              'projectExperiences',
              basics.lang,
              sectionTitles?.['projectExperiences']
            )}
            sectionKey="projectExperiences"
          />
        </InteractiveSection>
        <div className="item-gap pl-8">
          {projectExperiences.map((item) => (
            <div key={item.id} className="relative group page-break-fix">
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div className="flex flex-row justify-between items-baseline gap-4 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4
                        className="font-black text-gray-900 tracking-tighter leading-tight"
                        style={{ fontSize: '1.4em' }}
                      >
                        {item.projectName}
                      </h4>
                    </div>
                    {item.role && (
                      <div className="mt-1.5">
                        <span
                          className="px-2 py-0.5 font-bold text-white uppercase rounded opacity-80 inline-block"
                          style={{
                            backgroundColor: theme.themeColor,
                            fontSize: '0.7em',
                          }}
                        >
                          {item.role}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    className="font-black text-gray-400 tabular-nums whitespace-nowrap shrink-0 text-right"
                    style={{ fontSize: '0.8em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                <div
                  className="text-gray-600 leading-[1.8] max-w-3xl mt-3"
                  style={{ fontSize: '0.9em' }}
                >
                  {renderDescription(item.description)}
                </div>

                {/* Project Links Footer */}
                {(item.demoUrl || item.githubUrl) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.demoUrl && (
                      <a
                        href={item.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-900 font-bold text-[0.75em] tracking-wide transition-colors border-b border-transparent hover:border-slate-900 pb-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe size={12} />
                        {item.demoUrl}
                      </a>
                    )}
                    {item.githubUrl && (
                      <a
                        href={item.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-900 font-bold text-[0.75em] tracking-wide transition-colors border-b border-transparent hover:border-slate-900 pb-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Github size={12} />
                        {item.githubUrl}
                      </a>
                    )}
                  </div>
                )}
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    educations: educations?.length > 0 && (
      <section style={theme.section} className="mb-12">
        <InteractiveSection sectionKey="educations">
          <SectionHeader
            title={getSectionTitle(
              'educations',
              basics.lang,
              sectionTitles?.['educations']
            )}
            sectionKey="educations"
          />
        </InteractiveSection>
        {/* Academic Matrix Grid Layout - Adaptive */}
        <div
          className={cn(
            'pl-8',
            educations.length > 1
              ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
              : 'flex flex-col gap-4'
          )}
        >
          {educations.map((item) => {
            const isMulti = educations.length > 1
            return (
              <div
                key={item.id}
                className="relative group h-full page-break-fix"
              >
                <InteractiveSection sectionKey="educations" itemId={item.id}>
                  <div
                    className={cn(
                      'p-6 border border-slate-100 bg-white rounded-xl shadow-[0_4px_20px_-12px_rgba(0,0,0,0.08)] hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] transition-all gap-4 h-full print:shadow-none',
                      isMulti
                        ? 'flex flex-col justify-between items-start'
                        : 'flex flex-col md:flex-row print:flex-row justify-between items-start'
                    )}
                  >
                    <div
                      className={cn(
                        'flex items-start gap-4 flex-1',
                        isMulti ? 'w-full' : ''
                      )}
                    >
                      {/* University Icon Placehodler */}
                      <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-white group-hover:bg-slate-900 transition-colors duration-300 print-bg-reset">
                        <GraduationCap size={24} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4
                          className="font-black text-gray-900 tracking-tight leading-tight mb-1"
                          style={{ fontSize: '1.2em' }}
                        >
                          {item.school}
                        </h4>
                        <div className="flex flex-col gap-0.5">
                          <span
                            className="font-bold text-slate-500"
                            style={{ fontSize: '0.85em' }}
                          >
                            {item.degree}
                            {item.degree && item.major && (
                              <span className="mx-1.5 opacity-30">|</span>
                            )}
                            {item.major}
                          </span>
                        </div>
                        {item.description && (
                          <div className="mt-3 text-gray-500 text-[12px] leading-relaxed">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Date */}
                    <div
                      className={cn(
                        'text-slate-400 font-bold tabular-nums text-[0.75em] tracking-wide whitespace-nowrap shrink-0',
                        isMulti
                          ? 'mt-4 self-end border-t border-slate-50 pt-3 w-full text-right'
                          : 'mt-1 md:block print:block'
                      )}
                    >
                      {formatDate(item.startDate)} — {formatDate(item.endDate)}
                    </div>
                  </div>
                </InteractiveSection>
              </div>
            )
          })
          }
        </div >
      </section >
    ),
    certificates: certificates && (
      <section style={theme.section} className="mb-12">
        <InteractiveSection sectionKey="certificates">
          <SectionHeader
            title={getSectionTitle(
              'certificates',
              basics.lang,
              sectionTitles?.['certificates']
            )}
            sectionKey="certificates"
          />
          <div
            className="pl-8 text-gray-600 leading-relaxed"
            style={{ fontSize: '0.9em' }}
          >
            {renderDescription(certificates)}
          </div>
        </InteractiveSection>
      </section>
    ),
    hobbies: hobbies && (
      <section style={theme.section} className="mb-12">
        <InteractiveSection sectionKey="hobbies">
          <SectionHeader
            title={getSectionTitle(
              'hobbies',
              basics.lang,
              sectionTitles?.['hobbies']
            )}
            sectionKey="hobbies"
          />
          <div
            className="pl-8 text-gray-600 leading-relaxed"
            style={{ fontSize: '0.9em' }}
          >
            {renderDescription(hobbies)}
          </div>
        </InteractiveSection>
      </section>
    ),
    customSections: customSections?.length > 0 && (
      <>
        {customSections.map((item, idx) => (
          <section key={item.id} style={theme.section} className="mb-12">
            <InteractiveSection sectionKey="customSections" itemId={item.id}>
              <SectionHeader
                title={item.title || 'Untitled'}
                sectionKey={`customSections-${item.id}`}
              />
              <div
                style={theme.text}
                className="text-gray-700 leading-relaxed pl-8"
              >
                {renderDescription(item.description)}
              </div>
            </InteractiveSection>
          </section>
        ))}
      </>
    ),
  }

  const hasSocialLinks = !!(
    basics.website ||
    basics.linkedin ||
    basics.github ||
    basics.twitter ||
    basics.behance ||
    basics.dribbble
  )

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300 px-8 md:px-12 py-12 relative overflow-hidden',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* Decorative Radial Background */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(${theme.themeColor} 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Header: Brand Canvas Split (Asymmetric) */}
      <header className="mb-16 break-inside-avoid">
        {/* Left: Identity Block */}
        <InteractiveSection sectionKey="basics">
          <div className="flex flex-col md:flex-row print:flex-row items-center md:items-start print:items-start gap-8 md:gap-10 print:gap-10">
            {/* Group 1: Avatar (Left) */}
            <div className="shrink-0 flex justify-center">
              {basics.photoUrl ? (
                <div className="w-32 h-32 rounded-[2rem] bg-white shadow-2xl overflow-hidden border-[6px] border-white rotate-0 hover:rotate-3 transition-transform duration-500 relative z-10 print:shadow-none">
                  <img
                    src={basics.photoUrl}
                    alt={basics.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-32 h-32 rounded-[2rem] bg-slate-50 flex items-center justify-center rotate-3 border-[6px] border-white shadow-xl text-slate-300 print-bg-reset print:shadow-none">
                  <User size={48} />
                </div>
              )}
            </div>

            {/* Vertical Divider (Hidden on Mobile) */}
            <div className="hidden md:block print:block w-[1px] bg-slate-200 self-stretch my-2" />

            {/* Right Content Area */}
            <div className="flex flex-col flex-1 gap-6 text-center md:text-left print:text-left min-w-0">
              {/* Group 2: Name + Contacts */}
              <div className="item-gap">
                <div>
                  <h1
                    className="font-black tracking-tight leading-[0.85] text-gray-900 mb-2"
                    style={{ fontSize: '4.5em' }}
                  >
                    {basics.name}
                    <span style={{ color: theme.themeColor }}>.</span>
                  </h1>
                </div>

                <div className="flex flex-wrap items-center justify-center md:justify-start print:justify-start gap-x-4 gap-y-2 text-slate-500 font-bold text-[13px]">
                  {[
                    basics.email && { icon: Mail, value: basics.email },
                    basics.mobile && { icon: Phone, value: basics.mobile },
                    basics.location && { icon: MapPin, value: basics.location },
                    basics.address && { icon: Home, value: basics.address },
                  ]
                    .filter(
                      (item): item is { icon: any; value: string } => !!item
                    )
                    .map((item, index) => (
                      <React.Fragment key={index}>
                        {index > 0 && (
                          <span className="hidden md:inline print:inline text-slate-200">
                            |
                          </span>
                        )}
                        <div className="flex items-center gap-2 hover:text-slate-900 transition-colors whitespace-nowrap">
                          <item.icon
                            size={14}
                            style={{ color: theme.themeColor }}
                          />
                          <span>{item.value}</span>
                        </div>
                      </React.Fragment>
                    ))}
                </div>
              </div>

              {/* Horizontal Divider & Social Links */}
              {hasSocialLinks && (
                <>
                  <div className="h-[1px] bg-slate-200 w-full" />
                  <div className="flex flex-wrap items-center justify-center md:justify-start print:justify-start gap-3">
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
                      const { href, icon, displayLabel } = social
                      return (
                        <SocialItem
                          key={key}
                          href={href}
                          icon={icon}
                          label={displayLabel}
                          showFullUrl
                        />
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </InteractiveSection>
      </header>

      {/* Main Content Flow */}
      <div className="flex flex-col relative z-10">
        {config.order.map((key) => {
          if (
            config.hidden.includes(key) ||
            key === 'basics' ||
            !sectionMap[key]
          )
            return null
          return <div key={key}>{sectionMap[key]}</div>
        })}
      </div>

      {/* Minimal Footer */}
      <footer
        className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center font-mono text-slate-400/60 tracking-[0.25em]"
        style={{ fontSize: '0.8em' }}
      >
        <span>PORTFOLIO {new Date().getFullYear()}</span>
        <span>By CareerShaper AI</span>
      </footer>
    </div>
  )
}

export const DesignDefaults: TemplateConfig = {
  themeColor: '#0052FF', // 克莱因蓝
  fontFamily: 'inter', // Inter (Modern)
  fontSize: 1,
  baseFontSize: 13, // 稍小字号
  lineHeight: 1.6,
  pageMargin: 16,
  sectionSpacing: 24,
  itemSpacing: 20,
}
