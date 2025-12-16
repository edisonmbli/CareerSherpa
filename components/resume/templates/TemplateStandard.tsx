import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { renderDescription, formatDate } from './utils'
import { Mail, Phone, Link as LinkIcon, Github, MapPin } from 'lucide-react'

interface TemplateProps {
  data: ResumeData
  config: SectionConfig
}

export function TemplateStandard({ data, config }: TemplateProps) {
  const { basics } = data
  
  const sectionMap: Record<string, React.ReactNode> = {
    basics: null, // Rendered separately in header
    summary: basics.summary && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-2 pb-1 uppercase tracking-wide">个人总结</h3>
        <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">{basics.summary}</p>
      </section>
    ),
    workExperiences: data.workExperiences?.length > 0 && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-3 pb-1 uppercase tracking-wide">工作经历</h3>
        <div className="space-y-4">
          {data.workExperiences.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between items-baseline mb-1">
                <h4 className="font-bold text-gray-900">{item.company}</h4>
                <span className="text-sm text-gray-600 font-medium">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </span>
              </div>
              <div className="text-sm font-semibold text-gray-800 mb-1">{item.position}</div>
              {renderDescription(item.description)}
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: data.projectExperiences?.length > 0 && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-3 pb-1 uppercase tracking-wide">项目经历</h3>
        <div className="space-y-4">
          {data.projectExperiences.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between items-baseline mb-1">
                <h4 className="font-bold text-gray-900">{item.projectName}</h4>
                <span className="text-sm text-gray-600 font-medium">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </span>
              </div>
              {item.role && <div className="text-sm font-semibold text-gray-800 mb-1">{item.role}</div>}
              {renderDescription(item.description)}
            </div>
          ))}
        </div>
      </section>
    ),
    educations: data.educations?.length > 0 && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-3 pb-1 uppercase tracking-wide">教育经历</h3>
        <div className="space-y-3">
          {data.educations.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between items-baseline">
                <h4 className="font-bold text-gray-900">{item.school}</h4>
                <span className="text-sm text-gray-600 font-medium">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </span>
              </div>
              <div className="text-sm text-gray-800">
                {item.major} {item.degree && `| ${item.degree}`}
              </div>
              {item.description && <div className="mt-1">{renderDescription(item.description)}</div>}
            </div>
          ))}
        </div>
      </section>
    ),
    skills: data.skills && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-2 pb-1 uppercase tracking-wide">技能特长</h3>
        {renderDescription(data.skills)}
      </section>
    ),
    certificates: data.certificates && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-2 pb-1 uppercase tracking-wide">证书奖项</h3>
        {renderDescription(data.certificates)}
      </section>
    ),
    hobbies: data.hobbies && (
      <section className="mb-6">
        <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-2 pb-1 uppercase tracking-wide">兴趣爱好</h3>
        {renderDescription(data.hobbies)}
      </section>
    ),
    customSections: data.customSections?.length > 0 && (
      <>
        {data.customSections.map((item) => (
          <section key={item.id} className="mb-6">
            <h3 className="text-lg font-bold border-b-2 border-gray-800 mb-2 pb-1 uppercase tracking-wide">{item.title}</h3>
            {renderDescription(item.description)}
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="font-serif text-gray-900 p-8 h-full bg-white">
      {/* Header */}
      <header className="text-center mb-8 border-b-2 border-gray-900 pb-6">
        <h1 className="text-3xl font-bold uppercase tracking-wider mb-2">{basics.name}</h1>
        {basics.summary && !config.order.includes('summary') && (
             <p className="text-sm text-gray-600 mb-3 max-w-2xl mx-auto">{basics.summary}</p>
        )}
        <div className="flex flex-wrap justify-center gap-4 text-sm text-gray-600">
          {basics.mobile && (
            <span className="flex items-center gap-1">
              <Phone className="h-3 w-3" /> {basics.mobile}
            </span>
          )}
          {basics.email && (
            <span className="flex items-center gap-1">
              <Mail className="h-3 w-3" /> {basics.email}
            </span>
          )}
          {basics.wechat && (
             <span className="flex items-center gap-1">
               <span className="font-bold text-xs">WX</span> {basics.wechat}
             </span>
          )}
           {basics.qq && (
             <span className="flex items-center gap-1">
               <span className="font-bold text-xs">QQ</span> {basics.qq}
             </span>
          )}
        </div>
      </header>

      {/* Dynamic Sections */}
      {config.order.map(key => {
        if (config.hidden.includes(key)) return null
        const section = sectionMap[key]
        return section ? <div key={key}>{section}</div> : null
      })}
    </div>
  )
}
