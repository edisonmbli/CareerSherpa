# 缓存安全性深度审查报告

## 🚨 严重安全漏洞发现

### 1. **CRITICAL: Quota扣费竞态条件攻击**

**漏洞位置**: `lib/actions/service.ts:createServiceAction()`

**攻击向量**:
```javascript
// 攻击者可以同时发送多个相同请求
const promises = Array(10).fill().map(() => 
  createServiceAction({
    userKey: 'victim',
    resumeId: 'resume1', 
    jobId: 'job1',
    lang: 'en'
  })
);
await Promise.all(promises);
```

**问题分析**:
1. **检查quota和扣费之间存在时间窗口**：
   ```javascript
   // 第60行：检查配额
   const quota = await getUserQuota(user.id)
   if (quota && quota.used >= (quota.initialGrant + quota.purchased)) {
     return { success: false, error: 'quota_exceeded' }
   }
   
   // 第68-76行：创建服务（可能耗时）
   const result = await createServiceWithOrchestration(...)
   
   // 第78-80行：扣费（太晚了！）
   if (quota) {
     await updateUserQuota(user.id, quota.used + 1)
   }
   ```

2. **idempotencyKey未被使用**：虽然接口接收了`idempotencyKey`参数，但在实际逻辑中完全没有使用，无法防止重复请求。

3. **缓存一致性问题**：`getUserQuota`使用1分钟缓存，在高并发下可能读取到过期数据。

**攻击后果**:
- 攻击者可以用1个quota消费多个服务
- 直接导致项目成本损失
- 破坏计费系统的准确性

### 2. **HIGH: 缓存投毒攻击**

**漏洞位置**: `lib/dal.ts:getCached()`

**攻击向量**:
```javascript
// 攻击者可以通过构造特殊的JSON数据污染缓存
const maliciousQuota = {
  used: -999999,  // 负数绕过quota检查
  initialGrant: 999999,
  purchased: 999999
};
```

**问题分析**:
1. **缓存数据未验证**：从Redis/内存缓存读取的数据直接反序列化使用，没有schema验证
2. **缓存键可预测**：`quota:${userId}`格式简单，容易被猜测
3. **缓存TTL过长**：1分钟TTL在高频操作下可能导致数据不一致

### 3. **MEDIUM: 用户身份伪造**

**漏洞位置**: `lib/auth/user-context.ts`

**攻击向量**:
```javascript
// 攻击者可以在浏览器中修改sessionStorage
sessionStorage.setItem('userKey', 'victim_user_id');
// 然后发起请求消费受害者的quota
```

**问题分析**:
1. **客户端控制的身份认证**：`getCurrentUserKey()`依赖`sessionStorage`，完全由客户端控制
2. **无服务端验证**：没有JWT或其他服务端验证机制
3. **会话劫持风险**：攻击者可以轻易冒充其他用户

### 4. **MEDIUM: 并发锁绕过**

**漏洞位置**: `lib/concurrencyLock.ts`

**攻击向量**:
```javascript
// 攻击者可以使用不同的taskKind绕过锁机制
await Promise.all([
  createServiceAction({...params, taskKind: 'service-1'}),
  createServiceAction({...params, taskKind: 'service-2'}),
  // 不同的taskKind不会互相阻塞
]);
```

**问题分析**:
1. **锁粒度不当**：`acquireLock(userKey, taskKind)`按taskKind分别加锁，quota操作应该按用户全局加锁
2. **锁超时过短**：30秒锁定时间可能不足以完成复杂操作
3. **锁失败处理不当**：锁获取失败时抛出异常，但调用方可能忽略异常继续执行

## 🛡️ 安全加固建议

### 立即修复（Critical）

1. **实现原子性quota扣费**:
```javascript
export async function createServiceAction(params: CreateServiceParams) {
  // 使用idempotency防重复
  const idempotencyResult = await checkIdempotency({
    userKey: params.userKey,
    step: 'service_creation',
    ttlMs: 15 * 60 * 1000,
    requestBody: { resumeId: params.resumeId, jobId: params.jobId }
  });
  
  if (!idempotencyResult.shouldProcess) {
    return { success: false, error: 'duplicate_request' };
  }

  // 原子性检查并扣费
  const quotaResult = await atomicQuotaDeduction(user.id, 1);
  if (!quotaResult.success) {
    return { success: false, error: 'quota_exceeded' };
  }

  try {
    const result = await createServiceWithOrchestration(...);
    return createActionSuccess({ service_id: result.service_id });
  } catch (error) {
    // 失败时回滚quota
    await atomicQuotaDeduction(user.id, -1);
    throw error;
  }
}
```

