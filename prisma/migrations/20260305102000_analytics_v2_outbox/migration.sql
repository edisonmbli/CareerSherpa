-- CreateEnum
CREATE TYPE "public"."AnalyticsSource" AS ENUM ('ACTION', 'PRODUCER', 'WORKER', 'PUBLIC_SHARE', 'CRON', 'LEGACY');

-- CreateEnum
CREATE TYPE "public"."AnalyticsRuntime" AS ENUM ('NEXTJS', 'HONO_WORKER');

-- CreateEnum
CREATE TYPE "public"."AnalyticsQueueKind" AS ENUM ('STREAM', 'BATCH');

-- CreateEnum
CREATE TYPE "public"."AnalyticsOutcome" AS ENUM ('SUCCESS', 'FAILED', 'GUARD_BLOCKED', 'REPLAYED', 'ACCEPTED');

-- AlterTable
ALTER TABLE "public"."analytics_events"
ADD COLUMN "occurred_at" TIMESTAMP(3),
ADD COLUMN "source" "public"."AnalyticsSource" NOT NULL DEFAULT 'ACTION',
ADD COLUMN "runtime" "public"."AnalyticsRuntime" NOT NULL DEFAULT 'NEXTJS',
ADD COLUMN "service_id" TEXT,
ADD COLUMN "task_id" TEXT,
ADD COLUMN "template_id" TEXT,
ADD COLUMN "queue_kind" "public"."AnalyticsQueueKind",
ADD COLUMN "outcome" "public"."AnalyticsOutcome",
ADD COLUMN "error_code" TEXT,
ADD COLUMN "idempotency_key" TEXT;

-- Aggressive semantic migration:
-- 1) "0" means unknown duration in historical rows
UPDATE "public"."analytics_events"
SET "duration" = NULL
WHERE "duration" = 0;

-- 2) Backfill event occurrence timestamp
UPDATE "public"."analytics_events"
SET "occurred_at" = "created_at"
WHERE "occurred_at" IS NULL;

-- 3) Mark historical records as legacy source
UPDATE "public"."analytics_events"
SET "source" = 'LEGACY'
WHERE "source" = 'ACTION';

-- 4) Lift frequently used dimensions from payload for index-friendly querying
UPDATE "public"."analytics_events"
SET
  "service_id" = COALESCE("service_id", NULLIF("payload"->>'serviceId', '')),
  "task_id" = COALESCE("task_id", NULLIF("payload"->>'taskId', '')),
  "template_id" = COALESCE("template_id", NULLIF("payload"->>'templateId', ''))
WHERE "payload" IS NOT NULL;

-- 5) Normalize nullable duration semantics (remove default)
ALTER TABLE "public"."analytics_events"
ALTER COLUMN "duration" DROP DEFAULT,
ALTER COLUMN "occurred_at" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."analytics_outbox" (
  "id" TEXT NOT NULL,
  "event_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "next_retry_at" TIMESTAMP(3),
  "exported_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_events_event_name_idempotency_key_key" ON "public"."analytics_events"("event_name", "idempotency_key");

-- CreateIndex
CREATE INDEX "analytics_events_service_id_created_at_idx" ON "public"."analytics_events"("service_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_task_id_created_at_idx" ON "public"."analytics_events"("task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_template_id_created_at_idx" ON "public"."analytics_events"("template_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_source_created_at_idx" ON "public"."analytics_events"("source", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_outbox_event_id_key" ON "public"."analytics_outbox"("event_id");

-- CreateIndex
CREATE INDEX "analytics_outbox_exported_at_next_retry_at_created_at_idx" ON "public"."analytics_outbox"("exported_at", "next_retry_at", "created_at" ASC);

-- AddForeignKey
ALTER TABLE "public"."analytics_outbox"
ADD CONSTRAINT "analytics_outbox_event_id_fkey"
FOREIGN KEY ("event_id") REFERENCES "public"."analytics_events"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
