# CareerShaper 认证标准文档

## 概述

本文档定义了 CareerShaper 项目中 API 端点和 Server Actions 的统一认证标准，确保安全性、一致性和可维护性。

## 认证架构

### 核心组件

1. **Stack Auth**: 主要认证提供商
2. **Neon PostgreSQL**: 用户数据存储
3. **认证包装器**: 统一的认证逻辑封装
4. **中间件**: 全局认证检查

### 用户标识符

- **Stack User ID**: Stack Auth 提供的用户唯一标识符（UUID格式）
- **Database User ID**: 数据库中的用户ID，与 Stack User ID 相同
- **User Key**: 在某些上下文中用于日志记录的用户标识符

## API 端点认证标准

### 1. 使用 `withApiAuth` 包装器

**适用场景**: 所有需要认证的 API 端点

**实现方式**:
```typescript
// app/api/example/route.ts
import { withApiAuth } from '@/lib/api/auth-wrapper'

export const POST = withApiAuth(async (request, { user }) => {
  // user.id 是有效的 UUID 格式的用户ID
  // user.email 是用户邮箱
  
  // 业务逻辑
  return NextResponse.json({ success: true })
})
```

**特点**:
- 自动验证 Stack Auth 用户身份
- 自动调用 `createOrUpdateUser` 确保用户在本地数据库中存在
- 提供标准化的用户对象 `{ id: string, email?: string }`
- 统一的错误处理和日志记录

### 2. 已迁移的端点

✅ **已使用 `withApiAuth`**:
- `/api/service/create`
- `/api/upload/resume`
- `/api/upload/detailed-resume`
- `/api/upload/jd`

### 3. 待迁移的端点（M2阶段）

⏳ **使用 `requireValidUserKey`**:
- `/api/run`
- `/api/rag/query`
- `/api/rag/documents`

**迁移计划**: 在 M2 阶段将这些端点重构为使用 `withApiAuth`

## Server Actions 认证标准

### 1. 使用 `withAuth` 和 `withReadAuth` 包装器

**适用场景**: 所有需要认证的 Server Actions

**实现方式**:
```typescript
// lib/actions/example.ts
import { withAuth, withReadAuth } from './auth-wrapper'

// 写操作
export const createExample = withAuth(
  'create-example',
  async (user, data: ExampleData): Promise<ActionResult> => {
    // user.id 是有效的 UUID 格式的用户ID
    // 业务逻辑
    return { success: true, data: result }
  }
)

// 读操作
export const getExample = withReadAuth(
  'get-example',
  async (user, id: string): Promise<ActionResult> => {
    // 业务逻辑
    return { success: true, data: result }
  }
)
```

**特点**:
- 使用 Stack Auth 进行用户验证
- 自动处理用户数据同步
- 提供统一的错误处理和日志记录
- 区分读写操作的不同权限级别

### 2. 已迁移的 Actions

✅ **已使用认证包装器**:
- `lib/actions/service.ts`: 使用 `withAuth` 和 `withReadAuth`
- `lib/actions/upload.ts`: 使用 `withAuth`

## 认证流程

### API 端点认证流程

1. **中间件检查**: 验证用户是否已登录
2. **请求头设置**: 中间件在请求头中设置 `x-user-key`
3. **包装器验证**: `withApiAuth` 验证用户身份
4. **用户同步**: 调用 `createOrUpdateUser` 确保用户在本地数据库中存在
5. **业务逻辑**: 执行实际的业务逻辑

### Server Actions 认证流程

1. **Stack Auth 验证**: 直接使用 `stackServerApp.getUser()`
2. **用户同步**: 调用 `createOrUpdateUser` 确保用户在本地数据库中存在
3. **业务逻辑**: 执行实际的业务逻辑

## 错误处理标准

### API 端点错误

```typescript
// 401 Unauthorized
{
  "error": "unauthorized",
  "message": "Authentication required"
}

// 500 Internal Server Error
{
  "error": "internal_error"
}
```

