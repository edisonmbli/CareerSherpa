/**
 * Gemini Direct API Integration
 *
 * This module bypasses LangChain and uses the official @google/genai SDK directly.
 * Motivation: LangChain's ChatGoogleGenerativeAI has compatibility issues with Gemini 3:
 * - frequencyPenalty/presencePenalty not properly passed
 * - withStructuredOutput behavior inconsistent
 * - Temperature settings not following Gemini 3 requirements
 *
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 * @see https://ai.google.dev/gemini-api/docs/gemini-3
 */

import { GoogleGenAI } from '@google/genai'
import { logDebug, logError } from '@/lib/logger'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodSchema } from 'zod'

// Initialize Gemini client (singleton)
let geminiClient: GoogleGenAI | null = null

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    const apiKey = process.env['GEMINI_API_KEY']
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set')
    }
    geminiClient = new GoogleGenAI({ apiKey })
  }
  return geminiClient
}

export interface GeminiDirectConfig {
  model?: string
  maxOutputTokens?: number
  temperature?: number // Default 1.0 for Gemini 3
  timeoutMs?: number
  // NOTE: frequencyPenalty/presencePenalty removed - not supported by gemini-3-flash-preview
}

export interface GeminiDirectResult {
  ok: boolean
  data?: any
  raw?: string
  usage?: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
  }
  error?: string
}

function withTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Gemini timeout')), timeoutMs)
  })
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId)
  }) as Promise<T>
}

/**
 * Execute a structured output task using Gemini Direct API
 *
 * @param systemPrompt - System message/instructions
 * @param userPrompt - User message with variables already rendered
 * @param schema - Zod schema for structured output
 * @param config - Optional configuration overrides
 * @returns Parsed structured data or error
 */
