---
type: Module
title: 知识循环（knowledge_loop）
description: MCP 知识闭环工具族：检索、笔记写入、状态流转与统计
tags:
- CodeWiki-Plus
- knowledge_loop
generated:
  by: codewiki/5.5.1
  at: 2026-09-02 15:13:23+00:00
stale_after: 2026-12-01
aliases:
- knowledge_loop
status: stable
metadata:
  generated_from: 569549b
  resource: repo://CodeWiki-Plus
sources:
- id: repo://codewiki/mcp/tools/knowledge_loop.py#L1-L40
  resource: repo://codewiki/mcp/tools/knowledge_loop.py#L1-L40
  content_hash: sha256:5b7a66e6f67e2314664e517bc23f7a164681ef17bb28fa17a93612b58d6fed7e
  repo: CodeWiki-Plus
- id: repo://codewiki/mcp/server.py#L1-L20
  resource: repo://codewiki/mcp/server.py#L1-L20
  repo: CodeWiki-Plus
  content_hash: sha256:dcf536e2300a5874d447ddc2f6fabd5a2e67dce747cf1d9cb06adab210d26120
---
# 知识循环（knowledge_loop）

`codewiki/mcp/tools/knowledge_loop.py` 承载 CodeWiki 的知识闭环：检索（`handle_query_wiki`）、笔记写入（`handle_ingest_note`）、生命周期确认（`handle_confirm_note` / `handle_reject_note` / `handle_batch_set_status`）与检索统计（`handle_wiki_stats`）。

## 职责边界

- **检索**：BM25 打分 + wikilink 图扩展（hop 衰减 0.5x），支持 `mode=overview|directory|detail|check` 渐进阅读。
- **笔记生命周期**：`draft` → `stable`，鲜度窗口由 `note_types` 的 schema 决定；`stale_notes` lint 检查依赖此状态。
- **统计**：每次 `query_wiki` 记录命中，`wiki_stats` 回读；零命中文档可被 `include_zero_hit=true` 列出。

## 关键约定

- 页面写入必须经 `write_doc_file`；写完最后一篇后**必须**调用 `close_session`，否则索引未建、`query_wiki` 搜不到。
- 集中式布局下：模块页落在 `wiki/modules/<业务仓>/`，共享池页（entities/notes…）用 frontmatter `repo:`/`repos:` 标注适用仓。

## 相关

- 检索入口：`query_wiki`（集中式下可用 `repo=` 按业务仓过滤）
- 索引构建：`close_session`
