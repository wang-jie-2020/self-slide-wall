# Issue tracker: GitHub

本仓库的 issues 和 PRD 使用 GitHub Issues 管理。相关技能应在仓库克隆目录内使用 `gh` CLI 操作 issue，仓库由当前 git remote 推断。

## 约定

- **创建 issue**：`gh issue create --title "..." --body "..."`
- **读取 issue**：`gh issue view <number> --comments`
- **列出 issue**：`gh issue list --state open --json number,title,body,labels,comments`
- **评论 issue**：`gh issue comment <number> --body "..."`
- **应用或移除标签**：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **关闭 issue**：`gh issue close <number> --comment "..."`

## PR 是否作为 triage 入口

**PRs as a request surface: no.**

外部 PR 不纳入 `/triage` 队列。`/triage` 只处理 GitHub Issues；协作者或外部贡献者提交的 PR 不通过这套 issue triage 状态机处理。

## 当技能说“发布到 issue tracker”

创建 GitHub issue。

## 当技能说“获取相关 ticket”

运行 `gh issue view <number> --comments`。