export async function runGeminiStructured<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T>,
  config: GeminiDirectConfig = {},
): Promise<GeminiDirectResult> {
  const start = Date.now()

  try {
    const client = getGeminiClient()
    const model = config.model || 'gemini-3-flash-preview'
    const isGemini3 = model.includes('gemini-3')

    // CRITICAL: Gemini 3 requires temperature=1.0 to prevent looping
    // We override any lower settings from general config
    const temperature = isGemini3 ? 1.0 : (config.temperature ?? 1.0)

    // Convert Zod schema to JSON Schema for Gemini's responseJsonSchema
    const jsonSchema = zodToJsonSchema(schema)

    logDebug({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'structured_start',
      meta: {
        model,
        temperature,
        maxOutputTokens: config.maxOutputTokens ?? 8000,
      },
    })

    // Combine system and user prompt per Gemini 3 best practices:
    // "place your specific instructions at the end of the prompt, after the data context"
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`

    const response = await withTimeout(
      client.models.generateContent({
        model,
        contents: fullPrompt,
        config: {
          // Gemini 3 recommended settings
          temperature,
          maxOutputTokens: config.maxOutputTokens ?? 8000,
          // NOTE: frequencyPenalty/presencePenalty NOT supported by gemini-3-flash-preview
          // Structured output configuration
          responseMimeType: 'application/json',
          responseSchema: jsonSchema as any,
        },
      }),
      config.timeoutMs,
    )

    const elapsed = Date.now() - start
    const rawText = response.text || ''

    // Extract usage metrics - filter out undefined values for exactOptionalPropertyTypes
    const usageMetadata = response.usageMetadata
    const usage: GeminiDirectResult['usage'] = usageMetadata
      ? {
          ...(usageMetadata.promptTokenCount !== undefined && {
            inputTokens: usageMetadata.promptTokenCount,
          }),
          ...(usageMetadata.candidatesTokenCount !== undefined && {
            outputTokens: usageMetadata.candidatesTokenCount,
          }),
          ...(usageMetadata.totalTokenCount !== undefined && {
            totalTokens: usageMetadata.totalTokenCount,
          }),
        }
      : undefined

    logDebug({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'structured_response',
      meta: {
        elapsedMs: elapsed,
        rawLength: rawText.length,
        usage,
      },
    })

    // Parse and validate with Zod
    let parsed: T
    try {
      const jsonData = JSON.parse(rawText)
      parsed = schema.parse(jsonData)
    } catch (parseError: any) {
      logError({
        reqId: 'llm',
        route: 'llm/gemini-direct',
        phase: 'structured_parse_error',
        error: parseError.message,
        meta: { rawPreview: rawText.slice(0, 500) },
      })
      return {
        ok: false,
        raw: rawText,
        ...(usage && { usage }),
        error: `Parse error: ${parseError.message}`,
      }
    }

    return {
      ok: true,
      data: parsed,
      raw: rawText,
      ...(usage && { usage }),
    }
  } catch (error: any) {
    logError({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'structured_api_error',
      error: error.message || error,
    })
    return {
      ok: false,
      error: error.message || 'Unknown Gemini API error',
    }
  }
}

/**
 * Execute a vision (OCR) task using Gemini Direct API
 *
 * @param systemPrompt - System message/instructions
 * @param userPrompt - User message with variables already rendered
 * @param imageData - Base64 encoded image data OR a data URL (e.g., "data:image/jpeg;base64,...")
 * @param schema - Zod schema for structured output
 * @param config - Optional configuration overrides
 * @returns Parsed structured data or error
 */
export async function runGeminiVision<T>(
  systemPrompt: string,
  userPrompt: string,
  imageData: string,
  schema: ZodSchema<T>,
  config: GeminiDirectConfig = {},
): Promise<GeminiDirectResult> {
  const start = Date.now()

  try {
    const client = getGeminiClient()
    const model = config.model || 'gemini-3-flash-preview'
    const isGemini3 = model.includes('gemini-3')

    // CRITICAL: Gemini 3 requires temperature=1.0 to prevent looping
    const temperature = isGemini3 ? 1.0 : (config.temperature ?? 1.0)

    // Convert Zod schema to JSON Schema
    const jsonSchema = zodToJsonSchema(schema)

    // Parse image data - handle both data URL and raw base64
    let base64Data: string
    let mimeType: string = 'image/jpeg' // default

    if (imageData.startsWith('data:')) {
      // Data URL format: data:image/jpeg;base64,XXXXX
      const match = imageData.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1]!
        base64Data = match[2]!
      } else {
        throw new Error('Invalid data URL format')
      }
    } else {
      // Raw base64 string
      base64Data = imageData
    }

    logDebug({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'vision_start',
      meta: {
        model,
        temperature,
        maxOutputTokens: config.maxOutputTokens ?? 8000,
        imageSizeKB: Math.round((base64Data.length * 0.75) / 1024),
        mimeType,
      },
    })

    // Build contents array with inline image data per Gemini vision API
    // Format: [{ inlineData: { mimeType, data } }, { text: "..." }]
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`

    const response = await withTimeout(
      client.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          { text: fullPrompt },
        ],
        config: {
          temperature,
          maxOutputTokens: config.maxOutputTokens ?? 8000,
          // NOTE: frequencyPenalty/presencePenalty NOT supported by gemini-3-flash-preview
          // Structured output configuration
          responseMimeType: 'application/json',
          responseSchema: jsonSchema as any,
        },
      }),
      config.timeoutMs,
    )

    const elapsed = Date.now() - start
    const rawText = response.text || ''

    // Extract usage metrics
    const usageMetadata = response.usageMetadata
    const usage: GeminiDirectResult['usage'] = usageMetadata
      ? {
          ...(usageMetadata.promptTokenCount !== undefined && {
            inputTokens: usageMetadata.promptTokenCount,
          }),
          ...(usageMetadata.candidatesTokenCount !== undefined && {
            outputTokens: usageMetadata.candidatesTokenCount,
          }),
          ...(usageMetadata.totalTokenCount !== undefined && {
            totalTokens: usageMetadata.totalTokenCount,
          }),
        }
      : undefined

    logDebug({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'vision_response',
      meta: {
        elapsedMs: elapsed,
        rawLength: rawText.length,
        usage,
      },
    })

    // Parse and validate with Zod
    let parsed: T
    try {
      const jsonData = JSON.parse(rawText)
      parsed = schema.parse(jsonData)
    } catch (parseError: any) {
      logError({
        reqId: 'llm',
        route: 'llm/gemini-direct',
        phase: 'vision_parse_error',
        error: parseError.message,
        meta: { rawPreview: rawText.slice(0, 500) },
      })
      return {
        ok: false,
        raw: rawText,
        ...(usage && { usage }),
        error: `Parse error: ${parseError.message}`,
      }
    }

    return {
      ok: true,
      data: parsed,
      raw: rawText,
      ...(usage && { usage }),
    }
  } catch (error: any) {
    logError({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'vision_api_error',
      error: error.message || error,
    })
    return {
      ok: false,
      error: error.message || 'Unknown Gemini Vision API error',
    }
  }
}

/**
 * Execute a streaming structured output task using Gemini Direct API
 *
 * @param systemPrompt - System message/instructions
 * @param userPrompt - User message with variables already rendered
 * @param schema - Zod schema for structured output (optional, for JSON mode)
 * @param config - Optional configuration overrides
 * @param onToken - Callback for each token chunk
 * @returns Final parsed result or raw text
 */
