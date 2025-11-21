import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const start = Date.now()
  try {
    await prisma.$connect()
    const rows = await prisma.$queryRaw<any[]>`SELECT 1 as ok`
    const latencyMs = Date.now() - start
    return NextResponse.json({ ok: true, latencyMs, result: rows?.[0]?.ok ?? null })
  } catch (error) {
    const latencyMs = Date.now() - start
    return NextResponse.json(
      { ok: false, latencyMs, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}