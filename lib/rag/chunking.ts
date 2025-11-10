import { SentenceSplitter } from 'llamaindex'
import { bindMetadataToChunks, BinderOptions, BoundItem, RagLocale } from '@/lib/rag/metadataBinder'

export interface LlamaChunkOptions extends Omit<BinderOptions, 'titleFallback' | 'source'> {
  // maximum characters per chunk
  maxChars?: number
  // source filename (for metadata)
  source: string
  // fallback title when no heading context is found
  titleFallback: string
}

/**
 * 使用 LlamaIndex 的 SentenceSplitter 完成分块，并调用现有 binder 绑定元数据。
 * 这样将分块逻辑融入 LlamaIndex，同时保留我们成熟的元数据绑定与标题推断策略。
 */
export function chunkUsingLlamaIndex(mdText: string, opts: LlamaChunkOptions): BoundItem[] {
  const maxChars = Math.max(200, opts.maxChars ?? 1200)
  const splitter = new SentenceSplitter({ chunkSize: maxChars, chunkOverlap: 100 })

  // SentenceSplitter 针对一般纯文本也适用，此处直接用于 Markdown 文本。
  const chunkBodies = splitter.splitText(mdText)

  // exactOptionalPropertyTypes 下，避免将 undefined 赋给要求为 string 的字段
  const defaultCategoryNormalized: string =
    typeof opts.defaultCategory === 'string' ? opts.defaultCategory : ''

  return bindMetadataToChunks(
    mdText,
    chunkBodies,
    {
      defaultLang: opts.defaultLang,
      defaultCategory: defaultCategoryNormalized,
      titleFallback: opts.titleFallback,
      source: opts.source,
      hasCliLangOverride: !!opts.hasCliLangOverride,
      hasCliCategoryOverride: !!opts.hasCliCategoryOverride,
    }
  )
}

/**
 * 经典 Markdown 分块器（不写入 RAG_METADATA 到正文）
 * - 模仿历史上稳定的 chunkMarkdown 行为：按标题组织，按最大长度分页，并在段落级别进一步细分
 * - 识别章节内的 RAG_METADATA 并绑定到分块（lang/category）
 * - 与 LlamaIndex 无强依赖，可在 exactOptionalPropertyTypes 下安全工作
 */
