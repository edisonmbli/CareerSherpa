import { nanoid } from 'nanoid'
import type { 
  LlmCallMetadata, 
  LlmCallResult
} from './types'

/**
 * LLM Call Logger - Simple logging for LLM API calls
 */
export class LlmLogger {
  private callId: string
  private metadata: LlmCallMetadata
  private startTime: Date

  constructor(metadata: Omit<LlmCallMetadata, 'callId'>) {
    this.callId = nanoid()
    this.metadata = { ...metadata, callId: this.callId }
    this.startTime = new Date()
  }

  /**
   * Get the unique call ID for this LLM call
   */
  getCallId(): string {
    return this.callId
  }

  /**
   * Get the call metadata
   */
  getMetadata(): LlmCallMetadata {
    return this.metadata
  }

  /**
   * Log the start of an LLM call
   */
  async logStart(): Promise<void> {
    // LLM call started
  }

  /**
   * Log the completion of an LLM call
   */
  async logComplete(result: LlmCallResult): Promise<void> {
    const endTime = new Date()
    const durationMs = endTime.getTime() - this.startTime.getTime()
    
    if (!result.success) {
      console.error(`[LLM] Failed call ${this.callId} after ${durationMs}ms - ${result.errorMessage}`)
    }
  }

  /**
   * Log a timeout for an LLM call
   */
  async logTimeout(): Promise<void> {
    const endTime = new Date()
    const durationMs = endTime.getTime() - this.startTime.getTime()
    console.warn(`[LLM] Timeout call ${this.callId} after ${durationMs}ms`)
  }

  /**
   * Create a new LLM logger instance
   */
  static create(metadata: Omit<LlmCallMetadata, 'callId'>): LlmLogger {
    return new LlmLogger(metadata)
  }
}

/**
 * Utility function to wrap LLM calls with logging
 */
export async function withLlmLogging<T>(
  metadata: Omit<LlmCallMetadata, 'callId'>,
  llmCall: (logger: LlmLogger) => Promise<T>
): Promise<T> {
  const logger = LlmLogger.create(metadata)
  
  try {
    await logger.logStart()
    const result = await llmCall(logger)
    await logger.logComplete({ success: true })
    return result
  } catch (error) {
    await logger.logComplete({
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorCode: 'UNKNOWN'
    })
    throw error
  }
}