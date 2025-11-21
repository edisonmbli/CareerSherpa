export type RewriteOp =
  | { type: 'reorder'; section: string; from: number; to: number }
  | { type: 'augment'; section: string; index: number; append: string[] }
  | { type: 'trim'; section: string; index: number }
  | { type: 'rewrite-lite'; section: string; index: number; original: string; revised: string }

export function generateOps(params: {
  resume: any
  jobSummary: { mustHaves?: string[]; niceToHaves?: string[] }
  match?: any
}): RewriteOp[] {
  const ops: RewriteOp[] = []
  const must = (params.jobSummary?.mustHaves ?? []).map((s) => String(s).toLowerCase())
  const softWeakVerbs = ['负责', '参与', '协助', '进行', '负责 ', '参与 ', '协助 ', '进行 ']

  const exp: any[] = Array.isArray(params.resume?.experience) ? params.resume.experience : []
  exp.forEach((e, i) => {
    const hl: string[] = Array.isArray(e?.highlights) ? e.highlights : []
    const idxMatch = hl.findIndex((h) => must.some((m) => String(h).toLowerCase().includes(m)))
    if (idxMatch > 0) {
      ops.push({ type: 'reorder', section: 'experience.highlights', from: i, to: 0 })
    }
    hl.forEach((h, j) => {
      if (softWeakVerbs.some((v) => String(h).startsWith(v))) {
        const revised = String(h).replace(/^负责|参与|协助|进行/, '主导')
        ops.push({ type: 'rewrite-lite', section: `experience[${i}].highlights`, index: j, original: h, revised })
      }
    })
  })

  const skillsArr = Array.isArray(params.resume?.skills)
    ? (params.resume.skills as string[])
    : [...(params.resume?.skills?.technical ?? []), ...(params.resume?.skills?.soft ?? []), ...(params.resume?.skills?.tools ?? [])]
  const missingMust = must.filter((m) => !skillsArr.some((s) => String(s).toLowerCase().includes(m)))
  if (missingMust.length > 0) {
    ops.push({ type: 'augment', section: 'skills', index: -1, append: missingMust })
  }

  return ops
}