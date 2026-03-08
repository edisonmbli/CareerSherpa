import { create } from 'zustand'

export type BgVariant = 'hero' | 'workbench' | 'subdued' | null

interface UiState {
    bgVariant: BgVariant
    setBgVariant: (variant: BgVariant) => void
}

export const useUiStore = create<UiState>((set) => ({
    bgVariant: null,
    setBgVariant: (bgVariant) => set({ bgVariant }),
}))
