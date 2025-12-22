'use client'

import { useState, useEffect } from 'react'
import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { renderDescription, formatDate } from './utils'
import { Mail, Phone, MapPin } from 'lucide-react'

interface TemplateProps {
  data: ResumeData
  config: SectionConfig
}

export function TemplateCorporate({ data, config }: TemplateProps) {
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
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-3 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                职业摘要
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed px-2 whitespace-pre-line">
                {basics.summary}
              </p>
            </section>
          )
        )
      case 'workExperiences':
        return (
          data.workExperiences?.length > 0 && (
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-4 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                工作经历
              </h3>
              <div className="space-y-5 px-2">
                {data.workExperiences.map((item) => (
                  <div
                    key={item.id}
                    className="relative border-l border-gray-200 pl-4 ml-1"
                  >
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-blue-600 border-2 border-white shadow-sm"></div>
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-gray-900 text-base">
                        {item.company}
                      </h4>
                      <span className="text-sm text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded">
                        {formatDate(item.startDate)} -{' '}
                        {formatDate(item.endDate)}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-blue-700 mb-2">
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
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-4 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                项目经历
              </h3>
              <div className="space-y-5 px-2">
                {data.projectExperiences.map((item) => (
                  <div
                    key={item.id}
                    className="relative border-l border-gray-200 pl-4 ml-1"
                  >
                    <div className="absolute -left-[21px] top-1 h-3 w-3 rounded-full bg-gray-400 border-2 border-white"></div>
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className="font-bold text-gray-900">
                        {item.projectName}
                      </h4>
                      <span className="text-sm text-gray-600 font-medium bg-gray-100 px-2 py-0.5 rounded">
                        {formatDate(item.startDate)} -{' '}
                        {formatDate(item.endDate)}
                      </span>
                    </div>
                    {item.role && (
                      <div className="text-sm font-bold text-blue-700 mb-2">
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
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-3 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                教育经历
              </h3>
              <div className="space-y-3 px-2">
                {data.educations.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start"
                  >
                    <div>
                      <div className="font-bold text-gray-900">
                        {item.school}
                      </div>
                      <div className="text-sm text-gray-700">
                        {item.major} {item.degree && `| ${item.degree}`}
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
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
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-3 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                技能特长
              </h3>
              <div className="px-2">{renderDescription(data.skills)}</div>
            </section>
          )
        )
      case 'certificates':
        return (
          data.certificates && (
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-3 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                证书奖项
              </h3>
              <div className="px-2">{renderDescription(data.certificates)}</div>
            </section>
          )
        )
      case 'hobbies':
        return (
          data.hobbies && (
            <section key={key} className="mb-6">
              <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-3 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                兴趣爱好
              </h3>
              <div className="px-2">{renderDescription(data.hobbies)}</div>
            </section>
          )
        )
      case 'customSections':
        return (
          data.customSections?.length > 0 && (
            <>
              {data.customSections.map((item) => (
                <section key={item.id} className="mb-6">
                  <h3 className="bg-blue-50 text-blue-800 font-bold py-1 px-3 mb-3 border-l-4 border-blue-600 uppercase text-sm tracking-wider">
                    {item.title}
                  </h3>
                  <div className="px-2">
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
    <div className="font-sans text-gray-900 bg-white h-full w-full">
      {/* Header */}
      <header className="bg-blue-600 text-white p-8 mb-8 shadow-md">
        <div className="flex justify-between items-center">
          <div>
            <h1
              className={`${
                isMobile ? 'text-2xl' : 'text-4xl'
              } font-bold mb-2 tracking-wide`}
            >
              {basics.name}
            </h1>
            <div className="flex gap-4 text-sm text-blue-100">
              {basics.mobile && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" /> {basics.mobile}
                </span>
              )}
              {basics.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" /> {basics.email}
                </span>
              )}
            </div>
          </div>
          {/* Optional: Add photo placeholder or summary if space allows */}
          <div className="text-right text-sm text-blue-100 space-y-1">
            {basics.wechat && <div>WX: {basics.wechat}</div>}
            {basics.qq && <div>QQ: {basics.qq}</div>}
          </div>
        </div>
      </header>

      <div className="px-8 pb-8">
        {config.order.map((key) => {
          if (config.hidden.includes(key) || key === 'basics') return null
          return renderSection(key)
        })}
      </div>
    </div>
  )
}
