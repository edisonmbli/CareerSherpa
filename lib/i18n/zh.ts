const dict = {
  workbench_title: 'Career Shaper · 工作台',
  lang_label: '语言',
  resume_label: '简历（文本/PDF）',
  detailed_label: '详细履历（文本/PDF）',
  jd_label: '岗位描述（文本/图片）',
  submit_resume: '上传简历',
  submit_detailed: '上传详细履历',
  submit_jd: '上传 JD',
  create_service: '创建服务',
  // 命名空间结构（保持兼容）
  designSystem: {
    title: '设计系统',
    sections: {
      buttonsBadges: '按钮与徽章',
      alerts: '提示与警告',
      formControls: '表单控件',
      typography: '排版（Typography）',
      colorSurface: '色彩与表面（Color & Surface）',
      cardSpacing: '卡片间距（Card Spacing）',
      feedback: '非阻塞反馈（Toaster）',
      primaryDemo: 'Primary 可交互演示',
      fileSupport: '文件支持说明',
    },
    samples: {
      typography: {
        h1: '页面/卡片大标题层级示例',
        h2: '次级标题层级示例',
        body: '这是正文段落示例，行距放宽以保证可读性。',
        muted: '这是辅助描述文本，用于卡片说明与输入提示。',
      },
      colors: {
        pageBackground: '页面背景',
        cardBackground: '卡片背景',
        primary: '主色（Primary）',
        muted: '辅助（Muted）',
      },
      spacing: {
        cardInner: '卡片内部使用 p-6 保持呼吸感',
        cardBetween: '卡片之间使用 gap-8，分隔优先用空间',
      },
      feedback: {
        showInfo: '显示信息',
        showSuccess: '显示成功',
        showWarning: '显示提醒',
        showError: '显示错误',
        infoTitle: '信息',
        successTitle: '成功',
        warningTitle: '提醒',
        errorTitle: '错误',
        infoDesc: '通用信息提示',
        successDesc: '操作成功反馈（非阻塞）',
        warningDesc: '队列或限流提示（非阻塞）',
        errorDesc: '任务失败，金币已返还',
      },
      primary: {
        default: '主按钮',
        focus: '焦点可视（focus-visible）',
        disabled: '禁用态',
      },
      pdfNotice: '目前仅支持文本型 PDF，扫描件/图片暂不支持；请上传含文本内容的 PDF。',
    },
  },
  workbench: {
    title: '工作台',
  },
  profile: {
    title: '个人主页',
    tabs: { assets: '求职资产', billing: '金币与账单' },
    resume: {
      title: '个人通用简历（必选）',
      description: '这是 AI 分析的基础，后续所有服务均依赖此文件。',
    },
    detailed: {
      title: '个人详细履历（推荐）',
      description: '提供更丰富的上下文，可显著提升 AI 输出质量。',
    },
    uploader: {
      button: '上传',
      buttonProcessing: '上传中...',
      status: { pending: '解析中', completed: '已完成', failed: '失败' },
      toast: {
        uploadSuccess: '上传成功，已开始解析',
        queueFree: '金币不足，已转入免费队列',
        queueError: '当前服务忙，请稍候再试',
        pollSuccess: '解析完成',
        pollFailed: '解析失败，金币已返还',
      },
    },
    quota: { title: '金币', description: '金币充值功能正在开发中', coins: '枚' },
    waitlist: { emailPlaceholder: 'you@example.com', submit: '上线后通知我' },
  },
}
export default dict
