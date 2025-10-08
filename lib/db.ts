import { neon } from '@neondatabase/serverless'
import { ENV } from './env'

let _sql: ReturnType<typeof neon> | null = null
let _migrated = false

export function sql() {
  if (!_sql) {
    if (!ENV.DATABASE_URL) {
      throw new Error('missing_DATABASE_URL')
    }
    _sql = neon(ENV.DATABASE_URL)
  }
  return _sql
}

export async function ensureSchema() {
  if (_migrated) return
  const db = sql()

  // Enable pgcrypto for gen_random_uuid if needed (safe to run multiple times)
  await db/* sql */ `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`

  // users: MVP 用 user_key 作为 id（文本主键），Neon Auth 接入后可演进为 uuid + 外部映射
  await db/* sql */ `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT,
      lang_pref TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `

  await db/* sql */ `
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lang TEXT,
      original_text TEXT,
      structured_json JSONB,
      resume_summary_json JSONB,
      resume_summary_tokens INT,
      active BOOLEAN DEFAULT TRUE,
      source_type TEXT,
      content_type TEXT,
      char_count INT,
      media_base64 TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  await db/* sql */ `CREATE INDEX IF NOT EXISTS idx_resumes_user_active ON resumes (user_id, active);`

  await db/* sql */ `
    CREATE TABLE IF NOT EXISTS detailed_resumes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lang TEXT,
      original_text TEXT,
      detailed_summary_json JSONB,
      detailed_summary_tokens INT,
      source_type TEXT,
      content_type TEXT,
      char_count INT,
      media_base64 TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `

  await db/* sql */ `
    CREATE TABLE IF NOT EXISTS job_descriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      lang TEXT,
      raw_text TEXT,
      parsed_json JSONB,
      job_summary_json JSONB,
      job_summary_tokens INT,
      source_type TEXT,
      content_type TEXT,
      char_count INT,
      media_base64 TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  await db/* sql */ `CREATE INDEX IF NOT EXISTS idx_jobs_user_created ON job_descriptions (user_id, created_at);`

  await db/* sql */ `
    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      resume_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      status TEXT, -- created|running|done|error
      depth TEXT,  -- a|b|c
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `
  await db/* sql */ `CREATE INDEX IF NOT EXISTS idx_services_user_created ON services (user_id, created_at);`
  _migrated = true
}
