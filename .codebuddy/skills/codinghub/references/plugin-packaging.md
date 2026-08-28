# 插件包制作规范（Plugin Packaging）

> 将本地 Skill / 命令集制作成符合 CodingHub 规范的**插件包**并发布到插件市场。
> 插件市场（marketplace）供智能体客户端（CodeBuddy 等）拉取安装，与"工具广场"（单文件工具/Skill）是两条独立发布通道。

## 1. 插件的本质

插件是一个**目录**，打包为 zip 上传。平台解压后：

- 读取 `plugin.json` 元数据
- 自动扫描 `skills/`、`agents/`、`commands/`、`hooks/` 等组件目录，生成组件摘要
- 为插件初始化 git 仓库，生成 `marketplace.json` / `marketplace.zip`，客户端据此拉取安装

## 2. zip 目录结构

```
<plugin-name>-<version>.zip
├── .codebuddy-plugin/
│   └── plugin.json              # 【必须】CodeBuddy 客户端的插件清单入口
├── plugin.json                  # 平台元数据（可选；客户端不识别，仅平台展示用）
├── commands/                    # 命令（自动扫描）
│   ├── <cmd>.md                 # 平铺命名，命令名即文件名（如 wbnb.md → /wbnb）
│   └── ...
├── skills/                      # 技能（自动扫描）
│   ├── <skill-name>/SKILL.md
│   └── ...
├── agents/                      # 代理（自动扫描，可选）
│   └── ...
├── hooks/                       # 钩子（自动扫描，可选）
│   └── ...
└── bin/  .mcp.json  .lsp.json  settings.json   # 其他能力（可选）
```

**关键**：`.codebuddy-plugin/plugin.json` 是 CodeBuddy 客户端**唯一**的插件清单入口（对应客户端缓存的 `configPath`）。缺它时客户端会直接跳过组件发现，命令/技能全部不注册。根目录的 `plugin.json` 仅平台读取用于元数据展示（平台有回退，客户端没有）——**两者不是等价的**，打包时 `.codebuddy-plugin/plugin.json` 必须存在。

**大小限制**: 单个 zip ≤ 50MB，解压后 ≤ 200MB。

## 3. plugin.json 字段

```json
{
  "name": "openspec-pack",
  "version": "1.0.1",
  "description": "OpenSpec 全流程工作流命令包",
  "icon": "",
  "source": "",
  "strict": false
}
```

| 字段 | 必填 | 规则 |
|------|------|------|
| `name` | 是 | kebab-case：`^[a-z0-9]+(-[a-z0-9]+)*$`，1-100 字符；必须与发布时填写的插件名一致 |
| `version` | 是 | 语义化版本：`^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$`，如 `1.0.0` / `1.0.0-beta` |
| `description` | 否 | ≤ 5000 字符 |
| `icon` | 否 | 图标 |
| `source` | 否 | 来源标识：`owner/repo`、URL，或留空 |
| `agents` / `hooks` / `mcpServers` / `strict` | 否 | 声明式配置（若确实需要） |

### 禁止：声明 commands / skills 字段

```
❌ 错误写法（会导致组件加载失败）:
"commands": ["commands/opsx/new.md", "commands/opsx/propose.md"],
"skills": ["skills/foo/SKILL.md"]

✅ 正确写法: 完全不写这两个字段
```

平台按目录**自动扫描**生成组件摘要。显式声明的路径与自动扫描的实际文件布局不一致时组件不会被加载。**永远不要声明 commands/skills 字段**（组件的注册由客户端按目录扫描 + manifest 完成，声明字段对安装无帮助，还容易与扫描结果冲突）。

## 4. 组件布局规范

| 组件 | 目录 | 文件命名 | 说明 |
|------|------|----------|------|
| 命令 | `commands/` | `<命令名>.md`（平铺） | 命令注册名 = frontmatter `name`（无 `name` 时取文件名）；如 `wbnb.md` + `name: "wbnb"` → `/wbnb` |
| 技能 | `skills/<技能名>/SKILL.md` | 技能名即子目录名 | 多文件技能（references/scripts 等）也放进该子目录 |
| 代理 | `agents/` | 子目录形式 | 可选 |
| 钩子 | `hooks/` | 子目录形式 | 可选 |

