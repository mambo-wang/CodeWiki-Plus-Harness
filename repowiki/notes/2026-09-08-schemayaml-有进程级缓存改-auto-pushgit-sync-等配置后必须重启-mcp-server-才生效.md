---
type: pitfall
title: schema.yaml 有进程级缓存：改 auto_push/git_sync 等配置后必须重启 MCP server 才生效
tags:
- pitfall
metadata:
  date: 2026-09-08
  task_id: 维护
  related_modules:
  - page_router
  - git_sync
  severity: medium
  source_ref: conversations/conv-当前是集中式多仓工作区，是不是应该在生成wiki或者说蒸馏对话后自动提交推送.md
  scene: git_sync 配置排查
status: stable
author: iamwangbao-163-com
generated:
  by: codewiki/5.7.0
  at: 2026-09-08 02:51:07+00:00
stale_after: '2027-03-07'
origin: conversation
verified:
- by: codewiki/5.7.0
  at: '2026-09-08T02:52:20Z'
---

## 背景

用户把 repowiki/schema.yaml 的 `auto_push` 改成 true 后不生效，误以为功能坏了。

## 根因

`page_router.py` 的 schema 加载有**进程级缓存**：`_schema_cache: Dict[str, dict]` + `load_schema()` 以 `str(output_dir.resolve())` 为 key，命中即返回——无 mtime 校验、无 TTL。MCP server 是 stdio 长驻进程，启动后改 yaml，`_resolve_auto_push` 读到的仍是启动时缓存的旧值。

## 正确做法

改任何 schema.yaml（git_sync.mode / auto_push / session_ff_only 等）后**必须重启 MCP server**。

## 附带：无 upstream 分支是「改 true 仍不提交」的第三个原因

本仓分支 `test/centralized-mcp-sweep` 没有 upstream（`git push` 无目标必然失败），旧逻辑会因此空转 fetch+rebase 重试 ≤5 次。已加短路返回「知识变更已提交到本地（当前分支未配置 upstream，跳过推送）」。要真正推送需先 `git push -u origin <branch>`。

## 验证方法

看工具返回值里有没有 `git_sync(auto_push): 已推送知识变更(...)` 行；没有则可能被 guard 拦（暂存区已有改动 / add 后无 staged 内容 / 唯一 staged 是 *.lck / 无 upstream）。
