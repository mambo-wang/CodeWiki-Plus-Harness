# 知识库管理指南

知识库（Knowledge Base）模块支持文档管理、语义检索和 RAG（检索增强生成）。文档上传后经过分块（Chunking）→ 向量化（Embedding）→ 可搜索。

## 创建知识库

步骤:
1. 获取 CodingHub 账号凭据（同主文件「凭据获取策略」）
2. 调用 `h3_coding_hub_kb_create`，传入以下参数：
   - `name`（必填）：知识库名称
   - `description`：知识库用途描述（推荐填写，便于后续管理）
   - `chunkMode`：分块模式，默认 `structural`（按文档结构分块），可选 `fixed`（固定大小分块）
   - `chunkSize`：分块大小（字符数），默认 800
   - `chunkOverlap`：分块重叠（字符数），默认 50
3. 记录返回的 `kbId`，后续上传文档、检索均需使用

> **rerank 策略**：创建知识库时无需传 `rerank` 参数，系统默认启用重排序。如需关闭可在后续更新时调整。

## 上传文档到知识库

**触发词**: "上传文档"、"添加到知识库"、"把文件传到知识库"

> **重要**：上传前优先使用 **markitdown-mcp** 做文档预处理，确保图片可见、格式正确。

步骤:
1. 确认目标知识库的 `kbId`
2. **文档预处理**（关键步骤）：
   - **纯文字文档**（无嵌入图片的 md/txt/pdf/docx/pptx 等）：可直接通过 REST 上传
   - **带图片的文档**（含截图的 PDF/Word/PPT，含流程图/架构图/截图的文件）：**必须先用 markitdown-mcp 预处理**，流程如下：

     ```mermaid
     flowchart TD
         A[原始文档] --> B{是否含图片/截图?}
         B -->|是| C[调用 markitdown convert_to_markdown\n参数: uri=文件路径, extract_images=true]
         B -->|否| F[直接上传]
         C --> D[获取转换后的 markdown 文本\n及提取到磁盘的图片文件]
         D --> E[将图片文件一并上传到知识库\n确保 markdown 中图片引用路径正确]
         E --> G[上传 markdown 文件]
         F --> G
         G --> H[调用 h3_coding_hub_kb_document_status\n查询处理进度]
     ```

     **markitdown 预处理工具选择**：
     - `convert_to_markdown(uri, extract_images=true)`：完整转换文档为 markdown，提取图片到磁盘。适用于需要保留完整原格式的文档。
     - `analyze_document(path)`：提取文档骨架 + 图片列表，便于 AI 用视觉能力逐张读取图片内容并理解上下文。适用于需 AI 分析图片内容的场景（如含图表、UI 截图的文档）。

   - **多文档批量预处理**：如果有多个文档文件，逐一调用 markitdown 转换后再批量上传。

3. **执行上传**：
   - 调用 `h3_coding_hub_kb_upload_document` 获取上传端点信息（返回批量上传 URL、支持类型、curl 示例）
   - 上传端点无需认证，直接通过 HTTP Multipart POST 上传：
     ```bash
     curl -X POST http://<host>:8082/api/v1/knowledge/{kbId}/documents/upload \
       -F "files=@/path/to/doc1.md" \
       -F "files=@/path/to/doc2.md"
     ```
   - 支持批量上传，单次最多 20 个文件
   - 上传后服务器异步处理，不会立即返回搜索结果

4. **查询处理进度**：
   - 调用 `h3_coding_hub_kb_document_status(kbId)` 查询集合内所有文档状态
   - 状态流转：`UPLOADING` → `CONVERTING` → `CHUNKING` → `EMBEDDING` → `READY`
   - 也可传 `docId` 查询单个文档状态
   - **等全部文档变为 `READY` 后再进行检索操作**

**支持的文件类型**: md, txt, pdf, docx, pptx, xlsx, py, js, ts, java, go 等常见格式

## 检索知识库（语义搜索）

**触发词**: "搜索知识库"、"检索文档"、"查一下知识库中关于 XX 的内容"

默认参数（**rerank 默认开启，expandContext 默认传 1**）：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `kbId` | 必填 | 知识库 ID |
| `query` | 必填 | 搜索关键词（语义搜索，支持自然语言） |
| `topK` | 5 | 返回的相似片段数 |
| `rerank` | **`true`** | 是否启用重排序（**默认开启**，提升结果相关性） |
| `expandContext` | **`1`** | 上下文扩展块数（**默认 1**，返回匹配片段前后的上下文） |

步骤:
1. 确认目标知识库的 `kbId`
2. 调用 `h3_coding_hub_kb_search(kbId, query, topK=5, rerank=true, expandContext=1)`
3. 检查返回结果中的片段内容，确认相关度

> **tip**：如果对检索结果不满意，可以尝试：
> - 调整 `topK` 增加候选范围
> - 调整 `expandContext` 获取更多上下文（设为 0 则只返回精确匹配块）
> - 关闭 `rerank` 可查看原始向量相似度排序（不推荐，通常开启 rerank 效果更好）

## 更新知识库配置

**触发词**: "修改知识库"、"更新知识库配置"

步骤:
1. 调用 `h3_coding_hub_kb_update(kbId, ...)`，传入要修改的字段
2. 支持修改：`name`, `description`, `chunkMode`, `chunkSize`, `chunkOverlap`, `rerank`
3. 未传入的字段保持不变（partial update）

> 注意：修改 `chunkMode`/`chunkSize`/`chunkOverlap` 等配置后，已有文档**不会自动重新分块**。如需生效，需重新上传文档。

## 删除知识库

**触发词**: "删除知识库"、"移除知识库"

步骤:
1. 确认目标知识库的 `kbId`
2. 调用 `h3_coding_hub_kb_delete(kbId, username, password)`
3. 删除后将移除知识库及其包含的所有文档数据，不可恢复

> 知识库删除的认证机制与工具写入操作相同，需要 `username` + `password`。
