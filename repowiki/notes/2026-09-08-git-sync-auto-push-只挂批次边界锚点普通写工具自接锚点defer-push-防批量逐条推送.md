---
type: architecture
title: "git_sync auto_push 只挂批次边界锚点：普通写工具自接锚点、defer_push 防批量逐条推送"
tags: ["architecture"]
metadata:
  date: 2026-09-08
  task_id: 维护
  related_modules: ["git_sync", "mcp-registry"]
  severity: high
  source_ref: "raw\\conv-当前是集中式多仓工作区，是不是应该在生成wiki或者说蒸馏对话后自动提交推送.md"
  scene: "git_sync 自动同步改造"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.7.0, at: 2026-09-08T02:51:02Z }
stale_after: 2027-09-08
origin: conversation

---

## 背景

用户把 repowiki/schema.yaml 的 `auto_push` 改成 true 后，新生成的笔记仍不自动提交。排查发现：`auto_push` 全仓只有 4 个调用点，全部是批次边界——`close_session`(close_session.py:288)、`distill_submit`(distill_conversation.py:1786)、`capture_conversation`(capture_conversation.py:443)、`batch_ingest`(batch_ingest.py:173)。而 `ingest_note`(note_ingest.py:461) 与 `write_doc_file`(doc_writer.py:1560) 只调 `sync_check`——那是只读的远端漂移告警，「不阻断、不改动工作区」。所以通过 ingest_note 生成的笔记，无论 auto_push 是 true/false 都不会自动提交。这是设计文档写死的决策（锚点=批次边界），不是 bug。

## 决策/正确做法（2026-09-08 已实现并验证）

- **每个自身落盘的写工具**应在 return 前接 auto_push 锚点，范式与 close_session 一致：try/except 包裹，失败只 debug 日志，绝不阻断。本轮先接入 `ingest_note`、`write_doc_file`。
- **批量驱动必须抑制逐条推送**：`batch_ingest.py:81` 直接调 `handle_ingest_note`，若各条目自推会产生 N 次 commit+push。新增 `git_sync.defer_push(output_dir)` context manager，`auto_push` 内检查 `str(repo_root) in _deferred_repos` 则 `return None`。按 **repo_root** 粒度抑制（不是 output_dir），批量条目各自带 output_dir 也能命中；异常安全（finally 中 discard）。
- **其余 10 个写工具**（edit_doc_file/confirm_note/reject_note/batch_set_status/ingest_source/retract_source/consolidate_notes/refresh_doctrine/flag_issue/stamp_evidence）各自 handler 出口多、逐个插桩必漏，改在 `mcp/registry.py` dispatch 层统一收口：`_PUSH_ON_WRITE` frozenset，新增 helper `git_sync.auto_push_into_result()` 把结果合并进 JSON 返回。已自推的 6 个（close_session/capture/distill/batch_ingest/ingest_note/write_doc_file）故意不在集合内，避免一次调用推两次。
- **不接入的类别**：tasks/ 类 8 个（create_task/add_task_memory/complete_task/set_session_task/compact_task_memories 等，频次高、逐次 push 拖慢、close_session 已兜底）；init 类一次性工具（init_wiki/init_workspace/add_workspace_repo，人工提交更合适）；已被 .gitignore 排除的（save_module_tree/analyze 系列写 .meta/*.json、.codewiki/，接了也没用）。

## 为什么不会误提交业务代码

1. `git add -A -- <rel>`，rel 是 repowiki 相对路径，只暂存知识子树；2. pre_staged guard：暂存区已有用户改动就跳过并提示先 stash；3. 无 upstream 分支时短路为「只本地提交、不推送」。D17 workspace-root gate 于同日移除（另见 decision 笔记），业务仓跑写工具时已无此守卫，但子树 add + pre_staged 仍兜底。
