# CareerShaper 架构重构实施计划 V2 (Architecture Refactor Plan V2)

## 1. 架构决策调整 (Architecture Refinement)

### 1.1 技术选型：切换至 Hono
响应您的反馈，将 Worker 服务框架从 Fastify 切换为 **Hono**。
*   **理由**: Hono 基于 Web 标准 (Request/Response)，体积极小，原生支持 TypeScript，且具备跨平台能力 (未来可无缝迁移至 Edge/Serverless)。
*   **性价比**: 开发体验极佳 (强类型)，启动速度快，资源占用比 Fastify 更低，非常适合高密度部署。

### 1.2 VPS 架构：多租户复用 (Multi-Tenancy)
针对 Hetzner 服务器的“压榨”策略，设计基于 **Caddy + Docker** 的多租户架构：
*   **接入层 (Ingress)**: 使用 **Caddy** 作为反向代理网关。
    *   自动申请/续期 HTTPS 证书。
    *   通过域名/子域名区分不同项目 (e.g., `worker-a.career.com`, `worker-b.career.com`)。
*   **应用层**: 每个项目独立的 `docker-compose.yml`，通过 Docker Network 接入 Caddy。
*   **隔离性**: 进程级隔离，互不影响。

---

## 2. 实施路线图 (Implementation Roadmap)

### Phase 1: 代码迁移与本地环境 (Code Migration & Local Dev)
1.  **重置 Worker 项目**:
    *   清理原 Fastify 代码。
    *   使用 `@hono/node-server` 和 `hono` 初始化项目。
2.  **核心逻辑迁移**:
    *   移植 `lib/worker` 中的 Guards, Executors, Strategies 到 Hono 中间件/路由。
    *   适配 QStash 接收器 (Receiver)。
3.  **本地环境构建 (Local Dev Loop)**:
    *   **架构**: Next.js (Local) -> QStash (Local/Mock) -> Worker (Local Hono) -> Redis (Local Docker)。
    *   **工具**: 使用 `ngrok` 或 `localtunnel` 暴露本地 Hono 服务，以便与线上/模拟 QStash 通信（如果使用真实 QStash）。或者在开发环境直接 HTTP 调用（绕过 QStash 验证）。
    *   **产出**: `CONTRIBUTING.md` (本地开发指南)。

### Phase 2: 部署与运维文档升级 (Deployment & Ops Docs)
4.  **更新部署指南 (`03_Worker_Setup_Guide.md`)**:
    *   新增 **"多租户服务器配置"** 章节：如何配置 Caddyfile 路由到不同端口/容器。
    *   新增 **"Step-by-Step 发布流程"**: 从 Build 到 Deploy 的标准化步骤。
5.  **低成本监控运维方案**:
    *   **日志**: 推荐部署 **Dozzle** (轻量级 Docker 日志 Web 查看器)，无需复杂的 ELK 栈。
    *   **监控**: 推荐 **UptimeRobot** (免费版) 做存活检测 + 服务器安装 `node_exporter` (可选) 或简单的 Shell 脚本告警。
    *   **自动更新**: 配合 **Watchtower** 实现镜像更新后的自动重启（可选，适合 CI/CD 集成）。

### Phase 3: 最终交付与验收 (Final Delivery)
6.  **代码提交**: 包含完整的 `/worker` 目录和修改后的 `/docs`。
7.  **演示**: 展示本地如何启动整个链路。

---

## 3. 待办事项 (Todo List)

- [ ] **Re-init Worker with Hono**: 删除旧文件，安装 Hono 依赖，建立基础 Server。
- [ ] **Migrate Logic**: 迁移 `handlers.ts` 及相关依赖逻辑到 Hono 路由。
- [ ] **Local Dev Setup**: 配置 `docker-compose.dev.yml` 和本地启动脚本。
- [ ] **Update Docs**: 重写 `03_Worker_Setup_Guide.md`，加入 Caddy 多租户配置和 Dozzle 日志方案。
- [ ] **Verify**: 本地跑通 "提交任务 -> Worker 执行 -> SSE 推送" 流程。
