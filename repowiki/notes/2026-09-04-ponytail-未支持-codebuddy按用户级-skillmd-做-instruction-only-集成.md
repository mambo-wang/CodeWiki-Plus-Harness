---
type: workaround
title: "Ponytail 未支持 CodeBuddy，按用户级 SKILL.md 做 instruction-only 集成"
tags: ["codebuddy", "dietrichgebert", "workaround"]
metadata:
  date: 2026-09-04
  related_modules: ["agent-tooling", "codebuddy-config"]
  severity: medium
  source_ref: "conversations/conv-https-github.com-DietrichGebert-ponytail-tree-main-安装ponytai.md"
  scene: "工具链安装"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:36:13Z }
stale_after: 2026-10-19
origin: conversation

---

## 背景

Ponytail（github.com/DietrichGebert/ponytail）官方支持约 20 种 agent CLI，但**不包含 CodeBuddy**：CodeBuddy 没有 `/plugin`、pre-LLM hook、slash 命令机制。Ponytail 的 README 也确认最稳妥路径是 instruction/skill 级集成。本机环境只有 `node` 与 `git`，未安装任何官方支持的 agent CLI（`claude`/`codex`/`gemini`/`pi`/`opencode` 等）。

## 正确做法

Ponytail 的 skill 结构与 CodeBuddy 完全兼容（同为 `SKILL.md` + YAML frontmatter），可把技能目录直接复制到**用户级** `%USERPROFILE%\.codebuddy\skills\`（全局生效，所有项目可用，与既有的 `archify` 并列）：

| 技能 | 作用 |
|---|---|
| `ponytail` | 核心「lazy senior dev」模式：代码阶梯（YAGNI → 复用 → stdlib → 平台原生 → 已装依赖 → 一行 → 最小实现），支持 lite/full/ultra 强度 |
| `ponytail-review` | 审查 diff 中的过度工程，输出一行一条的删除清单（`L42: yagni: ...`） |
| `ponytail-audit` | 全仓库过度工程审计，按可删代码量排序 |
| `ponytail-debt` | 把代码里的 `ponytail:` 注释（有意识简化 + 升级路径）收进台账 |
| `ponytail-help` | 速查卡 |

`ponytail-gain`（本地基准记分板）在 CodeBuddy 无对应机制，跳过安装。安装后可保留临时 clone（当时为 `%TEMP%\ponytail`，HEAD `2ed6c52`，v4.9.0）供日后升级参考。

## 与官方版的差异（集成后必须知道的限制）

- **非 always-on**：官方版靠 hook 在每次调用前自动注入；CodeBuddy 侧只能显式或按 frontmatter description 自动命中，且强度状态（lite/full/ultra）只在当前会话内保持。
- **无 `/ponytail` 命令**：所有能力只能通过触发词唤起（「用 ponytail 模式」「lazy mode」「极简实现」等，退出说「normal mode」）。

## 建议

默认保持 skill 式按需触发，**不要**并入项目 `AGENTS.md`——尤其当 `AGENTS.md` 已被其他约定块（如 CodeWiki 工作区约定）占用时，混写会污染约定块。
