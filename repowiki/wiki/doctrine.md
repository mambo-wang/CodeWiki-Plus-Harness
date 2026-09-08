---
type: Doctrine
title: Team Operating Doctrine
status: stable
generated:
  by: codewiki/5.5.1
  at: 2026-09-02 15:18:53+00:00
metadata:
  source_scenarios: []
  notes_at_refresh: 1
verified:
- by: human:mambo-wang
  at: '2026-09-02T23:00:28Z'
stale_after: '2027-03-02'
---

# Team Operating Doctrine
> Operating Thesis: 组件事实以工具产物为准，知识以集中式 repowiki 为唯一归宿。
## Core Principles
- 单一知识源：集中式布局下业务仓是纯代码仓，知识只写工作区 repowiki。
## Reusable SOPs
- 取组件 ID：先读 component_list.json，再调 analyze_impact / read_code_components。
- 文档收尾：write_doc_file 后必须 close_session，否则检索不到。
## Decision Logic
- when 需要按仓过滤知识, prefer query_wiki(repo=<仓>) over 指定业务仓 repowiki。
## Boundaries & Anti-patterns
- do not 在业务仓内跑 init_wiki；instead 用 add_workspace_repo，因为集中式下它会重建仓内 repowiki。
## Agent Rules
- agents should 写入共享池时显式传 repo_path，以获得 repo: 归属标注。
---
> Last updated: 2026-09-02 · Source scenes: 0 · Total notes: 3
