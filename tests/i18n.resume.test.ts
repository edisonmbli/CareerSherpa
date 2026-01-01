import { describe, it, expect } from 'vitest'
import { getDictionary } from '@/lib/i18n/dictionaries'

describe('i18n resume dictionary', () => {
    it('zh and en have matching resume section keys', async () => {
        const en = await getDictionary('en')
        const zh = await getDictionary('zh')

        expect(Object.keys(en.resume.sections)).toEqual(
            Object.keys(zh.resume.sections)
        )
    })

    it('zh and en have matching resume template keys', async () => {
        const en = await getDictionary('en')
        const zh = await getDictionary('zh')

        expect(Object.keys(en.resume.templates)).toEqual(
            Object.keys(zh.resume.templates)
        )
    })

    it('zh and en have matching resume editor keys', async () => {
        const en = await getDictionary('en')
        const zh = await getDictionary('zh')

        expect(Object.keys(en.resume.editor)).toEqual(Object.keys(zh.resume.editor))
    })

    it('zh and en have matching resume forms keys', async () => {
        const en = await getDictionary('en')
        const zh = await getDictionary('zh')

        expect(Object.keys(en.resume.forms)).toEqual(Object.keys(zh.resume.forms))
    })
})
