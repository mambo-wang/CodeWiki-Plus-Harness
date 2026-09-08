---
type: lesson
title: "同一项目多副本时，`import codewiki` 的解析结果决定哪份代码真正生效"
tags: ["codewiki", "lesson"]
metadata:
  date: 2026-09-04
  related_modules: ["codewiki", "environment", "hooks"]
  severity: medium
  source_ref: "conversations/conv-测试今天上午的提交.md"
  scene: "跨仓排障"
status: draft
author: iamwangbao-163-com
generated: { by: codewiki/5.6.0, at: 2026-09-04T08:37:52Z }
stale_after: 2027-03-03
origin: conversation

---

## 背景

本机对同一个上游（`origin = mambo-wang/CodeWiki-Plus.git`）存在多个 clone：harness 工作区里的 `CodeWiki-Plus/`（业务仓克隆）和 editable 安装的 `D:\repos\CodeWiki-CN`。排查“改了代码怎么不生效”时，根因往往是改错了副本。

## 结论

- MCP 服务与 hook 脚本的源文件，**由 Python 的 `import codewiki` 解析结果决定**，实际加载的是 editable 安装的 `D:\repos\CodeWiki-CN`（版本 5.5.1），工作区里的 `CodeWiki-Plus/` 克隆**不参与运行**——改它对 MCP 无效果。
- 改完源码**必须重启 MCP 服务**才会生效（服务进程持有旧代码），这一步 Agent 无法代劳，要提示用户。
- 两个 clone 若指向同一 upstream 且在同一分支（如都为 `develop`、HEAD 同为 `92bf399`），在任一副本 `git pull` 即可拿到另一副本的改动，**无需重装 editable 包**。

## 校验手法

改 hook 后核对三副本是否一致，用 SHA256 比对（该轮三者全等 `C6EB9023497A` 才判定分发成功）：

- `codewiki/hooks/`（源码包内）
- `<harness>/.codebuddy/hooks/`
- `<harness>/.qoder/hooks/`

任一副本 hash 不同即说明未下发到该宿主，下一次会话仍会跑旧逻辑。

## 适用范围

排障顺序固定为：**先确认生效代码副本 → 再改代码 → 再重启 MCP → 最后复验**。跳过第一步会导致在错误的副本上改半天。
