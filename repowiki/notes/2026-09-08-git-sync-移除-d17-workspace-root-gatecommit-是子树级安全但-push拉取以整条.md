---
type: decision
title: "git_sync 移除 D17 workspace-root gate：commit 是子树级安全，但 push/拉取以整条 branch 为发布单元"
tags: ["decision"]
metadata:
  date: 2026-09-08
  task_id: 维护
  related_modules: ["git_sync"]
  severity: high
  source_ref: "raw\\conv-当前是集中式多仓工作区，是不是应该在生成wiki或者说蒸馏对话后自动提交推送.md"
  scene: "git_sync 自动同步改造"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.7.0, at: 2026-09-08T02:51:12Z }
stale_after: 2027-09-08
---

## 背景

D17 gate（`_is_workspace_root_repo`：repowiki 所在仓必须是有 `.meta/workspace.json` 的 workspace root）原先保护「同仓含业务代码时不自动同步」。用户提出去掉 D17，让 repowiki 与业务代码同仓（colocated）也能自动提交 repowiki 相关文件。

## 决策（2026-09-08，用户拍板 + mock 干跑验证）

- **auto_push 移除 D17**。期间先加过一道「push 前检查领先提交含非知识树文件则跳过」的防护，用户明确说「推送的业务提交会被工具顺手推上去——没问题呀，可以推，不用加防护」，故该防护一并移除。保留的唯一判断是**无 upstream 短路**——那不是内容审查，纯粹是没 upstream 时 push 必然失败、不短路会空转重试。
- **session_ff_only 同步移除 D17**，删除不再有调用点的 `_is_workspace_root_repo()`，并清理 7 处过时注释（各 auto_push 锚点仍写 「enabled and gated (D17)」，与实际行为矛盾）。

## Rationale / 语义边界

- `git add -A -- repowiki` 只暂存知识子树，**commit 是子树级安全**。
- 但 **branch 是发布单元**：auto_push 的 push 会携带整条分支领先远端的全部提交（含业务提交）；session ff-only pull 会快进整条分支的工作树（不止知识路径）。对集中式 harness（repowiki 独立根仓）无影响；对 colocated 仓意味着业务提交会被一起推走/业务路径会被一起快进——用户接受该语义。
- 拉取安全性不依赖 D17，而依赖 `--ff-only`（分叉则拒绝，绝不 merge/rebase）与 git 自身的文件级 overwrite 保护。
