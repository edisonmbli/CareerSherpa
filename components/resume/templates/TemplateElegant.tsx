'use client'

import { useState, useEffect } from 'react'
import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { renderDescription, formatDate } from './utils'
import { Mail, Phone } from 'lucide-react'

interface TemplateProps {
  data: ResumeData
  config: SectionConfig
}

export function TemplateElegant({ data, config }: TemplateProps) {
  const { basics } = data
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768)
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const renderSection = (key: string) => {
    if (config.hidden.includes(key)) return null

    switch (key) {
      case 'summary':
        return (
          basics.summary && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b-2 border-teal-500 inline-block">
                职业摘要
              </h3>
              <p className="text-sm text-gray-600 leading-loose whitespace-pre-line">
                {basics.summary}
              </p>
            </section>
          )
        )
      case 'workExperiences':
        return (
          data.workExperiences?.length > 0 && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-1 border-b-2 border-teal-500 inline-block">
                工作经历
              </h3>
              <div className="space-y-6">
                {data.workExperiences.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-lg text-gray-900">
                        {item.company}
                      </h4>
                      <span className="text-sm text-gray-500 italic">
                        {formatDate(item.startDate)} -{' '}
                        {formatDate(item.endDate)}
                      </span>
                    </div>
                    <div className="text-md font-medium text-teal-700 mb-2">
                      {item.position}
                    </div>
                    {renderDescription(item.description)}
                  </div>
                ))}
              </div>
            </section>
          )
        )
      case 'projectExperiences':
        return (
          data.projectExperiences?.length > 0 && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-1 border-b-2 border-teal-500 inline-block">
                项目经历
              </h3>
              <div className="space-y-6">
                {data.projectExperiences.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-gray-900">
                        {item.projectName}
                      </h4>
                      <span className="text-sm text-gray-500 italic">
                        {formatDate(item.startDate)} -{' '}
                        {formatDate(item.endDate)}
                      </span>
                    </div>
                    {item.role && (
                      <div className="text-sm font-medium text-teal-700 mb-2">
                        {item.role}
                      </div>
                    )}
                    {renderDescription(item.description)}
                  </div>
                ))}
              </div>
            </section>
          )
        )
      case 'educations':
        return (
          data.educations?.length > 0 && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-4 pb-1 border-b-2 border-teal-500 inline-block">
                教育经历
              </h3>
              <div className="space-y-4">
                {data.educations.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start border-l-2 border-gray-200 pl-4"
                  >
                    <div>
                      <div className="font-bold text-gray-900">
                        {item.school}
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.major} {item.degree && `| ${item.degree}`}
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )
        )
      case 'skills':
        return (
          data.skills && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b-2 border-teal-500 inline-block">
                技能特长
              </h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                {renderDescription(data.skills)}
              </div>
            </section>
          )
        )
      case 'certificates':
        return (
          data.certificates && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b-2 border-teal-500 inline-block">
                证书奖项
              </h3>
              <div className="text-sm text-gray-600">
                {renderDescription(data.certificates)}
              </div>
            </section>
          )
        )
      case 'hobbies':
        return (
          data.hobbies && (
            <section key={key} className="mb-8">
              <h3 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b-2 border-teal-500 inline-block">
                兴趣爱好
              </h3>
              <div className="text-sm text-gray-600">
                {renderDescription(data.hobbies)}
              </div>
            </section>
          )
        )
      case 'customSections':
        return (
          data.customSections?.length > 0 && (
            <>
              {data.customSections.map((item) => (
                <section key={item.id} className="mb-8">
                  <h3 className="text-lg font-bold text-gray-800 mb-3 pb-1 border-b-2 border-teal-500 inline-block">
                    {item.title}
                  </h3>
                  <div className="text-sm text-gray-600">
                    {renderDescription(item.description)}
                  </div>
                </section>
              ))}
            </>
          )
        )
      default:
        return null
    }
  }

  return (
    <div className="font-serif text-gray-800 bg-white h-full w-full p-10 relative overflow-hidden">
      {/* Decorative Circle Top Right */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-teal-50 rounded-full z-0"></div>

      {/* Header */}
      <header className="relative z-10 flex justify-between items-start mb-12 border-b border-gray-200 pb-6">
        <div className="flex-1">
          <h1
            className={`${
              isMobile ? 'text-3xl' : 'text-5xl'
            } font-bold text-gray-900 mb-4`}
          >
            {basics.name}
          </h1>
          <div className="flex flex-wrap gap-6 text-sm text-gray-600">
            {basics.mobile && (
              <span className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-teal-600" /> {basics.mobile}
              </span>
            )}
            {basics.email && (
              <span className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-teal-600" /> {basics.email}
              </span>
            )}
            {basics.wechat && (
              <span className="flex items-center gap-2">
                <span className="font-bold text-teal-600 text-xs border border-teal-600 rounded px-1">
                  WX
                </span>{' '}
                {basics.wechat}
              </span>
            )}
          </div>
        </div>

        {/* Optional Photo Placeholder if we had one */}
        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center text-gray-300 border-4 border-white shadow-lg">
          <span className="text-xs">Photo</span>
        </div>
      </header>

      <div className="relative z-10">
        {config.order.map((key) => {
          if (config.hidden.includes(key) || key === 'basics') return null
          return renderSection(key)
        })}
      </div>
    </div>
  )
}
