import { prisma } from '@/lib/prisma'
import { withPrismaGuard } from '@/lib/guard/prismaGuard'
import { Prisma, CoinTxnType, CoinTxnStatus } from '@prisma/client'

export interface RecordDebitParams {
  userId: string
  amount: number
  serviceId?: string
  taskId?: string
  templateId?: string
  messageId?: string
  idemKey?: string
  metadata?: Prisma.InputJsonValue
}

export async function recordDebit(
  params: RecordDebitParams,
  tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<
  | { ok: true; id: string; balanceAfter: number; existed?: boolean }
  | { ok: false; error: 'InsufficientQuota' }
> {
  const { userId, amount, serviceId, taskId, templateId, messageId, idemKey, metadata } = params
  if (amount <= 0) return { ok: true, id: '', balanceAfter: 0 }
  if (idemKey) {
    const existing = await prisma.coinTransaction.findUnique({ where: { idemKey } })
    if (existing) {
      return { ok: true, id: existing.id, balanceAfter: existing.balanceAfter, existed: true }
    }
  }
  if (tx !== prisma) {
    const res = await tx.quota.updateMany({
      where: { userId, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    })
    if (res.count === 0) return { ok: false, error: 'InsufficientQuota' }
    const q = await tx.quota.findUnique({ where: { userId } })
    const created = await tx.coinTransaction.create({
      data: {
        userId,
        type: 'SERVICE_DEBIT' as CoinTxnType,
        status: 'PENDING' as CoinTxnStatus,
        delta: -amount,
        balanceAfter: q?.balance ?? 0,
        ...(serviceId ? { serviceId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(templateId ? { templateId } : {}),
        ...(messageId ? { messageId } : {}),
        ...(idemKey ? { idemKey } : {}),
        ...(metadata ? { metadata } : {}),
      },
    })
    return { ok: true, id: created.id, balanceAfter: q?.balance ?? 0 }
  }
  const created = await withPrismaGuard(async (client) => {
    return await client.$transaction(async (trx) => {
      const res = await trx.quota.updateMany({
        where: { userId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      })
      if (res.count === 0) return null
      const q = await trx.quota.findUnique({ where: { userId } })
      const ct = await trx.coinTransaction.create({
        data: {
          userId,
          type: 'SERVICE_DEBIT' as CoinTxnType,
          status: 'PENDING' as CoinTxnStatus,
          delta: -amount,
          balanceAfter: q?.balance ?? 0,
          ...(serviceId ? { serviceId } : {}),
          ...(taskId ? { taskId } : {}),
          ...(templateId ? { templateId } : {}),
          ...(messageId ? { messageId } : {}),
          ...(idemKey ? { idemKey } : {}),
          ...(metadata ? { metadata } : {}),
        },
      })
      return { id: ct.id, balanceAfter: q?.balance ?? 0 }
    })
  }, { attempts: 3, prewarm: true })
  if (!created) return { ok: false, error: 'InsufficientQuota' }
  return { ok: true, id: created.id, balanceAfter: created.balanceAfter }
}

export async function markDebitSuccess(
  debitId: string,
  usageLogId?: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  if (!debitId) return false
  const data: any = { status: 'SUCCESS' as CoinTxnStatus }
  if (usageLogId) data.taskId = usageLogId
  if (tx !== prisma) {
    await tx.coinTransaction.update({ where: { id: debitId }, data })
    return true
  }
  await withPrismaGuard(async (client) => {
    await client.coinTransaction.update({ where: { id: debitId }, data })
  }, { attempts: 3, prewarm: false })
  return true
}

export interface RecordRefundParams {
  userId: string
  amount: number
  relatedId: string
  serviceId?: string
  taskId?: string
  templateId?: string
  messageId?: string
  metadata?: Prisma.InputJsonValue
}

export async function recordRefund(
  params: RecordRefundParams,
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  const { userId, amount, relatedId, serviceId, taskId, templateId, messageId, metadata } = params
  if (amount <= 0) return null
  if (tx !== prisma) {
    const q = await tx.quota.update({ where: { userId }, data: { balance: { increment: amount } } })
    return await tx.coinTransaction.create({
      data: {
        userId,
        type: 'FAILURE_REFUND' as CoinTxnType,
        status: 'REFUNDED' as CoinTxnStatus,
        delta: amount,
        balanceAfter: q.balance,
        relatedId,
        ...(serviceId ? { serviceId } : {}),
        ...(taskId ? { taskId } : {}),
        ...(templateId ? { templateId } : {}),
        ...(messageId ? { messageId } : {}),
        ...(metadata ? { metadata } : {}),
      },
    })
  }
  return await withPrismaGuard(async (client) => {
    return await client.$transaction(async (trx) => {
      const q = await trx.quota.update({ where: { userId }, data: { balance: { increment: amount } } })
      return await trx.coinTransaction.create({
        data: {
          userId,
          type: 'FAILURE_REFUND' as CoinTxnType,
          status: 'REFUNDED' as CoinTxnStatus,
          delta: amount,
          balanceAfter: q.balance,
          relatedId,
          ...(serviceId ? { serviceId } : {}),
          ...(taskId ? { taskId } : {}),
          ...(templateId ? { templateId } : {}),
          ...(messageId ? { messageId } : {}),
          ...(metadata ? { metadata } : {}),
        },
      })
    })
  }, { attempts: 3, prewarm: true })
}

export async function listLedgerByUser(
  userId: string,
  page: number = 1,
  pageSize: number = 10,
  filters?: {
    type?: CoinTxnType | undefined
    status?: CoinTxnStatus | undefined
    templateId?: string | undefined
    serviceId?: string | undefined
    after?: Date | undefined
    before?: Date | undefined
  }
) {
  const skip = Math.max(0, (page - 1) * pageSize)
  return await withPrismaGuard(async (client) => {
    const args: any[] = [userId]
    let whereSql = 'ct.user_id = $1'
    if (filters?.type) { args.push(filters.type); whereSql += ` AND ct.type = $${args.length}` }
    if (filters?.status === 'SUCCESS') { whereSql += ` AND ct.type = 'SERVICE_DEBIT' AND lul.is_success = true` }
    if (filters?.status === 'FAILED') { whereSql += ` AND ct.type = 'SERVICE_DEBIT' AND lul.is_success = false` }
    if (filters?.status === 'PENDING') { whereSql += ` AND ct.type = 'SERVICE_DEBIT' AND ct.status = 'PENDING' AND lul.id IS NULL` }
    if (filters?.status === 'REFUNDED') { whereSql += ` AND ct.type = 'FAILURE_REFUND'` }
    if (filters?.templateId) { args.push(filters.templateId); whereSql += ` AND ct.template_id = $${args.length}` }
    if (filters?.serviceId) { args.push(filters.serviceId); whereSql += ` AND ct.service_id = $${args.length}` }
    if (filters?.after) { args.push(filters.after); whereSql += ` AND ct.created_at >= $${args.length}` }
    if (filters?.before) { args.push(filters.before); whereSql += ` AND ct.created_at <= $${args.length}` }
    const items: any[] = await client.$queryRawUnsafe(
      `SELECT ct.id, ct.type, ct.status, ct.delta,
              ct.balance_after AS "balanceAfter",
              ct.service_id AS "serviceId",
              ct.task_id AS "taskId",
              ct.template_id AS "templateId",
              ct.message_id AS "messageId",
              ct.created_at AS "createdAt",
              ct.related_id AS "relatedId",
              lul.is_success AS "usageSuccess"
       FROM coin_transactions ct
       LEFT JOIN llm_usage_logs lul ON lul.id = ct.task_id
       WHERE ${whereSql}
       ORDER BY ct.created_at DESC
       LIMIT ${pageSize} OFFSET ${skip}`,
      ...args
    )
    const totalRows: Array<{ count: bigint }> = await client.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS count
       FROM coin_transactions ct
       LEFT JOIN llm_usage_logs lul ON lul.id = ct.task_id
       WHERE ${whereSql}`,
      ...args
    )
    const total = Number(totalRows?.[0]?.count ?? 0)
    return { items, total }
  }, { attempts: 3, prewarm: false })
}