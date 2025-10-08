import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ENV, isZhipuReady } from '@/lib/env'
import { logInfo } from '@/lib/logger'

export type SummaryJSON = Record<string, unknown>
export type SummaryResult = { summary_json: SummaryJSON; tokens: number }

function fallbackSummary(text: string, lang: string): SummaryResult {
  const trimmed = (text || '').trim()
  const tokens = Math.ceil(trimmed.length / 4) // 粗略估算
  return {
    summary_json: {
      lang,
      length: trimmed.length,
      preview: trimmed.slice(0, 280),
    },
    tokens,
  }
}

function clampText(text: string) {
  const t = (text || '').trim()
  if (t.length <= ENV.SUMMARY_MAX_CHARS) return t
  return t.slice(0, ENV.SUMMARY_MAX_CHARS)
}

function approxTokens(s: string) {
  return Math.ceil((s || '').length / 4)
}

function makeZhipu(model: string, maxTokens?: number) {
  // 根据模型类型和用途设置合适的token限制
  let defaultMaxTokens = 4000 // 默认值，足够生成结构化JSON

  // Vision模型需要更多token来处理图像内容
  if (
    model.includes('thinking') ||
    model.includes('vision') ||
    model.includes('1v')
  ) {
    defaultMaxTokens = 8000
  }

  // Flash模型通常用于快速响应，但仍需足够空间
  if (model.includes('flash')) {
    defaultMaxTokens = 6000
  }

  return new ChatZhipuAI({
    apiKey: ENV.ZHIPUAI_API_KEY,
    model,
    temperature: 0.3,
    maxTokens: maxTokens ?? defaultMaxTokens,
  })
}

function escapeBraces(s: string) {
  return (s || '').replace(/\{/g, '{{').replace(/\}/g, '}}')
}

