---
name: codinghub
description: CodingHub 工具广场与插件市场操作指南。当用户要求搜索/安装/发布/更新 CodingHub 工具或插件，制作插件包，发帖到论坛，管理知识库，或与 CodingHub 平台交互时使用。支持双通道：MCP 优先，HTTP 直连自动降级（Python 或 Node.js CJS CLI 封装，跨平台）。
version: 3.4.0
allowed-tools: 
disable: false
---

# CodingHub 操作指南

通过 **MCP（优先）** 或 **HTTP 直连（降级）** 与 CodingHub 工具广场交互，支持工具发现、安装、发布、更新、**插件包制作与插件市场发布**、论坛交流，以及知识库管理。

## 通道选择（第一步，必读）

```
Agent 收到 CodingHub 任务
  ↓
调用 qw_mcp_list(keyword="codinghub") 检测
  ├── 存在 mcp__codinghub__h3_coding_hub_* 工具
  │   ├── 解析 MCP Server URL，提取 host（协议+主机名）
  │   ├── 写入 config.json 的 host 字段
  │   └── → 走 MCP 通道
  └── 不存在 → 走 HTTP 直连通道（按"运行时选择"小节挑选 chub 脚本）
```

> **检测规则**：MCP 工具名取决于 MCP Server 的 name 配置（`codinghub`、`aihub` 都可能）。只要工具名中包含 `h3_coding_hub_` 前缀即视为 MCP 可用。
>
> **host 同步**：MCP 存在时需将 config.json 的 `host` 字段更新为 MCP Server 的地址（协议+主机名，不含端口），确保 `config.json` 中的地址与实际 MCP 服务一致，后续网站访问和 HTTP 直连均可正确工作。
>
> **获取 MCP Server URL 的方法**：
> 1. 调用 `qw_mcp_list` 返回的 MCP 工具信息中通常包含 `serverUrl` 或所属服务的地址
> 2. 或在 MCP 客户端配置文件（如 `~/.codebuddy/mcp.json`）中查找 `codinghub` 服务的 `url` 字段（如 `http://192.168.1.100:8082/mcp`）
> 3. 从 URL 中提取 `协议+主机名`（去掉端口和路径部分）作为 `host` 值写入 config.json
>
> **不要**直接声称"CodingHub 不可用"。MCP 不可用时必须自动降级到 HTTP 直连。

## 网站访问

当用户说"打开 codinghub 网站"、"访问 codinghub"时，用浏览器打开 `{config.host}:{config.frontendPort}`
## 配置文件

**位置**: 与 SKILL.md 同目录的 `config.json`（使用相对路径读取，不要硬编码绝对路径）。

```json
{
  "host": "http://localhost",
  "backendPort": "8082",
  "frontendPort": "80",
  "username": "wangbao",
  "password": "123456",
  "accessToken": "",
  "refreshToken": "",
  "accessTokenExpiry": ""
}
```

| 字段 | 说明 |
|------|------|
| `host` | 后端主机地址（不含端口，如 `http://localhost`） |
| `backendPort` | 后端端口（如 `8082`） |
| `frontendPort` | 前端端口（如 `80`） |
| `username` / `password` | 账号凭据（MCP 参数级认证 / HTTP 登录都使用） |
| `accessToken` | JWT access token（15 分钟过期，chub CLI 自动写入） |
| `refreshToken` | JWT refresh token（7 天过期，chub CLI 自动写入） |
| `accessTokenExpiry` | access token 过期时间 ISO 8601（chub CLI 自动管理） |

> **`baseUrl` 说明**：下文中 curl 示例里的 `{baseUrl}` 占位符均表示 `{host}:{backendPort}` 拼接结果，例如 `http://localhost:8082`。Agent 使用时从 `config.json` 的 `host` + `backendPort` 动态拼接，不要硬编码。

> **不要**把 config.json 提交到 git。如果 skill 位于项目仓库内，确保 `.gitignore` 包含 `.codebuddy/skills/codinghub/config.json`。

## 凭据获取策略

需要凭据时按以下优先级执行：

