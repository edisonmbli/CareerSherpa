-- Migration: m7_customized_resume_update
-- Purpose: Align public.customized_resumes with updated Prisma model

-- Alter CustomizedResume table
ALTER TABLE "public"."customized_resumes" 
  DROP COLUMN "markdown_content",
  ADD COLUMN "degrade_reason" TEXT,
  ADD COLUMN "markdown_text" TEXT,
  ADD COLUMN "ops_json" JSONB;