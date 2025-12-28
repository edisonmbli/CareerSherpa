# Project Specification for 「Job Assistant AI」

## 1.背景

人们在求职过程中，会面临一个很具体的痛点：** 面向自己心仪的职位，如何定制化突出个人价值&匹配度，提高求职效率 **

- 一份通用的简历模版，往往因为要面面俱到，而失去对特定岗位的优势匹配
- 而招聘者每天要浏览大量的求职简历/消息，如何在短时间内筛选出最符合岗位要求的候选人，也是一个挑战

## 2.目标

做求职路上“最后一公里”的助推器：

- 前提假设：求职者对自身工作履历已有复盘、手上有一份通用简历
- 核心价值：
  - 基于求职者的背景、意向岗位，生成匹配度分析、以及适用于求职平台上的“毛遂自荐”私信话术
  - 定制化个人简历，突出个人优势、匹配岗位要求
  - 定制化面试要点清单，帮助求职者做好事前准备&演练

## 3.商业化定位

在盈亏平衡的前提下，提供普惠性质的服务，帮助更多的求职者提升求职效率，包括：

- 面向 C 端用户：线上产品提供次数购买模式，定价贴着成本走（排除大模型 API、服务器等支出）
- 面向产品/技术同行：通过 build-in-public 的形式，分享项目中的技术实现、使用案例、优化经验等
- 面向开发者：产品上线且稳定运营后，会将项目代码进一步开源，方便开发者 clone 至本地后，配置个人 API Key 使用

### 计费与并发策略（更新）

- 免费/无配额用户：使用免费模型（Text：GLM‑4.5‑Flash；Vision：GLM‑4.1v‑thinking‑Flash），受严格并发与队列限制（text 并发=2、vision 并发=5）。
- 付费/有配额用户：使用高级模型（Text：DeepSeek v3.2 / GLM‑4.5；Vision：GLM‑4.1v‑thinking‑Flash），按购买配额与可并发 worker 数执行。
- 队列与取消：建立免费/付费两个队列；任务创建后不可更换队列；未执行前可取消。
- 不赠送初始配额：取消“新用户赠送配额”，免费队列即用户的试用路径；付费队列按购买配额结算。

## 4.需求分析

1）项目的本质出发点，就是把以下业务场景，实现产品化，给求职者提供极具性价比的解决方案

- 参考：[案例分析](docs/求职定制化_case_analysis.md)

2）功能需求

### 系统功能视角

#### 网站整体

- 首页为高效清晰的 landing page，引导用户注册/登录
- 集成 Neon Auth 认证系统；web app 内的所有有效操作、数据收集工作，均依赖于用户登录态
- 支持国际化，包括但不限于中文、英文

#### 支付系统

- 支持为新注册用户赠送初始次数（如 3 次）
- 集成 Stripe 支付系统，支持用户购买次数服务
- 支持用户查询已购买次数、剩余次数
- 支持用户退款（必要时）

#### 工作台

- 支持用户上传信息，包括但不限于：
  - **个人通用简历**，以及**个人详细履历**（联系方式、教育背景、工作经历、项目经历、证书、技能...）
  - **意向岗位描述**（岗位职责描述、能力经验要求、岗位类型...）
- 集成大模型能力，包括但不限于：
  - 基于用户上传的个人简历、意向岗位描述，生成匹配度分析、以及适用于求职平台上的“毛遂自荐”私信话术（服务次数-1）
  - 定制化个人简历，突出个人优势、匹配岗位要求（服务次数-1）
  - 定制化面试要点清单，帮助求职者做好事前准备&演练（服务次数-1）

#### 个人主页

- 支持用户查看自己的个人信息、已购买次数、剩余次数、最近一次购买记录等
- 支持用户在个人主页上，查看自己的所有定制化服务记录（包括匹配度分析、定制化简历、定制化面试要点清单）
- 最多支持保存 1 份个人详细履历、3 份个人通用简历，超出部分需要用户手动删除历史记录
- 原则上对于用户付费购买的岗位定制化服务不作数量限制；但为了系统的稳定性和用户体验，每个账户最多支持 50 次服务&记录存档（在购买服务环节，也需要作同样的前置校验、拦截）

#### 简历微调工具页

- 为了给用户提供更便捷的服务，不占用服务次数，支持加载指定的**个人定制化简历**（历史生成），用户可以在该页面对简历进行微调（如添加/删除/修改个人项目经历、工作经历、证书、技能等）
- 考虑设计为左右布局，左侧为 markdown 格式支持用户快速微调，右侧为预览区域可直接导出为 PDF 格式，方便用户在求职平台上上传

### 用户体验旅程视角

1. 注册流程简单明了：**用户**只需输入邮箱、密码，或者使用社交媒体账号（如 Google、Facebook、微信等），即可完成新账号注册/登录
2. **用户**登录后，即从 landing page 跳转至个人工作台；这是 web app 的主要工作页面
3. **用户**上传个人信息，包括两个条目类型，支持新增上传或从历史记录中选择已上传的信息

   - [Must] 个人通用简历
   - [Optional] 个人详细履历 (虽非必填，但强烈建议用户提供更多个人背景信息，这里需要有产品能力的引导)

4. **用户**上传意向岗位描述，包括两个条目类型：

   - [Must] 岗位职责描述、能力经验要求，从求职平台直接 Ctrl+C/V 粘贴到对应输入框
   - [Optional] 岗位周边辅助信息（非必填，如用户从其它渠道了解到该岗位相关的其它信息，也可作补充录入）