1. **读 config.json**: 直接使用其中的 username/password，不打扰用户
2. **记忆兜底**: config.json 为空时，用 `memory_search` 搜索 "CodingHub" 凭据
3. **询问用户**: 以上都没有时询问用户
4. **回写**: 获取到凭据后写入 config.json，并用 `memory` 工具（target="user"）备份到长期记忆

## HTTP 通道：chub CLI（跨平台）

HTTP 直连通道的所有 API 调用**必须**通过 `chub` CLI 执行，不要手写 curl、Python 或 fetch。

### 运行时选择（每次会话首次调用前必做）

`chub` 有两个功能等价的实现，**子命令、参数、退出码、JSON 输出格式完全一致**：

| 实现 | 路径 | 运行时 | 优先级 |
|------|------|--------|--------|
| **Python** | `scripts/chub.py` | Python 3.8+ 与 `requests` 库 | **首选** |
| Node.js CJS | `scripts/chub.cjs` | Node.js ≥ 18.13，零第三方依赖 | 降级 |

**选择规则**：

1. 执行 `python --version`（Windows/macOS 通用）→ 使用 Python 版本
2. 否则执行 `node -v`，若版本号 ≥ 18.13 → 使用 Node 版本
3. 两者都没有 → 报错并引导安装 Python 3.8+

**会话初始化（Bash 一次设置 `$CHUB`，后续所有命令统一使用）**：

```bash
# Python 优先，Node.js 兜底；把结果缓存到 CHUB 变量
SKILL_DIR="/d/repos/CodingHub/.codebuddy/skills/codinghub"
if command -v python >/dev/null 2>&1 && python -c "import requests" 2>/dev/null; then
  CHUB="python ${SKILL_DIR}/scripts/chub.py"
elif command -v node >/dev/null 2>&1; then
  CHUB="node ${SKILL_DIR}/scripts/chub.cjs"
else
  echo "[chub] 需要 Python 3.8+ (requests) 或 Node.js ≥ 18.13" >&2; false
fi

# 健康检查，确认通道可用
$CHUB ping
```

> **Windows Git Bash / macOS Bash** 通用上述脚本。若用 PowerShell，把 `CHUB` 设成 `python <path>\scripts\chub.py`（或若 Python 不可用时用 `node <path>\scripts\chub.cjs`）。
>
> **Python 的 requests 依赖**：`chub.py` 需要 `requests` 库，首次调用前用 `pip install requests` 安装。初始化脚本中的 `python -c "import requests"` 会自动检测。
>
> **Node 降级时的版本要求**：若 Python 不可用回退到 Node.js，需 Node.js ≥ 18.13（`AbortSignal.timeout` 和 `File` 全局对象在旧版本不存在）。Node 版本**不需要** `npm install`。

### Token 自动管理（三级降级，内置）

`chub` CLI 在每次需要认证的请求前自动执行三级降级，Agent **无需**手动处理 token：

1. **access 未过期 → 直接复用**（读 config.json 的 `accessToken` + `accessTokenExpiry`，预留 60s 缓冲）
2. **access 过期、refresh 存在 → 调 `/api/v1/auth/refresh`** 拿新 access（refreshToken 不变）
3. **refresh 也失效（401 或为空）→ 调 `/api/v1/auth/login`** 重新登录，写回 access + refresh

收到 401 时脚本自动强制降级重试（`force=True`），**Agent 无需感知**。所有 token 自动写回 config.json。

### 子命令速查

完整用法运行 `$CHUB --help`（或查看 `scripts/chub.cjs` 文件头注释）。输出**统一为 JSON**，顶层字段遵循 CodingHub 的 `ApiResponse` 包装（`code/message/data/success`）。

#### 配置 / 健康
| 子命令 | 说明 |
|--------|------|
| `ping` | 健康检查 `GET /mcp/health` |
| `whoami` | 查看当前配置（脱敏，不泄露密码/token 明文） |
| `login` | 强制重新登录（清空 access，重新走 login 流程） |

