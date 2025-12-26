import { ResumeData } from '@/lib/types/resume-schema'
import { nanoid } from 'nanoid'

export const MOCK_RESUME_DATA: ResumeData = {
  basics: {
    lang: 'zh',
    name: '张三',
    mobile: '13800138000',
    email: 'zhangsan@example.com',
    wechat: 'zhangsan_wx',
    qq: '12345678',
    summary:
      '拥有 5 年全栈开发经验，精通 React 和 Node.js。擅长构建高性能 Web 应用，具备良好的团队协作和沟通能力。热衷于探索新技术，追求代码质量和用户体验。',
  },
  educations: [
    {
      id: 'edu-1',
      school: '北京科技大学',
      major: '计算机科学与技术',
      degree: '本科',
      startDate: '2015-09',
      endDate: '2019-06',
      description:
        '主修课程：数据结构、操作系统、计算机网络、数据库原理等。\n曾获得校级一等奖学金。',
    },
  ],
  workExperiences: [
    {
      id: 'work-1',
      company: '某知名互联网公司',
      position: '高级前端工程师',
      industry: '互联网/电商',
      startDate: '2021-07',
      endDate: '至今',
      description:
        '负责公司核心电商平台的前端开发与维护。\n主导了首页性能优化项目，首屏加载时间减少 40%。\n设计并实现了通用的组件库，提升了团队开发效率 30%。\n指导初级工程师，进行代码审查和技术分享。',
    },
    {
      id: 'work-2',
      company: '某初创科技公司',
      position: '前端开发工程师',
      industry: '企业服务/SaaS',
      startDate: '2019-07',
      endDate: '2021-06',
      description:
        '参与了公司 CRM 系统的从 0 到 1 的开发。\n独立负责了数据可视化模块，基于 ECharts 实现了复杂的报表展示。\n配合后端完成了 API 接口的设计与对接。',
    },
  ],
  projectExperiences: [
    {
      id: 'proj-1',
      projectName: '企业级低代码平台',
      role: '核心开发',
      startDate: '2022-03',
      endDate: '2022-12',
      description:
        '基于 React 和 Nest.js 构建的低代码开发平台。\n负责了可视化拖拽编辑器的核心逻辑实现。\n实现了组件的动态加载和属性配置功能。\n项目上线后，支持了公司内部 20+ 个业务系统的快速搭建。',
    },
  ],
  skills:
    '前端：HTML5, CSS3, JavaScript (ES6+), TypeScript, React, Vue, Next.js, Tailwind CSS\n后端：Node.js, Nest.js, Prisma, PostgreSQL\n工具：Git, Docker, Webpack, Vite',
  certificates: '英语六级 (CET-6)\nPMP 项目管理专业人士认证',
  hobbies: '阅读技术博客\n徒步旅行\n摄影',
  customSections: [
    {
      id: 'custom-1',
      title: '开源贡献',
      description:
        '积极参与开源社区，为多个知名项目提交过 PR。\n维护了一个 star 数 500+ 的 React 组件库。',
    },
  ],
}

export function generateMockResume(): ResumeData {
  // Return a deep copy to avoid mutation issues during testing
  // Use nanoid to generate new IDs if needed, but here we return static mock data.
  // If dynamic IDs are needed, we can map over arrays.
  const data = JSON.parse(JSON.stringify(MOCK_RESUME_DATA))
  return data
}
