import { describe, it, expect } from 'vitest'
import {
  resumeDataSchema,
  sectionConfigSchema,
  basicInfoSchema,
  workExperienceSchema,
} from '@/lib/types/resume-schema'

describe('Resume Schema Validation', () => {
  describe('Basic Info Schema', () => {
    it('should validate valid basic info', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        mobile: '1234567890',
      }
      const result = basicInfoSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require name', () => {
      const invalidData = {
        email: 'john@example.com',
      }
      const result = basicInfoSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
      if (!result.success) {
        const firstIssue = result.error.issues[0]
        expect(firstIssue).toBeDefined()
        if (firstIssue) {
          expect(firstIssue.path).toContain('name')
        }
      }
    })
  })

  describe('Work Experience Schema', () => {
    it('should validate valid work experience', () => {
      const validData = {
        id: '123',
        company: 'Tech Corp',
        position: 'Developer',
        description: 'Wrote code',
        startDate: '2020-01',
        endDate: '2021-01',
      }
      const result = workExperienceSchema.safeParse(validData)
      expect(result.success).toBe(true)
    })

    it('should require company and position', () => {
      const invalidData = {
        id: '123',
        description: 'Wrote code',
      }
      const result = workExperienceSchema.safeParse(invalidData)
      expect(result.success).toBe(false)
    })
  })

  describe('Resume Data Schema', () => {
    it('should use default empty arrays for missing sections', () => {
      const minimalData = {
        basics: { name: 'John Doe' },
      }
      const result = resumeDataSchema.safeParse(minimalData)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.workExperiences).toEqual([])
        expect(result.data.educations).toEqual([])
        expect(result.data.customSections).toEqual([])
      }
    })
  })

  describe('Section Config Schema', () => {
    it('should provide default order', () => {
      const result = sectionConfigSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.order).toContain('basics')
        expect(result.data.hidden).toEqual([])
      }
    })
  })
})
