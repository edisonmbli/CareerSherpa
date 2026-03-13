import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.fn()
vi.mock('@/lib/sentry/universal', () => ({
  captureException,
  captureMessage: vi.fn(),
  setUser: vi.fn(),
  setTag: vi.fn(),
  setContext: vi.fn(),
  captureHandledError: vi.fn(),
}))

describe('lib/logger sentry behavior', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LOG_INFO', 'true')
    vi.stubEnv('LOG_DEBUG', 'true')
    vi.stubEnv('WORKER_RUNTIME', 'true')
    vi.stubEnv('SENTRY_DSN', 'https://examplePublicKey@o0.ingest.sentry.io/1')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does not capture info/debug messages into Sentry issues', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { logInfo, logDebug, logWarn } = await import('@/lib/logger')

    logInfo({ reqId: 'r1', route: 'test/info', phase: 'info' })
    logDebug({ reqId: 'r2', route: 'test/debug', phase: 'debug' })
    logWarn({ reqId: 'r3', route: 'test/warn', phase: 'warn' })

    expect(logSpy).toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
    const { captureMessage } = await import('@/lib/sentry/universal')
    expect(captureMessage).not.toHaveBeenCalled()
  })

  it('still captures errors into Sentry', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { logError } = await import('@/lib/logger')

    logError({
      reqId: 'r3',
      route: 'test/error',
      phase: 'error',
      error: new Error('logger_sentry_test_error'),
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(errorSpy).toHaveBeenCalled()
    expect(captureException).toHaveBeenCalledTimes(1)
  })
})
