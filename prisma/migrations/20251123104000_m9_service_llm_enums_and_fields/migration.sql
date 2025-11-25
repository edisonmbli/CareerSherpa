-- Migration: m9_service_llm_enums_and_fields
-- Purpose: Add enums, new columns and indexes for services & llm_usage_logs

-- CreateEnum
CREATE TYPE "public"."ExecutionStatus" AS ENUM (
  'IDLE',
  'SUMMARY_PENDING',
  'SUMMARY_FAILED',
  'SUMMARY_COMPLETED',
  'MATCH_PENDING',
  'MATCH_STREAMING',
  'MATCH_FAILED',
  'MATCH_COMPLETED'
);

-- CreateEnum
CREATE TYPE "public"."FailureCode" AS ENUM (
  'PREVIOUS_OCR_FAILED',
  'PREVIOUS_SUMMARY_FAILED',
  'PREVIOUS_MODEL_LIMIT',
  'JSON_PARSE_FAILED',
  'ZOD_VALIDATION_FAILED',
  'ENQUEUE_FAILED',
  'PROVIDER_NOT_CONFIGURED'
);

-- AlterTable: llm_usage_logs
ALTER TABLE "public"."llm_usage_logs"
  ADD COLUMN "error_code" "public"."FailureCode";

-- AlterTable: services
ALTER TABLE "public"."services"
  ADD COLUMN "current_status" "public"."ExecutionStatus" NOT NULL DEFAULT 'IDLE',
  ADD COLUMN "execution_session_id" TEXT,
  ADD COLUMN "failure_code" "public"."FailureCode",
  ADD COLUMN "last_updated_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "llm_usage_logs_service_id_created_at_idx"
  ON "public"."llm_usage_logs"("service_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "services_current_status_updated_at_idx"
  ON "public"."services"("current_status", "updated_at" DESC);

