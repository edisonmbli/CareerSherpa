-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."FailureCode" ADD VALUE 'STREAM_EMPTY';
ALTER TYPE "public"."FailureCode" ADD VALUE 'LLM_LOGIC_REFUSAL';
ALTER TYPE "public"."FailureCode" ADD VALUE 'TEMPLATE_LEAKAGE';
ALTER TYPE "public"."FailureCode" ADD VALUE 'EMPTY_RESPONSE';
