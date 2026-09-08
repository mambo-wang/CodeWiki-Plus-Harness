<!-- CodeWiki Workspace Conventions -->

# AGENTS.md — CodeWiki-Plus-Harness 工作区约定（集中式布局）

本仓库是产品线的 harness 主仓库。业务代码仓以独立 clone 方式挂在本仓库子目录下（git 层面完全隔离，非 submodule）。本工作区采用**集中式知识布局**：全部知识（产品级 + 各业务仓）统一存放在本仓 `repowiki/`，业务仓目录内没有 `repowiki/`。

## 工作区结构与检索路由（一跳）

`repowiki/` 是唯一知识库：`wiki/modules/<业务仓目录>/` 按仓分区存放代码结构文档；`wiki/entities/`、`wiki/concepts/`、`wiki/comparisons/`、`wiki/queries/`、`wiki/sources/`、`notes/` 等为共享池，页面以 frontmatter `repo:`/`repos:` 标注适用仓（无标注＝产品线全局，对所有仓生效）。

**检索（一跳）**：

```
query_wiki(query=...)                            # 覆盖产品级 + 全部业务仓
query_wiki(query=..., repo=<业务仓目录>)          # 适用于该仓的知识＝该仓分区 + 带该仓标 + 全局
query_cross_service(workspace_path=<harness根目录>)
```

导航入口页：`repowiki/wiki/repo-map.md`（仓清单与分区索引）。

## 提交纪律（结构性红线）

- 业务代码只在业务仓内提交；**全部知识产物在本仓提交**——集中式布局下业务仓是纯代码仓。
- 本仓 `.gitignore` 已排除全部业务仓目录。若在本仓 `git status` 中看到业务仓目录出现，说明 `.gitignore` 失效或业务仓被错误 clone 进来——**立即停下排查，绝不可 `git add`**。
- 业务仓自身的编码约定仍遵循该业务仓自己的 AGENTS.md（其知识库引用块已被移除），本文件不覆盖。

## 分支策略

本仓分支固定、变动不频繁；各业务仓自由选择主线或个人开发分支，互不感知、无需同步。不要在本仓为业务仓的分支做任何记录（没有指针、没有 manifest 锁定）。

## 知识写入路由

| 知识类型 | 写入位置 |
|---------|---------|
| 产品概述、跨仓架构、全局编码规范 | `repowiki/` 相应页型目录，**不打** `repo:` 标（全局） |
| 单个业务仓的业务概述 | `repowiki/wiki/repo-map.md` 对应小节 |
| 模块文档（代码结构） | `repowiki/wiki/modules/<业务仓目录>/` |
| entities/notes/pitfall/decision 等 | 共享池（`wiki/entities/`、`notes/`…），frontmatter `repo:`/`repos:` 标适用仓 |
| 跨服务调用拓扑 | `analyze_workspace(workspace_path=<harness根>)` 产出（`wiki/overview.md` + `.meta/`） |

原则：说一个仓的内部实现 → 该仓分区或带该仓标；说多个仓或产品线 → 全局共享层。

## 新业务仓接入清单

优先使用 CodeWiki MCP 工具 `add_workspace_repo(url=<克隆URL>)` 一步完成登记（目录名自动取仓库名）；集中模式下会自动建 `repowiki/wiki/modules/<仓名>/` 分区骨架，且**不在业务仓内建 `repowiki/`**。手工接入时须同步三处：

1. `bootstrap.ps1` / `bootstrap.sh` 的 repos 登记表增加仓库目录名与 URL
2. `.gitignore` 增加一行 `/<业务仓目录>/`
3. `repowiki/wiki/repo-map.md` 补充该仓小节（职责、分区路径、检索方式）

<!-- /CodeWiki Workspace Conventions -->

<!-- CodeWiki LLM Wiki -->

## CodeWiki LLM Wiki

