import { useMemo } from 'react'
import { ResumeStyleConfig } from '../types'

// Default configuration (module-level constant)
const DEFAULT_CONFIG: ResumeStyleConfig = {
  themeColor: '#0284c7', // Sky 600
  fontFamily: 'roboto', // Default to Roboto/Inter for most templates
  fontSize: 1, // Multiplier
  lineHeight: 1.5,
  pageMargin: 12, // 12mm
  sectionSpacing: 24,
  itemSpacing: 12,
}

const getFontFamilyClass = (family: string) => {
  switch (family) {
    case 'serif':
      return 'font-[var(--font-noto-serif),var(--font-cjk-serif),serif]'
    case 'mono':
      return 'font-[var(--font-jetbrains-mono),var(--font-cjk-sans),monospace]'
    case 'lato':
      return 'font-[var(--font-lato),var(--font-cjk-sans),sans-serif]'
    case 'open-sans':
      return 'font-[var(--font-open-sans),var(--font-cjk-sans),sans-serif]'
    case 'playfair':
      return 'font-[var(--font-playfair),var(--font-cjk-serif),serif]'
    case 'jetbrains-mono':
      return 'font-[var(--font-jetbrains-mono),var(--font-cjk-sans),monospace]'
    case 'ibm-plex-mono':
      return 'font-[var(--font-ibm-plex-mono),var(--font-cjk-sans),monospace]'
    case 'roboto':
      return 'font-[var(--font-roboto),var(--font-cjk-sans),sans-serif]'
    case 'inter':
      return 'font-[var(--font-inter),var(--font-cjk-sans),sans-serif]'
    default:
      return 'font-[var(--font-roboto),var(--font-cjk-sans),sans-serif]'
  }
}

export function useResumeTheme(userConfig?: Partial<ResumeStyleConfig>) {
  const styles = useMemo(() => {
    const config = { ...DEFAULT_CONFIG, ...userConfig }

    return {
      container: {
        '--theme-color': config.themeColor,
      } as React.CSSProperties,

      header: {
        borderColor: config.themeColor,
        color: config.themeColor,
        fontSize: '1.4em',
      },

      subHeader: {
        fontSize: '1.1em',
      },

      text: {
        fontSize: '1em',
      },

      section: {
        marginBottom: `var(--resume-section-spacing, ${config.sectionSpacing}px)`,
      },

      item: {
        marginBottom: `var(--resume-paragraph-spacing, ${config.itemSpacing}px)`,
      },

      isMobile: false,
      fontFamilyClass: getFontFamilyClass(config.fontFamily),
      themeColor: config.themeColor,
    }
  }, [userConfig])

  return styles
}
