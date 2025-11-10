-- Migration: m6_rag_cleanup_remove_documents_enum
-- Purpose:
-- 1) Update KnowledgeEntry: align updated_at behavior (drop default)
-- 2) Remove deprecated resources: documents table and DocumentSourceType enum

-- Alter KnowledgeEntry (public.knowledge_entries)
ALTER TABLE "public"."knowledge_entries" ALTER COLUMN "updated_at" DROP DEFAULT;

-- Drop deprecated table (if exists safeguard)
DROP TABLE "documents";

-- Drop deprecated enum type
DROP TYPE "DocumentSourceType";