import { ResumeData } from '@/lib/types/resume-schema'

export function generateMarkdown(resumeData: ResumeData): string {
  if (!resumeData) return ''

  let md = `# ${resumeData.basics.name}\n\n`
  md += `${resumeData.basics.mobile || ''} | ${
    resumeData.basics.email || ''
  }\n\n`

  if (resumeData.basics.summary) {
    md += `## 个人总结\n${resumeData.basics.summary}\n\n`
  }

  if (resumeData.workExperiences?.length > 0) {
    md += `## 工作经历\n`
    resumeData.workExperiences.forEach((item) => {
      md += `### ${item.company} | ${item.position} (${item.startDate} - ${item.endDate})\n`
      md += `${item.description}\n\n`
    })
  }

  if (resumeData.projectExperiences?.length > 0) {
    md += `## 项目经历\n`
    resumeData.projectExperiences.forEach((item) => {
      md += `### ${item.projectName} | ${item.role} (${item.startDate} - ${item.endDate})\n`
      md += `${item.description}\n\n`
    })
  }

  if (resumeData.educations?.length > 0) {
    md += `## 教育经历\n`
    resumeData.educations.forEach((item) => {
      md += `### ${item.school} | ${item.major} (${item.startDate} - ${item.endDate})\n`
      md += `${item.degree}\n\n`
    })
  }

  if (resumeData.skills) {
    md += `## 技能特长\n${resumeData.skills}\n\n`
  }

  if (resumeData.certificates) {
    md += `## 证书奖项\n${resumeData.certificates}\n\n`
  }

  if (resumeData.hobbies) {
    md += `## 兴趣爱好\n${resumeData.hobbies}\n\n`
  }

  if (resumeData.customSections?.length > 0) {
    md += `## 自定义板块\n`
    resumeData.customSections.forEach((item) => {
      md += `### ${item.title}\n`
      md += `${item.description}\n\n`
    })
  }

  return md
}
