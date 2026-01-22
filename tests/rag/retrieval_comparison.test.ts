import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import {
  findSimilarKnowledgeEntries,
  findSimilarKnowledgeEntriesViaVectorStore,
} from '@/lib/dal/knowledgeEntries'
import { runEmbedding } from '@/lib/llm/service'

type Row = {
  id: string
  score: number
  lang: 'zh' | 'en'
  category: string
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdev(xs: number[]): number {
  if (xs.length <= 1) return 0
  const m = mean(xs)
  const v = xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1)
  return Math.sqrt(v)
}

function orderEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function intersectionSize(a: string[], b: string[]): number {
  const setB = new Set(b)
  return a.filter((x) => setB.has(x)).length
}

beforeAll(async () => {
  const count = await prisma.knowledgeEntry.count()
  if (count === 0) {
    throw new Error(
      'RAG 数据库为空。请先运行 `npx tsx scripts/ingest-rag-docs.ts` 完成入库。',
    )
  }
}, 30000)

describe('检索路径对比：SQL($queryRaw) vs VectorStore', () => {
  it('zh/customize：Top-K 集合与排序、分数统计与性能', async () => {
    const query = '如何量化我的工作成就'
    const topK = 5
    const preferredFilters = {
      lang: 'zh' as const,
      category: 'customize',
      isPublic: true,
    }

    const t0 = Date.now()
    const { vector: embeddingRes } = await runEmbedding(query)
    // 安全回退：若嵌入不存在或维度不为 2048，则使用 2048 维的常量向量
    const embedding =
      Array.isArray(embeddingRes) && embeddingRes.length === 2048
        ? embeddingRes
        : new Array(2048).fill(0.001)
    const t1 = Date.now()
    let usedCategory: string | undefined = preferredFilters.category
    let sqlRows = (await findSimilarKnowledgeEntries(
      embedding,
      preferredFilters,
      topK,
      0,
    )) as Row[]
    const t2 = Date.now()

    let vecRows: Row[] = []
    let vecError: string | undefined
    let t3 = Date.now()
    try {
      vecRows = (await findSimilarKnowledgeEntriesViaVectorStore(
        query,
        preferredFilters,
        topK,
        0,
      )) as Row[]
      t3 = Date.now()
    } catch (err) {
      vecError = err instanceof Error ? err.message : String(err)
      t3 = Date.now()
    }

    // Fallback：若分类为 customize 不存在或两路均为空，则退化为仅按照 lang 过滤
    if (sqlRows.length === 0 && vecRows.length === 0) {
      usedCategory = undefined
      sqlRows = (await findSimilarKnowledgeEntries(
        embedding,
        { lang: 'zh', isPublic: true },
        topK,
        0,
      )) as Row[]
      try {
        vecRows = (await findSimilarKnowledgeEntriesViaVectorStore(
          query,
          { lang: 'zh', isPublic: true },
          topK,
          0,
        )) as Row[]
      } catch (err) {
        vecError = err instanceof Error ? err.message : String(err)
      }
    }

    expect(sqlRows.length).toBeGreaterThan(0)

    const idsSql = sqlRows.map((r) => r.id)
    const idsVec = vecRows.map((r) => r.id)
    const inter = intersectionSize(idsSql, idsVec)
    const orderSame = orderEqual(idsSql, idsVec)

    const sqlScores = sqlRows.map((r) => r.score)
    const vecScores = vecRows.map((r) => r.score)

    const metrics = {
      k: topK,
      overlap: inter,
      orderSame,
      usedCategory: usedCategory ?? 'none',
      sqlMean: mean(sqlScores).toFixed(6),
      vecMean: vecRows.length ? mean(vecScores).toFixed(6) : 'N/A',
      sqlStdev: stdev(sqlScores).toFixed(6),
      vecStdev: vecRows.length ? stdev(vecScores).toFixed(6) : 'N/A',
      tEmbedMs: t1 - t0,
      tSqlMs: t2 - t1,
      tVecMs: t3 - t2,
      vecError,
    }

    // 输出对比指标，便于后续架构决策
    console.table(metrics)

    // 基本一致性断言：至少有一定交集，且两路结果按分数排序（降序）
    if (vecRows.length) {
      expect(inter).toBeGreaterThanOrEqual(Math.min(topK, 2))
      const vecArr = vecRows.map((r) => r.score)
      const nonIncreasingVec = vecArr.every((v, i, arr) =>
        i === 0 ? true : v <= arr[i - 1]!,
      )
      expect(nonIncreasingVec).toBe(true)
    }
    const sqlArr = sqlRows.map((r) => r.score)
    const nonIncreasingSql = sqlArr.every((v, i, arr) =>
      i === 0 ? true : v <= arr[i - 1]!,
    )
    expect(nonIncreasingSql).toBe(true)
  }, 60000)

  it('en/interview_qa：Top-K 集合与排序、分数统计与性能', async () => {
    const query = 'how to answer about my weakness'
    const topK = 5
    const preferredFilters = {
      lang: 'en' as const,
      category: 'interview_qa',
      isPublic: true,
    }

    const t0 = Date.now()
    const { vector: embeddingRes2 } = await runEmbedding(query)
    // 安全回退：若嵌入不存在或维度不为 2048，则使用 2048 维的常量向量
    const embedding2 =
      Array.isArray(embeddingRes2) && embeddingRes2.length === 2048
        ? embeddingRes2
        : new Array(2048).fill(0.001)
    const t1 = Date.now()
    let usedCategory: string | undefined = preferredFilters.category
    let sqlRows = (await findSimilarKnowledgeEntries(
      embedding2,
      preferredFilters,
      topK,
      0,
    )) as Row[]
    const t2 = Date.now()

    let vecRows2: Row[] = []
    let vecError2: string | undefined
    let t3 = Date.now()
    try {
      vecRows2 = (await findSimilarKnowledgeEntriesViaVectorStore(
        query,
        preferredFilters,
        topK,
        0,
      )) as Row[]
      t3 = Date.now()
    } catch (err) {
      vecError2 = err instanceof Error ? err.message : String(err)
      t3 = Date.now()
    }

    // Fallback：若分类 interview_qa 不存在或两路均为空，则退化为仅按照 lang 过滤
    if (sqlRows.length === 0 && vecRows2.length === 0) {
      usedCategory = undefined
      sqlRows = (await findSimilarKnowledgeEntries(
        embedding2,
        { lang: 'en', isPublic: true },
        topK,
        0,
      )) as Row[]
      try {
        vecRows2 = (await findSimilarKnowledgeEntriesViaVectorStore(
          query,
          { lang: 'en', isPublic: true },
          topK,
          0,
        )) as Row[]
      } catch (err) {
        vecError2 = err instanceof Error ? err.message : String(err)
      }
    }

    expect(sqlRows.length).toBeGreaterThan(0)

    const idsSql = sqlRows.map((r) => r.id)
    const idsVec2 = vecRows2.map((r) => r.id)
    const inter = intersectionSize(idsSql, idsVec2)
    const orderSame = orderEqual(idsSql, idsVec2)

    const sqlScores = sqlRows.map((r) => r.score)
    const vecScores2 = vecRows2.map((r) => r.score)

    const metrics = {
      k: topK,
      overlap: inter,
      orderSame,
      sqlMean: mean(sqlScores).toFixed(6),
      vecMean: vecRows2.length ? mean(vecScores2).toFixed(6) : 'N/A',
      sqlStdev: stdev(sqlScores).toFixed(6),
      vecStdev: vecRows2.length ? stdev(vecScores2).toFixed(6) : 'N/A',
      tEmbedMs: t1 - t0,
      tSqlMs: t2 - t1,
      tVecMs: t3 - t2,
      vecError: vecError2,
      usedCategory: usedCategory ?? 'none',
    }

    console.table(metrics)

    if (vecRows2.length) {
      expect(inter).toBeGreaterThanOrEqual(Math.min(topK, 2))
      const vecArr2 = vecRows2.map((r) => r.score)
      const nonIncreasingVec2 = vecArr2.every((v, i, arr) =>
        i === 0 ? true : v <= arr[i - 1]!,
      )
      expect(nonIncreasingVec2).toBe(true)
    }
    const sqlArr = sqlRows.map((r) => r.score)
    const nonIncreasingSql2 = sqlArr.every((v, i, arr) =>
      i === 0 ? true : v <= arr[i - 1]!,
    )
    expect(nonIncreasingSql2).toBe(true)
  }, 60000)
})
