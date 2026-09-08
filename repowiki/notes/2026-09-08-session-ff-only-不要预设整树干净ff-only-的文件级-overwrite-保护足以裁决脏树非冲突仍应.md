---
type: lesson
title: "session_ff_only 不要预设整树干净：ff-only 的文件级 overwrite 保护足以裁决，脏树非冲突仍应快进"
tags: ["lesson"]
metadata:
  date: 2026-09-08
  task_id: 维护
  related_modules: ["git_sync"]
  severity: medium
  source_ref: "raw\\conv-当前是集中式多仓工作区，是不是应该在生成wiki或者说蒸馏对话后自动提交推送.md"
  scene: "git_sync 自动同步改造"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.7.0, at: 2026-09-08T02:51:17Z }
stale_after: 2027-03-07
---

## 背景

实现 `session_ff_only` 时加了一个整树预 gate：`status --porcelain` 非空就跳过（「工作树必须干净」前置条件）。用户质疑：工作区不干净不一定有冲突，不该影响 pull。

## 决策（用户纠正后被采纳）

移除 clean-tree 预检查，改为直接 `git pull --ff-only`，**由 git 自身的 overwrite 保护按文件裁决**：

| 场景 | 行为 |
|---|---|
| 工作树干净 | pull（不变） |
| 工作树脏，远端更新不触碰脏文件 | 正常 ff-only 快进，本地改动保留 |
| 工作树脏，远端更新触碰脏文件（跟踪/未跟踪） | git 拒绝并保持原样，报告 `would be overwritten` |
| 远端与本地分叉 | 拒绝并报告 |

失败时按 stderr 区分两类原因给可操作提示：重叠被拒 → 「请先提交/暂存本地改动后手动同步」（本地未被改动）；分叉/网络 → 原文案。

## 教训

`git pull --ff-only` 在尝试更新某个路径前会检查该路径是否有未提交改动，有则拒绝且**不写任何东西**——真正的冲突只在文件级发生。自定义的整树 status 探测既多余又过度保守，会掩盖「脏但无冲突」的合法快进。类似的自动 git 逻辑应信任 git 自身的保护机制，而不是预先 gate 掉整棵工作树。每进程每仓一次的 guard（`_ff_pulled_repos`）仍保留，保证零重复。
