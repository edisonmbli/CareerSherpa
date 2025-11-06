-- Ensure pgvector extension and neon_auth users table exist before dependent objects
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS neon_auth;
CREATE TABLE IF NOT EXISTS neon_auth.users_sync (
  id TEXT PRIMARY KEY
);

-- CreateEnum
CREATE TYPE "public"."AsyncTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ServiceStep" AS ENUM ('MATCH', 'CUSTOMIZE', 'INTERVIEW', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."quotas" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payment_waitlist" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_text" TEXT,
    "resume_summary_json" JSONB,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."detailed_resumes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "original_text" TEXT,
    "detailed_summary_json" JSONB,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "detailed_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."services" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "resume_id" TEXT NOT NULL,
    "detailed_resume_id" TEXT,
    "current_step" "public"."ServiceStep" NOT NULL DEFAULT 'MATCH',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."jobs" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "original_text" TEXT,
    "original_image" TEXT,
    "job_summary_json" JSONB,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."matches" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "match_summary_json" JSONB,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."customized_resumes" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "markdown_content" TEXT,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customized_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."interviews" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "interview_tips_json" JSONB,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."knowledge_entries" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(2048),
    "lang" TEXT NOT NULL,
    "source" TEXT,
    "category" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."analytics_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "event_name" TEXT NOT NULL,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."llm_usage_logs" (
    "id" SERIAL NOT NULL,
    "model_name" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotas_user_id_key" ON "public"."quotas"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_waitlist_user_id_key" ON "public"."payment_waitlist"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "resumes_user_id_key" ON "public"."resumes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "detailed_resumes_user_id_key" ON "public"."detailed_resumes"("user_id");

-- CreateIndex
CREATE INDEX "services_user_id_created_at_idx" ON "public"."services"("user_id" DESC, "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_service_id_key" ON "public"."jobs"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "matches_service_id_key" ON "public"."matches"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "customized_resumes_service_id_key" ON "public"."customized_resumes"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "interviews_service_id_key" ON "public"."interviews"("service_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_lang_category_is_public_idx" ON "public"."knowledge_entries"("lang", "category", "is_public");

-- CreateIndex
CREATE INDEX "analytics_events_event_name_created_at_idx" ON "public"."analytics_events"("event_name", "created_at" DESC);

-- CreateIndex
CREATE INDEX "analytics_events_user_id_created_at_idx" ON "public"."analytics_events"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."quotas" ADD CONSTRAINT "quota_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payment_waitlist" ADD CONSTRAINT "payment_waitlist_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resumes" ADD CONSTRAINT "resume_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."detailed_resumes" ADD CONSTRAINT "detailed_resume_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "service_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_detailed_resume_id_fkey" FOREIGN KEY ("detailed_resume_id") REFERENCES "public"."detailed_resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."services" ADD CONSTRAINT "services_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "public"."resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."jobs" ADD CONSTRAINT "jobs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."matches" ADD CONSTRAINT "matches_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customized_resumes" ADD CONSTRAINT "customized_resumes_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."interviews" ADD CONSTRAINT "interviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE SET NULL ON UPDATE CASCADE;
