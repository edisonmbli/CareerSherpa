export const i18n = {
  locales: ['en', 'zh'],
  defaultLocale: 'en',
} as const

export type Locale = (typeof i18n)['locales'][number]

export function isSupportedLocale(
  locale: string | undefined
): locale is Locale {
  return !!locale && i18n.locales.includes(locale as any)
}
