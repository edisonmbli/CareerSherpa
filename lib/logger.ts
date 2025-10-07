type LogBase = {
  reqId: string
  route: string
  userKey?: string
  isTrial?: boolean
  lang?: string
  durationMs?: number
  tokens?: number
  error?: string
}

export function logInfo(payload: LogBase) {
  const entry = { level: 'info', ts: new Date().toISOString(), ...payload }
  console.log(JSON.stringify(entry))
}

export function logError(payload: LogBase) {
  const entry = { level: 'error', ts: new Date().toISOString(), ...payload }
  console.error(JSON.stringify(entry))
}