5. **系统** Pre-check，包括：

   - 保存用户新上传的个人通用简历、个人详细履历（如用户选择加载历史记录，则此步骤可 skip）
   - 缓存用户提供的岗位信息
   - 通过正则化匹配、基础字数要求等门槛检查，快速校验用户上传的个人信息、岗位信息是否充分、是否符合要求
     - 如果校验不通过，**系统**需要提示用户先完善，避免后续服务出现不可控、不达预期的低质量输出
     - 如果校验通过，**系统**会为此次服务先创建一个唯一的服务 ID，用于后续的服务记录存档；该服务 ID 关联用户个人信息（详细履历 ID、通用简历 ID），为用户上传的 raw 岗位描述信息自动创建 ID 并关联

6. **用户**触发定制化服务，**系统**会根据用户上传的个人信息、岗位信息，调用大模型能力，生成符合要求的服务输出：

   1. a.匹配度分析->b.定制化简历->c.面试要点清单，属于层层递进的关系，用户可以按需选择、逐层解锁（这里是根据实际业务场景而设计的，因为用户在求职过程中，以上服务需求呈现倒排金字塔形式，把这块逻辑做得足够灵活，一方面不会浪费用户的钱，一方面也可以减少服务器压力）
   2. 每层服务解锁，均触发服务次数-1；如果用户服务次数不足，**系统**会提示用户先购买次数
      a.匹配度分析：基于用户上传的个人简历、岗位描述，生成匹配度分析，包括但不限于：1）个人简历与岗位描述的匹配度；2）个人项目经历、工作经历、证书、技能等与岗位要求的匹配度；3）定制化的“毛遂自荐”私信话术
      b.定制化简历：基于用户上传的个人通用简历、岗位描述、匹配度分析结果，定制化生成符合岗位要求的个人简历
      c.定制化面试要点清单：基于用户上传的个人通用简历、岗位描述、匹配度分析结果、定制化个人简历，定制化生成符合岗位要求的自我介绍话术、面试要点清单

7. 在单次服务结束后，**用户**可以在个人主页上，查看自己的所有定制化服务记录

   - 以服务 id 为单位，可以查看当前服务深度，包括匹配度分析、定制化简历、定制化面试要点清单
   - 未执行的定制化任务，可以选择继续推进（用户触发服务次数-1）
   - 已执行的定制化任务，可以选择回看（加载历史记录）

8. 针对个别定制化的简历、作微调，是高频场景，因此**用户**可以选择指定已生成的定制化简历，通过工具进行 markdown 修改->预览->导出 PDF（不涉及大模型能力交互）

3）非功能需求

- 为了支持用户在不同设备上使用，**系统**需要实现 Web App 端与移动端的交互，确保用户在不同平台上都能正常使用

4）详细需求分析

**用户画像与核心场景**

- 应届/转岗：简历与 JD 差距大，需快速匹配与模板引导
- 资深候选人：已有通用简历，需“外科手术式”定制与面试要点
- 高频投递用户：批量岗位匹配、成本控制、历史复用
- 目标场景：上传简历/JD→ 匹配度分析 → 定制简历 → 面试清单 → 微调/导出 → 历史回看

**关键用例与流程**

- 上传信息：PDF/DOC/MD 简历与详细履历，JD 粘贴与补充信息；支持从历史选择
- 预检校验：结构完整性、字数下限、要点覆盖率、语言一致性；校验失败给出缺失项提示与示例
- 服务 ID 与分层解锁：生成`service_id`，按 a 匹配 →b 简历 →c 面试逐层解锁与扣次；支持中断续跑与复用缓存
- 结果产出与存档：每层产出结构化结果与可视化预览，版本化保存，可回滚与对比
- 微调工具：Markdown 左编右预览，导出 PDF；不计次数，支持模板/片段库复用

**功能需求分级（MoSCoW）**

- Must
  - 认证与配额：登录、免费/付费双队列与配额、Stripe 购买/退款、剩余次数校验与前置拦截
  - 简历解析与结构化：提取分段与`span_id`，生成可寻址 JSON（Header/Summary/Experience[]/Projects[]/Skills）
  - JD 解析：职责/要求结构化、关键词抽取与向量化检索
  - 匹配度分析：相似度评分、缺口清单、优势放大点、求职平台私信话术
  - 定制化简历：基于“编辑指令/模板骨架”，应用侧合成；版本对比与回退
  - 面试要点清单：自我介绍、多轮问答要点、STAR 案例、反问建议
  - 历史记录与续跑：按`service_id`展示当前深度，支持继续解锁或回看
  - 成本守护：请求去重（幂等键）、结果缓存、速率限制、并发控制、失败重试与降级
- Should
  - RAG“求职宝典”：按领域/语言维护文档，向量检索辅助生成；运营后台增删改
  - 质量评估：LLM-as-Judge + 规则校验（事实一致性、语言风格、长度限制）
  - 多语言：中英互译、界面 i18n；输出语言与输入一致
- Could
  - 浏览器扩展：在招聘网站一键抓取 JD 并创建`service_id`
  - 模板库：岗位/行业模板与高频问答片段库

**非功能需求与预算**

- 时延目标：匹配度 ≤8s、简历指令 ≤12s、面试清单 ≤12s（95%分位）
- 成本目标：单层服务输出 token≤1.2k；MVP 人均成本 ≤¥1.5/层（含向量/存储）
- 可用性与可靠性：失败重试（指数退避 ≤2 次）、幂等提交、SSE 流式返回、灰度开关与特性标志
- 安全与合规：数据最小化、敏感字段加密、访问审计、数据保留与删除策略（用户主动删除立即生效）

