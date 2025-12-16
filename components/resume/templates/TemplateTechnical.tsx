import { ResumeData, SectionConfig } from '@/lib/types/resume-schema'
import { renderDescription, formatDate } from './utils'

interface TemplateProps {
  data: ResumeData
  config: SectionConfig
}

export function TemplateTechnical({ data, config }: TemplateProps) {
  const { basics } = data
  
  const sectionMap: Record<string, React.ReactNode> = {
    basics: null, 
    summary: basics.summary && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Summary</h3>
        <p className="text-xs leading-relaxed text-gray-800">{basics.summary}</p>
      </section>
    ),
    skills: data.skills && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Skills</h3>
        <div className="text-xs text-gray-800">
          {renderDescription(data.skills)}
        </div>
      </section>
    ),
    workExperiences: data.workExperiences?.length > 0 && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Experience</h3>
        <div className="space-y-3">
          {data.workExperiences.map((item) => (
            <div key={item.id}>
              <div className="flex justify-between items-baseline">
                <h4 className="font-bold text-sm text-gray-900">{item.company}</h4>
                <span className="text-xs text-gray-600 font-mono">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-700 mb-1">{item.position}</div>
              <div className="text-xs text-gray-800">
                {renderDescription(item.description)}
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    projectExperiences: data.projectExperiences?.length > 0 && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Projects</h3>
        <div className="space-y-3">
          {data.projectExperiences.map((item) => (
            <div key={item.id}>
               <div className="flex justify-between items-baseline">
                <h4 className="font-bold text-sm text-gray-900">{item.projectName}</h4>
                <span className="text-xs text-gray-600 font-mono">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
                </span>
              </div>
              {item.role && <div className="text-xs font-semibold text-gray-700 mb-1">{item.role}</div>}
              <div className="text-xs text-gray-800">
                {renderDescription(item.description)}
              </div>
            </div>
          ))}
        </div>
      </section>
    ),
    educations: data.educations?.length > 0 && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Education</h3>
        <div className="space-y-2">
          {data.educations.map((item) => (
            <div key={item.id} className="flex justify-between items-baseline">
              <div>
                <span className="font-bold text-sm text-gray-900">{item.school}</span>
                <span className="text-xs text-gray-700 ml-2">
                   {item.major} {item.degree && `(${item.degree})`}
                </span>
              </div>
              <span className="text-xs text-gray-600 font-mono">
                  {formatDate(item.startDate)} - {formatDate(item.endDate)}
              </span>
            </div>
          ))}
        </div>
      </section>
    ),
    certificates: data.certificates && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Certificates</h3>
        <div className="text-xs text-gray-800">{renderDescription(data.certificates)}</div>
      </section>
    ),
    hobbies: data.hobbies && (
      <section className="mb-4">
        <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">Interests</h3>
        <div className="text-xs text-gray-800">{renderDescription(data.hobbies)}</div>
      </section>
    ),
    customSections: data.customSections?.length > 0 && (
      <>
        {data.customSections.map((item) => (
          <section key={item.id} className="mb-4">
            <h3 className="text-sm font-bold text-gray-900 border-b border-gray-300 mb-2 uppercase">{item.title}</h3>
            <div className="text-xs text-gray-800">{renderDescription(item.description)}</div>
          </section>
        ))}
      </>
    )
  }

  return (
    <div className="font-sans text-gray-900 p-6 h-full bg-white">
      {/* Header: Compact Top Bar */}
      <header className="mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex justify-between items-end">
          <h1 className="text-2xl font-bold uppercase tracking-tight">{basics.name}</h1>
          <div className="text-right text-xs space-y-1">
            {basics.email && <div>{basics.email}</div>}
            {basics.mobile && <div>{basics.mobile}</div>}
            <div className="flex gap-2 justify-end">
               {basics.wechat && <span>WX: {basics.wechat}</span>}
               {basics.qq && <span>QQ: {basics.qq}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* Sections */}
      <div className="grid grid-cols-1 gap-2">
        {config.order.map(key => {
          if (config.hidden.includes(key)) return null
          return sectionMap[key]
        })}
      </div>
    </div>
  )
}
