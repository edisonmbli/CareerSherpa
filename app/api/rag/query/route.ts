import { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertConfig, config } from '@/lib/config'
import { getAdminSupabase } from '@/lib/supabase'
import { embedTexts } from '@/lib/openai'

export const runtime = 'nodejs'

const BodySchema = z.object({
  query: z.string().min(1),
  domain: z.string().optional(),
  lang: z.enum(['zh', 'en']).optional(),
  topK: z.number().int().positive().max(50).optional(),
  minScore: z.number().min(0).max(1).optional(),
})

export async function POST(req: NextRequest) {
  try {
    assertConfig()
    const json = await req.json()
    const parsed = BodySchema.safeParse(json)
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'invalid_body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const { query, domain, lang } = parsed.data
    const topK = parsed.data.topK ?? config.rag.topK
    const minScore = parsed.data.minScore ?? config.rag.minScore

    const [qvec] = await embedTexts([query])
    const supa = getAdminSupabase()

    const { data, error } = await supa.rpc('rag_match_chunks', {
      query_embedding: qvec,
      match_count: topK,
      domain_filter: domain ?? null,
      lang_filter: lang ?? null,
      min_score: minScore,
    })
    if (error) {
      return new Response(
        JSON.stringify({ error: 'db_error', detail: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(JSON.stringify({ results: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
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