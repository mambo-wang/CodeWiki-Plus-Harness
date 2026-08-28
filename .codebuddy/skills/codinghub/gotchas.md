# 常见陷阱 (Gotchas)

> CodingHub 操作中容易踩坑的地方，操作前建议快速浏览。

1. **文件上传走 REST，不走 MCP**: `h3_coding_hub_tool_file_upload` 只返回端点信息，实际用 curl 或 `$CHUB tool-file-upload`
2. **下载链接是相对路径**: `h3_coding_hub_tool_download` 返回的 URL 需拼接 `{baseUrl}` 前缀；直接用 `$CHUB tool-download` 更省事
3. **MCP 端点无需 JWT**: `/sse` 和 `/mcp/**` 已 permitAll，不要传 Authorization
4. **chub CLI 自动处理 token**: Agent 不要手动登录或拼接 `Authorization` 头
5. **文件上传端点无需 JWT**: `POST /api/v1/tools/{toolId}/files` 已 permitAll
6. **modify 的 partial update**: 只更新传入的字段；version 不传自动递增
7. **skill 多文件必须压缩**: 若 skill 目录含多个文件（SKILL.md + references/scripts 等），必须先整体压缩为 zip（保留目录结构）再上传，禁止逐个上传多个文件；只有目录中仅含一个 SKILL.md 时才可直接上传
8. **知识库文档上传也走 REST**: `h3_coding_hub_kb_upload_document` 只返回端点信息
9. **上传后异步处理**: 文档经历 UPLOADING → CONVERTING → CHUNKING → EMBEDDING → READY，必须等全部 READY 后再检索
10. **带图片文档必须预处理**: 含截图/图表的 PDF/Word/PPT 需先用 markitdown-mcp 预处理
11. **kb_search 默认值**: `rerank=true`, `expandContext=1`，一般无需修改
12. **Python 的 requests 依赖**: `chub.py` 依赖 `requests` 库，初始化脚本的 `python -c "import requests"` 会自动检测；若缺失先 `pip install requests`。Node 版本无需额外安装
13. **MCP 类型工具下载目录**: 安装 MCP 类型工具（如 dbhub mcp）时，压缩包必须下载到 `~/CodingHub/`，不要下载到临时目录或 skill 目录；下载前确保目录存在（`mkdir -p ~/CodingHub`）；报告中必须注明完整下载路径
14. **插件禁止声明 commands/skills 字段**: 插件 `plugin.json` 里显式声明 `commands`/`skills` 会导致组件加载失败（声明路径与自动扫描的平铺布局不一致），永远不要写这两个字段
15. **插件命令文件平铺命名 + frontmatter 写 `name`**: 命令注册名 = frontmatter `name`（无 `name` 时取文件名）。`commands/wbnb.md` + `name: "wbnb"` → `/wbnb` ✅；点分文件名 `commands/verify-ui-pack.wbnb.md` 且无 `name` 会注册成 `/verify-ui-pack.wbnb` ❌
16. **插件上传 name/version 必须一致**: 上传 zip 内 `plugin.json` 的 name/version 必须与创建草稿时一致，否则被拒
17. **插件更新版本必须递增**: `PUT /api/v1/plugins/{id}` 要求 version 变化（1.0.0 → 1.0.1），版本不变会被拒绝
18. **插件打包压缩根**: zip 的根目录直接放 `plugin.json` 与 `commands/` 等目录，不要多套一层外层文件夹（如 `openspec-pack-1.0.0/` 作为顶层目录），否则扫描不到
