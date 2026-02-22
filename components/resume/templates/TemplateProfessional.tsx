/* eslint-disable @next/next/no-img-element */
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
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'
import { ResumeAvatar } from './ResumeAvatar'

/**
 * Professional 模板 - 商务专业型
 * 特点：黄金比例双列布局 (左侧边栏)、高密度排版、极强的模块边界感
 */
export function TemplateProfessional({
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
  const theme = useResumeTheme(styleConfig)

  // 辅助组件：商务模块标题 (带主色调左边框 + 浅灰底色)
  const SectionHeader = ({
    title,
    icon: Icon,
  }: {
    title: string
    icon?: any
  }) => (
    <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0 group break-after-avoid">
      <div
        className="w-1.5 h-6 rounded-sm"
        style={{ backgroundColor: theme.themeColor }}
      />
      <h3 className="text-[1.1em] font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
        {Icon && <Icon size={14} style={{ color: theme.themeColor }} />}
        {title}
      </h3>
      <div className="flex-1 h-[1px] bg-gray-100 group-hover:bg-gray-200 transition-colors" />
    </div>
  )

  // 侧边栏内容块容器
  const SidebarSection = ({
    title,
    children,
  }: {
    title: string
    children: React.ReactNode
  }) => (
    <div className="mb-6 md:mb-8 last:mb-0 break-inside-avoid">
      <h4 className="text-[0.9em] font-bold text-gray-600 uppercase tracking-[0.15em] mb-3 md:mb-4 border-b border-gray-200/50 pb-1">
        {title}
      </h4>
      {children}
    </div>
  )

  const sectionMap: Record<string, React.ReactNode> = {
    summary: basics.summary && (
      <section className="mb-8" style={theme.section}>
        <InteractiveSection sectionKey="summary">
          <div>
            <SectionHeader
              title={getSectionTitle(
                'summary',
                basics.lang,
                sectionTitles?.['summary']
              )}
              icon={Sparkles}
            />
            <div
              className="leading-relaxed text-gray-700 text-justify"
              style={theme.text}
            >
              {renderDescription(basics.summary)}
            </div>
          </div>
        </InteractiveSection>
      </section>
    ),
    educations: educations?.length > 0 && (
      <InteractiveSection sectionKey="educations">
        <SidebarSection
          title={getSectionTitle(
            'educations',
            basics.lang,
            sectionTitles?.['educations']
          )}
        >
          <div className="flex flex-col gap-4">
            {educations.map((item) => (
              <div key={item.id} className="flex flex-col gap-1">
                <div className="font-bold text-gray-900 text-sm">
                  {item.school}
                </div>
                <div className="text-xs text-gray-600 leading-snug">
                  {item.major} {item.degree && `| ${item.degree}`}
                </div>
                <div
                  className="text-xs text-gray-400 font-mono mt-0.5"
                  style={{ fontSize: '0.8em' }}
                >
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </div>
              </div>
            ))}
          </div>
        </SidebarSection>
      </InteractiveSection>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section className="mb-8" style={theme.section}>
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
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <h4
                      className="font-bold text-gray-900"
                      style={{ fontSize: '1.1em' }}
                    >
                      {item.company}
                    </h4>
                    <span
                      className="font-mono text-gray-400 shrink-0 ml-4"
                      style={{ fontSize: '0.85em' }}
                    >
                      {formatDate(item.startDate)} —{' '}
                      {item.endDate ? formatDate(item.endDate) : 'Present'}
                    </span>
                  </div>
                  <div
                    className="font-semibold mb-2"
                    style={{ color: theme.themeColor, fontSize: '1em' }}
                  >
                    {item.position}
                  </div>
                  <div className="text-gray-600" style={theme.text}>
                    {renderDescription(item.description)}
                  </div>
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: projectExperiences?.length > 0 && (
      <section className="mb-8" style={theme.section}>
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
                <div>
                  <div className="flex flex-col gap-1 mb-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h4
                        className="font-bold text-gray-800"
                        style={{ fontSize: '1em' }}
                      >
                        {item.projectName}
                      </h4>
                      <span
                        className="font-mono text-gray-400 shrink-0 ml-auto"
                        style={{ fontSize: '0.85em' }}
                      >
                        {formatDate(item.startDate)} —{' '}
                        {item.endDate ? formatDate(item.endDate) : 'Present'}
                      </span>
                    </div>

                    {item.role && (
                      <div
                        className="font-semibold"
                        style={{ color: theme.themeColor, fontSize: '1em' }}
                      >
                        {item.role}
                      </div>
                    )}

                    {(item.githubUrl || item.demoUrl) && (
                      <div className="flex flex-wrap gap-1 text-xs text-gray-500 font-mono min-w-0 mt-1.5 mb-2">
                        {item.demoUrl && (
                          <div className="flex items-center gap-1 min-w-0">
                            <ExternalLink size={12} className="shrink-0" />
                            <a
                              href={item.demoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-gray-900 hover:underline truncate"
                            >
                              {item.demoUrl.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                        {item.githubUrl && (
                          <div className="flex items-center gap-1 min-w-0">
                            <Github size={12} className="shrink-0" />
                            <a
                              href={item.githubUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-gray-900 hover:underline truncate"
                            >
                              {item.githubUrl.replace(/^https?:\/\//, '')}
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-600" style={theme.text}>
                    {renderDescription(item.description)}
                  </div>
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    // 侧边栏板块 (Skills, Certificates, Hobbies, CustomSections)
    skills: skills ? (
      <InteractiveSection sectionKey="skills">
        <SidebarSection
          title={getSectionTitle(
            'skills',
            basics.lang,
            sectionTitles?.['skills']
          )}
        >
          <div className="flex flex-col gap-4">
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
                  <div key={idx} className="flex flex-col gap-1.5">
                    <span
                      className="font-bold uppercase tracking-wider"
                      style={{ color: theme.themeColor, fontSize: '0.75em' }}
                    >
                      {label}
                    </span>
                    <span
                      className="font-normal text-gray-700 leading-relaxed"
                      style={{ fontSize: '0.9em' }}
                    >
                      {content}
                    </span>
                  </div>
                )
              }
              // Fallback: plain line
              return (
                <span
                  key={idx}
                  className="font-normal text-gray-700"
                  style={{ fontSize: '0.9em' }}
                >
                  {trimmed.replace(/^[-•]\s*/, '')}
                </span>
              )
            })}
            {/* Decorative progress bar at bottom */}
            <div className="w-full h-1 bg-gray-200/50 rounded-full overflow-hidden mt-2">
              <div
                className="h-full w-3/4"
                style={{
                  backgroundColor: theme.themeColor,
                  opacity: 0.8,
                }}
              />
            </div>
          </div>
        </SidebarSection>
      </InteractiveSection>
    ) : null,
    certificates: certificates ? (
      <InteractiveSection sectionKey="certificates">
        <SidebarSection
          title={getSectionTitle(
            'certificates',
            basics.lang,
            sectionTitles?.['certificates']
          )}
        >
          <div
            className="text-gray-600 leading-relaxed italic"
            style={{ fontSize: '0.9em' }}
          >
            {renderDescription(certificates)}
          </div>
        </SidebarSection>
      </InteractiveSection>
    ) : null,
    hobbies: hobbies ? (
      <InteractiveSection sectionKey="hobbies">
        <SidebarSection
          title={getSectionTitle(
            'hobbies',
            basics.lang,
            sectionTitles?.['hobbies']
          )}
        >
          <div
            className="text-gray-600 leading-relaxed"
            style={{ fontSize: '0.9em' }}
          >
            {renderDescription(hobbies)}
          </div>
        </SidebarSection>
      </InteractiveSection>
    ) : null,
    customSections:
      customSections?.length > 0 ? (
        <InteractiveSection sectionKey="customSections">
          <>
            {customSections.map((item) => (
              <SidebarSection key={item.id} title={item.title || 'Untitled'}>
                <div
                  className="text-gray-600 leading-relaxed flex flex-col gap-2"
                  style={{ fontSize: '0.9em' }}
                >
                  {renderDescription(item.description, {
                    listClass: 'list-none space-y-2 my-1',
                    itemClass: 'text-[length:inherit] leading-relaxed',
                  })}
                </div>
              </SidebarSection>
            ))}
          </>
        </InteractiveSection>
      ) : null,
  }

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* 顶部个人品牌区 (跨双列) */}
      <InteractiveSection sectionKey="basics">
        <header className="mb-8 pb-6 border-b-2 border-gray-900 flex justify-between items-start">
          <div className="flex-1">
            <h1 className="text-[2.5em] font-black text-gray-900 leading-tight tracking-tighter uppercase mb-4">
              {basics.name}
            </h1>
            {/* Contacts moved to Header */}
            <div className="flex flex-col gap-2">
              <div
                className="flex flex-wrap gap-x-6 gap-y-1 text-gray-600"
                style={{ fontSize: '0.9em' }}
              >
                {basics.email && (
                  <div className="flex items-center gap-2">
                    <Mail
                      size={14}
                      style={{ color: theme.themeColor }}
                      className="shrink-0"
                    />{' '}
                    {basics.email}
                  </div>
                )}
                {basics.mobile && (
                  <div className="flex items-center gap-2">
                    <Phone
                      size={14}
                      style={{ color: theme.themeColor }}
                      className="shrink-0"
                    />{' '}
                    {basics.mobile}
                  </div>
                )}
                {(basics.address || basics.location) && (
                  <div className="flex items-center gap-2">
                    <MapPin
                      size={14}
                      style={{ color: theme.themeColor }}
                      className="shrink-0"
                    />{' '}
                    {basics.address || basics.location}
                  </div>
                )}
              </div>

              <div
                className="flex flex-wrap gap-x-4 gap-y-1 text-gray-600"
                style={{ fontSize: '0.9em' }}
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
                    <div key={key} className="flex items-center gap-2">
                      <Icon
                        size={14}
                        style={{ color: theme.themeColor }}
                        className="shrink-0"
                      />
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:text-gray-900 hover:underline"
                      >
                        {displayLabel}
                      </a>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
          {/* 头像 - 使用 ResumeAvatar 实现自然降级 */}
          <ResumeAvatar
            photoUrl={basics.photoUrl}
            name={basics.name}
            containerClassName="w-24 h-24 rounded-md border border-gray-200 shadow-sm shrink-0 ml-6 print:shadow-none bg-gray-50 bg-clip-padding"
            imageClassName="w-full h-full rounded-md"
          />
        </header>
      </InteractiveSection>

      {/* 核心双列容器：移动端堆叠，PC/Print 保持 A4 比例 */}
      <div className="grid grid-cols-1 md:grid-cols-10 print:grid-cols-10 gap-y-8 md:gap-10 print:gap-10">
        {/* 左侧边栏 (30%) */}
        <aside
          className="md:col-span-3 print:col-span-3 space-y-6 md:space-y-8 p-6 md:rounded-lg print:p-6 print:rounded-none"
          style={{ backgroundColor: `${theme.themeColor}0D` }} // 5% opacity hex 0D
        >
          {/* 渲染侧边栏内容 (Skills, Awards, Custom) */}
          {[
            'educations',
            'skills',
            'certificates',
            'hobbies',
            'customSections',
          ].map((key) => {
            if (config.hidden.includes(key)) return null
            return <React.Fragment key={key}>{sectionMap[key]}</React.Fragment>
          })}
        </aside>

        {/* 右侧主内容区 (70%) */}
        <main className="md:col-span-7 print:col-span-7">
          {config.order.map((key) => {
            if (
              config.hidden.includes(key) ||
              [
                'educations',
                'skills',
                'certificates',
                'hobbies',
                'customSections',
              ].includes(key) ||
              key === 'basics'
            )
              return null
            return <React.Fragment key={key}>{sectionMap[key]}</React.Fragment>
          })}
        </main>
      </div>

      {/* 页脚装饰线 */}
      <footer
        className="mt-12 pt-4 border-t border-gray-100 flex justify-between items-center font-mono text-slate-400/60 tracking-[0.25em]"
        style={{ fontSize: '0.8em' }}
      >
        <span>PORTFOLIO {new Date().getFullYear()}</span>
        <span>By CareerShaper AI</span>
      </footer>
    </div>
  )
}

export const ProfessionalDefaults: TemplateConfig = {
  themeColor: '#334155', // Slate - Executive & Neutral
  fontFamily: 'lato', // Lato 人文商务感
  fontSize: 1,
  baseFontSize: 13.5,
  lineHeight: 1.4,
  pageMargin: 8,
  sectionSpacing: 24,
  itemSpacing: 24,
}
