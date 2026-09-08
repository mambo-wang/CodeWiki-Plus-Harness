---
type: pitfall
title: "集中式布局下「仓库根 = output_dir.parent」的 colocated 假设在多处失效"
tags: ["pitfall"]
metadata:
  date: 2026-09-04
  related_modules: ["workspace-layout", "wiki-lint", "knowledge-loop", "legacy-tools"]
  severity: high
  source_ref: "conversations/conv-user_command-commands-codewiki-初始化多仓WIKI工作区-请把当前工作目录初始化（或重新同.md"
  scene: "集中式布局适配"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:42:03Z }
stale_after: 2027-03-03
origin: conversation

---

## 背景

集中式（centralized）布局下，知识统一落在工作区 `repowiki/`，业务仓代码在 `<工作区根>/<仓名>/`。而大量遗留代码是按 colocated 布局写的，默认 `仓库根 = output_dir.parent`——colocated 时 `output_dir` 是 `<repo>/repowiki`，其 parent 正好是仓根；**集中式下 `output_dir.parent` 是工作区根，代码却在 `<工作区根>/<仓名>/` 里**，于是全部错位。

## 三处实证

| 位置 | 症状 | 状态 |
|---|---|---|
| `legacy_tools.get_module_tree`（`legacy_tools.py:189`） | 只读 `<output_dir>/.meta/module_tree.json`，而 `save_module_tree` 写到 `.codewiki/<repo>/module_tree.json`，于是“找不到模块树” | **已修**：改走 `resolve_analysis_meta_file()`，先解析 `<ws>/.codewiki/<repo>/`，回退 `<corpus>/.meta/`；报错信息同时列出两个候选路径 |
| `wiki_lint._check_stale_evidence` | `repo_root = output_dir.parent`；而 `stamp_evidence` 按 `repo_path`（业务仓）解析 `repo://` → 集中式下**所有** `repo://` 证据都被误报 `evidence file disappeared`，该检查等于失效 | **已修**：证据条目记 `repo` 归属 + `evidence_roots()` 按「条目自带 repo → 工作区已登记业务仓 → output_dir.parent」给候选根依次尝试 |
| 检索 kernel 的 `by_file`（约 `retrieval.py:1818`，注释即写 `repo_root = od.parent  # colocated layout`） | `by_file` 在集中式下匹配不到，即使笔记的 `related_modules` 与模块树确实包含该文件 | **已取证、未修**（截至该轮对话） |

## 修法范式

不要再用 `output_dir.parent` 反推仓根，改为**显式候选根 + 依次尝试**：条目自带归属 → 工作区已登记的业务仓列表 → `output_dir.parent`（兼容 colocated 旧行为）。

第 6 项（证据解析根）修法细节与向后兼容：`src/evidence.py` 的 `make_entry()` 新增可选 `repo` 参数；`mcp/tools/evidence.py` 新增 `evidence_roots(output_dir, repo_name)`；`stamp_evidence` 在集中式下自动写入归属仓。老条目没有 `repo` 字段时靠“已登记业务仓”候选根照样能解析，**无需数据迁移**。真实工作区复算：候选根 `[CodeWiki-Plus, harness根]`，`stale_evidence` 问题数 1 → 0。

## 排查提示

集中式工作区里出现“文件明明存在却报 disappeared / 找不到 / 匹配不到”时，优先怀疑这条根目录假设，而不是内容本身。
