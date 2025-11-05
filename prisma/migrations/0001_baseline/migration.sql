-- KEEP: pgvector 扩展（knowledge_entries.embedding 需要）
CREATE EXTENSION IF NOT EXISTS vector;

-- KEEP: 枚举类型（与 Prisma enum 对齐；不指定 schema 时默认在 public）
DO $$ BEGIN
  CREATE TYPE "AsyncTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ServiceStep" AS ENUM ('MATCH', 'CUSTOMIZE', 'INTERVIEW', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- KEEP: quotas（@@map("quotas")，列名与 @map 对齐）
CREATE TABLE IF NOT EXISTS "public"."quotas" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT UNIQUE NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "quota_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: payment_waitlist（@@map("payment_waitlist")）
CREATE TABLE IF NOT EXISTS "public"."payment_waitlist" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT UNIQUE NOT NULL,
  "email" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "payment_waitlist_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: resumes（@@map("resumes")）
CREATE TABLE IF NOT EXISTS "public"."resumes" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT UNIQUE NOT NULL,
  "original_text" TEXT,
  "resume_summary_json" JSONB,
  "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "resume_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: detailed_resumes（@@map("detailed_resumes")）
CREATE TABLE IF NOT EXISTS "public"."detailed_resumes" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT UNIQUE NOT NULL,
  "original_text" TEXT,
  "detailed_summary_json" JSONB,
  "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "detailed_resume_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: services（@@map("services")）
CREATE TABLE IF NOT EXISTS "public"."services" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "resume_id" TEXT NOT NULL,
  "detailed_resume_id" TEXT,
  "current_step" "ServiceStep" NOT NULL DEFAULT 'MATCH',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "service_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "services_resume_id_fkey"
    FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "services_detailed_resume_id_fkey"
    FOREIGN KEY ("detailed_resume_id") REFERENCES "public"."detailed_resumes"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- KEEP: services 的组合索引（@@index([userId, createdAt(sort: Desc)])）
CREATE INDEX IF NOT EXISTS "services_user_id_created_at_idx"
  ON "public"."services" ("user_id" DESC, "created_at" DESC);

-- KEEP: jobs（@@map("jobs")）
CREATE TABLE IF NOT EXISTS "public"."jobs" (
  "id" TEXT PRIMARY KEY,
  "service_id" TEXT UNIQUE NOT NULL,
  "original_text" TEXT,
  "original_image" TEXT,
  "job_summary_json" JSONB,
  "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "jobs_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: matches（@@map("matches")）
CREATE TABLE IF NOT EXISTS "public"."matches" (
  "id" TEXT PRIMARY KEY,
  "service_id" TEXT UNIQUE NOT NULL,
  "match_summary_json" JSONB,
  "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "matches_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: customized_resumes（@@map("customized_resumes")）
CREATE TABLE IF NOT EXISTS "public"."customized_resumes" (
  "id" TEXT PRIMARY KEY,
  "service_id" TEXT UNIQUE NOT NULL,
  "markdown_content" TEXT,
  "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "customized_resumes_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: interviews（@@map("interviews")）
CREATE TABLE IF NOT EXISTS "public"."interviews" (
  "id" TEXT PRIMARY KEY,
  "service_id" TEXT UNIQUE NOT NULL,
  "interview_tips_json" JSONB,
  "status" "AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "interviews_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

-- KEEP: knowledge_entries（@@map("knowledge_entries")；embedding 2048 维）
CREATE TABLE IF NOT EXISTS "public"."knowledge_entries" (
  "id" TEXT PRIMARY KEY,
  "content" TEXT NOT NULL,
  "embedding" vector(2048),
  "lang" TEXT NOT NULL,
  "source" TEXT,
  "category" TEXT,
  "is_public" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW()
);

-- KEEP: knowledge_entries 复合索引（@@index([lang, category, isPublic])）
CREATE INDEX IF NOT EXISTS "knowledge_entries_lang_category_is_public_idx"
  ON "public"."knowledge_entries" ("lang", "category", "is_public");

-- KEEP: analytics_events（@@map("analytics_events")）
CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT,
  "event_name" TEXT NOT NULL,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "analytics_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

-- KEEP: analytics_events 索引（两个 @@index）
CREATE INDEX IF NOT EXISTS "analytics_events_event_name_created_at_idx"
  ON "public"."analytics_events" ("event_name", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "analytics_events_user_id_created_at_idx"
  ON "public"."analytics_events" ("user_id", "created_at" DESC);

-- DELETE: 任何针对 "neon_auth" 的 DDL（由 Neon Auth 管理）
-- 例如（示例，禁止加入此文件）：
-- CREATE SCHEMA "neon_auth";
-- CREATE TABLE "neon_auth"."users_sync" (...);
-- CREATE INDEX "users_sync_deleted_at_idx" ON "neon_auth"."users_sync" ("deleted_at");