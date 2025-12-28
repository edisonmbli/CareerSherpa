# CareerShaper M1.1 架构优化实施计划

## 计划概述

基于项目规格文档、执行计划和深入的代码库分析，本文档制定了 M1.1 阶段的详细优化方案和实施计划。重点解决 LLM 调用机制、Prompt Engineering 结构化和 pgvector+LlamaIndex 基础架构问题。

## 当前状况分析

### ✅ 已完成的工作

- **LLM 调用基础架构**: 已实现 LangChain 抽象、worker-pool 管理、免费/付费队列
- **Prompt 模板系统**: 已建立结构化的 prompt 模板和执行器
- **数据库基础**: Neon 集成、基础表结构、DAL 层
- **认证系统**: Neon Auth 集成完成

### 🔧 需要优化的关键问题

#### 1. LLM 调用机制完善

**现状**: 基础架构已存在，但需要完善配额管理和限制机制

- ✅ LangChain 抽象 (`lib/llm/providers.ts`)
- ✅ Worker-pool 管理 (`lib/llm/worker-pool.ts`)
- ✅ 免费/付费队列支持
- ❌ 缺少用户配额检查和限制逻辑
- ❌ 缺少时间窗口内的使用次数限制

#### 2. Prompt Engineering 结构优化

**现状**: 模板系统已建立，但存在结构混乱问题

- ✅ 结构化模板系统 (`lib/prompts/templates.ts`)
- ✅ 统一执行器 (`lib/prompts/executor.ts`)
- ❌ `summarize.ts` 胶水代码仍在使用，与新模板系统并存
- ❌ `detailed_resume` 的"copy 模式"问题未解决

#### 3. pgvector + LlamaIndex 基础架构

**现状**: 完全缺失，需要从零搭建

- ❌ 缺少 LlamaIndex 集成
- ❌ 缺少向量字段定义
- ❌ 缺少嵌入模型集成

## M1.1 实施策略

### 核心原则

1. **聚焦 M1.1 交付物**: 专注于里程碑要求，避免过度工程化
2. **渐进式重构**: 保持现有功能正常运行的前提下逐步优化
3. **实用主义**: 优先解决影响业务逻辑的核心问题
4. **测试验证**: 每个改动都要有明确的验收标准

### 实施阶段划分

- **阶段 1**: LLM 调用机制完善 (4-6 小时)
- **阶段 2**: Prompt Engineering 清理 (3-4 小时)
- **阶段 3**: pgvector+LlamaIndex 基础搭建 (4-6 小时)
- **阶段 4**: 集成测试和验证 (2-3 小时)

## 阶段 1: LLM 调用机制完善 (优先级: 🚨 高)

### 1.1 实现用户配额管理系统

**预估时间**: 3-4 小时  
**复杂度**: 中等  
**风险**: 低

#### 问题分析:

当前 worker-pool 支持免费/付费队列，但缺少用户级别的配额检查和使用限制。需要实现：

- 无配额用户的时间窗口限制 (7 天内 ≤3 次)
- 有配额用户的配额扣减逻辑
- 配额不足时的友好提示

#### 任务清单:

- [ ] 创建 `lib/quota/manager.ts` - 配额管理核心逻辑
- [ ] 扩展 `lib/dal/user.ts` - 添加配额查询和更新方法
- [ ] 在 `lib/llm/worker-pool.ts` 中集成配额检查
- [ ] 创建配额相关的 Server Actions
- [ ] 添加配额不足的错误处理

#### 实施步骤:

```typescript
// lib/quota/manager.ts
export interface QuotaCheck {
  canExecute: boolean
  remainingQuota?: number
  resetTime?: Date
  reason?: string
}

export class QuotaManager {
  async checkQuota(userId: string, tier: 'free' | 'paid'): Promise<QuotaCheck>
  async consumeQuota(userId: string, tier: 'free' | 'paid'): Promise<void>
}
```

