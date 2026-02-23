# CareerShaper 本地开发与调试指南 (Local Development Guide)

## 1. 概述

为了在本地最大程度模拟线上架构，我们采用以下方案：

- **Next.js (Producer)**: 运行在 `http://localhost:3000`
- **QStash (Broker)**: 使用 QStash Local Mode (CLI)，模拟线上 QStash 行为。
- **Worker (Consumer)**: 运行在 `http://localhost:8081` (Hono)，避免与 QStash Local (8080) 端口冲突。
- **Redis (State)**: 使用本地 Redis (Docker)。

---

## 2. 准备工作

### 2.1 启动本地基础设施 (Redis & QStash)

在项目根目录创建 `docker-compose.dev.yml` (如果尚未创建) 并启动：

```yaml
version: '3.8'
services:
  # 本地 Redis
  redis:
    image: redis:alpine
    ports:
      - '6379:6379'
    command: redis-server --appendonly yes

  # 本地 QStash (QStash Local Mode)
  # QStash 官方暂未提供公开 Docker 镜像，通常使用 CLI 启动
  # 但为了方便管理，我们这里假设你使用 CLI 启动 (见下文)
```

启动 Redis：

```bash
docker compose -f docker-compose.dev.yml up -d
```

### 2.2 启动 QStash Local Mode

使用 QStash 官方 CLI 启动本地模拟器：

```bash
npx @upstash/qstash-cli@latest dev
```

- 这将在 `http://localhost:8080` 启动 QStash 服务。
- **注意**: 终端会输出 `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`。请复制这些值！

---

## 3. 配置环境变量

### 3.1 Next.js (`.env.local`)

修改根目录下的 `.env.local`，使其指向本地 QStash。

```bash
# Redis (本地)
UPSTASH_REDIS_REST_URL=redis://localhost:6379

# QStash (本地模拟器)
QSTASH_URL=http://localhost:8080
QSTASH_TOKEN=ey... # 填入 CLI 输出的 Token

# 关键配置：告诉 Producer 将任务发往何处
# QStash Local Mode 会将请求转发到这个地址
# 由于 Worker 运行在本地 8081，所以这里填 Worker 地址
WORKER_BASE_URL=http://127.0.0.1:8081
```

### 3.2 Worker (`worker/.env`)

在 `worker` 目录下创建 `.env` 文件：

```bash
NODE_ENV=development
PORT=8081  # 修改为 8081，避开 QStash 的 8080

# Redis (与 Next.js 保持一致)
UPSTASH_REDIS_REST_URL=redis://localhost:6379

QSTASH_CURRENT_SIGNING_KEY=sig_...
QSTASH_NEXT_SIGNING_KEY=sig_...
QSTASH_SKIP_VERIFY=true

# CORS
CORS_ORIGIN=http://localhost:3000

# AI Keys (复用根目录配置或单独配置)
DEEPSEEK_API_KEY=...
GEMINI_API_KEY=...
```

---

## 4. 启动服务

### 4.1 启动 Worker

打开一个新的终端窗口：

```bash
cd worker
pnpm install
pnpm dev
```

此时 Worker 应运行在 `http://localhost:8081`。

### 4.2 启动 Next.js

打开另一个终端窗口：

```bash
# 根目录下
pnpm dev
```

Next.js 运行在 `http://localhost:3000`。

---

## 5. 联调验证流程

1.  **访问 Web UI**: 打开 `http://localhost:3000`。
2.  **触发任务**: 在 Workbench 中提交一个 Resume Optimization 或 Job Match 任务。
3.  **观察日志**:
    - **Next.js 终端**: 应该看到 `[Producer] Enqueueing task to http://127.0.0.1:8081/api/execute/...`。
    - **QStash CLI 终端**: 应该看到接收到消息并转发给 Worker。
    - **Worker 终端**: 应该看到 Hono 接收到请求 (POST /api/execute/...)。
    - **Web UI**: 应该通过 SSE 收到实时进度更新。

## 6. 常见问题排查

- **端口冲突**: 确保 QStash 占用 8080，Worker 占用 8081。如果端口被占用，请修改 `worker/.env` 中的 `PORT`，并同步更新 `.env.local` 的 `WORKER_BASE_URL`。
- **QStash 401 Unauthorized**: 检查 `.env.local` 中的 `QSTASH_TOKEN` 是否与 CLI 输出的一致。每次重启 CLI，Token 可能会变！
- **Worker 401 Invalid Signature**: 检查 `worker/.env` 中的 `QSTASH_CURRENT_SIGNING_KEY` 是否与 CLI 输出的一致。
- **网络不通**: 如果 QStash 报错 "Connection refused"，尝试将 `WORKER_BASE_URL` 改为 `http://host.docker.internal:8081` (如果 QStash 在 Docker 中) 或 `http://127.0.0.1:8081` (如果 QStash 是本机进程)。通常本机进程间使用 `127.0.0.1` 即可。
