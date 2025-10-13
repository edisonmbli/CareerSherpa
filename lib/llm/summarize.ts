import { ChatZhipuAI } from '@langchain/community/chat_models/zhipuai'
import { ChatPromptTemplate } from '@langchain/core/prompts'
import { ENV, isZhipuReady } from '@/lib/env'
import { logInfo } from '@/lib/logger'

/**
 * Vision-based text extraction from media (images, PDFs)
 * This module now only contains OCR functionality used by service-orchestrator.ts
 * All summary functions have been migrated to the unified template system in orchestrator.ts
 */

function makeZhipu(model: string, maxTokens?: number) {
  if (!ENV.ZHIPUAI_API_KEY) {
    throw new Error('ZHIPUAI_API_KEY is not configured')
  }

  return new ChatZhipuAI({
    apiKey: ENV.ZHIPUAI_API_KEY,
    model: model || ENV.ZHIPU_TEXT_MODEL || 'glm-4.5-flash',
    temperature: 0.1,
    maxTokens: maxTokens || 4000,
    streaming: false,
  })
}

/**
 * Extract text from media using vision model
 * Used by service-orchestrator.ts for OCR functionality
 */
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
        '# Output',
        'Return ONLY the extracted text content, no additional formatting or labels.',
      ].join('\n'),
    },
    {
      type: 'image_url',
      image_url: { url: mediaBase64 },
    },
  ]

  const prompt = ChatPromptTemplate.fromMessages([
    ['system', system],
    ['user', userParts],
  ])

  const chain = prompt.pipe(model)

  try {
    if (debug) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'llm/extractTextFromMedia',
        userKey: debug.userKey ?? 'unknown',
        phase: 'vision_start',
        model: visionModelName,
        lang,
      })
    }

    const res = await chain.invoke({})
    let textOut = ''

    // 提取文本内容
    const content = res?.content ?? ''
    if (typeof content === 'string') {
      textOut = content
    } else if (Array.isArray(content)) {
      textOut = (content as Array<{ text?: string }>)
        .map((c) => c?.text ?? '')
        .join('')
    } else {
      textOut = String(content)
    }

    // 清理输出：移除思维链推理标记
    textOut = textOut
      .replace(/<\|thinking\|>[\s\S]*?<\/\|thinking\|>/g, '')
      .replace(/^thinking:[\s\S]*?(?=\n[^\s])/gm, '')
      .trim()

    if (debug) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'llm/extractTextFromMedia',
        userKey: debug.userKey ?? 'unknown',
        phase: 'vision_success',
        extracted_length: textOut.length,
        has_content: textOut.length > 0,
      })
    }

    return textOut
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'vision_error'
    
    if (debug) {
      logInfo({
        reqId: debug.reqId ?? 'unknown',
        route: debug.route ?? 'llm/extractTextFromMedia',
        userKey: debug.userKey ?? 'unknown',
        phase: 'vision_error',
        error: errorMessage,
      })
    }

    // 视觉提取失败时返回空字符串，让上层处理
    return ''
  }
}