#### 验收标准:

- [ ] 免费用户 7 天内超过 3 次时被正确拦截
- [ ] 付费用户配额扣减正常工作
- [ ] 配额不足时返回明确的错误信息

### 1.2 完善并发控制和重试机制

**预估时间**: 2-3 小时  
**复杂度**: 中等  
**风险**: 低

#### 问题分析:

当前并发控制基础已存在，但需要完善：

- GLM 免费模型并发限制(2 个)的严格执行
- 失败重试的指数退避优化
- 任务取消机制的完善

#### 任务清单:

- [ ] 优化 `lib/llm/worker-pool.ts` 中的并发控制逻辑
- [ ] 实现任务取消功能
- [ ] 添加详细的任务状态跟踪
- [ ] 完善错误分类和重试策略

#### 验收标准:

- [ ] 免费队列严格限制 2 个并发任务
- [ ] 任务可以被正确取消
- [ ] 重试机制按指数退避执行

### 1.3 环境变量和配置完善

**预估时间**: 1 小时  
**复杂度**: 低  
**风险**: 低

#### 任务清单:

- [ ] 检查和完善 `lib/env.ts` 中的 API key 配置
- [ ] 添加配额相关的环境变量
- [ ] 更新 `.env.local` 文件
- [ ] 验证所有 LLM 提供商的 API key 配置

## 阶段 2: Prompt Engineering 清理重构 (优先级: 🚨 高)

### 2.1 清理胶水代码和统一执行流程

**预估时间**: 2-3 小时  
**复杂度**: 中等  
**风险**: 低

#### 问题分析:

当前存在的关键问题：

1. `lib/llm/summarize.ts` 是可行性验证期间的胶水代码，与新的模板系统并存造成混乱
2. 部分任务仍使用硬编码 prompt，未采用新的模板系统
3. 执行流程不统一，需要标准化

#### 任务清单:

- [ ] 分析 `lib/llm/summarize.ts` 的当前使用情况
- [ ] 将 `summarize.ts` 中的逻辑迁移到标准的 `PromptExecutor` 流程
- [ ] 删除或重构 `summarize.ts` 中的冗余代码
- [ ] 确保所有 LLM 调用都通过 `lib/prompts/executor.ts` 统一执行

#### 验收标准:

- [ ] `summarize.ts` 中的胶水代码被清理
- [ ] 所有任务都使用统一的执行流程
- [ ] 代码结构更加清晰和一致

### 2.2 实现 detailed_resume 的 copy 模式

**预估时间**: 2-3 小时  
**复杂度**: 中等  
**风险**: 中等

#### 问题分析:

当前 `detailed_resume` 任务错误地使用了 summary 模式，导致信息丢失。需要：

- 创建专门的 copy 模式 prompt 模板
- 确保全量信息按 JSON 格式提取
- 保持结构化输出的稳定性

#### 任务清单:

- [ ] 在 `lib/prompts/templates.ts` 中创建 copy 模式模板
- [ ] 设计 detailed_resume 的 JSON 输出结构
- [ ] 更新 `PromptExecutor` 支持 copy 模式
- [ ] 测试和验证 copy 模式的输出质量

#### 实施步骤:

```typescript
// 新增 copy 模式模板
export const DETAILED_RESUME_COPY_TEMPLATE: PromptTemplate = {
  name: 'detailed_resume_copy',
  systemPrompt: '你是一个专业的简历信息提取专家...',
  userPrompt: '请将以下简历内容完整提取为JSON格式，不要遗漏任何信息...',
  outputFormat: 'json',
  maxTokens: 4000,
}
```

#### 验收标准:

- [ ] detailed_resume 使用 copy 模式正确提取全量信息
- [ ] JSON 输出结构稳定和完整
- [ ] 信息不再被压缩或丢失

### 2.3 完善模板系统和配置

**预估时间**: 1-2 小时  
**复杂度**: 低  
**风险**: 低

