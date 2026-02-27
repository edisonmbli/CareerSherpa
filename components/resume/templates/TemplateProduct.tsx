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
  BarChart3,
  Target,
  Zap,
  Github,
  ExternalLink,
  Home,
  GraduationCap,
  Globe,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'
import { ResumeAvatar } from './ResumeAvatar'

/**
 * Product & Operation 模板 - 逻辑驱动型
 * 特点：模块化栅格、严谨边框、自动和谐渐变、数据感排版
 */
export function TemplateProduct({ data, config, styleConfig }: TemplateProps) {
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
    themeColor: '#0D9488', // Default to Teal
    ...styleConfig,
  })

  // ==========================================
  // Color Logic: Dual-Axis Harmony
  // ==========================================
  const hexToHsl = (hex: string): [number, number, number] => {
    let c: any = hex.substring(1).split('')
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]]
    }
    c = '0x' + c.join('')
    const r = ((c >> 16) & 255) / 255
    const g = ((c >> 8) & 255) / 255
    const b = (c & 255) / 255

    const max = Math.max(r, g, b),
      min = Math.min(r, g, b)
    let h = 0,
      s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0)
          break
        case g:
          h = (b - r) / d + 2
          break
        case b:
          h = (r - g) / d + 4
          break
      }
      h /= 6
    }
    return [h * 360, s * 100, l * 100]
  }

  // Generate dynamic colors
  const [h, s, l] = hexToHsl(theme.themeColor)

  // Auxiliary color: Shift Hue by 10deg, Lightness to 96% (very pale background)
  const secondaryColor = `hsl(${(h + 10) % 360}, ${s}%, 96%)`
  const secondaryBorder = `hsl(${(h + 10) % 360}, ${s}%, 90%)`

  // Gradient for Header/Accents: Theme Color -> Slightly Lighter & Shifted
  const accentGradient = `linear-gradient(135deg, ${theme.themeColor} 0%, hsl(${(h + 15) % 360
    }, ${s}%, ${Math.min(l + 20, 90)}%) 100%)`

  // ==========================================
  // Helper Components
  // ==========================================

  const SectionHeader = ({
    title,
    icon: Icon,
  }: {
    title: string
    icon?: any
  }) => (
    <div className="flex items-center gap-3 mb-5 group mt-6 first:mt-0 break-after-avoid">
      {Icon ? (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm text-white shrink-0 print:shadow-none"
          style={{ background: accentGradient }}
        >
          <Icon size={16} />
        </div>
      ) : (
        <div
          className="w-1.5 h-6 rounded-full"
          style={{ background: theme.themeColor }}
        />
      )}

      <div className="flex-1">
        <h3 className="text-[1.1em] font-bold text-gray-900 uppercase tracking-tight leading-none">
          {title}
        </h3>
        {/* Progress Bar Style Decoration */}
        <div className="h-[2px] w-full bg-gray-100 mt-2 relative overflow-hidden rounded-full print:bg-gray-200">
          <div
            className="absolute left-0 top-0 h-full w-12 transition-all duration-500 group-hover:w-full opacity-30"
            style={{ backgroundColor: theme.themeColor }}
          />
        </div>
      </div>
    </div>
  )

  // Contact Item Helper
  const ContactItem = ({ icon: Icon, value }: { icon: any; value: string }) => {
    return (
      <div className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
        <Icon
          size={14}
          style={{ color: theme.themeColor }}
          className="shrink-0"
        />
        <span className="truncate max-w-[200px] md:max-w-none">{value}</span>
      </div>
    )
  }

  // Social Link Helper
  const SocialLink = ({
    href,
    icon: Icon,
    label,
  }: {
    href: string
    icon: any
    label: string
  }) => {
    // Clean URL for display
    const displayUrl = label
      .replace(/^https?:\/\/(www\.)?/, '')
      .replace(/\/$/, '')

    return (
      <a
        href={href.startsWith('http') ? href : `https://${href}`}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100 transition-colors border border-slate-100 group print:bg-transparent print:border-slate-200"
      >
        <Icon
          size={14}
          style={{ color: theme.themeColor }}
          className="shrink-0"
        />
        <span className="text-[0.85em] font-medium text-slate-600 group-hover:text-slate-900 truncate max-w-[150px] md:max-w-none">
          {displayUrl}
        </span>
      </a>
    )
  }

  // ==========================================
  // Section Map
  // ==========================================

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null,
    summary: basics.summary && (
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="summary">
          <SectionHeader
            title={getSectionTitle(
              'summary',
              basics.lang,
              sectionTitles?.['summary']
            )}
            icon={Target}
          />
          <div
            className="p-5 rounded-xl border relative flex flex-col md:flex-row print:flex-row gap-5 items-center md:items-start print:items-start print-bg-reset"
            style={{
              backgroundColor: secondaryColor,
              borderColor: secondaryBorder,
            }}
          >
            {/* Avatar - Handled by ResumeAvatar to gracefully hide if broken/missing */}
            <ResumeAvatar
              photoUrl={basics.photoUrl}
              name={basics.name}
              containerClassName="shrink-0"
              imageClassName="w-20 h-20 rounded-lg object-cover border-2 border-white shadow-sm print:shadow-none bg-gray-50"
            />
            <div className="text-gray-700 leading-relaxed font-medium text-justify text-[0.95em] w-full">
              {renderDescription(basics.summary)}
            </div>
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="skills">
          <SectionHeader
            title={getSectionTitle(
              'skills',
              basics.lang,
              sectionTitles?.['skills']
            )}
            icon={Zap}
          />
          <div className="space-y-4">
            {/* Detect 2-group format */}
            {skills.includes('核心能力') || skills.includes('工具技术') ||
              skills.includes('Core Competencies') || skills.includes('Tools') ? (
              // New 2-group format: render as labeled sections
              skills.split('\n').map((line, idx) => {
                const trimmed = line.trim()
                if (!trimmed) return null
                const colonIndex = trimmed.indexOf('：') !== -1
                  ? trimmed.indexOf('：')
                  : trimmed.indexOf(':')
                if (colonIndex > 0) {
                  const label = trimmed.slice(0, colonIndex)
                  const content = trimmed.slice(colonIndex + 1).trim()
                  // Split content by | or , for tags
                  const items = content.split(/[|,，]/).filter(s => s.trim())
                  return (
                    <div key={idx}>
                      <div
                        className="font-bold uppercase tracking-wider mb-2"
                        style={{ color: theme.themeColor, fontSize: '0.8em' }}
                      >
                        {label}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {items.map((item, i) => (
                          <div
                            key={i}
                            className="px-3 py-1 rounded-lg border text-[0.85em] font-medium text-gray-700 bg-white shadow-sm print:shadow-none"
                            style={{ borderColor: secondaryBorder }}
                          >
                            {item.trim()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                }
                return null
              })
            ) : (
              // Legacy format: inline tags
              <div className="flex flex-wrap gap-3">
                {skills.split(/[\n,，]/).map((skill, idx) => {
                  const trimmed = skill.trim()
                  if (!trimmed) return null
                  return (
                    <div
                      key={idx}
                      className="px-4 py-1.5 rounded-lg border text-[0.85em] font-bold text-gray-700 bg-white shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 print:shadow-none"
                      style={{
                        borderColor: secondaryBorder,
                        borderLeftWidth: '3px',
                        borderLeftColor: secondaryColor,
                      }}
                    >
                      {trimmed}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </InteractiveSection>
      </section>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader
            title={getSectionTitle(
              'workExperiences',
              basics.lang,
              sectionTitles?.['workExperiences']
            )}
            icon={BarChart3}
          />
        </InteractiveSection>
        <div className="space-y-0 ml-3 border-l-2 border-gray-100 pl-6 py-2">
          {workExperiences.map((item, index) => (
            <div
              key={item.id}
              className="relative mb-4 last:mb-0 group page-break-fix"
            >
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                {/* Timeline Dot - Centered on line */}
                <div
                  className="absolute -left-[25px] top-[10px] w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm transition-all group-hover:scale-125 z-10 print:shadow-none"
                  style={{ backgroundColor: theme.themeColor }}
                />

                <div className="flex flex-col md:flex-row print:flex-row md:justify-between print:justify-between md:items-baseline print:items-baseline mb-2 gap-1">
                  <div className="w-full">
                    <h4 className="text-[1.1em] font-black text-gray-900">
                      {item.company}
                    </h4>
                    <div className="flex justify-between items-center md:block print:block mt-1">
                      <div
                        className="inline-block px-2 py-0.5 rounded text-[0.75em] font-bold uppercase tracking-wider"
                        style={{
                          backgroundColor: secondaryColor,
                          color: theme.themeColor,
                        }}
                      >
                        {item.position}
                      </div>
                      <span className="md:hidden print:hidden text-[0.85em] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap print:bg-transparent">
                        {formatDate(item.startDate)} —{' '}
                        {item.endDate ? formatDate(item.endDate) : 'Present'}
                      </span>
                    </div>
                  </div>
                  <span className="hidden md:block print:block text-[0.85em] font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded mt-2 md:mt-0 print:mt-0 whitespace-nowrap self-start md:self-auto print:self-auto print:bg-transparent">
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Present'}
                  </span>
                </div>

                <div className="text-gray-600 leading-relaxed text-[0.92em] [&_strong]:font-black [&_strong]:tracking-wide [&_strong]:text-gray-900">
                  {renderDescription(item.description)}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: projectExperiences?.length > 0 && (
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="projectExperiences">
          <SectionHeader
            title={getSectionTitle(
              'projectExperiences',
              basics.lang,
              sectionTitles?.['projectExperiences']
            )}
            icon={Globe}
          />
        </InteractiveSection>
        <div className="flex flex-col gap-4">
          {projectExperiences.map((item) => (
            <div
              key={item.id}
              className="p-5 border border-gray-200 rounded-xl bg-white shadow-[0_2px_10px_-5px_rgba(0,0,0,0.05)] hover:shadow-md transition-all group page-break-fix print:shadow-none"
            >
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div className="flex flex-col md:flex-row print:flex-row md:justify-between print:justify-between md:items-start print:items-start gap-2 mb-3 border-b border-gray-100 pb-3">
                  <div className="flex-1 w-full">
                    <h4 className="text-[1em] font-bold text-gray-900 uppercase tracking-tight">
                      {item.projectName}
                    </h4>
                    {item.role && (
                      <div className="flex justify-between items-center md:block print:block mt-1.5">
                        <div
                          className="inline-block px-2 py-0.5 rounded text-[0.75em] font-bold uppercase tracking-wider"
                          style={{
                            backgroundColor: secondaryColor,
                            color: theme.themeColor,
                          }}
                        >
                          Role: {item.role}
                        </div>
                        <span className="md:hidden print:hidden text-[0.85em] text-gray-400 whitespace-nowrap">
                          {formatDate(item.startDate)} —{' '}
                          {formatDate(item.endDate)}
                        </span>
                      </div>
                    )}
                  </div>
                  <span className="hidden md:block print:block text-[0.85em] text-gray-400 whitespace-nowrap mt-1 md:mt-0 print:mt-0">
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>

                <div className="text-gray-600 leading-normal text-[0.9em] [&_strong]:font-black [&_strong]:tracking-wide [&_strong]:text-gray-900">
                  {renderDescription(item.description)}
                </div>

                {/* Project Links Footer */}
                {(item.demoUrl || item.githubUrl) && (
                  <div className="mt-1 pt-3 border-t border-gray-50 flex flex-wrap gap-4">
                    {item.demoUrl && (
                      <a
                        href={item.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-sky-700 hover:underline transition-colors bg-gray-50 px-2 py-1 rounded print:bg-transparent"
                      >
                        <ExternalLink size={12} />
                        {item.demoUrl.replace(/^https?:\/\//, '')}
                      </a>
                    )}
                    {item.githubUrl && (
                      <a
                        href={item.githubUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-sky-700 hover:underline transition-colors bg-gray-50 px-2 py-1 rounded print:bg-transparent"
                      >
                        <Github size={12} />
                        {item.githubUrl.replace(/^https?:\/\//, '')}
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
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="educations">
          <SectionHeader
            title={getSectionTitle(
              'educations',
              basics.lang,
              sectionTitles?.['educations']
            )}
            icon={GraduationCap}
          />
        </InteractiveSection>
        <div
          className={cn(
            'grid gap-4',
            educations.length > 1
              ? 'grid-cols-1 md:grid-cols-2 print:grid-cols-2'
              : 'grid-cols-1'
          )}
        >
          {educations.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 page-break-fix print:bg-transparent"
            >
              <InteractiveSection sectionKey="educations" itemId={item.id}>
                <div className="flex flex-col md:flex-row print:flex-row justify-between items-start md:items-center print:items-center gap-2">
                  <div>
                    <div className="text-[1em] font-bold text-gray-900">
                      {item.school}
                    </div>
                    <div className="text-[0.9em] text-gray-600 mt-1 font-medium">
                      {item.major} {item.degree && `· ${item.degree}`}
                    </div>
                  </div>
                  <div className="text-[0.85em] text-gray-400 font-mono whitespace-nowrap self-end md:self-auto print:self-auto">
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </div>
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    certificates: certificates && (
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="certificates">
          <SectionHeader
            title={getSectionTitle(
              'certificates',
              basics.lang,
              sectionTitles?.['certificates']
            )}
          />
          <div className="text-gray-600 leading-relaxed text-[0.9em]">
            {renderDescription(certificates)}
          </div>
        </InteractiveSection>
      </section>
    ),
    hobbies: hobbies && (
      <section style={theme.section} className="mb-8">
        <InteractiveSection sectionKey="hobbies">
          <SectionHeader
            title={getSectionTitle(
              'hobbies',
              basics.lang,
              sectionTitles?.['hobbies']
            )}
          />
          <div className="text-gray-600 leading-relaxed text-[0.9em]">
            {renderDescription(hobbies)}
          </div>
        </InteractiveSection>
      </section>
    ),
    customSections: customSections?.length > 0 && (
      <>
        {customSections.map((item) => (
          <section key={item.id} style={theme.section} className="mb-8">
            <InteractiveSection sectionKey="customSections" itemId={item.id}>
              <SectionHeader title={item.title || 'Untitled'} />
              <div className="text-gray-600 leading-relaxed text-[0.9em]">
                {renderDescription(item.description)}
              </div>
            </InteractiveSection>
          </section>
        ))}
      </>
    ),
  }

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300 relative overflow-hidden',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* Header with Side Accent */}
      <header className="relative mb-8">
        {/* Top Gradient Bar */}
        <div
          className="absolute top-0 right-0 w-[60%] h-32 rounded-bl-[100px] opacity-10 pointer-events-none"
          style={{ background: accentGradient }}
        />
        <div
          className="absolute top-0 right-0 w-[40%] h-24 rounded-bl-[80px] opacity-10 pointer-events-none"
          style={{ background: theme.themeColor }}
        />

        <div className="px-5 pt-10 pb-4 relative z-10">
          <InteractiveSection sectionKey="basics">
            <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex-1 w-full">
                <h1 className="text-[2.5em] font-black text-gray-900 leading-none tracking-tight mb-4 uppercase">
                  {basics.name}
                </h1>

                {/* Contacts Row */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.9em] font-medium text-gray-500 mb-4 items-center">
                  {basics.mobile && (
                    <ContactItem icon={Phone} value={basics.mobile} />
                  )}
                  {basics.email && (
                    <ContactItem icon={Mail} value={basics.email} />
                  )}
                  {basics.location && (
                    <ContactItem icon={MapPin} value={basics.location} />
                  )}
                  {basics.address && (
                    <ContactItem icon={Home} value={basics.address} />
                  )}
                </div>

                {/* Social Links Row */}
                <div className="flex flex-wrap gap-3">
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
                      <SocialLink
                        key={key}
                        href={href}
                        icon={icon}
                        label={displayLabel}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          </InteractiveSection>
        </div>

        <div className="mx-5 h-[2px] bg-gray-900 rounded-full" />
      </header>

      {/* Main Content */}
      <div className="px-5 pb-12 flex flex-col">
        {config.order.map((key) => {
          if (config.hidden.includes(key) || key === 'basics') return null
          return <div key={key}>{sectionMap[key]}</div>
        })}
      </div>

      {/* Minimal Footer */}
      <footer
        className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center font-mono text-slate-400/60 tracking-[0.25em]"
        style={{ fontSize: '0.8em' }}
      >
        <span>PORTFOLIO {new Date().getFullYear()}</span>
        <span>By AI CareerSherpa</span>
      </footer>
    </div>
  )
}

export const ProductDefaults: TemplateConfig = {
  themeColor: '#0D9488', // Teal - Growth & Data
  fontFamily: 'inter', // System Sans / Inter
  fontSize: 1,
  baseFontSize: 13.5,
  lineHeight: 1.6,
  pageMargin: 10,
  sectionSpacing: 24,
  itemSpacing: 12,
}
