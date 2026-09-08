---
type: Conversation
title: "conversation 20260904T034413Z"
status: distilled
stale_after: 2026-12-03
generated: { by: codewiki/5.5.1, at: 2026-09-04T03:44:13Z }
captured_at: "2026-09-04T03:44:13Z"
content_hash: "sha256:881834521c3eca06da7aac61a366a82308839ffb43408d1c3d2a48dde1ab472e"
friction_score: 0
friction_signals: "correction=0,interrupt=0,repeat=0,user_turns=3"
keep_raw: false
link_to: ""
source_session: "ecf597bfe46f42b9addf67c23dbaf1fc"
turn_count: 17
---

# Conversation Transcript

user: https://github.com/DietrichGebert/ponytail/tree/main  安装ponytail
user: <question>是否要将本会话关联到一个任务？</question>
<answers>
跳过(本次会话不关联任务，直接开始干活)
</answers>
</question_item>
</questions>
</question_answer>
assistant: 用户选择跳过任务关联，直接开始处理安装 ponytail 的任务。

先了解这个仓库是什么以及如何安装。
assistant: 直接抓取失败，改用 web 搜索了解 ponytail 项目。
assistant: Ponytail 是一个 AI 编码代理插件。获取 README 了解详细安装方式。
assistant: Ponytail 官方支持的客户端列表里没有 CodeBuddy。先检查当前环境里装了哪些可用的 agent CLI，以确定合适的安装路径。
assistant: 环境中只有 `node` 和 `git`，没有安装任何 Ponytail 支持的 agent CLI（`claude`/`codex`/`gemini`/`pi`/`opencode` 等）。而且 Ponytail 官方文档中**并未列出 CodeBuddy**。

我需要确认你的安装目标，因为不同选择的路径差别很大：
user: <question>你想把 Ponytail 安装到哪里？</question>
<answers>
集成到 CodeBuddy（当前 IDE）(Ponytail 官方未支持 CodeBuddy，只能按 instruction-only 方式把它的极简规则集成进来（如规则文件/AGENTS.md 附带参考）)
</answers>
</question_item>
</questions>
</question_answer>
assistant: 用户选择集成到 CodeBuddy。先探查当前 `.codebuddy` 配置结构与可用的规则注入机制。
assistant: clone 消息已输出（git 进度走 stderr，属正常）。查看 ponytail 仓库结构。
assistant: 克隆成功（HEAD `2ed6c52`）。查看 ponytail 的规则文件结构，确定如何转成 CodeBuddy 可用的 instruction-only 集成。
assistant: 核心规则已获取。现在查看 CodeBuddy 现有 skill 的结构格式（codinghub），以便按相同格式制作 ponytail skill。
assistant: CodeBuddy skill 格式已明确（`SKILL.md` + YAML frontmatter）。用户级 `%USERPROFILE%\.codebuddy\skills\` 会被 CodeBuddy 识别（archify 即装于此）。现在查看 ponytail 各 skill 的内部内容，决定如何整合。
assistant: Ponytail 的 skill 结构与 CodeBuddy 完全兼容（SKILL.md + frontmatter）。读取其余 skill 内容以决定安装范围。
assistant: 内容已齐全。确定安装方案：将 ponytail 按 CodeBuddy 可识别的 **skill 格式**（SKILL.md）安装到**用户级** skills 目录，使其对所有项目生效。安装 `ponytail`、`ponytail-review`、`ponytail-audit`、`ponytail-debt`、`ponytail-help` 五个主要技能（`ponytail-gain` 是本地基准记分板，与 CodeBuddy 无对应机制，跳过）。
assistant: 5 个技能已安装到用户级 skills 目录。快速验证文件完整性。
assistant: 安装完成。Ponytail 已按 CodeBuddy 支持的方式集成到你的用户级技能目录。

## 安装结果

Ponytail 官方支持约 20 种 agent，但**未包含 CodeBuddy**（无 `/plugin`、pre-LLM hooks、slash 命令机制）。其 README 也确认最稳妥路径是 instruction/skill 级集成。已按 CodeBuddy 的 SKILL.md 格式安装 5 个技能到用户级目录 `%USERPROFILE%\.codebuddy\skills\`（全局生效，所有项目可用，与既有 `archify` 并列）：

| 技能 | 作用 |
|---|---|
| `ponytail` | 核心「lazy senior dev」模式：代码阶梯（YAGNI → 复用 → stdlib → 平台原生 → 已装依赖 → 一行 → 最小实现），支持 lite/full/ultra 强度 |
| `ponytail-review` | 审查 diff 中的过度工程，输出一行一条的删除清单（`L42: yagni: ...`） |
| `ponytail-audit` | 全仓库过度工程审计，按可删代码量排序 |
| `ponytail-debt` | 把代码里的 `ponytail:` 注释（有意识简化 + 升级路径）收进台账 |
| `ponytail-help` | 速查卡 |

临时 clone 保留在 `%TEMP%\ponytail`（HEAD `2ed6c52`，v4.9.0），供日后参考/升级。

## 使用方式

在新会话或对话中说「用 ponytail 模式」「lazy mode」「极简实现」等即可触发；描述里也覆盖了编码/重构/审查等任务自动命中。退出时说「normal mode」。

## 与官方版的差异

- **非 always-on**：官方版靠 hook 每次调用前自动注入；CodeBuddy 侧需显式/按描述触发，且强度状态只在当前会话内保持。
- **无 `/ponytail` 命令**：`ponytail-gain`（本地基准记分板）无对应机制，已跳过安装。

需要我把核心「代码阶梯」规则设为 always-on（每次会话自动生效，如并入项目 `AGENTS.md`）吗？考虑到当前仓库的 `AGENTS.md` 是 CodeWiki 专用约定，我建议默认保持 skill 式按需触发，不污染它。
