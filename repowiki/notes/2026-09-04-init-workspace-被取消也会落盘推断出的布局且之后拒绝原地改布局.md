---
type: pitfall
title: "init_workspace 被取消也会落盘推断出的布局，且之后拒绝原地改布局"
tags: ["pitfall"]
metadata:
  date: 2026-09-04
  related_modules: ["init-workspace", "workspace-layout", "harness"]
  severity: medium
  source_ref: "conversations/conv-user_command-commands-codewiki-初始化多仓WIKI工作区-请把当前工作目录初始化（或重新同.md"
  scene: "工作区初始化"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:42:04Z }
stale_after: 2027-03-03
origin: conversation

---

## 背景

在一个已有 `bootstrap.*` + `.gitignore` + `repowiki/` 的 harness 目录执行初始化，Agent 因目录看起来已初始化而**跳过了布局确认**；调用被用户取消后，工具仍写入了 `repowiki/.meta/workspace.json`（内容仅 `{"wiki_layout": "colocated"}`），而该值是从现有 `AGENTS.md` 的两跳描述**推断**出来的。随后显式传 `layout="centralized"` 重跑被拒：`workspace already initialized with layout 'colocated'`。

根因：布局持久化写在流程较早阶段，**取消/失败不回滚**。

## 正确做法

1. **只要 `repowiki/.meta/workspace.json` 不存在**（无论 `bootstrap.*` / `.gitignore` / `repowiki/` 是否已有），一律视为首次初始化，必须先向用户确认 `colocated` 还是 `centralized`。目录骨架齐备 ≠ 布局已选定。
2. **布局切换是手工迁移**，不要偷偷改状态文件绕过：改写 `workspace.json` 的 `wiki_layout`，再跑无参 `init_workspace()` 同步。迁移前先确认成本（当时业务仓尚未克隆，无机知识需搬迁，成本为零）。
3. **`clone-only` 模式不刷新 AGENTS.md 约定块**。要强制刷新必须让 traces 不全——临时移走 `bootstrap.sh` 与 `bootstrap.ps1`（**两者必须同时缺失**，否则报 `only one bootstrap script exists`）。这会**清空登记表**，之后要用 `add_workspace_repo` 重新登记。
4. `add_workspace_repo` 的目录名取自 URL 最后一段的大小写，可能与既有克隆目录不一致，需手工对齐磁盘目录名并清理旧条目。

## 校验标准

复跑 `init_workspace()` 应返回 `mode="clone-only"`、目标 layout、`clones: <repo> skipped (already cloned)`、`warnings: []`；且 `git status` 只出现 harness 资产变更（`.gitignore`、`AGENTS.md`、`bootstrap.*`、`repo-map.md`、`workspace.json`、`wiki/modules/`），**业务仓目录不应出现**（出现即 `.gitignore` 失效）。

## 注意

初始化完成后**不要自动生成 wiki**（不调 `init_wiki` / `analyze_repo` / `analyze_workspace`），等用户显式要求。
