# CareerShaper 安全架构文档

## 📋 概述

本文档详细描述了CareerShaper项目的完整安全架构，包括认证授权、配额管理、缓存安全、审计日志、并发控制等核心安全机制。

## 🔐 认证与授权架构

### 双重认证机制

项目支持两种认证方式的平滑过渡：

#### 1. Neon Auth（目标认证方式）
```typescript
// lib/auth/neon-middleware.ts
export interface UserContext {
  neonAuthUserId: string
  email?: string
  name?: string
  isAuthenticated: boolean
}
```

#### 2. 临时认证（向后兼容）
```typescript
// lib/auth/user-context.ts
export function getCurrentUserKey(): string {
  // 从sessionStorage获取临时用户标识
  return sessionStorage.getItem('userKey') || generateTempUserKey()
}
```

#### 3. 增强用户上下文
```typescript
// lib/auth/enhanced-user-context.ts
export interface EnhancedUserContext {
  id: string                    // 内部用户ID
  userKey: string              // 用户标识
  email?: string               
  name?: string                
  authProvider: 'neon' | 'temp' // 认证提供者
  isAuthenticated: boolean     
  migrationStatus?: 'pending' | 'completed'
  neonAuthUserId?: string      // Neon Auth用户ID
  tempUserKey?: string         // 临时用户Key
}
```

### 用户数据迁移

```typescript
// lib/auth/migration.ts
export async function migrateUserData(
  tempUserKey: string,
  neonAuthUserId: string,
  migrationId: string,
  reqId: string
): Promise<MigrationResult> {
  return prisma.$transaction(async (tx) => {
    // 1. 更新用户记录
    await tx.user.update({
      where: { clerkUserId: tempUserKey },
      data: { clerkUserId: neonAuthUserId }
    })

    // 2. 更新相关数据
    await tx.idempotencyKey.updateMany({
      where: { userKey: tempUserKey },
      data: { userKey: neonAuthUserId }
    })

    // 3. 记录迁移日志
    await logInfo({
      reqId,
      route: 'migration',
      userKey: neonAuthUserId,
      phase: 'completed',
      message: `Migration completed: ${tempUserKey} -> ${neonAuthUserId}`
    })
  })
}
```

## 💰 配额管理系统

### 原子性配额操作

防止竞态条件攻击的核心机制：

```typescript
// lib/quota/atomic-operations.ts
export async function atomicQuotaDeduction(
  userId: string, 
  amount: number,
  operation: string = 'service_creation'
): Promise<QuotaOperationResult> {
  // 1. 获取分布式锁
  const lockAcquired = await acquireLock(userId, 'quota-operation', 60)
  if (!lockAcquired) {
    throw new Error('quota_operation_locked')
  }

  try {
    // 2. 原子性数据库事务
    const result = await prisma.$transaction(async (tx) => {
      const quota = await tx.quota.findUnique({ where: { userId } })
      if (!quota) {
        throw new Error('quota_not_found')
      }

      const newUsed = quota.used + amount
      const totalAvailable = quota.initialGrant + quota.purchased

      if (newUsed > totalAvailable) {
        throw new Error('quota_exceeded')
      }

      return await tx.quota.update({
        where: { userId },
        data: { 
          used: Math.max(0, newUsed), // 防止负数
          updatedAt: new Date() 
        }
      })
    })

    // 3. 清除缓存
    await clearQuotaCache(userId)
    
    // 4. 记录审计日志
    await logAudit({
      userId,
      action: 'quota_deduction',
      entityType: 'quota',
      entityId: userId,
      metadata: { amount, operation, newUsed: result.used }
    })

    return { success: true, quota: result }
  } finally {
    await releaseLock(userId, 'quota-operation')
  }
}
```

### 配额预留机制

