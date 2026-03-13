import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const logError = vi.fn()
const logInfo = vi.fn()
const logWarn = vi.fn()
const getUserByStackId = vi.fn()
const getUser = vi.fn()

vi.mock('@/lib/logger', () => ({
  logError,
  logInfo,
  logWarn,
}))

vi.mock('@/lib/dal', () => ({
  getUserByStackId,
}))

vi.mock('@/stack/server', () => ({
  stackServerApp: {
    getUser,
  },
}))

describe('Sentry noise classification', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('downgrades expected API 4xx failures to warnings', async () => {
    const { handleApiError } = await import('@/lib/api/utils')

    const response = handleApiError(new Error('missing_fields: serviceId'), {
      reqId: 'req-1',
      route: 'api/test',
      userKey: 'user-1',
      startTime: Date.now() - 5,
    })

    expect(response.status).toBe(400)
    expect(logWarn).toHaveBeenCalledTimes(1)
    expect(logError).not.toHaveBeenCalled()
  })

  it('keeps unexpected API failures as Sentry-worthy errors with original Error', async () => {
    const { handleApiError } = await import('@/lib/api/utils')
    const original = new Error('db_connection_broken')

    const response = handleApiError(original, {
      reqId: 'req-2',
      route: 'api/test',
      userKey: 'user-2',
      startTime: Date.now() - 10,
    })

    expect(response.status).toBe(500)
    expect(logError).toHaveBeenCalledTimes(1)
    expect(logError.mock.calls[0]?.[0]).toMatchObject({
      route: 'api/test',
      phase: 'api_error',
      error: original,
      errorCode: 'internal_error',
    })
  })

  it('downgrades expected action failures and authorization denials', async () => {
    const { handleActionError, validateUserAccess } = await import('@/lib/actions/utils')

    const result = handleActionError(new Error('rate_limited: too many requests'), {
      reqId: 'action-1',
      action: 'actions/test',
      userKey: 'user-1',
      startTime: Date.now() - 3,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('rate_limited')
    expect(logWarn).toHaveBeenCalledTimes(1)
    expect(logError).not.toHaveBeenCalled()

    const allowed = validateUserAccess('user-1', 'user-2', 'actions/test')
    expect(allowed).toBe(false)
    expect(logWarn).toHaveBeenCalledTimes(2)
    expect(logError).not.toHaveBeenCalled()
  })

  it('treats unauthenticated and sync-pending server actions as non-Sentry operational logs', async () => {
    const { authenticateServerAction, authenticateAndSyncUser } = await import('@/lib/actions/auth')

    getUser.mockResolvedValueOnce(null)
    const unauthenticated = await authenticateServerAction('actions/test')
    expect(unauthenticated.error).toBe('Authentication required')
    expect(logInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'actions/test',
        phase: 'authentication_required',
      }),
    )
    expect(logError).not.toHaveBeenCalled()

    getUser.mockResolvedValueOnce({ id: 'stack-user-1', primaryEmail: 'user@test.dev' })
    getUserByStackId.mockResolvedValueOnce(null)
    const synced = await authenticateAndSyncUser('actions/test')
    expect(synced.error).toBeNull()
    expect(logInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'actions/test',
        phase: 'user_sync_pending',
        userKey: 'stack-user-1',
      }),
    )
    expect(logError).not.toHaveBeenCalled()
  })

  it('keeps security validation failures out of Sentry', async () => {
    const { securityMiddleware } = await import('@/lib/security/middleware')

    const request = new NextRequest('https://example.com/api/private', {
      method: 'POST',
      headers: {
        'x-user-key': 'user-1',
      },
    })

    const response = await securityMiddleware(request)

    expect(response?.status).toBe(400)
    expect(logWarn).toHaveBeenCalled()
    expect(logError).not.toHaveBeenCalled()
  })
})
