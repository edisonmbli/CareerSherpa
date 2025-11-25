const dict = {
  workbench_title: 'Career Shaper · Workbench',
  lang_label: 'Language',
  resume_label: 'Resume (text/pdf)',
  detailed_label: 'Detailed Resume (text/pdf)',
  jd_label: 'Job Description (text/image)',
  submit_resume: 'Upload Resume',
  submit_detailed: 'Upload Detailed',
  submit_jd: 'Upload JD',
  create_service: 'Create Service',
  // Namespaced additions (backward compatible)
  designSystem: {
    title: 'Design System',
    sections: {
      buttonsBadges: 'Buttons & Badges',
      alerts: 'Alerts',
      formControls: 'Form Controls',
      typography: 'Typography',
      colorSurface: 'Color & Surface',
      cardSpacing: 'Card Spacing',
      feedback: 'Non-blocking Feedback',
      primaryDemo: 'Primary Interaction Demo',
      fileSupport: 'File Support',
    },
    samples: {
      typography: {
        h1: 'Page/Card Title Level Sample',
        h2: 'Secondary Title Level Sample',
        body: 'Body paragraph sample with relaxed line-height for readability.',
        muted: 'Muted description text for cards and inputs.',
      },
      colors: {
        pageBackground: 'Page Background',
        cardBackground: 'Card Background',
        primary: 'Primary',
        muted: 'Muted',
      },
      spacing: {
        cardInner: 'Use p-6 inside to keep breathing room',
        cardBetween: 'Use gap-8 between cards; prefer space over borders',
      },
      feedback: {
        showInfo: 'Show Info',
        showSuccess: 'Show Success',
        showWarning: 'Show Warning',
        showError: 'Show Error',
        infoTitle: 'Info',
        successTitle: 'Success',
        warningTitle: 'Warning',
        errorTitle: 'Error',
        infoDesc: 'General information message',
        successDesc: 'Operation succeeded (non-blocking)',
        warningDesc: 'Queue or rate limit notice (non-blocking)',
        errorDesc: 'Task failed, coins refunded',
      },
      primary: {
        default: 'Primary Button',
        focus: 'Focus-visible',
        disabled: 'Disabled',
      },
      pdfNotice:
        'Only text-based PDFs are supported for now; scanned/image PDFs are not supported.',
    },
  },
  workbench: {
    new: {
      title: 'Job Match Analysis',
      description: 'Paste JD text or upload a screenshot to start matching',
      or: 'or',
      button: 'Start Analysis',
      placeholderText:
        'Paste JD text or upload a screenshot to start matching.',
      uploadCta: 'Upload JD screenshot',
      selectedFile: 'Selected file:',
      noFile: 'No file chosen',
      segmentedPaste: 'Paste text',
      segmentedUpload: 'Upload screenshot',
      imageTooLarge: 'Image size exceeds 3MB',
      jobTextTooLong: 'Text length exceeds 8000 characters',
      quickTipsLabel: 'Quick tips',
      quickTips: [
        {
          title: 'Analyze backend JD',
          hint: 'API design, DB schema, scaling',
          text: 'Please analyze this backend JD focusing on API design, database schema, and scalability requirements.',
        },
        {
          title: 'Frontend role',
          hint: 'React, state, perf',
          text: 'Please analyze this frontend JD focusing on React expertise, state management, and performance optimizations.',
        },
        {
          title: 'Data position',
          hint: 'ETL, SQL, ML basics',
          text: 'Please analyze this data JD focusing on ETL pipelines, SQL proficiency, and basic ML knowledge.',
        },
        {
          title: 'Infra role',
          hint: 'CI/CD, cloud, observability',
          text: 'Please analyze this infra JD focusing on CI/CD, cloud services, and observability tools.',
        },
      ],
      emptyTitle: 'Start with JD',
      emptyDesc:
        'Paste responsibilities or upload a screenshot to begin matching.',
      prerequisite: {
        title: 'Prerequisite',
        description:
          'Please upload your general resume on Profile and wait until parsing completes',
        button: 'Go to Profile',
      },
      prerequisiteError: 'Please upload your general resume first',
      inputError: 'Enter JD text or upload an image',
      freeQueueHint: 'Insufficient coins, task moved to free queue',
      serverError: 'Failed to create service',
    },
    tabs: {
      match: 'Step 1: Match',
      customize: 'Step 2: Customize',
      interview: 'Step 3: Interview',
    },
    customize: {
      start: 'Generate Customized Resume',
      diffTitle: 'Differences (Original vs Revised)',
      saveSuccess: 'Saved',
      saveFailed: 'Save failed',
      exportPdf: 'Export PDF',
      saveButton: 'Save changes',
      editTab: 'Edit Markdown',
      previewTab: 'Preview PDF',
      templateLabel: 'Export template',
    },
    interviewUi: {
      start: 'Generate Interview Tips',
    },
    statusText: {
      ocrPending: 'Extracting text from screenshot...',
      summaryPending: 'Summarizing job details...',
      matchStreaming: 'Matching analysis streaming...',
      matchCompleted: 'Matching analysis completed',
      failed: 'Task failed',
      retryMatch: 'Retry Match',
      summaryCompletedToast: 'Job summary completed',
      summaryFailedDetail: 'LLM job summary failed',
      match_failed: 'Job match analysis failed',
      retryFailed: 'Retry failed',
      previous_ocr_failed: 'Previous OCR failed',
      previous_summary_failed: 'Previous job summary failed',
      previous_model_limit: 'Model context/length exceeded',
      job_summary_missing: 'Missing job summary, cannot match',
      enqueue_failed: 'Failed to enqueue task, try later',
    },
  },
  profile: {
    title: 'Profile',
    tabs: { assets: 'Experience', billing: 'Billing/Top-up' },
    resume: {
      title: 'General Resume',
      description:
        'Foundation for AI analysis. All services depend on this file.',
      note: '',
    },
    detailed: {
      title: 'Detailed Resume',
      description:
        'Richer context can significantly improve AI output quality.',
      note: '',
    },
    uploader: {
      button: 'Upload',
      buttonProcessing: 'Uploading...',
      status: { pending: 'Parsing', completed: 'Completed', failed: 'Failed' },
      toast: {
        uploadSuccess: 'Uploaded, parsing started',
        queueFree: 'Insufficient coins, task moved to free queue',
        queueError: 'Service busy, please try later',
        pollSuccess: 'Parsing completed',
        pollFailed: 'Parsing failed, coins refunded',
      },
      preview: 'Preview',
      reupload: 'Re-upload',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',
      suggestionTextResume:
        'We recommend keeping the resume text under ~8000 characters for better parsing stability.',
      suggestionTextDetailed:
        'We recommend keeping the detailed resume text under ~10000 characters for better parsing stability.',
      processingMarquee: 'Model is processing',
      etaMarqueeMinTemplate: 'Estimated {minutes} min remaining',
      lastUpdatedLabel: 'Last updated',
      timeline: {
        uploaded: 'Uploaded',
        queued: 'Queued',
        parsing: 'Parsing',
        finalizing: 'Finalizing',
        completed: 'Completed',
        failed: 'Failed',
      },
      placeholderHintResume:
        'Only text-based PDF; ~8000 chars recommended; images not supported',
      placeholderHintDetailed:
        'Only text-based PDF; ~10000 chars recommended; images not supported',
    },
    billing: {
      cardTitle: 'Billing',
      recharge: { title: 'Top-up', desc: 'Feature under development' },
      waitlist: {
        title: 'Top-up coming soon',
        desc: 'Leave your email and we will notify you once available',
      },
      table: {
        type: 'Type',
        service: 'Service',
        taskId: 'Task ID',
        status: 'Status',
        delta: 'Delta',
        balance: 'Balance',
        time: 'Time',
      },
      type: {
        SIGNUP_BONUS: 'Signup Bonus',
        PURCHASE: 'Purchase',
        SERVICE_DEBIT: 'Service Debit',
        FAILURE_REFUND: 'Failure Refund',
        MANUAL_ADJUST: 'Manual Adjust',
      },
      typeShort: {
        SIGNUP_BONUS: 'Bonus',
        PURCHASE: 'Top-up',
        SERVICE_DEBIT: 'Debit',
        FAILURE_REFUND: 'Refund',
        MANUAL_ADJUST: 'Adjust',
      },
      status: {
        PENDING: 'Pending',
        SUCCESS: 'Success',
        FAILED: 'Failed',
        REFUNDED: 'Refunded',
      },
      templates: {
        resume_summary: 'Resume Summary',
        detailed_resume_summary: 'Detailed Resume Summary',
        job_summary: 'Job Summary',
        job_match: 'Match Analysis',
        resume_customize: 'Resume Customize',
        interview_prep: 'Interview Prep',
      },
      toast: { copied: 'Copied', copyAria: 'Copy' },
      empty: {
        title: 'No billing records',
        desc: 'After running a service (summary, customize, interview), you will see transaction details here.',
        cta: 'Go upload a resume',
      },
      pagination: {
        prev: 'Prev',
        next: 'Next',
        page: 'Page {page}/{pages}',
        total: 'Total {total}',
      },
      filters: {
        title: 'Filters',
        toggle: 'Filter',
        type: 'Type',
        status: 'Status',
        template: 'Service',
        date: 'Date',
        clear: 'Clear',
        apply: 'Apply',
        today: 'Today',
        last7: 'Last 7 days',
        last30: 'Last 30 days',
        last90: 'Last 90 days',
        clearDate: 'Clear date',
      },
      common: { cancel: 'Close' },
    },
    previewLabels: {
      previewTitle: 'Resume Preview',
      header: 'Header',
      summary: 'Summary',
      summaryPoints: 'Summary Points',
      specialties: 'Specialties',
      experience: 'Experience',
      projects: 'Projects',
      education: 'Education',
      skills: 'Skills',
      certifications: 'Certifications',
      languages: 'Languages',
      awards: 'Awards',
      openSource: 'Open Source',
      extras: 'Extras',
      stack: 'Stack',
    },
    quota: {
      title: 'Coins',
      description: 'Recharge is coming soon',
      coins: 'coins',
    },
    waitlist: {
      emailPlaceholder: 'you@example.com',
      submit: 'Notify me',
      invalidEmail: 'Invalid email',
      success: 'Added to waitlist',
      failed: 'Submission failed',
    },
  },
  header: {
    brand: 'CareerShaper',
    signIn: 'Sign in',
    myAccount: 'My Account',
    accountSettings: 'Account Settings',
    cvAssets: 'CV Assets',
    coinsBilling: 'Coins & Billing',
  },
  account: {
    title: 'Account Settings',
    common: { save: 'Save', openBuiltIn: 'Open built-in settings page' },
    profile: {
      title: 'Profile',
      displayName: 'Display name',
      avatarUrl: 'Avatar URL',
      setAvatar: 'Set avatar',
    },
    email: {
      title: 'Email',
      update: 'Update email',
      note: 'Updating email may require verification.',
    },
    password: {
      title: 'Password',
      current: 'Current password',
      new: 'New password',
      confirm: 'Confirm password',
      update: 'Update password',
    },
    shortcuts: {
      open: 'Open',
      profileName: { title: 'User name', desc: 'Change your display name' },
      profileAvatar: {
        title: 'Upload avatar',
        desc: 'Set your profile picture',
      },
      email: {
        title: 'Set email',
        desc: 'Manage primary email and verification',
      },
      password: {
        title: 'Update password',
        desc: 'Change your account password',
      },
    },
  },
  landing: {
    seo: {
      title: 'AI Job Assistant | Match · Customize · Interview',
      description:
        'Paste JD, upload resume, and get higher-match interviews in three steps: match analysis, resume customization, and interview tips.',
    },
    hero: {
      title: 'AI Job Assistant — Get higher-match interviews in 3 steps',
      subtitle: 'Match analysis · Resume customization · Interview key points',
      cta: 'Start Free Trial (8 coins)',
    },
    valueProps: {
      items: [
        {
          title: 'Match Analysis',
          description:
            'Score and explain fit against your target JD with clear, structured output.',
        },
        {
          title: 'Resume Customization',
          description: 'Generate a JD-specific resume you can edit and export.',
        },
        {
          title: 'Interview Tips',
          description:
            'Get tailored intro and key points to prepare effectively.',
        },
      ],
    },
    howItWorks: {
      features: [
        {
          title: 'Async & Queue',
          description:
            'QStash + Redis ensure reliable async processing and fair queues.',
        },
        {
          title: 'RAG Knowledge',
          description:
            'Retrieval-augmented prompts inject proven job hunting guidance.',
        },
        {
          title: 'Streaming',
          description:
            'SSE streams results for minimal perceived latency on core tasks.',
        },
      ],
    },
    faq: {
      items: [
        {
          q: 'How is my data stored?',
          a: 'Resumes and outputs are stored in Neon Postgres. Sensitive content is protected and never logged.',
        },
        {
          q: 'Mobile support?',
          a: 'Responsive layout ensures a smooth mobile experience with proper async states.',
        },
        {
          q: 'Coins & payment?',
          a: 'You start with free coins. Purchasing options will be added; tasks refund coins on failure.',
        },
      ],
    },
    cta: {
      title: 'Ready to get started?',
      button: 'Start Free Trial',
    },
  },
}
export default dict
