---
type: Conversation
title: "conversation 20260905T102925Z"
status: distilled
stale_after: 2026-12-04
generated: { by: codewiki/5.6.0, at: 2026-09-05T10:29:25Z }
captured_at: "2026-09-05T10:29:25Z"
content_hash: "sha256:308543029cdf2c1fc34281d090b3e575e27e51307759cb1c3d98b84d6747427e"
friction_score: 20
friction_signals: "correction=0,interrupt=0,repeat=1,user_turns=7"
keep_raw: false
link_to: ""
source_session: "a01b831a85244f899ee80dddb1cd15be"
task_id: "维护"
turn_count: 22
---

# Conversation Transcript

user: 用本仓，验证D:\repos\CodeWiki-CN\docs\知识可信度工程-准确性保鲜冲突机制技术详解.md 文章表述的机制
user: <question>本次会话是否关联任务记忆？（用于跨会话延续上下文）</question>
<answers>
维护
</answers>
</question_item>
</questions>
</question_answer>
assistant: 验证完成。核心结论：**文章写的是 CodeWiki-CN v5.6.0（架构评审 2026-09 #1 拆分后）的代码布局，本仓子仓 CodeWiki-Plus 是 v5.5.1（拆分前的 monolith），按文章路径在本仓索骥会全部落空；机制层绝大多数成立，但有 9 处表述与实现不符。**

## 一、基线差异（最关键）

| | CodeWiki-CN（文章所在仓） | 本仓 CodeWiki-Plus |
|---|---|---|
| 版本 | 5.6.0 | 5.5.1（`develop` @ 92bf399, 2026-09-03） |
| `note_writer.py`/`note_lifecycle.py`/`note_freshness.py`/`note_ingest.py`/`note_query.py` | 存在 | **不存在，且 `git log --all` 全分支历史中都查不到** |
| 承载者 | 上述 5 文件 | `codewiki/mcp/tools/knowledge_loop.py`（`load_freshness_config` L311、`evaluate_note_freshness` L379、`_freshness_distribution` L441、`handle_ingest_note` L506、`_apply_status_to_file` L787、`handle_confirm_note` L996、`handle_reject_note` L1034、`handle_query_wiki` L1938） |

机制层在本仓全部在位，`wiki_lint._ALL_CHECKS`（L25-53）两版本逐字一致。所以：**文章不是错在机制，是错在"地址"对本仓失效 + 若干细节被理想化。**

## 二、行号引用逐条校验（以 CN v5.6.0 为基线）

**准确**：`src/evidence.py` L1-9 / L42 / L107-119；`mcp/tools/evidence.py` L25-39 / L177-191 / L200-226 / L284-307；`note_freshness.py` L22-41 / L94-153 / L156-165；`note_writer.py` L125-140 / L193-208；`note_lifecycle.py` L56-91；`wiki_lint.py` L25-53 / L1004-1096 / L1133-1156 / L1188-1256；`index_freshness.py` L10-20 / L242-261；`note_query.py` L1018-1042 / L642-644 / L988-995。

## 三、9 处表述与实现不符

| # | 文章说法 | 实际实现 |
|---|---|---|
| 1 | 引注 `note_consolidation.py 22:36`（Mode C 协议） | 内容在 **L7-26**，偏移约 15 行 |
| 2 | 引注 `src/evidence.py 42:60` 覆盖 `make_entry` | `make_entry` 在 **L62-87** |
| 3 | §7.2 `note_merge` 有 `conflicting` 冲突列表交人裁决 | **不存在**。全文 186 行只有 replace/append/union 三策略 + `> 合并自 <rel>` 来源标记，无冲突挑出机制 |
| 4 | §7.1 同标题异内容另存为 `<base>-<sha1[:8]>.md` | `[:6]`（`note_ingest.py` L315） |
| 5 | §7.3 "content_hash 变化触发 supersede" | 反过来：同 hash → `duplicate` 拒收；只有**同 `source_session` 且 `status == pending`** 的旧 raw 才被替换（`store.py` L645-676）。已蒸馏的 raw 不参与 supersede |
| 6 | §6.2 "高置信度断言行（score ≥ 阈值）" | 所有带 `(confidence: X.XX)` 的行**一律计入**，不看数值；阈值 0.3 是**单文件 unsupported 占比**上限，超了才报 warning（`wiki_lint.py` L982-983） |
| 7 | §6 表 `okf_conformance` 级别 = warning | 混合：缺 frontmatter / 缺 `type` 是 **error**（L1699、L1744），仅 `stale_after` 过期是 warning（L1840） |
| 8 | §7.2 "被并原稿由人 reject 归档" | note_merge 侧是确认后 `batch_set_status` 置 **superseded**（`note_merge.py` L6-8/L90-91）；`reject_note` 只在 consolidation 侧用 |
| 9 | §2.1 "按行区间到磁盘现读源码" | 写作提示词实际 `file_manager.load_text()` **整文件**读取（`prompt_template.py` L618）；按行区间现读是 `read_code_components` 工具路径 |

