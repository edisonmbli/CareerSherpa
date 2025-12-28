### 引言：LLM 统一调度者——`llm-scheduler.ts` 的核心作用

在您的项目中，`llm-scheduler.ts` 被设计为一个“LLM 统一调度者”，它的核心目标是**简化 LLM（大型语言模型）能力的调用链路，并提供统一、高效、可靠的 LLM 服务接口**。它整合了以下三个关键功能：

1.  **队列管理和并发控制**：确保 LLM 请求不会过载，并能根据优先级和资源情况进行调度。
2.  **LangChain 编排**：处理复杂的 LLM 调用逻辑，包括 Prompt 构建、模型调用和响应解析。
3.  **Prompt 模板系统**：标准化和管理用于 LLM 的 Prompt。

简单来说，`llm-scheduler.ts` 就是您项目中所有 LLM 请求的“交通枢纽”和“智能管家”。

---

### 1. `llm-scheduler.ts` 核心逻辑详解

#### 1.1. 职责与关键类型定义

`llm-scheduler.ts` 定义了多种类型来描述 LLM 任务及其结果：

- **`LLMTask`**: 代表一个待执行的 LLM 任务，包含任务 ID、用户 ID、服务 ID、任务类型（`vision` 或 `text`）、步骤（`match`, `resume`, `interview`, `extract`）、Prompt 内容、优先级、重试次数、所属层级（`free` 或 `paid`）等。
- **`LLMTaskResult`**: 任务执行后的结果，包括任务 ID、成功状态、LLM 响应、错误信息、耗时、使用的 Provider 和模型等。
- **`SummaryTask`**: 特指用于生成摘要的 LLM 任务，包含类型（`resume`, `job`, `detailed`）、ID、用户 ID、服务 ID 和原始数据。
- **`SummaryResult`**: 摘要任务的执行结果，包含类型、ID、成功状态、摘要 JSON、Token 使用量和耗时。

#### 1.2. 队列配置 (`QUEUE_CONFIGS`)

`QUEUE_CONFIGS` 是一个核心配置，它定义了不同任务类型（`text`, `vision`）和不同服务层级（`paid`, `free`）下，可以使用的 LLM Provider 及其并发限制和优先级。

```typescript
const QUEUE_CONFIGS = {
  text: {
    paid: [
      { name: 'deepseek', maxWorkers: 5, priority: 1 },
      { name: 'zhipu', maxWorkers: 3, priority: 2 },
    ] as ProviderConfig[],
    free: [{ name: 'zhipu', maxWorkers: 2, priority: 1 }] as ProviderConfig[],
  },
  vision: {
    /* ... */
  },
}
```

这表明：

- **付费文本任务**：优先使用 `deepseek` (5 个并发)，其次是 `zhipu` (3 个并发)。
- **免费文本任务**：只使用 `zhipu` (2 个并发)。
- **视觉任务**：也有类似的付费/免费配置。

这种配置允许系统根据用户配额和 Provider 的性能/成本，智能地选择和分配 LLM 资源。

#### 1.3. `LLMScheduler` 类

`LLMScheduler` 是整个调度系统的核心类。

##### 1.3.1. 初始化 (`constructor`, `initializeQueues`)

在 `LLMScheduler` 实例化时，它会根据 `QUEUE_CONFIGS` 初始化多个队列（`this.queues`），每个队列对应一个 `type-tier` 组合（例如 `text-paid`）。同时，它会为每个队列启动一个定时处理器 (`startQueueProcessor`)，定期检查并处理队列中的任务。

##### 1.3.2. 核心任务提交接口 (`submitTask`)

这是外部模块向调度器提交单个 LLM 任务的主要接口。

1.  **任务封装**: 接收一个 `LLMTask` 对象，并根据 `options`（如 `tier`, `timeout`, `priority`）设置任务属性。
2.  **队列选择**: 根据任务的 `type` 和 `tier` 确定要加入哪个队列（`queueKey`）。
3.  **元数据记录**: 记录任务的元数据，包括开始时间、入队时间、`AbortController` 等，用于后续追踪和取消。
4.  **优先级入队**: 将任务按照优先级插入到对应的队列中。
5.  **Promise 返回**: 返回一个 `Promise`，外部调用者可以通过 `await` 等待任务完成。当任务完成时，会通过 `taskCompletionCallbacks` 机制通知对应的 `Promise`。

##### 1.3.3. 批量摘要任务执行 (`executeSummaries`)

