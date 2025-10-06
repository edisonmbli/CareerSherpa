**目标与范围**

- 目标：用最小 tokens 与稳定结构化输出，完成 a 匹配度 → b 简历定制 → c 面试要点三步闭环。
- 范围：仅服务个人求职场景；MVP 不做浏览器扩展与模板库，不做自动投递。

**模型与选择策略**

- 推理：DeepSeek v3.2；嵌入：OpenAI `text-embedding-3-small`；必要时提供后备模型切换。
- 语言：严格与用户输入一致（zh/en）；系统提示与输出均遵守语言一致性。

**架构总览（MVP）**

- 前端：Next.js App Router + Tailwind + shadcn/ui；页面包含 Landing、登录后工作台、历史记录详情、简历微调与导出。
- 后端：Next.js Server Actions/Edge/Node 路由（Vercel Functions）。职责包含认证与配额、上传解析、预检、服务编排、LLM 推理、RAG 检索、版本化存档与回退。
- 数据层：Neon Postgres（pgvector）做业务与向量存储；对象存储用于原始附件（简历 PDF 等）。
- 缓存层：Redis（如 Upstash）做速率限制、幂等请求去重、短 TTL 结果缓存与并发保护。

**Prompt 规范（系统/用户）**

- System Prompt（统一）：角色为“资深求职助手”，拒绝夸大/编造，优先结构化分节与要点列表。
- User Prompt（分步）：
  - a 匹配度：输入简历摘要 + JD 解析，要求评分、优势/缺口、投递私信话术。
  - b 简历：仅输出 EditPlan(JSON) 与短摘要，不生成全文；保持可寻址 `json_pointer/span_id`。
  - c 面试：输出自我介绍与 10–15 条问答要点（含 STAR），限制长度与层级。
- 禁止项：新增未经上下文支撑的事实；不夸张、不虚构数据；敏感信息不外泄。

**结构化输出与 Schema**

- a：`{score:number, highlights:string[], gaps:string[], dm_script:string}`。
- b：`EditPlan`：`summary:string, ops:({type,target,content,reason} | move{from,to})[]`。
- c：`{intro:string, qa_items:[{question,framework,hints}]}`；必要时分组（通用/岗位/追问）。
- 强制 `response_format=json_schema`；失败降级为“简短要点列表”。

**RAG 检索规则**

- 离线入库：文档分块(参考 chunkSize/overlap)；建立向量索引；按领域/语言维护。
- 在线检索：`topK<=config.rag.topK`、`minScore>=config.rag.minScore`；仅携带最小片段入上下文。
- 事实约束：输出只可引用检索片段与用户材料；无法支撑的信息以“待填变量清单”提示。

**Token/时延与成本预算**

- 上限：a≤900、b≤1200、c≤1200 输出 tokens；使用 `stop` 序列与模板变量。
- SLA：a≤8s、b≤12s、c≤12s（95%分位）。
- 成本：人均成本 ≤¥1.5/层；缓存命中率 ≥50%。

**缓存与幂等**

- 幂等键：`hash(normalized_body + model + step)`；命中直接返回（204/短 TTL 15–60min）。
- 结果缓存：a/b/c 分层缓存，Key 含 `service_id, model, params`；向量入库去重（指纹：`lang+domain+sha256(text)`）。
- 上下文复用：启用 `previous_response_id`；b/c 复用 a 的思考上下文。

**错误分级与降级**

- 错误码：`invalid_body|rate_limited|quota_exceeded|idempotent_replay|upstream_error|internal_error`。
- 重试：指数退避最多 2 次；幂等不重复扣次。
- 降级：
  - a 失败 → 返回摘要与改进清单（无需模型）。
  - b 失败 → 仅返回“编辑建议”，允许人工微调；不写入版本。
  - RAG 空 → 跳过检索，使用通用行业要点兜底（非模板库）。

**安全与隐私**

- 数据最小化：只存必要字段；用户删除立即生效；可选脱敏存储。
- 访问审计：记录 `user_id, service_id, task_id, action, ts`；导出请求带 `request_id`。
- 合规：不处理政治/违法内容；禁止输出个人隐私未授权信息。

**观测与评估**

- 结构化日志：`latency、token_usage、model、step、cache_hit`；SSE 流式统计到端。
- 质量评估：LLM-as-Judge + 规则校验（事实一致性/长度/语言）；人工审读小样本。
- 指标：从 a→b→c 的转化 ≥35%；错误占比 ≤5%。

**前端与交互规则**

- SSE：运行中展示滚动输出与 Skeleton；同 `service_id+step` 禁止重复触发。
- 工作台：JD 为高频入口；详细履历以“质量提示卡”引导，不阻塞主流程。
- 版本化：b/c 完成后保存版本；Diff 视图支持回滚。

**变更管理**

- Prompt/Schema 改动需记录版本与影响范围；灰度开关控制上线。
- 任何影响成本或 SLA 的改动，需更新预算与告警阈值。

**不做项（MVP）**

- 浏览器扩展、模板库、自动投递、原生移动端、第三方 ATS 深度双向同步。

**执行校验（DoD）**

- a：返回结构化评分与话术；可复用缓存与历史回看。
- b：仅返回 EditPlan 并合成成品简历；可回滚与高亮差异。
- c：返回自我介绍与要点清单；支持导出 Markdown/PDF。
