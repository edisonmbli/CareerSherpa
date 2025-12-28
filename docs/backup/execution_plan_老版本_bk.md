# Project Execution - Detail Plan

## 里程碑 M0：基础设施就绪

目标

- 建立最小但稳健的基础设施与守护：日志、速率限制、试用与并发保护，打通开发/预览/生产三段。
- 明确密钥与第三方服务配置边界，形成可复用的“环境开箱清单”。

时间与范围

- Day 1：仓库/环境基线、日志骨架、速率限制骨架、试用并发保护策略对齐。
- Day 2：接入部署管线、预览与生产环境变量、基础验收与回归测试。

交付物

- 可运行的最小后端（/api/run、/api/rag/\*、挂接日志与限流）、Vercel 预览部署、环境变量与密钥清单。
- 验收用例通过：限流触发 429、试用规则生效、并发保护按用户维度生效、日志可追溯。

职责分工（需要你协助）

- GitHub/Vercel：

  - 创建/绑定 GitHub 仓库与 Vercel 项目（Production + Preview）。

  - 设置 Vercel 的环境变量（见“环境与密钥”），并开启“自动预览部署”。

- 第三方服务/密钥：
  - OPENAI_API_KEY（必需，用于 LLM/Embedding）。
  - 可选：UPSTASH_REDIS_REST_URL、UPSTASH_REDIS_REST_TOKEN（生产限流/并发保护，开发可用内存替代）。
  - 可选：DATABASE_URL（Neon Postgres + pgvector；M0 可后置至 M1）。
- 仓库保护与协作：
  - 启用分支保护（main）、PR 模板、Issue 模板与标签（可由我提供模板，你来启用）。

环境与密钥（名称统一）

- OPENAI_API_KEY：生产/预览/本地均需（预览和本地可用受限密钥）。
- UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN：生产必需（限流/并发锁）；本地缺省则自动回退至内存实现。
- DATABASE_URL：后置到 M1（RAG 索引需 DB），如你已就绪可提前填入。
- NEXT_PUBLIC_APP_BASE_URL：用于生成跳转链接与回调（预览/生产分别设置）。

技术任务明细（我负责实现）

1. 运行时基线

   - Node/pnpm 版本锁定与本地启动校验；统一 `.env.local` → Vercel 环境变量映射。
   - 缺失密钥的启动前检查（明确报错：缺失项与影响范围）。

2. 国际化架构骨架

- 范围与目标：M0 提供中/英两种语言的基础支持，覆盖站点文案、错误提示与日志语言标识；不改造路由结构，优先以配置与字典驱动。
- 语言来源与优先级：显式选择（预留设置位）→ Cookie `lang` → `Accept-Language` → 默认 `en`；服务端解析并设置 `html lang` 与字典加载。
- 文案字典：新增 `lib/i18n/messages/en.ts`、`lib/i18n/messages/zh.ts`，采用命名空间分组（如 `landing.*`、`errors.*`、`workbench.*`），并提供 `getMessages(locale)` 以 SSR 加载。
- Next 配置：更新 `next.config.ts` 的 `i18n.locales = ['en', 'zh']` 与 `defaultLocale = 'en'`，为后续路由级 i18n 做准备。
- 日志：结构化日志中新增 `lang` 字段，便于在 Vercel Logs 中检索与关联；错误提示使用字典文本。
- 缓存：字典为静态模块，SSR 原生模块缓存；客户端不引入第三方库，保持最小实现。
- 验收：切换 `lang` 后首页与 API 错误返回可展示中/英；日志包含 `lang`；缺省时回退 `en`。

3. 日志方案骨架

   - 新增 `lib/logger.ts`：结构化日志接口（level、ts、route、userKey、reqId、duration、tokens）。
   - 在 `/api/run` 与 `/api/rag/*` 接入：请求开始/结束日志、错误日志；生成 `reqId` 贯穿。
   - Vercel 环境下采用 `console` 输出 Logfmt/JSON，便于聚合检索；本地打印同构。

4. 速率限制骨架

   - 策略：试用用户 `3 req / 5min`，登录/绑定用户 `15 req / 5min`；超限返回 `429 {error, retry_after}`。
   - 实现：
     - 生产：Upstash Redis 滑动窗口（按 `userKey` 或 IP），key 前缀 `rate:{userKey|ip}:{route}`。
     - 本地/预览：内存令牌桶+TTL，避免外部依赖。
   - 接入 `/api/run`、`/api/rag/query`、`/api/rag/documents`。

