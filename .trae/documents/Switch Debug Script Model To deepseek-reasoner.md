## 变更
- 将 `scripts/debug-detailed-resume-summary.ts` 中的模型从 `glm-4.5-flash` 改为 `deepseek-reasoner`，其余逻辑不变。

## 验证
- 运行：`pnpm tsx scripts/debug-detailed-resume-summary.ts cmi4fd6fs00018oewskjh54lu zh`
- 预期：不再出现 `Headers Timeout Error`；输出包含原文与 JSON 的详细对比与计数。

## 风险与回滚
- 仅脚本内模型切换；若仍失败，恢复为原值或改用 `deepseek-chat`。