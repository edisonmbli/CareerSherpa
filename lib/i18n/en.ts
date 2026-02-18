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
  rag: {
    match_job_analysis:
      'How to analyze {{title}} position recruiting intent and core requirements',
    match_resume_fit:
      'How to find the fit between resume and {{title}} position',
    customize_general:
      'Resume optimization best practices and professional expressions',
    customize_role:
      '{{title}} position-specific resume optimization suggestions',
    interview_self_intro:
      'How to prepare self-introduction for {{title}} position (P-P-F structure)',
    interview_strategies:
      '{{title}} position interview strategies, STAR story structure, and defense scripts',
  },
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
  worker: {
    preMatch: {
      auditing: 'Simulating HR Review...',
      reportTitle: '【Pre-Match Risk Audit Report (Bad Cop Findings)】',
      overallLevel: 'Overall Risk Level',
      summary: 'Audit Summary',
      fatalRisks: 'Fatal Risks Identified',
    },
  },
  workbench: {
    sidebar: {
      expand: 'Expand',
      collapse: 'Collapse',
      newService: 'New Service',
      myCv: 'My CV',
      coins: 'Coins',
      backToWorkbench: 'Back to Workbench',
      menu: 'Menu',
      openMenu: 'Open menu',
      sidebarDrawer: 'Sidebar drawer',
      history: 'History',
      creating: 'Creating...',
      expandMore: 'Expand to see more',
      noHistory: 'No history yet',
      loadMore: 'Load more',
    },
    new: {
      title: 'Job Match Analysis',
      description:
        'Analyze match between uploaded resume and job description, and suggest outreach pitch lines',
      or: 'or',
      button: 'Start Matching',
      placeholderText:
        'Paste the job description (text) here, or drag in a JD screenshot.',
      uploadCta: 'Upload JD screenshot',
      selectedFile: 'Selected file:',
      noFile: 'No file chosen',
      segmentedPaste: 'Paste text',
      segmentedUpload: 'Upload screenshot',
      imageTooLarge: 'Image too large, please upload ≤1MB',
      imageCompressFailed: 'Image compression failed, please try again',
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
      freeQueueTitle: 'Entered FREE queue',
      freeQueueDesc:
        'Insufficient coins. Task will run in FREE queue. Suggest topping up for better results.',
      freeQueueHint:
        'Insufficient coins, task moved to free queue. Suggest topping up for better/faster results.',
      serverError: 'Failed to create service',
      rateLimited: 'Multiple tasks in progress, please try again later',
    },
    toast: {
      freeQueueTitle: 'Entered FREE queue',
      freeQueueDesc:
        'Insufficient coins. Task will run in FREE queue. Consider topping up.',
      lockedTitle: 'Locked: please click "Customize Resume" in Step 1',
    },
    tabs: {
      match: 'Match',
      customize: 'Customize',
      interview: 'Interview',
    },
    customize: {
      start: 'Customize Resume',
      diffTitle: 'Differences (Original vs Revised)',
      original: 'Original:',
      revised: 'Revised:',
      saveSuccess: 'Saved',
      saveFailed: 'Save failed',
      createFailed: 'Failed to start customization',
      exportPdf: 'Export PDF',
      saveButton: 'Save changes',
      editTab: 'Edit Markdown',
      previewTab: 'Preview PDF',
      templateLabel: 'Export template',
    },
    analysis: {
      resumeTweak: 'Resume Tweak',
      interviewPrep: 'Interview Prep',
    },
    resultCard: {
      title: 'Analysis Results',
      loading: 'Analyzing...',
      empty: 'No analysis results',
      matchScore: 'Match Score',
      overallAssessment: 'Overall Assessment',
      highlights: 'Highlights',
      gapsAndSuggestions: 'Gaps & Suggestions',
      smartPitch: {
        label: 'Smart Pitch',
        copyTooltip: 'Copy Content',
        cleanCopied: 'Clean text copied',
        definitions: {
          hook: 'Hook: Grab attention',
          value: 'Value: Showcase fit',
          cta: 'CTA: Call-to-Action',
        },
      },
      definitions: {
        structure: 'Structure:',
        clickToCopy: 'Click to copy text',
      },
      highlyMatched: 'Highly Matched',
      goodFit: 'Good Fit',
      lowMatch: 'Low Match',
      targetCompany: 'Target Company',
      targetPosition: 'Target Position',
      noHighlights: 'No highlights found.',
      noGaps: 'No gaps detected.',
      tip: 'Tip',
      expertVerdict: 'Expert Verdict',
      recommendations: 'Recommendations',
    },
    interviewUi: {
      start: 'Interview Drill',
      ready: 'Interview tips generated, loading…',
      readyDesc:
        'Generate personalized interview Q&A and tips based on the job match analysis',
      backToTop: 'Back to Top',
      toc: 'Contents',
    },
    interviewBattlePlan: {
      title: 'Interview Battle Plan',
      print: 'Print',
      copy: 'Copy All',
      copied: 'Copied',
      regenerate: 'Regenerate',
      // Radar Module
      radar: {
        title: 'Intel Radar',
        coreChallenges: 'Core Challenges',
        challenge: 'Challenge',
        whyImportant: 'Why Important',
        yourAngle: 'Your Approach',
        interviewRounds: 'Interview Rounds',
        round: 'Round {round}',
        focus: 'Focus Areas',
        hiddenRequirements: 'Hidden Requirements',
      },
      // Hook Module
      hook: {
        title: 'Opening Hook',
        ppfScript: 'P-P-F Self-Intro Script',
        keyHooks: 'Key Hooks',
        hook: 'Hook',
        evidenceSource: 'Source',
        deliveryTips: 'Delivery Tips',
      },
      // Evidence Module
      evidence: {
        title: 'Core Evidence',
        storyTitle: 'Story Title',
        storyLabel: 'Story',
        storyCount: '{count} stories',
        matchedPainPoint: 'Matched JD Pain Point',
        situation: 'Situation',
        task: 'Task',
        action: 'Action',
        result: 'Result',
        impact: 'Quantified Impact',
        source: 'Source',
        sourceResume: 'Resume',
        sourceDetailedResume: 'Detailed Resume',
      },
      // Defense Module
      defense: {
        title: 'Weakness Drills',
        weakness: 'Weakness',
        anticipatedQuestion: 'Anticipated Question',
        defenseScript: 'Defense Script',
        supportingEvidence: 'Supporting Evidence',
        weaknessCount: '{count} weaknesses',
      },
      // Reverse Module
      reverse: {
        title: 'Question Arsenal',
        question: 'Question',
        askIntent: 'Intent',
        listenFor: 'Listen For',
      },
      knowledgeRefresh: {
        title: 'Knowledge Refresh',
      },
    },
    statusText: {
      analyzing: 'AI is analyzing...',
      analyzingDesc:
        'Analyzing your profile against the JD and applying professional resume writing strategies. This usually takes 1～2 minutes.',
      failed: 'Task failed',
      retryMatch: 'Retry Match',
      summaryCompletedToast: 'Job summary completed',
      summaryFailedDetail: 'LLM job summary failed',
      retryFailed: 'Retry failed',
      previous_ocr_failed: 'Previous OCR failed',
      previous_summary_failed: 'Previous job summary failed',
      previous_model_limit: 'Model context/length exceeded',
      model_too_busy: 'Model too busy, please try again later',
      job_summary_missing: 'Missing job summary, cannot match',
      enqueue_failed: 'Failed to enqueue task, try later',
      // User-centric rate limit messages
      daily_limit: 'Daily free quota exhausted',
      frequency_limit: 'Too many requests! Take a short coffee break ☕️',
      readyToCustomize: 'Ready to Customize',
      readyToCustomizeDesc:
        'Click "Start Customization" below to generate a tailored resume based on the job description.',
      CUSTOMIZE_STARTING: 'Starting resume customization...',
      CUSTOMIZE_STARTING_DESC:
        'Request submitted. Allocating compute resources.',
      CUSTOMIZE_PENDING: 'Customizing resume...',
      CUSTOMIZE_PENDING_DESC:
        'Analyzing requirements and rewriting your resume content.',
      // Interview states
      INTERVIEW_STARTING: 'Starting interview tips task...',
      INTERVIEW_STARTING_DESC:
        'Request submitted. Allocating compute resources.',
      INTERVIEW_PENDING: 'Generating interview battle card...',
      INTERVIEW_PENDING_DESC:
        'Synthesizing match results and resume highlights into tailored Q&A and strategies.',
      INTERVIEW_LOADING: 'Loading interview battle card...',
      INTERVIEW_LOADING_DESC:
        'Content is ready. Formatting and polishing, please wait.',
      INTERVIEW_STREAMING: 'Generating personalized interview advice...',
      INTERVIEW_COMPLETED: 'Interview prep completed!',
      INTERVIEW_COMPLETED_WISH: 'Wishing you success in your job search!',
      INTERVIEW_FAILED: 'Interview tips generation failed',
      INTERVIEW_FAILED_DESC: 'Coins refunded, please retry',
      INTERVIEW_FAILED_DESC_FREE: 'Free model is busy, please retry later',
      INTERVIEW_FAILED_DESC_PAID: 'Coins refunded, please retry',
      loading: 'Loading...',
      loadingDesc: 'Loading data, please wait...',
    },
    notification: {
      freeModeTitle: 'Current Free Experience Mode',
      freeModeDesc:
        'We recommend topping up to unlock Thinking Mode for deeper customization. Free mode uses basic models.',
      cancel: 'Cancel',
      confirmFree: 'Continue with Free Mode',
      rateLimitedTitle: 'Request Rate Limited',
      rateLimitedDesc:
        'System is busy, please try again later. Consider topping up for higher priority.',
      dailyLimitDesc: 'Top up to unlock deeper professional services.',
      serverErrorTitle: 'Service Unavailable',
      serverErrorDesc:
        'Encountered an unexpected interruption, please try again later.',
    },
    streamPanel: {
      ocr: 'OCR Extraction',
      summary: 'Job Summary',
      match: 'Match Analysis',
      vision: 'Job Extraction',
      preMatch: 'HR Review',
      init: 'Initializing',
      waiting: 'Waiting',
      error: 'Task Failed',
      waitingOcr: 'Waiting for OCR...',
      waitingSummary: 'Waiting for Job Summary...',
      waitingMatch: 'Analyzing match degree at full speed, please wait...',
      waitingVision: 'Extracting job information...',
      waitingPreMatch: 'HR review in progress...',
      waitingDefault: 'Waiting for task to start...',
      analyzing: 'Analyzing Job...',
      analyzingMatch: 'Analyzing match degree...',
      matchPending: 'Match analysis task queued, please wait...',
      errorDefault: 'Task execution failed, please retry',
    },
    statusConsole: {
      paid: 'PAID',
      free: 'FREE',
      seconds: 's ago',
      minutes: 'm ago',
      jobVisionQueued: 'Job extraction task queued',
      ocrQueued: 'OCR task queued',
      summaryQueued: 'Job summary task queued',
      prematchQueued: 'HR review task queued',
      matchQueued: 'Match analysis task queued',
      ocrPending: 'Extracting text from image...',
      ocrCompleted: 'OCR Extraction Completed',
      summaryInit: 'Preparing job summary...',
      summaryPending: 'Extracting job details...',
      summaryCompleted: 'Job Details Extracted',
      matchPending: 'Analyzing match degree...',
      matchStreaming: 'Analyzing match degree...',
      matchCompleted: 'Match Analysis Completed',
      ocrFailed: 'OCR Extraction Failed',
      summaryFailed: 'Job Summary Extraction Failed',
      matchFailed: 'Match Analysis Failed',
      customizeStarting: 'Starting customization service...',
      customizePending: 'Customizing resume...',
      customizing: 'Customizing resume...',
      interviewPending: 'Generating interview tips...',
      interviewing: 'Generating interview tips...',
      customizeCompleted: 'Customization Completed',
      customizeFailed: 'Customization Failed',
      customizeRefunded: 'Coins refunded, please retry',
      customizeFailedFree: 'Free model temporarily busy, please retry later',
      jobVisionPending: 'Analyzing job description...',
      jobVisionCompleted: 'Job Analysis Completed',
      jobVisionFailed: 'Job Analysis Failed',
      prematchPending: 'Simulating HR Review...',
      prematchCompleted: 'HR Review Completed',
      prematchFailed: 'HR Review Failed',
      queued: 'Task enqueued, please wait...',
    },
    costTooltip: 'Using this service costs {cost} coins',
  },
  profile: {
    title: 'Profile',
    tabs: { assets: 'Experience', billing: 'Billing/Top-up' },
    resume: {
      title: 'General Resume',
      description:
        'The foundation for all AI services. An essential prerequisite for Match Analysis, Resume Customization, and Interview Prep.',
      defaultFileName: 'General Resume',
      tips: {
        star: 'Use the STAR method (Situation-Task-Action-Result) to quantify your achievements.',
        detail:
          'Record your career highlights in detail so the AI can better understand your potential.',
      },
      note: '',
    },
    detailed: {
      title: 'Detailed Resume',
      badge: 'Recommended',
      defaultFileName: 'Detailed Resume',
      description:
        "A 'Power-Up' for advanced insights. Uploading detailed projects and metrics provides rich context for significantly higher quality AI output.",
      examples: {
        label: 'STAR Method Examples',
        roles: {
          product: 'Product Mgr',
          ops: 'User Ops',
          tech: 'Backend Dev',
          design: 'UI/UX Design',
        },
        items: {
          product: [
            {
              label: 'Situation',
              content:
                'Tried to boost paid conversion for a Reading App. Goal: +20% paid users in Q3.',
            },
            {
              label: 'Challenge',
              content:
                'Discount strategies hit a ceiling and hurt margins. Users were price-insensitive.',
            },
            {
              label: 'Action',
              content:
                'Discovered correlation between reading time and payment. Created "Time-for-Credit" feature.',
            },
            {
              label: 'Result',
              content:
                'Conversion up 35% (beat goal). New user first-order time shortened by 40%.',
            },
          ],
          ops: [
            {
              label: 'Situation',
              content: 'Managed 500+ communities with low engagement (5% DAU).',
            },
            {
              label: 'Challenge',
              content:
                'Users ignored official broadcasts. Content was generic; zero interaction.',
            },
            {
              label: 'Action',
              content:
                'Recruited KOLs as "Topic Leaders" and introduced points system to incentivize UGC.',
            },
            {
              label: 'Result',
              content:
                'DAU doubled to 11%. Daily UGC up 300%. Core user retention hit 90%.',
            },
          ],
          tech: [
            {
              label: 'Situation',
              content:
                'Ensuring payment system stability during Black Friday sales.',
            },
            {
              label: 'Challenge',
              content:
                'Timeout rate hit 2%. Monolithic DB was a bottleneck and unscalable.',
            },
            {
              label: 'Action',
              content:
                'Implemented cold/hot data separation, MQ for peak shaving, and Event Sourcing.',
            },
            {
              label: 'Result',
              content:
                'QPS capacity up 5x. Zero downtime. Failure rate dropped below 0.01%.',
            },
          ],
          design: [
            {
              label: 'Situation',
              content:
                'Optimizing mobile approval workflow for B2B admin system.',
            },
            {
              label: 'Challenge',
              content:
                'Porting complex PC tables to mobile caused high error rates and slowness.',
            },
            {
              label: 'Action',
              content:
                'Ditched tables. Re-designed using "Info Cards" + "Action Cards" separation.',
            },
            {
              label: 'Result',
              content:
                'Approval time cut by 50%. Error feedback dropped to zero. Satisfaction 4.8/5.',
            },
          ],
        },
      },
      note: '',
    },
    uploader: {
      button: 'Upload',
      buttonProcessing: 'Uploading...',
      status: {
        pending: 'Parsing',
        completed: 'Completed',
        failed: 'Failed',
        uploadSuccess: 'Upload success, starting parse',
        parseComplete: 'Parse Complete',
      },

      fileTooLarge2MB: 'File exceeds 2MB limit',
      fileTooLarge4MB: 'File exceeds 4MB limit',
      preview: 'Preview',
      reupload: 'Re-upload',
      chooseFile: 'Choose File',
      noFileSelected: 'No file selected',
      suggestionTextResume:
        'We recommend keeping the resume text under ~8000 characters for better parsing stability.',
      suggestionTextDetailed:
        'We recommend keeping the detailed resume text under ~10000 characters for better parsing stability.',
      processingMarquee: 'Model is processing',
      etaMarqueeMinTemplate: 'Estimated {minutes} mins',
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
      time: {
        secAgo: '{secs} sec ago',
        minAgo: '{mins} min ago',
        hrAgo: '{hours} hr ago',
      },
      toast: {
        uploadSuccess: 'Uploaded, parsing started',
        queueFree: 'Insufficient coins, task moved to free queue',
        queueError: 'Service busy, please try later',
        pollSuccess: 'Parsing complete',
        pollFailed: 'Parsing failed',
        pollFailedRefund: 'Parsing failed, coins refunded',
        copiedJson: 'Copied JSON',
        copiedMd: 'Copied Markdown',
      },
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
      capabilities: 'Capabilities',
      contributions: 'Contributions',
      courses: 'Courses',
      link: 'Link',
      metric: 'Metric',
      task: 'TASK',
      action: 'ACTION',
      result: 'RESULT',
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
      title: 'Your Personal AI Career Coach',
      subtitle:
        'Stop applying blindly. Get higher-match interviews with data-driven insights.',
      cta: 'Start Free Trial (8 coins)',
    },
    philosophy: {
      title: 'Success Starts with Self-Knowledge',
      description:
        'Most job seekers skip the most important step: organizing their own assets. By structuring your "Detailed Resume" first, our AI can dig deep into your potential and match you with the right opportunities.',
      step1: 'Raw Experience',
      step2: 'Structured Assets',
      step3: 'Tailored Applications',
    },
    features: {
      title: 'How It Works',
      tabs: {
        match: '1. Match Analysis',
        customize: '2. Resume Customization',
        interview: '3. Interview Prep',
        share: '4. Share & Track',
      },
      match: {
        title: 'Know Where You Stand',
        description:
          'Instantly analyze your fit for any job description. Get a clear score, understand key requirements, and identify gaps before you apply.',
      },
      customize: {
        title: 'Tailor Your Resume in Seconds',
        description:
          'Generate a targeted resume that highlights exactly what the recruiter is looking for. Edit in our Markdown editor and export to PDF.',
      },
      interview: {
        title: 'Walk Into Interviews with Confidence',
        description:
          'Get a personalized "Battle Plan" with anticipated questions, key talking points, and strategic questions to ask the interviewer.',
      },
      share: {
        title: 'Share Your Story',
        description:
          'Create a secure, shareable link for your tailored resume. Track views and impress recruiters with a modern, digital profile.',
      },
    },
    benefits: {
      title: 'Why Choose CareerShaper?',
      items: [
        {
          title: 'Precision Matching',
          description:
            "Stop guessing. Our AI analyzes job descriptions deeply to tell you exactly why you fit (or why you don't).",
        },
        {
          title: 'Efficiency Boost',
          description:
            'Tailor your resume for every application in seconds, not hours. Focus your energy on networking and interviewing.',
        },
        {
          title: 'Interview Confidence',
          description:
            'Never be caught off guard. Our "Battle Plan" prepares you for the toughest questions based on your specific gaps.',
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
  resume: {
    templates: {
      standard: {
        name: 'Standard',
        description: 'Classic & clean - suitable for most scenarios',
      },
      technical: {
        name: 'Technical',
        description: 'Compact & efficient - for engineers & architects',
      },
      product: {
        name: 'Product/Ops',
        description: 'Logic-driven - for PMs, data ops, growth hackers',
      },
      creative: {
        name: 'Creative',
        description: 'Stylish layout - for UI/UX & visual designers',
      },
      corporate: {
        name: 'Corporate',
        description: 'Professional & stable - for finance, legal, SOEs',
      },
      professional: {
        name: 'Professional',
        description: 'Two-column - for consultants, CPAs, project managers',
      },
      darkSidebar: {
        name: 'Dark Sidebar',
        description:
          'Bold visual - for marketers, photographers, personal branding',
      },
      elegant: {
        name: 'Modern Elegant',
        description: 'Fresh layout - for copywriters, PR, art curators',
      },
    },
    editor: {
      title: 'Resume Content',
      selectTemplate: 'Select Template',
      templateDesc: 'All templates support A4 print and PDF export',
      resetConfirm: 'Confirm Reset Resume?',
      resetDesc:
        'This will restore the resume to the AI-generated version. Your edits will be lost.',
      resetCancel: 'Cancel',
      resetButton: 'Reset',
      structure: 'Resume Structure',
      editResume: 'Edit Resume',
      selectAction: 'Select an action to adjust your resume',
      customSectionTitle: 'Custom section title',
      markdownTip:
        '💡 Supports bold, italic, and other Markdown formatting. Can auto-generate lists.',
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
      // BasicsForm keys
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
      summaryPlaceholder:
        'Briefly describe your core strengths, career goals, etc.',
      // PageBreakSwitch keys
      pageBreak: 'Insert page break at bottom',
      pageBreakDesc: 'Force start a new page after this content',
      certificatesPlaceholder: 'List your certificates or awards...',
      hobbiesPlaceholder: 'List your hobbies and interests...',
      aiSuggestionTitle: 'Optimization Suggestions',
      aiSuggestionIntro:
        'Based on your resume content and target position analysis, here are optimization suggestions to help you stand out.',
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
        enableTitle: 'Public sharing',
        enableDesc: 'This link is inactive. Visitors will see a 404 page.',
        disableTitle: 'Public sharing',
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
        bannerText: 'This resume was powered by CareerShaper AI',
        cta: 'Create Yours',
        footerText: 'Powered by CareerShaper',
        printFooter: 'Generated by CareerShaper AI',
        metaTitle: 'Professional Resume - CareerShaper',
        metaDesc: 'View this professional resume created with AI.',
        status: {
          expiredBadge: 'Share link expired',
          disabledBadge: 'Sharing paused',
          expiredTitle: 'This link has expired',
          disabledTitle: 'This share link is off',
          expiredDesc:
            'The owner set a validity window, and it has ended. Request a new link to view the resume.',
          disabledDesc:
            'The owner has turned off public sharing for this resume.',
          cta: 'Create my AI resume',
          ctaHint: 'Build a polished resume in minutes with CareerShaper AI.',
        },
      },
    },
    tips: {
      noSuggestions: 'No suggestions yet, please generate resume first',
      suggestionIntro:
        'Based on your resume content and target position analysis, here are optimization suggestions to help you stand out.',
    },
    history: {
      title: 'History',
      creating: 'Creating...',
      noHistory: 'No history yet',
      loadMore: 'Load more history',
    },
    errors: {
      unknownTitle: 'Unknown Error',
      unknownMessage: 'An unknown error occurred',
      unknownSuggestion: 'Please try again or contact support.',
    },
    highlightKeyword: 'higher-match',
  },
  shell: {
    brand: 'CareerShaper',
    signIn: 'Sign in',
    coins: 'Coins',
    assets: 'Assets',
    billing: 'Coins & Billing',
    myAccount: 'My Account',
    accountSettings: 'Account Settings',
    signOut: 'Sign out',
  },
}
export default dict