5. 试用逻辑与并发保护

   - 试用识别：沿用 `getUserKey/isTrialUser`（无 `userKey` 或标记为试用即视为试用）。
   - 并发保护：单用户同一任务类型并发 1
     - 生产：Redis 分布式锁 `lock:{userKey}:{taskKind}`，TTL 防死锁。
     - 本地/预览：内存 Map + TTL。
   - 失败降级：锁获取失败返回 `409 {error: "task_already_running"}`，引导等待或取消。

6. CI/CD 与质量守护

   - Vercel 项目绑定 GitHub，PR 自动预览部署；main 自动生产部署。
   - 新增轻量测试基线（vitest）：限流策略、锁策略、试用判定与日志单元测试。
   - ESLint/TypeScript 校验纳入 `pnpm test`/`pnpm lint` 例程。

7. 验收用例（Day 2 执行）
   - 限流：连续调用 `/api/run` 触发试用阈值后返回 429；`retry_after` 合理。
   - 并发：同一 `userKey` 并发两次分析任务，第二次返回 409。
   - 日志：在 Vercel Logs 中可按 `reqId` 关联请求开始/结束与错误信息。
   - 试用规则：试用用户阈值更低；绑定用户阈值更高；策略切换正确。

风险与降级

- 若 Upstash 尚未就绪：开发/预览使用内存实现，生产先以较保守限流策略上线，并在 M1 切换至 Redis。
- 若 OPENAI_API_KEY 未就绪：保留 API 端点与限流/日志可用；LLM 调用返回提示性错误，不阻塞 M0 验收。

里程碑完成判定（Definition of Done）

- 有效日志、限流、试用与并发保护在 Vercel 预览与生产环境均可验证。
- 最小单元测试通过；CI 预览部署运行正常；缺失配置能被明确提示。

## 里程碑 M1：上传/解析/预检与服务创建

### 目标与范围

- 目标：完成上传 → 解析 → 预检 → 创建服务全链路（含轻量工作台），为后续 a/b/c 三层任务打基础。
- 范围：数据表落地（结构化+向量）、国际化架构前置接入、LangChain 基线抽象、三类 Summary 推理（GLM 4.5.5 Flash 优先，DeepSeek v3.2 兜底）、三个 API（上传简历、上传 JD、创建服务）、最小表单页。
- 排除：生产级工作台、支付集成、Neon Auth 登录态集成（在 M1 以伪设备或模拟 user_key 替代），SSE 流式返回（若非必需）。

### 前置项与依赖

- 数据库：Neon Postgres + pgvector（扩展与索引后续在 RAG 时深化），本里程碑至少铺设 users/resumes/detailed_resumes/job_descriptions/services 基表。
- 国际化：采用“路由段 + 中间件 + 字典加载器”的三层方案（路径 /[locale]/…，默认语言回退、SEO 友好、字典缓存）以支撑后续多语言运营稳定性。
- LLM 基线：统一 LangChain 封装（模型、Prompt、输出解析、重试与降级），后续任务重用同一套抽象（模型替换与参数差异化）。
- 成本与速率：沿用已完成的本地速率限制与并发锁；对 Summary 使用轻量模型，超时与失败降级策略前置。

### 数据库设计与迁移（M1 必要子集）

- 表清单（参考设计草案，先落地必要子集）：
  - users：id、email、lang_pref、created_at、updated_at（Neon Auth 接入前用模拟用户）
  - resumes：id、user_id、lang、original_text、structured_json、resume_summary_json、resume_summary_tokens、active、timestamps
  - detailed_resumes：id、user_id、lang、original_text、detailed_summary_json、detailed_summary_tokens、timestamps
  - job_descriptions：id、user_id、lang、raw_text、parsed_json、job_summary_json、job_summary_tokens、timestamps
  - services：id、user_id、resume_id、job_id、status(enum: created|running|done|error)、depth(enum: a|b|c)、timestamps
- 迁移与索引：
  - 时间序列统一索引 `created_at`；业务主路索引 `user_id,created_at`（services）、`user_id,active`（resumes）。
  - pgvector 延后至 RAG 模块，但表结构预留字段位；Summary 字段用 `jsonb`。
- 事务与幂等：
  - 创建服务走事务（校验 → 写 services 记录 → 回写 Summary 字段），幂等键以请求体摘要+模型+步骤生成（短 TTL 缓存，命中直接返回）。

