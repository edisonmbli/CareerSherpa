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
import { TechnicalDefaults } from '@/components/resume/templates/TemplateTechnical'
import { CorporateDefaults } from '@/components/resume/templates/TemplateCorporate'
import { ElegantDefaults } from '@/components/resume/templates/TemplateElegant'
import { ProfessionalDefaults } from '@/components/resume/templates/TemplateProfessional'
import { DarkSidebarDefaults } from '@/components/resume/templates/TemplateDarkSidebar'
import { StandardDefaults } from '@/components/resume/templates/TemplateStandard'
import { DesignDefaults } from '@/components/resume/templates/TemplateDesign'
import { ProductDefaults } from '@/components/resume/templates/TemplateProduct'
import { TemplateConfig } from '@/components/resume/templates/types'

export const TemplateDefaultsMap: Record<TemplateId, TemplateConfig> = {
  technical: TechnicalDefaults,
  corporate: CorporateDefaults,
  elegant: ElegantDefaults,
  professional: ProfessionalDefaults,
  darkSidebar: DarkSidebarDefaults,
  standard: StandardDefaults,
  creative: DesignDefaults,
  product: ProductDefaults,
}

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
  statusMessage: { text: string; type: 'success' | 'info' | 'error' } | null

  // Dirty State Tracking (Hybrid Save)
  isDirty: boolean
  dirtyFields: Array<'resumeData' | 'sectionConfig' | 'styleConfig'>
  lastLocalChangeAt: number | null

  // Layout Info (Calculated by ResumePreview)
  layoutInfo: {
    contentHeight: number
  }

  // Style Config
  styleConfig: {
    themeColor: string
    fontFamily: string
    fontSize: number
    baseFontSize?: number
    lineHeight: number
    pageMargin: number
    sectionSpacing: number
    itemSpacing: number
    compactMode?: boolean
    proportionalScale?: boolean
    scaleFactor?: number // 0.5 ~ 2.0, for proportional scaling
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
  updateSectionTitle: (sectionKey: string, title: string) => void
  togglePageBreak: (sectionKey: string) => void

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
  setStatusMessage: (
    message: { text: string; type: 'success' | 'info' } | null
  ) => void

  updateStyleConfig: (config: Partial<ResumeState['styleConfig']>) => void
  setLayoutInfo: (info: Partial<ResumeState['layoutInfo']>) => void
  setTemplate: (id: TemplateId) => void

  // Auto-save trigger (background)
  save: () => Promise<void>
  // Manual save trigger (with UI feedback)
  manualSave: () => Promise<{ ok: boolean; error?: string }>
  resetToOriginal: () => Promise<void>
  // Dirty state management
  markDirty: (field: 'resumeData' | 'sectionConfig' | 'styleConfig') => void
  clearDirty: () => void
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
  statusMessage: null,

  // Dirty state tracking
  isDirty: false,
  dirtyFields: [],
  lastLocalChangeAt: null,

  layoutInfo: {
    contentHeight: 0,
  },

  styleConfig: {
    themeColor: '#0284c7', // Sky 600
    fontFamily: 'jetbrains-mono',
    fontSize: 1,
    lineHeight: 1.5,
    pageMargin: 16, // 16mm
    sectionSpacing: 24,
    itemSpacing: 12,
    compactMode: false,
    proportionalScale: false,
    scaleFactor: 1.0,
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
        } catch { }
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
    get().markDirty('resumeData')
  },

  updateSectionTitle: (sectionKey, title) => {
    set((state) => {
      if (state.resumeData) {
        if (!state.resumeData.sectionTitles) {
          state.resumeData.sectionTitles = {}
        }
        state.resumeData.sectionTitles[sectionKey] = title
      }
    })
    get().markDirty('resumeData')
  },



  togglePageBreak: (sectionKey) => {
    set((state) => {
      if (!state.sectionConfig.pageBreaks) {
        state.sectionConfig.pageBreaks = {}
      }
      // Toggle
      state.sectionConfig.pageBreaks[sectionKey] =
        !state.sectionConfig.pageBreaks[sectionKey]
    })
    get().markDirty('sectionConfig')
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
    get().markDirty('resumeData')
  },

  addSectionItem: (sectionKey) => {
    const id = crypto.randomUUID()
    set((state) => {
      if (state.resumeData && Array.isArray(state.resumeData[sectionKey])) {
        const arr = state.resumeData[sectionKey] as any[]
        // Add basic empty item with ID
        if (sectionKey === 'customSections') {
          arr.push({ id, title: 'New Section', description: '' })
        } else {
          arr.push({ id, description: '' })
        }
      }
    })
    get().setActive(sectionKey, id)
    get().markDirty('resumeData')
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
    get().markDirty('resumeData')
  },

  updateSimpleSection: (sectionKey, value) => {
    set((state) => {
      if (state.resumeData) {
        state.resumeData[sectionKey] = value
      }
    })
    get().markDirty('resumeData')
  },

  reorderSection: (newOrder) => {
    set((state) => {
      state.sectionConfig.order = newOrder
    })
    get().markDirty('sectionConfig')
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
    get().markDirty('sectionConfig')
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

  setStatusMessage: (message) => {
    set((state) => {
      state.statusMessage = message
    })
    if (message) {
      setTimeout(() => {
        set((state) => {
          state.statusMessage = null
        })
      }, 3000)
    }
  },

  updateStyleConfig: (config) => {
    set((state) => {
      state.styleConfig = { ...state.styleConfig, ...config }
    })
    get().markDirty('styleConfig')
  },

  setLayoutInfo: (info) => {
    set((state) => {
      state.layoutInfo = { ...state.layoutInfo, ...info }
    })
  },

  setTemplate: (id) => {
    set((state) => {
      state.currentTemplate = id
      const defaults = TemplateDefaultsMap[id]
      if (defaults) {
        state.styleConfig = {
          ...state.styleConfig,
          ...defaults,
          compactMode: false,
          proportionalScale: false,
        }
      }
    })
    get().markDirty('styleConfig')
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

  // Dirty state management
  markDirty: (field) => {
    set((state) => {
      state.isDirty = true
      if (!state.dirtyFields.includes(field)) {
        state.dirtyFields.push(field)
      }
      state.lastLocalChangeAt = Date.now()
    })
  },

  clearDirty: () => {
    set((state) => {
      state.isDirty = false
      state.dirtyFields = []
      state.lastLocalChangeAt = null
    })
  },

  // Manual save with UI feedback
  manualSave: async () => {
    const {
      serviceId,
      resumeData,
      sectionConfig,
      styleConfig,
      currentTemplate,
      isDirty,
      dirtyFields,
    } = get()

    if (!serviceId) {
      return { ok: false, error: 'No service ID' }
    }

    if (!isDirty || dirtyFields.length === 0) {
      return { ok: true } // Already saved
    }

    // Cancel any pending debounced save
    debouncedSave.cancel()

    set((state) => {
      state.isSaving = true
    })

    try {
      // Build payload with only dirty fields (incremental update)
      const payload: {
        serviceId: string
        resumeData?: any
        sectionConfig?: any
        opsJson?: any
      } = { serviceId }

      if (dirtyFields.includes('resumeData') && resumeData) {
        payload.resumeData = resumeData
      }
      if (dirtyFields.includes('sectionConfig')) {
        payload.sectionConfig = sectionConfig
      }
      if (dirtyFields.includes('styleConfig')) {
        payload.opsJson = { styleConfig, currentTemplate }
      }

      const res = await updateCustomizedResumeAction(payload)

      if (res.ok) {
        set((state) => {
          state.isSaving = false
          state.lastSavedAt = new Date()
          state.isDirty = false
          state.dirtyFields = []
          state.lastLocalChangeAt = null
        })
        return { ok: true }
      } else {
        set((state) => {
          state.isSaving = false
        })
        return { ok: false, error: (res as any).error || 'Save failed' }
      }
    } catch (e) {
      set((state) => {
        state.isSaving = false
      })
      console.error('Manual save failed:', e)
      return { ok: false, error: 'Network error' }
    }
  },
})

// Use 'as any' for the immer middleware to bypass the broken StoreMutatorIdentifier constraint check
// in the current environment, while ensuring the slice implementation above is fully type-safe.
export const useResumeStore = create<ResumeState>()(
  (immer as any)(createResumeSlice)
)
