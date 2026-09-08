---
type: pitfall
title: 组件 ID 使用 Windows 反斜杠且不带仓名前缀
tags:
- codewiki
- pitfall
aliases:
- component id
- 组件ID
- No valid components found
metadata:
  date: 2026-09-02
  related_modules:
  - mcp-server
  severity: medium
  consolidated_into:
  - wiki/scenarios/codewiki-mcp-分析链路-sop.md
status: deprecated
author: iamwangbao-163-com
generated:
  by: codewiki/5.5.1
  at: 2026-09-02 15:15:06+00:00
stale_after: '2027-03-01'
verified:
- by: human:mambo-wang
  at: '2026-09-02T15:16:38Z'
reject_reason: consolidated into CodeWiki MCP 代码分析链路 SOP
---

## 背景

在 analyze_repo 之后调用 analyze_impact / read_code_components 时，传入 `codewiki/mcp/server.py` 或 `CodeWiki-Plus\codewiki\mcp\server.py` 均报 No valid components found。

## 正确做法

组件 ID 的真实格式取自 `.codewiki/<repo>/workspace/component_list.json`：`codewiki\mcp\server.py::call_tool`——Windows 反斜杠、**不带**仓名前缀。查 ID 先看 component_list.json，再调用。

## 根因

query_cross_service 返回的 component_id 带 `CodeWiki-Plus\` 仓名前缀，是跨服务记录格式，不是组件 ID；照抄会失效。