#### 任务清单:

- [ ] 检查和完善现有模板的配置
- [ ] 添加模板验证机制
- [ ] 优化模板的可读性和维护性
- [ ] 添加模板使用的文档说明

## 阶段 3: pgvector + LlamaIndex 基础架构搭建 (优先级: ⚠️ 中)

### 3.1 实现 pgvector 数据库支持

**预估时间**: 3-4 小时  
**复杂度**: 中等  
**风险**: 中等

#### 问题分析:

为 M2 阶段的 RAG 功能做准备，需要搭建向量存储的基础架构：

- 扩展 Prisma Schema 支持向量字段
- 实现向量相似性搜索的 DAL 方法
- 确保与 Neon PostgreSQL + pgvector 的兼容性

#### 任务清单:

- [ ] 在 `prisma/schema.prisma` 中添加 Document 模型
- [ ] 添加向量字段定义 `Unsupported("vector(1536)")`
- [ ] 生成和应用数据库迁移
- [ ] 创建 `lib/dal/document.ts` 支持向量操作
- [ ] 实现向量相似性搜索方法

#### 实施步骤:

```prisma
// 在 prisma/schema.prisma 中添加:
model Document {
  id        Int      @id @default(autoincrement())
  content   String
  embedding Unsupported("vector(1536)")?
  metadata  Json?
  createdAt DateTime @default(now()) @map("created_at")

  @@map("documents")
  @@schema("public")
}
```

#### 验收标准:

- [ ] 数据库迁移成功执行
- [ ] 可以插入和查询向量数据
- [ ] DAL 支持向量相似性搜索

### 3.2 集成 LlamaIndex 和 GLM embedding

**预估时间**: 3-4 小时  
**复杂度**: 高  
**风险**: 中等

#### 任务清单:

- [ ] 安装 LlamaIndex 相关依赖
- [ ] 创建 `lib/llm/embeddings.ts` - GLM embedding-3 集成
- [ ] 创建 `lib/rag/vectorStore.ts` - PrismaVectorStore 配置
- [ ] 创建 `scripts/generate-embeddings.ts` - 嵌入生成脚本
- [ ] 实现基础的文档索引功能

#### 实施步骤:

```bash
# 1. 安装依赖
npm install llamaindex @llamaindex/community

# 2. 创建嵌入模型配置
# 文件: lib/llm/embeddings.ts

# 3. 创建向量存储配置
# 文件: lib/rag/vectorStore.ts

# 4. 创建嵌入生成脚本
# 文件: scripts/generate-embeddings.ts
```

#### 验收标准:

- [ ] 向量存储可以正常初始化
- [ ] 嵌入模型可以生成向量
- [ ] 脚本可以成功生成和存储嵌入

### 3.3 创建 RAG 查询基础框架

**预估时间**: 2-3 小时  
**复杂度**: 中等  
**风险**: 低

#### 任务清单:

- [ ] 创建 `lib/rag/query.ts` - RAG 查询逻辑框架
- [ ] 实现基础的文档检索器 (Retriever)
- [ ] 集成 LangChain 构建简单的 RAG 链
- [ ] 添加基础的测试用例

#### 验收标准:

- [ ] RAG 查询框架可以正常初始化
- [ ] 可以基于查询检索相关文档
- [ ] 基础功能通过测试验证

## 阶段 4: 集成测试和验证 (优先级: 📝 低)

### 4.1 M1.1 核心功能集成测试

**预估时间**: 2-3 小时  
**复杂度**: 中等  
**风险**: 低

#### 测试目标:

验证 M1.1 里程碑的核心交付物：

- LLM 调用机制的完整性和稳定性
- Prompt Engineering 的结构化和模板化
- pgvector + LlamaIndex 基础架构的可用性

#### 任务清单:

- [ ] 测试免费/付费用户的配额管理和队列分配
- [ ] 验证所有 prompt 模板的输出质量和稳定性
- [ ] 测试 detailed_resume 的 copy 模式信息完整性
- [ ] 验证向量存储和嵌入生成的基础功能
- [ ] 端到端测试：用户上传 → 服务创建 →summary 生成

#### 验收标准:

- [ ] 免费用户 7 天内 3 次限制正确执行
- [ ] 付费用户可以正常使用高级模型
- [ ] 所有 prompt 都通过模板系统执行
- [ ] detailed_resume 输出完整的 JSON 结构
- [ ] 向量存储可以正常读写

### 4.2 性能和稳定性验证

**预估时间**: 1-2 小时  
**复杂度**: 低  
**风险**: 低

#### 任务清单:

- [ ] 验证 GLM 免费模型的并发限制(2 个)
- [ ] 测试 LLM 调用的重试和错误处理机制
- [ ] 验证数据库迁移和向量操作的稳定性
- [ ] 检查环境变量和配置的完整性

#### 验收标准:

- [ ] 并发控制正确工作
- [ ] 错误处理机制稳定
- [ ] 数据库操作无异常

### 4.3 文档更新和交付准备

**预估时间**: 1 小时  
**复杂度**: 低  
**风险**: 低

#### 任务清单:

- [ ] 更新项目文档反映架构变更
- [ ] 记录新增的环境变量和配置
- [ ] 整理 M1.1 阶段的实现总结
- [ ] 为 M2 阶段准备技术债务清单

#### 验收标准:

- [ ] 文档与实际实现一致
- [ ] 配置说明完整清晰
- [ ] M1.1 交付物清单完整

## 基于用户反馈的更新实施计划

### 关键澄清已收到

#### LLM 调用机制
- **并发限制**: DeepSeek v3.2 和 GLM 4.5 都有 5 个并发请求限制
- **Worker Pool 策略**: 最多 10 个 worker (5 个 DeepSeek + 5 个 GLM，优先使用 DeepSeek)
- **队列位置显示**: 前端必须在高流量时显示"你的任务在排队中，前面还有xx个"
- **测试配额**: 开发期间 7 天 50 次；通过环境变量配置；生产前减少到 3 次
- **API Keys**: DeepSeek 和 GLM API keys 都已配置并测试可用

#### Prompt Engineering
- **`summarize.ts` 处理**: 保留但不使用 `lib/llm/summarize.ts` 作为参考；M1.1 验证后删除
- **JSON 结构**: 使用 `summarize.ts` 第 117-156 行的现有结构 (resume/detailed/jd schemas)
- **模板优先级**: 所有任务都应迁移到统一模板系统；实施顺序灵活

#### pgvector + LlamaIndex
- **Neon pgvector**: 尚未启用，需要激活
- **GLM Embedding**: API 就绪，与 GLM 模型共享同一提供商
- **测试数据**: 用户将在测试开始时提供真实业务文档

#### 数据库 Schema 分析
- **配额模型**: 当前设计计算 `remaining = purchased - used`
- **性能担忧**: 频繁计算可能成为瓶颈
- **建议**: 添加 `remaining` 字段并使用原子操作以获得更好性能

### 修订的 5 阶段实施计划

#### 阶段 1: LLM调用机制优化 (4-6 小时)
**优先级: 高**

##### 1.1 配额管理系统优化
- **数据库 Schema 增强**:
  - 向 Quota 模型添加 `remaining` 字段以优化性能
  - 实现配额更新的原子操作
  - 添加可配置配额限制的环境变量
  ```prisma
  model Quota {
    id           String   @id @default(cuid())
    initialGrant Int      @default(0) @map("initial_grant")
    purchased    Int      @default(0)
    used         Int      @default(0)
    remaining    Int      @default(0) // NEW: for performance optimization
    updatedAt    DateTime @updatedAt @map("updated_at")
    userId       String   @unique @map("user_id")
    user         NeonUserSync @relation(fields: [userId], references: [id])
  }
  ```