async function runSummary(
  kind: 'resume' | 'detailed' | 'jd',
  text: string,
  lang: string,
  debug?: { reqId?: string; route?: string; userKey?: string }
): Promise<SummaryResult> {
  const trimmed = clampText(text)
  if (!isZhipuReady()) {
    // 无密钥：安全回退到本地摘要
    return fallbackSummary(trimmed, lang)
  }
  // 根据任务类型设置合适的token限制
  const maxTokensByTask = {
    resume: 8000, // 简历抽取，内容相对简洁
    jd: 8000, // JD抽取，内容相对简洁
    detailed: 30000, // 详细履历，需要更多空间生成summary
  }
  const model = makeZhipu(ENV.ZHIPU_TEXT_MODEL, maxTokensByTask[kind])

  // Prompt 优化：加入 Identity / Instructions / Context / user_message
  const jsonSchema = {
    resume: {
      education: 'string[]',
      overview: 'string',
      highlights: 'string[]',
      key_skills: 'string[]',
      risks: 'string[]',
      working_experience: 'string[]',
      projects: 'string[]',
    },
    detailed: {
      overview: 'string',
      working_experience_detail: 'string[]',
      projects_detail: 'string[]',
      achievements_detail: 'string[]',
      risks_detail: 'string[]',
    },
    jd: {
      role: 'string',
      responsibilities: 'string[]',
      requirements: 'string[]',
      must_have: 'string[]',
      nice_to_have: 'string[]',
      risks: 'string[]',
    },
  }[kind]

  const schemaKeys = Object.keys(jsonSchema).join(', ')
  const skeletonObj: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(jsonSchema)) {
    skeletonObj[k] = v.endsWith('[]') ? [] : ''
  }
  const skeleton = JSON.stringify(skeletonObj, null, 2)
  const skeletonEscaped = escapeBraces(skeleton)

  // 根据任务类型设置不同的处理策略
  const taskInstructions = {
    resume: [
      '- EXTRACTION MODE: Extract information directly from the original text.',
      '- Preserve original wording and structure where possible. Especially for key_skills to keep complete skill descriptions.',
      '- Focus on factual content extraction rather than summarization.',
    ],
    jd: [
      '- EXTRACTION MODE: Extract information directly from the original text.',
      '- Preserve original wording and structure where possible.',
      '- Focus on factual content extraction rather than summarization.',
    ],
    detailed: [
      // '- SUMMARY MODE: Synthesize and condense information within token limits.',
      // '- Prioritize key achievements, quantifiable results, and unique experiences.',
      // '- Create comprehensive summaries that capture essential details.',
      '- EXTRACTION MODE: Extract information directly from the original text.',
      '- Preserve original wording and structure where possible.',
      '- Focus on factual content extraction rather than summarization.',
    ],
  }[kind]

  const system = [
    '# Identity',
    `You are a ${lang} career assistant specializing in processing ${kind} content.`,
    '',
    '# Processing Strategy',
    ...taskInstructions,
    '',
    '# Instructions',
    '- Output ONLY raw JSON (no Markdown, no prose, no code fences).',
    '- Use the specified keys exactly; do not add extra keys.',
    '- Be concise and faithful to input; avoid fabrication.',
    '- If information is missing, still return all keys with empty string/array.',
    '- Language: strictly use the target language indicated below.',
    '',
    '# Output Format',
    `- A single JSON object with keys: ${schemaKeys}`,
    '- Example JSON skeleton (values illustrative, do not copy literally):',
    skeletonEscaped,
  ]
    .filter(Boolean)
    .join('\n')

  const user = [
    '# Context',
    'The input text is delimited by triple backticks.',
    '```',
    escapeBraces(trimmed),
    '```',
    '',
    '# Task',
    `Summarize the ${kind} and populate ONLY the JSON fields described above.`,
    '',
    '# Constraints',
    `- Respond in ${lang}.`,
    '- Do not include any explanation, labels, or extra formatting—just raw JSON.',
  ].join('\n')

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', system],
    ['user', user],
  ])

  const chain = prompt.pipe(model)
  let res: unknown
  try {
    res = await chain.invoke({})
  } catch {
    // 调用失败：回退到本地摘要，避免抛错中断服务
    return fallbackSummary(trimmed, lang)
  }
  const raw = res as {
    content?: unknown
    additional_kwargs?: any
    response_metadata?: any
  }
  // 原始返回体完整输出（避免 JSON.stringify 截断）
  if (debug) {
    console.log('=== LLM RAW DUMP START ===')
    console.log('reqId:', debug.reqId ?? 'unknown')
    console.log('content type:', typeof raw?.content)
    console.log('content length:', String(raw?.content || '').length)
    console.log('content full text:')
    console.log(raw?.content || '')
    console.log('additional_kwargs:')
    console.log(JSON.stringify(raw?.additional_kwargs || {}, null, 2))
    console.log('response_metadata:')
    console.log(JSON.stringify(raw?.response_metadata || {}, null, 2))
    console.log('=== LLM RAW DUMP END ===')
  }
  // 调试：记录原始结构的关键形状
  if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'llm/summarize',
      userKey: debug.userKey ?? 'unknown',
      phase: 'llm_raw',
      has_content: !!raw?.content,
      has_additional: !!raw?.additional_kwargs,
      has_metadata: !!raw?.response_metadata,
      content_type: Array.isArray(raw?.content) ? 'array' : typeof raw?.content,
    })
  }
  const content = raw?.content ?? ''
  let textOut =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
      ? (content as Array<{ text?: string }>).map((c) => c?.text ?? '').join('')
      : String(content)

  // 若 content 为空，尝试从 tool_calls / function_call 中提取 JSON arguments
  if (!textOut || !String(textOut).trim()) {
    const ak = raw?.additional_kwargs ?? {}
    const rm = raw?.response_metadata ?? {}
    const tc = ak?.tool_calls || rm?.tool_calls
    const fc = ak?.function_call || rm?.function_call
    try {
      if (Array.isArray(tc) && tc[0]?.function?.arguments) {
        textOut = String(tc[0].function.arguments)
      } else if (fc?.arguments) {
        textOut = String(fc.arguments)
      } else if (typeof rm?.content === 'string') {
        textOut = rm.content
      }
    } catch {
      // ignore
    }
    if (debug) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'llm/summarize',
        userKey: debug.userKey ?? 'unknown',
        phase: 'llm_fallback_extract',
        used_tool_calls: Array.isArray(tc),
        used_function_call: !!fc,
        textOut_len: String(textOut || '').length,
      })
    }
  }

  // ---- 规范化与健壮解析 ----
  function stripCodeFences(s: string) {
    let t = s.trim()
    t = t.replace(/^```(?:json)?\s*/i, '')
    t = t.replace(/\s*```$/i, '')
    return t
  }
  function cleanInvisible(s: string) {
    return s.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\uFEFF]/g, '')
  }
  function normalizeQuotes(s: string) {
    // 统一各种引号到标准双引号
    let t = s.replace(/[“”]/g, '"').replace(/[‘’]/g, '"')
    // 替换全角空格为半角，避免 JSON 解析误判
    t = t.replace(/\u3000/g, ' ')
    return t
  }
  function removeTrailingCommas(s: string) {
    // 移除对象和数组中的尾逗号
    return s.replace(/,\s*([}\]])/g, '$1')
  }
  function escapeUnescapedNewlinesInStrings(s: string) {
    // 将字符串字面量中的裸换行替换为 \n，避免 "Unterminated string" 错误
    // 正确处理转义字符：需要计算连续反斜杠的数量
    let out = ''
    let inStr = false
    for (let i = 0; i < s.length; i++) {
      const c = s[i]

      if (c === '"') {
        // 计算前面连续反斜杠的数量
        let backslashCount = 0
        for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) {
          backslashCount++
        }
        // 如果反斜杠数量为偶数（包括0），则引号未被转义
        if (backslashCount % 2 === 0) {
          inStr = !inStr
        }
        out += c
      } else if (inStr && (c === '\n' || c === '\r')) {
        out += '\\n'
      } else {
        out += c
      }
    }
    return out
  }
  function escapeUnescapedQuotesInStrings(s: string) {
    // 转义字符串字面量中的未转义引号，避免JSON解析错误
    let out = ''
    let inStr = false
    let i = 0

    while (i < s.length) {
      const c = s[i]

      if (c === '"') {
        // 计算前面连续反斜杠的数量
        let backslashCount = 0
        for (let j = i - 1; j >= 0 && s[j] === '\\'; j--) {
          backslashCount++
        }

        // 如果反斜杠数量为偶数（包括0），则引号未被转义
        if (backslashCount % 2 === 0) {
          if (!inStr) {
            // 字符串开始
            inStr = true
            out += c
          } else {
            // 在字符串内部，需要检查这是否是字符串结束
            // 简单策略：查看后面是否跟着逗号、冒号、}、]等JSON分隔符
            let nextNonSpace = i + 1
            while (nextNonSpace < s.length && /\s/.test(s[nextNonSpace])) {
              nextNonSpace++
            }
            const nextChar = nextNonSpace < s.length ? s[nextNonSpace] : ''

            if (
              nextChar === ',' ||
              nextChar === '}' ||
              nextChar === ']' ||
              nextChar === ':' ||
              nextNonSpace >= s.length
            ) {
              // 这是字符串结束
              inStr = false
              out += c
            } else {
              // 这是字符串内部的引号，需要转义
              out += '\\"'
            }
          }
        } else {
          // 已经转义的引号，直接添加
          out += c
        }
      } else {
        out += c
      }
      i++
    }
    return out
  }
  function extractTopLevelJSON(s: string) {
    // 字符串感知的括号扫描：忽略引号内的括号与转义
    let firstBrace = -1
    for (let i = 0; i < s.length; i++) {
      const ch = s[i]
      if (ch === '{' || ch === '[') {
        firstBrace = i
        break
      }
    }
    if (firstBrace < 0) return ''
    const openCh = s[firstBrace]
    const closeCh = openCh === '{' ? '}' : ']'
    let depth = 0
    let inStr = false
    let prev = ''
    for (let i = firstBrace; i < s.length; i++) {
      const c = s[i]
      if (c === '"' && prev !== '\\') {
        inStr = !inStr
      }
      if (!inStr) {
        if (c === openCh) depth++
        else if (c === closeCh) depth--
      }
      if (depth === 0) {
        return s.slice(firstBrace, i + 1)
      }
      prev = c
    }
    return ''
  }

  const step1 = stripCodeFences(String(textOut || ''))
  const step2 = cleanInvisible(step1)
  const preClean = normalizeQuotes(step2)
  const segment = extractTopLevelJSON(preClean) || preClean
  const step3 = removeTrailingCommas(segment)
  const step4 = escapeUnescapedNewlinesInStrings(step3)
  const cleaned = escapeUnescapedQuotesInStrings(step4)

  if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'llm/summarize',
      userKey: debug.userKey ?? 'unknown',
      phase: 'llm_json_clean_steps',
      original_len: String(textOut || '').length,
      step1_len: step1.length,
      step2_len: step2.length,
      preClean_len: preClean.length,
      segment_len: segment.length,
      step3_len: step3.length,
      step4_len: step4.length,
      cleaned_len: cleaned.length,
      cleaned_around_698: cleaned.slice(690, 710),
    })
  }

  if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'llm/summarize',
      userKey: debug.userKey ?? 'unknown',
      phase: 'llm_json_clean',
      clean_len: cleaned.length,
      clean_head: cleaned.slice(0, 220),
    })
  }

  let parsed: SummaryJSON
  try {
    parsed = JSON.parse(cleaned || '{}')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'parse_error'
    // 提取错误位置附近的内容
    let errorContext = ''
    if (msg.includes('position')) {
      const match = msg.match(/position (\d+)/)
      if (match) {
        const pos = parseInt(match[1])
        const start = Math.max(0, pos - 50)
        const end = Math.min(cleaned.length, pos + 50)
        errorContext = cleaned.slice(start, end)
      }
    }

    if (debug) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'llm/summarize',
        userKey: debug.userKey ?? 'unknown',
        phase: 'llm_parse_error',
        error: msg,
        error_context: errorContext,
        cleaned_sample: cleaned.slice(0, 500),
      })
    }
    parsed = {}
  }
  if (debug) {
    const keys = Object.keys(parsed || {})
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'llm/summarize',
      userKey: debug.userKey ?? 'unknown',
      phase: 'llm_parsed',
      parsed_keys_count: keys.length,
      parsed_keys_sample: keys.slice(0, 8),
      textOut_head: String(textOut || '').slice(0, 220),
    })
  }

  // 规范化：若缺失目标键，自动补齐为空数组/空字符串
  const expected = {
    resume: {
      education: 'string[]',
      overview: 'string',
      highlights: 'string[]',
      key_skills: 'string[]',
      risks: 'string[]',
      working_experience: 'string[]',
      projects: 'string[]',
    },
    detailed: {
      overview: 'string',
      working_experience_detail: 'string[]',
      projects_detail: 'string[]',
      achievements_detail: 'string[]',
      risks_detail: 'string[]',
    },
    jd: {
      role: 'string',
      responsibilities: 'string[]',
      requirements: 'string[]',
      must_have: 'string[]',
      nice_to_have: 'string[]',
      risks: 'string[]',
    },
  }[kind]
  const normalized: Record<string, unknown> = { ...parsed }
  for (const [k, v] of Object.entries(expected)) {
    if (!(k in normalized)) normalized[k] = v.endsWith('[]') ? [] : ''
  }
  const summary_json = { lang, kind, ...normalized }

  // 优先使用LLM返回的实际token数量，如果没有则回退到估算
  const llmTokens =
    raw?.response_metadata?.tokenUsage?.totalTokens ||
    raw?.response_metadata?.token_usage?.total_tokens ||
    raw?.additional_kwargs?.usage?.total_tokens
  const tokens = llmTokens || approxTokens(trimmed) + approxTokens(textOut)

  if (debug) {
    logInfo({
      reqId: debug.reqId ?? 'unknown',
      route: debug.route ?? 'llm/summarize',
      userKey: debug.userKey ?? 'unknown',
      phase: 'llm_done',
      tokens,
      llm_tokens: llmTokens,
      estimated_tokens: approxTokens(trimmed) + approxTokens(textOut),
      keys_count: Object.keys(summary_json).length,
    })
  }
  return { summary_json, tokens }
}

