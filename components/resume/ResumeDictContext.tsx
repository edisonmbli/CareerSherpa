'use client'

import { createContext, useContext, type ReactNode } from 'react'

// Type for resume dictionary - matches structure in lib/i18n/en.ts and zh.ts
export interface ResumeDict {
  templates: Record<string, { name: string; description: string }>
  editor: {
    title: string
    selectTemplate: string
    templateDesc: string
    resetConfirm: string
    resetDesc: string
    resetCancel: string
    resetButton: string
    structure: string
    editResume: string
    selectAction: string
    customSectionTitle: string
    markdownTip: string
  }
  sections: Record<string, string>
  forms: {
    addWork: string
    addProject: string
    addEducation: string
    addCustom: string
    newWork: string
    newProject: string
    newEducation: string
    newCustom: string
    position: string
    role: string
    major: string
    projectName: string
    projectDesc: string
    workContent: string
    skillsLabel: string
    skillsPlaceholder: string
    companyName: string
    startDate: string
    endDate: string
    schoolName: string
    degree: string
    present: string
    dateFormat: string
    description: string
    sectionTitle: string
    sectionContent: string
    backToList: string
    eduAchievements: string
    scrollHint: string
    githubLink: string
    demoLink: string
    titleLanguage: string
    selectLanguage: string
    coreInfo: string
    avatar: string
    changeAvatar: string
    avatarHint: string
    avatarSizeLimit: string
    name: string
    namePlaceholder: string
    address: string
    addressPlaceholder: string
    phone: string
    email: string
    socialLinks: string
    summaryPlaceholder: string
    pageBreak: string
    pageBreakDesc: string
    certificatesPlaceholder: string
    hobbiesPlaceholder: string
    aiSuggestionTitle: string
    aiSuggestionIntro: string
    noSuggestions: string
    editContent: string
  }
  social: {
    website: string
  }
  toolbar: {
    chapters: string
    template: string
    style: string
    reset: string
    export: string
    exportPdf: string
    exportMd: string
    exportPdfDesc: string
    exportMdDesc: string
    copied: string
    aiSuggestions: string
    aiDesc: string
    themeColor: string
    colorPicker: string
    font: string
    compactMode: string
    proportionalScale: string
    proportionalTip: string
    masterScale: string
    masterScaleTip: string
    fontSize: string
    lineHeight: string
    itemSpacing: string
    sectionSpacing: string
    pageMargin: string
    resetConfirm: string
    resetDesc: string
    cancel: string
    confirmReset: string
    menuTitle: string
    menuDesc: string
    editContent: string
    switchTemplate: string
    exportResume: string
    resetContent: string
    backToMenu: string
    selectExportFormat: string
    copyFailed: string
  }
  share: {
    button: string
    header: {
      title: string
      description: string
    }
    toggle: {
      enableTitle: string
      enableDesc: string
      disableTitle: string
      disableDesc: string
    }
    validity: {
      label: string
      placeholder: string
      options: {
        days7: string
        days30: string
        permanent: string
      }
    }
    link: {
      label: string
      preview: string
      expired: string
      expiresAt: string
    }
    actions: {
      create: string
      renew: string
    }
    feedback: {
      copyTooltip: string
      copySuccess: string
      saveSuccess: string
      createSuccess: string
      disableSuccess: string
      loadFailed: string
      actionFailed: string
    }
    public: {
      bannerText: string
      cta: string
      footerText: string
      printFooter: string
      metaTitle: string
      metaDesc: string
    }
  }
  tips: {
    noSuggestions: string
    suggestionIntro: string
  }
}

