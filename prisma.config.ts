import { defineConfig } from 'prisma/config'
import { config } from 'dotenv'

// 加载 .env.local 文件（Next.js 风格的环境变量）
config({ path: '.env.local' })

export default defineConfig({
  experimental: { externalTables: true },
  // 如果你的 schema 文件不在默认位置，可显式指定：
  // schema: "prisma/schema.prisma",

  tables: {
    external: [
      // 完全限定名：schema.table
      'neon_auth.users_sync',
    ],
  },

  migrations: {
    // 供 shadow DB 在生成迁移前执行的初始化 SQL
    initShadowDb: `
      -- 确保存在 neon_auth schema
      CREATE SCHEMA IF NOT EXISTS neon_auth;

      -- 在影子库创建占位表（主键列必须存在，其它列按需）
      CREATE TABLE IF NOT EXISTS neon_auth.users_sync (
        id TEXT PRIMARY KEY,
        deleted_at TIMESTAMPTZ(6)
      );

      -- 影子库启用 pgvector，避免类型不存在
      CREATE EXTENSION IF NOT EXISTS vector;
    `,
  },
})