这是 `service-orchestrator.ts` 主要调用的接口，用于批量处理简历、职位描述等摘要任务。

1.  **并行处理**: 接收一个 `SummaryTask` 数组，并使用 `Promise.all` 并行处理每个摘要任务。
2.  **构建 `LLMTask`**: 对于每个 `SummaryTask`，它会构建一个对应的 `LLMTask`，包括生成 Prompt、设置 Provider 和超时时间。
3.  **提交到队列**: 调用 `this.submitTask` 将构建好的 `LLMTask` 提交到内部队列。
4.  **响应解析与验证**: 任务完成后，会调用 `parseSummaryResponse` 解析 LLM 的 JSON 响应，并进行结构验证。
5.  **Fallback 机制**: 如果 LLM 执行失败或 JSON 解析失败，并且 `enableFallback` 为 `true`，系统会尝试执行一个简化的 Fallback 逻辑，返回预设的默认摘要数据，以提高系统的健壮性。
6.  **结果汇总**: 收集所有摘要任务的结果，并返回 `SummaryResult` 数组。

##### 1.3.4. Prompt 构建 (`buildSummaryPrompt`)

这个方法负责根据 `SummaryTask` 的类型（`resume`, `job`, `detailed`）和数据，从预定义的 Prompt 模板中构建最终发送给 LLM 的 Prompt 字符串。它利用 `renderTemplate` 函数，将任务数据填充到模板中，生成系统 Prompt 和用户 Prompt。

##### 1.3.5. 响应解析 (`parseSummaryResponse`)

此方法用于解析 LLM 返回的 JSON 字符串。它会根据 `taskType` 预期的字段结构，调用 `validateLLMResponse` 进行验证，确保 LLM 返回的数据符合预期格式。

##### 1.3.6. 队列处理逻辑 (`processQueue`, `executeTask`)

- **`startQueueProcessor`**: 为每个队列启动一个定时器，每隔 100ms 调用 `processQueue`。
- **`processQueue`**:
  1.  检查队列是否有任务，以及当前活跃任务数是否达到最大并发限制。
  2.  如果满足条件，从队列中取出优先级最高的任务。
  3.  更新任务状态为 `active`，并增加活跃任务计数。
  4.  调用 `executeTask` 执行任务。
  5.  任务完成后，减少活跃任务计数，并从 `activeTasks` 和 `taskMetadata` 中移除。
- **`executeTask`**:
  1.  **选择 Provider**: 调用 `selectProviderForTask` 根据当前队列的负载情况和 Provider 的可用性，选择一个合适的 LLM Provider。
  2.  **获取模型配置**: 根据任务的 `tier` 和 `type` 获取对应的模型配置。
  3.  **调用 LLM**: 使用选定的 Provider 创建模型实例，并调用其 `invoke` 方法执行 LLM 调用。
  4.  **记录 Token 使用**: 如果 LLM 响应包含 Token 使用信息，会调用 `logTokenUsage` 记录到数据库。
  5.  **回调通知**: 通过 `taskCompletionCallbacks` 通知等待该任务结果的 `Promise`。
  6.  **错误处理**: 捕获执行过程中的错误，并返回失败结果。

##### 1.3.7. Provider 选择 (`selectProviderForTask`)

这个方法是智能调度的关键之一。它会：

1.  根据任务的 `type` 和 `tier` 获取对应的 Provider 配置列表。
2.  遍历配置列表，检查每个 Provider 是否 `isReady()`（例如，API Key 是否配置，服务是否可用）。
3.  检查 Provider 的当前活跃任务数是否小于其 `maxWorkers` 限制。
4.  选择第一个满足条件的 Provider，并增加其活跃任务计数。

---

### 2. `service-orchestrator.ts` 如何使用调度者

`service-orchestrator.ts` 中的 `ServiceOrchestrator` 类是业务逻辑的协调者，它负责将用户请求转化为一系列可执行的步骤，其中就包括了与 `llm-scheduler.ts` 的交互。

#### 2.1. `createService` 方法

这是 `ServiceOrchestrator` 的核心方法，用于创建服务并编排整个流程。

