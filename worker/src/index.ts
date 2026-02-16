import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { config } from './config'
import { Receiver } from '@upstash/qstash'
import { handleStream, handleBatch } from '@/lib/worker/handlers'
import type { WorkerBody } from '@/lib/worker/types'

// Define Hono Environment
type Bindings = {
  parsedBody: any
}

const app = new Hono<{ Variables: Bindings }>()

// Middleware
app.use('*', logger())
app.use('*', cors({ origin: '*' })) // Adjust for production

// QStash Receiver
const receiver = new Receiver({
  currentSigningKey: config.QSTASH_CURRENT_SIGNING_KEY || '',
  nextSigningKey: config.QSTASH_NEXT_SIGNING_KEY || '',
})

// QStash Verification Middleware
const verifyQStash = async (c: any, next: any) => {
  // Skip verification in development if keys are missing or NODE_ENV is development
  if (config.NODE_ENV === 'development' && !config.QSTASH_CURRENT_SIGNING_KEY) {
    console.warn('⚠️ Skipping QStash verification in development mode')
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
    console.error('QStash verification failed:', e)
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

// Start Server
const port = parseInt(config.PORT, 10)
console.log(`🚀 Worker service running on port ${port}`)

serve({
  fetch: app.fetch,
  port,
})
