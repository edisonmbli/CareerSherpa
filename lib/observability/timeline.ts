import { promises as fsp } from 'fs'
import path from 'path'

export async function markTimeline(
  serviceId: string,
  phase: string,
  meta?: Record<string, any>
) {
  const dir = path.join(process.cwd(), 'tmp', 'perf-timeline')
  const file = path.join(dir, `${serviceId}.md`)
  const ts = new Date().toISOString()
  const line = `${ts} phase=${phase} ${JSON.stringify(meta || {})}`
  try {
    await fsp.mkdir(dir, { recursive: true })
    await fsp.appendFile(file, line + '\n')
  } catch {}
}