### Server Actions 错误

```typescript
// ActionResult 格式
{
  success: false,
  error: "unauthorized" | "internal_error" | "validation_error",
  message: "具体错误信息"
}
```

## 测试标准

### 测试用户格式

**正确格式**: 使用有效的UUID格式
```javascript
const TEST_USER_KEY = '550e8400-e29b-41d4-a716-446655440000'
```

**错误格式**: 避免使用非UUID格式
```javascript
// ❌ 错误
const TEST_USER_KEY = 'test-user-key-123'
```

### 测试请求头

```javascript
headers: {
  'Content-Type': 'application/json',
  'x-user-key': TEST_USER_KEY,
}
```

## 数据库约束

### 用户ID格式

- **NeonUserSync.id**: String 类型，存储 Stack Auth 用户ID（UUID格式）
- **Service.userId**: String 类型，外键关联到 NeonUserSync.id
- **其他表的userId字段**: 同样关联到 NeonUserSync.id

### 数据一致性

- 所有 `userId` 字段必须是有效的 UUID 格式
- 必须在 `neon_auth.users_sync` 表中存在对应记录
- 使用 `createOrUpdateUser` 确保用户记录存在

## 迁移指南

### 从 `requireValidUserKey` 迁移到 `withApiAuth`

1. **替换导入**:
```typescript
// 旧方式
import { requireValidUserKey } from '@/lib/api/auth'

// 新方式
import { withApiAuth } from '@/lib/api/auth-wrapper'
```

2. **重构处理函数**:
```typescript
// 旧方式
export async function POST(request: Request) {
  const userKey = await requireValidUserKey(request)
  // 业务逻辑
}

// 新方式
export const POST = withApiAuth(async (request, { user }) => {
  // 业务逻辑，使用 user.id 而不是 userKey
})
```

### 从手动认证迁移到认证包装器

1. **Server Actions**:
```typescript
// 旧方式
export async function createExample(data: ExampleData) {
  const user = await stackServerApp.getUser()
  if (!user) throw new Error('Unauthorized')
  // 业务逻辑
}

// 新方式
export const createExample = withAuth(
  'create-example',
  async (user, data: ExampleData) => {
    // 业务逻辑
  }
)
```

## 安全最佳实践

1. **始终验证用户身份**: 所有需要认证的端点和 Actions 都必须使用认证包装器
2. **使用正确的用户ID**: 确保使用 UUID 格式的用户ID
3. **统一错误处理**: 使用标准化的错误响应格式
4. **日志记录**: 记录认证相关的操作和错误
5. **权限检查**: 确保用户只能访问自己的资源

## 监控和调试

### 日志格式

```typescript
// 成功认证
{
  "level": "info",
  "ts": "2025-10-12T02:40:13.100Z",
  "reqId": "6db531f1-5d1a-41f3-9ff3-54311c144c8b",
  "route": "/api/service/create",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "phase": "init"
}

// 认证失败
{
  "level": "error",
  "ts": "2025-10-12T02:40:14.419Z",
  "reqId": "6db531f1-5d1a-41f3-9ff3-54311c144c8b",
  "route": "/api/service/create",
  "userKey": "anonymous",
  "error": "Authentication required"
}
```

### 常见问题排查

1. **UUID 格式错误**: 确保用户ID是有效的UUID格式
2. **用户不存在**: 检查 `neon_auth.users_sync` 表中是否有对应记录
3. **认证失败**: 验证 Stack Auth 配置和用户登录状态
4. **权限不足**: 确认用户有权限访问请求的资源

## 版本历史

- **v1.0** (2025-10-12): 初始版本，定义基础认证标准
- **v1.1** (计划): M2 阶段迁移剩余端点

---

**注意**: 本文档将随着项目发展持续更新，请确保使用最新版本的认证标准。