**输入归一化与摘要（Step 0）**

- 问题：用户上传的通用简历/详细履历/JD 结构与颗粒不一致，直接送入 LLM 易导致质量与成本失控
- 方案：在 a 步之前，用轻量模型做“归一化摘要+结构化统一”：
  - 简历 Summary：提取 Header/Summary/Experience[]/Projects[]/Skills 的要点、量化结果与时间线，生成 `resume_summary_json`（与原始 `structured_json` 并列保存）
  - 详细履历 Summary：将长文故事拆成“项目/职责/成果”要点列表，生成 `detailed_summary_json`（可选，无则跳过）
  - JD Summary：抽取职责/必备技能/加分项/关键名词，生成 `jd_summary_json`
  - 以上三个 summary 体量小、语义稳定，可直接拼入各任务 Prompt 的上下文

**上下文组装与 RAG（递进结构）**

- a 匹配度分析：a 任务描述 + 简历 summary + 详细履历 summary(可选) + JD summary + 【RAG】工作匹配分析常见技巧(top‑k)
- b 简历定制化：b 任务描述 + 简历/详细履历/JD 三个 summary + a 步分析结果 + 【RAG】简历撰写规范(top‑k)
- c 面试要点清单：c 任务描述 + 三个 summary + a 步分析 + b 步的简历改写建议（Diff/Highlights）+ 【RAG】面试准备要点(top‑k)
- RAG 不直接塞整本“求职宝典”，仅检索最相关片段；上下文始终保持短小和可审计

**评分与规则（仅 a 步）**

- 关键词覆盖率：JD 要求中的关键名词在简历/详细履历中的命中比（可权重）
- 经验映射：职责 → 项目经历的映射条数与近三年相关度加权
- 风格与风险：语言一致性/长度/量化程度/禁用夸大与编造；失败降级为要点清单

**存储与复用**

- 原文 raw_text 与 `*_summary_json` 并列保存，支持追溯；每次任务写入 `token_usage_logs` 统计输入/输出 tokens 与成本
- 短周期（15–60min）结果缓存与幂等键，避免重复调用；`previous_response_id` 用于复用 a 步的思考上下文

**成功指标（MVP）**

- 激活率：上传简历与 JD 完成率 ≥60%
- 转化率：从匹配度 → 简历 → 面试分层转化 ≥35%
- 复用率：历史续跑占比 ≥25%；缓存命中率 ≥50%
- 质量主观分：用户对每层“满意/一般/不满意”，满意率 ≥70%
- 成本：平均每次服务 token 下降 ≥40%（相较全文生成）

**依赖与约束**

- 技术栈：Next.js + Tailwind + shadcn/ui，部署 Vercel；Neon Postgres + pgvector；Clerk、Stripe；RAG：LlamaIndex；工作流：LangChain
- 模型：推理 DeepSeek v3.2、嵌入 OpenAI `text-embedding-3-small`；支持`previous_response_id`上下文复用与结构化输出
- 约束：优先中文与英文；移动端适配与 Web 为主，不做原生 App（MVP）

**风险与缓解**

- 输入质量差：预检强约束+示例提示，必要时引导补全
- 幻觉与编造：只允许引用上下文事实；新增信息以“待填变量清单”呈现，需用户确认
- 成本失控：层级化解锁、强缓存、并行+分片、模板化输出；超限自动降级为摘要/片段级生成
- 供应商故障：多模型/多区域备选，错误分级与自动切换；关键路径本地兜底模板

**验收标准（每层）**

- 匹配度分析：给出总分与 3–5 条改进建议；包含可直接投递的私信话术；长度与格式受控
- 定制化简历：仅输出结构化编辑指令与模板；应用侧合成后可回滚；差异高亮与版本化
- 面试要点清单：包含自我介绍、10–15 条问答要点与案例；可导出 Markdown/PDF

**边界与不做项（MVP）**

- 不做：自动投递、与第三方 ATS 深度双向同步、原生移动端、社交平台私聊自动化
- 暂不做：团队协作、多角色审批流、企业版批量管理

## 5.方案设计

### 核心设计要点

1. 三层结构：用户 id - 服务记录 id - 定制化任务 id

- 用户 id 作为唯一标识，用于关联用户个人信息、服务记录等
- 服务记录 id 作为唯一标识，用于关联服务记录、定制化任务进展
- 定制化任务 id 作为唯一标识，用于关联具体的定制化任务

2. 用户上传的通用简历是基础出发点，后续的定制任务尽可能围绕它来演进：一方面避免过度的改动让质量出现明显跳变，另一方面也可以尽量节省 LLM token 消耗；参考：[把简历变成可“打补丁”的文档](docs/把简历变成可“打补丁”的文档.md)

3. 过程中的大模型调用结果，需要尽可能缓存、落表，避免重复调用大模型

4. 为了让定制化任务的输出质量更符合预期，我会从网上收集一些求职各环节相关的经验、技巧、案例，提炼成 RAG 知识库“求职宝典”，用于辅助大模型生成定制化任务的输出

5. 流程示意图，参考：[求职定制化流程示意图](docs/求职定制化流程示意图.png)

### 架构/技术栈

