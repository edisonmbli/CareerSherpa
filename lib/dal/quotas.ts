import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// 初始赠送金币（可通过环境变量配置，默认 8）
const INITIAL_FREE_QUOTA = parseInt((process.env['INITIAL_FREE_QUOTA'] ?? '8'), 10)

/**
 * 获取或创建用户的金币账户（延迟初始化）
 */
export async function getOrCreateQuota(userId: string) {
  const existing = await prisma.quota.findUnique({ where: { userId } })
  if (existing) return existing

  try {
    return await prisma.quota.create({
      data: { userId, balance: INITIAL_FREE_QUOTA },
    })
  } catch (error) {
    // 并发创建时处理唯一键冲突
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return await prisma.quota.findUniqueOrThrow({ where: { userId } })
    }
    throw error
  }
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

  const result = await tx.quota.updateMany({
    where: { userId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  })

  if (result.count === 0) {
    return { success: false, error: 'InsufficientQuota' }
  }
  return { success: true }
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
  return await tx.quota.update({
    where: { userId },
    data: { balance: { increment: amount } },
  })
}

/**
 * 检查余额是否足够；不存在则懒初始化
 */
export async function checkBalance(userId: string, amount: number) {
  const quota = await getOrCreateQuota(userId)
  return quota.balance >= amount
}