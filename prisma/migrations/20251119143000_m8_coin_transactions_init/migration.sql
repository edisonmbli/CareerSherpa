-- Migration: m8_coin_transactions_init
-- Purpose: Create coin_transactions table with enums, indexes, and FKs

-- CreateEnum
CREATE TYPE "public"."CoinTxnType" AS ENUM ('SIGNUP_BONUS', 'PURCHASE', 'SERVICE_DEBIT', 'FAILURE_REFUND', 'MANUAL_ADJUST');

-- CreateEnum
CREATE TYPE "public"."CoinTxnStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateTable
CREATE TABLE "public"."coin_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "public"."CoinTxnType" NOT NULL,
    "status" "public"."CoinTxnStatus" NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "service_id" TEXT,
    "task_id" TEXT,
    "template_id" TEXT,
    "message_id" TEXT,
    "idem_key" TEXT,
    "related_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coin_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coin_transactions_user_id_created_at_idx" ON "public"."coin_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "coin_transactions_task_id_created_at_idx" ON "public"."coin_transactions"("task_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "coin_transactions_service_id_created_at_idx" ON "public"."coin_transactions"("service_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "coin_transactions_idem_key_key" ON "public"."coin_transactions"("idem_key");

-- AddForeignKey
ALTER TABLE "public"."coin_transactions"
  ADD CONSTRAINT "coin_transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_transactions"
  ADD CONSTRAINT "coin_transactions_service_id_fkey"
  FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."coin_transactions"
  ADD CONSTRAINT "coin_transactions_related_id_fkey"
  FOREIGN KEY ("related_id") REFERENCES "public"."coin_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;