本项目已使用 [CodeWiki](https://github.com/mambo-wang/CodeWiki-Plus) 生成 LLM Wiki 文档，位于 `repowiki/` 目录。

**入口文件：**

- [`repowiki/wiki/overview.md`](repowiki/wiki/overview.md) — 仓库级架构总览（含 Mermaid 架构图）
- [`repowiki/wiki/index.md`](repowiki/wiki/index.md) — 文档目录与知识笔记索引
- [`repowiki/schema.yaml`](repowiki/schema.yaml) — 项目文档约定（命名规范、必填章节等）

### 使用建议

1. **编码前**：先用 `query_wiki` 搜索相关模块文档，了解架构约定和依赖关系
2. **做决策时**：用 `query_wiki` 搜索已有的 `decision` 类型笔记，避免重复讨论
3. **完成重要决策后**：用 `ingest_note` 归档，让未来的 Agent 和团队成员都能查到
4. **定期维护**：用 `lint_wiki` 检查文档是否过时，保持文档与代码同步

### 采纳声明（检索反馈）

当你通过 `query_wiki` 检索并**实际使用了**某条结果（作为决策依据、修改参照或答案来源）时，在最终回复中附带一行声明注释：

```
<!-- codewiki:referenced-docs: ["notes/pitfall-xxx.md", "wiki/modules/yyy.md"] -->
```

路径必须与 query_wiki 返回的 `file` 字段完全一致。声明过的文档会获得采纳计数（`usage.adopted_count`），在未来检索中排序提升（采纳权重是单纯召回的 2 倍）；长期高频召回却零采纳的笔记会被 `lint_wiki` 的 `low_adoption` 检查标记为"需要重写得更可操作"。

**注意**：只声明真正用到的文档——这是帮助知识库学习"什么内容真正有用"的信号，不是礼貌性致谢。忘了声明没关系（漏报可容忍），但不要声明没用过的（误报不可容忍）。

### 纠正识别与经验沉淀

当你被用户纠正、吐槽或补充了未知上下文时，这可能是值得沉淀的经验。按以下规则处理：

**识别纠正信号（满足任一即触发）：**

- 用户明确否定你的输出："不对""你搞错了""不是这样的""应该是…"
- 用户表达重复犯错的不满："又…""上次就…""为什么又…"
- 你修改了自己的输出后用户仍不满意，说明理解有根本偏差
- 用户补充了你不知道的关键上下文："你不知道吗…""这个项目一直都是…""我们约定过…"
- 用户指出方法名/Javadoc 与实际行为不一致，或指出代码中的历史遗留问题

**执行三步流程：**

1. **反思**：明确说出自己错在哪里、正确做法是什么、根因是什么（是缺少项目上下文？还是对代码理解有误？）
2. **起草笔记**：将教训整理为结构化内容，包含：背景（什么场景下犯了错）、正确做法、根因分析
3. **征求确认**：向用户展示笔记草稿，询问"要把这条经验记录到 Wiki 吗？"——**必须得到用户确认后才执行 `ingest_note`**，不要默默保存

**归档示例：**

```json
{
  "note_type": "lesson",
  "title": "OrderService.process() 只做参数校验不做业务处理",
  "content": "## 背景\n\nAgent 误以为 OrderService.process() 包含完整业务逻辑，基于方法名做了错误的设计假设。\n\n## 正确做法\n\nprocess() 仅做入参校验和格式化，实际业务处理在 OrderService.execute() 中。老项目方法名与实际行为不一致是常见情况，应优先阅读实现而非信任方法名。\n\n## 根因\n\n十几年老项目，方法经过多次重构但名称未更新。",
  "related_modules": ["order"]
}
```

**注意**：不是每次纠正都需要沉淀。只记录有复用价值的经验——特定于本次任务的临时调整、用户个人偏好等不需要记录。判断标准：如果未来的 Agent 或新同事遇到同样场景时这条经验有用，就值得记录。

### 主动知识沉淀

不要等用户纠正才记录。当对话中出现以下信号时，主动执行反思并提取知识：

**触发信号（满足任一即激活反思）：**

- 完成一个多步骤调试/排查后定位到根因（尤其是走了弯路的情况）
- 讨论了两个及以上方案并做出了选择
- 发现代码实际行为与文档/命名/注释不一致
- 用户补充了隐性项目知识（约定、历史原因、"我们一直这么做"）
- 一次探索性调研收敛到明确结论
- 发现了可复用的模式、工具链用法或环境配置技巧

**四问过滤（全部通过才值得记录）：**

1. 下一次对话（无本次上下文）还能用到吗？
2. 另一个 Agent 或新同事遇到同样场景能直接受益吗？
3. `query_wiki` 确认现有文档未覆盖？
4. 属于"事实/决策/模式/教训"而非"本次任务临时状态"？

**路由表：**

| 知识类型 | 写入方式 |
|---------|---------|
| 做了技术选型/方案取舍 | `ingest_note(note_type="decision")` |
| 踩坑/易错点 | `ingest_note(note_type="pitfall")` |
| 经验教训（调试过程、认知修正） | `ingest_note(note_type="lesson")` |
| 架构层面的事实发现 | `ingest_note(note_type="architecture")` |
| 临时绕过方案（含恢复条件） | `ingest_note(note_type="workaround")` |
| 多方案横向对比（含表格） | `write_doc_file(page_type="comparison")` |
| 调研结论存档 | `write_doc_file(page_type="query")` |

**执行流程：**

1. 识别到触发信号后，回顾相关对话片段，提取候选知识项
2. 对每个候选项执行四问过滤，丢弃未通过的
3. 用 `query_wiki` 检查是否已有覆盖（避免重复）
4. 按路由表确定写入方式，起草结构化内容（背景→结论→根因→适用范围）
5. 向用户展示草稿并征求确认——**必须确认后才写入**
6. 一次对话中可积累多个候选项，在自然停顿点（任务完成、话题切换）统一呈现，避免频繁打断

**不要记录的内容：**

- 仅与本次任务相关的临时变量、路径、参数
- 用户个人偏好（这属于 Agent 记忆，不属于项目 Wiki）
- 已在代码注释或 README 中明确写明的信息
- 未经验证的猜测或"可能""也许"级别的推断

<!-- /CodeWiki LLM Wiki -->

<!-- TEAM-MEMORY-TASK:START -->
## Task memory (任务记忆)

跨会话延续长线工作上下文。任务记忆是**任务范围内的进度知识**(本次做了什么、下一步、待办)，与 Wiki 笔记(**跨任务的通用经验**)互补。

**会话开始时(推荐)：**
1. `list_tasks(status="active")` 列出进行中的任务
2. **必须用 `ask_followup_question` 工具弹出结构化选择框**（IDE 原生弹框 UI，用户可直接点击），不要用纯文本输出一段话让用户自行回复。选项二选一（加一个"跳过"）：
   - **关联已有任务**：用户从列表中选择，用 `set_session_task(source_session_id=<会话id>, task_id=<任务id>)` 建立绑定，本会话采集的对话会自动带上 `task_id`
   - **新建任务**：选择后再弹一个 `ask_followup_question` 输入框让用户输入任务名（可补一句描述），调 `create_task(title=<任务名>, description=<可选>)` 创建后即关联该新任务
   - **跳过**：本次会话不做任务关联
   新建任务两步弹框：选择「新建任务」后**必须**再次调用 `ask_followup_question` 弹出第二个输入框（标题「新建任务」，问题「请输入新任务名称」，带 2 个占位选项）。弹框自带输入框，用户可自由输入任务名后回车；以输入文字为准，立即调用 `create_task(title=<任务名>)` 创建并关联。若用户只点了占位选项，用文字追问确认真实任务名
3. `get_task_context(task_id=<任务id>)` 拉取任务描述 + 记忆 + 关联笔记，作为继续工作的上下文
4. **补蒸馏（委托 subagent，不阻塞）**：若返回的 `pending_raw_count > 0`（本任务有未蒸馏的历史对话），**不要自己在回答前逐条 read_file 蒸馏**——立即用 Task 工具 spawn 蒸馏子代理后台执行（CodeBuddy：spawn「蒸馏 worker」subagent，`.codebuddy/agents/distill-worker.md`，已授权 codewiki MCP；claude 家族 Qoder/Claude Code/Gemini CLI：**自定义子代理拿不到 MCP 权限**，改 spawn 内置 general-purpose 子代理，让它先读对应 `.qoder|.claude|.gemini/agents/distill-worker.md` 作为剧本）：`distill_conversation(mode="prepare", task_id=<任务id>)` → 按清单逐条 read_file 提取 notes/memories → `distill_conversation(mode="submit", ...)`，然后**直接开始回答用户提问**。在自然停顿点（任务告一段落/用户空闲）重新 `get_task_context` 拉取最新上下文（任务记忆已直写落盘，`memories_written` 报告条数）→ 只向用户展示待确认的草稿笔记（`confirm_note` 确认后才正式落盘）。用户明确表示紧急时可先答复、草稿笔记在会话结束前展示确认即可

**工具入口：**
- `codewiki/mcp/tools/task_manager.py` — `create_task` / `list_tasks` / `get_task` / `complete_task` / `delete_task` / `set_session_task` / `add_task_memory` / `get_task_context` / `compact_task_memories`
- 存储：`repowiki/tasks/.index.json`（可重建缓存：目录扫描为准，失配/损坏时自动重建）+ `<task_id>/task.md` + `<task_id>/memories/<user_id>.md`（每人只写自己的文件，多人 git 冲突隔离；条目带 `### YYYY-MM-DD HH:MM` 时间戳头；压缩后头部有「早期记忆（摘要）」段）+ `<task_id>/memories-archive/<user_id>.md`（压缩归档，append-only、永不自动加载）；`<task_id>/memories.md` 为存量单文件（只读兼容，热层，首次压缩并入当前用户文件后移除）；会话绑定在 `repowiki/.meta/task_bindings/`
- `capture_conversation` / `distill_conversation` / `ingest_note` / `query_wiki` 均接受 `task_id`；蒸馏时 LLM 双轨产出 `notes`(通用知识，draft 待确认) 与 `memories`(任务进度，直写落盘——ADR-0002：任务记忆不做确认闸门)
- MCP prompt `task-workflow`（prompts/list）— 完整工作流指引

**关键设计约束(实现时务必遵守)：**
- task_id 由标题 slugify 生成且**不可变**；同名任务被拒绝；**无重命名**(删除后重建)。
- `delete_task` 级联删除任务目录与绑定文件，但**不删**已打上 `task_id` 的笔记。
- **绑定文件是一次性消费凭证**：`set_session_task` 写入 `repowiki/.meta/task_bindings/<session_id>.json` 后，首次 `capture_conversation` 成功落盘即自动删除；显式传 `task_id` 不消费绑定。同会话在绑定删除后再次捕获（supersede）会继承旧 raw 的 task_id，归属不丢。
- `query_wiki` 不校验任务存在性(幽灵 `task_id` 允许)。
- `memories/<user_id>.md` 追加式原子写(临时文件 + `os.replace`)，并发串行；**每人只写自己的文件**(文件所有权即 git 级互斥原语)；条目带 `### YYYY-MM-DD HH:MM` 时间戳头(ADR-0001：保持 markdown 不迁 JSONL，时间戳头是切条/截断/压缩的解析边界，存量无头文件运行时空行回退解析)。
- `get_task_context`/`get_task` 的 memories 返回**分层有界**：热层=自己(+存量 legacy)文件取最近 20/5 条全量；温层=其他成员仅注入摘要+最近 2 条(超预算降级为一行线索)；`memories_total`/`memories_truncated` 标记截断、`max_memories` 参数翻页；`compaction_due=true` 表示热层超压缩阈值(40 条/24KB)且超出保留窗口，应跑 `compact_task_memories`(两段式无状态：`mode="prepare"` 取待压条目由调用方写摘要 → `mode="submit"` 落盘；**文件域压缩，只压自己的文件(+legacy 并入)，永不动他人文件**；原文按归属归档 `memories-archive/<user_id>.md` 不删，直写不走 confirm 闸门)。
<!-- TEAM-MEMORY-TASK:END -->
