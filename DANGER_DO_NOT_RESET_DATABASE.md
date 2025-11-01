# ⚠️ 危险操作警告 ⚠️

## 🚫 绝对不能执行的命令

```bash
# 这些命令会删除所有数据！！！
npx prisma migrate reset
npx prisma migrate reset --force
npx prisma db push --reset
```

## ✅ 安全的数据库更新方式

### 1. 更新 schema 后推送到数据库
```bash
npx prisma db push
```

### 2. 生成客户端
```bash
npx prisma generate
```

### 3. 如果需要创建迁移文件（但不要重置）
```bash
npx prisma migrate dev --create-only
# 然后手动检查迁移文件，确保不会删除数据
```

## 📝 重要提醒

- **生产环境有重要数据，绝对不能重置！**
- **使用 `prisma db push` 来安全地同步 schema 变更**
- **如果遇到 drift 警告，使用 `--accept-data-loss` 标志要极其谨慎**
- **任何涉及 reset 的操作都需要用户明确确认**

## 🔄 正确的工作流程

1. 修改 `prisma/schema.prisma`
2. 运行 `npx prisma db push`
3. 运行 `npx prisma generate`
4. 测试应用程序

**记住：数据是珍贵的，一旦删除就无法恢复！**

## 📚 迁移重构经验记录

**问题背景：**
- Prisma Schema 中 `TaskKind` 枚举定义了 7 个值：`match, customize, interview, extract, resume, job, detailed`
- 数据库中实际只有 3 个值：`match, customize, interview`
- 历史迁移文件不完整，导致 schema 与数据库状态不同步

**解决方案：**
1. **使用 `prisma db push` 而非 `migrate reset`**
   ```bash
   npx prisma db push
   ```
   - 这个命令安全地将 schema 变更推送到数据库
   - 不会删除现有数据
   - 自动添加缺失的枚举值

2. **验证同步结果**
   ```bash
   npx tsx -e "
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();
   const result = await prisma.\$queryRaw\`SELECT unnest(enum_range(NULL::\"TaskKind\")) as value;\`;
   console.log(result);
   "
   ```

3. **创建完整测试验证**
   - 创建包含所有依赖关系的测试脚本
   - 测试所有 TaskKind 枚举值的 Task 创建
   - 确保外键约束正确工作

**关键经验：**
- ✅ `prisma db push` 是同步 schema 变更的安全方式
- ✅ 总是先验证数据库状态再进行操作
- ✅ 创建完整的测试脚本验证修复效果
- ❌ 避免使用 `migrate reset` 除非确实需要重置
- ❌ 不要忽略外键约束，确保测试数据完整性

**测试验证：**
所有 TaskKind 枚举值（match, customize, interview, extract, resume, job, detailed）的 Task 创建功能已验证正常工作。