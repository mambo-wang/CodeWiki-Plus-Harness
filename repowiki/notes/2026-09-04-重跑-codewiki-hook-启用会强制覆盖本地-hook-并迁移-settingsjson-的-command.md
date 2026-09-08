---
type: pitfall
title: "重跑 codewiki hook 启用会强制覆盖本地 hook 并迁移 settings.json 的 command"
tags: ["codewiki", "pitfall"]
metadata:
  date: 2026-09-04
  related_modules: ["hooks", "ide-config", "codebuddy-config"]
  severity: medium
  source_ref: "conversations/conv-测试今天上午的提交.md"
  scene: "hook 升级与验证"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:37:51Z }
stale_after: 2027-03-03
origin: conversation

---

## 背景

业务仓升级了 `task_session_start.py`（新增知识库提示段）后，harness 工作区里 `.codebuddy/hooks/task_session_start.py` 的 hash 仍是旧值（`64E65FBF9F48`，源码为 `C6EB9023497A`），本仓下一个会话拿不到新功能。用户问：“重新执行启用 hook 的方法，会覆盖更新吗？”

## 结论（会，且是强制覆盖）

两条启用路径（CLI 与 MCP prompt `team-memory-hook` 的步骤 1）行为一致，都用 `shutil.copy2` **无条件覆盖**，**无版本比较、无 `.bak` 备份**：

```python
319:330:D:/repos/CodeWiki-CN/codewiki/cli/utils/ide_config.py
    # 1a. 强制拷贝 hook 脚本并做 ast 校验
    for name in HOOK_FILES:
        src = pkg / "hooks" / name
        dst = hooks_dir / name
        if not src.is_file():
            raise IdeWiringError(f"Missing hook source in codewiki package: {src}")
        shutil.copy2(src, dst)
```

实测一次执行的结果：`[copied] capture_session_end.py / task_session_start.py / .codebuddy/agents/distill-worker.md`，`[updated] settings.json` 与 `AGENTS.md` 的 `TEAM-MEMORY-TASK` 标记块；hash 变为 `C6EB9023497A`，端到端复跑 `returncode=0` 且 `has_knowledge_tip=True`。

三个容易踩的点：

1. **源文件由 `import codewiki` 解析**，不是工作区里的克隆。本机解析到 editable 安装的 `D:\repos\CodeWiki-CN`，所以重跑能拿到最新代码。
2. **覆盖后要下一个新会话才生效**——当前会话已跑过旧 hook，不受影响。
3. **`.codebuddy/` 在 harness 仓是入库的**（未被 gitignore），所以覆盖会产生可见的待提交 diff，不会悄悄改。

## 附带副作用：`settings.json` 的 command 被迁移（有意的旧格式迁移，不是 bug）

```diff
- "command": "\"d:\\PersonalData\\wangbao\\CodeWiki-Plus-Harness/codewiki-plus/.venv/Scripts/python.exe\" \"d:\\PersonalData\\wangbao\\CodeWiki-Plus-Harness/.codebuddy/hooks/task_session_start.py\""
+ "command": "python \".codebuddy/hooks/task_session_start.py\""
```

- 好处：随仓库可移植（旧值里的机器绝对路径在别人 clone 后必然失效）。
- 代价：**不再使用项目 `.venv` 的 python，改用 PATH 里的 python**。若换机器上 PATH python 没有装 `codewiki`，`SessionEnd` 采集会跳过并输出提示——**不阻塞 IDE**，可接受但需留意。
- 幂等保护：`settings.json` 按 command 去重合并，不会重复注册；`AGENTS.md` 只替换 `TEAM-MEMORY-TASK` 标记块（本仓位于 165–193 行）。

## 建议

重跑前先确认本地 hook 无定制改动（有就会被冲掉）；重跑后立刻 `git diff` 扫一眼 `.codebuddy/`，尤其是 `settings.json` 的 command 迁移。
