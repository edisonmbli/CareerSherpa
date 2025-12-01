-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'OCR_PENDING';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'OCR_FAILED';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'OCR_COMPLETED';

