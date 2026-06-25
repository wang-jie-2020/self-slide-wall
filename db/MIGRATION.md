# 数据库迁移动作说明

本文档记录本项目已落地的 Prisma 迁移，以及后续新增迁移的执行规范。

## 1. 已落地迁移动作

迁移目录：`prisma/migrations`

1. `20260624024400_init`
- 新建表：`HostAccount`、`Activity`、`AudienceSession`
- 新建约束：
  - `Activity.ownerId -> HostAccount.id`
  - `AudienceSession.activityId -> Activity.id`
- 新建索引：
  - `Activity_accessCode_key`（`Activity.accessCode` 唯一）

2. `20260624033000_add_activity_soft_delete`
- `Activity` 新增字段：`deletedAt DATETIME NULL`
- 用于活动软删除能力

3. `20260624071000_add_audience_questions`
- 新建表：`AudienceQuestion`
- 新建约束：
  - `AudienceQuestion.activityId -> Activity.id`
  - `AudienceQuestion.audienceSessionId -> AudienceSession.id`
- 新建索引：
  - `AudienceQuestion_activityId_isHidden_isAnswered_createdAt_idx`

4. `20260624080000_add_question_likes`
- 新建表：`QuestionLike`
- 新建约束：
  - `QuestionLike.audienceQuestionId -> AudienceQuestion.id`（`ON DELETE CASCADE`）
  - `QuestionLike.audienceSessionId -> AudienceSession.id`（`ON DELETE CASCADE`）
- 新建索引：
  - 唯一索引 `QuestionLike_audienceQuestionId_audienceSessionId_key`
  - 普通索引 `QuestionLike_audienceQuestionId_idx`

5. `20260624120000_add_polls`
- 新建表：`Poll`、`PollOption`、`PollVote`
- 新建约束：
  - `Poll.activityId -> Activity.id`
  - `PollOption.pollId -> Poll.id`
  - `PollVote.pollId -> Poll.id`
  - `PollVote.pollOptionId -> PollOption.id`
  - `PollVote.audienceSessionId -> AudienceSession.id`
- 新建索引：
  - `Poll_activityId_sortOrder_idx`
  - `PollOption_pollId_sortOrder_idx`
  - 唯一索引 `PollVote_pollId_audienceSessionId_key`
  - `PollVote_pollId_idx`
  - `PollVote_pollId_pollOptionId_idx`

## 2. 新增迁移标准流程

当前数据源：SQLite（`DATABASE_URL="file:./dev.db"`，对应 `prisma/dev.db`）。

1. 修改 `prisma/schema.prisma`
2. 生成并应用迁移（本地开发库）

```powershell
npx prisma migrate dev --name <migration_name>
```

3. 重新生成 Prisma Client（如命令未自动生成时）

```powershell
npx prisma generate
```

4. 提交以下内容到仓库
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_<migration_name>/migration.sql`
- `prisma/migrations/migration_lock.toml`（如有变化）

## 3. 环境执行动作

1. 本地快速同步（非迁移，适合测试场景）

```powershell
npx prisma db push --skip-generate
```

2. 部署环境执行迁移（按已提交迁移顺序）

```powershell
npx prisma migrate deploy
```

## 4. 变更注意事项

1. 优先使用 `migrate dev` 产出可追溯 SQL，不要长期依赖 `db push` 替代正式迁移。
2. 破坏性变更（删列、改类型）必须先评估数据保留与兼容策略。
3. SQLite 回滚建议通过备份库文件恢复，不建议手写逆向 SQL 临时回滚。