## 四、验证通过的核心机制（可放心引用）

- **§2.2 分级注入**：`prompt_template.py` L596-649 —— boilerplate(DTO/VO/Entity/Mapper) 仅签名；业务/基础设施全量源码；1-hop 依赖仅签名并提示 `use read_code_components for full source if needed` ✓
- **§2.3 写作协议**：L32-51 —— 证据行+理由+confidence、`[candidate]` 与 confidence ≤ 0.5、"Do NOT fabricate evidence" ✓
- **§3 内容哈希**：`repo://` + `sha256:`，`verify_entry` 四值 ok/stale/missing/unresolvable，幂等键 = resource，自动打标不覆盖已有 `sources` ✓
- **§4 双签名**：`_okf_actor` 默认 `codewiki/<版本>`，`by=human:x` 走人工签名；`confirm_note` 续期 `stale_after` ✓
- **§5 保鲜**：90/60 默认、`stale_after` 三级级联、`_freshness_distribution` 与 lint 共用同一判定、遥测排序 `-overdue, +last_hit`、索引三层快检 + 重建失败回退旧索引 + 60s 节流 ✓
- **§7.5 降权**：`×0.5` + `superseded_by` 抽取 ✓（另有一条文章漏写的并行机制 `doc_authority`：draft −0.25 / deprecated −0.35 加性权重，`retrieval.py` L463-493）
- **§7.6 容量**：`DEFAULT_MAX_SCENARIOS = 15`（可 schema 覆盖），red → `capacity_exceeded` 拒收 ✓
- **§8 采纳**：`0.03·ln(1+hits)` vs `0.06·ln(1+adopted)`，确为 2× 关系（cap 0.15）；`low_adoption` 默认 5/0/60 ✓

补蒸馏 worker 已在后台跑（3 条未关联 raw）。结论已写入任务记忆「维护」。

要不要把「技术文档引注与实现漂移」这条沉淀成 pitfall 笔记（文章路径相对本仓 5.5.1 失效 + 9 处细节失真）？待你确认后我再 `ingest_note`。
user: <question>本次会话是否关联任务记忆？（用于跨会话延续上下文）</question>
<answers>
维护
</answers>
</question_item>
</questions>
</question_answer>
<additional_input>
<teammate-message>
<from>distill-worker-1</from>
<summary>Message from distill-worker-1</summary>
<content>
积压已清空（prepare 复跑返回 noop）。仓库 d:\repos\CodeWiki-Plus-Harness，task_id="" （未关联任务）。

## 数量
- 处理对话：**4 条**（原计划 3 条 + 中途新增 1 条本会话的 team-lead 派单消息）
- 产出笔记：**11 条** = 10 条新建草稿文件 + **1 条 merge** 进已有笔记
- 去重：11 次冲突判定**全部是弱 BM25 关键词重叠**，逐条 read 候选笔记后决策 → 10 × `store` + 1 × `merge`，**0 条 skip**（无真重复）
- memories：**8 条已产出，但 memories_written = 0**（见下方「需要你决策」）
- 失败项：无

## 待确认草稿清单（均为 status=draft，需 confirm_note 后才正式生效；建议在停顿点一次性展示给用户）

