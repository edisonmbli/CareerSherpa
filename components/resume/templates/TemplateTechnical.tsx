'use client'

import React from 'react'
import { TemplateProps } from './types'
import { useResumeTheme } from './hooks/useResumeTheme'
import { renderDescription, formatDate } from './utils'
import { cn } from '@/lib/utils'
import {
  Mail,
  Phone,
  Github,
  MapPin,
  ExternalLink,
  Link as LinkIcon,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

/**
 * Technical Template - Optimized for Developers/Engineers
 * Features: High density, strict vertical rhythm, tech stack badges, timeline visualization
 */
export function TemplateTechnical({
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
  } = data
  const theme = useResumeTheme({
    themeColor: '#71717a', // Zinc 500
    fontFamily: 'ibm-plex-mono',
    fontSize: 1.0,
    lineHeight: 1.6,
    sectionSpacing: 24,
    pageMargin: 12,
    ...styleConfig,
  })

  // Helper: Section Title with technical style
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex items-center mb-4 mt-2">
      <h3
        className="font-bold uppercase tracking-wider whitespace-nowrap border-b-2 pb-1"
        style={{
          fontSize: theme.text.fontSize, // Use base font size
          color: theme.themeColor,
          borderColor: theme.themeColor,
        }}
      >
        {title}
      </h3>
      <div className="ml-4 h-[1px] w-full bg-gray-200" />
    </div>
  )

  // Helper: Timeline container for Experience items
  // UPDATED: Line now spans full height of content (no "extra line" in margin)
  // And last item also has the line (no "missing line")
  const TimelineItem = ({ children }: { children: React.ReactNode }) => (
    <div className="relative pl-6 mb-6 last:mb-0 group">
      {/* Vertical Line - Spans the full height of THIS item's content */}
      <div className="absolute left-[3.5px] top-[14px] bottom-0 w-[1px] bg-gray-200 group-hover:bg-gray-400 transition-colors" />

      {/* Dot */}
      <div className="absolute left-0 top-[6px] w-[8px] h-[8px] rounded-full bg-gray-300 border border-white ring-2 ring-transparent group-hover:ring-gray-100 transition-all z-10" />
      {children}
    </div>
  )

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null, // Rendered in Header
    summary: basics.summary && (
      <InteractiveSection sectionKey="summary">
        <section style={theme.section}>
          <SectionHeader title="Summary" />
          <div
            style={theme.text}
            className="leading-relaxed text-gray-700 text-justify"
          >
            {renderDescription(basics.summary)}
          </div>
        </section>
      </InteractiveSection>
    ),
    skills: skills && (
      <InteractiveSection sectionKey="skills">
        <section style={theme.section}>
          <SectionHeader title="Technical Skills" />
          <div className="flex flex-col gap-2">
            {skills.split('\n').map((skillLine, idx) => {
              if (!skillLine.trim()) return null
              const hasColon =
                skillLine.includes(':') || skillLine.includes('：')
              const separator = skillLine.includes(':') ? ':' : '：'

              let category = ''
              let items = skillLine

              if (hasColon) {
                const parts = skillLine.split(separator)
                category = parts[0] || ''
                items = parts.slice(1).join(separator)
              }

              return (
                <div key={idx} className="flex items-baseline gap-3">
                  {category && (
                    <span
                      className="font-bold text-gray-800 min-w-[80px] text-right uppercase tracking-tight"
                      style={{ fontSize: '0.9em' }}
                    >
                      {category.trim()}
                    </span>
                  )}
                  <div className="flex flex-wrap gap-1.5 flex-1">
                    {items.split(/[，,]/).map((item, i) => {
                      const trimmed = item.trim()
                      if (!trimmed) return null
                      return (
                        <span
                          key={i}
                          className="px-2 py-0.5 bg-slate-50 border border-slate-200 text-slate-700 font-mono rounded-sm whitespace-nowrap hover:bg-slate-100 transition-colors"
                          style={{ fontSize: '0.85em' }}
                        >
                          {trimmed}
                        </span>
                      )
                    })}
                  </div>
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
          <SectionHeader title="Experience" />
        </InteractiveSection>
        <div className="mt-2">
          {workExperiences.map((item, idx) => (
            <InteractiveSection
              key={item.id}
              sectionKey="workExperiences"
              itemId={item.id}
            >
              <TimelineItem>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <span
                      className="font-bold text-gray-900"
                      style={{ fontSize: '1.1em' }}
                    >
                      {item.position}
                    </span>
                    <span className="hidden sm:inline text-gray-300">|</span>
                    <span
                      className="font-semibold text-gray-700"
                      style={theme.text}
                    >
                      {item.company}
                    </span>
                  </div>
                  <span
                    className="font-mono text-gray-500 tabular-nums italic whitespace-nowrap"
                    style={{ fontSize: '0.9em' }}
                  >
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Present'}
                  </span>
                </div>
                <div style={theme.text} className="text-gray-600">
                  {renderDescription(item.description)}
                </div>
              </TimelineItem>
            </InteractiveSection>
          ))}
        </div>
      </section>
    ),
    projectExperiences: projectExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="projectExperiences">
          <SectionHeader title="Projects" />
        </InteractiveSection>
        <div className="space-y-6 pl-2">
          {projectExperiences.map((item) => (
            <InteractiveSection
              key={item.id}
              sectionKey="projectExperiences"
              itemId={item.id}
            >
              <div className="border-l-2 border-transparent hover:border-gray-200 pl-4 transition-colors -ml-4">
                {/* Updated Layout: Title | Role */}
                <div className="flex justify-between items-baseline mb-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                    <h4
                      className="font-bold text-gray-900"
                      style={{ fontSize: '1.1em' }}
                    >
                      {item.projectName}
                    </h4>
                    {item.role && (
                      <>
                        <span className="hidden sm:inline text-gray-300">
                          |
                        </span>
                        <span
                          className="font-medium text-gray-600"
                          style={theme.text}
                        >
                          {item.role}
                        </span>
                      </>
                    )}
                  </div>
                  <span
                    className="font-mono text-gray-500 italic whitespace-nowrap"
                    style={{ fontSize: '0.9em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>

                {/* Project Links - Optimized for print & web */}
                {(item.githubUrl || item.demoUrl) && (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 mt-1.5 mb-2 text-[0.8em] font-mono text-gray-500">
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

                <div style={theme.text} className="text-gray-600">
                  {renderDescription(item.description)}
                </div>
              </div>
            </InteractiveSection>
          ))}
        </div>
      </section>
    ),
    educations: educations?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="educations">
          <SectionHeader title="Education" />
        </InteractiveSection>
        <div className="space-y-3">
          {educations.map((item) => (
            <InteractiveSection
              key={item.id}
              sectionKey="educations"
              itemId={item.id}
            >
              <div className="flex justify-between items-baseline border-b border-gray-50 pb-2 last:border-0">
                <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <span
                    className="font-bold text-gray-900"
                    style={{ fontSize: '1.1em' }}
                  >
                    {item.school}
                  </span>
                  <div style={theme.text} className="text-gray-700">
                    {item.major}
                    {item.degree && (
                      <span className="ml-1 text-gray-500 italic">
                        ({item.degree})
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="font-mono text-gray-500 italic whitespace-nowrap"
                  style={{ fontSize: '0.9em' }}
                >
                  {formatDate(item.startDate)} — {formatDate(item.endDate)}
                </span>
              </div>
            </InteractiveSection>
          ))}
        </div>
      </section>
    ),
    certificates: certificates && (
      <InteractiveSection sectionKey="certificates">
        <section style={theme.section}>
          <SectionHeader title="Certificates" />
          <div style={theme.text} className="text-gray-700 leading-relaxed">
            {renderDescription(certificates)}
          </div>
        </section>
      </InteractiveSection>
    ),
    hobbies: hobbies && (
      <InteractiveSection sectionKey="hobbies">
        <section style={theme.section}>
          <SectionHeader title="Interests" />
          <div style={theme.text} className="text-gray-700 leading-relaxed">
            {renderDescription(hobbies)}
          </div>
        </section>
      </InteractiveSection>
    ),
    customSections: customSections?.length > 0 && (
      <>
        {customSections.map((item) => (
          <section key={item.id} style={theme.section}>
            <InteractiveSection sectionKey="customSections" itemId={item.id}>
              <SectionHeader title={item.title} />
              <div style={theme.text} className="text-gray-700 leading-relaxed">
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
        'bg-white w-full min-h-full transition-all duration-300',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* Header */}
      <InteractiveSection sectionKey="basics">
        <header
          className="mb-8 flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 pb-6"
          style={{ borderColor: theme.themeColor }}
        >
          <div className="flex-1 space-y-3">
            <div>
              <h1
                className="font-bold text-gray-900 leading-none mb-1 tracking-tighter"
                style={{ fontSize: '2.5em' }}
              >
                {basics.name}
              </h1>
            </div>

            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-600 font-medium"
              style={{ fontSize: '0.9em' }}
            >
              {basics.email && (
                <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                  <Mail size={12} /> {basics.email}
                </div>
              )}
              {basics.mobile && (
                <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                  <Phone size={12} /> {basics.mobile}
                </div>
              )}
              {basics.location && (
                <div className="flex items-center gap-1.5 hover:text-gray-900 transition-colors">
                  <MapPin size={12} /> {basics.location}
                </div>
              )}
            </div>

            {/* Social / Links */}
            <div className="flex flex-wrap gap-3 pt-1">
              {basics.github && (
                <div className="flex items-center gap-1 font-mono text-gray-700 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200 transition-colors">
                  <Github size={11} />
                  <span style={{ fontSize: '0.8em' }}>
                    github.com/{basics.github}
                  </span>
                </div>
              )}
              <div
                className="flex gap-3 text-gray-500"
                style={{ fontSize: '0.85em' }}
              >
                {basics.wechat && (
                  <span className="flex items-center gap-1">
                    <span className="font-bold text-[0.8em] bg-green-50 text-green-700 px-1 rounded">
                      WX
                    </span>{' '}
                    {basics.wechat}
                  </span>
                )}
                {basics.qq && <span>QQ: {basics.qq}</span>}
              </div>
            </div>
          </div>

          {/* Avatar - Only show if present */}
          {basics.photoUrl && (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={basics.photoUrl}
                alt={basics.name}
                className="w-24 h-24 rounded-lg object-cover border border-gray-200 shadow-sm"
              />
            </div>
          )}
        </header>
      </InteractiveSection>

      {/* Main Content Sections */}
      <div className="flex flex-col">
        {config.order.map((key) => {
          if (config.hidden.includes(key)) return null
          const content = sectionMap[key]
          return content ? <div key={key}>{content}</div> : null
        })}
      </div>

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-gray-100 text-center">
        <span
          className="text-gray-300 uppercase tracking-[0.2em] font-mono"
          style={{ fontSize: '0.7em' }}
        >
          Resume • {basics.name} • {new Date().getFullYear()}
        </span>
      </footer>
    </div>
  )
}
