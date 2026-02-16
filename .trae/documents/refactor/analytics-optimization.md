# Analytics Optimization Plan

## 1. 定位与策略 (Positioning & Strategy)

### **定位**
- **Vercel Analytics / Google Analytics**: 负责宏观流量（PV/UV）、页面停留、地理位置等**匿名用户行为**。
- **Database (Business Tables)**: 负责最终**业务结果**（如 `Service` 状态、`Order` 金额）。
- **Internal Analytics (Our Focus)**: 负责**过程态**、**系统健康度**与**深度用户行为**。
    - **系统侧**: 任务队列延迟、Worker 执行耗时、LLM 失败率。
    - **业务侧**: 关键转化漏斗（上传 -> 解析 -> 匹配 -> 面试）、功能使用深度。

### **存储策略**
- **当前**: 使用 PostgreSQL (`analytics_events` 表)。
- **评估**: 
    - **优点**: 零额外成本，数据所有权完全掌控，可与 `User`/`Service` 表直接 Join 查询，开发体验好（类型安全）。
    - **风险**: 随着用户量增长，数据量可能激增，影响主库性能。
    - **对策**: 
        1.  **保留策略**: 仅保留最近 30-90 天的数据（可通过定时任务清理）。
        2.  **读写分离**: 写入是 `INSERT only`，对索引要求低；分析查询应避免在高峰期运行。
        3.  **未来迁移**: 当单日事件超过 10k+ 时，可平滑迁移到 ClickHouse 或 PostHog，目前阶段 DB 是最经济实用的选择。

## 2. 现有埋点审计 (Audit)

### **建议移除/降级**
| 事件名称 | 建议操作 | 原因 |
| :--- | :--- | :--- |
| `PAGE_VIEW_LANDING` | **移除** | 高频低价值，应交给 Vercel/GA 处理，避免污染数据库。 |
| `TASK_ROUTED` | **合并** | 可作为 `TASK_STARTED` 的一部分，不必单独记录。 |

### **建议保留与增强**
| 事件名称 | 现状 | 增强建议 |
| :--- | :--- | :--- |
| `TASK_ENQUEUED` | 已存在 | 增加 `traceId` 以便串联后续流程。 |
| `TASK_FAILED` | 已存在 | 增加 `errorCategory` 和 `duration`。 |
| `RESUME_SHARE_VIEW` | 已存在 | 核心增长指标，保留。 |
| `TOPUP_CLICK` | 已存在 | 核心营收指标，保留。 |

## 3. 新增埋点规划 (New Analytics)

### **A. 系统/并发监控 (System & Concurrency)**
> 对应 `Concurrency_Boosting_Guide.md` 的需求

| 事件名称 | 触发时机 | 关键字段 (Payload/Columns) | 用途 |
| :--- | :--- | :--- | :--- |
| `WORKER_JOB_STARTED` | Worker 收到任务并开始处理时 | `queueWaitTime` (startedAt - enqueuedAt), `workerId` | 监控**排队延迟**，判断是否需要扩容 Worker。 |
| `WORKER_JOB_COMPLETED` | Worker 处理完成时 | `duration` (exec time), `success` | 监控**执行耗时**，定位慢任务；计算 P95/P99。 |

### **B. 业务全链路 (User Journey)**

| 阶段 | 事件名称 | 关键字段 | 用途 |
| :--- | :--- | :--- | :--- |
| **Onboarding** | `USER_SIGNUP_COMPLETED` | `method` (email/google) | 注册转化率分析。 |
| **简历服务** | `SERVICE_CREATED` | `serviceType` | 服务启动量。 |
| | `RESUME_UPLOAD_COMPLETED` | `fileSize`, `fileType`, `duration` | 上传体验监控。 |
| | `RESUME_PARSE_COMPLETED` | `duration`, `isSuccess` | 解析器性能监控。 |
| **职位匹配** | `MATCH_GENERATED` | `matchScore`, `jobId`, `duration` | 匹配质量与耗时分布。 |
| **面试演练** | `INTERVIEW_SESSION_STARTED` | `interviewId` | 面试功能渗透率。 |
| | `INTERVIEW_MESSAGE_SENT` | `role` (user/ai), `length` | 交互深度分析。 |

## 4. 数据库 Schema 调整

为了支持上述分析（特别是时长和链路追踪），需要调整 `AnalyticsEvent` 表结构。

**修改 `prisma/schema.prisma`**:
- 增加 `traceId`: 用于关联一系列相关事件（如：Task Enqueued -> Started -> Completed）。
- 增加 `duration`: 整数（毫秒），便于 SQL 聚合查询（`AVG`, `MAX`），无需解析 JSON。
- 增加 `category`: 枚举（`SYSTEM`, `BUSINESS`, `SECURITY`），便于分类查询。

## 5. 代码规范 (Best Practices)

1.  **Fire-and-Forget**: 保持现有的 `void` 调用模式，不阻塞主线程。
2.  **Context Propagation**: 在 Worker 链路中透传 `traceId`（通常是 `taskId` 或 `serviceId`），确保能串联起整个生命周期。
3.  **Error Suppression**: `trackEvent` 内部必须 `try-catch`，绝不允许埋点代码 crash 业务逻辑。
4.  **Payload Flattener**: 尽量保持 Payload 扁平化，避免深层嵌套，方便后续（可能的）导出分析。

## 6. 执行步骤 (Execution Steps)

1.  **Schema Migration**:
    - 修改 `prisma/schema.prisma` 添加新字段。
    - 生成并应用 migration。
2.  **Analytics Lib Refactor**:
    - 更新 `trackEvent` 签名，支持 `duration` 和 `traceId`。
    - 更新 `AnalyticsEventName` 枚举，移除废弃事件，添加新事件。
3.  **Implement System Metrics**:
    - 在 `lib/worker` 中集成 `WORKER_JOB_STARTED` 和 `WORKER_JOB_COMPLETED`。
    - 计算 `queueWaitTime` 和 `executionDuration`。
4.  **Implement Business Metrics**:
    - 在关键业务 Action (Upload, Match, etc.) 中添加埋点。
