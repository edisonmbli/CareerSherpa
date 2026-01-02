import { prisma } from '@/lib/prisma'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { Prisma, CoinTxnType, CoinTxnStatus } from '@prisma/client'

// 初始赠送金币（可通过环境变量配置，默认 8）
const INITIAL_FREE_QUOTA = parseInt(
  process.env['INITIAL_FREE_QUOTA'] ?? '8',
  10
)

/**
 * 获取或创建用户的金币账户（延迟初始化）
 */
export async function getOrCreateQuota(userId: string) {
  return await withPrismaGuard(
    async (client) => {
      const existing = await client.quota.findUnique({ where: { userId } })
      if (existing) return existing

      try {
        const created = await client.quota.create({
          data: { userId, balance: INITIAL_FREE_QUOTA },
        })
        await client.coinTransaction.create({
          data: {
            userId,
            type: CoinTxnType.SIGNUP_BONUS,
            status: CoinTxnStatus.SUCCESS,
            delta: INITIAL_FREE_QUOTA,
            balanceAfter: created.balance,
          },
        })
        return created
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return await client.quota.findUniqueOrThrow({ where: { userId } })
        }
        throw error
      }
    },
    { attempts: 3, prewarm: true }
  )
}

/**
 * 原子化扣减金币（需要余额充足）
 * - 默认独立执行；若传入事务 tx，则在外部事务中执行
 */
export async function deductQuota(
  userId: string,
  amount: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<{ success: true } | { success: false; error: 'InsufficientQuota' }> {
  if (amount <= 0) return { success: true }
  // 若外部显式传入事务，则直接使用，不进行守护重试
  if (tx !== prisma) {
    const result = await tx.quota.updateMany({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    })
    if (result.count === 0)
      return { success: false, error: 'InsufficientQuota' }
    return { success: true }
  }

  // 无事务时，走守护重试路径
  return await withPrismaGuard(
    async (client) => {
      const result = await client.quota.updateMany({
        where: { userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (result.count === 0)
        return { success: false, error: 'InsufficientQuota' }
      return { success: true }
    },
    { attempts: 3, prewarm: true }
  )
}

/**
 * 原子化返还/增加金币
 */
export async function addQuota(
  userId: string,
  amount: number,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  if (amount <= 0) return
  if (tx !== prisma) {
    return await tx.quota.update({
      where: { userId },
      data: { balance: { increment: amount } },
    })
  }
  return await withPrismaGuard(
    async (client) => {
      return await client.quota.update({
        where: { userId },
        data: { balance: { increment: amount } },
      })
    },
    { attempts: 3, prewarm: true }
  )
}

/**
 * 检查余额是否足够；不存在则懒初始化
 */
export async function checkBalance(userId: string, amount: number) {
  const quota = await getOrCreateQuota(userId)
  return quota.balance >= amount
}
