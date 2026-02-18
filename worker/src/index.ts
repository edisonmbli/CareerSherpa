import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import * as Sentry from '@sentry/node'
import { config } from './config'
import { Receiver } from '@upstash/qstash'
import { handleStream, handleBatch } from '@/lib/worker/handlers'
import type { WorkerBody } from '@/lib/worker/types'
import { logError, logInfo } from '@/lib/logger'

const initSentry = async () => {
  const profilingIntegration = await import('@sentry/profiling-node')
    .then((mod) => mod.nodeProfilingIntegration())
    .catch(() => null)

  Sentry.init({
    dsn: process.env['SENTRY_DSN'] || process.env['NEXT_PUBLIC_SENTRY_DSN'],
    integrations: profilingIntegration ? [profilingIntegration] : [],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  })
}

// Define Hono Environment
type Bindings = {
  parsedBody?: WorkerBody
}

const app = new Hono<{ Variables: Bindings }>()

// Global Error Handler
app.onError((err, c) => {
  logError({
    reqId: 'worker',
    route: 'worker/global',
    error: err,
  })
  return c.text('Internal Server Error', 500)
})

// Middleware
app.use('*', logger())

const parseCorsOrigins = (value?: string) => {
  if (!value) return '*'
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (!items.length || items.includes('*')) return '*'
  return items
}

app.use('*', cors({ origin: parseCorsOrigins(config.CORS_ORIGIN) }))

// QStash Receiver
const receiver = new Receiver({
  currentSigningKey: config.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: config.QSTASH_NEXT_SIGNING_KEY || '',
})

// QStash Verification Middleware
const verifyQStash = async (c: any, next: any) => {
  const skipVerify =
    config.NODE_ENV === 'development' && config.QSTASH_SKIP_VERIFY === 'true'
  if (skipVerify) {
    return next()
  }

  const signature = c.req.header('upstash-signature')
  const body = await c.req.text()

  if (!signature) {
    return c.text('Missing signature', 401)
  }

  try {
    const isValid = await receiver.verify({
      signature,
      body,
    })
    if (!isValid) {
      return c.text('Invalid signature', 401)
    }
  } catch (e) {
    logError({
      reqId: 'worker',
      route: 'worker/qstash',
      phase: 'verify_failed',
      error: e instanceof Error ? e : String(e),
    })
    return c.text('Verification failed', 401)
  }

  // Restore body for downstream handlers
  // Hono consumes the stream when calling text(), so we need to set it back
  // However, for JSON parsing in handlers, we might need a workaround or pass the parsed body
  // Better approach: Let's parse JSON here and attach to context if verification passes
  try {
    const json = JSON.parse(body)
    c.set('parsedBody', json)
  } catch {
    // Body might not be JSON, ignore
  }

  return next()
}

// Health Check
app.get('/health', (c) => c.json({ status: 'ok', service: 'worker-hono' }))

// Routes
app.post('/api/execute/stream', verifyQStash, async (c) => {
  // Create a Fetch API Request object compatible with handlers
  // Note: handlers.ts expects a Request object with .json() method

  // We reconstruct the request to pass to the existing handler logic
  // Since we already read the body for verification, we need to provide it
  const body = c.get('parsedBody') || (await c.req.json())

  const mockReq = new Request(c.req.url, {
    method: 'POST',
    headers: c.req.raw.headers,
    body: JSON.stringify(body),
  })

  const response = await handleStream(mockReq, { service: 'stream' })

  // Convert standard Response to Hono response
  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
})

app.post('/api/execute/batch', verifyQStash, async (c) => {
  const body = c.get('parsedBody') || (await c.req.json())

  const mockReq = new Request(c.req.url, {
    method: 'POST',
    headers: c.req.raw.headers,
    body: JSON.stringify(body),
  })

  const response = await handleBatch(mockReq, { service: 'batch' })

  return new Response(response.body, {
    status: response.status,
    headers: response.headers,
  })
})

const startServer = async () => {
  await initSentry()
  const port = parseInt(config.PORT, 10)
  logInfo({
    reqId: 'worker',
    route: 'worker/start',
    message: `Worker service running on port ${port}`,
    port,
  })
  serve({
    fetch: app.fetch,
    port,
  })
}

startServer()