- **环境配置**:
  ```env
  FREE_QUOTA_LIMIT=50  # Development: 50, Production: 3
  FREE_QUOTA_PERIOD_DAYS=7
  PAID_QUOTA_ENABLED=true
  ```

##### 1.2 并发控制和重试机制改进
- **Worker Pool 配置**:
  - DeepSeek workers: 5 (优先)
  - GLM workers: 5 (备用)
  - 实现智能负载均衡
- **队列管理**:
  - 实时队列位置跟踪
  - 前端队列状态显示
  - 预估等待时间计算

##### 1.3 环境变量和配置完善
- 验证所有 API keys 和模型配置
- 添加全面的错误处理和备用策略
- 实现所有 LLM 提供商的健康检查

#### 阶段 2: Prompt Engineering清理重构 (3-4 小时)
**优先级: 高**

##### 2.1 统一模板系统实现
- **保留 `summarize.ts`**: 保留作为参考，标记为已弃用
- **新模板框架**:
  - 支持现有 JSON schemas (resume/detailed/jd)
  - 实现基于 LCEL 的 prompt 链
  - 添加输入/输出 schemas 的 Zod 验证

##### 2.2 模板配置和验证
- 将现有 prompt 逻辑迁移到新模板系统
- 实现模板版本控制和 A/B 测试能力
- 添加全面的 prompt 验证和测试

#### 阶段 3: pgvector + LlamaIndex架构搭建 (4-6 小时)
**优先级: 中等**

##### 3.1 pgvector数据库支持实现
- **启用 pgvector 扩展**: 与 Neon 数据库设置协调
- **扩展 Prisma Schema**:
  ```prisma
  model Document {
    id        Int      @id @default(autoincrement())
    content   String
    embedding Unsupported("vector(1536)")? // GLM embedding-3 dimension
    metadata  Json?
    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt
  }
  ```
- **DAL 方法**: 按照项目规则创建向量操作方法

##### 3.2 LlamaIndex和GLM embeddings集成
- 安装和配置 LlamaIndex 依赖
- 设置 GLM embedding-3 模型集成
- 创建嵌入生成脚本
- 实现向量存储配置

##### 3.3 基础RAG查询框架建立
- 在 `lib/rag/query.ts` 中创建 RAG 查询逻辑
- 实现 LlamaIndex Retriever
- 集成 LangChain 用于 RAG 链
- 添加全面的测试和验证

#### 阶段 4: Workbench UI重构 (3-4 小时) **[新增阶段]**
**优先级: 中等**

##### 4.1 Server/Client架构重构
- **重构 `app/[locale]/workbench/page.tsx`**:
  - 按照 Next.js 15 最佳实践拆分为 Server 和 Client 组件
  - 在 Server 组件中实现适当的数据获取
  - 将 Client 组件使用最小化到仅交互元素

##### 4.2 shadcn/ui组件集成
- **替换自定义 UI 元素**:
  ```bash
  npx shadcn-ui@latest add button card input textarea select progress badge
  ```
- **组件结构**:
  - `WorkbenchLayout` (Server Component)
  - `UploadForm` (Client Component)
  - `QueueStatus` (Client Component)
  - `ResultDisplay` (Server Component)

##### 4.3 队列状态和位置显示
- **实时队列更新**:
  - WebSocket 或 Server-Sent Events 用于实时更新
  - 队列位置指示器: "你的任务在排队中，前面还有xx个"
  - 进度指示器和预估等待时间
- **用户体验增强**:
  - 使用 shadcn/ui 组件的加载状态
  - 错误处理和重试机制
  - 响应式设计和可访问性

#### 阶段 5: 集成测试和验证 (2-3 小时)
**优先级: 中等**

##### 5.1 功能测试
- LLM调用机制测试 (配额、并发、队列)
- Prompt Engineering验证 (模板系统、JSON 输出)
- pgvector + LlamaIndex架构测试 (嵌入、检索、RAG)
- Workbench UI功能测试 (上传、队列显示、结果)