```typescript
export async function reserveQuota(
  userId: string, 
  amount: number, 
  ttlMs: number = 15 * 60 * 1000
): Promise<string> {
  const reservationId = randomUUID()
  
  const lockAcquired = await acquireLock(userId, 'quota-reservation', 30)
  if (!lockAcquired) {
    throw new Error('quota_reservation_locked')
  }

  try {
    await prisma.$transaction(async (tx) => {
      const quota = await tx.quota.findUnique({ where: { userId } })
      if (!quota) {
        throw new Error('quota_not_found')
      }

      const totalReserved = await tx.quotaReservation.aggregate({
        where: { userId, expiresAt: { gt: new Date() } },
        _sum: { amount: true }
      })

      const currentReserved = totalReserved._sum.amount || 0
      const available = quota.initialGrant + quota.purchased - quota.used - currentReserved

      if (available < amount) {
        throw new Error('insufficient_quota_for_reservation')
      }

      await tx.quotaReservation.create({
        data: {
          id: reservationId,
          userId,
          amount,
          operation: 'service_creation',
          expiresAt: new Date(Date.now() + ttlMs)
        }
      })
    })

    return reservationId
  } finally {
    await releaseLock(userId, 'quota-reservation')
  }
}
```

### 异常使用检测

```typescript
export async function detectQuotaAnomalies(
  userId: string, 
  amount: number
): Promise<AnomalyDetectionResult> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  
  const recentServices = await prisma.service.findMany({
    where: {
      userId,
      createdAt: { gte: oneHourAgo }
    }
  })

  const recentUsage = recentServices.length
  const threshold = 10 // 每小时最多10个服务

  const isAnomalous = recentUsage + amount > threshold

  if (isAnomalous) {
    await logAudit({
      userId,
      action: 'quota_anomaly_detected',
      entityType: 'quota',
      entityId: userId,
      metadata: { 
        recentUsage, 
        requestedAmount: amount, 
        threshold,
        timeWindow: '1h'
      }
    })
  }

  return {
    isAnomalous,
    recentUsage,
    threshold,
    recommendation: isAnomalous ? 'rate_limit' : 'allow'
  }
}
```

## 🔒 缓存安全机制

### 安全缓存数据结构

```typescript
// lib/cache/validation.ts
export interface CacheData {
  data: any
  metadata: {
    version: string
    timestamp: number
    ttl: number
    checksum: string
    source: string
  }
  signature: string
}
```

### 缓存数据验证

```typescript
export function validateCacheData(
  cacheData: CacheData,
  config: ValidationConfig = DEFAULT_VALIDATION_CONFIG
): ValidationResult {
  // 1. 结构验证
  if (!cacheData.data || !cacheData.metadata || !cacheData.signature) {
    return { isValid: false, error: 'invalid_structure' }
  }

  // 2. 时间戳验证
  const now = Date.now()
  if (now - cacheData.metadata.timestamp > cacheData.metadata.ttl) {
    return { isValid: false, error: 'expired' }
  }

  // 3. 校验和验证
  const expectedChecksum = generateChecksum(cacheData.data)
  if (cacheData.metadata.checksum !== expectedChecksum) {
    return { isValid: false, error: 'checksum_mismatch' }
  }

  // 4. 签名验证
  const expectedSignature = generateSignature(
    cacheData.data, 
    cacheData.metadata, 
    config.secretKey
  )
  if (cacheData.signature !== expectedSignature) {
    return { isValid: false, error: 'signature_invalid' }
  }

  return { isValid: true }
}
```

### 安全缓存操作

```typescript
// lib/dal.ts
async function getCached<T>(
  key: string, 
  ttlSec: number, 
  fetcher: () => Promise<T>
): Promise<T> {
  try {
    // 1. 尝试从缓存获取
    const cached = await upstashGet(key)
    if (cached) {
      const cacheData = JSON.parse(cached) as CacheData
      
      // 2. 验证缓存数据
      const validation = validateCacheData(cacheData)
      if (validation.isValid) {
        return cacheData.data as T
      } else {
        // 缓存数据无效，清除并记录
        await clearCache(key)
        await logError({
          reqId: 'cache-validation',
          route: 'cache',
          userKey: 'system',
          phase: 'validation',
          error: `Cache validation failed: ${validation.error}`
        })
      }
    }
  } catch (error) {
    // 缓存读取失败，继续从数据库获取
  }

  // 3. 从数据库获取并缓存
  const data = await fetcher()
  
  if (data) {
    const secureData = createSecureCacheData(data, undefined, {
      ttl: ttlSec * 1000,
      source: 'database'
    })
    
    await upstashSet(key, JSON.stringify(secureData), ttlSec)
  }

  return data
}
```

