---
type: concept
title: 仓库导航
description: 各业务仓职责、目录与知识分区一览（集中式布局下的导航入口）
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

集中式布局：`repowiki/` 是本工作区唯一知识库，业务仓为纯代码目录（仓内无 `repowiki/`）。下表是各业务仓的职责与其知识分区索引。

| 业务仓 | 目录 | 职责 | 知识分区 | 默认分支 |
|-------|------|------|---------|---------|
| CodeWiki-Plus | `CodeWiki-Plus/` | 产品主仓库：CodeWiki 工具链本体 | `repowiki/wiki/modules/CodeWiki-Plus/` | develop |

## CodeWiki-Plus（`CodeWiki-Plus/`）

**业务概述**

CodeWiki-Plus 是产品的主仓库，承载工具链本体：依赖分析器、LLM 文档生成后端、CLI、WebApp 与 MCP Server。

**知识分区**

`repowiki/wiki/modules/CodeWiki-Plus/`（业务仓为纯代码目录，无仓内知识库）

**检索方式**

```
query_wiki(query=<问题>)                        # 产品级 + 全部业务仓
query_wiki(query=<问题>, repo="CodeWiki-Plus")   # 仅该仓分区 + 全局共享层
```

该仓的编码约定见 `CodeWiki-Plus/AGENTS.md`，在其内部工作时应遵循该文件。

<!-- 新增业务仓模板：
## <仓库名>（`<目录>/`）

**业务概述**：<一段话>

**知识分区**：`repowiki/wiki/modules/<仓库名>/`

**检索方式**：query_wiki(query=..., repo="<仓库名>")
-->
