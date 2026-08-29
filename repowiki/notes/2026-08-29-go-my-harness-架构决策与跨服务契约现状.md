---
type: architecture
title: "go-my-harness 架构决策与跨服务契约现状"
tags: ["agentengine", "architecture", "deepseek", "minimax", "planmode"]
aliases: ["architecture decisions", "跨服务契约", "centralized 布局", "LLM adapter"]
metadata:
  date: 2026-08-29
  task_id: 5c8f70f45623
  related_modules: ["engine", "provider", "tools", "schema", "context", "feishu", "app"]
status: draft
generated: { by: codewiki/5.4.5, at: 2026-08-29T08:24:16Z }
stale_after: 2027-08-29
---

## 架构决策

1. **适配器隔离 SDK**：`internal/schema` 为纯数据结构契约层（零第三方依赖），`internal/provider` 提供 OpenAI 兼容（DeepSeek/智谱）与 Anthropic 兼容（MiniMax）两套适配器双向翻译，引擎只面向 `LLMProvider` 接口，实现供应商中立。
2. **无状态引擎 + 外部化会话**：`AgentEngine` 不保存历史，上下文全部由 `Session` 承载；多端（CLI/飞书）共享引擎实例，会话按 ChatID/固定 ID 物理隔离。
3. **上下文治理前置**：工作记忆窗口（最近 6 条）+ [Compactor](../internal/context/compactor.go) 双重降级（远期掩码、近期头尾截断），[Session](../internal/engine/session.go) 保存全量历史供回溯。
4. **错误即信息**：工具执行错误转字符串回传模型自愈，不中断主循环；bash 30s 超时、输出 8000 字节截断约束资源边界。
5. **PlanMode 状态外部化**：长程任务强制写 PLAN.md/TODO.md，进程重启后断点续传。

## 跨服务契约现状

- 当前工作区仅挂载 `go-my-harness` 单仓，**无跨服务 HTTP/MQ 调用**（RouteNode 匹配为 0）。
- 若后续新增业务仓并产生调用，需在本 note 补充：调用 URL/方法/参数/返回结构、消息 topic/payload schema、共享数据模型、熔断/限流/重试策略。
- 潜在客户端调用盲点：`server.go` 声明 8080 HTTP 服务但无法编译（遗留占位），飞书接入组件 `FeishuBot` 已实现但无入口挂载。

## 已知边界

- 路径穿越检测（read_file 等）仅注释提示未实现；
- [Session](../internal/engine/session.go) 历史仅存内存，进程重启丢失；
- 消息文本解析为粗略字符串处理（飞书）；
- 网络失败无重试/退避策略。