#### 工具 (tools)
| 子命令 | 典型参数 |
|--------|----------|
| `tool-search` | `--query <kw> [--category ID] [--tag <标签名>] [--limit N]` |
| `tool-get <toolId>` | 获取详情（`data.content` 是 markdown） |
| `tool-files <toolId>` | 获取文件列表 |
| `tool-download <toolId> <fileId> <outPath>` | 下载文件到指定路径 |
| `tool-create` | `--name N --category ID --content C --version V [--desc D] [--tags t1,t2]` |
| `tool-modify <toolId>` | `--name/--category/--content/--version/--desc/--tags`（不传 version 自动递增） |
| `tool-file-upload <toolId> <file> [<file2>...]` | `[--readme R]` 上传文件 |
| `tool-file-delete <toolId> <fileId>` | 删除文件 |

#### 帖子 (forum)
| 子命令 | 典型参数 |
|--------|----------|
| `post-search` | `--query <kw> [--limit N]` |
| `post-get <postId>` | 获取详情 |
| `post-create` | `--title T --content C --category ID [--tags t1,t2]` |

#### 知识库 (knowledge)
| 子命令 | 典型参数 |
|--------|----------|
| `kb-list` | `[--page N] [--size N]` |
| `kb-search <kbId> <query>` | `[--topK K] [--rerank true\|false] [--expand N]` |
| `kb-create` | `--name N [--desc D] [--chunkMode M] [--chunkSize N] [--chunkOverlap N]` |
| `kb-update <kbId>` | `--name N [--desc D]` |
| `kb-delete <kbId>` | 删除知识库 |

#### 插件 (plugins)
| 子命令 | 典型参数 |
|--------|----------|
| `plugin-search` | `--query <kw> [--limit N]` |
| `plugin-create` | `--name N --version V [--desc D] [--source S]` |
| `plugin-file-upload <pluginId> <zipPath>` | 上传插件包 zip（完成发布） |
| `plugin-update <pluginId> <zipPath>` | 覆盖更新插件（zip 内版本必须递增） |

### 退出码

| 码 | 含义 |
|----|------|
| 0 | 成功 |
| 1 | 参数错误 |
| 2 | HTTP 错误或业务错误 |
| 3 | 配置缺失 / IO 异常 / 依赖缺失 |

Agent 应在 Bash 执行后检查 `$?`，非 0 时读取 stderr（`[chub]` 前缀的错误信息）处理。

## 核心工作流

> **按需加载**: 工具参数与 HTTP API 完整对照表详见 `references/tool-reference.md`；知识库完整操作详见 `references/kb-management.md`；**插件包制作规范详见 `references/plugin-packaging.md`**；常见陷阱速查详见 `gotchas.md`；任务完成后按 `assets/template.md` 格式输出结果报告。执行具体操作前先 Read 对应文件。

### 1. 搜索与安装工具

**触发词**: "查询工具列表"、"安装工具"、"有没有 XX 工具"、"安装 XX MCP"

#### MCP 类型工具下载目录规则

当安装的是 **MCP 类型工具**（如 "安装 dbhub mcp"、"使用 codinghub mcp 安装 XX mcp"）时：

