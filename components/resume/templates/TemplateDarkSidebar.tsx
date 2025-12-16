'use client'

import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { renderDescription, formatDate } from './utils'
import { Mail, Phone } from 'lucide-react'

interface TemplateProps {
  data: ResumeData
  config: SectionConfig
}

export function TemplateDarkSidebar({ data, config }: TemplateProps) {
  const { basics } = data

  const sidebarSections = ['skills', 'educations', 'certificates', 'hobbies']

  const renderSection = (key: string, isSidebar: boolean) => {
    if (config.hidden.includes(key)) return null

    const headerClass = isSidebar 
      ? "text-lg font-bold text-white mb-4 uppercase tracking-widest border-b border-gray-700 pb-2"
      : "text-xl font-bold text-gray-900 mb-4 uppercase tracking-wide border-b-2 border-gray-900 pb-2"

    const textClass = isSidebar ? "text-gray-300 text-sm leading-relaxed" : "text-gray-700 text-sm leading-relaxed"
    const subHeaderClass = isSidebar ? "text-white font-semibold" : "text-gray-900 font-bold text-lg"
    const dateClass = isSidebar ? "text-gray-400 text-xs block mt-1" : "text-gray-600 text-sm font-medium"
    const companyClass = isSidebar ? "text-gray-300 text-sm" : "text-gray-800 font-semibold mb-2"

    switch (key) {
      case 'summary':
        return basics.summary && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>职业摘要</h3>
            <p className={textClass + " whitespace-pre-line"}>{basics.summary}</p>
          </section>
        )
      case 'workExperiences':
        return data.workExperiences?.length > 0 && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>工作经历</h3>
            <div className="space-y-6">
              {data.workExperiences.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className={subHeaderClass}>{item.position}</h4>
                    <span className={dateClass}>
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </span>
                  </div>
                  <div className={companyClass}>{item.company}</div>
                  <div className={textClass}>
                    {renderDescription(item.description)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      case 'projectExperiences':
        return data.projectExperiences?.length > 0 && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>项目经历</h3>
            <div className="space-y-6">
              {data.projectExperiences.map((item) => (
                <div key={item.id}>
                  <div className="flex justify-between items-baseline mb-1">
                    <h4 className={subHeaderClass}>{item.projectName}</h4>
                    <span className={dateClass}>
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                    </span>
                  </div>
                  {item.role && <div className="text-gray-700 font-medium mb-1 text-sm">{item.role}</div>}
                  <div className={textClass}>
                    {renderDescription(item.description)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      case 'educations':
        return data.educations?.length > 0 && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>教育经历</h3>
            <div className="space-y-4">
              {data.educations.map((item) => (
                <div key={item.id}>
                  <div className={subHeaderClass}>{item.school}</div>
                  <div className={isSidebar ? "text-gray-300 text-sm" : "text-gray-700"}>
                    {item.major} {item.degree && `| ${item.degree}`}
                  </div>
                  <span className={dateClass}>
                      {formatDate(item.startDate)} - {formatDate(item.endDate)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )
      case 'skills':
        return data.skills && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>技能特长</h3>
            <div className={textClass}>
              {renderDescription(data.skills)}
            </div>
          </section>
        )
      case 'certificates':
        return data.certificates && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>证书奖项</h3>
            <div className={textClass}>
              {renderDescription(data.certificates)}
            </div>
          </section>
        )
      case 'hobbies':
        return data.hobbies && (
          <section key={key} className="mb-8">
            <h3 className={headerClass}>兴趣爱好</h3>
            <div className={textClass}>
              {renderDescription(data.hobbies)}
            </div>
          </section>
        )
      case 'customSections':
        return data.customSections?.length > 0 && (
          <>
            {data.customSections.map((item) => (
              <section key={item.id} className="mb-8">
                <h3 className={headerClass}>{item.title}</h3>
                <div className={textClass}>
                  {renderDescription(item.description)}
                </div>
              </section>
            ))}
          </>
        )
      default:
        return null
    }
  }

  return (
    <div className="flex h-full bg-white font-sans min-h-[297mm]">
      {/* Dark Sidebar */}
      <aside className="w-[32%] bg-slate-900 text-white p-8 flex flex-col">
        {/* Photo Area */}
        <div className="w-32 h-32 mx-auto bg-gray-700 rounded-full mb-8 flex items-center justify-center border-4 border-gray-600">
           <span className="text-xs text-gray-400">Photo</span>
        </div>

        {/* Contact Info */}
        <div className="mb-10 space-y-3 text-sm">
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-4 border-b border-gray-700 pb-2">联系方式</h3>
           {basics.mobile && (
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-gray-400" /> 
              <span className="text-gray-200">{basics.mobile}</span>
            </div>
          )}
          {basics.email && (
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-gray-400" /> 
              <span className="text-gray-200 break-all">{basics.email}</span>
            </div>
          )}
           {basics.wechat && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-gray-400 w-4 text-center">WX</span>
              <span className="text-gray-200">{basics.wechat}</span>
            </div>
          )}
        </div>

        {/* Sidebar Sections */}
        <div className="flex-1">
          {config.order
            .filter(key => sidebarSections.includes(key))
            .map(key => renderSection(key, true))}
        </div>
      </aside>

      {/* Main Content */}
      <main className="w-[68%] p-10 bg-white text-gray-900">
        <header className="mb-10">
           <h1 className="text-5xl font-bold text-slate-900 tracking-tight mb-2">{basics.name}</h1>
           {/* Summary could also go here if preferred */}
        </header>

         {/* Main Sections */}
         {config.order
            .filter(key => !sidebarSections.includes(key) && key !== 'basics')
            .map(key => renderSection(key, false))}
      </main>
    </div>
  )
}
