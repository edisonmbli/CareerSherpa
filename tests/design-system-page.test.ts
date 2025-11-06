import { describe, it, expect } from 'vitest'
import DesignSystemPage from '@/app/[locale]/(dev)/design-system/page'

describe('DesignSystemPage', () => {
  it('returns null outside development', async () => {
    // Vitest sets NODE_ENV to "test"; ensure the page returns null
    const result = await DesignSystemPage({ params: { locale: 'en' } })
    expect(result).toBeNull()
  })
})