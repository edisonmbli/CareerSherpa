import { afterEach, describe, expect, it } from 'vitest'
import { ENV } from '@/lib/env'
import {
  buildFeedbackPlainText,
  buildSlackPayload,
  buildSlackSingleMessagePayload,
  buildSlackThreadPayload,
  buildFeedbackSubject,
  getConfiguredFeedbackDestinations,
} from '@/lib/feedback/delivery'
import type { FeedbackEnrichment } from '@/lib/feedback/enrichment'
import { buildPostHogFeedbackLinks } from '@/lib/feedback/posthog-links'
import type { FeedbackDispatchPayload } from '@/lib/feedback/schema'

const basePayload: FeedbackDispatchPayload = {
  feedbackId: 'fb_test_123',
  submittedAt: '2026-03-10T10:00:00.000Z',
  type: 'bug',
  message: 'Step 2 keeps loading after clicking customize.',
  includeAccountEmail: true,
  authUser: {
    id: 'user_123',
    email: 'founder@example.com',
  },
  context: {
    locale: 'zh',
    surface: 'workbench',
    tab: 'customize',
    serviceId: 'svc_123',
    taskId: 'customize_svc_123_sess_001',
    taskTemplateId: 'resume_customize',
    status: 'CUSTOMIZE_PENDING',
    tier: 'paid',
    queueType: 'paid',
    currentUrl: 'https://careershaper.com/zh/workbench/svc_123?tab=customize',
    pathname: '/zh/workbench/svc_123',
    title: 'CareerSherpa',
    sentryEventId: 'sentry_123',
    posthogDistinctId: 'ph_123',
    posthogSessionId: 'sess_123',
    posthogReplayUrl:
      'https://us.posthog.com/project/42/replay/sess_123?t=1700000000',
    timeZone: 'Asia/Shanghai',
    userAgent: 'Mozilla/5.0',
    occurredAt: '2026-03-10T10:00:00.000Z',
    viewport: {
      width: 1440,
      height: 900,
    },
    extras: {
      currentTabStatus: 'CUSTOMIZE_PENDING',
      connected: true,
      serviceNetCoinDelta: 1,
    },
  },
}

const enrichment: FeedbackEnrichment = {
  deliveryMode: 'qstash',
  resolvedTaskId: 'customize_svc_123_sess_001',
  resolvedTaskTemplateId: 'resume_customize',
  taskTierHint: 'paid',
  currentTabCostPreview: 1,
  billingMode: 'paid',
  billingStatus: 'SUCCESS',
  debitDelta: 1,
  debitCreatedAt: '2026-03-10T09:59:00.000Z',
  billingLookupSource: 'service_template',
  provider: 'deepseek',
  modelId: 'deepseek-reasoner',
  llmUsageCreatedAt: '2026-03-10T09:59:10.000Z',
  modelLookupSource: 'service_template',
}

const originalEnv = {
  slack: ENV.FEEDBACK_SLACK_WEBHOOK_URL,
  resendKey: ENV.FEEDBACK_RESEND_API_KEY,
  resendFrom: ENV.FEEDBACK_RESEND_FROM_EMAIL,
  resendTo: ENV.FEEDBACK_RESEND_TO_EMAIL,
  posthogAppBaseUrl: ENV.POSTHOG_APP_BASE_URL,
  posthogProjectId: ENV.POSTHOG_PROJECT_ID,
  posthogPersonUrlTemplate: ENV.POSTHOG_PERSON_URL_TEMPLATE,
}

afterEach(() => {
  ENV.FEEDBACK_SLACK_WEBHOOK_URL = originalEnv.slack
  ENV.FEEDBACK_RESEND_API_KEY = originalEnv.resendKey
  ENV.FEEDBACK_RESEND_FROM_EMAIL = originalEnv.resendFrom
  ENV.FEEDBACK_RESEND_TO_EMAIL = originalEnv.resendTo
  ENV.POSTHOG_APP_BASE_URL = originalEnv.posthogAppBaseUrl
  ENV.POSTHOG_PROJECT_ID = originalEnv.posthogProjectId
  ENV.POSTHOG_PERSON_URL_TEMPLATE = originalEnv.posthogPersonUrlTemplate
})

