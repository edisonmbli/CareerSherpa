# CareerShaper 架构重构计划 (Architecture Refactor Plan)

## 1. 核心目标
将 Worker 执行逻辑从 Next.js 中剥离，构建独立的 HTTP Worker 服务，以支持高并发、多端接入及灵活扩容。

## 2. 架构设计 (Architecture Design)

### 2.1 系统拓扑
*   **Producer (Next.js)**: 负责鉴权、配额检查、任务提交 (Enqueuing) 和 SSE 订阅。
*   **Message Broker (QStash)**: 负责任务调度、重试、去重和削峰填谷。
*   **Consumer (Worker Service)**: 独立的 Node.js 服务，负责执行 LLM 调用、写入 DB 和发布 Redis 事件。
*   **State Store (Redis)**: 共享状态存储，用于队列背压 (Backpressure)、任务锁和实时进度流 (Stream)。

### 2.2 代码组织 (Monorepo-style)
保持在同一代码仓库中，通过目录区分：
*   `/` (Root): Next.js 应用 (Producer & BFF)
*   `/worker`: 新增的 Worker 服务 (Consumer)
*   `/lib`: 共享代码库 (DAL, LLM, Redis, Types) - 通过 `tsconfig` 路径映射共享。

### 2.3 环境隔离策略
*   **Development**:
    *   Producer: Local Next.js (`localhost:3000`)
    *   Consumer: Local Worker (`localhost:8080`)
    *   QStash: Local Mode (Docker) 或直接透传
    *   Redis: Local Redis (Docker) 或 Dev 实例
*   **Production**:
    *   Producer: Vercel (Serverless)
    *   Consumer: Cloud VPS (Docker/PM2)
    *   QStash: Upstash Managed Service
    *   Redis: Upstash Managed Redis

## 3. 云服务器采购指南 (Cloud Server Selection)
针对美国地区 (US Region) 及高性价比需求：
1.  **RackNerd / CloudCone (推荐入门)**:
    *   优势: 价格极低 (约 $15-$25/年)，拥有美国独立 IP。
    *   适用: 个人项目起步、低流量阶段。
2.  **Hetzner (US Ashburn) (推荐进阶)**:
    *   优势: 性能强悍，性价比高 (约 €5/月)，网络质量较好。
    *   适用: 生产环境、流量增长期。
3.  **Oracle Cloud Always Free (如果能注册到)**:
    *   优势: 免费 (4 ARM CPU, 24GB RAM)。
    *   劣势: 注册难度大，资源有时紧缺。

## 4. 实施步骤 (Implementation Roadmap)

### Phase 1: 基础建设 (Infrastructure)
1.  **初始化 `/worker` 目录**:
    *   配置 `package.json` (复用根目录依赖或独立) 和 `tsconfig.json` (支持 `@/lib` 导入)。
    *   选择轻量级 Web 框架 (推荐 **Hono** 或 **Fastify**)。
2.  **搭建本地开发环境**:
    *   配置 `docker-compose.yml` 启动 Redis 和 QStash (Local)。

### Phase 2: 核心迁移 (Core Migration)
3.  **迁移 Worker 逻辑**:
    *   将 `app/api/worker` 的入口逻辑迁移至 `/worker/src/index.ts`。
    *   复用 `lib/worker/handlers.ts`，确保 `req/res` 适配层兼容。
4.  **改造 Producer**:
    *   修改 `lib/queue/producer.ts`，支持根据环境变量 `WORKER_URL` 动态构造目标地址。

### Phase 3: 部署与运维 (Deployment & Ops)
5.  **构建与发布**:
    *   编写 `Dockerfile` 用于构建 Worker 镜像。
    *   编写 `deploy.sh` 脚本或 GitHub Actions 流程。
6.  **部署指南**:
    *   提供详细的服务器初始化、Docker 安装及服务启动文档。

## 5. 待办事项 (Todo List)
- [ ] **初始化 Worker 项目结构**: 创建目录、配置文件。
- [ ] **选型 Web 框架**: 确定使用 Hono (Node.js Adapter)。
- [ ] **编写 Worker 入口代码**: 实现 HTTP Server 和 QStash 接收器。
- [ ] **适配共享代码**: 确保 `/lib` 下的代码能在 Worker 环境正常运行 (处理环境变量等)。
- [ ] **本地联调**: 跑通 Next.js -> QStash (Local) -> Worker (Local) -> Redis -> SSE (Next.js) 流程。
- [ ] **编写 Dockerfile**: 容器化 Worker 服务。
- [ ] **文档输出**: 输出部署指南和架构文档。
