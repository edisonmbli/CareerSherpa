## 目标
- 立即撤回 `lib/llm/service.ts` 中的手工分段/合并（硬编码）逻辑，恢复为“单次调用 + 任务级 maxTokens 管理”。
- 保留已验证有效的内容：模板变量 `{var}`、JSON Schema 注入、zod 校验及 Worker 返还。
- 降级策略先简化为：当内容超出模型能力导致丢失时，仅提示用户“建议不超过 XX 字”，后端不做复杂分段。

## 正确的落地执行（简化版）
- Tokens 管理：
  - 保留 `lib/llm/config.ts` 的任务级 `maxOutputTokens`，在 `getModel(...)` 逐任务传入。
  - 不做输入分段；由模型根据输出上限自动裁剪。
- 提示与兜底：
  - 前端在上传/填写字段处给出“建议长度”提示文案（按任务类型配置）；
  - 写回前保持 zod 校验；Worker 在“结构化但内容不足”情况下退款并返回 `degradeReason`。
- 代码结构：
  - 服务层只负责：拼接 Prompt（System + JSON Schema + Human）、传入 variables、调用模型并按 zod 验证；不混入内容分段和合并。

## 实施步骤
1) 撤回 `lib/llm/service.ts` 中 `runStructuredLlmTask` 的分段/合并代码块，恢复为：
   - `const model = getModel(modelId, { maxTokens: limits.maxOutputTokens })`
   - `const aiMessage = await chain.invoke(variables)`
2) 保留并完善 `lib/llm/config.ts`：任务级 `maxOutputTokens` 的明确列表（resume_summary、detailed_resume_summary、job_summary、job_match、resume_customize、interview_prep）。
3) 前端文案：在 Profile 上传处增加“建议不超过 N 字”的提示，对应任务类型配置；失败时 toast 显示“解析失败/可能超出字数限制”。
4) 验证：
   - lint/test 全量；
   - 用脚本跑 `resume_id` 验证输出；
   - 检查写回与 Worker 退款正常。

## 风险与回滚
- 风险较小：撤回硬编码后路径更简单；若解析仍偶发缺失，由 UI 提示与 Worker 退款兜底。
- 回滚方便：所有改动集中在 service 层一个函数和配置文件；如需重新评估分段策略，另起独立模块再灰度。

## 后续（不在本迭代内）
- 正确的分段设计（后续迭代）：
  - 独立模块 `lib/llm/chunker.ts`：按分区/标题窗口化，返回“分段结果 + 合并策略”，不污染 service 层；灰度发布。
  - 指标：覆盖率、成功率、token 用量与时延；达标后再启用。

如确认，我将按以上步骤撤回硬编码降级、完善任务级 maxTokens 管理并完成验证。