## 📊 审计日志系统

### 审计日志结构

```typescript
// lib/security/audit.ts
export interface AuditLogEntry {
  id: string
  userId: string
  userKey: string
  action: string
  entityType: string
  entityId: string
  timestamp: Date
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  success: boolean
  errorMessage?: string
}
```

### 关键操作审计

```typescript
export async function logAudit(data: {
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Prisma.InputJsonValue
  ipAddress?: string
  userAgent?: string
  success?: boolean
  errorMessage?: string
}) {
  try {
    await prisma.auditLog.create({
      data: {
        id: randomUUID(),
        userId: data.userId,
        userKey: data.userId, // 在当前架构中userKey等于userId
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success ?? true,
        errorMessage: data.errorMessage,
        timestamp: new Date()
      }
    })
  } catch (error) {
    // 审计日志失败不应该影响主业务流程
    console.error('Failed to create audit log:', error)
  }
}
```

### 审计事件类型

| 事件类型 | 描述 | 关键字段 |
|---------|------|---------|
| `user_login` | 用户登录 | `authProvider`, `ipAddress` |
| `user_migration` | 用户迁移 | `fromUserKey`, `toUserKey` |
| `quota_deduction` | 配额扣费 | `amount`, `operation` |
| `quota_anomaly_detected` | 异常使用检测 | `recentUsage`, `threshold` |
| `service_creation` | 服务创建 | `serviceId`, `resumeId`, `jobId` |
| `cache_validation_failed` | 缓存验证失败 | `cacheKey`, `error` |
| `rate_limit_exceeded` | 频率限制触发 | `action`, `limit` |

## 🚦 并发控制机制

### 分布式锁实现

```typescript
// lib/concurrencyLock.ts
export async function acquireLock(
  userKey: string, 
  taskKind: string, 
  timeoutSec: number = 30
): Promise<boolean> {
  const lockKey = `lock:${userKey}:${taskKind}`
  const lockValue = randomUUID()
  const expirationMs = timeoutSec * 1000

  try {
    if (isProdRedisReady()) {
      // Redis分布式锁
      const result = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${lockKey}/${lockValue}/px/${expirationMs}/nx`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
      })
      return result.ok
    } else {
      // 内存锁（开发环境）
      if (memoryLocks.has(lockKey)) {
        return false
      }
      memoryLocks.set(lockKey, { value: lockValue, expiresAt: Date.now() + expirationMs })
      return true
    }
  } catch (error) {
    return false
  }
}
```

### 锁使用模式

```typescript
// 配额操作锁
await acquireLock(userId, 'quota-operation', 60)

// 服务创建锁
await acquireLock(userKey, 'service-creation', 30)

