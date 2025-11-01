-- 修复外键约束不一致问题
-- 1. 将所有业务表的 user_id 字段从 uuid 类型改为 text 类型
-- 2. 将外键约束从 users 表改为 neon_auth.users_sync 表

-- 首先删除所有现有的外键约束
ALTER TABLE "public"."resumes" DROP CONSTRAINT IF EXISTS "resumes_user_id_fkey";
ALTER TABLE "public"."detailed_resumes" DROP CONSTRAINT IF EXISTS "detailed_resumes_user_id_fkey";
ALTER TABLE "public"."job_descriptions" DROP CONSTRAINT IF EXISTS "job_descriptions_user_id_fkey";
ALTER TABLE "public"."services" DROP CONSTRAINT IF EXISTS "services_user_id_fkey";
ALTER TABLE "public"."tasks" DROP CONSTRAINT IF EXISTS "tasks_user_id_fkey";
ALTER TABLE "public"."quotas" DROP CONSTRAINT IF EXISTS "quotas_user_id_fkey";
ALTER TABLE "public"."payments" DROP CONSTRAINT IF EXISTS "payments_user_id_fkey";
ALTER TABLE "public"."token_usage_logs" DROP CONSTRAINT IF EXISTS "token_usage_logs_user_id_fkey";
ALTER TABLE "public"."audit_logs" DROP CONSTRAINT IF EXISTS "audit_logs_user_id_fkey";

-- 将 user_id 字段从 uuid 类型改为 text 类型
ALTER TABLE "public"."resumes" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."detailed_resumes" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."job_descriptions" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."services" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."quotas" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."payments" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."token_usage_logs" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;
ALTER TABLE "public"."audit_logs" ALTER COLUMN "user_id" TYPE text USING "user_id"::text;

-- 创建指向 neon_auth.users_sync 表的新外键约束
ALTER TABLE "public"."resumes" ADD CONSTRAINT "resumes_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."detailed_resumes" ADD CONSTRAINT "detailed_resumes_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."job_descriptions" ADD CONSTRAINT "job_descriptions_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."services" ADD CONSTRAINT "services_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."quotas" ADD CONSTRAINT "quotas_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."token_usage_logs" ADD CONSTRAINT "token_usage_logs_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" 
    FOREIGN KEY ("user_id") REFERENCES "neon_auth"."users_sync"("id") ON DELETE RESTRICT ON UPDATE CASCADE;