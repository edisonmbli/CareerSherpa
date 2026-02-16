# HTTP Worker 服务搭建与部署指南 (Setup & Deployment Guide)

## 1. 概述

本指南将指导你如何从零开始搭建 HTTP Worker 服务，涵盖本地开发环境配置、VPS 多租户架构初始化、Docker 部署、CI/CD 流程以及低成本运维监控方案。

---

## 2. 本地开发环境 (Local Development)

请参考单独的 **[04_Local_Dev_Guide.md](./04_Local_Dev_Guide.md)** 文档，其中详细说明了如何使用 Docker Compose (Redis) + QStash Local Mode 搭建与线上架构一致的本地开发闭环。

---

## 3. VPS 架构设计 (Hetzner 多租户模式)

为了在 Hetzner 高性能 VPS 上最大化资源利用率，我们采用 **Caddy + Docker** 的多租户架构。

### 3.1 架构拓扑

- **接入层 (Ingress)**: Caddy (反向代理 + 自动 HTTPS)。
- **应用层 (Apps)**: 多个独立的 Docker Compose Project (e.g., `career-worker`, `project-b-worker`)。
- **网络 (Network)**: Caddy 运行在 Host 网络或通过 Docker Network 与各应用通信。

### 3.2 服务器初始化 (Server Provisioning)

#### Step 1: 基础安全设置

SSH 登录服务器后执行：

```bash
# 1. 更新系统
apt update && apt upgrade -y

# 2. 安装必要工具
apt install -y curl wget git vim unzip ufw htop

# 3. 开启 BBR (优化中美网络连接)
echo "net.core.default_qdisc=fq" >> /etc/sysctl.conf
echo "net.ipv4.tcp_congestion_control=bbr" >> /etc/sysctl.conf
sysctl -p

# 4. 配置防火墙 (仅开放 SSH, HTTP, HTTPS)
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

#### Step 2: 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
systemctl start docker && systemctl enable docker
```

#### Step 3: 安装 Caddy (Docker 方式)

创建 `/opt/caddy` 目录，用于存放 Caddy 配置。

```bash
mkdir -p /opt/caddy
touch /opt/caddy/Caddyfile
```

创建 `/opt/caddy/docker-compose.yml`:

```yaml
version: '3.8'
services:
  caddy:
    image: caddy:alpine
    restart: always
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    network_mode: host # 简单粗暴，直接使用 Host 网络，方便反代本地端口

volumes:
  caddy_data:
  caddy_config:
```

---

## 4. 部署 Worker 服务

### 4.1 准备 Docker 镜像

在项目根目录创建 `Dockerfile` (用于 Worker):

```dockerfile
# 使用轻量级 Node 镜像
FROM node:20-alpine AS base

# 1. 依赖安装层
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
# 假设 worker 也是 monorepo 的一部分，可能需要复制根目录配置
# 这里简化为独立构建，实际可能需要 Turborepo 的 prune 支持
RUN npm install -g pnpm && pnpm i --frozen-lockfile

# 2. 构建层
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm install -g pnpm && pnpm --filter worker build

# 3. 运行层
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/worker/package.json ./package.json

USER nextjs
EXPOSE 8080
CMD ["node", "dist/src/index.js"]
```

### 4.2 配置应用 (Docker Compose)

在服务器创建 `/opt/career-worker`：

**`docker-compose.yml`**:

```yaml
version: '3'
services:
  worker:
    image: ghcr.io/your-username/career-worker:latest # 需要先推送到 GHCR
    restart: always
    ports:
      - '8081:8080' # 映射到宿主机 8081，Caddy 会反代这个端口
    env_file: .env.production
    # 开启多副本以利用多核 CPU (Node.js 单线程限制)
    deploy:
      replicas: 2
    logging:
      driver: 'json-file'
      options:
        max-size: '10m'
        max-file: '3'
```

### 4.3 深入理解 Worker 并发 (Concurrency Deep Dive)

很多开发者对 Node.js 的并发模型有误解，认为需要配置“线程池大小”。实际上：

1.  **Hono/Node.js 是单线程异步非阻塞的 (Single Threaded Event Loop)**:
    - Node.js 主线程是一个 Event Loop，它不阻塞等待 I/O (网络请求、数据库查询)。
    - 当 Worker 执行 `await llm.generate()` 时，主线程**释放 CPU** 去处理下一个 HTTP 请求，直到 LLM 返回数据。
    - 因此，**单个容器实例就足以支撑极高的 I/O 并发** (成千上万 QPS)，只要 CPU 不被计算任务占满。

