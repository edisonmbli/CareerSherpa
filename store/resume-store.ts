import { create, StateCreator } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { Draft } from 'immer'
import {
  ResumeData,
  SectionConfig,
  resumeDataSchema,
  sectionConfigSchema,
} from '@/lib/types/resume-schema'
import { TemplateId } from '@/components/resume/constants'
import {
  updateCustomizedResumeAction,
  resetCustomizedResumeAction,
} from '@/lib/actions/resume.actions'
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
  optimizeSuggestion: string | null
  sectionConfig: SectionConfig
  currentTemplate: TemplateId

  // UI State
  activeSectionKey: string | null // e.g., 'workExperiences'
  activeItemId: string | null // e.g., 'work-1'
  isSidebarOpen: boolean
  isStructureOpen: boolean
  isAIPanelOpen: boolean
  isSaving: boolean
  lastSavedAt: Date | null

  // Style Config
  styleConfig: {
    themeColor: string
    fontFamily: string
    fontSize: number
    lineHeight: number
    pageMargin: number
    sectionSpacing: number
    itemSpacing: number
  }

  // Actions
  initStore: (
    serviceId: string,
    data: ResumeData,
    originalData: ResumeData | null,
    config?: SectionConfig,
    optimizeSuggestion?: string | null,
    opsJson?: any
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

  setActive: (key: string | null, itemId?: string | null) => void
  setSidebarOpen: (isOpen: boolean) => void
  setStructureOpen: (isOpen: boolean) => void
  setAIPanelOpen: (isOpen: boolean) => void

  updateStyleConfig: (config: Partial<ResumeState['styleConfig']>) => void
  setTemplate: (id: TemplateId) => void

  // Auto-save trigger
  save: () => Promise<void>
  resetToOriginal: () => Promise<void>
}

// Debounced save function
const debouncedSave = debounce(
  async (
    serviceId: string,
    data: ResumeData,
    config: SectionConfig,
    opsJson: any,
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
        opsJson,
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
        console.error('Auto-save failed:', (res as any).error)
      }
    } catch (e) {
      set((state: ResumeState) => {
        state.isSaving = false
      })
      console.error('Auto-save failed:', e)
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
  optimizeSuggestion: null,
  sectionConfig: DEFAULT_SECTION_CONFIG,
  currentTemplate: 'standard',

  activeSectionKey: null,
  activeItemId: null,
  isSidebarOpen: true,
  isStructureOpen: true,
  isAIPanelOpen: true,
  isSaving: false,
  lastSavedAt: null,

  styleConfig: {
    themeColor: '#0284c7', // Sky 600
    fontFamily: 'jetbrains-mono',
    fontSize: 1,
    lineHeight: 1.5,
    pageMargin: 16, // 16mm
    sectionSpacing: 24,
    itemSpacing: 12,
  },

  initStore: (
    serviceId,
    data,
    originalData,
    config,
    optimizeSuggestion,
    opsJson
  ) => {
    set((state) => {
      state.serviceId = serviceId
      state.resumeData = data

      // MVP: Check localStorage for avatar if missing in data
      // This runs on client side only
      if (
        typeof window !== 'undefined' &&
        data?.basics &&
        !data.basics.photoUrl
      ) {
        try {
          const cachedAvatar = localStorage.getItem('user_avatar')
          if (cachedAvatar) {
            state.resumeData!.basics.photoUrl = cachedAvatar
          }
        } catch {}
      }

      state.originalData = originalData || data // Fallback to current if original missing
      state.sectionConfig = config || DEFAULT_SECTION_CONFIG
      state.optimizeSuggestion = optimizeSuggestion || null

      if (opsJson) {
        if (opsJson.styleConfig) {
          state.styleConfig = { ...state.styleConfig, ...opsJson.styleConfig }
        }
        if (opsJson.currentTemplate) {
          state.currentTemplate = opsJson.currentTemplate
        }
      }
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
    get().setActive(sectionKey, id)
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

  setActive: (key, itemId) => {
    set((state) => {
      state.activeSectionKey = key
      state.activeItemId = itemId || null
      // Auto-open sidebars when activating a section
      if (key) {
        // state.isSidebarOpen = true // Left (Structure) - Do not force open left sidebar
        state.isAIPanelOpen = true // Right (Property) - MUST open to show form
      }
    })
  },

  setSidebarOpen: (isOpen) => {
    set((state) => {
      state.isSidebarOpen = isOpen
    })
  },

  setStructureOpen: (isOpen) => {
    set((state) => {
      state.isStructureOpen = isOpen
    })
  },

  setAIPanelOpen: (isOpen) => {
    set((state) => {
      state.isAIPanelOpen = isOpen
    })
  },

  updateStyleConfig: (config) => {
    set((state) => {
      state.styleConfig = { ...state.styleConfig, ...config }
    })
    get().save()
  },

  setTemplate: (id) => {
    set((state) => {
      state.currentTemplate = id
    })
    get().save()
  },

  save: async () => {
    const {
      serviceId,
      resumeData,
      sectionConfig,
      styleConfig,
      currentTemplate,
    } = get()
    if (serviceId && resumeData) {
      debouncedSave(
        serviceId,
        resumeData,
        sectionConfig,
        { styleConfig, currentTemplate },
        set
      )
    }
  },

  resetToOriginal: async () => {
    const { originalData, serviceId } = get()
    if (originalData) {
      set((state) => {
        state.resumeData = originalData
      })
      await get().save()

      // Also reset in DB if serviceId exists
      if (serviceId) {
        try {
          await resetCustomizedResumeAction(serviceId)
        } catch (e) {
          console.error('Failed to reset remote data', e)
        }
      }
    }
  },
})

// Use 'as any' for the immer middleware to bypass the broken StoreMutatorIdentifier constraint check
// in the current environment, while ensuring the slice implementation above is fully type-safe.
export const useResumeStore = create<ResumeState>()(
  (immer as any)(createResumeSlice)
)
