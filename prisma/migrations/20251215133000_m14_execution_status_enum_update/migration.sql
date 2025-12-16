-- Migration: m14_execution_status_enum_update
-- Purpose: Sync public.ExecutionStatus enum values with updated Prisma model
-- Notes:
-- - Adds new enum values for CUSTOMIZE_* and INTERVIEW_* phases.
-- - Uses individual ALTER TYPE ... ADD VALUE statements for compatibility.
-- - Safe operation: adding enum values is non-destructive.

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'CUSTOMIZE_PENDING';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'CUSTOMIZE_FAILED';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'CUSTOMIZE_COMPLETED';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'INTERVIEW_PENDING';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'INTERVIEW_FAILED';
ALTER TYPE "public"."ExecutionStatus" ADD VALUE 'INTERVIEW_COMPLETED';