来自「初始化多仓 WIKI 工作区 / MCP 全量走查」对话（7 条，最丰富）：
1. `notes/2026-09-04-subprocessruntimeout-对-git-这类多子进程命令无效会卡死整个-mcp-事件循环.md` — pitfall，priority 92。`subprocess.run(timeout=)` 杀不掉 git 孙进程、仍死等继承管道，实测 204.86s；MCP 是异步服务，同步阻塞拖垮整个事件循环（lint_wiki + write_doc_file 两个超时同一根因）。修法 `run_git_bounded()` → 3.21s。**本批价值最高，建议优先确认**
2. `notes/2026-09-04-集中式布局下仓库根-output-dirparent的-colocated-假设在多处失效.md` — pitfall，90。三处实证（get_module_tree / stale_evidence / by_file），前两处已修，**by_file 仍待修**
3. `notes/2026-09-04-集中式布局下知识产物的-repo-归属必须落在-metadata-下且-ingest-note-需显式传-repo-pa.md` — pitfall，86
4. `notes/2026-09-04-init-workspace-被取消也会落盘推断出的布局且之后拒绝原地改布局.md` — pitfall，85
5. `notes/2026-09-04-派生页与页面重写的语义陷阱状态提升不持久重写会丢聚合溯源字段.md` — pitfall，80
6. `notes/2026-09-04-mcp-全量走查方法分阶段工具矩阵-重启后服务端复验.md` — lesson，75
7. **（merge）** `init_wiki 在集中式布局下没有守卫，会反向污染业务仓` 已追加为 `notes/2026-09-02-集中式布局的知识分区模型.md` 的新章节（该页 status=stable、已人工 verify）。选 merge 的理由：它正好解释了该页「证据」里 `lint_wiki layout_violations 检出业务仓残留 repowiki/` 的成因，属互补而非重复。文件已确认追加成功（新增 36-55 行）

来自「测试今天上午的提交」对话（3 条）：
8. `notes/2026-09-04-重跑-codewiki-hook-启用会强制覆盖本地-hook-并迁移-settingsjson-的-command.md` — pitfall，88
9. `notes/2026-09-04-未提交的工作区改动会静默回退已落盘的提交内容.md` — pitfall，85
10. `notes/2026-09-04-同一项目多副本时import-codewiki-的解析结果决定哪份代码真正生效.md` — lesson，82

来自「安装 ponytail」对话（1 条）：
11. `notes/2026-09-04-ponytail-未支持-codebuddy按用户级-skillmd-做-instruction-only-集成.md` — workaround，78

## raw 处置
- 3 条有知识 → 已归档到 `repowiki/conversations/`，笔记 `source_ref` 指向归档件
- 1 条（team-lead 派单消息）→ 判定 no_knowledge，已删除。内容是纯编排指令，无持久知识

## 需要你决策（两件）

**1. 任务记忆全部丢失，需补。** 三次 submit 都返回 `memories_written: 0`、`task_id: null` —— 这些 raw 本身没绑任务，本会话也没做任务关联，所以我提取的 8 条任务进度（如「修复 1/2/3/5 已被 92bf399 包含」「by_file 缺陷已取证未修」「CodeWiki-CN/develop 有 9-10 个文件改动未提交」等）**一条都没落盘**。三条路：绑定任务后重跑蒸馏；或对已归档的 `conversations/` 重跑；或接受丢失（进度信息已部分沉淀进上面 11 条 draft 笔记）。请指示。

**2. 有一条可能过时的笔记。** `notes/2026-09-02-组件-id-使用-windows-反斜杠且不带仓名前缀.md` 现为 `status: deprecated`、`consolidated_into: wiki/scenarios/codewiki-mcp-分析链路-sop.md`。它在本次走查里仍作为弱候选被反复召回（3 次）。要不要顺手清理或调整，由你定——我只产出草稿，未做任何评审/确认操作。

## 我没有做的
未执行 confirm_note / reject_note / ingest_note；未修改任何业务代码，只写 `repowiki/` 下产物。暂存文件 `repowiki/raw/.distill-init-sweep.json` 已被工具读取后自动删除，已确认无残留。

<!-- codewiki:referenced-docs: ["notes/2026-09-02-集中式布局的知识分区模型.md", "notes/2026-09-02-组件-id-使用-windows-反斜杠且不带仓名前缀.md", "notes/2026-09-03-检索成本可见性先-check-再按-est-tokens-展开.md"] -->
</content>
</teammate-message>
</additional_input>
assistant: 任务已绑定到「维护」（会话 `a01b831a…`）。补蒸馏 worker 回来了，另外我顺着它的疑问查出一个新偏差。

