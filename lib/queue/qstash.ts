import { Client } from '@upstash/qstash'
import { ENV } from '@/lib/env'

let _client: Client | null = null

export function getQStash(): Client {
  if (_client) return _client
  if (!ENV.QSTASH_TOKEN) {
    throw new Error('missing_QSTASH_TOKEN')
  }
  _client = new Client({ token: ENV.QSTASH_TOKEN })
  return _client
}