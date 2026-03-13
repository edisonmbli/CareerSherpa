import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('@/lib/llm/service', () => ({
  runLlmTask: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  isProdRedisReady: vi.fn(() => false),
}))

describe('business-layer sentry noise classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('downgrades cache validation failures to warnings', async () => {
    const { validateCacheData, safeReadCache, detectCachePoisoning } =
      await import('@/lib/cache/validation')
    const { logWarn, logError } = await import('@/lib/logger')

    const invalid = { bad: 'shape' }
    const validation = validateCacheData(invalid)
    expect(validation.isValid).toBe(false)

    const safeRead = safeReadCache(invalid)
    expect(safeRead).toBeNull()

    const poisoning = detectCachePoisoning('__bad__', invalid)
    expect(poisoning.isPoisoned).toBe(true)

    expect(logWarn).toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })

  it('downgrades OCR upstream failures to warnings', async () => {
    const { runLlmTask } = await import('@/lib/llm/service')
    const { extractTextFromMedia } = await import('@/lib/services/ocr-service')
    const { logWarn, logError } = await import('@/lib/logger')

    vi.mocked(runLlmTask).mockResolvedValue({
      ok: false,
      error: 'provider_busy',
    } as any)

    const result = await extractTextFromMedia(
      'data:image/png;base64,AAAA',
      'image',
      'user_1',
      'service_1',
    )

    expect(result).toEqual({
      success: false,
      error: 'provider_busy',
    })
    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'ocr/extract',
        errorCode: 'ocr_extraction_failed',
      }),
    )
    expect(logError).not.toHaveBeenCalled()
  })

  it('downgrades Baidu OCR API response errors to warnings', async () => {
    const { extractTextFromBaidu } = await import('@/lib/services/baidu-ocr')
    const { logWarn, logError } = await import('@/lib/logger')

    vi.stubEnv('BAIDU_API_KEY', 'test-key')
    vi.stubEnv('BAIDU_SECRET_KEY', 'test-secret')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          access_token: 'token-1',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({
        json: async () => ({
          error_code: 17,
          error_msg: 'Open api daily request limit reached',
        }),
      })

    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    const result = await extractTextFromBaidu('data:image/png;base64,AAAA')

    expect(result).toEqual({
      ok: false,
      error: 'Baidu OCR error 17: Open api daily request limit reached',
    })
    expect(logWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'baidu-ocr',
        errorCode: 'baidu_ocr_api_error',
      }),
    )
    expect(logError).not.toHaveBeenCalled()
  })
})
