import fs from 'fs'
import path from 'path'
import { ENV } from '@/lib/env'
import { logDebug, logError } from '@/lib/logger'

export function logDebugData(
  phase: string,
  data: {
    input?: string
    output?: string
    meta?: any
    latencyMs?: number
  }
) {
  if (!ENV.LOG_DEBUG) return

  if (process.env.NODE_ENV === 'production') {
    logDebug({
      reqId: String(data.meta?.requestId || data.meta?.traceId || 'system'),
      route: 'llm/debug',
      phase,
      latencyMs: data.latencyMs,
      inputSize: data.input?.length ?? 0,
      outputSize: data.output?.length ?? 0,
      meta: data.meta,
    })
    return
  }

  try {
    const tmpDir = path.join(process.cwd(), 'tmp', 'debug-logs')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${timestamp}_${phase}.md`
    const filePath = path.join(tmpDir, filename)

    let mdContent = `# Debug Log: ${phase}\n\n`
    mdContent += `- Timestamp: ${new Date().toISOString()}\n`
    mdContent += `- Phase: ${phase}\n`

    if (data.meta) {
      mdContent += `- Meta: ${JSON.stringify(data.meta)}\n`
    }
    if (data.latencyMs) {
      mdContent += `- Latency: ${data.latencyMs}ms\n`
    }

    mdContent += `\n## Input\n\n`
    if (data.input) {
      try {
        const inputObj = JSON.parse(data.input)
        // Truncate specific large fields in variables
        if (inputObj.variables) {
          const vars = inputObj.variables
          const truncateKeys = [
            'resume_summary_json',
            'detailed_resume_summary_json',
            'resume_text',
            'detailed_resume_text',
            'resume',
            'detailed_resume',
          ]

          truncateKeys.forEach((key) => {
            if (typeof vars[key] === 'string' && vars[key].length > 50) {
              vars[key] = vars[key].slice(0, 50) + '... (truncated)'
            }
          })
          // Keep rag_context full as requested
        }
        mdContent += '```json\n' + JSON.stringify(inputObj, null, 2) + '\n```\n'
      } catch {
        mdContent += '```\n' + data.input + '\n```\n'
      }
    } else {
      mdContent += `(No input data)\n`
    }

    mdContent += `\n## Output\n\n`
    if (data.output) {
      mdContent += '```\n' + data.output + '\n```\n'
    } else {
      mdContent += `(No output data)\n`
    }

    fs.writeFileSync(filePath, mdContent)
    const serviceId = data.meta?.serviceId
    if (serviceId) {
      const perfDir = path.join(process.cwd(), 'tmp', 'perf-timeline')
      if (!fs.existsSync(perfDir)) {
        fs.mkdirSync(perfDir, { recursive: true })
      }
      const perfFile = path.join(perfDir, `${serviceId}.md`)
      const ts = new Date().toISOString()
      const perfLine = `${ts} phase=llm_debug ${JSON.stringify({
        phase,
        input: data.input,
        output: data.output,
        meta: data.meta,
        latencyMs: data.latencyMs,
        debugFile: filePath,
      })}`
      fs.appendFileSync(perfFile, perfLine + '\n')
    }
  } catch (e) {
    logError({
      reqId: String(data.meta?.requestId || data.meta?.traceId || 'system'),
      route: 'llm/debug',
      error: e instanceof Error ? e : String(e),
      phase: 'write_debug_file',
    })
  }
}
