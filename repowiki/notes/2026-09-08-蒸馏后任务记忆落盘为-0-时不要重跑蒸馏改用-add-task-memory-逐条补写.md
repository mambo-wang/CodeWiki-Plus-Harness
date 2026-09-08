---
type: lesson
title: "蒸馏后任务记忆落盘为 0 时不要重跑蒸馏，改用 add_task_memory 逐条补写"
tags: ["codewiki", "lesson"]
metadata:
  date: 2026-09-08
  related_modules: ["task_manager"]
  severity: medium
  source_ref: "conversations/conv-teammate-message-from-team-lead-from-summary-Initial-task-as.md"
  scene: "蒸馏工作流"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.7.0, at: 2026-09-08T02:48:11Z }
stale_after: 2027-03-07
origin: conversation

---

## 背景

distill-worker 蒸馏未绑定任务（raw 无 task_id）的历史对话时，三次 submit 均 `memories_written: 0`，提取的 8 条任务进度记忆全部未落盘；工具不会因未绑定而报错，只是静默记 0。

## 正确做法

- 不要重跑蒸馏补救：raw 一旦 distilled，prepare 会返回 noop，无法重新提取该条。
- 改用 `add_task_memory` 逐条补写，arguments 形如 `{"task_id": "维护", "repo_path": "d:/repos/CodeWiki-Plus-Harness", "content": "<markdown>"}`。
- 内容聚焦进度事实（哪条已修/未修、未提交改动的仓与文件数、待办），不要写成通用经验——通用经验应走 distill 的 notes 产物。
- 多条补写时顺序执行，避免并发追加丢条。

## 根因

任务记忆只对绑定 task_id 的 raw 有落盘目标（repowiki/tasks/<task_id>/memories/）；未绑定的会话产物无处可写，submit 只报告 memories_written=0。
