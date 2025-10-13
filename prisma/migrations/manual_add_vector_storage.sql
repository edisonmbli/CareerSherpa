-- Manual migration to add vector storage tables
-- Run this manually on the database after enabling pgvector extension

-- Enable pgvector extension if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- Create DocumentSourceType enum
CREATE TYPE "public"."DocumentSourceType" AS ENUM ('resume', 'job_description', 'detailed_resume', 'knowledge_base', 'user_upload');

-- CreateTable: documents
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB,
    "sourceType" "public"."DocumentSourceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chunk_index" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable: knowledge_entries
CREATE TABLE "public"."knowledge_entries" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "category" TEXT,
    "tags" TEXT[],
    "metadata" JSONB,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documents_user_id_sourceType_source_id_idx" ON "public"."documents"("user_id", "sourceType", "source_id");

-- CreateIndex
CREATE INDEX "documents_sourceType_source_id_idx" ON "public"."documents"("sourceType", "source_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_user_id_category_idx" ON "public"."knowledge_entries"("user_id", "category");

-- CreateIndex
CREATE INDEX "knowledge_entries_is_public_category_idx" ON "public"."knowledge_entries"("is_public", "category");

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."knowledge_entries" ADD CONSTRAINT "knowledge_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;