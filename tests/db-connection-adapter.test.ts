import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/prisma'

describe('Prisma Neon Adapter Connection', () => {
  it('connects and executes a simple query', async () => {
    await prisma.$connect()
    const rows = await prisma.$queryRaw<any[]>`SELECT 1 as ok`
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].ok).toBe(1)
    await prisma.$disconnect()
  })
})