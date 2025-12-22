'use client'

import { TemplateProps } from './types'
import { useResumeTheme } from './hooks/useResumeTheme'
import { renderDescription, formatDate } from './utils'
import { Mail, Phone, Link as LinkIcon, Github, MapPin } from 'lucide-react'
import { InteractiveSection } from './InteractiveSection'

export function TemplateStandard({ data, config, styleConfig }: TemplateProps) {
  const { basics } = data
  const {
    container: containerStyle,
    header: headerStyle,
    subHeader: subHeaderStyle,
    text: textStyle,
    section: sectionStyle,
    item: itemStyle,
    fontFamilyClass,
    themeColor,
    isMobile,
  } = useResumeTheme(styleConfig)

  // Specific overrides for this template
  const sectionTitleStyle = {
    ...headerStyle,
    borderColor: themeColor, // Use theme color for divider
    borderBottomWidth: '1px',
    color: themeColor, // Keep text color themed
    fontSize: isMobile ? '1.1em' : '1.25em',
  }

  const sectionMap: Record<string, React.ReactNode> = {
    basics: null, // Rendered separately in header
    summary: basics.summary && (
      <InteractiveSection sectionKey="summary">
        <section style={sectionStyle}>
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            个人总结
          </h3>
          <div style={textStyle} className="text-gray-700 leading-relaxed">
            {renderDescription(basics.summary)}
          </div>
        </section>
      </InteractiveSection>
    ),
    workExperiences: data.workExperiences?.length > 0 && (
      <section style={sectionStyle}>
        <InteractiveSection sectionKey="workExperiences">
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            工作经历
          </h3>
        </InteractiveSection>
        <div className="space-y-3">
          {data.workExperiences.map((item, index) => (
            <div
              key={item.id}
              style={
                index < data.workExperiences.length - 1 ? itemStyle : undefined
              }
            >
              <InteractiveSection sectionKey="workExperiences" itemId={item.id}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                    <h4
                      className="font-bold text-gray-900"
                      style={subHeaderStyle}
                    >
                      {item.company}
                    </h4>
                    <span
                      className="text-gray-700 font-medium"
                      style={textStyle}
                    >
                      {item.position}
                    </span>
                  </div>
                  <span className="text-gray-500 font-medium whitespace-nowrap text-sm mt-1 sm:mt-0">
                    {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </span>
                </div>

                <div style={textStyle} className="text-gray-700 mt-2">
                  {renderDescription(item.description)}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: data.projectExperiences?.length > 0 && (
      <section style={sectionStyle}>
        <InteractiveSection sectionKey="projectExperiences">
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            项目经历
          </h3>
        </InteractiveSection>
        <div className="space-y-3">
          {data.projectExperiences.map((item, index) => (
            <div
              key={item.id}
              style={
                index < data.projectExperiences.length - 1
                  ? itemStyle
                  : undefined
              }
            >
              <InteractiveSection
                sectionKey="projectExperiences"
                itemId={item.id}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline mb-1">
                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3">
                    <h4
                      className="font-bold text-gray-900"
                      style={subHeaderStyle}
                    >
                      {item.projectName}
                    </h4>
                    {item.role && (
                      <span
                        className="text-gray-700 font-medium"
                        style={textStyle}
                      >
                        {item.role}
                      </span>
                    )}
                  </div>
                  <span className="text-gray-500 font-medium whitespace-nowrap text-sm mt-1 sm:mt-0">
                    {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </span>
                </div>
                <div style={textStyle} className="text-gray-700 mt-2">
                  {renderDescription(item.description)}
                </div>
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    educations: data.educations?.length > 0 && (
      <section style={sectionStyle}>
        <InteractiveSection sectionKey="educations">
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            教育经历
          </h3>
        </InteractiveSection>
        <div className="space-y-3">
          {data.educations.map((item, index) => (
            <div
              key={item.id}
              style={index < data.educations.length - 1 ? itemStyle : undefined}
            >
              <InteractiveSection sectionKey="educations" itemId={item.id}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4
                      className="font-bold text-gray-900"
                      style={subHeaderStyle}
                    >
                      {item.school}
                    </h4>
                    <div className="text-gray-700 mt-0.5" style={textStyle}>
                      {item.major} {item.degree && `| ${item.degree}`}
                    </div>
                  </div>
                  <span className="text-gray-500 font-medium text-sm whitespace-nowrap">
                    {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </span>
                </div>
                {item.description && (
                  <div className="mt-1 text-gray-600" style={textStyle}>
                    {renderDescription(item.description)}
                  </div>
                )}
              </InteractiveSection>
            </div>
          ))}
        </div>
      </section>
    ),
    skills: data.skills && (
      <InteractiveSection sectionKey="skills">
        <section style={sectionStyle}>
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            技能特长
          </h3>
          <div style={textStyle} className="text-gray-700 leading-relaxed">
            {renderDescription(data.skills)}
          </div>
        </section>
      </InteractiveSection>
    ),
    certificates: data.certificates && (
      <InteractiveSection sectionKey="certificates">
        <section style={sectionStyle}>
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            证书奖项
          </h3>
          <div style={textStyle} className="text-gray-700 leading-relaxed">
            {renderDescription(data.certificates)}
          </div>
        </section>
      </InteractiveSection>
    ),
    hobbies: data.hobbies && (
      <InteractiveSection sectionKey="hobbies">
        <section style={sectionStyle}>
          <h3
            className="font-bold mb-2 pb-2 uppercase tracking-wide"
            style={sectionTitleStyle}
          >
            兴趣爱好
          </h3>
          <div style={textStyle} className="text-gray-700 leading-relaxed">
            {renderDescription(data.hobbies)}
          </div>
        </section>
      </InteractiveSection>
    ),
    customSections: data.customSections?.length > 0 && (
      <InteractiveSection sectionKey="customSections">
        <>
          {data.customSections.map((item) => (
            <section key={item.id} style={sectionStyle}>
              <h3
                className="font-bold mb-2 pb-2 uppercase tracking-wide"
                style={sectionTitleStyle}
              >
                {item.title}
              </h3>
              <div style={textStyle} className="text-gray-700 leading-relaxed">
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
      className={`${fontFamilyClass} text-gray-900 h-full bg-white w-full`}
      style={containerStyle}
    >
      {/* Header */}
      <InteractiveSection sectionKey="basics">
        <header
          className="text-center mb-6" // Removed border-b-2, reduced mb
          style={{
            marginBottom:
              typeof sectionStyle.marginBottom === 'string'
                ? `calc(${sectionStyle.marginBottom} * 1.5)`
                : 32,
          }}
        >
          {basics.photoUrl && (
            <div className="flex justify-center mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={basics.photoUrl}
                alt={basics.name}
                className="w-28 h-28 rounded-full object-cover shadow-lg" // Changed border-2 to shadow-lg
                style={
                  {
                    // Optional: subtle ring if needed, but shadow is usually enough for "clean" look
                    // ring: `2px solid ${themeColor}20`
                  }
                }
              />
            </div>
          )}
          <h1
            className="font-bold tracking-tight mb-2 text-gray-900"
            style={{
              fontSize: `calc(${headerStyle.fontSize} * 1.5)`,
              lineHeight: 1.2,
            }}
          >
            {basics.name}
          </h1>

          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-gray-600 mt-3">
            {basics.mobile && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 opacity-70" /> {basics.mobile}
              </span>
            )}
            {basics.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 opacity-70" /> {basics.email}
              </span>
            )}
            {basics.wechat && (
              <span className="flex items-center gap-1.5">
                <span className="font-bold text-xs opacity-70">WX</span>{' '}
                {basics.wechat}
              </span>
            )}
            {/* Optional: Add Link/Github if in data schema later */}
          </div>
        </header>
      </InteractiveSection>

      {/* Dynamic Sections */}
      {config.order.map((key) => {
        if (config.hidden.includes(key)) return null
        const section = sectionMap[key]
        return section ? <div key={key}>{section}</div> : null
      })}
    </div>
  )
}