### 国际化架构（前置落地）

- 路由层：将页面与 API 置于 `app/[locale]/...`（API：保留业务路径，语言用于 UI 与提示，接口体保留 `lang` 字段）。
- 中间件：检测 `Accept-Language` 与 Cookie，默认回退 `en`，对无 locale 的路径重写至默认语言。路径式 i18n 具备更强 SEO 与运营可控性（参考经验总结）。
- 字典层：`i18n-config.ts` + 字典文件（en/zh），通过 `React.cache` 的字典加载器在 Server Components 端缓存，以避免重复加载并提升性能。
- 组件层：Server Components 负责拉词典，Client 通过 Context 消费，页面与组件不出现硬编码文本。

### LangChain 基线抽象

- 目录与封装：
  - `lib/llm/providers.ts`：统一对接 GLM（ZHIPUAI_API_KEY）与 DeepSeek（DEEPSEEK_API_KEY）。
  - `lib/llm/prompts.ts`：三类 Summary 模板与公共系统提示（语言一致性、长度控制、禁止编造）。
  - `lib/llm/chain.ts`：可复用的 Chain 组装（Prompt→Model→Parser），支持 `.invoke()` 与 `.stream()`。
  - 统一输出格式：`{ summary_json, tokens, model, provider, cost }` 并写入表字段。
- 模型策略：
  - 默认 GLM-4.5-Flash 作为轻度推理（免费与高性能优先）；质量不达标时自动切换至 DeepSeek v3.2（标记降级原因与成本）。
  - 超时与失败策略：指数退避最多 2 次；失败回落为要点列表摘要以保障服务创建流程不中断。

### API 设计与实现（M1 范围）

- POST `/api/upload/resume`：body{ text, lang } → { resume_id }
  - 校验必填与长度 → 写 `resumes`（初始 active=true）→ 返回 id。
- POST `/api/upload/detailed-resume`：body{ text, lang } → { detailed_resume_id }
  - 校验必填与长度 → 写 `detailed_resumes` → 返回 id。
- POST `/api/upload/jd`：body{ text, lang } → { job_id }
  - 写 `job_descriptions` → 返回 id。
- POST `/api/service/create`：body{ resume_id, job_id, lang?, detailed_resume_id? } → { service_id }
  - 前置校验：用户 pending 服务计数 ≤3；简历/JD 语言一致性、长度与结构完整性。
  - 事务流程：创建 `services.created` → 触发三类 Summary（resume/detailed/jd），写回各自表字段 → 更新 `services.status=done` → 返回 `service_id`。
  - 幂等：基于 `hash(normalized_body + model + step)`，命中直接返回。
- 预检规则（Input Normalizer 前）：
  - 必填：resume、jd；可选 detailed_resume。
  - 长度与结构：简历 ≥N 字、JD ≥M 字；Header/Summary/Experience/Skills 命中率；JD 的职责/要求关键名词覆盖。
  - 语言一致性：`lang` 一致，否则提示用户统一语言。
- 运行时与日志：
  - 记录 `input_tokens/output_tokens/cost` 至 `token_usage_logs`（可在 M1 延后，仅在服务端日志中打印作为过渡）。
  - 将 `reqId/userKey/lang/duration` 等结构化日志并入现有日志方案。

### 轻量工作台（开发态）

- 页面：`app/[locale]/workbench/page.tsx`（最小表单）：
  - 输入：简历、详细履历（可选）、JD 三个文本域；语言选择器（中/英）。
  - 操作：上传 → 创建服务（展示 `service_id`）、流式或分步展示 Summary（非必须流式）。
  - 验收：服务创建后展示 Summary 总览与校验结果；错误提示友好（语言一致）。
- 前端与 API 约定：
  - 按 M1 的 API 契约调用；接口体携带 `lang` 保持一致性。

### 验收标准与测试

- API：三条 API 在本地生产模式通过（HTTP 200），错误路径明确（400/422/500）。
- 数据：四张核心表正确写入与更新，服务状态流转正确（created→done）。
- 国际化：`/[locale]/workbench` 正常渲染，字典加载不重复，默认回退生效。
- Summary：GLM 质量验收（三类 summary 均能稳定覆盖要点），必要时切换 DeepSeek 验收。
- 幂等与限制：重复请求命中幂等返回；pending>3 阻塞新服务创建并提示。
- 日志：结构化日志包含请求标识、语言、耗时、模型、输出长度。