// 缓存更新锁
await acquireLock(`cache:${cacheKey}`, 'cache-update', 10)
```

## 🛡️ 安全中间件

### 请求验证中间件

```typescript
// lib/security/middleware.ts
export async function securityMiddleware(
  request: NextRequest,
  context: SecurityContext
): Promise<NextResponse | null> {
  // 1. 速率限制检查
  const rateLimitResult = await checkRateLimit(
    generateRateLimitKey(context.userKey, context.route),
    SECURITY_CONFIG.rateLimits[context.route] || SECURITY_CONFIG.rateLimits.default
  )

  if (!rateLimitResult.allowed) {
    await createSecurityAuditLog({
      userKey: context.userKey,
      action: 'rate_limit_exceeded',
      resource: context.route,
      success: false,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      details: { limit: rateLimitResult.limit, remaining: rateLimitResult.remaining }
    })

    return NextResponse.json(
      { error: 'rate_limited', message: 'Too many requests' },
      { status: 429 }
    )
  }

  // 2. 请求大小限制
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength) > SECURITY_CONFIG.maxRequestSize) {
    return NextResponse.json(
      { error: 'request_too_large', message: 'Request size exceeds limit' },
      { status: 413 }
    )
  }

  // 3. 内容类型验证
  const contentType = request.headers.get('content-type')
  if (contentType && !SECURITY_CONFIG.allowedContentTypes.includes(contentType.split(';')[0])) {
    return NextResponse.json(
      { error: 'invalid_content_type', message: 'Content type not allowed' },
      { status: 415 }
    )
  }

  return null // 继续处理请求
}
```

## 🔍 幂等性控制

### 幂等性键管理

```typescript
// lib/idempotency.ts
export async function checkIdempotency(params: {
  userKey: string
  step: IdempotencyStep
  ttlMs: number
  requestBody: any
}): Promise<IdempotencyResult> {
  const key = generateIdempotencyKey(params.userKey, params.step, params.requestBody)
  
  const existing = await getIdempotencyKey(key)
  if (existing) {
    return {
      shouldProcess: false,
      existingResult: existing.result,
      message: 'Request already processed'
    }
  }

  await createIdempotencyKey(key, params.userKey, params.step, params.ttlMs)
  
  return {
    shouldProcess: true,
    key
  }
}
```

## 📈 监控与告警

### 安全指标监控

```typescript
// 关键安全指标
export interface SecurityMetrics {
  quotaAnomalies: number          // 配额异常次数
  rateLimitHits: number           // 频率限制触发次数
  cacheValidationFailures: number // 缓存验证失败次数
  concurrentLockFailures: number  // 并发锁获取失败次数
  authenticationFailures: number  // 认证失败次数
  migrationErrors: number         // 迁移错误次数
}
```

### 告警规则

| 指标 | 阈值 | 时间窗口 | 告警级别 |
|------|------|---------|---------|
| 配额异常 | > 10次 | 1小时 | High |
| 频率限制 | > 100次 | 5分钟 | Medium |
| 缓存验证失败 | > 50次 | 10分钟 | High |
| 认证失败 | > 20次 | 5分钟 | Medium |

## 🧪 安全测试

### 攻击模拟测试

```typescript
// tests/security/quota-security.test.ts
describe('Quota Security Tests', () => {
  it('should prevent concurrent quota deduction attacks', async () => {
    const userKey = 'test-user'
    const promises = Array(10).fill().map(() => 
      createServiceAction({
        userKey,
        resumeId: 'test-resume',
        jobId: 'test-job',
        lang: 'en'
      })
    )
    
    const results = await Promise.allSettled(promises)
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length
    
    // 应该只有1个成功（假设用户只有1个quota）
    expect(successCount).toBe(1)
  })
})
```

## 📋 安全检查清单

### 部署前检查

- [ ] 所有敏感配置使用环境变量
- [ ] 数据库连接使用SSL
- [ ] Redis连接使用TLS
- [ ] API密钥正确配置
- [ ] 速率限制规则已设置
- [ ] 审计日志正常工作
- [ ] 缓存验证机制启用
- [ ] 并发锁机制测试通过
- [ ] 配额系统防护测试通过

### 运行时监控

- [ ] 异常配额使用监控
- [ ] 频率限制触发监控
- [ ] 缓存验证失败监控
- [ ] 认证失败监控
- [ ] 系统性能指标监控

## 🔄 安全更新流程

1. **漏洞发现** → 立即评估影响范围
2. **紧急修复** → 部署热修复补丁
3. **全面测试** → 验证修复效果
4. **文档更新** → 更新安全文档
5. **团队通知** → 通知相关人员

## 📚 相关文档

- [缓存安全性深度审查报告](./cache-security-audit.md)
- [Neon Auth集成计划](./neon-auth-integration-plan.md)
- [API安全规范](./api-security-guidelines.md)
- [数据隐私保护政策](./data-privacy-policy.md)

---

**文档版本**: v1.0  
**最后更新**: 2024-12-10  
**维护者**: CareerShaper Security Team