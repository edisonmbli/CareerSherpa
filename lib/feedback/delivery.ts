import { ENV, isQstashReady } from '@/lib/env'
import { getQStash } from '@/lib/queue/qstash'
import { logError, logInfo } from '@/lib/logger'
import type { FeedbackDispatchPayload, FeedbackType } from '@/lib/feedback/schema'
import { buildPostHogFeedbackLinks } from '@/lib/feedback/posthog-links'
import {
  enrichFeedbackPayload,
  type FeedbackDeliveryMode,
  type FeedbackEnrichment,
} from '@/lib/feedback/enrichment'

const FEEDBACK_QSTASH_RETRIES = 3
const FEEDBACK_FETCH_TIMEOUT_MS = 8000

type DeliveryChannel = 'slack' | 'resend'

type SlackBlock = Record<string, unknown>

type SlackDeliveryMode = 'webhook_single' | 'bot_thread' | 'bot_main_only'

function isSlackBotThreadReady() {
  return Boolean(
    ENV.FEEDBACK_SLACK_BOT_TOKEN && ENV.FEEDBACK_SLACK_CHANNEL_ID,
  )
}

export function getConfiguredFeedbackDestinations() {
  const destinations: DeliveryChannel[] = []
  if (ENV.FEEDBACK_SLACK_WEBHOOK_URL || isSlackBotThreadReady()) {
    destinations.push('slack')
  }
  if (
    ENV.FEEDBACK_RESEND_API_KEY &&
    ENV.FEEDBACK_RESEND_FROM_EMAIL &&
    ENV.FEEDBACK_RESEND_TO_EMAIL
  ) {
    destinations.push('resend')
  }
  return destinations
}

export function getFeedbackTypeLabel(type: FeedbackType) {
  switch (type) {
    case 'bug':
      return 'Bug report'
    case 'feature':
      return 'Feature request'
    default:
      return 'Confusing UX'
  }
}

function getFeedbackTypeEmoji(type: FeedbackType) {
  switch (type) {
    case 'bug':
      return '🐞'
    case 'feature':
      return '✨'
    default:
      return '🧭'
  }
}

function getPriorityLabel(
  payload: FeedbackDispatchPayload,
  enrichment?: FeedbackEnrichment,
) {
  const billingMode = enrichment?.billingMode || enrichment?.taskTierHint
  if (payload.type === 'bug' && billingMode === 'paid') return 'high'
  if (payload.type === 'bug') return 'medium'
  if (payload.type === 'confusion' && billingMode === 'paid') return 'medium'
  if (payload.type === 'feature') return 'normal'
  return 'normal'
}

function getTriageHint(
  payload: FeedbackDispatchPayload,
  enrichment?: FeedbackEnrichment,
) {
  if (payload.type === 'bug' && payload.context.sentryEventId) {
    return 'PostHog -> Sentry -> Open App'
  }
  if (payload.type === 'bug') return 'PostHog -> Open App'
  if (payload.type === 'confusion') return 'Replay -> UX copy/state'
  if (enrichment?.billingMode === 'paid') return 'Founder review -> roadmap'
  return 'Inbox triage -> weekly review'
}

