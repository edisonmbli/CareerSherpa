import { getVectorStore } from '@/lib/rag/vectorStore'
import { markTimeline } from '@/lib/observability/timeline'

export interface MatchRagInput {
  jobTitle: string
  mustHaves: string[]
  niceToHaves: string[]
  resumeSkills: string[]
  topStrengths: string[]
}

export async function retrieveMatchContext(
  input: MatchRagInput,
  serviceId: string,
  taskId: string
): Promise<string> {
  await markTimeline(serviceId, 'worker_stream_vars_rag_start', { taskId })
  
  const { jobTitle, mustHaves, niceToHaves, resumeSkills, topStrengths } = input

  const queryA = [
    '岗位匹配度分析方法',
    jobTitle ? `岗位 ${jobTitle}` : '',
    mustHaves.length ? `必须技能 ${mustHaves.join(', ')}` : '',
    niceToHaves.length ? `加分项 ${niceToHaves.join(', ')}` : '',
    resumeSkills.length ? `简历技能 ${resumeSkills.join(', ')}` : '',
    '优势识别 劣势规避 简历定制 面试准备 专业评估框架',
  ]
    .filter(Boolean)
    .join('；')

  const queryB = [
    'HR私聊话术 模板',
    jobTitle ? `岗位 ${jobTitle}` : '',
    topStrengths.length ? `亮点 ${topStrengths.join(', ')}` : '',
    '简洁 有力 精准 高匹配 DM script 开场与收尾',
  ]
    .filter(Boolean)
    .join('；')

  const tRag0 = Date.now()
  const store = getVectorStore()
  const tRagInit = Date.now()
  
  // Parallel retrieval
  const [resA, resB] = await Promise.all([
    store.retrieve({ query: queryA, similarityTopK: 6 }),
    store.retrieve({ query: queryB, similarityTopK: 4 }),
  ])
  
  const tRag1 = Date.now()

  const texts = [...resA, ...resB]
    .map((r: any) =>
      typeof r?.node?.getContent === 'function'
        ? r.node.getContent()
        : String(r?.node?.text || '')
    )
    .filter((t) => t.length > 0)

  const rag = texts
    .map((t) => t.slice(0, 1000))
    .join('\n\n')
    .slice(0, 4000)

  await markTimeline(serviceId, 'worker_stream_vars_rag_end', {
    taskId,
    latencyMs: tRag1 - tRag0,
    meta: JSON.stringify({
      initMs: tRagInit - tRag0,
      retrieveMs: tRag1 - tRagInit,
      count: texts.length,
      totalLen: rag.length,
    }),
  })
    
  return rag
}