### 风险与缓解

- 模型质量不稳定：先验收 GLM，不达标自动切为 DeepSeek；保留“要点级摘要”降级路径。
- 成本与时延：Summary 上限输出长度控制与 prompt 限长；失败重试 ≤2；缓存命中优先。
- 国际化耦合：路由与字典分层，组件不直接持有语言逻辑，避免后续改动成本。

### 时间与拆解（建议 3–5 天）

- D1：数据表与迁移、i18n 三层架构前置、LangChain 基线封装。
- D2：上传两条 API 与服务创建 API，事务与幂等；GLM 集成与三类 Summary。
- D3：工作台最小表单页、预检规则与错误提示；验收联调。
- D4：质量回归、日志与成本度量、DeepSeek 兜底验证；文档与重现步骤完善。

### 输出与交付物

- 代码：数据层（迁移与访问）、i18n（middleware/i18n-config/dictionaries）、LLM 抽象（providers/prompts/chain）、三个 API、工作台页面。
- 文档：接口契约、预检规则、部署与环境变量、验收脚本与重现方法。
- 配置：`.env.local`（ZHIPUAI_API_KEY/DEEPSEEK_API_KEY/数据库连接），i18n 默认语言与支持列表。

## 里程碑 M1.1：阶段性重构优化（phase 1）

目标与范围

- 目标：消除阻塞的架构风险，支撑 a/b/c 服务稳定迭代；并发与降级策略落地；Prompt 体系规范化。
- 范围：LLM 抽象与模型池、免费/付费双队列与排队机制、DAL + Prisma、缓存与幂等、Prompt 模板拆分、Server Actions 基线。
- 保持现有 API 契约不变（必要时以薄适配层过渡），不新增业务功能。

执行顺序与要点（建议 5–7 天）

1. 文档与限额对齐
   - 在 project_spec 明确免费/付费队列策略与并发上限：
     - 免费：GLM‑4.5‑Flash（text 并发=2）、GLM‑4.1v‑thinking‑Flash（vision 并发=5）
     - 付费：DeepSeek v3.2 / GLM‑4.5（text 并发可配置，优先使用 deepseek），队列长度可配置
   - 任务入队后不可更换队列；未执行前可取消；失败统一降级路径与错误分级。
2. 数据访问与缓存
   - 引入 Prisma，建立 DAL 层函数：getResumeById、getJobById、getDetailedById、updateSummaries、createService、updateServiceStatus 等；隔离 SQL。
   - 加入短 TTL（15–30min）读取缓存与结果缓存；统一幂等键（hash(normalized_body+model+step)）。
3. LLM 抽象与模型池
   - Provider 接口统一：createModel(config) / invoke(input, options) / tokens(meta)；支持 Zhipu/DeepSeek 切换。
   - WorkerPool 工厂：按模型并发上限初始化；免费/付费两个队列；任务取消与队列监控（长度、等待时间）。
4. 并行化与编排
   - 将三类 Summary（resume/detailed/jd）并行执行，受 WorkerPool 并发控制；加入指数退避 ≤2、超时降级为要点列表。
5. Prompt 体系重构
   - 为三个预任务建立独立模板文件：
     - summary.resume.ts（摘要）
     - summary.detailed_copy.ts（全量字段“copy 模式”抽取，JSON 输出）
     - summary.jd.ts（职责/要求/关键词抽取）
   - 模板结构统一为 Identity/Instructions/Context/user_message，使用分隔符与骨架示例；输出 JSON Schema 严格校验。
6. API 与 Server Actions
   - 服务创建编排迁移至 Server Actions（保留现有 API 为薄适配层）；路由内仅做参数校验与调用。
   - 拆分单体逻辑为 modules：validation、orchestration、storage（DAL）、llm（providers/pool/prompts）。
7. 质量与清理
   - 移除调试遗留语句，统一日志结构（reqId/userKey/lang/duration/model/tokens）。
   - 单元测试覆盖：DAL、队列与并发控制、prompt 解析与 JSON 校验、降级路径；ESLint/TS 严格模式。

验收标准（Definition of Done）

