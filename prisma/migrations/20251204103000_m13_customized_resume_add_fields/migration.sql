-- Migration: m13_customized_resume_add_fields
-- Purpose: Align DB with updated CustomizedResume model
-- Safe ops: add new nullable columns with IF NOT EXISTS; no drops

ALTER TABLE "public"."customized_resumes"
  ADD COLUMN IF NOT EXISTS "optimize_suggestion" text,
  ADD COLUMN IF NOT EXISTS "customized_resume_json" jsonb,
  ADD COLUMN IF NOT EXISTS "edited_resume_json" jsonb,
  ADD COLUMN IF NOT EXISTS "section_config" jsonb;

-- Notes:
-- - Columns are nullable to avoid data backfill requirements.
-- - We intentionally do not DROP legacy columns (e.g., markdown_text, ops_json)
--   to keep the operation non-destructive. Prisma will ignore extra columns.