1. 前/后端：Next.js + Tailwind CSS + shadcn/ui，部署到 Vercel
2. 认证服务：Neon Auth
3. 数据库服务：Neon PostgreSQL，启用 pgvector 用于向量存储
4. 数据访问层：Prisma ORM + 严格的 Data Access Layer（DAL），统一管理所有数据库读写与事务。
5. 后端范式：Server Actions 优先，API 路由作为薄适配层（仅参数校验与调用转发）。
6. 大模型相关服务：
   - 推理模型：深度 DeepSeek v3.2、 GLM 4.5，轻度 GLM‑4.5‑Flash
   - 视觉模型：GLM‑4.1v‑thinking‑Flash
   - 嵌入模型：GLM embedding‑3
   - RAG：LlamaIndex + pgvector
   - 工作流：LangChain（抽象模型切换、队列管控与链式编排）

### 详细方案设计

**架构总览（MVP）**

- 前端：Next.js App Router + Tailwind + shadcn/ui；页面包含 Landing、登录后工作台、历史记录详情、简历微调与导出
- 后端：Next.js Server Actions/Edge/Node 路由（Vercel Functions）：以 Server Actions 为主，API 路由仅保留兼容与外部调用路径。职责包含认证与配额、上传解析、预检、服务编排、LLM 推理、RAG 检索、版本化存档与回退
- 模块化拆分：validation、orchestration、storage（DAL）、llm（providers/pool/prompts）、cache（幂等与结果缓存）。
- 并发与队列：按模型并发上限初始化 WorkerPool；免费/付费两个队列；任务取消与监控
- 数据层：Neon Postgres（pgvector）做业务与向量存储；对象存储用于原始附件（简历 PDF 等）
- 缓存层：Redis（如 Upstash）做速率限制、幂等请求去重、短 TTL 结果缓存与并发保护
- 模型层：DeepSeek v3.2（重度推理）、GLM 4.5 Flash（轻度推理）、GLM embedding-3（嵌入）；结构化输出强制 JSON Schema
- 约束声明：MVP 不包含“Could”项（浏览器扩展、模板库）

**模块划分与职责**

- 认证与配额（Auth & Quota）：登录与付费配额校验；免费/付费队列前置拦截；账户上限保护（如 50 次存档）。
- 上传与解析（Upload & Parse）：接受 PDF/DOC/MD；抽取结构化简历 JSON；支持从历史选择
- Input Normalizer：生成 `resume_summary_json`、`detailed_summary_json`（copy 模式）、`jd_summary_json`。
- Context Assembler：按任务(a/b/c)拼装最小上下文（三个 summary + 前序结果 + RAG top‑k），控制长度与语言一致性
- Heuristic Scorer：a 步的关键词覆盖率/经验映射/风格校验等规则评分；与模型评分合成总分
- Token Meter：统一记录 `input_tokens/output_tokens/cost` 并入库；暴露到日志与告警
- 预检与指引（Pre-check）：校验必填项、长度、语言一致性与要点覆盖率；失败返回缺失清单与示例；通过则创建 `service_id` 并缓存原始 JD
- 服务编排（Orchestrator）：分层解锁 a 匹配 →b 简历 →c 面试；每次扣次-1；支持中断续跑与历史回看
- 匹配度分析（Match Analysis）：评分、缺口清单、优势放大点、私信话术；结果短文本与要点化
- 定制化简历（Resume Customize）：仅输出“编辑指令/模板骨架”，应用侧合成最终文本；支持差异高亮与版本回退
- 面试要点（Interview Prep）：自我介绍模板 + 10–15 条问答要点（含 STAR 示例）；可导出为 Markdown/PDF
- RAG 知识库：按领域与语言维护“求职宝典”；离线分块、嵌入入库；在线检索 `topK` 小片段辅助生成
- 历史与版本化（History/Versioning）：按 `service_id` 展示深度；每层输出保存版本；支持回滚与对比
- 简历微调工具（Editor）：左侧 Markdown、右侧预览与导出 PDF；不计次数；支持片段级替换与合并

**提示体系（Prompt Architecture，新增）**

- 模板结构：统一采用四段式
  - Identity：明确模型身份与角色边界
  - Instructions：任务目标、约束、格式与长度控制
  - Context：拼装最小必要上下文（summary/RAG/前序结果），声明语言一致性
  - user_message：用户输入或系统触发的指令/变量
- 文件拆分（M1.1 目标）：为预任务建立独立模板文件，便于针对性迭代
  - `lib/prompts/summary.resume.ts`
  - `lib/prompts/summary.detailed_copy.ts`（严格“copy 模式”，全量字段 JSON 抽取）
  - `lib/prompts/summary.jd.ts`
- 解析与校验：所有输出强制 JSON Schema 校验；失败自动降级为要点列表；记录 tokens 与成本。

**端到端数据流（更新）**

1. Auth&Quota：登录与剩余次数校验；不足提示购买
2. Create Service：用户粘贴 JD→ 生成 `service_id`，绑定简历 + 详细履历 + JD
   / Normalize：触发归一化，生成三类 summary 并落库（回写相关数据表）；可命中缓存跳过
   / 成本保护：
   - 通用简历、详细履历、JD 描述，先采用轻度推理模型 GLM-4.5-Flash 看效果如何？（该模型调用免费）
   - pending 服务（定义为未产出任何扣次的 service_id）> 3 条，则阻塞后续服务创建，提示用户“当前账户已超量使用，建议先完成已创建服务”
3. Match(a)：
   / Context Assembler 组装最小上下文（summary + RAG）→ LLM 输出结构化分析；
   / Heuristic Scorer 计算规则分并合成总分；写库与缓存