## 蒸馏结果

- 处理 4 条未关联对话（原 3 条 + 本会话派单消息 1 条，后者判 `no_knowledge` 已删）
- 产出 **11 条笔记**：10 条新建 draft + 1 条 merge 进 `notes/2026-09-02-集中式布局的知识分区模型.md`（追加 36-55 行，该页已人工 verify）
- 11 次冲突判定全部是弱 BM25 重叠，逐条读原文后决策：10 × store + 1 × merge，0 条 skip
- **memories 丢失 8 条**：因 raw 未绑任务、本会话当时也没绑，`submit` 返回 `task_id: null` → `memories_written: 0`。已让 worker 改用 `add_task_memory(task_id="维护")` 逐条补写（重跑蒸馏没用，raw 已 distilled，prepare 会 noop）

## 新发现：文章 §7.5 的第 10 处偏差

worker 问「已 deprecated 的笔记为何还被反复召回（3 次）」——不是笔记的问题，是**召回链路漏了 status 过滤**：

| 路径 | 是否跳过 deprecated |
|---|---|
| `query_wiki` 主路径（BM25，`note_query.py` L989-990） | 跳过 ✓ |
| `query_wiki` by_file 路径（L643-644） | 跳过 ✓ |
| **`query_wiki(mode="check")`（L434-444）** | **未过滤** ✗ |
| **distill 去重 BM25 recall（`_bm25_recall` L570-607）** | **未过滤** ✗ |

后者是刻意的：它传 `apply_authority=False` / `apply_usage=False`（「去重是相似度判断，不是排序判断，不该让草稿因未评审而沉底」）——但也顺带绕过了生命周期闸门。结果就是文章说的「deprecated 直接跳过、不参与排序」只在主路径成立，check 与去重召回两条旁路会把它捞回来。

修法很简单：两处召回后按 frontmatter `status` 过滤掉 `deprecated` 即可（去重召回尤其该过滤——拿已废弃笔记当「是否重复」的裁判依据，语义上就不对）。

## 待你拍板（三件）

1. **11 条 draft 笔记**要不要确认转正？建议优先 #1（`subprocess timeout 对 git 无效会卡死 MCP 事件循环`，priority 92，实测 204.86s → 修后 3.21s）
2. **是否修上面第 10 条**的召回过滤（改 `note_query.py` 两处）
3. **是否沉淀**「技术文档引注与实现漂移」这条 pitfall（文章路径对本仓 5.5.1 失效 + 10 处细节失真）

等 worker 补写完任务记忆我再一起收尾。
user: <cb_summary>
This session is being continued from a previous conversation that was compacted to stay within the model context window.
Messages after this summary (if any) are the original recent turns. Tool results from before this summary were omitted.
If you need exact code, command output, or file contents from before compaction, re-read those files. Do not treat omitted tool bodies as still in context.

Earlier user requests:
- 用本仓，验证D:\repos\CodeWiki-CN\docs\知识可信度工程-准确性保鲜冲突机制技术详解.md 文章表述的机制
- <question_answer> <questions> <question_item id="task_bind"> <question>本次会话是否关联任务记忆？（用于跨会话延续上下文）</question> <answers> 维护 </answers> </question_item> </questions> </question_answer>

Tools used before this summary: read_file × 25, search_content × 16, execute_command × 11, list_dir × 5, mcp_call_tool × 3, search_file × 2, ask_followup_question × 1, mcp_get_tool_description × 1, task × 1
</cb_summary>

拉取本仓codewiki-plus最新代码，核验文章表述的准确性
assistant: 业务子仓 `CodeWiki-Plus-Harness/CodeWiki-Plus` 确认是独立 git 仓库，干净工作树，停在 `92bf399`（5.6.0 拆分前）；`origin/develop` 上已有 5.6.0 拆分提交（`bump version to 5.6.0`）。用户要求即拉取最新代码后再核验。
assistant: 快进成功：`92bf399 → 2909569`（`bump 5.6.0` + 拆分提交全部就位），业务子仓现在与文章所在仓处于**同一提交树**。在拉取后的干净代码上做抽查复核。
assistant: 拉取完成并已在最新代码上抽查复核。

