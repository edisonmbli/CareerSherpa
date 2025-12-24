'use client'

import React from 'react'
import { TemplateProps } from './types'
import { useResumeTheme } from './hooks/useResumeTheme'
import { renderDescription, formatDate } from './utils'
import { cn } from '@/lib/utils'
import {
  Mail,
  Phone,
  MapPin,
  Github,
  Palette,
  ExternalLink,
  Globe,
  Linkedin,
  Dribbble,
  Twitter,
  Link as LinkIcon,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

/**
 * Designer Template V5 - "Swiss Style" (Visual Premium)
 * Features:
 * - Swiss Grid System (Hairlines, Asymmetric Whitespace)
 * - Micro-Typography (Bold Spacing, Contrast)
 * - Geometric Decoration (Shapes, High Saturation Accents)
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
    <div className="mb-5 mt-4 first:mt-0 relative group">
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
        className="group/item flex items-center gap-2 p-1 pr-3 rounded-full hover:bg-slate-50 transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-6 h-6 rounded-full flex items-center justify-center border border-slate-100 shadow-sm group-hover/item:scale-110 transition-transform bg-white">
          <Icon size={12} style={{ color: theme.themeColor }} />
        </div>
        <span
          className="font-medium text-gray-600 group-hover/item:text-gray-900 truncate max-w-[200px]"
          style={{ fontSize: '0.85em' }}
        >
          {showFullUrl ? displayUrl : displayUrl}
        </span>
      </a>
    )
  }

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null,
    summary: basics.summary && (
      <section style={theme.section} className="relative">
        <InteractiveSection sectionKey="summary">
          <SectionHeader title="Personal Summary" sectionKey="summary" />
          <div className="pl-8 mb-2 border-l-2 border-slate-50 hover:border-slate-200 transition-colors duration-300 relative">
            <span
              className="absolute -left-3 -top-4 leading-none opacity-20 font-serif select-none"
              style={{ color: theme.themeColor, fontSize: '4em' }}
            >
              “
            </span>
            <div className="pt-2">
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
            <span
              className="absolute -left-3 -bottom-6 leading-none opacity-20 font-serif select-none transform rotate-180"
              style={{ color: theme.themeColor, fontSize: '4em' }}
            >
              “
            </span>
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="skills">
          <SectionHeader title="Toolkit & Expertise" sectionKey="skills" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 pl-8">
            {skills.split('\n').map((skillLine, idx) => {
              const [cat, items] = skillLine.includes(':')
                ? skillLine.split(':')
                : ['', skillLine]
              return (
                <div key={idx} className="flex flex-col gap-2">
                  {cat && (
                    <span
                      className="font-black text-gray-400 uppercase tracking-widest"
                      style={{ fontSize: '0.7em' }}
                    >
                      {cat}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {(items || '').split(/[,，]/).map((item, i) => (
                      <span
                        key={i}
                        className="text-gray-800 font-medium border-b border-gray-100 pb-0.5"
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
      <section style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader title="Experience" sectionKey="workExperiences" />
        </InteractiveSection>
        <div className="space-y-4 pl-8">
          {workExperiences.map((item) => (
            <div key={item.id} className="relative group">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="flex flex-col md:flex-row justify-between items-start gap-2 mb-2">
                  <div>
                    <h4
                      className="font-black text-gray-900 tracking-tighter mb-1 leading-none"
                      style={{ fontSize: '1.4em' }}
                    >
                      {item.company}
                    </h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="px-2 py-0.5 font-bold text-white uppercase rounded"
                        style={{
                          backgroundColor: theme.themeColor,
                          fontSize: '0.7em',
                        }}
                      >
                        {item.position}
                      </span>
                    </div>
                  </div>
                  <span
                    className="font-black text-gray-400 tabular-nums bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest shrink-0"
                    style={{ fontSize: '0.75em' }}
                  >
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Now'}
                  </span>
                </div>
                <div
                  className="text-gray-600 leading-[1.8] max-w-3xl"
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
      <section style={theme.section}>
        <InteractiveSection sectionKey="projectExperiences">
          <SectionHeader
            title="Selected Projects"
            sectionKey="projectExperiences"
          />
        </InteractiveSection>
        <div className="space-y-4 pl-8">
          {projectExperiences.map((item) => (
            <div key={item.id} className="relative group">
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div className="flex flex-col md:flex-row justify-between items-start gap-2 mb-2">
                  <div>
                    <div className="flex items-center gap-3">
                      <h4
                        className="font-black text-gray-900 tracking-tighter mb-1 leading-none"
                        style={{ fontSize: '1.4em' }}
                      >
                        {item.projectName}
                      </h4>
                      {(item.demoUrl || item.githubUrl) && (
                        <a
                          href={item.demoUrl || item.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full hover:bg-slate-100 text-gray-400 hover:text-gray-900"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    {item.role && (
                      <div className="flex items-center gap-3 mt-2">
                        <span
                          className="px-2 py-0.5 font-bold text-white uppercase rounded opacity-80"
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
                    className="font-black text-gray-400 tabular-nums bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest shrink-0"
                    style={{ fontSize: '0.75em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                <div
                  className="text-gray-600 leading-[1.8] max-w-3xl"
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
    educations: educations?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="educations">
          <SectionHeader title="Education" sectionKey="educations" />
        </InteractiveSection>
        <div className="space-y-4 pl-8">
          {educations.map((item) => (
            <div key={item.id} className="relative group">
              <InteractiveSection sectionKey="educations" itemId={item.id}>
                <div className="flex flex-col md:flex-row justify-between items-start gap-2 mb-2">
                  <div>
                    <h4
                      className="font-black text-gray-900 tracking-tighter mb-1 leading-none"
                      style={{ fontSize: '1.4em' }}
                    >
                      {item.school}
                    </h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className="px-2 py-0.5 font-bold text-white uppercase rounded opacity-80"
                        style={{
                          backgroundColor: theme.themeColor,
                          fontSize: '0.7em',
                        }}
                      >
                        {item.major}
                      </span>
                      {item.degree && (
                        <span
                          className="text-gray-400 font-medium tracking-wide"
                          style={{ fontSize: '0.8em' }}
                        >
                          / {item.degree}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="font-black text-gray-400 tabular-nums bg-slate-50 px-3 py-1 rounded-full uppercase tracking-widest shrink-0"
                    style={{ fontSize: '0.75em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    certificates: certificates && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="certificates">
          <SectionHeader title="Certificates" sectionKey="certificates" />
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
      <section style={theme.section}>
        <InteractiveSection sectionKey="hobbies">
          <SectionHeader title="Interests" sectionKey="hobbies" />
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
          <section key={item.id} style={theme.section}>
            <InteractiveSection sectionKey="customSections" itemId={item.id}>
              <SectionHeader
                title={item.title}
                sectionKey={`customSections-${item.id}`}
              />
              <div
                className="pl-8 text-gray-600 leading-relaxed"
                style={{ fontSize: '0.9em' }}
              >
                {renderDescription(item.description)}
              </div>
            </InteractiveSection>
          </section>
        ))}
      </>
    ),
  }

  // Redesigned Basics Header
  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300 px-8 md:px-16 py-12 relative overflow-hidden',
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

      {/* Header: Redesigned for better Visual Hierarchy */}
      <header className="mb-12 relative z-10">
        <InteractiveSection sectionKey="basics">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-start">
            {/* Left Column: Avatar & Contact Info (4 cols) */}
            <div className="md:col-span-4 flex flex-col gap-6 order-2 md:order-1">
              {basics.photoUrl && (
                <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-[4px] border-white shadow-xl overflow-hidden relative mx-auto md:mx-0">
                  <img
                    src={basics.photoUrl}
                    alt={basics.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              <div className="flex flex-col gap-3">
                {/* Contact Details with Better Typography */}
                <div className="space-y-2">
                  {basics.mobile && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                        <Phone size={14} style={{ color: theme.themeColor }} />
                      </div>
                      <span
                        className="font-bold tracking-tight"
                        style={{ fontSize: '0.85em' }}
                      >
                        {basics.mobile}
                      </span>
                    </div>
                  )}
                  {basics.email && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                        <Mail size={14} style={{ color: theme.themeColor }} />
                      </div>
                      <span
                        className="font-bold tracking-tight break-all"
                        style={{ fontSize: '0.85em' }}
                      >
                        {basics.email}
                      </span>
                    </div>
                  )}
                  {basics.location && (
                    <div className="flex items-center gap-3 text-gray-600">
                      <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
                        <MapPin size={14} style={{ color: theme.themeColor }} />
                      </div>
                      <span
                        className="font-bold tracking-tight"
                        style={{ fontSize: '0.85em' }}
                      >
                        {basics.location}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Name, Title, Socials (8 cols) */}
            <div className="md:col-span-8 flex flex-col gap-6 order-1 md:order-2">
              <div>
                <h1
                  className="font-black text-gray-900 leading-[0.9] tracking-[-0.05em] mb-4"
                  style={{ color: theme.themeColor, fontSize: '4.5em' }}
                >
                  {basics.name}
                </h1>
                {/* Job Title / Tagline could go here if available in basics */}
                <div
                  className="h-1 w-24 rounded-full bg-gray-900 mb-6"
                  style={{ backgroundColor: theme.themeColor }}
                />
              </div>

              {/* Social Links Grid - Professional Layout */}
              <div className="flex flex-wrap gap-x-6 gap-y-3">
                {basics.website && (
                  <SocialItem
                    href={basics.website}
                    icon={Globe}
                    label={basics.website}
                    showFullUrl={true}
                  />
                )}
                {basics.linkedin && (
                  <SocialItem
                    href={basics.linkedin}
                    icon={Linkedin}
                    label={basics.linkedin}
                    showFullUrl={true}
                  />
                )}
                {basics.github && (
                  <SocialItem
                    href={basics.github}
                    icon={Github}
                    label={basics.github}
                    showFullUrl={true}
                  />
                )}
                {basics.dribbble && (
                  <SocialItem
                    href={basics.dribbble}
                    icon={Dribbble}
                    label={basics.dribbble}
                    showFullUrl={true}
                  />
                )}
                {basics.behance && (
                  <SocialItem
                    href={basics.behance}
                    icon={Palette}
                    label={basics.behance}
                    showFullUrl={true}
                  />
                )}
                {basics.twitter && (
                  <SocialItem
                    href={basics.twitter}
                    icon={Twitter}
                    label={basics.twitter}
                    showFullUrl={true}
                  />
                )}
              </div>
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
        className="mt-16 pt-8 border-t border-slate-50 flex justify-between items-center font-black text-slate-300 uppercase tracking-[0.4em]"
        style={{ fontSize: '0.7em' }}
      >
        <span>Portfolio {new Date().getFullYear()}</span>
        <span>{basics.name} // DESIGN CV</span>
      </footer>
    </div>
  )
}