4. Customize(b)：输入为 a 步结果 + 三个 summary + RAG；仅输出 EditPlan(JSON)，应用侧合成成品；保存版本与 Diff
5. Interview(c)：输入为 a/b 步结果 + 三个 summary + RAG；输出 Checklist；保存版本
6. History：按 `service_id` 展示深度与版本；支持续跑与回看

**Prompt 模板层（Template‑1/2/3）**

- Template‑1（a）：评分维度、优势/缺口、私信话术；附“禁止编造/长度上限”的硬规则
- Template‑2（b）：只允许 `EditPlan` 结构；不可输出全文；指令类型限定 `rewrite/insert_after/delete/move`
- Template‑3（c）：分组（通用/岗位/追问）要点；每条限长；必须可导出
- 输出控制：`max_output_tokens` 分层控制（a≤900，b≤1200，c≤1200）；必要处使用 `stop` 序列与模板变量

**API 契约（MVP）**

- POST `/api/upload/resume`：body{file|text, lang} → {resume_id}
- POST `/api/upload/jd`：body{text, lang} → {job_id}
- POST `/api/service/create`：body{resume_id, job_id} → {service_id}
- POST `/api/analysis/match`：body{service_id} → {analysis_id, summary, score, highlights[], gaps[], dm_script}
- POST `/api/resume/customize`：body{service_id, targets[]} → {plan_id, edit_plan}
- POST `/api/interview/checklist`：body{service_id} → {checklist_id, intro, qa_items[]}
- GET `/api/service/:id`：返回服务进度、各层版本与可操作项
- RAG 管理：POST `/api/rag/documents`、POST `/api/rag/query`（领域、语言、分块大小、重叠、topK、minScore）

**缓存与成本控制**

- 幂等键：`hash(normalized_body + model + step)`；若命中直接返回；短 TTL 15–60min
- 输出缓存：a/b/c 各自缓存；Key 包含 `service_id`、模型与参数；命中率目标 ≥50%
- 上下文复用：`previous_response_id` 存档；b/c 复用 a 的思考上下文
- 向量去重：同内容不重复嵌入；指纹包含`lang+domain+sha256(text)`
- 并发保护：用户级并发限 1–2；总并发限按 `config.rateLimit`；超限排队或降级为摘要模式

**错误处理与降级**

- 标准错误码：`invalid_body`、`rate_limited`、`quota_exceeded`、`idempotent_replay`、`upstream_error`、`internal_error`
- 重试策略：指数退避最多 2 次；幂等保障不重复扣次
- 降级路径：
  - 匹配度失败 → 返回简短摘要与改进清单（无需模型）
  - 简历定制失败 → 仅返回“编辑建议”而非指令；允许用户手动微调
  - RAG 检索为空 → 跳过检索，使用通用行业要点模板（不涉及“模板库”批量化，仅内置兜底）

**安全与合规**

- 数据最小化：仅保存必要字段；支持用户删除与立即生效
- PII 保护：敏感字段加密存储；访问审计与操作日志
- 公开分享：默认关闭；用户手动开启后生成只读链接（可撤销）

**部署与配置**

- Vercel：Node 路由启用；环境变量（示例）：`CLERK_*`、`STRIPE_*`、`OPENAI_API_KEY`、`DEEPSEEK_*`、`DATABASE_URL`、`REDIS_URL`
- 观测：结构化日志（request_id、service_id、step、token_usage、latency）；SSE 流式返回
- 性能目标：95 分位延迟达成情况写入日志；异常占比告警（阈值 5%）

**验收用例（示意）**

- 用例 A：上传 MD 简历 + JD → 通过预检 → 成功生成匹配度（含私信话术）→ 历史可回看
- 用例 B：在服务 B 步生成 EditPlan → 应用侧合成文本 → 版本对比显示差异 → 可回滚
- 用例 C：生成面试清单 → 导出 PDF 成功 → 历史中三层完整归档

## 6.执行计划

**里程碑与顺序（3 周，单人节奏）**

- 里程碑 M0：基础设施就绪（Day1–2）

  - 配置环境变量、项目启动与部署管线（Vercel）
  - 接入日志方案与速率限制骨架；启用试用逻辑与并发保护
  - 产出《接口契约草案》与《验收用例清单》

- 里程碑 M1：上传/解析/预检与服务创建（Day3–5）

  - Input Normalizer（Step 0）：生成三类 summary 并入库；命中幂等键直接复用
  - 上传通用简历/详细履历与 JD 粘贴；结构化解析为 JSON（`span_id/json_pointer`）
  - 预检规则与指引（必填、长度、语言一致性、要点覆盖率）
  - 创建`service_id`、建立与简历/JD 的关联，写入历史记录
  - 开发版轻量工作台：最小表单页（简历/详细履历 与 JD 文本域、a/b/c 三步触发按钮、SSE 流式展示），用于端到端联调与早期验证；生产级工作台留到 M5 完成

- 里程碑 M2：匹配度分析（Day6–7）

  - 服务编排基础构建、RAG 基础架构
  - RAG 检索，按任务属性精准丰富上下文
  - 引入 Context Assembler 与 Heuristic Scorer；模型评分+规则评分合成总分
  - 写入 `token_usage_logs` 并启用短 TTL 缓存；历史可回看
  - 生成评分、优势/缺口、私信话术
  - 结果缓存与幂等键；版本化存档与回看

