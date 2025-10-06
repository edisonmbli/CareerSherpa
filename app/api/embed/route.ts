import { NextRequest } from 'next/server'
import { z } from 'zod'
import { assertConfig } from '@/lib/config'
import { embedTexts } from '@/lib/openai'

export const runtime = 'nodejs'

const BodySchema = z.object({
  texts: z.array(z.string().min(1)).min(1),
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
    const vectors = await embedTexts(parsed.data.texts)
    return new Response(JSON.stringify({ vectors }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        error: 'internal_error',
        message: String(e?.message || e),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
