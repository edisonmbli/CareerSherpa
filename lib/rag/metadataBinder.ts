/**
 * 注释元数据提取器 + 分块后处理绑定器
 * - 从 Markdown 文本中提取 HTML 注释中的 RAG_METADATA
 * - 提取 Markdown 标题（#、##、### ...）作为最近的章节标题
 * - 依据分块在原文中的起始位置，绑定“最近前置”的标题与注释元数据
 * - 返回统一的写入项形态，确保不同分块器（custom/llama）行为一致
 */

export type RagLocale = 'en' | 'zh'

export interface AnnotationMeta {
  lang?: RagLocale
  category?: string
}

export interface BinderOptions {
  defaultLang: RagLocale
  defaultCategory?: string
  titleFallback: string
  source: string
  hasCliLangOverride?: boolean
  hasCliCategoryOverride?: boolean
}

export interface BoundItem {
  title: string
  content: string
  lang: RagLocale
  category?: string
  source: string
}

interface AnnotationPoint {
  index: number
  meta: AnnotationMeta
}

interface HeadingPoint {
  index: number
  title: string
  level: number
}

/**
 * 提取所有 RAG_METADATA 注释点及其 JSON 内容
 */
export function extractAnnotationPoints(mdText: string): AnnotationPoint[] {
  const points: AnnotationPoint[] = []
  const re = /<!--\s*RAG_METADATA\s*:\s*(\{[\s\S]*?\})\s*-->/g
  let m: RegExpExecArray | null
  while ((m = re.exec(mdText)) !== null) {
    try {
      const json = JSON.parse(m[1]!) as AnnotationMeta
      const meta: AnnotationMeta = {}
      if (typeof json.lang === 'string') meta.lang = json.lang as RagLocale
      if (typeof json.category === 'string') meta.category = json.category
      points.push({ index: m.index, meta })
    } catch {
      // ignore malformed metadata
    }
  }
  return points
}

/**
 * 提取所有 Markdown 标题（用于章节归属）
 */
export function extractHeadingPoints(mdText: string): HeadingPoint[] {
  const points: HeadingPoint[] = []
  const re = /^(#{1,6})\s+(.*)$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(mdText)) !== null) {
    const level = m[1]!.length
    const title = m[2]!.trim()
    points.push({ index: m.index, title, level })
  }
  return points
}

/**
 * 计算每个分块在原文中的起始位置（顺序扫描，假设分块按原文顺序）
 */
export function computeChunkOffsets(mdText: string, chunks: string[]): Array<{ start: number; end: number }> {
  const positions: Array<{ start: number; end: number }> = []
  let cursor = 0
  for (const c of chunks) {
    const idx = mdText.indexOf(c, cursor)
    const start = idx >= 0 ? idx : cursor
    const end = start + c.length
    positions.push({ start, end })
    cursor = end
  }
  return positions
}

/**
 * 将“标题 + 注释元数据”绑定到分块，返回统一的写入形态
 */
export function bindMetadataToChunks(
  mdText: string,
  chunkBodies: string[],
  opts: BinderOptions
): BoundItem[] {
  const ann = extractAnnotationPoints(mdText)
  const heads = extractHeadingPoints(mdText)
  const pos = computeChunkOffsets(mdText, chunkBodies)

  const items: BoundItem[] = []
  for (let i = 0; i < chunkBodies.length; i++) {
    const start = pos[i]?.start ?? 0
    // 最近前置标题
    let title = opts.titleFallback
    for (let j = heads.length - 1; j >= 0; j--) {
      if (heads[j]!.index <= start) {
        title = heads[j]!.title
        break
      }
    }
    // 最近前置注释元数据
    let lang: RagLocale = opts.defaultLang
    let category: string | undefined = opts.defaultCategory
    for (let j = ann.length - 1; j >= 0; j--) {
      if (ann[j]!.index <= start) {
        // 优先级：CLI 覆盖 > 章节注释 > 文件级注释
        if (!opts.hasCliLangOverride && ann[j]!.meta.lang) {
          lang = ann[j]!.meta.lang as RagLocale
        }
        if (!opts.hasCliCategoryOverride && ann[j]!.meta.category) {
          category = ann[j]!.meta.category
        }
        break
      }
    }

    const item: BoundItem = {
      title,
      content: chunkBodies[i]!,
      lang,
      source: opts.source,
    }
    if (typeof category === 'string') {
      item.category = category
    }
    items.push(item)
  }
  return items
}