- 里程碑 M3：定制化简历（结构化编辑指令）（Day8–10）

  - RAG 检索，按任务属性精准丰富上下文
  - 只输出 EditPlan(JSON)而非全文；应用侧合成最终简历与 Diff 高亮
  - 版本回滚与对比；目标片段级上下文抽取与并行处理

- 里程碑 M4：面试要点清单（Day11–12）

  - RAG 检索，按任务属性精准丰富上下文
  - 自我介绍 + 10–15 条问答要点（含 STAR 示例）；导出 Markdown/PDF
  - 结构化输出与长度控制；缓存与版本化
  - 递进式上下文（summary+a+b+RAG）；导出 Markdown/PDF

- 里程碑 M5：工作台与历史视图（Day13–15）

  - 工作台：上传、预检提示、分层解锁、SSE 流式反馈（生产级）、简历微调工具
  - 历史页：按`service_id`展示深度与版本；续跑与回看动作

- 里程碑 M6：支付/配额与观测（Day16–18）

  - Neon Auth 正式登录态与初始赠次；Stripe 购买/退款；剩余次数前置拦截
  - 结构化日志（request_id、service_id、step、token_usage、latency）与告警

- 里程碑 M7：MVP 收尾与灰度发布（Day19–21）

  - 端到端验收用例跑通；异常占比 ≤5%；缓存命中 ≥50%
  - 发布 Beta 与问题回收；不包含浏览器扩展/模板库

**开发顺序与并行建议**

- 先后顺序：M0→M1→M2→M3→M4→M5→M6→M7（保证后续均可基于可用数据流）
- 可并行：M2 与 RAG 文档整理可与 M1 尾部并行；M5 前端视图与 M3 指令合成可交错迭代
- 依赖约束：M1 含轻量工作台；支付与配额在功能闭环后再接入，前期以试用模式开发与验证

**每里程碑交付物（Definition of Done）**

- M1：`/api/upload/*`、`/api/service/create`上线；预检提示与`service_id`写库；`/api/normalize/*` 与摘要字段写库；命中缓存的幂等验证
- M2：`/api/analysis/match`上线，返回 `{score, rule_score, final_score, highlights, gaps, dm_script}`；日志含 tokens；评分与话术结构化，历史可回看
- M3：`/api/resume/customize`输出 EditPlan；应用侧合成与版本回退可用
- M4：`/api/interview/checklist`上线；导出 Markdown/PDF 成功
- M5：工作台/历史页最小可用；分层解锁与扣次逻辑跑通（试用）
- M6：Clerk/Stripe 接入；扣次与拦截生效；关键指标入日志
- M7：稳定性与成本指标达标；Beta 发布说明与 FAQ 文档

**质量门槛与验收**

- 时延：a≤8s、b≤12s、c≤12s（95%分位）
- 成本：单层输出 token≤1.2k；人均成本 ≤¥1.5/层
- 可靠性：失败重试 ≤2、幂等不重复扣次、SSE 流式
- 事实一致性：不新增未经上下文支撑的内容；新增信息以“待填变量清单”呈现

**风险与缓解**

- 输入质量不足：预检强约束与示例引导；必要时返回缺失清单
- 成本失控：强缓存、分片并行、模板变量与`previous_response_id`复用
- 供应商异常：错误分级与降级路径；多区域/多模型备选

## 7.核心数据表设计

**数据模型总览（Postgres + pgvector）**

- 关系主线：`user → resume/job_desc → service → task(a/b/c) → output(version)`
- 版本与回退：所有生成结果按版本化保存；支持差异对比与回滚
- 计费与配额：独立表管理购买、赠次与扣次；接口层前置拦截

**表与字段（草案）**

- users

  - id (pk, uuid)
  - clerk_user_id (unique)
  - email, lang_pref
  - created_at, updated_at
  - 索引：`clerk_user_id`、`email`

- resumes

  - id (pk)
  - user_id (fk users.id)
  - title
  - lang
  - original_text (text)
  - structured_json (jsonb)
  - resume_summary_json (jsonb)
  - promptTokens (int)
  - completionTokens (int)
  - totalTokens (int)
  - active (bool)
  - created_at, updated_at
  - 约束：每用户 general resumes ≤3（应用层校验+唯一键组合）
  - 索引：`user_id,active`

- detailed_resumes

  - id (pk)
  - user_id (fk users.id)
  - title
  - lang
  - original_text (text)
  - detailed_summary_json (jsonb)
  - promptTokens (int)
  - completionTokens (int)
  - totalTokens (int)
  - created_at, updated_at
  - 约束：每用户 detailed resume ≤1（应用层校验+唯一键组合）
  - 索引：`user_id,active`

- job_descriptions

  - id (pk)
  - user_id (fk)
  - title, source (string)
  - raw_text (text)
  - parsed_json (jsonb)
  - job_summary_json (jsonb)
  - promptTokens (int)
  - completionTokens (int)
  - totalTokens (int)
  - lang
  - created_at
  - 索引：`user_id,lang,created_at`

- services

  - id (pk)
  - user_id (fk)
  - resume_id (fk)
  - job_id (fk)
  - status (enum: created|running|done|error)
  - depth (enum: pre|a|b|c) // 当前已解锁到哪一层
  - created_at, updated_at
  - 索引：`user_id,created_at`

- tasks

  - id (pk)
  - service_id (fk)
  - kind (enum: match|customize|interview)
  - status (enum: pending|queued|running|done|error)
  - input_context_json (jsonb) // 组装后的最小上下文（summary+RAG+前序结果的引用）
  - context_refs (jsonb) // 引用的实体 ID 与版本（resume/jd/outputs）
  - requested_by (user_id)
  - started_at, finished_at
  - meta (jsonb)
  - 索引：`service_id,kind,status`

