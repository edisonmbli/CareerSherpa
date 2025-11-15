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
      pdfNotice: 'Only text-based PDFs are supported for now; scanned/image PDFs are not supported.',
    },
  },
  workbench: {
    title: 'Workbench',
  },
  profile: {
    title: 'Profile',
    tabs: { assets: 'Job Assets', billing: 'Coins & Billing' },
    resume: {
      title: 'General Resume (required)',
      description: 'Foundation for AI analysis. All services depend on this file.',
    },
    detailed: {
      title: 'Detailed Resume (recommended)',
      description: 'Richer context can significantly improve AI output quality.',
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
    },
    quota: { title: 'Coins', description: 'Recharge is coming soon', coins: 'coins' },
    waitlist: { emailPlaceholder: 'you@example.com', submit: 'Notify me' },
  },
}
export default dict
