/**
 * OCR Service using LLM Scheduler and Prompt Templates
 * 
 * This service provides OCR text extraction capabilities using
 * the unified llm-scheduler and prompt template system.
 */

import { runLlmTask } from '@/lib/llm/service'
import { logInfo, logError } from '../logger'

/**
 * OCR extraction result interface
 */
export interface OCRResult {
  success: boolean
  extractedText?: string
  contentType?: string
  language?: string
  structure?: {
    has_tables: boolean
    has_lists: boolean
    sections: string[]
  }
  confidence?: number
  notes?: string[]
  error?: string
}

/**
 * OCR Service class
 */
export class OCRService {
  constructor() {}

  /**
   * Extract text from media using vision model
   */
  async extractTextFromMedia(
    mediaBase64: string,
    sourceType: string,
    userId: string,
    serviceId: string
  ): Promise<OCRResult> {
    const startTime = Date.now()
    
    try {
      logInfo({
        reqId: `ocr_${serviceId}`,
        route: 'ocr/extract',
        userKey: userId,
        sourceType,
        mediaSize: mediaBase64.length
      })

      // Execute OCR using unified LLM service with vision routing
      const result = await runLlmTask('ocr_extract', 'en', {
        image: mediaBase64,
        source_type: sourceType,
      }, { tier: 'free', hasImage: true, temperature: 0.1, maxTokens: 8000 })

      if (!result.ok || !result.data) {
        logError({
          reqId: `ocr_${serviceId}`,
          route: 'ocr/extract',
          userKey: userId,
          error: result.error || 'OCR extraction failed',
          durationMs: Date.now() - startTime
        })

        return {
          success: false,
          error: result.error || 'OCR extraction failed'
        }
      }

      // Parse structured OCR result
      const ocrData = result.data as unknown as {
        extracted_text: string
        content_type: string
        language: string
        structure: { has_tables: boolean; has_lists: boolean; sections: string[] }
        confidence?: number
        notes?: string[]
      }

      if (!ocrData) {
        return {
          success: false,
          error: 'Failed to parse OCR response'
        }
      }

      // Clean up the extracted text
      const cleanedText = this.cleanExtractedText(ocrData.extracted_text)

      logInfo({
        reqId: `ocr_${serviceId}`,
        route: 'ocr/extract',
        userKey: userId,
        contentType: ocrData.content_type,
        language: ocrData.language,
        confidence: ocrData.confidence,
        textLength: cleanedText.length,
        durationMs: Date.now() - startTime
      })

      return {
        success: true,
        extractedText: cleanedText,
        contentType: ocrData.content_type,
        language: ocrData.language,
        structure: ocrData.structure,
        confidence: ocrData.confidence ?? 0.95,
        notes: ocrData.notes || []
      }

    } catch (error) {
      logError({
        reqId: `ocr_${serviceId}`,
        route: 'ocr/extract',
        userKey: userId,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown OCR error'
      }
    }
  }

  /**
   * Parse OCR response from LLM (legacy fallback for providers returning raw JSON text)
   */
  private parseOCRResponse(content: string): {
    extracted_text: string
    content_type: string
    language: string
    structure: {
      has_tables: boolean
      has_lists: boolean
      sections: string[]
    }
    confidence: number
    notes?: string[]
  } | null {
    try {
      // Extract JSON from the response content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        return null
      }

      const jsonStr = jsonMatch[0]
      const parsed = JSON.parse(jsonStr)

      // Validate required fields
      if (!parsed.extracted_text || !parsed.content_type || !parsed.language) {
        return null
      }

      return {
        extracted_text: parsed.extracted_text,
        content_type: parsed.content_type,
        language: parsed.language,
        structure: parsed.structure || {
          has_tables: false,
          has_lists: false,
          sections: []
        },
        confidence: parsed.confidence || 0.95,
        notes: parsed.notes
      }
    } catch (error) {
      logError({
        reqId: 'parseOCRResponse',
        route: 'ocr-service',
        userKey: 'system',
        phase: 'parse_error',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      return null
    }
  }

  /**
   * Clean and normalize extracted text
   */
  private cleanExtractedText(text: string): string {
    if (!text) return ''

    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove multiple consecutive line breaks
      .replace(/\n{3,}/g, '\n\n')
      // Remove trailing spaces on each line
      .split('\n')
      .map(line => line.trim())
      .join('\n')
  }

  /**
   * Check if media content needs OCR extraction
   */
  static needsOCRExtraction(sourceType: string): boolean {
    const ocrTypes = ['image', 'pdf_scan', 'screenshot', 'photo']
    return ocrTypes.includes(sourceType.toLowerCase())
  }

  /**
   * Get OCR service instance (singleton pattern)
   */
  private static instance: OCRService | null = null

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService()
    }
    return OCRService.instance
  }
}

/**
 * Convenience function for OCR extraction
 */
export async function extractTextFromMedia(
  mediaBase64: string,
  sourceType: string,
  userId: string,
  serviceId: string
): Promise<OCRResult> {
  const ocrService = OCRService.getInstance()
  return ocrService.extractTextFromMedia(mediaBase64, sourceType, userId, serviceId)
}

/**
 * Check if content needs OCR processing
 */
export function needsOCRExtraction(sourceType: string): boolean {
  return OCRService.needsOCRExtraction(sourceType)
}