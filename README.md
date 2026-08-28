# CodeWiki-Plus-Harness

CodeWiki-Plus 产品线的 **harness（工程脚手架）主仓库**：承载产品级知识、跨仓协作约定与工作区基础设施。各业务代码仓作为**独立 clone 的子目录**挂在本仓之下——目录上是父子，git 上完全隔离（本仓通过 `.gitignore` 不追踪任何业务仓目录，也不是 submodule）。

## 工作区结构

```
CodeWiki-Plus-Harness/        ← 本仓（harness，分支稳定、变动不频繁）
├── repowiki/                 ← 产品级 Wiki：产品概述、各业务仓业务概述、仓库导航
├── AGENTS.md                 ← Agent 工作约定（两跳检索路由、提交纪律）
├── bootstrap.ps1 / .sh       ← 一键初始化：克隆全部业务子仓
├── codewiki-plus/            ← 业务仓（独立 clone，本仓 git 不追踪）
└── workspace-wiki/           ← analyze_workspace 多仓分析产物（可再生成）
```

## 快速开始

```powershell
git clone https://github.com/mambo-wang/CodeWiki-Plus-Harness.git
cd CodeWiki-Plus-Harness
.\bootstrap.ps1        # Linux/macOS: ./bootstrap.sh
```

bootstrap 会把所有业务仓克隆到本仓的子目录。已存在的目录自动跳过，可重复执行。

## 设计原则

1. **harness 不入业务仓**：`.codebuddy`、跨仓约定、产品级 repowiki 只存在于本仓；业务仓内部资产归业务仓自己。
2. **提交不打架**：业务仓带自己的 `.git`，本仓 `.gitignore` 显式排除业务目录，业务代码物理上无法被提交进本仓。
3. **分支松耦合**：各业务仓自由选择主线分支或个人开发分支；本仓分支较为固定，多个相近版本共用同一分支的 harness 影响不大。
4. **知识分层检索**：本仓 repowiki 存产品概述、各业务仓业务概述与导航；深度模块知识在各业务仓自己的 repowiki。Agent 检索先查本仓，命中业务仓后用 `query_wiki(output_dir=<业务仓>/repowiki)` 下钻；跨服务调用关系用 `query_cross_service(workspace_path=<本仓根目录>)`。

## 维护约定

- 新增业务仓：`bootstrap` 脚本登记 + `.gitignore` 加一行 + `repowiki/wiki/repo-map.md` 补一节。
- 本仓 repowiki 的产品级知识用 `ingest_note` / `write_doc_file` 写入，格式遵循 OKF v0.2（frontmatter：type/title/description/tags + generated/status/stale_after）。
- 业务仓的深度笔记（模块文档、pitfall、decision）写入**业务仓自己的** repowiki，不写入本仓——保证 wiki 与它描述的代码同仓演进。