- task_outputs

  - id (pk)
  - task_id (fk)
  - version (int)
  - previous_response_id (string) // 上下文复用标识
  - output_json (jsonb) // 分析/EditPlan/Checklist 的结构化结果
  - output_text (text) // 应用侧合成后的可读文本（如简历成品）
  - model (string), provider (string)
  - input_tokens, output_tokens, cost (numeric)
  - created_at
  - 唯一：`task_id,version`
  - 索引：`task_id,created_at`

- resume_versions

  - id (pk)
  - resume_id (fk)
  - source_task_id (fk tasks.id)
  - version (int)
  - content_text (text)
  - diff_json (jsonb) // 与前版本的差异（可选）
  - created_at
  - 唯一：`resume_id,version`

- rag_documents

  - id (pk)
  - title, domain, lang, source, content (text)
  - created_at

- rag_doc_chunks

  - id (pk)
  - doc_id (fk)
  - chunk_index (int)
  - text (text)
  - embedding (vector) // pgvector
  - meta (jsonb)
  - 唯一：`doc_id,chunk_index`
  - 索引：`embedding`（向量索引）、`doc_id`

- quotas

  - id (pk)
  - user_id (fk)
  - initial_grant (int)
  - purchased (int)
  - used (int)
  - updated_at
  - 计算列：`remaining = initial_grant + purchased - used`

- payments

  - id (pk)
  - user_id (fk)
  - stripe_checkout_id (unique)
  - amount (numeric), currency (string)
  - status (enum: pending|succeeded|refunded|failed)
  - created_at

- token_usage_logs

  - id (pk)
  - user_id, service_id, task_id
  - provider, model
  - input_tokens, output_tokens, cost
  - created_at

- idempotency_keys

  - key (pk)
  - user_key (string)
  - step (enum: match|customize|interview)
  - created_at, ttl_ms

- audit_logs

  - id (pk)
  - user_id
  - action (string) // create_service / run_task / delete_resume ...
  - entity_type (string), entity_id (uuid)
  - created_at, metadata (jsonb)

**关系与约束**

- users 1–N resumes/job_descriptions/services
- services 1–N tasks；tasks 1–N task_outputs；resumes 1–N resume_versions
- quotas 与 users 1–1；payments 与 users 1–N
- rag_documents 1–N rag_doc_chunks；向量索引用于检索
- resumes(user_id,type,active) + resume_summary_json 部分索引（如 `GIN jsonb_path_ops`）
- job_descriptions(user_id,created_at)；jd_summary_json 同上
- tasks(service_id,kind,status)；task_outputs(task_id,version)

**索引与性能**

- 时间序列：`created_at` 统一索引，便于历史视图分页
- 业务主路：`service_id,kind,status`（tasks）、`task_id,version`（outputs）
- pgvector：对 `rag_doc_chunks.embedding` 建置 HNSW / IVF 索引（视 pgvector 版本）

**数据保留与删除**

- 用户主动删除：逻辑删除简历与 JD，同时硬删除文本内容；保留最小审计记录
- 删除简历/JD 时，同时删除对应 `*_summary_json`；审计仅保留必要元数据
- 服务记录：保留 180 天；过期归档或匿名化处理

## 8.工作台页面设计

**设计目标**

- 简洁直观：用户无需阅读说明即可完成一次服务
- 以“服务单元”为核心：每次粘贴 JD 创建`service_id`，分层解锁 a/b/c
- 低频信息不打扰：通用简历/详细履历在侧边管理；JD 为高频入口
- 引导而不阻塞：详细履历缺失时，提供明显但可忽略的质量引导

**页面信息架构（Web，MVP）**

- 顶部栏：Logo、用户菜单、剩余次数与试用标记；主 CTA“新建服务”
- 主区域采用“三栏布局”：
  - 左栏「信息源面板」：
    - 简历管理（低频）：
      - 选择通用简历（最多 3 份）与可选的详细履历（最多 1 份）
      - 显示当前选择状态与最近编辑时间；支持预览与替换
      - 若未绑定详细履历：显示“质量评分提示卡”（见下）与“快速录入”按钮
    - JD 输入区（高频）：
      - 大文本域用于粘贴 JD；实时预检（长度、职责/要求覆盖率、语言一致）
      - 解析预览（结构化职责/要求、关键词）；按钮“创建服务”→ 生成`service_id`
      - 最近使用的 JD 列表（10 条），支持一键复用与去重提醒
  - 中栏「服务进度卡（当前 service）」：
    - 分层 Step 视图：
      - Step a 匹配度分析（状态：Idle/Pending/Streaming/Done/Error）
      - Step b 简历定制化（显示 Diff 与版本选择）
      - Step c 面试要点清单（导出 Markdown/PDF）
    - 每个 Step 卡片包含：
      - 说明与预计时长/扣次（例如“预计 ≤12s，扣 1 次”）
      - 运行按钮，运行中 SSE 实时滚动输出；完成后提供“保存为版本”与“继续下一步”
  - 右栏「历史记录侧栏」：
    - 最近`service_id`列表（按时间倒序）；显示深度进度 a/b/c、简历与 JD 摘要
    - 支持筛选（语言/状态）与搜索；点击加载到中栏继续解锁或查看历史版本

**详细履历的引导机制（不阻塞主流程）**

