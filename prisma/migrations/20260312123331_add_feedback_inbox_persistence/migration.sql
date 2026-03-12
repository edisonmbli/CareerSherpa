-- CreateEnum
CREATE TYPE "public"."FeedbackInboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'FAILED');

-- AlterTable
ALTER TABLE "public"."analytics_events" ALTER COLUMN "occurred_at" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "public"."analytics_outbox" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "public"."feedback_inbox" (
    "id" TEXT NOT NULL,
    "feedback_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_email" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "service_id" TEXT,
    "task_id" TEXT,
    "task_template_id" TEXT,
    "context" JSONB NOT NULL,
    "status" "public"."FeedbackInboxStatus" NOT NULL DEFAULT 'PENDING',
    "delivery_attempts" INTEGER NOT NULL DEFAULT 0,
    "last_delivery_error" TEXT,
    "last_delivered_at" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "feedback_inbox_feedback_id_key" ON "public"."feedback_inbox"("feedback_id");

-- CreateIndex
CREATE INDEX "feedback_inbox_status_next_retry_at_created_at_idx" ON "public"."feedback_inbox"("status", "next_retry_at", "created_at" ASC);

-- CreateIndex
CREATE INDEX "feedback_inbox_user_id_created_at_idx" ON "public"."feedback_inbox"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "feedback_inbox_service_id_created_at_idx" ON "public"."feedback_inbox"("service_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "public"."feedback_inbox" ADD CONSTRAINT "feedback_inbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;
