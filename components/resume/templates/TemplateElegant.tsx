/* eslint-disable @next/next/no-img-element */
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
  ExternalLink,
  Twitter,
  Palette,
  Dribbble,
  Linkedin,
  Globe,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

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
  } = data
  const theme = useResumeTheme(styleConfig)
  const { isMobile } = theme

  // 辅助组件：雅致模块标题 (居中 + 莫兰迪发丝线)
  const SectionHeader = ({ title }: { title: string }) => (
    <div className="flex flex-col items-center mb-6 mt-10">
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
          // 自定义列表样式：极细空心圆圈
          '[&_ul]:!list-none [&_ul]:!pl-0',
          '[&_li]:relative [&_li]:pl-4',
          '[&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.55em]',
          "[&_li]:before:content-['○'] [&_li]:before:text-[0.6em] [&_li]:before:font-medium",
          '[&_li]:before:text-[var(--theme-color)] [&_li]:before:opacity-100',
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
            <SectionHeader title="Professional Summary" />
            <p
              className="leading-[1.8] text-gray-600 text-center max-w-[95%] italic"
              style={theme.text}
            >
              {basics.summary}
            </p>
          </div>
        </InteractiveSection>
      </section>
    ),
    skills: skills && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="skills">
          <div>
            <SectionHeader title="Expertise" />
            <div
              className="flex flex-wrap justify-center gap-x-6 gap-y-3 leading-relaxed text-gray-600 italic text-center"
              style={theme.text}
            >
              {skills.split('\n').map((skill, idx) => (
                <span key={idx} className="flex items-center gap-2">
                  {idx !== 0 && (
                    <span
                      style={{ color: theme.themeColor, opacity: 0.3 }}
                      className="font-light"
                    >
                      ·
                    </span>
                  )}
                  {skill.trim().replace(/^[-•]\s*/, '')}
                </span>
              ))}
            </div>
          </div>
        </InteractiveSection>
      </section>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader title="Experience" />
        </InteractiveSection>
        <div className="space-y-8">
          {workExperiences.map((item) => (
            <div key={item.id} className="group">
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="flex flex-col items-center">
                  <div className="w-full flex justify-between items-baseline mb-2">
                    <div className="flex flex-col items-start">
                      <h4
                        className="font-bold text-gray-900 tracking-tight"
                        style={{ fontSize: '1.05em' }}
                      >
                        {item.company}
                      </h4>
                      <span
                        className="font-serif italic font-medium"
                        style={{ ...theme.text, color: theme.themeColor }}
                      >
                        {item.position}
                      </span>
                    </div>
                    <span
                      className="text-gray-400 font-medium tracking-widest uppercase text-right shrink-0 ml-4"
                      style={{ fontSize: '0.85em' }}
                    >
                      {formatDate(item.startDate)} —{' '}
                      {item.endDate ? formatDate(item.endDate) : 'Present'}
                    </span>
                  </div>
                  <Description
                    content={item.description}
                    className="w-full text-justify"
                  />
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
          <SectionHeader title="Selected Projects" />
        </InteractiveSection>
        <div className="space-y-6">
          {projectExperiences.map((item) => (
            <div key={item.id}>
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <h4
                      className="font-bold text-gray-800"
                      style={{ fontSize: '1em' }}
                    >
                      {item.projectName}
                    </h4>
                    <span
                      className="text-gray-400 italic shrink-0 ml-4"
                      style={{ fontSize: '0.85em' }}
                    >
                      {formatDate(item.startDate)} — {formatDate(item.endDate)}
                    </span>
                  </div>
                  {item.role && (
                    <div
                      className="italic mb-1"
                      style={{
                        fontSize: '0.9em',
                        color: theme.themeColor,
                        opacity: 0.9,
                      }}
                    >
                      {item.role}
                    </div>
                  )}

                  {/* Project Links */}
                  {(item.githubUrl || item.demoUrl) && (
                    <div
                      className="flex flex-wrap gap-x-6 gap-y-1 mb-2 font-mono text-gray-500"
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

                  <Description content={item.description} />
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
          <SectionHeader title="Education" />
        </InteractiveSection>
        <div className="space-y-4">
          {educations.map((item) => (
            <div key={item.id}>
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
            <SectionHeader title="Certifications" />
            <Description content={certificates} center />
          </div>
        </InteractiveSection>
      </section>
    ),
    hobbies: hobbies && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="hobbies">
          <div>
            <SectionHeader title="Interests" />
            <Description content={hobbies} center />
          </div>
        </InteractiveSection>
      </section>
    ),
    customSections: customSections?.length > 0 && (
      <InteractiveSection sectionKey="customSections">
        <>
          {customSections.map((item) => (
            <section key={item.id} style={theme.section}>
              <div className="flex flex-col">
                <SectionHeader title={item.title} />
                <Description
                  content={item.description}
                  className="w-full text-justify"
                />
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
        'bg-white w-full min-h-full transition-all duration-300 font-serif relative',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* Header: Centered Balance Layout */}
      <InteractiveSection sectionKey="basics">
        <header className="mb-12 flex flex-col items-center text-center pt-8 relative">
          {/* 背景装饰：极其微弱的莫兰迪色光晕 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-slate-50 rounded-full blur-3xl -z-10" />

          {/* Photo (Optional) - Centered above name */}
          {basics.photoUrl && (
            <div className="mb-6 w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-sm ring-1 ring-slate-100">
              <img
                src={basics.photoUrl}
                alt={basics.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

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
            {basics.website && (
              <div className="flex items-center gap-1.5">
                <a
                  href={basics.website}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                >
                  <Globe
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: theme.themeColor, opacity: 0.8 }}
                  />
                  {basics.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {basics.github && (
              <div className="flex items-center gap-1.5">
                <a
                  href={basics.github}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                >
                  <Github
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: theme.themeColor, opacity: 0.8 }}
                  />
                  {basics.github.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {basics.linkedin && (
              <div className="flex items-center gap-1.5">
                <a
                  href={basics.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                >
                  <Linkedin
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: theme.themeColor, opacity: 0.8 }}
                  />
                  {basics.linkedin.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {basics.twitter && (
              <div className="flex items-center gap-1.5">
                <a
                  href={basics.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                >
                  <Twitter
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: theme.themeColor, opacity: 0.8 }}
                  />
                  {basics.twitter.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {basics.dribbble && (
              <div className="flex items-center gap-1.5">
                <a
                  href={basics.dribbble}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                >
                  <Dribbble
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: theme.themeColor, opacity: 0.8 }}
                  />
                  {basics.dribbble.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
            {basics.behance && (
              <div className="flex items-center gap-1.5">
                <a
                  href={basics.behance}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 hover:text-gray-800 transition-colors"
                >
                  <Palette
                    size={12}
                    strokeWidth={1.5}
                    style={{ color: theme.themeColor, opacity: 0.8 }}
                  />
                  {basics.behance.replace(/^https?:\/\//, '')}
                </a>
              </div>
            )}
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
