export const RESUME_TEMPLATES = [
  {
    id: 'standard',
    name: '标准通用',
    description: '经典简洁，适合大多数岗位',
    thumbnail: '/images/templates/standard.png',
  },
  {
    id: 'professional',
    name: '商务专业',
    description: '双栏布局，适合产品、运营、管理岗',
    thumbnail: '/images/templates/professional.png',
  },
  {
    id: 'technical',
    name: '技术极客',
    description: '紧凑高效，适合研发、技术岗',
    thumbnail: '/images/templates/technical.png',
  },
  {
    id: 'corporate',
    name: '企业蓝调',
    description: '稳重专业，适合国企、传统行业',
    thumbnail: '/images/templates/corporate.png',
  },
  {
    id: 'elegant',
    name: '现代优雅',
    description: '清新排版，适合文职、教育、服务业',
    thumbnail: '/images/templates/elegant.png',
  },
  {
    id: 'darkSidebar',
    name: '深色侧栏',
    description: '强视觉冲击，适合创意、咨询行业',
    thumbnail: '/images/templates/darkSidebar.png',
  },
  {
    id: 'creative',
    name: '创意设计',
    description: '时尚排版，适合设计、市场、媒体岗',
    thumbnail: '/images/templates/creative.png',
  },
] as const

export type TemplateId = (typeof RESUME_TEMPLATES)[number]['id']
