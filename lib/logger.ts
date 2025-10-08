type LogBase = {
  reqId: string
  route: string
  userKey?: string
  isTrial?: boolean
  lang?: string
  durationMs?: number
  // 支持单值或对象化的 tokens 统计
  tokens?: number | Record<string, number>
  error?: string
  // 允许附加的结构化信息，例如 phase、inputs_len 等
  [key: string]: unknown
}

export function logInfo(payload: LogBase) {
  const entry = { level: 'info', ts: new Date().toISOString(), ...payload }
  console.log(JSON.stringify(entry))
}

export function logError(payload: LogBase) {
  const entry = { level: 'error', ts: new Date().toISOString(), ...payload }
  console.error(JSON.stringify(entry))
}
