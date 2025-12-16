import { describe, it, expect, beforeEach } from 'vitest'
import { useResumeStore } from '@/store/resume-store'
import { MOCK_RESUME_DATA } from '@/lib/mocks/resume-data'

// Zustand testing often requires mocking the store creation or resetting state
// Since our store uses `create`, we need to be careful.
// A common pattern is to access the store API directly.

describe('Resume Store', () => {
  beforeEach(() => {
    useResumeStore.setState({
      resumeData: null,
      sectionConfig: { order: [], hidden: [] },
      serviceId: null,
    })
  })

  it('initializes correctly', () => {
    const { initStore } = useResumeStore.getState()
    initStore('s1', MOCK_RESUME_DATA, null)

    const state = useResumeStore.getState()
    expect(state.serviceId).toBe('s1')
    expect(state.resumeData).toEqual(MOCK_RESUME_DATA)
    // Should use default config if not provided
    expect(state.sectionConfig.order.length).toBeGreaterThan(0)
  })

  it('updates basics', () => {
    const { initStore, updateBasics } = useResumeStore.getState()
    initStore('s1', MOCK_RESUME_DATA, null)

    updateBasics({ name: 'New Name' })
    expect(useResumeStore.getState().resumeData?.basics.name).toBe('New Name')
  })

  it('adds a work experience item', () => {
    const { initStore, addSectionItem } = useResumeStore.getState()
    initStore('s1', MOCK_RESUME_DATA, null)

    const initialCount = MOCK_RESUME_DATA.workExperiences.length
    addSectionItem('workExperiences')

    const newState = useResumeStore.getState()
    expect(newState.resumeData?.workExperiences.length).toBe(initialCount + 1)

    const newItem = newState.resumeData?.workExperiences[initialCount]
    expect(newItem).toBeDefined()
    if (newItem) {
      expect(newItem).toHaveProperty('id')
      expect(newItem.description).toBe('')
    }
  })

  it('removes a work experience item', () => {
    const { initStore, removeSectionItem } = useResumeStore.getState()
    initStore('s1', MOCK_RESUME_DATA, null)

    const targetId = MOCK_RESUME_DATA.workExperiences[0].id
    removeSectionItem('workExperiences', targetId)

    const newState = useResumeStore.getState()
    const works = newState.resumeData?.workExperiences
    if (works) {
      expect(works.find((i) => i.id === targetId)).toBeUndefined()
    } else {
      expect(works).toBeUndefined()
    }
  })

  it('reorders sections', () => {
    const { initStore, reorderSection } = useResumeStore.getState()
    initStore('s1', MOCK_RESUME_DATA, null)

    const newOrder = ['skills', 'basics']
    reorderSection(newOrder)

    expect(useResumeStore.getState().sectionConfig.order).toEqual(newOrder)
  })

  it('toggles section visibility', () => {
    const { initStore, toggleSectionVisibility } = useResumeStore.getState()
    initStore('s1', MOCK_RESUME_DATA, null)

    toggleSectionVisibility('basics')
    expect(useResumeStore.getState().sectionConfig.hidden).toContain('basics')

    toggleSectionVisibility('basics')
    expect(useResumeStore.getState().sectionConfig.hidden).not.toContain(
      'basics'
    )
  })
})