2. **实现原子性quota操作**:
```javascript
export async function atomicQuotaDeduction(userId: string, amount: number) {
  const lockAcquired = await acquireLock(userId, 'quota-operation', 60);
  if (!lockAcquired) {
    throw new Error('quota_operation_locked');
  }

  try {
    // 直接在数据库层面进行原子性检查和更新
    const result = await client.$transaction(async (tx) => {
      const quota = await tx.quota.findUnique({ where: { userId } });
      if (!quota) {
        throw new Error('quota_not_found');
      }

      const newUsed = quota.used + amount;
      const totalAvailable = quota.initialGrant + quota.purchased;
      
      if (newUsed > totalAvailable) {
        throw new Error('quota_exceeded');
      }

      return await tx.quota.update({
        where: { userId },
        data: { used: newUsed, updatedAt: new Date() }
      });
    });

    // 清除缓存
    await clearQuotaCache(userId);
    return { success: true, quota: result };
  } finally {
    await releaseLock(userId, 'quota-operation');
  }
}
```

### 中期加固（High Priority）

3. **实现服务端身份验证**:
```javascript
// 使用JWT或类似机制
export function verifyUserToken(token: string): { userId: string; valid: boolean } {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { userId: decoded.sub, valid: true };
  } catch {
    return { userId: '', valid: false };
  }
}
```

4. **缓存数据验证**:
```javascript
const quotaSchema = z.object({
  id: z.string(),
  userId: z.string(),
  used: z.number().min(0),
  initialGrant: z.number().min(0),
  purchased: z.number().min(0)
});

async function getCachedQuota(userId: string) {
  const cached = await getCached(`quota:${userId}`, 60, () => 
    client.quota.findUnique({ where: { userId } })
  );
  
  // 验证缓存数据
  const validated = quotaSchema.safeParse(cached);
  if (!validated.success) {
    // 缓存数据无效，清除并重新获取
    await clearQuotaCache(userId);
    return client.quota.findUnique({ where: { userId } });
  }
  
  return validated.data;
}
```

### 长期优化（Medium Priority）

5. **实现配额预留机制**:
```javascript
// 在开始处理前预留配额，处理完成后确认使用
export async function reserveQuota(userId: string, amount: number): Promise<string> {
  const reservationId = crypto.randomUUID();
  // 实现配额预留逻辑
  return reservationId;
}

export async function confirmQuotaUsage(reservationId: string): Promise<void> {
  // 确认使用预留的配额
}

export async function releaseQuotaReservation(reservationId: string): Promise<void> {
  // 释放未使用的预留配额
}
```

6. **增强监控和告警**:
```javascript
// 检测异常配额使用模式
export async function detectQuotaAnomalies(userId: string) {
  const recentUsage = await getRecentQuotaUsage(userId, '1h');
  if (recentUsage.count > NORMAL_USAGE_THRESHOLD) {
    await triggerSecurityAlert('quota_anomaly', { userId, usage: recentUsage });
  }
}
```

## 🔍 测试验证

### 攻击模拟测试
```javascript
// 测试并发quota攻击
test('should prevent concurrent quota deduction attacks', async () => {
  const userKey = 'test-user';
  const promises = Array(10).fill().map(() => 
    createServiceAction({
      userKey,
      resumeId: 'test-resume',
      jobId: 'test-job',
      lang: 'en'
    })
  );
  
  const results = await Promise.allSettled(promises);
  const successCount = results.filter(r => 
    r.status === 'fulfilled' && r.value.success
  ).length;
  
  // 应该只有1个成功（假设用户只有1个quota）
  expect(successCount).toBe(1);
});
```

## 📊 风险评估

| 漏洞类型 | 风险等级 | 影响范围 | 修复优先级 |
|---------|---------|---------|-----------|
| Quota竞态条件 | Critical | 直接经济损失 | P0 |
| 缓存投毒 | High | 数据完整性 | P1 |
| 身份伪造 | Medium | 用户隐私 | P1 |
| 并发锁绕过 | Medium | 系统稳定性 | P2 |

## 📋 修复检查清单

- [ ] 实现原子性quota扣费机制
- [ ] 添加idempotency防重复处理
- [ ] 实现服务端身份验证
- [ ] 增强缓存数据验证
- [ ] 优化并发锁粒度
- [ ] 添加异常使用监控
- [ ] 编写安全测试用例
- [ ] 更新安全文档

**预计修复时间**: 2-3个工作日
**建议暂停生产部署**: 直到Critical级别漏洞修复完成