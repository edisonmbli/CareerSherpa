import { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertConfig, config } from '@/lib/config'
import { getAdminSupabase } from '@/lib/supabase'
import { embedTexts } from '@/lib/openai'

export const runtime = 'nodejs'

const BodySchema = z.object({
  title: z.string().min(1),
  domain: z.string().min(1), // e.g. 'frontend'
  lang: z.enum(['zh', 'en']),
  source: z.string().optional(),
  content: z.string().min(1),
  chunkSize: z.number().int().positive().optional(),
  chunkOverlap: z.number().int().nonnegative().optional(),
})

function chunkText(text: string, size: number, overlap: number): string[] {
  const paragraphs = text.split(/\n{2,}/g)
  const merged = paragraphs.join('\n\n').trim()
  const chunks: string[] = []
  let i = 0
  while (i < merged.length) {
    const end = Math.min(merged.length, i + size)
    const slice = merged.slice(i, end)
    chunks.push(slice)
    if (end === merged.length) break
    i = end - overlap
    if (i < 0) i = 0
  }
  return chunks
}

export async function POST(req: NextRequest) {
  try {
    assertConfig()
    // TODO: add admin auth guard in production (e.g., Supabase Auth/RLS)
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { title, domain, lang, source, content } = parsed.data
    const size = parsed.data.chunkSize ?? config.rag.chunkSize
    const overlap = parsed.data.chunkOverlap ?? config.rag.chunkOverlap

    const chunks = chunkText(content, size, overlap)
    const vectors = await embedTexts(chunks)

    const supa = getAdminSupabase()

    const { data: doc, error: docErr } = await supa
      .from('rag_documents')
      .insert([{ title, domain, lang, source, content }])
      .select()
      .single()
    if (docErr) {
      return new Response(
        JSON.stringify({ error: 'db_error', detail: docErr.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const rows = chunks.map((text, idx) => ({
      doc_id: doc.id,
      chunk_index: idx,
      text,
      embedding: vectors[idx],
      meta: {},
    }))

    const { error: chErr, count } = await supa
      .from('rag_doc_chunks')
      .insert(rows, { count: 'exact' })
    if (chErr) {
      return new Response(
        JSON.stringify({ error: 'db_error', detail: chErr.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({ doc_id: doc.id, chunks: count ?? rows.length }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: String(e?.message || e),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