- 队列：免费/付费队列运行稳定；并发不超过模型上限；排队与取消生效；监控指标可观测（队列长度、等待时间）。
- 数据：API 中不再直接书写 SQL；DAL 覆盖核心读写；缓存命中率 ≥40%；幂等命中正确。
- LLM：Provider 抽象可替换；模型池复用稳定；失败重试与降级路径生效。
- Prompt：三类预任务输出稳定；detailed_resume 按“copy 模式”输出完整 JSON；解析严格。
- 时延：端到端耗时下降 ≥25%；重复代码显著减少（DRY 改善）。

风险与缓解

- 并发导致限速：队列长度与 backpressure 控制；动态降级；监控报警。
- Prisma 引入风险：先在预览环境进行迁移与验证；保留原 SQL 兜底。
- Prompt 改动质量波动：灰度开关，保留旧模板兼容；回滚路径明确。

## 里程碑 M1.1：阶段性重构优化（phase 2）

### 目标与背景

基于架构审查发现的关键问题，本阶段重构旨在：

- 实现"Server Actions 优先"的架构原则
- 消除代码重复，统一数据访问层
- 提升代码质量和可维护性
- 确保安全合规和性能优化

### 重构实施计划

#### 阶段 1：基础设施重构（1-2 天）

**1.1 创建统一文件处理工具**

- 目标：消除三个 upload 路由中的重复代码
- 实施：创建 `lib/utils/file-processor.ts`
- 功能：统一 PDF 解析、图片处理、文件验证逻辑
- 验收：所有 upload 路由使用统一工具函数

**1.2 建立 Server Actions 基础设施**

- 目标：实现"Server Actions 优先"架构
- 实施：创建 `lib/actions/` 目录结构
- 功能：upload、service 创建的服务端函数
- 验收：所有表单提交通过 Server Actions 处理

**1.3 统一数据访问层**

- 目标：消除直接 SQL 与 Prisma 混用问题
- 实施：将 upload 路由的 SQL 操作迁移到 DAL
- 功能：所有数据库操作通过 `lib/dal.ts` 统一管理
- 验收：无直接 SQL 查询，全部使用 DAL 函数

#### 阶段 2：API 重构与迁移（2-3 天）

**2.1 Server Actions 实现**

- upload 相关：`uploadResume`, `uploadDetailedResume`, `uploadJobDescription`
- service 相关：`createService`, `getServiceStatus`
- 错误处理：统一的错误响应和日志记录

**2.2 API 路由精简**

- 保留：`/api/rag/*`（外部 RAG 服务）
- 保留：`/api/run`（系统监控）
- 迁移：upload 和 service 相关路由 → Server Actions
- 删除：测试和调试路由

**2.3 前端集成更新**

- 更新 `workbench/page.tsx` 使用 Server Actions
- 移除 fetch 调用，使用表单提交
- 优化用户体验和错误处理

#### 阶段 3：质量提升与合规（1 天）

**3.1 安全合规**

- 文件类型和大小验证
- CSRF 保护（Server Actions 自带）
- 输入验证和清理

**3.2 错误处理标准化**

- 统一错误码和响应格式
- 完善日志记录和监控
- 用户友好的错误提示

**3.3 测试完善**

- 单元测试覆盖新的工具函数
- 集成测试验证 Server Actions
- 性能测试确保无回归

### LLM 队列管理

#### 历史方案（基线快照 v1）

**架构概览**

- 多层调用架构：用户请求 → createServiceAction → createServiceWithOrchestration → ServiceOrchestrator.createService() → executeQueuedSummariesWithLangChain → LangChainOrchestrator.executeSummaries() → executeLLMTask → LLMWorkerPool.submitTask()
- 三个核心组件协同工作：Service Orchestrator、LangChain Orchestrator、LLM Worker Pool

**核心组件功能**

1. **Service Orchestrator** (`lib/service/service-orchestrator.ts`)

   - 服务创建的主编排器，负责整体流程控制
   - 包含配额检查、LLM 就绪状态验证、数据拉取、文本抽取
   - 错误处理和状态回滚机制

2. **LangChain Orchestrator** (`lib/llm/langchain-orchestrator.ts`)

   - 基于 LangChain LCEL 构建处理链
   - 管理不同类型的摘要任务（简历、职位、详细）
   - 提供 Prompt 模板系统和响应解析验证

3. **LLM Worker Pool** (`lib/llm/worker-pool.ts`)
   - 任务队列管理（按类型+层级分队列）
   - 并发控制和智能调度（视觉任务共享 worker 池）
   - 模型对象复用和降级机制
   - 完整的任务生命周期管理