2.  **真正的瓶颈在哪里？**:
    - **逻辑并发限制**: 我们通过 Redis 锁 (`guardModel`, `guardUser`) 人为限制了并发，防止把 LLM Provider 冲垮。这在 `.env` 中配置 (`MAX_DS_CHAT_PAID` 等)。
    - **CPU 密集型任务**: 如果你的 Worker 需要做大量的 JSON 解析、加密计算或图片处理，单线程的 Node.js 才会成为瓶颈（CPU 100%）。
    - **解决方案**: 利用 VPS 的多核 CPU。

3.  **配置建议**:
    - **Queue/Backpressure**: 在 `.env` 中设置 `QUEUE_MAX_PAID` 和 `QUEUE_MAX_FREE`，控制 QStash 侧的准入。
    - **Execution**: 在 `.env` 中设置 `MAX_DS_*` 等模型级限制，控制 LLM 调用频率。
    - **VPS Resources (PM2/Docker)**:
      - 如果发现 CPU 占用率高，增加 `docker-compose.yml` 中的 `deploy.replicas: N` (N = CPU 核数)。
      - Docker Swarm 或 K8s 会自动负载均衡流量到这 N 个容器。
      - 对于单机 Docker Compose，Caddy 会自动轮询转发到 `replicas` 实例。

### 4.4 配置域名 (Caddy)

修改 `/opt/caddy/Caddyfile`:

```caddyfile
worker.careershaper.com {
    reverse_proxy localhost:8081
}

# 未来可以加更多项目
# project-b.com {
#     reverse_proxy localhost:8082
# }
```

重启 Caddy: `docker compose -f /opt/caddy/docker-compose.yml restart`

---

## 5. Step-by-Step 发布流程 (Deployment)

### Step 1: 推送代码

```bash
git push origin main
```

### Step 2: 构建镜像 (GitHub Actions 推荐)

建议配置 GitHub Actions 自动构建并推送到 GHCR。
如果是手动：

```bash
docker build -f worker/Dockerfile -t ghcr.io/user/worker:latest .
docker push ghcr.io/user/worker:latest
```

### Step 3: 服务器更新

SSH 登录服务器：

```bash
cd /opt/career-worker
docker compose pull
docker compose up -d
```

Caddy 会自动处理流量切换，通常只有毫秒级中断。

---

## 6. 低成本监控与运维 (Ops)

针对个人开发者/小团队，我们不需要复杂的 ELK 或 Prometheus 栈，推荐以下 **"穷人版" 三件套**：

### 6.1 日志查看：Dozzle

**Dozzle** 是一个超轻量级的 Docker 日志实时查看器 (Web UI)。
在 `/opt/ops/docker-compose.yml` 中添加：

```yaml
version: '3'
services:
  dozzle:
    image: amir20/dozzle:latest
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    ports:
      - '8888:8080'
    # 建议加上 Basic Auth 保护，或者通过 Caddy 加 Auth
```

访问 `http://your-ip:8888` 即可实时查看所有容器日志，支持搜索和过滤。

### 6.2 存活监控：UptimeRobot

使用 [UptimeRobot](https://uptimerobot.com/) (免费版足够)：

1.  创建一个 HTTP Monitor。
2.  URL 填 `https://worker.careershaper.com/health`。
3.  设置频率为 5 分钟。
4.  绑定邮箱或 App 推送。
    一旦 Worker 挂了或 Caddy 挂了，你会立刻收到通知。

### 6.3 资源监控：Glances / Netdata

如果想看 CPU/内存占用：

```bash
# 安装 Glances (Python)
pip install glances
# 运行
glances
```

或者直接用 `htop` 和 `docker stats`。对于单机 VPS，这通常足够了。

### 6.4 自动更新：Watchtower (可选)

如果你希望镜像更新后自动部署，可以部署 **Watchtower**：

```yaml
watchtower:
  image: containrrr/watchtower
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  command: --interval 300 # 每 5 分钟检查一次更新
```

这样你只需要 `docker push`，服务器就会自动更新（慎用，生产环境建议手动触发）。
