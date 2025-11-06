-- Generated via `prisma migrate diff` to sync KnowledgeEntry, Document, DocumentSourceType

-- CreateEnum
CREATE TYPE "public"."DocumentSourceType" AS ENUM ('resume', 'job_description');

-- AlterTable
ALTER TABLE "public"."knowledge_entries" ADD COLUMN     "title" TEXT;

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(2048),
    "user_id" TEXT NOT NULL,
    "source_type" "public"."DocumentSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "metadata" JSONB,
    "chunk_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_user_id_source_type_source_id_idx" ON "public"."documents"("user_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "documents_source_type_created_at_idx" ON "public"."documents"("source_type", "created_at" DESC);