##### 5.2 性能和稳定性验证
- 并发用户负载测试
- 高流量下的队列管理
- 向量操作的数据库性能
- 错误处理和恢复测试

##### 5.3 文档更新和部署准备
- 更新 API 文档
- 创建部署检查清单
- 环境变量配置指南
- 新功能用户指南

### 实施时间线
- **总预估时间**: 16-23 小时
- **建议进度**: 3-4 天集中工作
- **关键路径**: 阶段 1 → 阶段 2 → 阶段 4 → 阶段 3 → 阶段 5

### 风险缓解
1. **数据库 Schema 变更**: 在开发环境中彻底测试迁移
2. **API 速率限制**: 实现强大的备用和重试机制
3. **UI 重构**: 在过渡期间保持向后兼容性
4. **pgvector 设置**: 如需要与 Neon 支持协调

### 成功标准
- ✅ 具有实时跟踪的用户配额系统
- ✅ 具有位置显示的队列管理
- ✅ 统一的 prompt 模板系统
- ✅ 基于 shadcn/ui 的现代 workbench 界面
- ✅ pgvector + LlamaIndex 基础就绪
- ✅ 所有测试通过并满足性能基准

### 下一步
准备开始实施，从阶段 1: LLM调用机制优化开始。请确认是否希望我继续进行数据库 schema 更新和配额管理系统实施。

## 风险评估和缓解策略

### 高风险项目

1. **LlamaIndex 集成复杂性**

   - **风险**: 新技术栈，可能遇到兼容性问题
   - **缓解**: 先创建最小可行原型，逐步扩展功能

2. **向量数据库性能**

   - **风险**: pgvector 查询性能可能不满足需求
   - **缓解**: 提前进行性能测试，准备优化方案

3. **LLM 调用稳定性**
   - **风险**: 外部 API 调用可能不稳定
   - **缓解**: 实现完善的重试和降级机制

### 中风险项目

1. **Prompt 模板迁移**

   - **风险**: 迁移过程可能影响现有功能
   - **缓解**: 增量迁移，保持向后兼容

2. **数据库迁移**
   - **风险**: 向量字段迁移可能失败
   - **缓解**: 在开发环境充分测试

## M1.1 成功指标

### 核心交付物验收标准

- [ ] **LLM 调用机制**: 支持多模型、worker-pool、免费/付费队列，配额管理正常工作
- [ ] **Prompt Engineering**: 标准结构、模版化、针对任务灵活配置，detailed_resume 使用 copy 模式
- [ ] **pgvector + LlamaIndex**: 基础架构搭建完成，向量存储和嵌入生成功能可用

### 业务功能验收标准

- [ ] 用户上传简历和 JD 后可以成功创建服务
- [ ] 系统能够产出结构化的 summary 信息并正确落表
- [ ] 免费/付费用户的使用限制和模型分配正确执行

## 时间线总结

| 阶段   | 预估时间 | 关键里程碑                     |
| ------ | -------- | ------------------------------ |
| 阶段 1 | 3-4 小时 | LLM 调用机制完善               |
| 阶段 2 | 3-4 小时 | Prompt Engineering 清理        |
| 阶段 3 | 4-6 小时 | pgvector + LlamaIndex 基础架构 |
| 阶段 4 | 2-3 小时 | 集成测试和验证                 |

**总计**: 12-17 小时 (1.5-2 个工作日)

## 下一步行动

等待用户确认上述关键问题后，将按以下顺序开始实施：

1. **阶段 1.1**: 实现用户配额管理系统
2. **阶段 1.2**: 完善并发控制和重试机制
3. **阶段 2.1**: 清理 summarize.ts 胶水代码
4. **阶段 2.2**: 实现 detailed_resume 的 copy 模式

---

_最后更新: 2024-12-19_  
_状态: 规划完成，等待用户确认关键问题_