export function buildFeedbackSubject(payload: FeedbackDispatchPayload) {
  const surface = payload.context.surface
  const tab = payload.context.tab ? `/${payload.context.tab}` : ''
  const serviceId = payload.context.serviceId
  const suffix = serviceId ? ` · ${serviceId}` : ''
  return `[Founder Inbox] ${getFeedbackTypeLabel(payload.type)} · ${surface}${tab}${suffix}`
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 1))}…`
}

function formatExtraValue(value: unknown) {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function formatViewport(
  viewport?: FeedbackDispatchPayload['context']['viewport'],
) {
  if (!viewport) return '-'
  return `${viewport.width}x${viewport.height}`
}

function addIfPresent(lines: string[], label: string, value: unknown) {
  if (value === null || value === undefined || value === '') return
  lines.push(`${label}: ${formatExtraValue(value)}`)
}

function buildContextLines(
  payload: FeedbackDispatchPayload,
  enrichment?: FeedbackEnrichment,
) {
  const posthogLinks = buildPostHogFeedbackLinks(payload.context)
  const lines = [
    `Feedback ID: ${payload.feedbackId}`,
    `Submitted At: ${payload.submittedAt}`,
    `User ID: ${payload.authUser.id}`,
    `Reply Email: ${payload.authUser.email || '-'}`,
    `Surface: ${payload.context.surface}`,
    `Tab: ${payload.context.tab || '-'}`,
    `Service Status: ${payload.context.status || '-'}`,
    `Tab Status: ${formatExtraValue(payload.context.extras?.['currentTabStatus'])}`,
    `Service ID: ${payload.context.serviceId || '-'}`,
    `Task ID: ${enrichment?.resolvedTaskId || payload.context.taskId || '-'}`,
    `Task Template ID: ${
      enrichment?.resolvedTaskTemplateId || payload.context.taskTemplateId || '-'
    }`,
    `Delivery Mode: ${enrichment?.deliveryMode || 'direct'}`,
    `Dispatch Target: /api/feedback/dispatch`,
    `Task Tier Hint: ${
      enrichment?.taskTierHint || payload.context.taskTierHint || payload.context.tier || '-'
    }`,
    `Billing Mode: ${enrichment?.billingMode || '-'}`,
    `Billing Status: ${enrichment?.billingStatus || '-'}`,
    `Billing Lookup Source: ${enrichment?.billingLookupSource || 'none'}`,
    `Current Tab Cost Preview: ${
      enrichment?.currentTabCostPreview !== undefined
        ? String(enrichment.currentTabCostPreview)
        : '-'
    }`,
    `Service Net Coin Delta: ${
      payload.context.extras?.['serviceNetCoinDelta'] !== undefined
        ? formatExtraValue(payload.context.extras['serviceNetCoinDelta'])
        : '-'
    }`,
    `Debit Delta: ${
      enrichment?.debitDelta !== undefined ? String(enrichment.debitDelta) : '-'
    }`,
    `Debit Created At: ${enrichment?.debitCreatedAt || '-'}`,
    `Model: ${
      enrichment?.modelId
        ? `${enrichment.provider || 'unknown'}/${enrichment.modelId}`
        : '-'
    }`,
    `Model Lookup Source: ${enrichment?.modelLookupSource || 'none'}`,
    `LLM Usage Created At: ${enrichment?.llmUsageCreatedAt || '-'}`,
    `Locale: ${payload.context.locale}`,
    `Timezone: ${payload.context.timeZone || '-'}`,
    `URL: ${payload.context.currentUrl || '-'}`,
    `Pathname: ${payload.context.pathname || '-'}`,
    `Page Title: ${payload.context.title || '-'}`,
    `PostHog Distinct ID: ${payload.context.posthogDistinctId || '-'}`,
    `PostHog Session ID: ${payload.context.posthogSessionId || '-'}`,
    `PostHog Replay URL: ${payload.context.posthogReplayUrl || '-'}`,
    `Sentry Event ID: ${payload.context.sentryEventId || '-'}`,
    `Viewport: ${formatViewport(payload.context.viewport)}`,
    `User Agent: ${payload.context.userAgent || '-'}`,
  ]

  addIfPresent(lines, 'PostHog Person URL', posthogLinks.personUrl)

  addIfPresent(lines, 'Legacy Tier', payload.context.tier)
  addIfPresent(lines, 'Legacy Queue Type', payload.context.queueType)

  if (payload.context.extras) {
    for (const [key, value] of Object.entries(payload.context.extras)) {
      lines.push(`${key}: ${formatExtraValue(value)}`)
    }
  }

  return lines
}

export function buildFeedbackPlainText(
  payload: FeedbackDispatchPayload,
  enrichment?: FeedbackEnrichment,
) {
  const lines = buildContextLines(payload, enrichment)
  return [
    `${getFeedbackTypeEmoji(payload.type)} ${buildFeedbackSubject(payload)}`,
    '',
    `Type: ${getFeedbackTypeLabel(payload.type)}`,
    `Priority: ${getPriorityLabel(payload, enrichment)}`,
    `Triage Hint: ${getTriageHint(payload, enrichment)}`,
    '',
    'User message:',
    payload.message,
    '',
    'Auto-attached context:',
    ...lines,
  ].join('\n')
}

function buildMrkdwnFields(entries: Array<[string, string | undefined]>) {
  return entries
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => ({
      type: 'mrkdwn',
      text: `*${label}*\n${truncate(value || '-', 180)}`,
    }))
}

function buildFieldSections(
  title: string,
  entries: Array<[string, string | undefined]>,
): SlackBlock[] {
  const chunks: SlackBlock[] = []
  for (let index = 0; index < entries.length; index += 10) {
    const chunk = entries.slice(index, index + 10)
    chunks.push({
      type: 'section',
      ...(index === 0
        ? {
            text: {
              type: 'mrkdwn',
              text: `*${title}*`,
            },
          }
        : {}),
      fields: buildMrkdwnFields(chunk),
    })
  }
  return chunks
}

function buildSlackDetailBlocks(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
): SlackBlock[] {
  const posthogLinks = buildPostHogFeedbackLinks(payload.context)
  const identifiers: Array<[string, string | undefined]> = [
    ['Service ID', payload.context.serviceId],
    ['Task ID', enrichment.resolvedTaskId || payload.context.taskId],
    [
      'Task Template',
      enrichment.resolvedTaskTemplateId || payload.context.taskTemplateId,
    ],
    ['Feedback ID', payload.feedbackId],
    ['User ID', payload.authUser.id],
    ['PostHog ID', payload.context.posthogDistinctId],
    ['PostHog Session', payload.context.posthogSessionId],
    ['Sentry Event', payload.context.sentryEventId],
  ]

  const debugSignals: Array<[string, string | undefined]> = [
    ['Current Status', formatExtraValue(payload.context.extras?.['currentStatus'])],
    ['Current Tab Status', formatExtraValue(payload.context.extras?.['currentTabStatus'])],
    ['Match Ready', formatExtraValue(payload.context.extras?.['matchReady'])],
    ['Interview Ready', formatExtraValue(payload.context.extras?.['interviewReady'])],
    ['Connected', formatExtraValue(payload.context.extras?.['connected'])],
    ['Viewport', formatViewport(payload.context.viewport)],
    ['Timezone', payload.context.timeZone || '-'],
    ['Delivery Mode', enrichment.deliveryMode],
    ['Dispatch Target', '/api/feedback/dispatch'],
    ['PostHog App', posthogLinks.appBaseUrl],
    ['PostHog Project', posthogLinks.projectId],
    ['Legacy Tier', payload.context.tier || '-'],
    ['Legacy Queue Type', payload.context.queueType || '-'],
    [
      'Service Net Coin Delta',
      payload.context.extras?.['serviceNetCoinDelta'] !== undefined
        ? formatExtraValue(payload.context.extras['serviceNetCoinDelta'])
        : '-',
    ],
  ]

  return [
    ...buildFieldSections(
      'Identifiers',
      identifiers.map(
        ([label, value]): [string, string] => [label, value || '-'],
      ),
    ),
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Billing / Model*',
      },
      fields: buildMrkdwnFields([
        ['Task Tier Hint', enrichment.taskTierHint || payload.context.taskTierHint || '-'],
        [
          'Current Tab Cost Preview',
          enrichment.currentTabCostPreview !== undefined
            ? String(enrichment.currentTabCostPreview)
            : '-',
        ],
        ['Billing Mode', enrichment.billingMode || '-'],
        ['Billing Status', enrichment.billingStatus || '-'],
        ['Billing Lookup', enrichment.billingLookupSource],
        [
          'Debit',
          enrichment.debitDelta !== undefined
            ? `${enrichment.debitDelta}${enrichment.debitCreatedAt ? ` @ ${enrichment.debitCreatedAt}` : ''}`
            : '-',
        ],
        ['Provider', enrichment.provider || '-'],
        ['Model ID', enrichment.modelId || '-'],
        ['Model Lookup', enrichment.modelLookupSource],
        ['LLM Usage At', enrichment.llmUsageCreatedAt || '-'],
      ]),
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Page / Flow*',
      },
      fields: buildMrkdwnFields([
        ['URL', payload.context.currentUrl || '-'],
        ['Page Title', payload.context.title || '-'],
        ['Occurred At', payload.context.occurredAt || '-'],
        ['User Agent', payload.context.userAgent || '-'],
      ]),
    },
    ...buildFieldSections('Debug / Signals', debugSignals),
  ]
}

function buildSlackMainBlocks(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
  options: { includeThreadFooter?: boolean } = {},
): SlackBlock[] {
  const status = payload.context.status || '-'
  const tab = payload.context.tab || '-'
  const title = `${getFeedbackTypeEmoji(payload.type)} Founder Inbox · ${payload.context.surface}/${tab} · ${status}`
  const billingLabel = enrichment.billingMode
    ? `${enrichment.billingMode}${enrichment.billingStatus ? ` (${enrichment.billingStatus})` : ''}`
    : enrichment.taskTierHint || payload.context.tier || '-'
  const modelLabel = enrichment.modelId
    ? `${enrichment.provider || 'unknown'}/${enrichment.modelId}`
    : '-'
  const openAppUrl = payload.context.currentUrl
  const posthogLinks = buildPostHogFeedbackLinks(payload.context)

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: truncate(title, 150),
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*User message*\n>${truncate(payload.message, 1200).replace(/\n/g, '\n>')}`,
      },
    },
    {
      type: 'section',
      fields: buildMrkdwnFields([
        ['Type', getFeedbackTypeLabel(payload.type)],
        ['Priority', getPriorityLabel(payload, enrichment)],
        ['Surface / Tab', `${payload.context.surface} / ${tab}`],
        ['Service Status', status],
        ['Tab Status', formatExtraValue(payload.context.extras?.['currentTabStatus'])],
        ['Billing', billingLabel],
        ['Model', modelLabel],
        ['Reply Email', payload.authUser.email || '-'],
        ['Triage Hint', getTriageHint(payload, enrichment)],
      ]),
    },
    {
      type: 'section',
      fields: buildMrkdwnFields([
        ['Open App', openAppUrl ? `<${openAppUrl}|Open current page>` : '-'],
        [
          'PostHog Person',
          posthogLinks.personUrl
            ? `<${posthogLinks.personUrl}|Open person>`
            : undefined,
        ],
        [
          'PostHog Replay',
          posthogLinks.replayUrl
            ? `<${posthogLinks.replayUrl}|Open replay>`
            : undefined,
        ],
        ['Path', payload.context.pathname || '-'],
        ['Submitted At', payload.submittedAt],
        ['Locale', payload.context.locale],
      ]),
    },
  ]

  if (options.includeThreadFooter) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Details are in thread · service ${payload.context.serviceId || '-'} · feedback ${payload.feedbackId}`,
        },
      ],
    })
  }

  return blocks
}

export function buildSlackPayload(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
) {
  const textPrefix = ENV.FEEDBACK_SLACK_MENTION
    ? `${ENV.FEEDBACK_SLACK_MENTION} ${buildFeedbackSubject(payload)}`
    : buildFeedbackSubject(payload)

  return {
    text: truncate(textPrefix, 200),
    blocks: buildSlackMainBlocks(payload, enrichment, {
      includeThreadFooter: true,
    }),
  }
}

export function buildSlackThreadPayload(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
) {
  return {
    text: truncate(`Details · ${buildFeedbackSubject(payload)}`, 200),
    blocks: buildSlackDetailBlocks(payload, enrichment),
  }
}

export function buildSlackSingleMessagePayload(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
) {
  const textPrefix = ENV.FEEDBACK_SLACK_MENTION
    ? `${ENV.FEEDBACK_SLACK_MENTION} ${buildFeedbackSubject(payload)}`
    : buildFeedbackSubject(payload)

  return {
    text: truncate(textPrefix, 200),
    blocks: [
      ...buildSlackMainBlocks(payload, enrichment, {
        includeThreadFooter: false,
      }),
      { type: 'divider' as const },
      ...buildSlackDetailBlocks(payload, enrichment),
    ],
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = FEEDBACK_FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function deliverToSlack(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
) {
  if (isSlackBotThreadReady()) {
    try {
      await deliverToSlackViaBot(payload, enrichment)
      return
    } catch (error) {
      if (!ENV.FEEDBACK_SLACK_WEBHOOK_URL) {
        throw error
      }
    }
  }

  if (!ENV.FEEDBACK_SLACK_WEBHOOK_URL) {
    throw new Error('missing_FEEDBACK_SLACK_CONFIG')
  }

  await deliverToSlackViaWebhook(payload, enrichment)
}

async function deliverToSlackViaWebhook(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
) {
  const response = await fetchWithTimeout(ENV.FEEDBACK_SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildSlackSingleMessagePayload(payload, enrichment)),
  })

  if (!response.ok) {
    const detail = truncate(await response.text(), 300)
    throw new Error(`slack_http_${response.status}:${detail}`)
  }
}

async function postToSlackApi(body: Record<string, unknown>) {
  if (!ENV.FEEDBACK_SLACK_BOT_TOKEN) {
    throw new Error('missing_FEEDBACK_SLACK_BOT_TOKEN')
  }

  const response = await fetchWithTimeout('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ENV.FEEDBACK_SLACK_BOT_TOKEN}`,
      'content-type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    const detail = truncate(
      payload?.error || (await response.text().catch(() => 'slack_api_error')),
      300,
    )
    throw new Error(`slack_api_${response.status}:${detail}`)
  }

  return payload as { ok: true; ts?: string }
}

