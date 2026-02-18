import '@/lib/prismaEngine'
import { PrismaClient } from '@prisma/client'
// Ensure .env.local is loaded before Prisma reads DATABASE_URL
import '@/lib/env'
import { getPrismaRuntimeUrl } from '@/lib/prismaConnection'
import { PrismaNeon } from '@prisma/adapter-neon'
import { neonConfig } from '@neondatabase/serverless'

// Force Neon to use fetch instead of WebSocket in Node to avoid extra deps
neonConfig.poolQueryViaFetch = true

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

const connectionString = getPrismaRuntimeUrl()
const adapter = new PrismaNeon({ connectionString })

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
    adapter,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// Attempt to establish connection eagerly to avoid first-call cold engine issues
;(async () => {
  try {
    if (typeof (prisma as any).$connect === 'function') {
      await (prisma as any).$connect()
    }
  } catch {}
})()
