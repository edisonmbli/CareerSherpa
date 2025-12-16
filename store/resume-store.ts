import { create, StateCreator } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Draft } from 'immer'
import {
  ResumeData,
  SectionConfig,
  resumeDataSchema,
  sectionConfigSchema,
} from '@/lib/types/resume-schema'
import { updateCustomizedResumeAction } from '@/lib/actions/resume.actions'
import debounce from 'lodash/debounce'

// Default Section Config
const DEFAULT_SECTION_CONFIG: SectionConfig = {
  order: [
    'basics',
    'summary',
    'workExperiences',
    'projectExperiences',
    'educations',
    'skills',
    'certificates',
    'hobbies',
    'customSections',
  ],
  hidden: [],
}

interface ResumeState {
  // Data
  serviceId: string | null
  resumeData: ResumeData | null
  originalData: ResumeData | null
  sectionConfig: SectionConfig

  // UI State
  activeSectionId: string | null
  isSidebarOpen: boolean
  isSaving: boolean
  lastSavedAt: Date | null

  // Actions
  initStore: (
    serviceId: string,
    data: ResumeData,
    originalData: ResumeData | null,
    config?: SectionConfig
  ) => void

  updateBasics: (data: Partial<ResumeData['basics']>) => void

  // Generic update for array sections (work, project, education)
  updateSectionItem: (
    sectionKey: keyof Pick<
      ResumeData,
      'workExperiences' | 'projectExperiences' | 'educations' | 'customSections'
    >,
    itemId: string,
    data: any
  ) => void

  addSectionItem: (
    sectionKey: keyof Pick<
      ResumeData,
      'workExperiences' | 'projectExperiences' | 'educations' | 'customSections'
    >
  ) => void

  removeSectionItem: (
    sectionKey: keyof Pick<
      ResumeData,
      'workExperiences' | 'projectExperiences' | 'educations' | 'customSections'
    >,
    itemId: string
  ) => void

  updateSimpleSection: (
    sectionKey: keyof Pick<ResumeData, 'skills' | 'certificates' | 'hobbies'>,
    value: string
  ) => void

  reorderSection: (newOrder: string[]) => void
  toggleSectionVisibility: (sectionKey: string) => void

  setActiveSection: (id: string | null) => void
  setSidebarOpen: (isOpen: boolean) => void

  // Auto-save trigger
  save: () => Promise<void>
}

// Debounced save function
const debouncedSave = debounce(
  async (
    serviceId: string,
    data: ResumeData,
    config: SectionConfig,
    set: any
  ) => {
    if (!serviceId) return

    set((state: ResumeState) => {
      state.isSaving = true
    })

    try {
      const res = await updateCustomizedResumeAction({
        serviceId,
        resumeData: data,
        sectionConfig: config,
      })

      if (res.ok) {
        set((state: ResumeState) => {
          state.isSaving = false
          state.lastSavedAt = new Date()
        })
      } else {
        set((state: ResumeState) => {
          state.isSaving = false
        })
        console.error('Auto-save failed')
      }
    } catch (e) {
      set((state: ResumeState) => {
        state.isSaving = false
      })
      console.error('Auto-save error', e)
    }
  },
  2000
)

// Define the Immer-compatible SetState type
type ImmerSet<T> = (
  next: ((state: Draft<T>) => void) | Partial<T> | T,
  shouldReplace?: boolean
) => void

// Define the GetState type
type ImmerGet<T> = () => T

// Define the slice creator function with explicit Immer types
// This avoids the 'StateCreator' generic constraint issues in strict mode
const createResumeSlice = (
  set: ImmerSet<ResumeState>,
  get: ImmerGet<ResumeState>
): ResumeState => ({
  serviceId: null,
  resumeData: null,
  originalData: null,
  sectionConfig: DEFAULT_SECTION_CONFIG,

  activeSectionId: null,
  isSidebarOpen: true,
  isSaving: false,
  lastSavedAt: null,

  initStore: (serviceId, data, originalData, config) => {
    set((state) => {
      state.serviceId = serviceId
      state.resumeData = data
      state.originalData = originalData || data // Fallback to current if original missing
      state.sectionConfig = config || DEFAULT_SECTION_CONFIG
    })
  },

  updateBasics: (data) => {
    set((state) => {
      if (state.resumeData) {
        state.resumeData.basics = { ...state.resumeData.basics, ...data }
      }
    })
    get().save()
  },

  updateSectionItem: (sectionKey, itemId, data) => {
    set((state) => {
      if (state.resumeData && Array.isArray(state.resumeData[sectionKey])) {
        const arr = state.resumeData[sectionKey] as any[]
        const index = arr.findIndex((item) => item.id === itemId)
        if (index !== -1) {
          arr[index] = { ...arr[index], ...data }
        }
      }
    })
    get().save()
  },

  addSectionItem: (sectionKey) => {
    const id = crypto.randomUUID()
    set((state) => {
      if (state.resumeData && Array.isArray(state.resumeData[sectionKey])) {
        const arr = state.resumeData[sectionKey] as any[]
        // Add basic empty item with ID
        arr.push({ id, description: '' })
      }
    })
    get().setActiveSection(id)
    get().save()
  },

  removeSectionItem: (sectionKey, itemId) => {
    set((state) => {
      if (state.resumeData && Array.isArray(state.resumeData[sectionKey])) {
        const arr = state.resumeData[sectionKey] as any[]
        const index = arr.findIndex((item) => item.id === itemId)
        if (index !== -1) {
          arr.splice(index, 1)
        }
      }
    })
    get().save()
  },

  updateSimpleSection: (sectionKey, value) => {
    set((state) => {
      if (state.resumeData) {
        state.resumeData[sectionKey] = value
      }
    })
    get().save()
  },

  reorderSection: (newOrder) => {
    set((state) => {
      state.sectionConfig.order = newOrder
    })
    get().save()
  },

  toggleSectionVisibility: (sectionKey) => {
    set((state) => {
      const hidden = state.sectionConfig.hidden
      if (hidden.includes(sectionKey)) {
        state.sectionConfig.hidden = hidden.filter((k) => k !== sectionKey)
      } else {
        state.sectionConfig.hidden.push(sectionKey)
      }
    })
    get().save()
  },

  setActiveSection: (id) => {
    set((state) => {
      state.activeSectionId = id
      if (id) state.isSidebarOpen = true
    })
  },

  setSidebarOpen: (isOpen) => {
    set((state) => {
      state.isSidebarOpen = isOpen
    })
  },

  save: async () => {
    const { serviceId, resumeData, sectionConfig } = get()
    if (serviceId && resumeData) {
      debouncedSave(serviceId, resumeData, sectionConfig, set)
    }
  },
})

// Use 'as any' for the immer middleware to bypass the broken StoreMutatorIdentifier constraint check
// in the current environment, while ensuring the slice implementation above is fully type-safe.
export const useResumeStore = create<ResumeState>()(
  (immer as any)(createResumeSlice)
)
