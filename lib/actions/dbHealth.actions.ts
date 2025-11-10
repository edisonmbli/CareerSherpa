"use server"

import { prisma } from '@/lib/prisma'

export async function checkDbHealth(): Promise<{ ok: boolean; latencyMs: number; error?: string }>
{
  const start = Date.now()
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - start }
  } catch (error) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  } finally {
    await prisma.$disconnect()
  }
}