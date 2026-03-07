import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth/wrapper', () => ({
  withServerActionAuthWrite: (_name: string, handler: unknown) => handler,
}))

vi.mock('@/lib/dal/resumeShare', () => ({
  getResumeShareContextForUser: vi.fn(),
  upsertResumeShareByCustomizedId: vi.fn(),
}))

vi.mock('@/lib/storage/avatar-server', () => ({
  resolveAvatarForShare: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logError: vi.fn(),
}))

vi.mock('@/lib/rateLimiter', () => ({
  checkRateLimit: vi.fn(),
}))

vi.mock('@/lib/analytics/index', () => ({
  trackEvent: vi.fn(),
  AnalyticsCategory: { BUSINESS: 'BUSINESS' },
  AnalyticsSource: { PUBLIC_SHARE: 'PUBLIC_SHARE', ACTION: 'ACTION' },
  AnalyticsRuntime: { NEXTJS: 'NEXTJS' },
  AnalyticsOutcome: { ACCEPTED: 'ACCEPTED' },
}))

describe('share.actions: trackShareEventAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid payload before rate-limit and tracking', async () => {
    const { trackShareEventAction } = await import('@/lib/actions/share.actions')
    const { checkRateLimit } = await import('@/lib/rateLimiter')
    const { trackEvent } = await import('@/lib/analytics/index')

    const result = await trackShareEventAction({
      eventName: 'RESUME_SHARE_VIEW',
      payload: {
        shareId: '',
        templateId: 'standard',
      },
    })

    expect(result).toEqual({ ok: false, error: 'invalid_payload' })
    expect(checkRateLimit).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('rejects when rate-limited', async () => {
    const { trackShareEventAction } = await import('@/lib/actions/share.actions')
    const { checkRateLimit } = await import('@/lib/rateLimiter')
    const { trackEvent } = await import('@/lib/analytics/index')
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: false, retryAfter: 60 })

    const result = await trackShareEventAction({
      eventName: 'RESUME_SHARE_VIEW',
      payload: {
        shareId: 'share_1',
        templateId: 'standard',
      },
    })

    expect(result).toEqual({ ok: false, error: 'rate_limited' })
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('tracks share view with referrer domain only', async () => {
    const { trackShareEventAction } = await import('@/lib/actions/share.actions')
    const { checkRateLimit } = await import('@/lib/rateLimiter')
    const { trackEvent } = await import('@/lib/analytics/index')
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true, remaining: 9 })

    const result = await trackShareEventAction({
      eventName: 'RESUME_SHARE_VIEW',
      payload: {
        shareId: 'share_1',
        templateId: 'standard',
        source: 'web',
        referrer: 'https://news.example.com/path?a=1',
        utm_source: 'x',
      },
    })

    expect(result).toEqual({ ok: true })
    expect(trackEvent).toHaveBeenCalledTimes(1)
    const [eventName, ctx] = (trackEvent as any).mock.calls[0]
    expect(eventName).toBe('RESUME_SHARE_VIEW')
    expect(ctx.source).toBe('PUBLIC_SHARE')
    expect(ctx.payload.referrerDomain).toBe('news.example.com')
    expect(ctx.payload.referrer).toBeUndefined()
  })

  it('tracks share CTA click with allowlisted event name', async () => {
    const { trackShareEventAction } = await import('@/lib/actions/share.actions')
    const { checkRateLimit } = await import('@/lib/rateLimiter')
    const { trackEvent } = await import('@/lib/analytics/index')
    vi.mocked(checkRateLimit).mockResolvedValue({ ok: true, remaining: 9 })

    const result = await trackShareEventAction({
      eventName: 'RESUME_SHARE_CTA_CLICK',
      payload: {
        shareId: 'share_1',
        templateId: 'standard',
        target: 'banner_cta',
        source: 'web',
      },
    })

    expect(result).toEqual({ ok: true })
    expect(trackEvent).toHaveBeenCalledWith(
      'RESUME_SHARE_CTA_CLICK',
      expect.objectContaining({
        source: 'PUBLIC_SHARE',
        payload: expect.objectContaining({
          shareId: 'share_1',
          templateId: 'standard',
          target: 'banner_cta',
        }),
      }),
    )
  })

  it('tracks customize share clicked when share link is generated', async () => {
    const { generateShareLinkAction } = await import('@/lib/actions/share.actions')
    const { getResumeShareContextForUser, upsertResumeShareByCustomizedId } =
      await import('@/lib/dal/resumeShare')
    const { resolveAvatarForShare } = await import('@/lib/storage/avatar-server')
    const { trackEvent } = await import('@/lib/analytics/index')

    vi.mocked(getResumeShareContextForUser).mockResolvedValue({
      customizedResumeId: 'custom_1',
      share: null,
    } as any)
    vi.mocked(resolveAvatarForShare).mockResolvedValue({ ok: true, avatarUrl: null } as any)
    vi.mocked(upsertResumeShareByCustomizedId).mockResolvedValue({
      id: 'share_id_1',
      shareKey: 'share_key_1',
    } as any)

    const result = await (generateShareLinkAction as any)(
      {
        serviceId: 'svc_1',
        durationDays: 7,
      },
      { userId: 'user_1' } as any,
    )

    expect(result).toEqual({
      ok: true,
      data: { id: 'share_id_1', shareKey: 'share_key_1' },
    })
    expect(trackEvent).toHaveBeenCalledWith(
      'CUSTOMIZE_SHARE_CLICKED',
      expect.objectContaining({
        userId: 'user_1',
        serviceId: 'svc_1',
        payload: expect.objectContaining({
          shareId: 'share_key_1',
          source: 'web',
        }),
      }),
    )
  })
})
