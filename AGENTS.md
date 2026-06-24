## Agent skills

### Issue tracker

本仓库的 issues 和 PRD 使用 GitHub Issues 管理；外部 PR 不纳入 triage 队列。见 `docs/agents/issue-tracker.md`。

### Triage labels

使用默认的五个 triage 标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

使用 single-context 布局：根目录 `CONTEXT.md` 加根目录 `docs/adr/`。见 `docs/agents/domain.md`。

## Local execution notes

- On Windows, start the Next dev server with `npm.cmd`, not bare `npm`.
- On Windows, PowerShell scripts should avoid `$host` as a variable name because `$Host` is built in and read-only.
- If the Next dev server fails with `spawn EPERM` under sandboxing, do not retry repeatedly; use approved dev-server escalation or switch to HTTP-level smoke checks.

