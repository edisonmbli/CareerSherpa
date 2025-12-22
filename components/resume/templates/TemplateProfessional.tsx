import { useState, useEffect } from 'react'
import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { renderDescription, formatDate } from './utils'
import { Mail, Phone, MapPin } from 'lucide-react'

interface TemplateProps {
  data: ResumeData
  config: SectionConfig
}

export function TemplateProfessional({ data, config }: TemplateProps) {
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

  // Define main content sections and sidebar sections
  const sidebarSections = ['skills', 'educations', 'certificates', 'hobbies']
  const mainSections = [
    'summary',
    'workExperiences',
    'projectExperiences',
    'customSections',
  ]

  const renderSection = (key: string) => {
    if (config.hidden.includes(key)) return null

    switch (key) {
      case 'summary':
        return (
          basics.summary && (
            <section key={key} className="mb-6">
              <h3 className="text-lg font-bold text-blue-800 mb-2 uppercase">
                个人总结
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                {basics.summary}
              </p>
            </section>
          )
        )
      case 'workExperiences':
        return (
          data.workExperiences?.length > 0 && (
            <section key={key} className="mb-6">
              <h3 className="text-lg font-bold text-blue-800 mb-3 uppercase border-b border-blue-200 pb-1">
                工作经历
              </h3>
              <div className="space-y-5">
                {data.workExperiences.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-gray-900 text-base">
                        {item.position}
                      </h4>
                      <span className="text-xs text-gray-500 font-medium">
                        {formatDate(item.startDate)} -{' '}
                        {formatDate(item.endDate)}
                      </span>
                    </div>
                    <div className="text-sm text-blue-600 font-medium mb-2">
                      {item.company}
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
              <h3 className="text-lg font-bold text-blue-800 mb-3 uppercase border-b border-blue-200 pb-1">
                项目经历
              </h3>
              <div className="space-y-5">
                {data.projectExperiences.map((item) => (
                  <div key={item.id}>
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-bold text-gray-900">
                        {item.projectName}
                      </h4>
                      <span className="text-xs text-gray-500 font-medium">
                        {formatDate(item.startDate)} -{' '}
                        {formatDate(item.endDate)}
                      </span>
                    </div>
                    {item.role && (
                      <div className="text-sm text-blue-600 font-medium mb-2">
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
              <h3 className="text-md font-bold text-gray-900 mb-3 uppercase">
                教育经历
              </h3>
              <div className="space-y-4">
                {data.educations.map((item) => (
                  <div key={item.id}>
                    <div className="font-bold text-gray-800">{item.school}</div>
                    <div className="text-sm text-gray-600 mb-1">
                      {item.major} {item.degree && `| ${item.degree}`}
                    </div>
                    <div className="text-xs text-gray-500 mb-2">
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </div>
                    {item.description && (
                      <div className="text-xs text-gray-600">
                        {renderDescription(item.description)}
                      </div>
                    )}
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
              <h3 className="text-md font-bold text-gray-900 mb-3 uppercase">
                技能特长
              </h3>
              <div className="text-sm text-gray-700">
                {renderDescription(data.skills)}
              </div>
            </section>
          )
        )
      case 'certificates':
        return (
          data.certificates && (
            <section key={key} className="mb-6">
              <h3 className="text-md font-bold text-gray-900 mb-3 uppercase">
                证书奖项
              </h3>
              <div className="text-sm text-gray-700">
                {renderDescription(data.certificates)}
              </div>
            </section>
          )
        )
      case 'hobbies':
        return (
          data.hobbies && (
            <section key={key} className="mb-6">
              <h3 className="text-md font-bold text-gray-900 mb-3 uppercase">
                兴趣爱好
              </h3>
              <div className="text-sm text-gray-700">
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
                <section key={item.id} className="mb-6">
                  <h3 className="text-lg font-bold text-blue-800 mb-3 uppercase border-b border-blue-200 pb-1">
                    {item.title}
                  </h3>
                  {renderDescription(item.description)}
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
    <div className="flex h-full bg-white text-gray-800 w-full">
      {/* Left Sidebar */}
      <aside className="w-1/3 bg-gray-100 p-8 border-r border-gray-200">
        {/* Contact Info in Sidebar */}
        <div className="mb-8">
          {basics.mobile && (
            <div className="flex items-center gap-2 text-sm mb-2">
              <Phone className="h-4 w-4 text-blue-600" /> {basics.mobile}
            </div>
          )}
          {basics.email && (
            <div className="flex items-center gap-2 text-sm mb-2">
              <Mail className="h-4 w-4 text-blue-600" /> {basics.email}
            </div>
          )}
          {basics.wechat && (
            <div className="flex items-center gap-2 text-sm mb-2">
              <span className="font-bold text-xs text-blue-600 w-4 text-center">
                WX
              </span>{' '}
              {basics.wechat}
            </div>
          )}
        </div>

        {/* Sidebar Sections */}
        {config.order
          .filter((key) => sidebarSections.includes(key))
          .map((key) => renderSection(key))}
      </aside>

      {/* Main Content */}
      <main className="w-2/3 p-8">
        <header className="mb-8">
          <h1
            className={`${
              isMobile ? 'text-2xl' : 'text-4xl'
            } font-bold text-gray-900 mb-2`}
          >
            {basics.name}
          </h1>
          {basics.summary && !config.order.includes('summary') && (
            <p className="text-gray-600 text-sm leading-relaxed">
              {basics.summary}
            </p>
          )}
        </header>

        {/* Main Sections */}
        {config.order
          .filter((key) => !sidebarSections.includes(key) && key !== 'basics')
          .map((key) => renderSection(key))}
      </main>
    </div>
  )
}
