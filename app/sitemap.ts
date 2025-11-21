import { i18n } from '@/i18n-config'

export default function sitemap() {
  const siteUrl = process.env['NEXT_PUBLIC_SITE_URL'] || 'http://localhost:3000'
  const now = new Date()
  const entries = i18n.locales.map((locale) => ({
    url: `${siteUrl}/${locale}`,
    lastModified: now,
    alternates: { languages: { en: `${siteUrl}/en`, zh: `${siteUrl}/zh` } },
  }))
  return entries
}