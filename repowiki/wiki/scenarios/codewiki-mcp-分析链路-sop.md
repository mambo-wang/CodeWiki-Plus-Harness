---
type: Scenario
title: CodeWiki MCP 代码分析链路 SOP
description: "多仓 harness 工作区中对业务仓做代码分析、影响面评估与文档生成。"
tags: [CodeWiki-Plus]
generated: { by: codewiki/5.5.1, at: 2026-09-04T01:23:08Z }
stale_after: 2026-12-03
aliases: ["codewiki-mcp-分析链路-sop"]
status: stable
metadata:
  repo: "CodeWiki-Plus"
  generated_from: "92bf399"
  resource: "repo://CodeWiki-Plus"
  source_notes:
  - notes/2026-09-02-组件-id-使用-windows-反斜杠且不带仓名前缀.md
  summary: 将组件 ID 格式、集中式文档写入与 close_session 收尾三条经验合并为一条可复用的 MCP 分析链路 SOP，供后续同类任务直接执行。
  heat: 1
---
# CodeWiki MCP 代码分析链路 SOP

## Work context

多仓 harness 工作区中对业务仓做代码分析、影响面评估与文档生成。

## Applicability

调用 analyze_repo 之后的任何 ID 相关操作，以及集中式布局下的文档写入。

## Core SOP

1. 先 `analyze_repo` 建缓存；
2. 取 ID 读 `.codewiki/<repo>/workspace/component_list.json`，格式 `相对\路径.py::符号`；
3. 影响面用 `analyze_impact`、改动后用 `analyze_changes`；
4. 文档用 `write_doc_file`，收尾必须 `close_session`。

## Judgment logic

- when 只传 output_dir 不传 repo_path，共享池页不会自动打 repo: 归属标；需要归属时必须显式传 repo_path。
- when init_wiki 作用于集中式业务仓，它会重建仓内 repowiki——应使用 add_workspace_repo。

## Taboos & Anti-patterns

- do not 把 query_cross_service 返回的带仓名前缀 component_id 当作组件 ID；instead 用 component_list.json 的 ID。
- do not 跳过 close_session；instead 写完最后一篇立即调用，否则 query_wiki 查不到。
