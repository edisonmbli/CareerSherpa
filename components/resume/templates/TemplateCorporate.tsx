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
  Github,
  MapPin,
  ExternalLink,
  Linkedin,
  Twitter,
  Palette,
  Dribbble,
  Globe,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

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
    <div className="mb-4 mt-6 first:mt-0">
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
          <SectionHeader title="Professional Summary" />
          <p
            className="leading-relaxed text-gray-700 text-justify px-1"
            style={theme.text}
          >
            {basics.summary}
          </p>
        </section>
      </InteractiveSection>
    ),
    skills: skills && (
      <InteractiveSection sectionKey="skills">
        <section style={theme.section}>
          <SectionHeader title="Core Competencies" />
          <div className="px-1">
            <div className="text-gray-700 leading-relaxed" style={theme.text}>
              {skills.split('\n').map((skill, idx) => (
                <div key={idx} className="mb-1">
                  {skill.trim().replace(/^[-•]\s*/, '')}
                </div>
              ))}
            </div>
          </div>
        </section>
      </InteractiveSection>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <SectionHeader title="Work Experience" />
        </InteractiveSection>
        <div className="space-y-6 px-1">
          {workExperiences.map((item) => (
            <div key={item.id} className="group">
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
          <SectionHeader title="Key Projects" />
        </InteractiveSection>
        <div className="space-y-5 px-1">
          {projectExperiences.map((item) => (
            <div key={item.id}>
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
          <SectionHeader title="Education" />
        </InteractiveSection>
        <div className="space-y-4 px-1">
          {educations.map((item) => (
            <div key={item.id} className="flex justify-between items-start">
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
          <SectionHeader title="Certifications" />
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
          <SectionHeader title="Interests" />
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
              <SectionHeader title={item.title} />
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

      {/* Header: Executive Split Layout */}
      <InteractiveSection sectionKey="basics">
        <header className="mb-10 pl-4 pr-2 pt-2">
          {isMobile ? (
            <div className="flex justify-between items-start">
              {/* Mobile Left: Photo */}
              <div className="shrink-0 mr-4">
                {basics.photoUrl && (
                  <div className="w-24 h-32 bg-gray-100 overflow-hidden border border-gray-200 shadow-sm">
                    <img
                      src={basics.photoUrl}
                      alt={basics.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>

              {/* Mobile Right: Contact + Name */}
              <div
                className="flex flex-col items-end gap-1.5 pt-2 border-r-4 pr-4 max-w-[65%]"
                style={{ borderColor: theme.themeColor }}
              >
                {basics.mobile && (
                  <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium justify-end text-right">
                    {basics.mobile}{' '}
                    <Phone
                      size={14}
                      style={{ color: theme.themeColor }}
                      className="shrink-0"
                    />
                  </div>
                )}
                {basics.email && (
                  <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium justify-end text-right break-all">
                    {basics.email}{' '}
                    <Mail
                      size={14}
                      style={{ color: theme.themeColor }}
                      className="shrink-0"
                    />
                  </div>
                )}
                {(basics.address || basics.location) && (
                  <div className="flex items-center gap-2 text-[12px] text-gray-600 font-medium justify-end text-right">
                    {basics.address || basics.location}{' '}
                    <MapPin
                      size={14}
                      style={{ color: theme.themeColor }}
                      className="shrink-0"
                    />
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 justify-end text-[11px] text-gray-500 font-mono">
                  {basics.github && (
                    <a
                      href={basics.github}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Github size={14} />
                      <span>{basics.github.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.linkedin && (
                    <a
                      href={basics.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Linkedin size={14} />
                      <span>{basics.linkedin.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.website && (
                    <a
                      href={basics.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Globe size={14} />
                      <span>{basics.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.twitter && (
                    <a
                      href={basics.twitter}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Twitter size={14} />
                      <span>{basics.twitter.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.dribbble && (
                    <a
                      href={basics.dribbble}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Dribbble size={14} />
                      <span>{basics.dribbble.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.behance && (
                    <a
                      href={basics.behance}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Palette size={14} />
                      <span>{basics.behance.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>

                <h1
                  className="font-black uppercase tracking-tight mt-3 text-2xl text-right leading-tight"
                  style={{ color: theme.themeColor }}
                >
                  {basics.name}
                </h1>
              </div>
            </div>
          ) : (
            <div className="flex justify-between items-start">
              <div className="flex-1 flex gap-6">
                {/* Photo (Optional) */}
                {basics.photoUrl && (
                  <div className="w-24 h-32 bg-gray-100 shrink-0 overflow-hidden border border-gray-200 shadow-sm">
                    <img
                      src={basics.photoUrl}
                      alt={basics.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="flex flex-col justify-center">
                  <h1
                    className="font-black uppercase tracking-tight mb-2 text-4xl"
                    style={{ color: theme.themeColor }}
                  >
                    {basics.name}
                  </h1>
                  {/* 如果有Title字段可以加在这里，目前Schema中没有，暂留空或展示其他信息 */}
                </div>
              </div>

              <div
                className="flex flex-col items-end gap-1.5 pt-2 border-r-4 pr-4"
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
                  {basics.github && (
                    <a
                      href={basics.github}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Github size={14} />
                      <span>{basics.github.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.linkedin && (
                    <a
                      href={basics.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Linkedin size={14} />
                      <span>{basics.linkedin.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.website && (
                    <a
                      href={basics.website}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Globe size={14} />
                      <span>{basics.website.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.twitter && (
                    <a
                      href={basics.twitter}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Twitter size={14} />
                      <span>{basics.twitter.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.dribbble && (
                    <a
                      href={basics.dribbble}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Dribbble size={14} />
                      <span>{basics.dribbble.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                  {basics.behance && (
                    <a
                      href={basics.behance}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                    >
                      <Palette size={14} />
                      <span>{basics.behance.replace(/^https?:\/\//, '')}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
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
        <span>By CareerShaper AI</span>
      </footer>
    </div>
  )
}