async function deliverToSlackViaBot(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
): Promise<SlackDeliveryMode> {
  if (!ENV.FEEDBACK_SLACK_CHANNEL_ID) {
    throw new Error('missing_FEEDBACK_SLACK_CHANNEL_ID')
  }

  const main = buildSlackPayload(payload, enrichment)
  const mainResult = await postToSlackApi({
    channel: ENV.FEEDBACK_SLACK_CHANNEL_ID,
    text: main.text,
    blocks: main.blocks,
    ...(ENV.FEEDBACK_SLACK_MENTION
      ? { text: `${ENV.FEEDBACK_SLACK_MENTION} ${main.text}` }
      : {}),
  })

  if (!mainResult.ts) {
    throw new Error('slack_missing_thread_ts')
  }

  const detail = buildSlackThreadPayload(payload, enrichment)
  try {
    await postToSlackApi({
      channel: ENV.FEEDBACK_SLACK_CHANNEL_ID,
      thread_ts: mainResult.ts,
      reply_broadcast: false,
      text: detail.text,
      blocks: detail.blocks,
    })
    return 'bot_thread'
  } catch (error) {
    await postToSlackApi({
      channel: ENV.FEEDBACK_SLACK_CHANNEL_ID,
      thread_ts: mainResult.ts,
      reply_broadcast: true,
      text: `Details could not be posted as rich blocks. Reply in thread with \`/details ${payload.feedbackId}\` or check server logs.`,
    })
    return 'bot_main_only'
  }
}

