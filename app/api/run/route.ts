import { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertConfig, config } from '@/lib/config'
import { createRateLimiter } from '@/lib/ratelimit'
import { computeIdempotencyKey, checkAndRemember } from '@/lib/idempotency'
import { streamChatCompletion, ChatMessage } from '@/lib/openai'

export const runtime = 'nodejs'

const limiter = createRateLimiter({
  concurrency: config.rateLimit.concurrency,
  perMinute: config.rateLimit.perMinute,
  trialMaxRuns: config.rateLimit.trialMaxRuns,
})

const BodySchema = z.object({
  prompt: z.string().min(1),
  mode: z.enum(['resume', 'cover', 'interview']).default('resume'),
  resumeText: z.string().optional(),
  jobDesc: z.string().optional(),
  language: z.enum(['zh', 'en']).default('zh'),
})

function getUserKey(req: NextRequest) {
  // For MVP: prefer header, fallback to ip
  const explicit = req.headers.get('x-user-id')
  if (explicit) return `uid:${explicit}`
  const fwd = req.headers.get('x-forwarded-for') || ''
  const ip = fwd.split(',')[0]?.trim() || '0.0.0.0'
  return `ip:${ip}`
}

function isTrialUser(req: NextRequest) {
  // MVP: if no x-user-id, treat as trial
  return !req.headers.get('x-user-id')
}

export async function POST(req: NextRequest) {
  try {
    assertConfig()
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: 'invalid_body',
          detail: parsed.error.format(),
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }
    const body = parsed.data
    const userKey = getUserKey(req)
    const trial = isTrialUser(req)

    const idemHeader = req.headers.get('idempotency-key')
    const idemKey =
      idemHeader ||
      computeIdempotencyKey(JSON.stringify({ userKey, body, v: 2 }))

    const firstTime = await checkAndRemember(
      idemKey,
      config.idempotency.ttlSeconds * 1000
    )
    if (!firstTime) {
      return new Response(null, {
        status: 204,
        headers: { 'X-Idempotent-Replay': 'true' },
      })
    }

    const can = await limiter.tryStartRun(userKey, trial)
    if (!can.ok) {
      return new Response(
        JSON.stringify({ error: 'rate_limited', reason: can.reason }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' },
        }
      )
    }

    // Build messages
    const sys: ChatMessage = {
      role: 'system',
      content:
        body.language === 'zh'
          ? '你是资深求职助手，擅长简历精修、岗位匹配与面试准备。回答要结构化、清晰、可执行。'
          : 'You are a senior job assistant who excels at resume polishing, job matching, and interview prep. Respond clearly with structured, actionable steps.',
    }
    const user: ChatMessage = {
      role: 'user',
      content: buildUserPrompt(body),
    }

    // Start run
    limiter.onRunStart(userKey, trial)

    const upstream = await streamChatCompletion({
      messages: [sys, user],
      model: config.openai.chatModel,
      temperature: config.openai.temperature,
    })

    // Pipe upstream SSE as-is, and release concurrency on completion
    const reader = upstream.body!.getReader()
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read()
        if (done) {
          controller.close()
          limiter.onRunEnd(userKey)
          return
        }
        controller.enqueue(value)
      },
      cancel() {
        limiter.onRunEnd(userKey)
        reader.releaseLock()
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Idempotency-Key': idemKey,
      },
    })
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: String(e?.message || e),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

function buildUserPrompt(body: z.infer<typeof BodySchema>): string {
  const header =
    body.mode === 'resume'
      ? '【任务】简历精修：'
      : body.mode === 'cover'
      ? '【任务】求职信/投递文案：'
      : '【任务】面试准备：'

  const lang =
    body.language === 'zh'
      ? '请严格使用中文作答。'
      : 'Please answer strictly in English.'

  const ctx =
    [
      body.resumeText ? `候选人简历：\n${body.resumeText}` : undefined,
      body.jobDesc ? `目标岗位描述：\n${body.jobDesc}` : undefined,
    ]
      .filter(Boolean)
      .join('\n\n') || '（无额外上下文）'

  return `${header}
${lang}

用户输入：
${body.prompt}

上下文：
${ctx}

输出要求：
- 使用分节标题与有序/无序列表，结构化呈现。
- 若为“简历精修”，请给出可直接替换的段落/要点版本，并说明修改理由。
- 若为“面试准备”，请输出面试题清单、示范回答框架、追问点与评分要点。
- 请在末尾给出“下一步行动清单”。`
}