// Default English dictionary for fallback
const defaultDict: ResumeDict = {
  templates: {
    standard: { name: 'Standard', description: 'Classic & clean' },
    technical: { name: 'Technical', description: 'Compact & efficient' },
    product: { name: 'Product/Ops', description: 'Logic-driven' },
    creative: { name: 'Creative', description: 'Stylish layout' },
    corporate: { name: 'Corporate', description: 'Professional & stable' },
    professional: { name: 'Professional', description: 'Two-column' },
    darkSidebar: { name: 'Dark Sidebar', description: 'Bold visual' },
    elegant: { name: 'Modern Elegant', description: 'Fresh layout' },
  },
  editor: {
    title: 'Resume Content',
    selectTemplate: 'Select Template',
    templateDesc: 'All templates support A4 print and PDF export',
    resetConfirm: 'Confirm Reset Resume?',
    resetDesc: 'This will restore the resume to the AI-generated version.',
    resetCancel: 'Cancel',
    resetButton: 'Reset',
    structure: 'Resume Structure',
    editResume: 'Edit Resume',
    selectAction: 'Select an action to adjust your resume',
    customSectionTitle: 'Custom section title',
    markdownTip: '💡 Supports bold, italic, and other Markdown formatting.',
  },
  sections: {
    basics: 'Basic Info',
    summary: 'Professional Summary',
    workExperiences: 'Work Experience',
    projectExperiences: 'Projects',
    educations: 'Education',
    skills: 'Skills',
    certificates: 'Certifications',
    hobbies: 'Interests',
    customSections: 'Others',
  },
  forms: {
    addWork: 'Add Work Experience',
    addProject: 'Add Project',
    addEducation: 'Add Education',
    addCustom: 'Add Custom Section',
    newWork: 'New Work Experience',
    newProject: 'New Project',
    newEducation: 'New Education',
    newCustom: 'New Custom Section',
    position: 'Position',
    role: 'Role',
    major: 'Major',
    projectName: 'Project Name',
    projectDesc: 'Project Description',
    workContent: 'Work Content',
    skillsLabel: 'Skills',
    skillsPlaceholder: 'List your core skills...',
    companyName: 'Company Name',
    startDate: 'Start Date',
    endDate: 'End Date',
    schoolName: 'School Name',
    degree: 'Degree',
    present: 'Present',
    dateFormat: 'YYYY-MM',
    description: 'Description',
    sectionTitle: 'Section Title',
    sectionContent: 'Content',
    backToList: 'Back to list',
    eduAchievements: 'Achievements/Awards',
    scrollHint: 'Scroll down for more',
    githubLink: 'GitHub Link (optional)',
    demoLink: 'Demo/Portfolio Link (optional)',
    titleLanguage: 'Title Language',
    selectLanguage: 'Select Language',
    coreInfo: 'Core Information',
    avatar: 'Avatar',
    changeAvatar: 'Change',
    avatarHint: 'Supports jpg/png',
    avatarSizeLimit: 'Image size cannot exceed 2MB',
    name: 'Name',
    namePlaceholder: 'Your name',
    address: 'Address',
    addressPlaceholder: 'e.g. Beijing, China',
    phone: 'Phone',
    email: 'Email',
    socialLinks: 'Social Links',
    summaryPlaceholder: 'Briefly describe your core strengths...',
    pageBreak: 'Insert page break',
    pageBreakDesc: 'Force new page after this content',
    certificatesPlaceholder: 'List your certificates or awards...',
    hobbiesPlaceholder: 'List your hobbies and interests...',
    aiSuggestionTitle: 'Optimization Suggestions',
    aiSuggestionIntro:
      'Based on your resume analysis, here are optimization suggestions.',
    noSuggestions: 'No suggestions yet, please generate resume first',
    editContent: 'Edit Content',
  },
  social: {
    website: 'Personal Website',
  },
  toolbar: {
    chapters: 'Chapters',
    template: 'Template',
    style: 'Style',
    reset: 'Reset',
    export: 'Export',
    exportPdf: 'Export as PDF',
    exportMd: 'Export as Markdown',
    exportPdfDesc: 'For printing and submitting',
    exportMdDesc: 'Click to copy content',
    copied: 'Copied ✅',
    aiSuggestions: 'AI Suggestions',
    aiDesc: 'Get targeted suggestions and optimization plans',
    themeColor: 'Theme Color',
    colorPicker: 'Color Picker',
    font: 'Font',
    compactMode: 'Compact',
    proportionalScale: 'Proportional',
    proportionalTip:
      'When enabled, adjusting any style parameter will proportionally affect others',
    masterScale: 'Master Scale',
    masterScaleTip:
      'Drag this slider to proportionally adjust all style parameters below',
    fontSize: 'Font Size (ratio)',
    lineHeight: 'Line Height',
    itemSpacing: 'Item Spacing (px)',
    sectionSpacing: 'Section Spacing (px)',
    pageMargin: 'Page Margin (mm)',
    resetConfirm: 'Reset resume?',
    resetDesc:
      'This will clear all your edits and restore to the AI-generated version. This cannot be undone.',
    cancel: 'Cancel',
    confirmReset: 'Confirm Reset',
    menuTitle: 'Editor Menu',
    menuDesc: 'Select an action to adjust your resume',
    editContent: 'Edit Content',
    switchTemplate: 'Switch Template',
    exportResume: 'Export Resume',
    resetContent: 'Reset Content',
    backToMenu: 'Back',
    selectExportFormat: 'Select export format',
    copyFailed: 'Copy failed, please copy manually',
  },
  share: {
    button: 'Share',
    header: {
      title: 'Share Custom Resume',
      description:
        'Create a public link to share with recruiters or on social media.',
    },
    toggle: {
      enableTitle: 'Enable public sharing',
      enableDesc: 'This link is inactive. Visitors will see a 404 page.',
      disableTitle: 'Disable public sharing',
      disableDesc:
        'Currently active. Anyone with the link can view this resume.',
    },
    validity: {
      label: 'Validity',
      placeholder: 'Select validity period',
      options: {
        days7: '7 days (default)',
        days30: '30 days',
        permanent: 'Never expires',
      },
    },
    link: {
      label: 'Share link',
      preview: 'Open preview',
      expired: 'Expired',
      expiresAt: 'Valid until',
    },
    actions: {
      create: 'Generate link',
      renew: 'Renew',
    },
    feedback: {
      copyTooltip: 'Copy link',
      copySuccess: 'Link copied',
      saveSuccess: 'Share settings updated',
      createSuccess: 'Share link generated',
      disableSuccess: 'Sharing disabled',
      loadFailed: 'Failed to load, please try again',
      actionFailed: 'Action failed',
    },
    public: {
      bannerText: 'This resume was generated by CareerShaper AI',
      cta: 'Create Yours',
      footerText: 'Powered by CareerShaper AI',
      printFooter: 'Generated by CareerShaper AI',
      metaTitle: 'Professional Resume - CareerShaper',
      metaDesc: 'View this professional resume created with AI.',
    },
  },
  tips: {
    noSuggestions: 'No suggestions yet, please generate resume first',
    suggestionIntro:
      'Based on your resume content and target position analysis, here are optimization suggestions.',
  },
}

const ResumeDictContext = createContext<ResumeDict>(defaultDict)

export function ResumeDictProvider({
  dict,
  children,
}: {
  dict?: ResumeDict | undefined
  children: ReactNode
}) {
  return (
    <ResumeDictContext.Provider value={dict || defaultDict}>
      {children}
    </ResumeDictContext.Provider>
  )
}

export function useResumeDict(): ResumeDict {
  return useContext(ResumeDictContext)
}
