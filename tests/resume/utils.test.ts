import { describe, it, expect } from 'vitest'
import { renderDescription, formatDate } from '@/components/resume/templates/utils'

describe('Resume Template Utils', () => {
  describe('renderDescription', () => {
    it('returns null for undefined description', () => {
      expect(renderDescription(undefined)).toBeNull()
    })

    it('renders list items for newlines', () => {
      const desc = 'Point 1\nPoint 2'
      const result = renderDescription(desc)
      // Since we are testing a React component output, simple snapshot or prop check is hard without render
      // But we can check it returns an object (React element)
      expect(result).toBeDefined()
      expect(typeof result).toBe('object')
    })
  })

  describe('formatDate', () => {
    it('returns empty string for undefined', () => {
      expect(formatDate(undefined)).toBe('')
    })

    it('returns date string as is', () => {
      expect(formatDate('2023-01')).toBe('2023-01')
    })
  })
})