async function deliverToResend(
  payload: FeedbackDispatchPayload,
  enrichment: FeedbackEnrichment,
) {
  if (
    !ENV.FEEDBACK_RESEND_API_KEY ||
    !ENV.FEEDBACK_RESEND_FROM_EMAIL ||
    !ENV.FEEDBACK_RESEND_TO_EMAIL
  ) {
    throw new Error('missing_FEEDBACK_RESEND_CONFIG')
  }

  const response = await fetchWithTimeout('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${ENV.FEEDBACK_RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: ENV.FEEDBACK_RESEND_FROM_EMAIL,
      to: [ENV.FEEDBACK_RESEND_TO_EMAIL],
      ...(payload.authUser.email ? { reply_to: payload.authUser.email } : {}),
      subject: buildFeedbackSubject(payload),
      text: buildFeedbackPlainText(payload, enrichment),
    }),
  })

  if (!response.ok) {
    const detail = truncate(await response.text(), 300)
    throw new Error(`resend_http_${response.status}:${detail}`)
  }
}

export async function deliverFounderFeedback(
  payload: FeedbackDispatchPayload,
  options: { deliveryMode?: FeedbackDeliveryMode } = {},
) {
  const destinations = getConfiguredFeedbackDestinations()
  if (!destinations.length) {
    throw new Error('feedback_delivery_not_configured')
  }

  const enrichment = await enrichFeedbackPayload(payload, {
    deliveryMode: options.deliveryMode || 'direct',
  })

  const tasks = destinations.map(async (destination) => {
    if (destination === 'slack') {
      await deliverToSlack(payload, enrichment)
      return destination
    }
    await deliverToResend(payload, enrichment)
    return destination
  })

  const results = await Promise.allSettled(tasks)
  const delivered = results
    .filter((result): result is PromiseFulfilledResult<DeliveryChannel> => result.status === 'fulfilled')
    .map((result) => result.value)
  const failures = results
    .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
    .map((result) => String(result.reason instanceof Error ? result.reason.message : result.reason))

  if (!delivered.length) {
    throw new Error(failures[0] || 'feedback_delivery_failed')
  }

  if (failures.length) {
    logError({
      reqId: payload.feedbackId,
      route: 'feedback/delivery',
      userKey: payload.authUser.id,
      phase: 'partial_delivery_failure',
      error: failures.join(' | '),
    })
  }

  logInfo({
    reqId: payload.feedbackId,
    route: 'feedback/delivery',
    userKey: payload.authUser.id,
    phase: 'delivered',
    surface: payload.context.surface,
    destinations: delivered.join(','),
    deliveryMode: enrichment.deliveryMode,
    billingMode: enrichment.billingMode,
    modelId: enrichment.modelId,
  })

  return { delivered, failures, enrichment }
}

export async function queueFounderFeedback(payload: FeedbackDispatchPayload) {
  if (!isQstashReady()) {
    throw new Error('feedback_qstash_not_ready')
  }
  const client = getQStash()
  const base = ENV.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000'
  const url = `${base.replace(/\/+$/, '')}/api/feedback/dispatch`
  const message = await client.publishJSON({
    url,
    body: payload,
    retries: FEEDBACK_QSTASH_RETRIES,
  })

  logInfo({
    reqId: payload.feedbackId,
    route: 'feedback/queue',
    userKey: payload.authUser.id,
    phase: 'queued',
    messageId: message.messageId,
    dispatchTarget: '/api/feedback/dispatch',
  })

  return { messageId: message.messageId }
}
