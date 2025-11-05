/**
 * Prompt Template Loader
 * 根据 i18n locale 动态加载对应的模板
 */
import { i18n, type Locale } from '@/i18n-config' //
import { ZH_TEMPLATES } from './zh'
import { EN_TEMPLATES } from './en'
import type { PromptTemplateMap, TaskTemplateId } from './types'

const templates: Record<Locale, PromptTemplateMap> = {
  zh: ZH_TEMPLATES,
  en: EN_TEMPLATES,
}

/**
 * 获取指定 locale 的所有 Prompt 模板
 * @param locale 'zh' | 'en'
 * @returns
 */
export const getTemplates = (locale: Locale): PromptTemplateMap => {
  return templates[locale] || templates[i18n.defaultLocale]
}

/**
 * 获取指定 locale 的单个 Prompt 模板
 * @param locale 'zh' | 'en'
 * @param id TaskTemplateId
 * @returns
 */
export const getTemplate = (locale: Locale, id: TaskTemplateId) => {
  const langTemplates = getTemplates(locale)
  const template = langTemplates[id]

  if (!template) {
    throw new Error(
      `Prompt template not found for id: ${id} in locale: ${locale}`
    )
  }

  return template
}
