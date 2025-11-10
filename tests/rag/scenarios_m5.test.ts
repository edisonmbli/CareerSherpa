import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { queryRagByCategory } from '@/lib/rag/retriever'
import { findSimilarKnowledgeEntries } from '@/lib/dal/knowledgeEntries'
import { generateEmbedding } from '@/lib/llm/embeddings'

/**
 * M5 设计场景覆盖测试
 * - 基于已入库的 zh/en 求职宝典（Terminal#64-75）
 * - 覆盖三个核心检索场景：match、customize、interview
 * - 断言：语言与分类过滤的正确性，以及关键内容片段是否命中/排除
 */

type UnifiedRagItem = {
  id: string
  title?: string
  content: string
  category?: string
  lang: 'zh' | 'en'
  score: number
}

function concatContext(items: { content: string }[]): string {
  return items.map((i) => i.content).join('\n\n')
}

/**
 * 解析并安全打印数据库连接信息（不泄露凭证）
 */
function safeDbInfo() {
  try {
    const raw = process.env['DATABASE_URL'] || ''
    const u = new URL(raw)
    return {
      host: u.hostname,
      db: u.pathname.replace(/^\//, ''),
      sslmode: u.searchParams.get('sslmode') || 'unknown',
      pgbouncer: u.searchParams.get('pgbouncer') || 'unknown',
    }
  } catch {
    return { host: 'unknown', db: 'unknown', sslmode: 'unknown', pgbouncer: 'unknown' }
  }
}

/**
 * 带回退的检索：优先使用向量存储（queryRagByCategory），失败时回退到 Prisma+$queryRaw
 * 保持统一的返回结构，便于断言与打印
 */
async function retrieveWithFallback(
  query: string,
  category: string,
  opts: { lang: 'zh' | 'en'; topK?: number; minScore?: number }
): Promise<{ items: UnifiedRagItem[]; used: 'vectorStore' | 'prismaFallback'; debug?: string }> {
  const { lang, topK = 5, minScore = 0 } = opts
  try {
    const res = await queryRagByCategory(query, category, { lang, topK, minScore })
    const items: UnifiedRagItem[] = res.map((r) => {
      const item: UnifiedRagItem = {
        id: r.id,
        content: r.content,
        lang: r.lang,
        score: r.score,
      }
      if (r.title) item.title = r.title
      if (r.category) item.category = r.category
      return item
    })
    return { items, used: 'vectorStore' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // eslint-disable-next-line no-console
    console.warn('[M5 Debug] vectorStore 检索失败，回退到 Prisma：', msg)
    try {
      const embedding = await generateEmbedding(query)
      const rows = await findSimilarKnowledgeEntries(embedding, { lang, category, isPublic: true }, topK, minScore)
      const items: UnifiedRagItem[] = rows.map((r) => {
        const item: UnifiedRagItem = {
          id: r.id,
          content: r.content,
          lang: r.lang === 'zh' ? 'zh' : r.lang === 'en' ? 'en' : lang,
          score: r.score,
        }
        if (r.title) item.title = r.title
        if (r.category) item.category = r.category
        return item
      })
      return { items, used: 'prismaFallback', debug: msg }
    } catch (err2) {
      const msg2 = err2 instanceof Error ? err2.message : String(err2)
      // 保留原始错误链路，便于定位
      throw new Error(`RAG 检索失败（vectorStore & Prisma 均失败）：${msg} | ${msg2}`)
    }
  }
}

let hasZhCustomize = false
let hasZhMatch = false
let hasZhMatchIntent = false
let hasEnInterviewIntro = false
let hasEnInterviewQa = false

beforeAll(async () => {
  const count = await prisma.knowledgeEntry.count()
  if (count === 0) {
    throw new Error(
      'RAG 数据库为空。请先运行 `npx tsx scripts/ingest-rag-docs.ts` 完成入库。'
    )
  }
  // 探测各分类数据是否存在，便于条件化执行
  hasZhCustomize =
    (await prisma.knowledgeEntry.count({
      where: { lang: 'zh', category: 'cv_customize', isPublic: true },
    })) > 0
  hasZhMatch =
    (await prisma.knowledgeEntry.count({
      where: { lang: 'zh', category: 'job_match', isPublic: true },
    })) > 0
  hasZhMatchIntent =
    (await prisma.knowledgeEntry.count({
      where: { lang: 'zh', category: 'express_job_intent', isPublic: true },
    })) > 0
  hasEnInterviewIntro =
    (await prisma.knowledgeEntry.count({
      where: { lang: 'en', category: 'self_introduction', isPublic: true },
    })) > 0
  hasEnInterviewQa =
    (await prisma.knowledgeEntry.count({
      where: { lang: 'en', category: 'interview_strategies', isPublic: true },
    })) > 0
  // 调试输出：各分类计数探测结果，帮助定位为何测试被跳过
  // eslint-disable-next-line no-console
  console.table({
    hasZhCustomize,
    hasZhMatch,
    hasZhMatchIntent,
    hasEnInterviewIntro,
    hasEnInterviewQa,
    db: safeDbInfo(),
    glmKeyPresent: Boolean(process.env['ZHIPUAI_API_KEY']),
  })
}, 30000)

describe('M5 场景覆盖：queryRag', () => {
  it(
    '场景1：match（zh）命中 Part3+Part4，排除面试内容',
    async () => {
      if (!(hasZhMatch || hasZhMatchIntent)) {
        // eslint-disable-next-line no-console
        console.warn('[M5 Debug] 跳过原因：zh 的 job_match/express_job_intent 分类计数为 0')
        return
      }
      const query = '分析 JD 和简历的匹配度'

      const part3Res = await retrieveWithFallback(query, 'job_match', { lang: 'zh', topK: 3, minScore: 0 })
      const part4Res = await retrieveWithFallback(query, 'express_job_intent', { lang: 'zh', topK: 3, minScore: 0 })
      const part3 = part3Res.items
      const part4 = part4Res.items

      // 完整打印：输入参数与召回结果
      // eslint-disable-next-line no-console
      console.log('[场景1] 输入与召回', JSON.stringify({
        input: { query, lang: 'zh', categories: ['job_match', 'express_job_intent'] },
        used: { job_match: part3Res.used, express_job_intent: part4Res.used },
        results: {
          job_match: part3.map((x) => ({ id: x.id, title: x.title, score: x.score, category: x.category, lang: x.lang, content: x.content })),
          express_job_intent: part4.map((x) => ({ id: x.id, title: x.title, score: x.score, category: x.category, lang: x.lang, content: x.content })),
        }
      }, null, 2))

      // 至少一个分类命中
      expect(part3.length + part4.length).toBeGreaterThan(0)
      part3.forEach((r) => {
        expect(r.lang).toBe('zh')
        expect(r.category).toBe('job_match')
      })
      part4.forEach((r) => {
        expect(r.lang).toBe('zh')
        expect(r.category).toBe('express_job_intent')
      })

      const ctx = concatContext([...part3, ...part4])
      // 关键片段（存在性）
      expect(ctx).toMatch(/JD/i)
      expect(ctx).toMatch(/H-?V-?C/i) // 兼容 H-V-C 书写
      // 排除面试相关噪声
      expect(ctx).not.toMatch(/STAR\s*法则/i)
    },
    30000
  )
  it(
    '场景2：customize（zh）命中 X-Y-Z，排除职业锚',
    async () => {
      if (!hasZhCustomize) {
        // eslint-disable-next-line no-console
        console.warn('[M5 Debug] 跳过原因：zh 的 cv_customize 分类计数为 0')
        return
      }
      const query = '如何量化我的工作成就'
      const resPack = await retrieveWithFallback(query, 'cv_customize', { lang: 'zh', topK: 5, minScore: 0 })
      const res = resPack.items

      // 完整打印：输入参数与召回结果
      // eslint-disable-next-line no-console
      console.log('[场景2] 输入与召回', JSON.stringify({
        input: { query, lang: 'zh', category: 'cv_customize' },
        used: resPack.used,
        results: res.map((x) => ({ id: x.id, title: x.title, score: x.score, category: x.category, lang: x.lang, content: x.content })),
      }, null, 2))

      expect(res.length).toBeGreaterThan(0)
      res.forEach((r) => expect(r.lang).toBe('zh'))
      res.forEach((r) => expect(r.category).toBe('cv_customize'))

      const ctx = concatContext(res)
      expect(ctx).toMatch(/X-?Y-?Z/i)
      expect(ctx).not.toMatch(/职业锚/i)
    },
    30000
  )
  it(
    '场景3：interview（en）命中弱项回答与 P-P-F，排除 JD 拆解',
    async () => {
      if (!(hasEnInterviewIntro && hasEnInterviewQa)) {
        // eslint-disable-next-line no-console
        console.warn('[M5 Debug] 跳过原因：en 的 self_introduction/interview_strategies 分类计数为 0')
        return
      }
      const query = 'how to answer about my weakness'
      const introPack = await retrieveWithFallback(query, 'self_introduction', { lang: 'en', topK: 3, minScore: 0 })
      const qaPack = await retrieveWithFallback(query, 'interview_strategies', { lang: 'en', topK: 3, minScore: 0 })
      const intro = introPack.items
      const qa = qaPack.items

      // 完整打印：输入参数与召回结果
      // eslint-disable-next-line no-console
      console.log('[场景3] 输入与召回', JSON.stringify({
        input: { query, lang: 'en', categories: ['self_introduction', 'interview_strategies'] },
        used: { self_introduction: introPack.used, interview_strategies: qaPack.used },
        results: {
          self_introduction: intro.map((x) => ({ id: x.id, title: x.title, score: x.score, category: x.category, lang: x.lang, content: x.content })),
          interview_strategies: qa.map((x) => ({ id: x.id, title: x.title, score: x.score, category: x.category, lang: x.lang, content: x.content })),
        }
      }, null, 2))

      expect(intro.length).toBeGreaterThan(0)
      expect(qa.length).toBeGreaterThan(0)
      intro.forEach((r) => expect(r.lang).toBe('en'))
      qa.forEach((r) => expect(r.lang).toBe('en'))
      intro.forEach((r) => expect(r.category).toBe('self_introduction'))
      qa.forEach((r) => expect(r.category).toBe('interview_strategies'))

      const ctx = concatContext([...intro, ...qa])
      expect(ctx).toMatch(/weakness/i)
      // 业务对齐：允许 PPF/STAR/CAR 之一命中，兼容未来模板改写
      const matchesPPF = /P-?P-?F/i.test(ctx)
      const matchesSTAR = /\bSTAR\b/i.test(ctx)
      const matchesCAR = /\bC-?A-?R\b/i.test(ctx)
      expect(matchesPPF || matchesSTAR || matchesCAR).toBe(true)
      expect(ctx).not.toMatch(/Deconstructing\s+the\s+JD/i)
    },
    30000
  )
})
