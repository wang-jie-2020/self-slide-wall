# 0002: MVP 技术栈

| 层面 | 选择 | 备注 |
|---|---|---|
| 前端框架 | Next.js (App Router) | API Routes 同时做 BFF |
| 数据库 | SQLite | `.db` 文件放仓库目录，`git clone` 即运行 |
| ORM | Prisma | `prisma migrate` 管理迁移，声明式 schema |
| UI | Tailwind CSS + shadcn/ui | shadcn/ui 是源码拷贝，非 npm 依赖 |
| 实时更新 | SWR + 2s 短轮询 | `useSWR(key, fetcher, { refreshInterval: 2000 })` |
| 鉴权 | 示例主持账号，观众无鉴权 | 按 PRD：MVP 不做完整账号系统 |
| 测试 | Vitest + Testing Library | 以 API Route 行为测试为主（活动缝合点） |
| 部署 | 本地调优先 | 上线方案后续决定 |

## 约束

- SQLite 单文件串行写入，不适合无服务器环境（Vercel）。MVP 阶段本地调试优先，上线需迁移数据库或部署方式
- 短轮询在 200 活跃会话、2s 间隔下约 100 req/s
- Prisma 切换数据源（SQLite → PG）只需改 `datasource` 配置

