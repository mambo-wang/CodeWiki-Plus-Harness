---
type: concept
title: 仓库导航
description: 各业务仓职责、目录、repowiki 路径与检索方式一览（第二跳检索的入口）
tags:
- navigation
- repo-map
generated:
  by: codewiki:init_workspace
  at: "2026-08-29"
status: stable
---

# 仓库导航

本页是两跳检索路由的导航入口：第一跳查本仓 repowiki 命中业务仓后，按下表下钻到该业务仓自己的 repowiki。

| 业务仓 | 目录 | 职责 | repowiki 路径 | 默认分支 |
|-------|------|------|--------------|---------|
| go-my-harness | `go-my-harness/` | Go 后端服务（集成 Anthropic / OpenAI / 飞书开放平台 SDK） | `repowiki/wiki/modules/go-my-harness/` | `main` |


<!-- 尚无登记的业务仓：用 add_workspace_repo(url=<克隆URL>) 添加 -->

## go-my-harness（`go-my-harness/`）

**业务概述**

基于 Go 语言开发的后端服务（模块 `github.com/mambo-wang/go-my-harness`，Go 1.26+）。入口在 `cmd/`，业务逻辑在 `internal/`，依赖 Anthropic、OpenAI 与飞书开放平台 SDK，用于接入多种 AI 模型能力与飞书生态。

**知识分区**

`repowiki/wiki/modules/go-my-harness/`（业务仓为纯代码目录，无仓内知识库）

**检索方式**

```
query_wiki(query=<问题>, repo="go-my-harness")
```

<!-- 新增业务仓模板：
## <仓库名>（`<目录>/`）

**业务概述**：<一段话>

**检索方式**：query_wiki(query=..., output_dir=<harness根>/<目录>/repowiki)
-->