export function chunkMarkdownClassic(
  content: string,
  opts: LlamaChunkOptions
): BoundItem[] {
  const maxChars = Math.max(200, opts.maxChars ?? 1200)
  const lines = content.split(/\r?\n/)

  type Meta = { lang?: RagLocale; category?: string }
  type ChunkRaw = { title?: string; body: string; meta?: Meta }

  const chunks: ChunkRaw[] = []
  let currentTitle: string | undefined
  let buf: string[] = []
  let currentMeta: Meta | undefined

  const flush = () => {
    const body = buf.join('\n').trim()
    if (body.length > 0) {
      const item: ChunkRaw = { body }
      if (typeof currentTitle === 'string') item.title = currentTitle
      if (currentMeta && (currentMeta.lang || currentMeta.category)) {
        item.meta = { ...currentMeta }
      }
      chunks.push(item)
    }
    buf = []
  }

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line)
    if (m) {
      // 遇到新标题，先输出前一段
      if (buf.join('\n').trim().length > 0) flush()
      currentTitle = m[2]!.trim()
      continue
    }
    // 解析章节内的 RAG_METADATA 注释（不写入正文）
    const metaMatch = /<!--\s*RAG_METADATA\s*:\s*(\{[\s\S]*?\})\s*-->/.exec(line)
    if (metaMatch) {
      try {
        const json = JSON.parse(metaMatch[1]!)
        const lang = json.lang as RagLocale | undefined
        const category = json.category as string | undefined
        currentMeta = {}
        if (typeof lang === 'string') currentMeta.lang = lang
        if (typeof category === 'string') currentMeta.category = category
      } catch {
        // ignore malformed metadata
      }
      continue
    }
    // 跳过 Markdown 分隔线（章节边界），避免写入正文
    const trimmed = line.trim()
    const isHr = /^(?:-{3,}|_{3,}|\*{3,}|—+|–+)$/.test(trimmed)
    if (isHr) {
      // 作为边界提示，先刷新已有缓冲
      if (buf.join('\n').trim().length > 0) flush()
      continue
    }
    buf.push(line)
    if (buf.join('\n').length >= maxChars) flush()
  }
  flush()

  // 进一步按空行拆分大段
  const refined: ChunkRaw[] = []
  for (const c of chunks) {
    const paras = c.body.split(/\n{2,}/)
    let acc = ''
    for (const p of paras) {
      const merged = acc ? acc + '\n\n' + p : p
      if (merged.trim().length > maxChars) {
        if (acc.trim().length > 0) {
          const item: ChunkRaw = { body: acc.trim() }
          if (typeof c.title === 'string') item.title = c.title
          if (c.meta) item.meta = { ...c.meta }
          refined.push(item)
        }
        acc = p
      } else {
        acc = merged
      }
    }
    if (acc.trim().length > 0) {
      const item: ChunkRaw = { body: acc.trim() }
      if (typeof c.title === 'string') item.title = c.title
      if (c.meta) item.meta = { ...c.meta }
      refined.push(item)
    }
  }

  // 转换为 BoundItem，应用 CLI 覆盖与默认值
  const out: BoundItem[] = []
  const normalizeChunkBody = (body: string): string => {
    // 1) 删除 HR 分隔线；2) 合并英文软换行；3) 保持列表项使用“单换行”相邻、并在列表块与普通段落之间使用“空行”分隔
    const hrRegex = /^(?:-{3,}|_{3,}|\*{3,}|—+|–+)$/
    const lines = body.split(/\r?\n/)
    const kept: string[] = []
    for (const ln of lines) {
      const t = ln.trim()
      if (hrRegex.test(t)) continue
      kept.push(ln)
    }

    let result = ''
    let inList = false
    for (const ln of kept) {
      const t = ln.trim()
      const isBlank = t.length === 0
      const isBullet = /^[\-\*\+]\s/.test(t) || /^\d+\.\s/.test(t)

      if (isBlank) {
        // 空行：列表内部不引入额外空行；普通段落保持至多一个空行分隔
        if (inList) {
          // 忽略列表内部的空白行
          continue
        }
        if (!result.endsWith('\n\n')) result += '\n\n'
        continue
      }

      if (isBullet) {
        // 列表项：相邻项用单换行相隔；列表块与前后普通段落之间用空行分隔
        if (!inList) {
          // 列表块开始：若前面不是段落空行，则补一个空行分隔
          if (result.length > 0 && !result.endsWith('\n\n')) result += '\n\n'
          inList = true
        } else {
          // 列表内部相邻项，使用单换行
          if (!result.endsWith('\n')) result += '\n'
        }
        result += t
        continue
      }

      // 普通文本行：若刚结束列表块，确保与段落之间使用空行分隔；否则合并为同一段的软换行
      if (inList) {
        if (!result.endsWith('\n\n')) result += '\n\n'
        inList = false
      }
      if (result.length > 0 && !result.endsWith('\n\n')) result += ' '
      result += t
    }
    return result.trim()
  }
  for (const c of refined) {
    let lang: RagLocale = opts.defaultLang
    let category: string | undefined = opts.defaultCategory
    if (!opts.hasCliLangOverride && c.meta?.lang) lang = c.meta.lang
    if (!opts.hasCliCategoryOverride && c.meta?.category) category = c.meta.category

    const title = c.title ?? opts.titleFallback
    const item: BoundItem = {
      title,
      content: normalizeChunkBody(c.body),
      lang,
      source: opts.source,
    }
    if (typeof category === 'string') item.category = category
    out.push(item)
  }
  return out
}