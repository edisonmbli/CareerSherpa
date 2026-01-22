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
  taskId: string,
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
    queryRag(queryA, {
      lang: safeLocale.startsWith('zh') ? 'zh' : 'en',
      category: 'job_match',
    }),
    queryRag(queryB, {
      lang: safeLocale.startsWith('zh') ? 'zh' : 'en',
      category: 'express_job_intent',
    }),
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
  locale: string,
): Promise<string> {
  const safeLocale = (
    i18n.locales.includes(locale as Locale) ? locale : i18n.defaultLocale
  ) as Locale
  const dict = await getDictionary(safeLocale)

  const vars = { title: jobTitle }

  const queryA = formatQuery(dict.rag.customize_general, vars)
  const queryB = formatQuery(dict.rag.customize_role, vars)

  const [resultsA, resultsB] = await Promise.all([
    queryRag(queryA, {
      lang: safeLocale.startsWith('zh') ? 'zh' : 'en',
      category: 'cv_customize',
    }),
    queryRag(queryB, {
      lang: safeLocale.startsWith('zh') ? 'zh' : 'en',
      category: 'cv_customize',
    }),
  ])

  const combined = [...resultsA, ...resultsB]
  const uniqueContent = Array.from(new Set(combined.map((r) => r.content)))

  return uniqueContent.join('\n\n---\n\n')
}

/**
 * Base RAG Query Function
 */
type RagQueryOptions = {
  lang?: 'zh' | 'en'
  category?: string
  topK?: number
  minScore?: number
  isPublic?: boolean
}

function normalizeRagOptions(
  localeOrOptions?: string | RagQueryOptions,
  category?: string,
): RagQueryOptions {
  if (!localeOrOptions) return {}
  if (typeof localeOrOptions === 'string') {
    return category
      ? {
          lang: localeOrOptions.startsWith('zh') ? 'zh' : 'en',
          category,
        }
      : {
          lang: localeOrOptions.startsWith('zh') ? 'zh' : 'en',
        }
  }
  return localeOrOptions
}

export async function queryRag(
  queryText: string,
  localeOrOptions?: string | RagQueryOptions,
  category?: string,
) {
  const options = normalizeRagOptions(localeOrOptions, category)
  const store = getVectorStore()
  const filters: any[] = []

  if (options.lang) {
    filters.push({ key: 'lang', value: options.lang, operator: '==' })
  }

  if (options.category) {
    filters.push({ key: 'category', value: options.category, operator: '==' })
  }

  const isPublic =
    typeof options.isPublic === 'boolean' ? options.isPublic : true
  filters.push({ key: 'is_public', value: isPublic, operator: '==' })

  const topK = Math.max(1, options.topK ?? 3)
  const minScore = Math.max(0, options.minScore ?? 0)

  const results = await store.retrieve({
    query: queryText,
    similarityTopK: topK,
    filters: { filters, condition: 'and' },
  })

  return results
    .map((r: any) => {
      const node = r?.node
      const metadata = (node?.metadata || {}) as Record<string, unknown>
      const content =
        typeof node?.getContent === 'function'
          ? node.getContent()
          : String(node?.text || '')
      return {
        id: String(metadata['id'] ?? ''),
        title: metadata['title'] ? String(metadata['title']) : undefined,
        content,
        category: metadata['category']
          ? String(metadata['category'])
          : undefined,
        lang: metadata['lang'] === 'zh' ? 'zh' : 'en',
        score: Number(r?.score ?? 0),
      }
    })
    .filter((item: any) => item.score >= minScore)
}

export async function queryRagByCategory(
  queryText: string,
  category: string,
  options?: Omit<RagQueryOptions, 'category'>,
) {
  return queryRag(queryText, { ...(options || {}), category })
}
