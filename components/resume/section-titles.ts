export const SECTION_TITLES = {
  basics: { en: 'Basic Info', zh: '基本信息' },
  summary: { en: 'Professional Summary', zh: '个人总结' },
  workExperiences: { en: 'Work Experience', zh: '工作经历' },
  projectExperiences: { en: 'Projects', zh: '项目经历' },
  educations: { en: 'Education', zh: '教育背景' },
  skills: { en: 'Skills', zh: '技能特长' },
  certificates: { en: 'Certifications', zh: '证书奖项' },
  hobbies: { en: 'Interests', zh: '兴趣爱好' },
  customSections: { en: 'Others', zh: '其他板块' },
} as const

export type SectionKey = keyof typeof SECTION_TITLES
