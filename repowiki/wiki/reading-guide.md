---
type: Concept
title: "阅读指南"
generated: { by: codewiki/reading_guide.py, at: 2026-09-03T12:18:24Z }
stale_after: 2099-12-31
description: "> 基于 PageRank 依赖分析自动生成。排名越靠前的组件被越多模块依赖，建议优先阅读。"
---
# 阅读指南

> 基于 PageRank 依赖分析自动生成。排名越靠前的组件被越多模块依赖，建议优先阅读。
> 排序依据为 PageRank 得分（综合考虑被依赖数量及依赖方自身的重要性），
> 表中「直接被依赖数」列为原始入度，仅供参考。

## 推荐阅读顺序

| # | 组件 | 类型 | 所属模块 | 直接被依赖数 | PageRank | 文件 |
|---|------|------|----------|--------------|----------|------|
| 1 | `CLILogger.debug` | method | - | 102 | 0.0161 | codewiki\cli\utils\logging.py |
| 2 | `LazyComponentStore.items` | method | - | 120 | 0.0122 | codewiki\mcp\cache.py |
| 3 | `TreeSitterTSAnalyzer._get_node_text` | method | - | 26 | 0.0082 | ...\be\dependency_analyzer\analyzers\typescript.py |
| 4 | `TreeSitterTSAnalyzer._find_child_by_type` | method | - | 19 | 0.0060 | ...\be\dependency_analyzer\analyzers\typescript.py |
| 5 | `NamespaceResolver.resolve` | method | - | 110 | 0.0058 | ...iki\src\be\dependency_analyzer\analyzers\php.py |
| 6 | `TreeSitterJSAnalyzer._get_node_text` | method | - | 19 | 0.0051 | ...\be\dependency_analyzer\analyzers\javascript.py |
| 7 | `CLILogger.error` | method | - | 32 | 0.0044 | codewiki\cli\utils\logging.py |
| 8 | `TreeSitterJSAnalyzer._find_child_by_type` | method | - | 14 | 0.0035 | ...\be\dependency_analyzer\analyzers\javascript.py |
| 9 | `LazyComponentStore.values` | method | - | 38 | 0.0034 | codewiki\mcp\cache.py |
| 10 | `CrossServiceMatcher.match` | method | - | 32 | 0.0033 | ...ency_analyzer\analysis\cross_service_matcher.py |
| 11 | `CallRelationship` | class | - | 19 | 0.0033 | codewiki\src\be\dependency_analyzer\models\core.py |
| 12 | `Node` | class | - | 19 | 0.0033 | codewiki\src\be\dependency_analyzer\models\core.py |
| 13 | `KnowledgeStore.relpath` | method | - | 28 | 0.0030 | codewiki\src\store.py |
| 14 | `TreeSitterJSAnalyzer._get_relative_path` | method | - | 9 | 0.0029 | ...\be\dependency_analyzer\analyzers\javascript.py |
| 15 | `TreeSitterTSAnalyzer._add_relationship` | method | - | 8 | 0.0027 | ...\be\dependency_analyzer\analyzers\typescript.py |
| 16 | `TreeSitterJSAnalyzer._get_component_id` | method | - | 8 | 0.0026 | ...\be\dependency_analyzer\analyzers\javascript.py |
| 17 | `LazyComponentStore.keys` | method | - | 30 | 0.0026 | codewiki\mcp\cache.py |
| 18 | `ModuleProgressBar.update` | method | - | 21 | 0.0021 | codewiki\cli\utils\progress.py |
| 19 | `atomic_write` | function | - | 25 | 0.0021 | codewiki\src\store.py |
| 20 | `load_schema` | function | - | 25 | 0.0021 | codewiki\mcp\tools\page_router.py |

---
*基于 1773 个组件、3398 条依赖边计算。*