**命令命名要点**：文件名保持简洁（`<命令名>.md`），并在 frontmatter 明确写 `name`。不要用点分文件名（如 `verify-ui-pack.wbnb.md`）——无 `name` 时客户端会注册出 `/verify-ui-pack.wbnb` 这种错误命令名。命令正文里的斜杠标题只是说明，实际注册名由 `name`/文件名决定。

命令文件示例（`commands/wbnb.md`）：

```markdown
---
name: "wbnb"
description: "显示当前的 git 仓库状态并进行分析"
---

!`git status`

请基于上面的 `git status` 输出，为我总结当前分支的状况。
```

## 5. 发布流程

### 两段式（推荐，走 MCP 通道）

1. `h3_coding_hub_plugin_search` 搜索插件名，确认未重复发布
2. `h3_coding_hub_plugin_create` 创建草稿（name / version / description / source / username / password）→ 记录 `pluginId`
3. `h3_coding_hub_plugin_file_upload` 获取 REST 上传信息（uploadUrl、httpMethod、formFields）
4. `curl -X POST {uploadUrl} -F "file=@/path/to/<name>-<version>.zip"`
   - zip 内 `plugin.json` 的 name/version 必须与草稿一致，否则被拒
5. `h3_coding_hub_plugin_search` 确认发布成功

### HTTP 直连（chub CLI）

```bash
export CHUB=python ./.codebuddy/skills/codinghub/scripts/chub.py
$CHUB plugin-create --name openspec-pack --version 1.0.1 --description "..." --source ""
$CHUB plugin-file-upload --id <pluginId> --zip ./openspec-pack-1.0.1.zip
```

## 6. 更新流程

1. `h3_coding_hub_plugin_search` 找到已发布插件的 `pluginId` 与当前版本
2. **版本必须递增**（`1.0.0` → `1.0.1`），版本不变会被拒绝
3. 修改本地 `plugin.json` 的 version，检查组件目录后重新打包 zip
4. 覆盖更新（需认证 token）:
   ```bash
   curl -X PUT {baseUrl}/api/v1/plugins/{pluginId} \
     -H "Authorization: Bearer <token>" -F "file=@/path/to/<name>-<version>.zip"
   ```
   chub CLI: `$CHUB plugin-update --id <pluginId> --zip ./<name>-<version>.zip`
5. 更新后 marketplace 自动同步，客户端重新拉取市场即收到新版本

## 7. 常见错误与规避

| 错误 | 表现 | 规避 |
|------|------|------|
| 缺少 `.codebuddy-plugin/plugin.json` | 客户端安装后命令/技能全部不注册（找不到清单入口） | 打包时确认 manifest 存在，根目录 `plugin.json` 不能替代它 |
| 命令文件点分命名（`commands/verify-ui-pack.wbnb.md`）且无 `name` | 注册出 `/verify-ui-pack.wbnb` 而非 `/wbnb` | 文件名用 `<命令名>.md`，frontmatter 写 `name` |
| plugin.json 里声明 `commands`/`skills` 字段 | 命令/技能不加载 | 删除声明，依赖自动扫描 |
| 上传时 name 与 zip 内 plugin.json 不一致 | 上传被拒 | 两处保持同一 kebab-case 名 |
| 更新时版本未递增 | PUT 被拒 | 语义化递增（1.0.0 → 1.0.1） |
| zip 大于 50MB / 解压超 200MB | 上传被拒 | 精简内容 |
| 命令 frontmatter 缺 `description` | 命令在菜单中不可读 | 每个命令文件头部补齐 `name` 与 `description` |
| 路径穿越（文件名含 `../`） | 上传被拒 | 保持合法相对路径 |
