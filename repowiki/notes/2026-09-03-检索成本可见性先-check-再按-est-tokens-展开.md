---
type: lesson
title: "检索成本可见性：先 check 再按 est_tokens 展开"
tags: ["lesson"]
aliases: ["est_tokens", "cost_hint", "by_file", "检索成本"]
metadata:
  date: 2026-09-03
  repo: "CodeWiki-Plus"
  related_modules: ["knowledge-loop"]
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.5.1, at: 2026-09-03T12:13:03Z }
stale_after: 2027-03-02
---

## 背景

query_wiki 支持 expand=true 返回全文，单次最多 20000 字符；10 条结果全展开约 50k tokens，容易把上下文打爆。

## 正确做法

1. 先 `mode=check` 轻量预检（只返回标题与分数，不记入使用信号）；
2. 再默认 BM25 检索，看每条的 `est_tokens` 与响应的 `cost_hint`；
3. 只对真正需要的 2-3 条用 `expand=true`，并用 `max_chars` 控预算；
4. 改文件前用 `by_file=<路径>` 列出该文件关联的笔记（只有标题与 est_tokens，不含正文）。

## 根因

检索 kernel 抽取后（src/retrieval.py），成本可见性成为接口的一部分：est_tokens 是条目级、cost_hint 是响应级，两者是两层。
