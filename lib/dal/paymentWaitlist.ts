import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { prisma } from '@/lib/prisma'

export async function joinPaymentWaitlist(userId: string, email: string) {
  if (!userId || !email) return null
  const created = await withPrismaGuard(async (client) => {
    return await client.paymentWaitlist.upsert({
      where: { userId },
      update: { email },
      create: { userId, email },
    })
  }, { attempts: 3, prewarm: false })
  return created
}