import { getVectorStore } from '@/lib/rag/vectorStore'
import { markTimeline } from '@/lib/observability/timeline'
import { getDictionary } from '@/lib/i18n/dictionaries'
import { i18n, Locale } from '@/i18n-config'

export interface MatchRagInput {
  jobTitle: string
  mustHaves: string[]
  niceToHaves: string[]
  resumeSkills: string[]
  topStrengths: string[]
}

/**
 * Helper to replace variables in query template
 */
function formatQuery(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || '')
}

/**
 * Retrieve RAG context for Job Match Analysis.
 * Queries both "Job Analysis" and "Resume Fit" topics concurrently.
 */
export async function retrieveMatchContext(
  input: MatchRagInput,
  locale: string,
  taskId: string
): Promise<string> {
  const { jobTitle, mustHaves } = input
  const safeLocale = (
    i18n.locales.includes(locale as Locale) ? locale : i18n.defaultLocale
  ) as Locale
  const dict = await getDictionary(safeLocale)

  const skillsStr = mustHaves.slice(0, 3).join(' ')
  const vars = { title: jobTitle, skills: skillsStr }

  const queryA = formatQuery(dict.rag.match_job_analysis, vars)
  const queryB = formatQuery(dict.rag.match_resume_fit, vars)

  const [resultsA, resultsB] = await Promise.all([
    queryRag(queryA, locale, 'job_match'),
    queryRag(queryB, locale, 'express_job_intent'),
  ])

  // Merge and deduplicate results
  const combined = [...resultsA, ...resultsB]
  const uniqueContent = Array.from(new Set(combined.map((r) => r.content)))

  return uniqueContent.join('\n\n---\n\n')
}

/**
 * Retrieve RAG context for Resume Customization.
 * Queries both "General Writing Tips" and "Role-Specific Optimization".
 */
export async function retrieveCustomizeContext(
  jobTitle: string,
  locale: string
): Promise<string> {
  const safeLocale = (
    i18n.locales.includes(locale as Locale) ? locale : i18n.defaultLocale
  ) as Locale
  const dict = await getDictionary(safeLocale)

  const vars = { title: jobTitle }

  const queryA = formatQuery(dict.rag.customize_general, vars)
  const queryB = formatQuery(dict.rag.customize_role, vars)

  const [resultsA, resultsB] = await Promise.all([
    queryRag(queryA, locale, 'cv_customize'),
    queryRag(queryB, locale, 'cv_customize'),
  ])

  const combined = [...resultsA, ...resultsB]
  const uniqueContent = Array.from(new Set(combined.map((r) => r.content)))

  return uniqueContent.join('\n\n---\n\n')
}

/**
 * Base RAG Query Function
 */
export async function queryRag(
  queryText: string,
  locale: string,
  category?: string
) {
  const store = getVectorStore()
  const filters: any[] = []

  if (locale) {
    // Only filter by lang if it's explicitly supported in DB (which it is)
    // Map locale 'zh-CN' -> 'zh' if needed, but usually we use 'zh' or 'en'
    const lang = locale.startsWith('zh') ? 'zh' : 'en'
    filters.push({ key: 'lang', value: lang, operator: '==' })
  }

  if (category) {
    filters.push({ key: 'category', value: category, operator: '==' })
  }

  const results = await store.retrieve({
    query: queryText,
    similarityTopK: 3,
    filters: { filters, condition: 'and' },
  })

  return results.map((r: any) => ({
    content:
      typeof r?.node?.getContent === 'function'
        ? r.node.getContent()
        : String(r?.node?.text || ''),
    score: r.score,
  }))
}
