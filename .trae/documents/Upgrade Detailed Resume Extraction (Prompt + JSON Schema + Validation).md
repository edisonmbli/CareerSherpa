## 差异与问题归纳
- 原文结构丰富：分公司/产品线、关键词、在职时间、子分节（主要亮点/项目经历/重要产出/能力/领导力/问题解决等），每节包含“任务/行动/成果”三段以及大量量化指标。
- 现有输出（基于通用 V2 schema）偏“摘要化”，保留的字段不够细：
  - 丢失“任务/行动/成果”的三段结构（T-A-R），以及关键度量（ROI、规模、占比、时效等）。
  - 不能完整映射“能力类”分节（学习能力/推荐系统/创作者增长/短视频理解/精益能力/协同能力/领导能力/问题解决能力等）。
  - 项目内的层级和条目序号（1.1/1.2 等）未保留；多个公司段落的“关键词”“在职时间”未在结构化字段中出现。

## JSON Schema（DetailedResume V3）
- 顶层：
  - `header`（同 V2，含 links[]）
  - `summary`（可选）
  - `experiences[]`：
    - `company`, `product_or_team`, `role`, `duration`, `keywords[]`
    - `highlights[]`（逐条原文，不改写）
    - `projects[]`：每项
      - `name`, `description?`, `link?`
      - `task[]`（原文要点）、`actions[]`（原文要点）、`results[]`（原文要点）
      - `metrics[]`（结构化度量：{label, value, unit?, period?}，如“30%+ 消费VV”）
    - `contributions[]`（“重要产出/贡献”原文要点）
  - `capabilities[]`：能力分节（如“学习能力”、“推荐系统”、“创作者增长”等）
    - `{ name: string, points: string[] }`（逐条原文）
  - `education[]`：同 V2（含 `courses[]`）
  - `skills`：同 V2（union：数组或分栏 `technical/soft/tools`）
  - `awards[]`, `certifications[]`, `languages[]`, `openSource[]`, `extras[]`（同 V2）
  - `rawSections[]`（兜底）：`{ title: string, points: string[] }`
  - `summary_points[]`, `specialties_points[]`（保持）

## Prompt（中文）
- 角色与原则：保持“提取而非改写”，逐条复制原文要点；保留顺序与分节名称；禁止合并或重写句子；保留所有数量与单位。
- 识别规则：
  - 公司段识别：遇到“公司/产品/在职时间/关键词”四要素时，创建一个 `experiences` 元素。
  - 项目段识别：遇到“项目经历/项目 x”下的“任务/行动/成果”三段，将要点分别写入 `projects[].task/actions/results`。
  - 指标抽取：在 `results` 或正文出现的数字百分比/规模/时效，额外落入 `metrics[]`，并同时保留在原文要点中。
  - 能力分节：如“学习能力/推荐系统/创作者增长/短视频内容理解/精益能力/协同能力/领导能力/问题解决能力”等，写入 `capabilities[]`，逐条保存。
  - 兜底：遇到无法归类的分节，写入 `rawSections[]`，`title` 为原文标题，`points` 为原文条目。
- 输出要求：
  - 返回单个 JSON 对象，符合上述 Schema；不得输出代码块或说明。
  - 所有要点使用原文；允许规范化空白符，但不得改写措辞。
  - 中文输入→中文输出；保留序号（如“1.2 项目经历”）与层级顺序。

## 校验与兜底
- Zod：新增 `detailedResumeV3Schema`（严格字段，允许 `rawSections[]`）；Refine：至少满足下列之一：
  - experiences≥1（且任一含 highlights 或 projects.task/actions/results≥1）
  - capabilities≥1（且 points≥1）
  - education≥1 或 skills 非空。
- Worker 无效判定同步使用 V3 规则；失败自动退款逻辑不变。

## 预览最小适配
- 若存在 `projects[].task/actions/results/metrics` 与 `capabilities[]`，在预览中按“公司→项目（T-A-R）→能力”顺序渲染；若无，则显示 `rawSections[]`。
- 仍保持 MVP 简洁：不做锚点，仅上下滚动；渐变线轻量。

## 实施步骤
1. 新增 Schema 与校验：`lib/llm/zod-schemas.ts` 增加 `detailedResumeV3Schema`；更新 `SCHEMA_MAP.detailed_resume_summary` 指向 V3。
2. Prompt：`lib/prompts/zh.ts` 更新 `detailed_resume_summary` 的 `systemPrompt/userPrompt`，并固定 `outputSchema` 为 V3。
3. Worker：`lib/worker/handlers.ts` 的无效判定与写库逻辑适配 V3；退款兜底不变。
4. 预览：`components/app/AssetUploader.tsx` 渲染 `projects.task/actions/results/metrics` 与 `capabilities[]`，无则回退 `rawSections[]`。
5. 调试：保留新脚本；对比计数（coverage）并输出差异概览（可在脚本中追加覆盖率指标）。

## 验证
- 用你提供的 `detailed_resume.txt` 与 id `cmi4fd6fs00018oewskjh54lu` 跑脚本，对比“任务/行动/成果/能力/指标”保留率；预期保留大幅提升，JSON 字段全面填充。
- Web：上传详细履历，Completed 后打开预览不空白；展示公司/项目（T-A-R）与能力分节。

## 回滚
- 若模型对 V3 响应不稳定：
  - Prompt 中加入“生成空缺字段时保持空数组/空字符串，不要删除字段”；
  - 临时回退 `SCHEMA_MAP.detailed_resume_summary` 至现有 V2，同时保留 `rawSections[]` 兜底。