---
type: pitfall
title: deprecated 笔记在 query_wiki(mode=check) 与蒸馏去重召回两处旁路会泄漏
tags:
- codewiki
- pitfall
metadata:
  date: 2026-09-08
  task_id: 维护
  related_modules:
  - note_query
  - distill_conversation
  - wiki_search
  severity: high
  source_ref: conversations/conv-用本仓，验证D-repos-CodeWiki-CN-docs-知识可信度工程-准确性保鲜冲突机制技术详解.md-文章表述.md
  scene: 知识检索与蒸馏去重
status: stable
author: iamwangbao-163-com
generated:
  by: codewiki/5.7.0
  at: 2026-09-08 01:31:58+00:00
stale_after: '2027-03-07'
origin: conversation
verified:
- by: human:iamwangbao-163-com
  at: '2026-09-08T01:33:38Z'
---

## Background

在验证 CodeWiki「知识可信度工程」文档 §7.5（deprecated 笔记不参与排序、直接跳过）时发现：一条 `status: deprecated`、`consolidated_into` 指向其他页面的旧笔记，在一次 11 条对话的补蒸馏中被反复召回 3 次，看起来像「笔记过时未清理」，实际是召回链路漏挂了 status 过滤。

## 正确做法

判断 deprecated 笔记是否被正确排除时，必须逐条调用方核对，不能只看主路径：

| 召回路径 | 是否跳过 deprecated |
|---|---|
| 内核 `wiki_search.search` | **否**（不读 frontmatter status，deprecated 照常进结果集） |
| `query_wiki` 默认 BM25 主路径（`note_query.py` 约 L988-990） | 是 |
| `query_wiki` by_file 路径（`note_query.py` 约 L642-644，注释明写 same skip rule as the default BM25 path） | 是 |
| `query_wiki(mode="check")` | **否** |
| 蒸馏去重召回 `_bm25_recall_candidates`（`distill_conversation.py` 约 L558-607） | **否** |

内核不设防是刻意设计：`draft` 需要标注、`superseded_by` 需要追踪，都依赖原始结果集，所以过滤责任落在各调用方。新增任何一条消费搜索结果的路径时，都要显式挂上跳过规则。

## Rationale / 影响

- 蒸馏去重侧危害最大：该路径特意传 `apply_authority=False`（理由：去重是相似度判断而非排序判断，不该让草稿因未评审而沉底），这同时绕过了 deprecated 的 −0.35 权威降权，deprecated 笔记与正常笔记同权竞争；且候选 payload 不带 `status` 字段，下游裁决方无从识别死知识，可能据此做出 `skip`/`merge` 裁决，导致**新知识被已废弃笔记压制**。
- check 侧次之：deprecated/superseded 笔记能进 top-3 并撑起 `relevant=true` 与 top_score，误导「知识是否已存在」的预判，导致白跑全文检索或误判「无需沉淀」。
- 注意 `_norm_status`（`note_writer.py` 约 L36-40）把 legacy `superseded`/`rejected` 一并归一为 `deprecated`，所以主路径实际跳过三类状态，补过滤时要复用同一函数而不是只判 `deprecated`。

## Recovery / 修复方式

约 20 行、无风险：在 `note_query.py` 的 check 模式与 `distill_conversation.py` 的 `_bm25_recall_candidates` 中，对 BM25 结果按 `_norm_status` 读 frontmatter 跳过 deprecated（镜像 by_file 写法），并给候选 payload 补 `status` 字段让裁决透明。不要改内核，否则会破坏 draft 标注与 `superseded_by` 追踪。

## 验证方法

改前先写可复现脚本跑基线（两个 fixture：mixed = stable+deprecated 混合语料，deadonly = 仅 deprecated 语料），确认四个消费点全部泄漏、且 deadonly 下新草稿会被直接并进 deprecated 笔记；改后 mixed 只剩 stable、deadonly 全为空。语料太小时 BM25 分数到不了内部分数下限，脚本里可临时下调该下限让该档可观测。
