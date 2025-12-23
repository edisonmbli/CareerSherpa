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
  Linkedin,
  GraduationCap,
  User,
  Trophy,
  ExternalLink,
  Sparkles,
  Heart,
  Globe,
} from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

/**
 * Dark Sidebar 模板 - 深色侧栏型
 * 特点：强视觉冲击，不对称美学 (35/65 Split)，适合创意、科技、个人品牌
 */
export function TemplateDarkSidebar({
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
    fontFamily: 'jetbrains-mono',
    fontSize: 1.0,
    ...styleConfig,
  })

  // 辅助组件：侧边栏小标题
  const SidebarTitle = ({
    title,
    icon: Icon,
  }: {
    title: string
    icon?: any
  }) => (
    <div className="mb-1 mt-1 first:mt-0 flex items-center gap-2 border-b border-white/10 pb-2 md:justify-start justify-center print:justify-start">
      {Icon && <Icon size={14} className="text-white/40" />}
      <h4 className="text-[1.0em] font-black text-white/50 uppercase tracking-[0.2em]">
        {title}
      </h4>
    </div>
  )

  // 辅助组件：主内容区标题
  const MainTitle = ({ title }: { title: string }) => (
    <div className="mb-4 mt-6 first:mt-0 relative group">
      <h3
        className="text-[1.1em] font-bold text-gray-900 uppercase tracking-tight relative z-10 bg-white pr-4 inline-block"
        style={{ color: '#111827' }} // Always dark text
      >
        {title}
      </h3>
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-gray-100 -z-0 group-hover:bg-gray-200 transition-colors" />
      <div
        className="mt-1 h-[3px] w-8 rounded-full"
        style={{ backgroundColor: theme.themeColor }}
      />
    </div>
  )

  // 侧边栏内容渲染
  const renderSidebarContent = () => (
    <>
      {/* 联系方式 */}
      <div className="w-full">
        <InteractiveSection sectionKey="basics">
          <div className="w-full space-y-4 text-center md:text-left print:text-left">
            <SidebarTitle title="Contact" />
            <div className="space-y-3 mt-4 text-[0.85em] text-white/70 font-light flex flex-col items-start w-fit mx-auto md:mx-0 md:w-full print:mx-0 print:w-full">
              {basics.email && (
                <div className="flex items-center gap-3 group w-full">
                  <Mail
                    size={14}
                    className="text-white/40 group-hover:text-white/80 transition-colors shrink-0"
                  />
                  <span className="break-all text-left">{basics.email}</span>
                </div>
              )}
              {basics.mobile && (
                <div className="flex items-center gap-3 group w-full">
                  <Phone
                    size={14}
                    className="text-white/40 group-hover:text-white/80 transition-colors shrink-0"
                  />
                  <span className="tabular-nums font-mono text-left">
                    {basics.mobile}
                  </span>
                </div>
              )}
              {basics.location && (
                <div className="flex items-center gap-3 group w-full">
                  <MapPin
                    size={14}
                    className="text-white/40 group-hover:text-white/80 transition-colors shrink-0"
                  />
                  <span className="text-left">{basics.location}</span>
                </div>
              )}
              {basics.github && (
                <div className="flex items-center gap-3 group w-full">
                  <Github
                    size={14}
                    className="text-white/40 group-hover:text-white/80 transition-colors shrink-0"
                  />
                  <a
                    href={basics.github}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors truncate text-left"
                  >
                    {basics.github.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {basics.linkedin && (
                <div className="flex items-center gap-3 group w-full">
                  <Linkedin
                    size={14}
                    className="text-white/40 group-hover:text-white/80 transition-colors shrink-0"
                  />
                  <a
                    href={basics.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white transition-colors truncate text-left"
                  >
                    {basics.linkedin.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>
        </InteractiveSection>
      </div>

      {/* 教育背景 - 移至侧边栏 */}
      {educations?.length > 0 && !config.hidden.includes('educations') && (
        <div className="w-full text-center md:text-left print:text-left">
          <InteractiveSection sectionKey="educations">
            <SidebarTitle title="Education" />
            <div className="space-y-6">
              {educations.map((edu) => (
                <div key={edu.id} className="group">
                  <InteractiveSection sectionKey="educations" itemId={edu.id}>
                    <div>
                      <div className="font-bold text-white mb-1 group-hover:text-white/90 transition-colors">
                        {edu.school}
                      </div>
                      <div className="text-[0.85em] text-white/60">
                        {edu.major} {edu.degree && `| ${edu.degree}`}
                      </div>
                      <div className="text-[0.8em] text-white/40 mt-1 tabular-nums font-mono">
                        {formatDate(edu.startDate)} — {formatDate(edu.endDate)}
                      </div>
                    </div>
                  </InteractiveSection>
                </div>
              ))}
            </div>
          </InteractiveSection>
        </div>
      )}

      {/* 核心技能 */}
      {skills && !config.hidden.includes('skills') && (
        <div className="w-full text-center md:text-left print:text-left">
          <InteractiveSection sectionKey="skills">
            <SidebarTitle title="Skills" />
            <div className="flex flex-wrap gap-2 justify-center md:justify-start print:justify-start">
              {skills.split('\n').map((skill, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 bg-white/10 border border-white/10 rounded-[4px] text-[0.85em] text-white/90 backdrop-blur-sm"
                >
                  {skill.trim().replace(/^[-•]\s*/, '')}
                </span>
              ))}
            </div>
          </InteractiveSection>
        </div>
      )}

      {/* 荣誉奖项 */}
      {certificates && !config.hidden.includes('certificates') && (
        <div className="w-full text-center md:text-left print:text-left">
          <InteractiveSection sectionKey="certificates">
            <SidebarTitle title="Awards" icon={Trophy} />
            <div className="text-[0.85em] text-white/70 leading-relaxed italic [&_li]:text-white/80 [&_ul]:text-white/80">
              {renderDescription(certificates)}
            </div>
          </InteractiveSection>
        </div>
      )}

      {/* 兴趣爱好 */}
      {hobbies && !config.hidden.includes('hobbies') && (
        <div className="w-full text-center md:text-left print:text-left">
          <InteractiveSection sectionKey="hobbies">
            <SidebarTitle title="Interests" icon={Heart} />
            <div className="text-[0.85em] text-white/70 leading-relaxed [&_li]:text-white/80 [&_ul]:text-white/80">
              {renderDescription(hobbies)}
            </div>
          </InteractiveSection>
        </div>
      )}

      {/* 自定义模块 - 移至侧边栏底部 */}
      {customSections?.length > 0 && (
        <>
          {customSections.map((item) => (
            <div
              key={item.id}
              className="w-full text-center md:text-left print:text-left"
            >
              <InteractiveSection sectionKey="customSections">
                <SidebarTitle title={item.title} />
                <div className="text-[0.9em] text-white/70 leading-relaxed flex flex-col gap-2">
                  {item.description.split('\n').map((line, idx) => (
                    <div key={idx}>{line.replace(/^[-•]\s*/, '')}</div>
                  ))}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </>
      )}
    </>
  )

  const sectionMap: Record<string, React.ReactNode> = {
    summary: basics.summary && (
      <section className="mb-6" style={theme.section}>
        <InteractiveSection sectionKey="summary">
          <div>
            <MainTitle title="Professional Summary" />
            <p
              className="text-[0.95em] leading-relaxed text-gray-700 text-justify"
              style={theme.text}
            >
              {basics.summary}
            </p>
          </div>
        </InteractiveSection>
      </section>
    ),
    workExperiences: workExperiences?.length > 0 && (
      <section className="mb-6" style={theme.section}>
        <InteractiveSection sectionKey="workExperiences">
          <MainTitle title="Work Experience" />
        </InteractiveSection>
        <div className="space-y-6">
          {workExperiences.map((item) => (
            <div key={item.id}>
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="relative pl-4 border-l border-gray-200">
                  <div
                    className="absolute -left-[5px] top-2 w-[9px] h-[9px] rounded-full ring-4 ring-white"
                    style={{ backgroundColor: theme.themeColor }}
                  />
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="text-[1.05em] font-bold text-gray-900">
                      {item.company}
                    </h4>
                    <span className="text-[0.85em] font-mono text-gray-400 shrink-0 ml-4">
                      {formatDate(item.startDate)} —{' '}
                      {item.endDate ? formatDate(item.endDate) : 'Present'}
                    </span>
                  </div>
                  <div className="text-[0.95em] font-semibold text-gray-600 mb-2 italic">
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
      <section className="mb-6" style={theme.section}>
        <InteractiveSection sectionKey="projectExperiences">
          <MainTitle title="Featured Projects" />
        </InteractiveSection>
        <div className="space-y-6">
          {projectExperiences.map((item) => (
            <div
              key={item.id}
              className="relative pl-4 border-l border-gray-200"
            >
              <div
                className="absolute -left-[5px] top-2 w-[9px] h-[9px] rounded-full ring-4 ring-white"
                style={{ backgroundColor: theme.themeColor }}
              />
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div>
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className="text-[1.05em] font-bold text-gray-900">
                      {item.projectName}
                    </h4>
                    <span className="text-[0.85em] font-mono text-gray-400 shrink-0 ml-4">
                      {formatDate(item.startDate)} —{' '}
                      {item.endDate ? formatDate(item.endDate) : 'Present'}
                    </span>
                  </div>

                  {item.role && (
                    <div className="text-[0.95em] font-semibold text-gray-600 mb-2 italic">
                      {item.role}
                    </div>
                  )}

                  {(item.githubUrl || item.demoUrl) && (
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 font-mono min-w-0 mt-1.5 mb-2">
                      {item.demoUrl && (
                        <div className="flex items-center gap-1 min-w-0">
                          <ExternalLink size={12} className="shrink-0" />
                          <a
                            href={item.demoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-sky-700 hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
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
                            className="hover:text-sky-700 hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.githubUrl.replace(/^https?:\/\//, '')}
                          </a>
                        </div>
                      )}
                    </div>
                  )}

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
    // Custom Sections moved to sidebar
  }

  return (
    <div
      className={cn(
        'bg-white w-full min-h-full transition-all duration-300',
        theme.fontFamilyClass
      )}
      style={theme.container}
    >
      {/* 
        Layout Strategy: Grid Layout
        Mobile: Single column, sidebar content first (as per design requirement usually basics come first)
        Desktop & Print: 10 columns grid. Sidebar 3 cols, Main 7 cols.
        Note: Removed 'print:fixed' to solve repeat issue.
      */}
      <div className="grid grid-cols-1 md:grid-cols-10 print:grid-cols-10 gap-y-8 md:gap-10 print:gap-10 min-h-full">
        {/* 
          1. Dark Sidebar (30% width roughly 3/10)
          Mobile: Full width.
        */}
        <aside
          className="md:col-span-3 print:col-span-3 p-5 md:p-5 text-white relative overflow-hidden flex flex-col items-start print:items-start print:text-left"
          style={{
            backgroundColor: theme.themeColor,
            backgroundImage:
              'linear-gradient(to bottom right, rgba(255,255,255,0.05), rgba(0,0,0,0.2))',
          }}
        >
          {/* Dark Mode Filter Effect */}
          <div
            className="absolute inset-0 z-0 pointer-events-none"
            style={{
              backgroundColor: '#000',
              opacity: 0.2,
            }}
          />

          {/* Decorative Circle */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl z-0 pointer-events-none" />

          <div className="relative z-10 w-full flex flex-col items-start space-y-4 md:space-y-6 print:space-y-4">
            {/* Identity Card */}
            <div className="w-full">
              <InteractiveSection sectionKey="basics">
                <div className="flex flex-col items-center md:items-start print:items-start mb-6 w-full">
                  {basics.photoUrl ? (
                    <div className="w-24 h-24 rounded-full border-[3px] border-white/20 shadow-xl overflow-hidden mb-6 bg-white/5">
                      <img
                        src={basics.photoUrl}
                        alt={basics.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-full border-2 border-white/20 flex items-center justify-center mb-6 bg-white/10 text-white/40">
                      <User size={40} />
                    </div>
                  )}

                  <h1 className="text-[2em] font-black tracking-tighter leading-none mb-3 text-center md:text-left print:text-left">
                    {basics.name}
                  </h1>

                  <div className="h-1.5 w-12 rounded-full bg-white/30 mx-auto md:mx-0 print:mx-0" />
                </div>
              </InteractiveSection>
            </div>

            {renderSidebarContent()}
          </div>
        </aside>

        {/* 
          2. Main Content (70% width roughly 7/10)
        */}
        <main className="md:col-span-7 print:col-span-7 p-0 md:p-0 print:p-0 bg-white">
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
    </div>
  )
}
