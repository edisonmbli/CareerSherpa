import { describe, it, expect } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'

describe('i18n workbench dictionary', () => {
  it('zh contains workbench.new keys', async () => {
    const dict = await getDictionary('zh' as any)
    expect(dict.workbench?.new?.title).toBeTruthy()
    expect(dict.workbench?.new?.button).toBeTruthy()
  })
  it('en contains workbench.new keys', async () => {
    const dict = await getDictionary('en' as any)
    expect(dict.workbench?.new?.title).toBeTruthy()
    expect(dict.workbench?.new?.button).toBeTruthy()
  })
})