export async function summarizeResume(
  text: string,
  lang: string,
  debug?: { reqId?: string; route?: string; userKey?: string }
): Promise<SummaryResult> {
  return runSummary('resume', text, lang, debug)
}

export async function summarizeDetailed(
  text: string,
  lang: string,
  debug?: { reqId?: string; route?: string; userKey?: string }
): Promise<SummaryResult> {
  return runSummary('detailed', text, lang, debug)
}

export async function summarizeJD(
  text: string,
  lang: string,
  debug?: { reqId?: string; route?: string; userKey?: string }
): Promise<SummaryResult> {
  return runSummary('jd', text, lang, debug)
}

// 视觉抽取：输入 base64（包含 mime 前缀），返回纯文本
export async function extractTextFromMedia(
  mediaBase64: string,
  lang: string,
  debug?: { reqId?: string; route?: string; userKey?: string }
): Promise<string> {
  const visionModelName = ENV.ZHIPU_VISION_MODEL || 'glm-4.1v-thinking-flash'
  if (!isZhipuReady()) {
    // 无密钥：直接返回空文本，避免抛错
    return ''
  }
  // Vision模型需要更多token来处理复杂的图像内容
  const model = makeZhipu(visionModelName, 10000)

  // Prompt 优化：OCR 的 Identity / Instructions / Context / user_message
  const system = [
    '# Identity',
    `You are an OCR assistant that returns ONLY plain text in ${lang}.`,
    '',
    '# Instructions',
    '- Extract raw textual content faithfully; preserve natural reading order.',
    '- Return ONLY plain text (no labels, no metadata, no Markdown).',
    '- If no text is present, return an empty string.',
    '- Avoid fabrication; do not infer content that is not visible.',
  ].join('\n')

  // 保留多模态输入（image_url），并强化第一段文本的约束与上下文说明
  const userParts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    {
      type: 'text',
      text: [
        '# Context',
        'The image/PDF data is provided below.',
        '',
        '# Task',
        `Extract raw text content in ${lang}, preserving reading order.`,
        '',
        '# Constraints',
        '- Output ONLY the plain text; do not add any explanations.',
      ].join('\n'),
    },
    { type: 'image_url', image_url: { url: mediaBase64 } },
  ]

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', system],
    // 将多模态内容传入模型；保留现有类型转换避免编译错误
    ['user', userParts as unknown as string],
  ])

  const chain = prompt.pipe(model)
  let res: unknown
  try {
    res = await chain.invoke({})
  } catch {
    // 视觉模型调用失败：回退为空文本，避免服务失败
    return ''
  }
  // 原始返回体完整输出（避免 JSON.stringify 截断）
  if (debug) {
    console.log('=== VISION RAW DUMP START ===')
    console.log('reqId:', debug.reqId ?? 'unknown')
    console.log('vision response type:', typeof res)
    console.log('vision content type:', typeof (res as any)?.content)
    console.log(
      'vision content length:',
      String((res as any)?.content || '').length
    )
    console.log('vision content full text:')
    console.log((res as any)?.content || '')
    console.log('vision additional_kwargs:')
    console.log(JSON.stringify((res as any)?.additional_kwargs || {}, null, 2))
    console.log('vision response_metadata:')
    console.log(JSON.stringify((res as any)?.response_metadata || {}, null, 2))
    console.log('=== VISION RAW DUMP END ===')
  }
  const content = (res as { content?: unknown })?.content ?? ''
  const textOut =
    typeof content === 'string'
      ? content
      : Array.isArray(content)
      ? (content as Array<{ text?: string }>)
          .map((c) => c?.text ?? '')
          .join('\n')
      : String(content)

  // 清理模型可能输出的思考/推理内容，例如 <think>...</think>
  function stripReasoning(s: string) {
    let t = s || ''
    // 移除明确的 <think> 标签包裹内容（跨行）
    t = t.replace(/<think[\s\S]*?<\/think>/gi, '')
    // 移除常见的思考提示（中文/英文），保留剩余纯文本
    t = t.replace(/^\s*思考[:：][\s\S]*?\n+/gi, '')
    t = t.replace(/^\s*Reasoning[:：][\s\S]*?\n+/gi, '')
    return t
  }

  return stripReasoning((textOut || '').trim())
}
