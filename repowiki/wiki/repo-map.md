---
type: concept
title: 仓库导航
description: 各业务仓职责、目录、repowiki 路径与检索方式一览（第二跳检索的入口）
tags:
- navigation
- repo-map
generated:
  by: human:mambo-wang
  at: 2026-08-28
status: stable
stale_after: "2027-02-24"
---

# 仓库导航

本页是两跳检索路由的导航入口：第一跳查本仓 repowiki 命中业务仓后，按下表下钻到该业务仓自己的 repowiki。

| 业务仓 | 目录 | 职责 | repowiki 路径 | 默认分支 |
|-------|------|------|--------------|---------|
| CodeWiki-Plus | `codewiki-plus/` | 产品主仓库：CodeWiki 工具链本体 | `codewiki-plus/repowiki` | develop |

## CodeWiki-Plus（`codewiki-plus/`）

**业务概述**

<!-- TODO: 补充业务概述 -->

CodeWiki-Plus 是产品的主仓库，承载工具链本体：依赖分析器、LLM 文档生成后端、CLI、WebApp 与 MCP Server。其内部结构与模块文档见该仓自己的 repowiki。

**检索方式**

```
query_wiki(query=<问题>, output_dir=<harness根>/codewiki-plus/repowiki)
```

该仓的 AGENTS.md（含 CodeWiki 使用约定、任务记忆协议）位于 `codewiki-plus/AGENTS.md`，在其内部工作时应遵循该文件。

<!-- 新增业务仓模板：
## <仓库名>（`<目录>/`）

**业务概述**：<一段话>

**检索方式**：query_wiki(query=..., output_dir=<harness根>/<目录>/repowiki)
-->
