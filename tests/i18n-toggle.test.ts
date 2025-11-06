import { describe, it, expect } from 'vitest'
import { switchLocalePath } from '@/components/app/I18nToggle'

describe('switchLocalePath', () => {
  it('replaces leading locale segment', () => {
    expect(switchLocalePath('/en/workbench', 'zh')).toBe('/zh/workbench')
    expect(switchLocalePath('/zh/workbench', 'en')).toBe('/en/workbench')
  })

  it('prefixes when no locale segment present', () => {
    expect(switchLocalePath('/workbench', 'en')).toBe('/en/workbench')
    expect(switchLocalePath('workbench', 'zh')).toBe('/zh/workbench')
  })

  it('handles root path', () => {
    expect(switchLocalePath('/', 'zh')).toBe('/zh/')
  })
})