describe('feedback delivery helpers', () => {
  it('builds a readable subject line', () => {
    expect(buildFeedbackSubject(basePayload)).toContain('Founder Inbox')
    expect(buildFeedbackSubject(basePayload)).toContain('svc_123')
  })

  it('renders auto-attached context into plain text', () => {
    ENV.POSTHOG_APP_BASE_URL = 'https://us.posthog.com'
    ENV.POSTHOG_PROJECT_ID = '42'
    const text = buildFeedbackPlainText(basePayload, enrichment)
    expect(text).toContain('Step 2 keeps loading')
    expect(text).toContain('Surface: workbench')
    expect(text).toContain('Service ID: svc_123')
    expect(text).toContain('PostHog Distinct ID: ph_123')
    expect(text).toContain('PostHog Session ID: sess_123')
    expect(text).toContain('PostHog Person URL: https://us.posthog.com/project/42/person/ph_123')
    expect(text).toContain('Tab Status: CUSTOMIZE_PENDING')
    expect(text).toContain('Billing Mode: paid')
    expect(text).toContain('Model: deepseek/deepseek-reasoner')
  })

  it('builds block-kit payload with triage-first sections', () => {
    ENV.POSTHOG_APP_BASE_URL = 'https://us.posthog.com'
    ENV.POSTHOG_PROJECT_ID = '42'
    const slackPayload = buildSlackPayload(basePayload, enrichment)
    expect(slackPayload.text).toContain('Founder Inbox')
    expect(Array.isArray(slackPayload.blocks)).toBe(true)
    expect(JSON.stringify(slackPayload.blocks)).toContain('Open current page')
    expect(JSON.stringify(slackPayload.blocks)).toContain('Open person')
    expect(JSON.stringify(slackPayload.blocks)).toContain('Open replay')
    expect(JSON.stringify(slackPayload.blocks)).toContain('deepseek-reasoner')
    expect(JSON.stringify(slackPayload.blocks)).not.toContain('Debug / Signals')
    expect(JSON.stringify(slackPayload.blocks)).toContain('Details are in thread')
    const sectionBlocks = (slackPayload.blocks as Array<Record<string, unknown>>).filter(
      (block) => block['type'] === 'section' && Array.isArray(block['fields']),
    )
    for (const block of sectionBlocks) {
      expect((block['fields'] as unknown[]).length).toBeLessThanOrEqual(10)
    }
  })

  it('builds a detail thread payload for long-form context', () => {
    ENV.POSTHOG_APP_BASE_URL = 'https://us.posthog.com'
    ENV.POSTHOG_PROJECT_ID = '42'
    const threadPayload = buildSlackThreadPayload(basePayload, enrichment)
    expect(JSON.stringify(threadPayload.blocks)).toContain('Identifiers')
    expect(JSON.stringify(threadPayload.blocks)).toContain('Billing / Model')
    expect(JSON.stringify(threadPayload.blocks)).toContain('Debug / Signals')
  })

  it('builds a full single-message payload for webhook fallback', () => {
    ENV.POSTHOG_APP_BASE_URL = 'https://us.posthog.com'
    ENV.POSTHOG_PROJECT_ID = '42'
    const payload = buildSlackSingleMessagePayload(basePayload, enrichment)
    expect(JSON.stringify(payload.blocks)).toContain('Identifiers')
    expect(JSON.stringify(payload.blocks)).toContain('Billing / Model')
    expect(JSON.stringify(payload.blocks)).toContain('Debug / Signals')
    expect(JSON.stringify(payload.blocks)).not.toContain('Details are in thread')
  })

  it('normalizes app base when env contains a project path', () => {
    ENV.POSTHOG_APP_BASE_URL = 'https://us.posthog.com/project/42'
    ENV.POSTHOG_PROJECT_ID = '42'

    const links = buildPostHogFeedbackLinks(basePayload.context)
    expect(links.personUrl).toBe('https://us.posthog.com/project/42/person/ph_123')
  })

  it('detects configured destinations from env flags', () => {
    ENV.FEEDBACK_SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test'
    ENV.FEEDBACK_RESEND_API_KEY = 're_test'
    ENV.FEEDBACK_RESEND_FROM_EMAIL = 'bot@careershaper.com'
    ENV.FEEDBACK_RESEND_TO_EMAIL = 'founder@careershaper.com'

    expect(getConfiguredFeedbackDestinations()).toEqual(['slack', 'resend'])
  })
})
