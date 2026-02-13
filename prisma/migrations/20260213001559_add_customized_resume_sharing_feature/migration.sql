-- CreateTable
CREATE TABLE "public"."resume_shares" (
    "id" TEXT NOT NULL,
    "customized_resume_id" TEXT NOT NULL,
    "share_key" TEXT NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "expire_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "resume_shares_customized_resume_id_key" ON "public"."resume_shares"("customized_resume_id");

-- CreateIndex
CREATE UNIQUE INDEX "resume_shares_share_key_key" ON "public"."resume_shares"("share_key");

-- AddForeignKey
ALTER TABLE "public"."resume_shares" ADD CONSTRAINT "resume_shares_customized_resume_id_fkey" FOREIGN KEY ("customized_resume_id") REFERENCES "public"."customized_resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
