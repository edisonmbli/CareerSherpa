export const RESUME_TEMPLATES = [
  {
    id: 'standard',
    name: '标准通用',
    description: '经典简洁 - 适合大多数场景',
    thumbnail: '/images/templates/standard.png',
  },
  {
    id: 'technical',
    name: '技术极客',
    description: '紧凑高效 - 极客、工程师、架构师',
    thumbnail: '/images/templates/technical.png',
  },
  {
    id: 'product',
    name: '产品/运营',
    description: '逻辑导向 - 产品经理、数据运营、增长黑客',
    thumbnail: '/images/templates/technical.png',
  },
  {
    id: 'creative',
    name: '创意设计',
    description: '时尚排版 - UI/UX 设计师、视觉设计师、前端切图仔',
    thumbnail: '/images/templates/creative.png',
  },
  {
    id: 'corporate',
    name: '企业蓝调',
    description: '稳重专业 - 传统国企/外企、金融分析师、法务',
    thumbnail: '/images/templates/corporate.png',
  },
  {
    id: 'professional',
    name: '商务专业',
    description: '双栏布局 - 咨询顾问、四大会计师、项目经理',
    thumbnail: '/images/templates/professional.png',
  },
  {
    id: 'darkSidebar',
    name: '深色侧栏',
    description:
      '强视觉冲击 - 新媒体运营、独立摄影师、个人品牌持有者、市场营销',
    thumbnail: '/images/templates/darkSidebar.png',
  },
  {
    id: 'elegant',
    name: '现代优雅',
    description: '清新排版 - 文案策划、品牌公关、艺术策展人、奢侈品管理',
    thumbnail: '/images/templates/elegant.png',
  },
] as const

export type TemplateId = (typeof RESUME_TEMPLATES)[number]['id']
