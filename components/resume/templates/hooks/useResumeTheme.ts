import { useMemo } from 'react'
import { ResumeStyleConfig } from '../types'

export function useResumeTheme(userConfig?: Partial<ResumeStyleConfig>) {
  const defaultConfig: ResumeStyleConfig = {
    themeColor: '#0284c7', // Sky 600
    fontFamily: 'roboto', // Default to Roboto/Inter for most templates
    fontSize: 1, // Multiplier
    lineHeight: 1.5,
    pageMargin: 12, // 12mm
    sectionSpacing: 24,
    itemSpacing: 12,
  }

  const config = { ...defaultConfig, ...userConfig }

  const getFontFamilyClass = (family: string) => {
    switch (family) {
      case 'serif':
        return 'font-[family-name:var(--font-noto-serif),serif]'
      case 'mono':
        return 'font-mono'
      case 'lato':
        return 'font-[family-name:var(--font-lato),sans-serif]'
      case 'open-sans':
        return 'font-[family-name:var(--font-open-sans),sans-serif]'
      case 'playfair':
        return 'font-[family-name:var(--font-playfair),serif]'
      case 'jetbrains-mono':
        return 'font-[family-name:var(--font-jetbrains-mono),monospace]'
      case 'ibm-plex-mono':
        return 'font-[family-name:var(--font-ibm-plex-mono),monospace]'
      case 'roboto':
        return 'font-[family-name:var(--font-roboto),sans-serif]'
      case 'inter':
        return 'font-[family-name:var(--font-inter),sans-serif]'
      default:
        return 'font-[family-name:var(--font-roboto),sans-serif]'
    }
  }

  const styles = useMemo(() => {
    // Print Physics: Use relative units, inherit from .resume-paper wrapper
    // 1em = var(--resume-base-font-size)

    return {
      container: {
        '--theme-color': config.themeColor,
        // Removed hardcoded fontSize/padding/lineHeight to allow CSS variables inheritance
      } as React.CSSProperties,

      header: {
        borderColor: config.themeColor,
        color: config.themeColor,
        fontSize: '1.4em', // Relative to base
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

      isMobile: false, // Legacy compatibility
      fontFamilyClass: getFontFamilyClass(config.fontFamily),
      themeColor: config.themeColor,
    }
  }, [config])

  return styles
}