## 拉取结果

| 项 | 值 |
|---|---|
| 业务子仓 | `d:/repos/CodeWiki-Plus-Harness/CodeWiki-Plus`（独立 git 仓） |
| 更新 | `92bf399 → 2909569`（fast-forward，工作树原本干净，无冲突） |
| 版本 | `codewiki/__init__.py` = **5.6.0** |
| 关键提交 | `bump version to 5.6.0` + 架构评审拆分（`knowledge_loop.py` 3015 行拆出） |

## 复核结论（抽查 4 项 + 既有逐行核对）

**此前「路径/版本层失效」的判定作废**——拆分后五文件已全部就位（`note_writer / note_lifecycle / note_freshness / note_ingest / note_query.py` + `note_merge / note_consolidation / note_types` 共存）。文章描述的代码结构，现在就是本仓的最新代码。且 `d:/repos/CodeWiki-CN` 克隆与业务子仓现在**同一提交（2909569，均 clean）**，之前对文章的逐行核对可直接迁移。

抽查复证（拉取后干净树上）：
- 五文件存在 ✓（`search_file` 列出 8 个 `note_*.py`）
- §7.2 `note_merge` **无 `conflicting`** ✓（0 匹配，偏差 #3 维持）
- §7.1 哈希后缀 `sha1(...).hexdigest()[:6]` ✓（`note_ingest.py` L315，偏差 #4 维持）

## 10 处偏差的最新状态

全部维持不变（两个克隆同一提交树，偏差与本地分支无关，是文章自身与实现不符）：

1. §0 引注 `note_consolidation.py 22:36` → 实际 L7-26（Mode C 协议）
2. §3.1 引注 `src/evidence.py 42:60` → `make_entry` 实际 L62-87
3. §7.2 声称 `note_merge` 产出 `conflicting` 冲突列表 → 实现不存在
4. §7.1 写 `sha1[:8]` → 实际 `[:6]`
5. §7.3「content_hash 变化触发 supersede」→ 实际：同 hash=`duplicate` 拒收；仅**同 `source_session` 且 `status==pending`** 才 supersede（`store.py` L645-676）
6. §6.2「高置信度断言行」→ 所有 `(confidence: X.XX)` 行一律计入；0.3 是单文件 unsupported 占比阈值
7. §6 表 `okf_conformance` 标 warning → 缺 frontmatter/缺 type 是 **error**，仅 `stale_after` 过期是 warning
8. §7.2「被并原稿由人 reject 归档」→ note_merge 侧是确认后 `batch_set_status` 置 `superseded`；`reject_note` 属 consolidation 侧
9. §2.1「按行区间现读源码」→ 写作提示词是 `file_manager.load_text()` 整文件读；按行区间是 `read_code_components` 工具路径
10. §7.5「deprecated 直接跳过」→ 主路径（by_file L643-644 / BM25 L989-990）成立，但 **`mode="check"` 与 distill 去重 `_bm25_recall` 两条旁路未过滤 status**，deprecated 笔记仍会被召回（worker 观察到 3 次）

附带提醒：这次 pull 还同步了远程 develop 上仓库自带的 `repowiki/`（大量笔记/对话/任务的增改），未经处理；如需把业务子仓回退为「纯代码仓」形态，要另行处置这部分。

另外，早前挂起的待决仍有效：11 条蒸馏 draft 笔记待确认、偏差 #10 是否修、以及是否把「文章引注与实现漂移」沉淀为笔记。需要我继续处理哪一项？
user: <cb_summary>
This session is being continued from a previous conversation that was compacted to stay within the model context window.
Messages after this summary (if any) are the original recent turns. Tool results from before this summary were omitted.
If you need exact code, command output, or file contents from before compaction, re-read those files. Do not treat omitted tool bodies as still in context.

Earlier user requests:
- 拉取本仓codewiki-plus最新代码，核验文章表述的准确性

Tools used before this summary: list_dir × 3, execute_command × 2
</cb_summary>

