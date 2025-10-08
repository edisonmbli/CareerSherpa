import type { Locale } from '@/i18n-config'
import en from './en'
import zh from './zh'

const dictionaries = {
  en: () => Promise.resolve(en),
  zh: () => Promise.resolve(zh),
}

export async function getDictionary(locale: Locale) {
  const loader = dictionaries[locale as keyof typeof dictionaries]
  return loader ? loader() : dictionaries.en()
}
