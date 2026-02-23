# CareerShaper 云服务器采购指南 (Cloud Server Procurement Guide)

## 1. 核心需求分析
为了支持 Gemini 和 Deepseek API 的双调用，以及未来的并发扩容需求，服务器选型需满足以下硬性指标：
*   **地理位置**: **必须为美国地区 (US Region)**，以确保 Gemini/Deepseek 的 API 访问合规性及低延迟。
*   **网络质量**: 拥有独立的 IPv4 地址，且 IP 未被各大 AI 厂商拉黑。
*   **资源配置**: 初期至少 1 vCPU / 2GB RAM，以运行 Node.js Worker 和 Docker。
*   **扩展性**: 支持 Docker 部署，方便后续横向扩容。

---

## 2. 推荐方案 (按性价比排序)

### 方案 A: 极致性价比 (MVP / 个人开发者首选)
**服务商**: **RackNerd** 或 **CloudCone**
*   **定位**: 廉价 VPS 市场的领导者，稳定性尚可，适合起步阶段。
*   **推荐配置**:
    *   CPU: 2 vCPU
    *   RAM: 2GB - 3GB
    *   Storage: 30GB+ SSD
    *   Bandwidth: 2TB+ / Month
*   **价格预估**: **$20 - $30 / 年** (是的，你没看错，是一年)。
*   **购买渠道**: 通常需要关注其“促销活动”页面 (如新年促销、黑五促销)。
*   **优缺点**:
    *   ✅ 价格极低，成本几乎可以忽略不计。
    *   ✅ 美国多机房可选 (Los Angeles, San Jose, New York 等)。
    *   ❌ 性能一般 (CPU 往往是共享的)，高峰期可能由波动。
    *   ❌ 客服响应较慢。

### 方案 B: 性能与稳定均衡 (生产环境推荐)
**服务商**: **Hetzner**
*   **定位**: 欧洲顶级服务商，近年在美国 (Ashburn, VA 和 Hillsboro, OR) 开设了数据中心。
*   **推荐配置 (Cloud CPX11)**:
    *   CPU: 2 vCPU (AMD EPYC)
    *   RAM: 2GB
    *   Storage: 40GB NVMe
    *   Traffic: 20TB / Month
*   **价格预估**: **~€4.5 / 月** (约 $5/月)。
*   **优缺点**:
    *   ✅ **性能极强**，CPU 不超售，磁盘 I/O 极快。
    *   ✅ 计费灵活 (按小时计费)，随时可以删除重建。
    *   ✅ 德国大厂，稳定性有保障。
    *   ❌ 注册账号可能需要身份验证 (KYC)，门槛稍高。

### 方案 C: 免费“白嫖” (运气流)
**服务商**: **Oracle Cloud (甲骨文云)**
*   **定位**: 业界最慷慨的免费层。
*   **Always Free 配置**:
    *   CPU: 4 vCPU (ARM Ampere)
    *   RAM: 24GB (!!!)
    *   Storage: 200GB
*   **价格**: **$0 / 永久**。
*   **优缺点**:
    *   ✅ 配置极其豪华，甚至能跑本地小模型。
    *   ❌ **注册极难**：中国信用卡几乎必挂，玄学注册。
    *   ❌ 资源紧缺：开通实例可能需要脚本抢。
    *   ❌ 封号风险：偶尔会有无理由封号的传闻。

---

## 3. 选型建议与决策路径

1.  **如果你追求稳定且不想折腾注册**:
    *   直接选 **Hetzner (US Ashburn)**。每月 $5 的成本完全可控，且性能足够支撑早期的 10-100 并发。

2.  **如果你对价格极其敏感 (例如验证想法阶段)**:
    *   去 **RackNerd** 找一个年付 $20 左右的套餐。哪怕项目跑不起来，这台机器也可以用来挂博客、跑脚本，完全不亏。

3.  **关于 IP 的特别提示**:
    *   购买后，第一时间通过 SSH 登录，并在服务器上 `curl https://generativelanguage.googleapis.com` (Gemini) 测试连通性。如果 IP 被封，立即申请退款或更换 IP。

## 4. 后续扩容路线图
*   **阶段 0-1**: 单台 RackNerd/Hetzner VPS。使用 Docker Compose 部署 Worker。
*   **阶段 1-10**: 垂直升级 VPS 配置 (例如升级到 4vCPU/8GB)。
*   **阶段 10-100**:
    *   购买多台 VPS。
    *   使用 **Nginx** 或 **Cloudflare Load Balancer** 在前端做流量分发。
    *   Worker 节点无状态，可随意增加。

## 5. 采购后的第一步
一旦服务器到位，请执行以下初始化操作 (在后续的 Setup Guide 中会详细说明):
1.  更新系统 (`apt update && apt upgrade`)。
2.  开启 BBR 拥塞控制 (优化中美网络连接)。
3.  安装 Docker 和 Docker Compose。
4.  配置 SSH Key 登录，禁用密码登录 (安全第一)。