1.  **获取配额状态**: 首先，它会检查用户的配额状态（`quotaStatus`），确定用户是使用 `free` 还是 `paid` 层级的服务。
2.  **LLM 可用性检查 (`checkLLMReadiness`)**: 在真正执行 LLM 任务之前，`service-orchestrator` 会调用 `checkLLMReadiness` 函数。这个函数会：
    - 获取 `llmScheduler` 的 `workerPoolStatus`（工作池状态）。
    - 根据用户的 `tier` 和当前 LLM Provider 的负载情况（`currentLoad` vs `maxConcurrent`），推荐一个最合适的 LLM Provider 和具体模型（例如，付费用户优先使用 `deepseek`，如果 `deepseek` 负载过高则降级到 `zhipu`；免费用户则直接使用 `zhipu`）。
    - 这个检查确保了在提交 LLM 任务之前，系统已经对 LLM 服务的可用性和负载有了清晰的认识，避免了盲目提交导致的任务失败。
3.  **数据拉取与文本抽取**: 从数据库中拉取简历、职位描述等原始数据，并根据需要（例如，如果数据是图片格式），调用 `OCRService` 进行文本抽取。这些抽取出的文本将作为 LLM 任务的输入。
4.  **构建摘要任务 (`buildSummaryTasks`)**: 将抽取出的文本数据封装成 `SummaryTask` 数组。
5.  **调用 `llmScheduler.executeSummaries`**: 这是 `service-orchestrator` 与 `llm-scheduler` 交互的关键点。它将构建好的 `SummaryTask` 数组和用户的 `tier` 传递给 `llmScheduler`，由调度者负责执行这些 LLM 任务。
6.  **处理 LLM 结果**: `llmScheduler.executeSummaries` 返回后，`service-orchestrator` 会根据 `llmResults` 的成功与否，更新服务的状态（`done` 或 `error`）。如果所有任务都成功，服务状态为 `done`；如果部分或全部失败，则为 `error`，并记录详细的错误信息。

#### 2.2. `createServiceWithOrchestration` 便捷函数

这是一个简单的封装函数，用于在 `service.ts` 中更方便地调用 `ServiceOrchestrator` 的 `createService` 方法，并自动生成 `reqId` 和 `startTime`。

---

### 3. `service.ts` 作为入口

`service.ts` 文件定义了面向前端的 Server Actions，是用户请求的入口点。

#### 3.1. `createServiceAction`

这是用户通过前端界面触发创建服务时调用的 Server Action。

1.  **前置检查**: 在调用 `service-orchestrator` 之前，`createServiceAction` 会执行一系列重要的前置检查：
    - **参数验证**: 确保 `resumeId`, `jobId`, `lang` 等必要参数存在。
    - **幂等性检查 (`checkIdempotency`)**: 防止用户重复提交请求，确保操作的唯一性。
    - **异常使用模式检测 (`detectQuotaAnomalies`)**: 识别并阻止潜在的恶意或异常使用行为。
    - **配额检查 (`checkQuotaForService`)**: 检查用户是否有足够的配额来创建服务，并确定是使用 `free` 还是 `paid` 队列。
    - **原子性配额扣费 (`atomicQuotaDeduction`)**: 如果用户使用付费队列，会在这里原子性地扣除配额。如果后续服务创建失败，配额会回滚。
2.  **调用 `createServiceWithOrchestration`**: 在所有前置检查通过后，`createServiceAction` 会调用 `service-orchestrator.ts` 中的 `createServiceWithOrchestration` 函数，将实际的服务创建和 LLM 编排工作委托给它。
3.  **结果处理与路径重验证**: 根据 `createServiceWithOrchestration` 返回的结果，`createServiceAction` 会返回成功或失败的 `ActionResult`，并调用 `revalidatePath('/workbench')` 来更新前端页面缓存。

---

### 总结：分层架构的优势

通过这种分层架构，您的项目实现了清晰的职责分离和高内聚低耦合：

- **`service.ts` (Server Actions)**: 负责用户认证、权限控制、输入验证、幂等性、配额管理和错误处理，是面向前端的 API 层。
- **`service-orchestrator.ts` (业务逻辑编排)**: 负责协调整个服务创建的业务流程，包括数据准备、LLM 服务可用性评估、任务构建和结果处理，是核心业务逻辑层。
- **`llm-scheduler.ts` (LLM 统一调度者)**: 专注于 LLM 任务的调度、执行、并发控制、Provider 选择、Prompt 管理和响应解析，是 LLM 能力的基础设施层。

这种设计使得每个模块都专注于自己的核心职责，提高了代码的可维护性、可扩展性和健壮性。当需要更换 LLM Provider、调整调度策略或修改 Prompt 模板时，只需要修改 `llm-scheduler.ts` 及其相关配置，而不会影响到上层的业务逻辑。同时，通过队列和并发控制，系统能够更稳定、高效地处理大量的 LLM 请求。
