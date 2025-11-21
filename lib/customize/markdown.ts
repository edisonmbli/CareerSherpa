import type { RewriteOp } from './ops'

function applyOpsToText(raw: string, ops: RewriteOp[]): string {
  let text = raw
  for (const op of ops) {
    if (op.type === 'rewrite-lite') {
      const { original, revised } = op
      const pattern = new RegExp(original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
      text = text.replace(pattern, revised)
    }
  }
  return text
}

export function toMarkdown(params: { raw: string; ops: RewriteOp[] }): { markdown: string; diff: { original: string; revised: string }[] } {
  const revised = applyOpsToText(params.raw, params.ops)
  const diff: { original: string; revised: string }[] = params.ops
    .filter((op) => op.type === 'rewrite-lite')
    .map((op: any) => ({ original: op.original, revised: op.revised }))
  const md = `# Customized Resume\n\n${revised}`
  return { markdown: md, diff }
}