import { useState, useEffect, useMemo } from 'react'
import { ResumeStyleConfig } from '../types'

export function useResumeTheme(userConfig?: Partial<ResumeStyleConfig>) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const update = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768)
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const defaultConfig: ResumeStyleConfig = {
    themeColor: '#0284c7', // Sky 600
    fontFamily: 'roboto', // Default to Roboto/Inter for most templates
    fontSize: 1, // Multiplier
    lineHeight: 1.5,
    pageMargin: 12, // 12mm
    sectionSpacing: 24,
    itemSpacing: 12,
  }

  // Allow template-specific overrides via userConfig logic,
  // but if userConfig is empty, we might want to know WHICH template is active to set better defaults.
  // For now, we'll stick to a safe default, but Technical Template calls this hook with its own defaults if we update it.

  // Actually, the best way is to let the Template component pass in its specific defaults if userConfig is missing/partial.
  // We will handle that in the Template component itself or merge smartly here.
  // However, the prompt asks to set defaults for Technical Template specifically.
  // Since this hook is generic, we shouldn't hardcode Technical defaults here unless we know context.
  // But wait, the previous code had 'jetbrains-mono' as default which suggests it was biased towards technical.
  // Let's keep it generic here, and update TemplateTechnical to pass the correct defaults.

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
    const baseFontSize = 14
    const mobileScale = 0.85 // Slightly larger than 0.8 for better readability

    // Calculate effective values based on device
    const effectiveFontSize =
      baseFontSize *
      (isMobile ? config.fontSize * mobileScale : config.fontSize)

    const effectiveSectionSpacing = isMobile
      ? config.sectionSpacing * 0.7
      : config.sectionSpacing

    const effectiveItemSpacing = isMobile
      ? config.itemSpacing * 0.8
      : config.itemSpacing

    // Convert mm to px (1mm ≈ 3.78px)
    const mmToPx = 3.78
    const effectivePageMarginPx = isMobile
      ? Math.max(16, config.pageMargin * mmToPx * 0.5)
      : config.pageMargin * mmToPx

    return {
      container: {
        '--theme-color': config.themeColor,
        fontSize: `${effectiveFontSize}px`,
        lineHeight: config.lineHeight,
        paddingTop: isMobile ? '20px' : '32px',
        paddingBottom: isMobile ? '20px' : '32px',
        paddingLeft: `${effectivePageMarginPx}px`,
        paddingRight: `${effectivePageMarginPx}px`,
      } as React.CSSProperties,

      header: {
        borderColor: config.themeColor,
        color: config.themeColor,
        fontSize: `${effectiveFontSize * (isMobile ? 1.2 : 1.4)}px`, // Reduced slightly for better hierarchy
      },

      subHeader: {
        fontSize: `${effectiveFontSize * (isMobile ? 1.05 : 1.1)}px`,
      },

      text: {
        fontSize: `${effectiveFontSize}px`,
      },

      section: {
        marginBottom: `${effectiveSectionSpacing}px`,
      },

      item: {
        marginBottom: `${effectiveItemSpacing}px`,
      },

      isMobile,
      fontFamilyClass: getFontFamilyClass(config.fontFamily),
      themeColor: config.themeColor,
    }
  }, [config, isMobile])

  return styles
}
