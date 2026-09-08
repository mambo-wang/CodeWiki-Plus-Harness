---
type: pitfall
title: "subprocess.run(timeout=) 对 git 这类多子进程命令无效，会卡死整个 MCP 事件循环"
tags: ["pitfall"]
metadata:
  date: 2026-09-04
  related_modules: ["git-sync", "mcp-server"]
  severity: high
  source_ref: "conversations/conv-user_command-commands-codewiki-初始化多仓WIKI工作区-请把当前工作目录初始化（或重新同.md"
  scene: "MCP 性能优化"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:42:02Z }
stale_after: 2027-03-03
origin: conversation

---

## 背景

集中式工作区跑全量 MCP 走查时，`lint_wiki(checks=["all"])` 请求超时，首次 `write_doc_file` 也超时（但重放报 `File already exists`，说明实际已落盘）。离线逐项跑完 22 项 lint 检查总共只要约 1.6 秒，说明慢不在 lint 本身。

## 根因

`git_sync.sync_check` 里的 `git fetch` **实测耗时 204.86 秒**，而名义上的 15 秒超时完全失效：

- `subprocess.run(timeout=)` 超时后只 kill **直接子进程**（`git`），而 `git` 会派生 `git-remote-https` 等孙进程；
- 孙进程**继承了同一个 stdout/stderr 管道**，`run()` 在 kill 之后仍死等管道关闭，于是阻塞不返回。

放大效应：MCP 是 **stdio 异步服务**，这段同步阻塞代码会**卡住整个事件循环**，导致排在后面的 `lint_wiki` 请求连带超时——所以两个超时是同一个根因。

## 正确做法

新增 `run_git_bounded()`：`Popen` + `communicate(timeout)`，超时后**杀整棵进程树**（`psutil`；不可用则回退 `proc.kill()`），且不再等待继承的管道。`_run_git` / `_run_git_result` 与 `team_layout._run_git` 统一改为调用它。

实测：`sync_check` 从 **204.86s → 3.21s**，相关测试 167 passed / 1 skipped / 0 failed；服务端重启后 `lint_wiki(checks=["all"])` 完整返回（18 项），首次 `write_doc_file` 也正常返回。

## 适用范围

任何在**异步服务**（MCP stdio server、asyncio 服务）里调用 `subprocess` 跑 git / npm / 构建类“会派生子进程”的外部命令处，都不能依赖 `subprocess.run(timeout=)`；同时要意识到同步阻塞会拖垮整个事件循环，而不只是那一个请求。

## 顺带发现的同类隐患

写回归测试时暴露 `resolve_session()` 在 `store=None` 且传了 `repo_path` 时直接 `AttributeError`（`NoneType.find_or_restore`）。服务端总是传 store 所以线上不触发，但属同类防御缺口，已在两个分支加 `store is None` 守卫。