| 规则 | 说明 |
|------|------|
| **下载目录** | 统一下载到 `~/CodingHub/`（Windows: `C:\Users\<用户名>\CodingHub\`，macOS/Linux: `~/CodingHub/`） |
| **目录不存在时** | 自动创建（`mkdir -p ~/CodingHub`） |
| **文件命名** | 保留原始文件名（如 `dbhub-mcp-1.0.0.zip`） |
| **后续步骤** | 下载完成后按工具文档中的安装说明继续执行（解压、配置 MCP Server 等） |
| **报告要求** | 任务结果报告中**必须**注明安装包下载到的完整路径 |

> 非 MCP 类型工具（如普通 skill）仍按原有逻辑下载到 skill 目录或用户指定路径。

#### MCP 通道
1. `h3_coding_hub_tool_search` 按关键词搜索（可选传 `tag` 参数按标签名称过滤，忽略大小写）
2. `h3_coding_hub_tool_get` 获取完整文档（含安装说明）
3. `h3_coding_hub_tool_files` 获取文件列表
4. `h3_coding_hub_tool_download` 获取下载链接（返回相对路径，需拼 `{baseUrl}`）
5. 用 curl 下载文件到 `~/CodingHub/`（MCP 类型）或目标 skill 目录（非 MCP 类型）
6. 版本号写入 skill 文件夹的 `tools.version`

#### HTTP 通道（chub CLI）
```bash
$CHUB tool-search --query "<kw>"              # 搜索
$CHUB tool-search --tag "开源"                # 按标签搜索（忽略大小写）
$CHUB tool-get <toolId>                       # 读文档
$CHUB tool-files <toolId>                     # 列文件
# MCP 类型工具 → 下载到 ~/CodingHub/
$CHUB tool-download <toolId> <fileId> ~/CodingHub/<filename>
# 非 MCP 类型 → 下载到 skill 目录或指定路径
$CHUB tool-download <toolId> <fileId> /path/to/save.ext
```

#### tools.version 规则

| 规则 | 说明 |
|------|------|
| **位置** | 放在被安装 skill 的文件夹下，如 `.codebuddy/skills/ui-ux-pro-max/tools.version` |
| **内容** | 仅有版本号，如 `1.0.0`，不要包含 skill 名称或其他信息 |
| **用途** | 版本检查：安装前先读目标 skill 的 `tools.version`，与远程对比，仅版本不同时下载/更新 |

### 2. 发布新工具

**触发词**: "发布 skill"、"上传工具到 CodingHub"

#### MCP 通道
1. 获取凭据（按上述策略）
2. 确认 `categoryId`（通过 `h3_coding_hub_tool_search` 或 `GET /api/v1/categories` 推断）
3. 准备 `content`（markdown，含介绍、安装、示例）
4. 调用 `h3_coding_hub_tool_create`，记录 `toolId`
5. **文件上传不走 MCP**：调用 `h3_coding_hub_tool_file_upload` 获取 REST 端点信息
6. curl 执行 multipart POST：
   ```bash
   curl -X POST {baseUrl}/api/v1/tools/{toolId}/files \
     -F "files=@/path/to/file.zip" -F "readme=工具简介"
   ```
7. 上传限制：单文件 50MB，总计 200MB
8. **上传前必须检查文件数量**: 若 skill 目录包含多个文件（不止 SKILL.md，如 references/、scripts/ 等），必须先压缩为 zip 包（保留目录结构）再上传；只有目录中仅有一个 SKILL.md 时才可直接上传。严禁将多个文件逐个直接上传

#### HTTP 通道（chub CLI）
```bash
# 分类 ID 可直接 curl 拿（无需认证）
curl -s {baseUrl}/api/v1/categories

# 创建工具（自动 login + 携带 token）
$CHUB tool-create --name "my-skill" --category 1 \
  --content "$(cat /tmp/skill.md)" --version "1.0.0" --desc "一句话介绍"

