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
import { Mail, Phone, MapPin, Github, Globe } from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'
import { ResumeAvatar } from './ResumeAvatar'

/**
 * Standard 模板 - 标准通用型
 * 特点：姓名居中平衡、信笺式头部、克制着色、短粗线视觉锚点
 */
export function TemplateStandard({ data, config, styleConfig }: TemplateProps) {
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
    themeColor: '#0284c7',
    ...styleConfig,
  })

  // 辅助组件：标准模块标题 (文字 + 全宽延伸线)
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="mb-3 mt-4 first:mt-0 break-after-avoid">
      <div className="flex items-center gap-3">
        <h3
          className="font-bold text-gray-900 uppercase tracking-wider whitespace-nowrap"
          style={{ fontSize: '1em', color: theme.themeColor }}
        >
          {title}
        </h3>
        <div className="h-[1px] flex-1 bg-gray-200" />
      </div>
    </div>
  )

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null,
    summary: basics.summary && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="summary">
          <SectionHeader
            title={getSectionTitle(
              'summary',
              basics.lang,
              sectionTitles?.['summary']
            )}
          />
          <div
            className="leading-relaxed text-gray-700 text-justify"
            style={{ fontSize: '0.93em' }}
          >
            {renderDescription(basics.summary)}
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="skills">
          <SectionHeader
            title={getSectionTitle(
              'skills',
              basics.lang,
              sectionTitles?.['skills']
            )}
          />
          <div
            className="text-gray-700 leading-relaxed"
            style={{ fontSize: '0.93em' }}
          >
            {/* Detect 2-group format: 核心能力/工具技术 or Core Competencies/Tools */}
            {skills.includes('核心能力') || skills.includes('工具技术') ||
              skills.includes('Core Competencies') || skills.includes('Tools') ? (
              // New 2-group format: render as labeled rows
              <div className="space-y-1.5">
                {skills.split('\n').map((line, i) => {
                  const trimmed = line.trim()
                  if (!trimmed) return null
                  // Extract label and content
                  const colonIndex = trimmed.indexOf('：') !== -1
                    ? trimmed.indexOf('：')
                    : trimmed.indexOf(':')
                  if (colonIndex > 0) {
                    const label = trimmed.slice(0, colonIndex)
                    const content = trimmed.slice(colonIndex + 1).trim()
                    return (
                      <div key={i}>
                        <span
                          className="font-medium mr-2"
                          style={{ color: theme.themeColor }}
                        >
                          {label}
                        </span>
                        <span className="text-gray-600">{content}</span>
                      </div>
                    )
                  }
                  // Fallback for lines without colon
                  return <div key={i}>{trimmed}</div>
                })}
              </div>
            ) : (
              // Legacy format: inline spans in gray background
              <div className="px-3 py-2 bg-slate-50 rounded-sm">
                {skills.split('\n').map((skill, i) => (
                  <span key={i} className="inline-block mr-4 mb-1">
                    {skill.trim().replace(/^[-•]\s*/, '')}
                  </span>
                ))}
              </div>
            )}
          </div>
        </InteractiveSection>
      </section>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader
            title={getSectionTitle(
              'workExperiences',
              basics.lang,
              sectionTitles?.['workExperiences']
            )}
          />
        </InteractiveSection>
        <div className="item-gap">
          {workExperiences.map((item) => (
            <div key={item.id} className="page-break-fix">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="flex justify-between items-baseline mb-1">
                  <h4
                    className="font-bold text-gray-900"
                    style={{ fontSize: '1.07em' }}
                  >
                    {item.company}
                  </h4>
                  <span
                    className="font-medium text-gray-500 tabular-nums"
                    style={{ fontSize: '0.85em' }}
                  >
                    {formatDate(item.startDate)} —{' '}
                    {item.endDate ? formatDate(item.endDate) : 'Present'}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mb-2">
                  <span
                    className="font-medium text-gray-600"
                    style={{ color: theme.themeColor, fontSize: '0.93em' }}
                  >
                    {item.position}
                  </span>
                </div>
                <div
                  className="text-gray-700 leading-normal"
                  style={{ fontSize: '0.93em' }}
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
            title={getSectionTitle(
              'projectExperiences',
              basics.lang,
              sectionTitles?.['projectExperiences']
            )}
          />
        </InteractiveSection>
        <div className="item-gap">
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
                    className="font-medium text-gray-500 tabular-nums"
                    style={{ fontSize: '0.85em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                {item.role && (
                  <div
                    className="font-medium mb-2"
                    style={{ color: theme.themeColor, fontSize: '0.93em' }}
                  >
                    {item.role}
                  </div>
                )}
                {(item.githubUrl || item.demoUrl) && (
                  <div
                    className="flex flex-wrap gap-x-4 gap-y-1 mb-2 font-mono text-gray-500"
                    style={{ fontSize: '0.78em' }}
                  >
                    {item.demoUrl && (
                      <div className="flex items-center gap-1">
                        <Globe size={11} className="shrink-0" />
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
                      <div className="flex items-center gap-1">
                        <Github size={11} className="shrink-0" />
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
                <div className="text-gray-700" style={{ fontSize: '0.93em' }}>
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
        <div className="item-gap">
          {educations.map((item) => (
            <div key={item.id} className="page-break-fix">
              <InteractiveSection sectionKey="educations" itemId={item.id}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-baseline mb-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className="font-bold text-gray-900"
                      style={{ fontSize: '1em' }}
                    >
                      {item.school}
                    </span>
                    <span
                      className="text-gray-600"
                      style={{ fontSize: '0.93em' }}
                    >
                      {item.major} {item.degree && `| ${item.degree}`}
                    </span>
                  </div>
                  <span
                    className="font-medium text-gray-500 tabular-nums whitespace-nowrap mt-1 sm:mt-0"
                    style={{ fontSize: '0.85em' }}
                  >
                    {formatDate(item.startDate)} — {formatDate(item.endDate)}
                  </span>
                </div>
                {item.description && (
                  <div
                    className="mt-1 text-gray-600"
                    style={{ fontSize: '0.93em' }}
                  >
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
      <section style={theme.section}>
        <InteractiveSection sectionKey="certificates">
          <SectionHeader
            title={getSectionTitle(
              'certificates',
              basics.lang,
              sectionTitles?.['certificates']
            )}
          />
          <div
            className="text-gray-700 leading-relaxed"
            style={{ fontSize: '0.93em' }}
          >
            {renderDescription(certificates)}
          </div>
        </InteractiveSection>
      </section>
    ),
    hobbies: hobbies && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="hobbies">
          <SectionHeader
            title={getSectionTitle(
              'hobbies',
              basics.lang,
              sectionTitles?.['hobbies']
            )}
          />
          <div
            className="text-gray-700 leading-relaxed"
            style={{ fontSize: '0.93em' }}
          >
            {renderDescription(hobbies)}
          </div>
        </InteractiveSection>
      </section>
    ),
    customSections: customSections?.length > 0 && (
      <>
        {customSections.map((item) => (
          <section key={item.id} style={theme.section}>
            <InteractiveSection sectionKey="customSections" itemId={item.id}>
              <SectionHeader title={item.title || 'Untitled'} />
              <div
                className="text-gray-700 leading-relaxed"
                style={{ fontSize: '0.93em' }}
              >
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
      {/* 顶部装饰条 */}
      <div
        className="h-1 w-full mb-2"
        style={{ backgroundColor: theme.themeColor }}
      />

      {/* Header: Left-aligned Identity with Avatar & Horizontal Contact */}
      <InteractiveSection sectionKey="basics">
        <header className="flex flex-col-reverse md:flex-row print:flex-row items-center md:items-center print:items-center justify-between gap-6 mb-6 pt-2 pb-4 border-b border-gray-100">
          <div className="flex-1 text-center md:text-left print:text-left">
            <h1
              className="font-bold text-gray-900 tracking-tighter mb-3"
              style={{ fontSize: '2.3em' }}
            >
              {basics.name}
            </h1>

            <div className="flex flex-col gap-2 mt-3">
              {/* Row 1: Contact Info */}
              <div
                className="flex flex-wrap justify-center md:justify-start print:justify-start items-center gap-x-4 gap-y-1 text-gray-500"
                style={{ fontSize: '0.93em' }}
              >
                {basics.mobile && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={13} style={{ color: theme.themeColor }} />{' '}
                    {basics.mobile}
                  </div>
                )}
                {basics.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={13} style={{ color: theme.themeColor }} />{' '}
                    {basics.email}
                  </div>
                )}
                {(basics.address || basics.location) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={13} style={{ color: theme.themeColor }} />{' '}
                    {basics.address || basics.location}
                  </div>
                )}
              </div>

              {/* Row 2: Social Links */}
              <div
                className="flex flex-wrap justify-center md:justify-start print:justify-start items-center gap-x-4 gap-y-1 text-gray-500"
                style={{ fontSize: '0.93em' }}
              >
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
                      className="flex items-center gap-1.5 hover:text-gray-900 transition-colors"
                    >
                      <Icon size={13} />
                      <span className="underline underline-offset-2">
                        {displayLabel}
                      </span>
                    </a>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Avatar - Handled by ResumeAvatar which degrades gracefully if missing or broken */}
          <ResumeAvatar
            photoUrl={basics.photoUrl}
            name={basics.name}
            containerClassName="shrink-0"
            imageClassName="w-24 h-24 rounded-full border-[3px] border-white shadow-sm bg-gray-100 print:bg-transparent print:shadow-none"
          />
        </header>
      </InteractiveSection>

      {/* Main Sections Body */}
      <div className="flex flex-col">
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
        <span>By AI CareerSherpa</span>
      </footer>
    </div>
  )
}

export const StandardDefaults: TemplateConfig = {
  themeColor: '#374151', // 石墨灰
  fontFamily: 'roboto', // Roboto / Inter
  fontSize: 1,
  baseFontSize: 14,
  lineHeight: 1.5,
  pageMargin: 10,
  sectionSpacing: 24,
  itemSpacing: 12,
}