export async function runGeminiStreaming<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: ZodSchema<T> | null,
  config: GeminiDirectConfig = {},
  onToken?: (text: string) => void | Promise<void>,
  imageData?: string,
): Promise<GeminiDirectResult> {
  const start = Date.now()

  try {
    const client = getGeminiClient()
    const model = config.model || 'gemini-3-flash-preview'
    const isGemini3 = model.includes('gemini-3')

    // CRITICAL: Gemini 3 requires temperature=1.0 to prevent looping
    const temperature = isGemini3 ? 1.0 : (config.temperature ?? 1.0)

    // Convert Zod schema to JSON Schema if provided
    const jsonSchema = schema ? zodToJsonSchema(schema) : null

    logDebug({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'stream_start',
      meta: {
        model,
        temperature,
        maxOutputTokens: config.maxOutputTokens ?? 8000,
        hasSchema: !!schema,
      },
    })

    // Combine system and user prompt per Gemini 3 best practices
    const fullPrompt = `${systemPrompt}\n\n---\n\n${userPrompt}`

    // Prepare contents
    let contents: any = fullPrompt
    if (imageData) {
      // Parse image data
      let base64Data: string
      let mimeType: string = 'image/jpeg'

      // Remove whitespace/newlines
      const cleanImageData = imageData.replace(/[\r\n\s]/g, '')

      if (cleanImageData.startsWith('data:')) {
        const match = cleanImageData.match(/^data:([^;]+);base64,(.+)$/)
        if (match) {
          mimeType = match[1]!
          base64Data = match[2]!
        } else {
          const parts = cleanImageData.split(',')
          if (parts.length === 2) {
            const meta = parts[0]!
            const data = parts[1]!
            const mimeMatch = meta.match(/data:([^;]+);base64/)
            if (mimeMatch) {
              mimeType = mimeMatch[1]!
              base64Data = data
            } else {
              base64Data = cleanImageData.replace(
                /^data:image\/[a-z]+;base64,/,
                '',
              )
            }
          } else {
            base64Data = cleanImageData.replace(
              /^data:image\/[a-z]+;base64,/,
              '',
            )
          }
        }
      } else {
        base64Data = cleanImageData
      }

      logDebug({
        reqId: 'llm',
        route: 'llm/gemini-direct',
        phase: 'stream_vision_start',
        meta: {
          mimeType,
          sizeKB: Math.round(base64Data.length / 1024),
        },
      })

      contents = [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: base64Data,
              },
            },
            { text: fullPrompt },
          ],
        },
      ]
    } else {
      contents = [
        {
          role: 'user',
          parts: [{ text: fullPrompt }],
        },
      ]
    }

    // Use streaming API
    const stream = await withTimeout(
      client.models.generateContentStream({
        model,
        contents,
        config: {
          temperature,
          maxOutputTokens: config.maxOutputTokens ?? 8000,
          // NOTE: frequencyPenalty/presencePenalty NOT supported by gemini-3-flash-preview
          // Enable JSON mode if schema provided
          ...(jsonSchema
            ? {
                responseMimeType: 'application/json',
                responseSchema: jsonSchema as any,
              }
            : {}),
        },
      }),
      config.timeoutMs,
    )

    let fullText = ''
    try {
      const consumeStream = async () => {
        for await (const chunk of stream) {
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || ''
          fullText += text
          if (text && onToken) {
            await onToken(text)
          }
        }
      }
      await withTimeout(consumeStream(), config.timeoutMs)
    } catch (streamErr) {
      logError({
        reqId: 'llm',
        route: 'llm/gemini-direct',
        phase: 'stream_iteration_error',
        error:
          streamErr instanceof Error ? streamErr.message : String(streamErr),
      })
    }

    const elapsed = Date.now() - start
    logDebug({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'stream_complete',
      meta: {
        elapsedMs: elapsed,
        fullLength: fullText.length,
      },
    })

    // If schema provided, parse and validate
    if (schema) {
      try {
        if (!fullText) {
          throw new Error('Empty response from model')
        }
        const jsonData = JSON.parse(fullText)
        const parsed = schema.parse(jsonData)
        return { ok: true, data: parsed, raw: fullText }
      } catch (parseError: any) {
        logError({
          reqId: 'llm',
          route: 'llm/gemini-direct',
          phase: 'stream_parse_error',
          error: parseError.message,
        })
        return {
          ok: false,
          raw: fullText,
          error: `Parse error: ${parseError.message}`,
        }
      }
    }

    // No schema, return raw text
    return { ok: true, data: fullText, raw: fullText }
  } catch (error: any) {
    logError({
      reqId: 'llm',
      route: 'llm/gemini-direct',
      phase: 'stream_api_error',
      error: error.message || error,
    })
    return { ok: false, error: error.message || 'Unknown Gemini API error' }
  }
}

/**
 * Check if Gemini Direct API is available
 */
export function isGeminiDirectReady(): boolean {
  return !!process.env['GEMINI_API_KEY']
}

/**
 * Determine if a model ID should use Gemini Direct
 */
export function shouldUseGeminiDirect(modelId: string): boolean {
  return modelId.startsWith('gemini-3') || modelId === 'gemini-3-flash-preview'
}