# 上传文件（multipart，无需认证）
$CHUB tool-file-upload <toolId> /path/to/skill.zip --readme "工具简介"
```

### 3. 更新已有工具

**触发词**: "更新工具"、"升级 skill 版本"

#### MCP 通道
1. `h3_coding_hub_tool_search` 找到工具
2. `h3_coding_hub_tool_files` 获取现有文件
3. 如需替换：`h3_coding_hub_tool_file_delete` 删除旧文件
4. `h3_coding_hub_tool_modify` 更新信息（不传 version 自动递增 `1.0.0` → `1.0.1`）
5. curl 上传新版本文件

#### HTTP 通道（chub CLI）
```bash
$CHUB tool-search --query "<skill名>"     # 找 toolId
$CHUB tool-files <toolId>                 # 看旧文件
$CHUB tool-file-delete <toolId> <fileId>  # 删旧文件
$CHUB tool-modify <toolId> --content "$(cat /tmp/new.md)"   # 更新内容 (不传 --version 自动递增)
$CHUB tool-file-upload <toolId> /path/to/new.zip
```

**自动版本号规则**: `1.0.0` → `1.0.1`；`1.0.0-beta` → `1.0.1-beta`；`1.2.3` → `1.2.4`。

### 4. 论坛发帖

**触发词**: "发帖到论坛"、"把这个文档发布到论坛"

#### MCP 通道
1. 准备 title、content（markdown）
2. 确认 `categoryId`（论坛分类）
3. 调用 `h3_coding_hub_post_create`

#### HTTP 通道（chub CLI）
```bash
curl -s {baseUrl}/api/forum/categories             # 拿分类 ID
$CHUB post-create --title "标题" --content "$(cat /tmp/post.md)" --category 1
```

### 5. 知识库管理

**触发词**: "创建知识库"、"上传文档"、"检索知识库"

> 按需加载：详见 `references/kb-management.md`。

#### HTTP 通道（chub CLI）常用命令
```bash
$CHUB kb-list
$CHUB kb-create --name "kb1" --desc "说明"
$CHUB kb-search <kbId> "查询语句" --topK 5
$CHUB kb-update <kbId> --name "新名字"
$CHUB kb-delete <kbId>
```

### 6. 插件市场（Plugin）

**触发词**: "发布插件"、"上传插件包"、"制作插件包"、"更新插件"、"把 XX 打包成插件"

> **插件 ≠ 工具**：工具广场发布的是单个 Skill/工具文件；插件是含 `commands/`、`skills/`、`agents/`、`hooks/` 等组件的**目录包**，通过 marketplace 供客户端安装。插件包制作规范详见 `references/plugin-packaging.md`（执行前必须 Read）。

**插件包规范核心（详见 references/plugin-packaging.md）**：

- **必须**含 `.codebuddy-plugin/plugin.json`（CodeBuddy 客户端的清单入口，缺它则命令/技能全部不注册；根目录 `plugin.json` 仅平台展示用，不能替代）
- `name` 必填且 kebab-case（如 `openspec-pack`），`version` 必填语义化（如 `1.0.0`）
- **严禁声明 `commands`/`skills` 字段** —— 平台自动扫描组件目录；命令文件平铺为 `commands/<命令名>.md`（如 `wbnb.md`），frontmatter 写 `name` 定义注册名，勿用点分文件名
- 单 zip ≤ 50MB，解压后 ≤ 200MB

#### MCP 通道
1. `h3_coding_hub_plugin_search` 搜索，确认未重复发布
2. `h3_coding_hub_plugin_create` 创建草稿（name/version/description/source/username/password）→ 记录 `pluginId`
3. `h3_coding_hub_plugin_file_upload` 获取 REST 上传信息（uploadUrl、httpMethod、formFields）
4. curl 执行 multipart POST：
   ```bash
   curl -X POST {uploadUrl} -F "file=@/path/to/<name>-<version>.zip"
   ```
5. `h3_coding_hub_plugin_search` 确认发布成功

#### HTTP 通道（chub CLI）
```bash
$CHUB plugin-search --query "<插件名>"
$CHUB plugin-create --name "my-plugin" --version "1.0.0" --desc "一句话介绍"
$CHUB plugin-file-upload <pluginId> /path/to/my-plugin-1.0.0.zip
```

#### 更新已发布插件
- 版本必须递增（`1.0.0` → `1.0.1`），版本不变会被拒绝
- 修改本地 plugin.json 的 version 后重新打包 zip
- MCP 通道：`h3_coding_hub_plugin_search` 找 id → `h3_coding_hub_plugin_file_upload` 获取端点 → curl `PUT {uploadUrl}`（或 PUT `{baseUrl}/api/v1/plugins/{pluginId}`，需认证 token）
- HTTP 通道：`$CHUB plugin-update <pluginId> /path/to/<name>-<newver>.zip`

## 验证

- 发布/更新工具后：`$CHUB tool-get <toolId>` 或 `h3_coding_hub_tool_get` 确认内容
- 上传文件后：`$CHUB tool-files <toolId>` 或 `h3_coding_hub_tool_files` 确认列表
- 删除文件后：同上再次确认文件已移除
- 发帖后：`$CHUB post-get <postId>` 或 `h3_coding_hub_post_get` 确认内容
- 创建知识库后：上传文档 → 查询状态（`h3_coding_hub_kb_document_status` 或 `GET /api/v1/knowledge/{kbId}`）→ 全部 READY 后 → `$CHUB kb-search <kbId> "..."` 验证检索