- 质量评分提示卡（左栏顶部常显）：
  - 文案：“补充详细履历可提升输出质量（+20%）”；按钮“快速录入”
  - 若用户忽略，主流程不受影响；在每个 Step 的结果页右上角以小气泡再次提示
- 快速录入对话框：
  - 采用分段表单（教育/工作/项目/技能）；支持导入 Markdown 模板或从通用简历抽取
  - 完成后自动与当前简历绑定，并刷新质量评分

**交互流（核心路径）**

1. 选择/确认简历 → 粘贴 JD → 预检通过 → 创建`service_id`
2. Step a 运行：SSE 显示分析、优势/缺口与“私信话术”；完成后可保存版本
3. Step b 运行：仅输出 EditPlan(JSON)，应用侧合成成品简历；展示 Diff 与回滚
4. Step c 运行：生成自我介绍与问答要点；提供导出与保存版本
5. 历史侧栏回看/续跑：按`service_id`恢复上下文，继续未完成的 Step

**组件清单（shadcn/ui）**

- Card、Tabs、Stepper（或自定义）、Textarea、Dialog、Drawer、Toast、Skeleton、Badge、Progress
- 版本 Diff 视图：左右对比或行级高亮；导出按钮（PDF/MD）

**状态与异常**

- Step 状态：Idle/Pending/Streaming/Done/Error；错误提供“重试/降级”入口
- 计费提示：运行前显示扣次说明；若次数不足，弹出购买对话框（M6 接入后生效）
- 幂等与并发：同`service_id+step`运行中禁用重复点击；显示排队提示

**响应式（移动端）**

- 两栏折叠为纵向：信息源 → 服务进度 → 历史；右上使用 Drawer 打开历史列表
- 运行中展示 Skeleton 与简短结果摘要，减少滚动成本

**可观测性与 A/B**

- 每次运行记录`service_id/step/latency/token_usage`；页面埋点：创建服务、各 Step 点击/完成
- 质量提示卡点击率与转化率（详细履历完成率）纳入指标

**验收标准（页面级）**

- 无需阅读说明，用户能在 ≤3 次点击完成 a 步并看到结构化结果
- 从 a→b 的转化 ≥35%；页面平均时延符合各 Step 目标；错误占比 ≤5%

## 9.Landing Page 设计（未登录状态）

- 核心信息一句话：用定制化的匹配分析、简历编辑指令与面试清单，帮你在求职路上最后一公里提速
- 三个动作：理解（浏览）→ 说服（信任）→ 行动（注册/试用）

- 信息架构（自上而下）
- Hero（首屏）
  - 标题：AI 求职助手，三步拿到更高匹配度的面试机会
  - 副标题：上传简历与岗位 JD，获得匹配度分析 → 简历定制化 → 面试要点清单
  - 主 CTA：开始免费试用；次 CTA：查看示例输出
  - 视觉：三步流程示意（a→b→c）与 SSE 流式返回动效截图
- Value（你能得到什么，What）
  - 匹配度分析：优势/缺口与可直接投递的“私信话术”
  - 简历定制化：只生成结构化编辑指令，应用侧合成，质量稳定、可回滚
  - 面试要点清单：自我介绍+10–15 条问答要点（含 STAR 示例）
  - 成本与时延：每步 ≤12 秒，输出 token 受控，减少等待与费用
- How it works（它如何先进高效实现，How）
  - 结构化输出：EditPlan(JSON)而非全文；少 Tokens、可版本化
  - RAG 知识库：按行业分块检索，只取 Top-K 小片段辅助生成
  - 缓存与幂等：请求去重、结果缓存、并发保护，稳定降本提速
  - SSE 流式：边生成边展示，用户无感等待
- Social Proof（信任）
  - 典型场景卡片：应届/转岗/资深复盘三类，用例要点与截图
  - 质量承诺：不虚构、不夸大，只基于用户与检索事实
- CTA 区（折返点）
  - CTA：免费试用（赠送次数）；次 CTA：浏览示例输出与流程演示
  - 备注：无需上传详细履历即可开始，但完善后质量显著提升（+20%）
- FAQ（简短）
  - 是否保存我的数据？可随时删除，立即生效
  - 是否支持移动端？支持响应式；原生 App 不在 MVP 范围
  - 是否需要立即付费？试用后可按需购买次数

**交互与动效**

- 首屏流程动效：a→b→c 三步动画，强调金字塔收缩与层层解锁
- 示例输出切换：Tabs 展示“匹配度/简历 Diff/面试清单”的真实片段
- 计费透明：显式展示每步扣次与预计时长

**组件与布局（shadcn/ui）**

- Hero：Heading、Subheading、CTA Button、Illustration
- Value/How/Proof：Card+Icon 列表、Tabs 示例、Accordion FAQ
- 全局：响应式容器、滚动锚点导航，返回顶部浮标

**文案提纲（可直接落地）**

- Hero 标题：三步提升岗位匹配度，拿到更高质量的面试机会
- Hero 副标题：上传简历与 JD，获得匹配度分析 → 简历编辑指令 → 面试要点清单
- CTA：开始免费试用
- Value 小标题：分析更准、改简历更稳、准备面试更全
- How 小标题：结构化输出、RAG 检索、缓存与幂等、SSE 流式

**验收标准（页面级）**

- 首屏 3 秒内可理解“做什么/怎么做”，CTA 清晰可见
- 示例输出可在 ≤2 次点击内浏览三类结果
- 注册转化 ≥8%，试用触发率 ≥30%
