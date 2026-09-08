### 2026-09-04 16:43

## 2026-09-04 验证《知识可信度工程-准确性保鲜冲突机制技术详解》机制

### 结论
- 文章写的是 **CodeWiki-CN v5.6.0（架构评审 2026-09 #1 拆分后）** 的模块布局：note_writer / note_lifecycle / note_freshness / note_ingest / note_query 五个文件。
- 本仓业务子仓 **CodeWiki-Plus v5.5.1（develop, 92bf399）拆分前 monolith**，上述五个文件在任何分支历史中都不存在；对应能力集中在 `codewiki/mcp/tools/knowledge_loop.py`（load_freshness_config L311 / evaluate_note_freshness L379 / _freshness_distribution L441 / handle_ingest_note L506 / _apply_status_to_file L787 / handle_confirm_note L996 / handle_reject_note L1034 / handle_query_wiki L1938）。
- 机制层：文章描述的绝大多数机制在两个版本都成立（证据哈希、stale_after 级联、检索豁免、索引三层自愈、幂等导入、supersede、采纳 2×、low_adoption）。
- `wiki_lint._ALL_CHECKS`（L25-53）两版本逐字一致。

### 发现的 9 处表述与实现不符（已逐条定位）
1. 引注 note_consolidation.py `22:36` → 实际 L7-26（Mode C 协议）。
2. 引注 src/evidence.py `42:60` 覆盖 make_entry → make_entry 实际 L62-87。
3. §7.2 声称 note_merge 产出 `conflicting` 冲突列表 → 实现中不存在（全文 186 行无该字段）。
4. §7.1 哈希后缀写 sha1[:8] → 实际 `[:6]`（note_ingest.py L315）。
5. §7.3 称 content_hash 变化触发 supersede → 实际：同 hash=duplicate 拒收；同 source_session 且 status==pending 才 supersede（store.py L645-676）。
6. §6.2 称取「高置信度断言行（score ≥ 阈值）」→ 实际所有 `(confidence: X.XX)` 行都计入，阈值 0.3 是单文件 unsupported 占比。
7. §6 表 okf_conformance 标 warning → 实际缺 frontmatter/缺 type 是 error（L1699/L1744），仅 stale_after 过期是 warning。
8. §7.2 称被并原稿由人 reject 归档 → note_merge 侧是确认后 `batch_set_status` 置 superseded；reject_note 属于 consolidation 侧。
9. §2.1 称按行区间现读源码 → 写作提示词实际 `file_manager.load_text()` 整文件读（prompt_template.py L618），按行区间现读是 read_code_components 工具路径。

### 待办
- 等用户确认后把「文章引注与实现漂移」沉淀为 pitfall 笔记。
- 若本仓 CodeWiki-Plus 升级到 5.6.0，文章路径即全部生效，届时重验行号。

### 2026-09-04 16:46

安装 ponytail（2026-09-04）：5 个 skill（ponytail / ponytail-review / ponytail-audit / ponytail-debt / ponytail-help）已复制到用户级 `%USERPROFILE%\.codebuddy\skills\`，全局生效；`ponytail-gain`（本地基准记分板）无对应机制，跳过。临时 clone 保留在 `%TEMP%\ponytail`（HEAD 2ed6c52，v4.9.0）供升级参考。未并入项目 AGENTS.md —— 是否改 always-on 待用户决定。

### 2026-09-05 18:29

验证 CodeWiki-CN 文档：业务子仓 CodeWiki-Plus 已从 92bf399 快进到 2909569（v5.6.0 + 架构评审拆分），`note_writer/note_lifecycle/note_freshness/note_ingest/note_query.py` 五文件全部就位，此前「路径层失效」判定作废；两个克隆现处同一提交树且 clean。

### 2026-09-05 18:29

文章与实现的 10 处偏差在最新代码上全部维持（抽查 §7.2 无 conflicting 冲突列表、§7.1 哈希后缀实际 [:6] 复证），均为内容层失真而非版本错位。

### 2026-09-05 18:29

偏差 #10 已定位并修复：query_wiki(mode=check)（note_query.py）与蒸馏去重召回 _bm25_recall_candidates（distill_conversation.py）未过滤 deprecated；双 fixture 脚本验证通过（mixed 只剩 stable、deadonly 为空、lint 干净）。回归测试阶段 pytest teardown 报内部错误，需区分是环境问题还是改动引入。

### 2026-09-05 18:29

待办：本次 pull 同步了子仓自带的 repowiki/，尚未处置，需决定是否清理以恢复纯代码仓形态。

### 2026-09-05 18:29

待办：11 条补蒸馏产生的 draft 笔记待 confirm_note 确认；「技术文档引注与实现漂移」是否沉淀为笔记待用户拍板（本批草稿已覆盖该主题）。

### 2026-09-08 09:34

## 2026-09-08 讨论「蒸馏/生成 wiki 后是否自动提交推送」

### 结论：保持 `git_sync: advisory + auto_push: false`，不自动化
- 三条理由：① 工作区未提交改动里有意与误回退混杂（见 pitfall 笔记），自动提交会把误回退一起推走；② `distill_conversation` 产出 draft 笔记，confirm 前自动提交会绕过确认闸门；③ 集中式布局红线「业务仓目录出现在 git status 就绝不可 git add」依赖人工拦截，自动化后拦截消失。
- 若将来要自动化：只 `git add repowiki` 白名单 + guard（`git status --porcelain -- . ':(exclude)repowiki'` 非空则中止），提交时机在 `confirm_note` 之后而非 distill 之后，push 限纯 harness 仓 + ff-only。
- 用户明确：**不把这条方案取舍写成 decision 笔记**，仅停在本次对话。下次别再问。

### 本轮已做
- 补蒸馏 1 条（friction 20）→ 3 条笔记，2 条 draft 已 confirm 转正（deprecated 旁路泄漏 pitfall / 外部文档基线对齐 lesson），1 条 merge 进「集中式布局的知识分区模型」（该页 stable 已 verify，merge 后待重新 verify）。

### 待办
- 子仓 CodeWiki-Plus 这次 pull 同步下来的自带 `repowiki/` 未处置（本仓被 `.gitignore` 第 32 行 `/CodeWiki-Plus/` 挡住，不影响本仓提交，但属反向污染源）。
- 另有 1 条未关联任务的 raw 未蒸馏。
- 11 条 draft 笔记待确认（本轮清掉 2 条）。
