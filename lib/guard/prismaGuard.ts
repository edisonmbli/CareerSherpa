import { prisma } from '@/lib/prisma'

export interface PrismaGuardOptions {
  attempts?: number
  prewarm?: boolean
  baseDelayMs?: number
}

export async function prewarmPrisma(): Promise<void> {
  await prisma.$connect()
  await prisma.$queryRaw`SELECT 1`
  await prisma.$disconnect()
}

export async function withPrismaGuard<T>(
  fn: (client: typeof prisma) => Promise<T>,
  options: PrismaGuardOptions = {}
): Promise<T> {
  const attempts = options.attempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 300
  if (options.prewarm) {
    try {
      await prewarmPrisma()
    } catch {}
  }

  let lastError: unknown
  for (let i = 1; i <= attempts; i++) {
    try {
      await prisma.$connect()
      const result = await fn(prisma)
      return result
    } catch (err) {
      lastError = err
      const delay = Math.min(3000, baseDelayMs * Math.pow(2, i - 1))
      await new Promise((r) => setTimeout(r, delay))
    } finally {
      await prisma.$disconnect()
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Prisma operation failed')
}