偏差 #10 是否值得修
assistant: 需要把「泄漏点是否真实存在」钉死——查 `wiki_search.search` 内核是否已过滤 deprecated、以及 deprecated 状态在哪些写入路径产生。
assistant: 内核 `wiki_search.search` 确无 status 过滤（仅 docstring 命中），deprecated 会进入搜索结果，由各调用方自行跳过。再确认两点：`_norm_status` 是否把 superseded/rejected 归一为 deprecated，以及 check/蒸馏旁路返回的条目是否携带状态字段。
assistant: 调查完毕。结论先行：**值得修，且成本很低**——这不是设计取舍，而是两处调用方漏挂了与主路径一致的「deprecated 跳过」规则。

## 证据链

**内核不设防，过滤全在调用方**（设计使然，需保留 superseded 追踪与 draft 标注）：
- `wiki_search.search`（`wiki_search.py`）不读 status，deprecated 照常进结果集。
- 对齐的调用方都自己跳：默认 BM25 主路径 `note_query.py:988-990`、`by_file` `note_query.py:642-644`（注释明写"same skip rule as the default BM25 path"）。`_norm_status`（`note_writer.py:36-40`）把 legacy `superseded`/`rejected` 一并归一为 `deprecated`，所以主路径实际跳三类。

**两处旁路漏挂了**：
1. `mode="check"`（`note_query.py:434-444`）：拿到 `bm25_search` 结果后只滤 `raw/sources/`，不读 frontmatter → deprecated/superseded 笔记能进 top-3，**撑起 `relevant=true` 和 top_score**，误导"知识是否存在"的预判。
2. 蒸馏去重召回 `_bm25_recall_candidates`（`distill_conversation.py:558-607`）：只按分数下限滤，不查 status。且该路径**特意 `apply_authority=False`**（`584-590`）——deprecated 连 `-0.35` 权威降权都没有，和正常笔记同权竞争 → 候选 payload 又不带 status（`599-605`），下游裁决 agent 无从识别死知识。

## 危害与频率

- 蒸馏侧最重：deprecated 假冲突可触发 `skip`/`merge` 裁决，**新知识被死笔记压制**；check 侧次之：白跑全文检索或"无需沉淀"的误判。
- 非假设：11 条对话补蒸馏中 worker 已观察到 3 次。
- 不过 deprecated 语料当前占比极低，属**低优先级但低成本的顺手修**，不是紧急缺陷。

## 修复方案（~20 行，无风险）

| 位置 | 改动 |
|---|---|
| `note_query.py` `_query_mode_check` | 对 ≤3 条 note 结果按 `_norm_status` 读 frontmatter 跳过 deprecated（镜像 by_file 写法），条目可顺带标 `note_status` |
| `distill_conversation.py` `_bm25_recall_candidates` | 同样跳过 deprecated；候选 payload 补 `status` 字段供裁决透明 |

- 复用 `note_writer._norm_status`（note_query 已 import 链可用），不碰内核（draft 标注 `991-993`、superseded_by 追踪 `1033-1042` 依赖原始结果）。
- 改后文章 §7.5 表述即完全成立，可顺手复核对齐。

要我现在按上面两处直接改到业务子仓 `CodeWiki-Plus`（只改代码，不提交）吗？
user: 修改并验证
assistant: [User Cancelled]
user: 修改并验证
assistant: 开始实施。先写一个可复现的验证脚本，在**修改前**跑基线，确认泄漏真实存在。
assistant: 基线确认 3 处泄漏（A 强去重把 deprecated 当合并目标；D check 模式 top-3 里混入 superseded+deprecated）。B/C 两档未被触发，需调整用例才能真正覆盖。先看阈值常量：
assistant: B 档需构造 0.35–0.5 的弱区间相似度，C 档在迷你语料下 BM25 分数到不了 2.5 下限——脚本中临时下调该下限以让该档可观测。重写为双 fixture 版本：
assistant: 基线明确：四个消费者全部泄漏，deadonly fixture 下新草稿会被直接并进 deprecated 笔记。现在实施修复。
assistant: 修复生效（mixed 全部只剩 stable；deadonly 全部为空；lint 干净）。现在跑回归测试：
assistant: 测试运行器在 teardown 阶段报了 pytest 内部错误（捕获文件已关闭），需区分是环境问题还是我引入的。改用无捕获模式并落盘完整输出：
