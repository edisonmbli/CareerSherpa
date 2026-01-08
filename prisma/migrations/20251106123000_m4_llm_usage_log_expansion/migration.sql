-- Generated via `prisma migrate diff` from current database to prisma/schema.prisma

-- AlterTable
ALTER TABLE "public"."llm_usage_logs" DROP CONSTRAINT "llm_usage_logs_pkey",
ADD COLUMN     "error_message" TEXT,
ADD COLUMN     "is_stream" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_success" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "latency_ms" INTEGER NOT NULL,
ADD COLUMN     "model_id" TEXT NOT NULL,
ADD COLUMN     "provider" TEXT NOT NULL,
ADD COLUMN     "service_id" TEXT,
ADD COLUMN     "task_template_id" TEXT NOT NULL,
ADD COLUMN     "total_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" TEXT,
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "model_name" DROP NOT NULL,
ALTER COLUMN "cost" DROP NOT NULL,
ALTER COLUMN "cost" SET DATA TYPE DOUBLE PRECISION,
ADD CONSTRAINT "llm_usage_logs_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "llm_usage_logs_id_seq";

-- CreateIndex
CREATE INDEX "llm_usage_logs_user_id_created_at_idx" ON "public"."llm_usage_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "llm_usage_logs_task_template_id_created_at_idx" ON "public"."llm_usage_logs"("task_template_id", "created_at" DESC);