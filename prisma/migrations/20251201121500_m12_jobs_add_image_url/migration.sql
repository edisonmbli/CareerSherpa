-- Migration: m12_jobs_add_image_url
-- Purpose: Align DB with prisma/schema.prisma Job changes
-- Safe ops: use IF NOT EXISTS and DROP NOT NULL (idempotent)

-- 1) Add image_url column (nullable), if missing
ALTER TABLE "public"."jobs"
  ADD COLUMN IF NOT EXISTS "image_url" text;

-- 2) Ensure original_image is nullable (drop NOT NULL if present)
ALTER TABLE "public"."jobs"
  ALTER COLUMN "original_image" DROP NOT NULL;

-- Note:
-- - ADD COLUMN IF NOT EXISTS guards against prior existence.
-- - DROP NOT NULL is harmless if column is already nullable.
-- - No data movement; purely schema alignment.

