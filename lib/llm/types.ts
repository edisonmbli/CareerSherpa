export interface LlmCallMetadata {
  callId: string
  provider: string
  model: string
  userId?: string
  requestId?: string
  route?: string
}

export interface LlmCallResult {
  success: boolean
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cost?: number
  errorMessage?: string
  errorCode?: string
}