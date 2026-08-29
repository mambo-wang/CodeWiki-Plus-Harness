---
type: pitfall
title: "centralized 布局下 AnalysisCache/SessionWorkspace 默认按 repo_path 落盘，污染纯代码业务仓"
tags: ["pitfall"]
aliases: ["default_cache_db", "centralized 缓存落盘", "业务仓纯代码", "analysis_cache.db 位置"]
metadata:
  date: 2026-08-29
  related_modules: ["codewiki-plus"]
  severity: medium
  root_cause: "AnalysisCache/SessionWorkspace 默认路径按 repo_path/.codewiki 落盘，centralized 布局下业务仓绝对路径被直接当 repo_path 传入，缺少布局分流；resolve_workspace 探测能力未被缓存层使用。"
status: stable
generated: { by: codewiki/5.4.5, at: 2026-08-29T08:39:35Z }
stale_after: 2027-02-25
---

## 背景

集中式布局（harness 主仓 + 子目录业务仓）下，analyze_workspace/analyze_repo 分析业务仓 `go-my-harness` 时，SQLite 缓存 `analysis_cache.db` 被写进业务仓 `go-my-harness/.codewiki/`，污染了纯代码业务仓，违反 AGENTS.md 提交纪律（业务仓只提交业务代码）。

## 正确做法

- centralized 布局下，业务仓的缓存与会话工作区数据一律落在 harness 根 `.codewiki/<业务仓目录>/`（如 `<ws>/.codewiki/go-my-harness/`）。
- 缓存 DB 路径统一由 `codewiki/mcp/cache.py` 的 `default_cache_db(repo_path)` 解析：centralized member → `<ws>/.codewiki/<first>/analysis_cache.db`；standard → `repo_path/.codewiki/analysis_cache.db`。
- `SessionWorkspace` 同样重定向：centralized member → `<ws>/.codewiki/<first>/workspace`。
- `workspace_analyzer.py` 等上层无须感知布局，交给 `default_cache_db` / `SessionWorkspace` 统一分流。

## 根因

`AnalysisCache.__init__` 与 `SessionWorkspace.__init__` 的默认路径都是 `repo_path/.codewiki/...`，而 centralized 布局下业务仓绝对路径被直接当作 `repo_path` 传入，缓存路径解析缺少布局分流。`workspace_layout.resolve_workspace` 的布局探测能力已存在，但缓存层未使用它。

## 适用范围

- 涉及 codewiki-plus MCP 缓存层：`codewiki/mcp/cache.py`、`codewiki/mcp/workspace.py`、`codewiki/mcp/tools/analysis.py`。
- 排查“业务仓 `.codewiki/` 出现缓存/SQLite”类问题时，优先检查 centralized 布局的路径分流。