**队列机制特性**

- 支持付费/免费用户分层队列
- 文本任务（DeepSeek v3.2, GLM 4.5/4.5-Flash）和视觉任务（GLM-4.1v-thinking-Flash）分离
- 优先级排队和 FIFO 处理
- 任务状态跟踪（pending, processing, completed, failed）
- 自动重试和错误恢复

**已实现功能**

- ✅ 多模型支持和智能选择
- ✅ 并发控制和资源管理
- ✅ 队列状态监控和任务追踪
- ✅ 错误处理和降级机制
- ✅ 模型对象复用优化

**待实现功能**

- ⏳ 队列排位查询 API（队列处理逻辑已实现，缺少前端接口）
- ⏳ 实时状态推送（考虑 WebSocket 或 Server-Sent Events）
- ⏳ 队列可视化界面

**性能特点**

- 精细的并发控制（文本任务独立池，视觉任务共享池）
- 智能降级机制（付费 → 免费模型）
- 丰富的监控数据和状态管理
- 比原设计更加精密和完善的实现

#### 当前方案现状

**架构概览**

-   **简化调用架构**：用户请求 → `createServiceAction` → `createServiceWithOrchestration` → `ServiceOrchestrator.createService()` → `llmScheduler.executeSummaries()` → `llmScheduler.submitTask()` → `llmScheduler.executeTask()`
-   **核心组件整合**：`llm-scheduler.ts` 整合了原有的 `LangChain Orchestrator` 和 `LLM Worker Pool` 的功能，成为LLM能力的统一入口。

**核心组件功能**

1.  **Service Actions** (`lib/actions/service.ts`)
    *   用户请求的入口，负责认证、权限、输入验证。
    *   执行幂等性检查、异常使用模式检测、配额检查及原子性配额扣费/回滚。
    *   调用 `ServiceOrchestrator` 进行业务逻辑编排。

2.  **Service Orchestrator** (`lib/services/service-orchestrator.ts`)
    *   服务创建的主编排器，负责整体业务流程控制。
    *   包含配额检查、LLM就绪状态验证（基于 `llmScheduler` 的状态）、数据拉取、文本抽取（OCR）。
    *   构建 `SummaryTask` 任务列表。
    *   将 `SummaryTask` 提交给 `llmScheduler` 进行批量处理。
    *   根据LLM任务结果更新服务状态，并处理错误。

3.  **LLM Scheduler** (`lib/llm/llm-scheduler.ts`)
    *   **LLM统一调度者**：整合了队列管理、并发控制、LangChain编排和Prompt模板系统。
    *   **队列管理**：根据任务类型（`text`/`vision`）和用户层级（`paid`/`free`）维护多个任务队列。
    *   **并发控制与智能调度**：动态选择LLM Provider，考虑Provider的可用性、负载和配置的最大并发数。
    *   **Prompt构建**：根据任务类型和数据，从模板系统构建LLM的Prompt。
    *   **LLM调用与响应解析**：封装了LLM的实际调用，并对LLM响应进行JSON验证和解析。
    *   **Fallback机制**：LLM执行失败或JSON解析失败时，提供简化的Fallback逻辑。
    *   **任务生命周期管理**：跟踪任务状态、重试、超时和Token使用记录。

**队列机制特性**

-   支持付费/免费用户分层队列，并根据配额状态动态选择。
-   文本任务（DeepSeek v3.2, GLM 4.5/4.5-Flash）和视觉任务（GLM-4.1v-thinking-Flash）分离。
-   优先级排队和FIFO处理。
-   任务状态跟踪（queued, active, completed, cancelled）。
-   自动重试和Fallback机制。
-   Provider选择考虑负载均衡和可用性。

**已实现功能**

-   ✅ 统一的LLM调度入口，简化调用链路。
-   ✅ 多模型支持和智能选择（基于用户层级和Provider负载）。
-   ✅ 精细的队列管理和并发控制。
-   ✅ 整合Prompt模板和LangChain编排。
-   ✅ 任务状态监控和Token使用记录。
-   ✅ 错误处理、Fallback和重试机制。

**待实现功能**

-   ⏳ 队列排位查询 API（前端接口）。
-   ⏳ 实时状态推送（考虑 WebSocket 或 Server-Sent Events）。
-   ⏳ 队列可视化界面。
-   ⏳ LLM成本计算。
