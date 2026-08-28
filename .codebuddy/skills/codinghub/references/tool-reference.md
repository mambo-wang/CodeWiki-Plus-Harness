# 工具清单与 HTTP API 对照

17 个 MCP 工具（9 只读 + 8 写入）与对应 REST API。MCP 不可用时使用 HTTP 直连。

## MCP 连接信息

- 协议: SSE（Server-Sent Events）
- 入口: `http://<host>:8082/sse`
- 消息端点: `POST /mcp/message`
- 健康检查: `GET /mcp/health`

## 认证差异

| 通道 | 只读 | 写入 |
|------|------|------|
| MCP | 无需认证 | 每次调用传 `username` + `password` 参数 |
| HTTP | 无需认证 | `Authorization: Bearer <accessToken>`（通过 `/api/v1/auth/login` 获取） |

> **例外**：文件上传端点 `POST /api/v1/tools/{toolId}/files` 已 permitAll，无论 MCP 还是 HTTP 都不需认证。

## 只读工具 ↔ HTTP API

| MCP 工具 | HTTP 端点 | 方法 | 参数/Body |
|----------|----------|------|-----------|
| `h3_coding_hub_tool_search` | `/api/v1/tools` | GET | query: `keyword?`, `category?(=categoryId)`, `tag?`(MCP 标签名称，忽略大小写；HTTP 用 `tagId?`), `sortBy?=hot`, `page?=0`, `size?(=limit)` |
| `h3_coding_hub_tool_get` | `/api/v1/tools/{toolId}` | GET | - |
| `h3_coding_hub_tool_files` | `/api/v1/tools/{toolId}/files` | GET | - |
| `h3_coding_hub_tool_download` | `/api/v1/tools/{toolId}/files/{fileId}/download` | GET | 返回文件流 |
| `h3_coding_hub_post_search` | `/api/forum/posts` | GET | query: `keyword?`, `page?=0`, `size?(=limit)` |
| `h3_coding_hub_post_get` | `/api/forum/posts/{postId}` | GET | - |
| `h3_coding_hub_kb_search` | `/api/v1/knowledge/{kbId}/search` | POST | body: `{"query":"...", "topK":5, "rerank":true, "expandContext":1}` |
| `h3_coding_hub_kb_document_status` | （直连 RAG 服务，无等效 HTTP） | - | 通过 MCP 调用或 `GET /api/v1/knowledge/{kbId}` 查看文档数 |
| `h3_coding_hub_kb_upload_document` | （返回 RAG 端点信息） | - | MCP 工具返回 RAG 服务上传 URL |

**辅助只读 API**（MCP 未封装但 HTTP 可用）:

| 端点 | 说明 |
|------|------|
| `GET /api/v1/categories` | 工具分类列表 |
| `GET /api/forum/categories` | 论坛分类列表 |
| `GET /api/v1/tags?type=TOOL\|FORUM\|VIDEO` | 标签列表 |
| `GET /api/v1/knowledge` | 知识库列表 |
| `GET /api/v1/knowledge/{id}` | 知识库详情（含文档列表） |

## 写入工具 ↔ HTTP API

所有写操作 HTTP 通道都需 `Authorization: Bearer <accessToken>`；MCP 通道每次传 `username`/`password`。

| MCP 工具 | HTTP 端点 | 方法 | Body（JSON） |
|----------|----------|------|--------------|
| `h3_coding_hub_tool_create` | `/api/v1/tools` | POST | `{"name", "categoryId", "content", "version", "description?", "tagIds?"}` |
| `h3_coding_hub_tool_modify` | `/api/v1/tools/{toolId}` | PUT | `{"name?", "categoryId?", "content?", "version?", "description?", "tagIds?"}`（不传 version 自动递增） |
| `h3_coding_hub_tool_file_upload` | `/api/v1/tools/{toolId}/files` | POST | **multipart**: `files=@path` + `readme` 字段；**无需认证** |
| `h3_coding_hub_tool_file_delete` | `/api/v1/tools/{toolId}/files/{fileId}` | DELETE | - |
| `h3_coding_hub_post_create` | `/api/forum/posts` | POST | `{"title", "content", "categoryId", "tagIds?", "visibility?"}` |
| `h3_coding_hub_kb_create` | `/api/v1/knowledge` | POST | `{"name", "description?", "chunkMode?"(默认structural), "chunkSize?"(默认800), "chunkOverlap?"(默认50)}` |
| `h3_coding_hub_kb_update` | `/api/v1/knowledge/{kbId}` | PUT | `{"name?", "description?", "chunkMode?", "chunkSize?", "chunkOverlap?", "rerank?"}` |
| `h3_coding_hub_kb_delete` | `/api/v1/knowledge/{kbId}` | DELETE | - |

## 认证接口（HTTP 专用）

| 端点 | 方法 | Body | 返回 |
|------|------|------|------|
| `/api/v1/auth/login` | POST | `{"username", "password"}` | `data.accessToken`（15min）、`data.refreshToken`（7 天） |
| `/api/v1/auth/refresh` | POST | header: `Authorization: Bearer <refreshToken>` | `data.accessToken`（新） |
| `/api/v1/auth/register` | POST | `{"username", "nickname", "password", "role?"}` | USER 角色直接返回 token |

## 通用响应包装

所有 REST 响应格式：
```json
{
  "code": 200,
  "message": "成功",
  "data": { ... },
  "success": true
}
```
分页响应 `data` 结构：
```json
{ "records": [...], "total": 100, "page": 0, "size": 20, "totalPages": 5 }
```

## 错误码

| HTTP 状态 | 含义 | 处理 |
|----------|------|------|
| 200/201 | 成功 | 读取 `data` |
| 401 | token 无效或过期 | 清空 `accessToken` 重新 login 重试 |
| 403 | 无权限（不是 owner/admin） | 检查用户角色 |
| 404 | 资源不存在 | 校验 ID |
| 413 | 文件过大 | 检查 Nginx `client_max_body_size`（当前 120m） |
