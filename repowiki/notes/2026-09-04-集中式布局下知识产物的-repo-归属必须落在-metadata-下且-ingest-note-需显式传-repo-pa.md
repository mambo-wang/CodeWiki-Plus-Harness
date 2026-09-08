---
type: pitfall
title: "集中式布局下知识产物的 repo 归属必须落在 metadata 下，且 ingest_note 需显式传 repo_path"
tags: ["codewiki", "pitfall"]
metadata:
  date: 2026-09-04
  related_modules: ["workspace-layout", "knowledge-loop", "doc-writer"]
  severity: medium
  source_ref: "conversations/conv-user_command-commands-codewiki-初始化多仓WIKI工作区-请把当前工作目录初始化（或重新同.md"
  scene: "集中式布局适配"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:42:03Z }
stale_after: 2027-03-03
origin: conversation

---

## 背景

集中式工作区中，共享池页面（`notes/`、`wiki/entities|concepts|comparisons|queries|sources/`）靠 frontmatter 的 `repo:` / `repos:` 标注适用仓。写入侧有两个不一致，导致归属丢失或被 lint 判违规。

## 两个坑与现状

**1. `ingest_note` 只传 `output_dir` 不会自动打 `repo:` 归属标**

`workspace_layout.routing_for_write`（`workspace_layout.py:195`）要求**同时传 `repo_path`** 才能判定写方仓；只给 `output_dir` 时无法推断，静默降级为全局（global），`lint_wiki` 只会报一条 info：`shared-pool page has no repo:/repos: provenance`。

→ 正确做法：写共享池时**显式传 `repo_path`**，才能得到 `repo: "CodeWiki-Plus"` 标注。

**2. 归属字段位置不一致（已修）**

`ingest_note` 把 `repo:` 写在 `metadata:` 节点下（OKF 合规），而 `write_doc_file` 写共享池页时走 `merge_provenance()`（`doc_writer.py:1433`），它把规范行**直接插在开头 `---` 之后**（顶层）→ 场景页被 `okf_conformance` 判为 warning。同一份语义两种位置。

→ 修法（`workspace_layout.py`，+58/-12）：`merge_provenance()` 预扫描 frontmatter，有顶层 `metadata:` 节点就把规范行作为其**首个子节点**插入，无则新建；顺带修掉隐患——剥离旧行后若 `metadata:` 变空节点（非法 YAML）自动删除。

关键约束都保住了：`read_provenance()` 的正则本身忽略缩进，嵌套后读取/去重/累加/global 剥离照旧；并发共享池写入的“只增不减”语义未动。新增 8 个用例（22 passed），既有 161 passed / 1 skipped / 0 failed。

**已修（第 1 条的静默降级）**：`knowledge_loop.py` 在 corpus 为集中式且无法判定写方仓时，响应里追加 `provenance_warning`（保留 global 语义，但不再静默）。服务端复验：只传 `output_dir` → 回传 `provenance_warning`；带 `repo_path` → 无告警且 `repo: "CodeWiki-Plus"` 正确落盘。

## 验收

改动写入链路后跑 `lint_wiki(checks=["okf_conformance"])`，确认共享池页的 `repo` 落在 `metadata.repo`、顶层干净、warning 消失。
