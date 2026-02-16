-- CreateEnum
CREATE TYPE "public"."AnalyticsCategory" AS ENUM ('SYSTEM', 'BUSINESS', 'SECURITY');

-- AlterTable
ALTER TABLE "public"."analytics_events" ADD COLUMN     "category" "public"."AnalyticsCategory" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "duration" INTEGER DEFAULT 0,
ADD COLUMN     "trace_id" TEXT;

-- CreateIndex
CREATE INDEX "analytics_events_trace_id_idx" ON "public"."analytics_events"("trace_id");

-- CreateIndex
CREATE INDEX "analytics_events_category_created_at_idx" ON "public"."analytics_events"("category", "created_at" DESC);
