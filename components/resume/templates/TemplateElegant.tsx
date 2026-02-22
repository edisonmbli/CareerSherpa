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
import { Mail, Phone, MapPin, Github, ExternalLink } from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'
import { ResumeAvatar } from './ResumeAvatar'

/**
 * Elegant 模板 - 雅致格调
 * 特点：全居中平衡、莫兰迪色系装饰、呼吸感排版
 */
export function TemplateElegant({ data, config, styleConfig }: TemplateProps) {
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
  const { isMobile } = theme

  // 辅助组件：雅致模块标题 (居中 + 莫兰迪发丝线)
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center mb-6 mt-10 break-after-avoid">
      <h3 className="text-[1.1em] font-serif font-bold text-gray-800 tracking-[0.2em] uppercase mb-2">
        {title}
      </h3>
      {/* 莫兰迪色系短线: 使用主色调但降低不透明度 */}
      <div
        className="w-12 h-[1px]"
        style={{ backgroundColor: theme.themeColor, opacity: 0.3 }}
      />
    </div>
  )

  // 辅助组件：描述文本渲染 (自定义极细空心圆点)
  const Description = ({
    content,
    className,
    center = false,
  }: {
    content?: string | undefined
    className?: string
    center?: boolean
  }) => {
    if (!content) return null
    return (
      <div
        className={cn(
          'text-gray-600 leading-relaxed',
          center && 'text-center',
          // 自定义列表样式：仅在非居中时显示圆点
          !center && '[&_ul]:!list-none [&_ul]:!pl-0',
          !center && '[&_li]:relative [&_li]:pl-4',
          !center && '[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.55em]',
          !center && "[&_li]:before:content-['○'] [&_li]:before:text-[0.6em] [&_li]:before:font-medium",
          !center && '[&_li]:before:text-[var(--theme-color)] [&_li]:before:opacity-100',
          // 居中时移除列表样式
          center && '[&_ul]:!list-none [&_ul]:!pl-0',
          center && '[&_li]:!pl-0',
          className
        )}
        style={theme.text}
      >
        {renderDescription(content)}
      </div>
    )
  }

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null,
    summary: basics.summary && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="summary">
          <div className="flex flex-col items-center">
            <SectionHeader
              title={getSectionTitle(
                'summary',
                basics.lang,
                sectionTitles?.['summary']
              )}
            />
            <div
              className="leading-[1.8] text-gray-600 text-center max-w-[95%] italic"
              style={theme.text}
            >
              {basics.summary.split('\n').map((line, i) => (
                <p key={i} className="mb-2 last:mb-0">
                  {line.trim()}
                </p>
              ))}
            </div>
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="skills">
          <div>
            <SectionHeader
              title={getSectionTitle(
                'skills',
                basics.lang,
                sectionTitles?.['skills']
              )}
            />
            <div className="space-y-4">
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
                    <div key={idx} className="text-center">
                      <span
                        className="font-serif font-medium mr-2"
                        style={{ color: theme.themeColor }}
                      >
                        {label}
                      </span>
                      <span className="text-gray-600 italic" style={theme.text}>
                        {content}
                      </span>
                    </div>
                  )
                }
                // Fallback: inline with separator
                return (
                  <span key={idx} className="flex items-center gap-2 justify-center">
                    {idx !== 0 && (
                      <span
                        style={{ color: theme.themeColor, opacity: 0.3 }}
                        className="font-light"
                      >
                        ·
                      </span>
                    )}
                    <span className="text-gray-600 italic" style={theme.text}>
                      {trimmed.replace(/^[-•]\s*/, '')}
                    </span>
                  </span>
                )
              })}
            </div>
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
            <div key={item.id} className="group page-break-fix">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                {/* 全居中布局 */}
                <div className="flex flex-col items-center text-center mb-4">
                  <h4
                    className="font-bold text-gray-900 tracking-tight"
                    style={{ fontSize: '1.05em' }}
                  >
                    {item.company}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    <span
                      className="font-serif italic font-medium"
                      style={{ color: theme.themeColor }}
                    >
                      {item.position}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span className="text-gray-400 tracking-wider">
                      {formatDate(item.startDate)} —{' '}
                      {item.endDate ? formatDate(item.endDate) : 'Present'}
                    </span>
                  </div>
                </div>
                <Description
                  content={item.description}
                  className="max-w-xl mx-auto text-justify"
                />
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
                {/* 全居中布局 */}
                <div className="flex flex-col items-center text-center mb-3">
                  <h4
                    className="font-bold text-gray-800"
                    style={{ fontSize: '1em' }}
                  >
                    {item.projectName}
                  </h4>
                  <div className="flex items-center gap-2 mt-1 text-sm">
                    {item.role && (
                      <>
                        <span
                          className="italic"
                          style={{ color: theme.themeColor, opacity: 0.9 }}
                        >
                          {item.role}
                        </span>
                        <span className="text-gray-300">|</span>
                      </>
                    )}
                    <span className="text-gray-400 tracking-wider">
                      {formatDate(item.startDate)} — {formatDate(item.endDate)}
                    </span>
                  </div>

                  {/* Project Links */}
                  {(item.githubUrl || item.demoUrl) && (
                    <div
                      className="flex flex-wrap justify-center gap-x-6 gap-y-1 mt-2 font-mono text-gray-500"
                      style={{ fontSize: '0.8em' }}
                    >
                      {item.demoUrl && (
                        <a
                          href={item.demoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-sky-700 hover:underline"
                        >
                          <ExternalLink size={12} className="shrink-0" />
                          {item.demoUrl.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      {item.githubUrl && (
                        <a
                          href={item.githubUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 hover:text-sky-700 hover:underline"
                        >
                          <Github size={12} className="shrink-0" />
                          {item.githubUrl.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <Description content={item.description} className="max-w-xl mx-auto text-justify" />
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
                <div className="flex flex-col items-center text-center">
                  <span
                    className="font-bold text-gray-900"
                    style={{ fontSize: '1.05em' }}
                  >
                    {item.school}
                  </span>
                  <div
                    className="text-gray-600 mt-1"
                    style={{ ...theme.text, fontSize: '0.95em' }}
                  >
                    <span className="font-serif italic">{item.major}</span>
                    <span
                      className="mx-2 font-light"
                      style={{ color: theme.themeColor, opacity: 0.3 }}
                    >
                      /
                    </span>
                    <span>{item.degree}</span>
                  </div>
                  <span
                    className="text-gray-400 mt-1 tracking-widest uppercase"
                    style={{ fontSize: '0.8em' }}
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
          <div>
            <SectionHeader
              title={getSectionTitle(
                'certificates',
                basics.lang,
                sectionTitles?.['certificates']
              )}
            />
            <Description content={certificates} center />
          </div>
        </InteractiveSection>
      </section>
    ),
    hobbies: hobbies && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="hobbies">
          <div>
            <SectionHeader
              title={getSectionTitle(
                'hobbies',
                basics.lang,
                sectionTitles?.['hobbies']
              )}
            />
            <Description content={hobbies} center />
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
              <Description
                content={item.description}
                className="max-w-xl mx-auto"
                center={true}
              />
            </InteractiveSection>
          </section>
        ))}
      </>
    ),
  }

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300 font-serif relative overflow-hidden',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* 微妙的渐变背景 */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          background: `radial-gradient(circle at 50% 0%, ${theme.themeColor}, transparent 70%)`,
        }}
      />

      {/* 点状背景图案 - 增强可见度 */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle, ${theme.themeColor} 1.5px, transparent 1.5px)`,
          backgroundSize: '32px 32px',
        }}
      />

      {/* 四角装饰 */}
      <div className="absolute top-4 left-4 w-12 h-12 pointer-events-none opacity-10">
        <div
          className="absolute top-0 left-0 w-full h-[1px]"
          style={{ backgroundColor: theme.themeColor }}
        />
        <div
          className="absolute top-0 left-0 w-[1px] h-full"
          style={{ backgroundColor: theme.themeColor }}
        />
      </div>
      <div className="absolute top-4 right-4 w-12 h-12 pointer-events-none opacity-10">
        <div
          className="absolute top-0 right-0 w-full h-[1px]"
          style={{ backgroundColor: theme.themeColor }}
        />
        <div
          className="absolute top-0 right-0 w-[1px] h-full"
          style={{ backgroundColor: theme.themeColor }}
        />
      </div>
      <div className="absolute bottom-4 left-4 w-12 h-12 pointer-events-none opacity-10 print:hidden">
        <div
          className="absolute bottom-0 left-0 w-full h-[1px]"
          style={{ backgroundColor: theme.themeColor }}
        />
        <div
          className="absolute bottom-0 left-0 w-[1px] h-full"
          style={{ backgroundColor: theme.themeColor }}
        />
      </div>
      <div className="absolute bottom-4 right-4 w-12 h-12 pointer-events-none opacity-10 print:hidden">
        <div
          className="absolute bottom-0 right-0 w-full h-[1px]"
          style={{ backgroundColor: theme.themeColor }}
        />
        <div
          className="absolute bottom-0 right-0 w-[1px] h-full"
          style={{ backgroundColor: theme.themeColor }}
        />
      </div>

      {/* Header: Centered Balance Layout */}
      <InteractiveSection sectionKey="basics">
        <header className="mb-12 flex flex-col items-center text-center pt-8 relative z-10">
          {/* Photo (Optional) - Centered above name - Handled by ResumeAvatar to gracefully hide if broken/missing */}
          <ResumeAvatar
            photoUrl={basics.photoUrl}
            name={basics.name}
            containerClassName="mb-6 w-28 h-28 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-100 print:shadow-none bg-slate-50"
            imageClassName="w-full h-full object-cover rounded-full"
          />

          <h1
            className="font-serif font-bold tracking-[0.1em] mb-4 text-gray-900"
            style={{ fontSize: isMobile ? '2em' : '2.5em' }}
          >
            {basics.name}
          </h1>

          <div
            className="flex flex-wrap justify-center items-center gap-x-6 gap-y-2 text-gray-500 tracking-wider px-4"
            style={{ fontSize: '0.85em' }}
          >
            {basics.mobile && (
              <div className="flex items-center gap-1.5">
                <Phone
                  size={12}
                  strokeWidth={1.5}
                  style={{ color: theme.themeColor, opacity: 0.8 }}
                />{' '}
                {basics.mobile}
              </div>
            )}
            {basics.email && (
              <div className="flex items-center gap-1.5">
                <Mail
                  size={12}
                  strokeWidth={1.5}
                  style={{ color: theme.themeColor, opacity: 0.8 }}
                />{' '}
                {basics.email}
              </div>
            )}
            {(basics.address || basics.location) && (
              <div className="flex items-center gap-1.5">
                <MapPin
                  size={12}
                  strokeWidth={1.5}
                  style={{ color: theme.themeColor, opacity: 0.8 }}
                />{' '}
                {basics.address || basics.location}
              </div>
            )}
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
                <div key={key} className="flex items-center gap-1.5">
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                  >
                    <Icon
                      size={12}
                      strokeWidth={1.5}
                      style={{ color: theme.themeColor, opacity: 0.8 }}
                    />
                    {displayLabel}
                  </a>
                </div>
              )
            })}
          </div>

          <div
            className="mt-8 w-16 h-[1px]"
            style={{ backgroundColor: theme.themeColor, opacity: 0.3 }}
          />
        </header>
      </InteractiveSection>

      {/* Main Content Sections */}
      <div className="flex flex-col">
        {config.order.map((key) => {
          if (config.hidden.includes(key) || key === 'basics') return null
          return <React.Fragment key={key}>{sectionMap[key]}</React.Fragment>
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

export const ElegantDefaults: TemplateConfig = {
  themeColor: '#475569', // Slate Grey
  fontFamily: 'playfair', // Playfair Display 时尚杂志感
  fontSize: 1,
  baseFontSize: 13.5,
  lineHeight: 1.75, // 宽松行高
  pageMargin: 12,
  sectionSpacing: 24,
  itemSpacing: 32,
}
