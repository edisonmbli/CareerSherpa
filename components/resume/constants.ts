// Import existing templates
import standardThumb from '@/assets/images/templates/standard.png'
import technicalThumb from '@/assets/images/templates/technical.png'
import productThumb from '@/assets/images/templates/product.png'
import creativeThumb from '@/assets/images/templates/creative.png'
import corporateThumb from '@/assets/images/templates/corporate.png'
import professionalThumb from '@/assets/images/templates/professional.png'
import darkSidebarThumb from '@/assets/images/templates/darkSidebar.png'
import elegantThumb from '@/assets/images/templates/elegant.png'

// Template metadata - name/description come from i18n dictionary (dict.resume.templates[id])
export const RESUME_TEMPLATES = [
  { id: 'standard', thumbnail: standardThumb },
  { id: 'technical', thumbnail: technicalThumb },
  { id: 'product', thumbnail: productThumb },
  { id: 'creative', thumbnail: creativeThumb },
  { id: 'corporate', thumbnail: corporateThumb },
  { id: 'professional', thumbnail: professionalThumb },
  { id: 'darkSidebar', thumbnail: darkSidebarThumb },
  { id: 'elegant', thumbnail: elegantThumb },
] as const

export type TemplateId = (typeof RESUME_TEMPLATES)[number]['id']

