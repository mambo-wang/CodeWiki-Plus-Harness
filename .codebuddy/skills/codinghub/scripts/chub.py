#!/usr/bin/env python3
"""
CodingHub CLI — 绕过 MCP 直接调用 CodingHub REST API 的命令行工具。
当 MCP 通道不可用时，由 Agent 自动降级调用本脚本。

用法:
    python chub.py <subcommand> [args...]

子命令:
  认证 / 配置
    ping                                       健康检查 GET /mcp/health
    login                                      强制重新登录
    whoami                                     查看当前配置（脱敏）

  工具 (tools)
    tool-search [--query Q] [--category ID] [--tag T] [--limit N]
    tool-get <toolId>
    tool-files <toolId>
    tool-download <toolId> <fileId> <outPath>
    tool-create --name N --category ID --content C --version V [--desc D] [--tags t1,t2]
    tool-modify <toolId> [--name N] [--category ID] [--content C] [--version V] [--desc D] [--tags t1,t2]
    tool-file-upload <toolId> <file> [<file2> ...] [--readme R]
    tool-file-delete <toolId> <fileId>

  帖子 (forum)
    post-search [--query Q] [--limit N]
    post-get <postId>
    post-create --title T --content C --category ID [--tags t1,t2]

  知识库 (knowledge)
    kb-list [--page N] [--size N]
    kb-search <kbId> <query> [--topK K] [--rerank true|false] [--expand N]
    kb-create --name N [--desc D] [--chunkMode M] [--chunkSize N] [--chunkOverlap N]
    kb-update <kbId> [--name N] [--desc D]
    kb-delete <kbId>

  插件 (plugins)
    plugin-search [--query Q] [--limit N]
    plugin-create --name N --version V [--desc D] [--source S]
    plugin-file-upload <pluginId> <zipPath>
    plugin-update <pluginId> <zipPath>

退出码:
  0 成功 / 1 参数错误 / 2 HTTP 或业务错误 / 3 配置或 IO 异常
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    import requests
except ImportError:
    sys.stderr.write("[chub] missing dependency: requests  (pip install requests)\n")
    sys.exit(3)

# 不要用 Path.resolve()：在 Windows + Git Bash 下 /d/repos/... 会被拼成 C:\d\repos\...
# __file__ 已经是 Python 给的绝对路径，parent 即可定位 scripts/ 目录
SCRIPT_DIR = Path(__file__).parent
# chub.py 位于 scripts/ 子目录，config.json 在父目录（与 SKILL.md 同级）
CONFIG_PATH = SCRIPT_DIR.parent / "config.json"

# ─────────────────────────────── 配置 I/O ───────────────────────────────

def load_config() -> dict:
    if not CONFIG_PATH.exists():
        sys.stderr.write(f"[chub] config not found: {CONFIG_PATH}\n")
        sys.exit(3)
    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    cfg["baseUrl"] = f"{cfg['host']}:{cfg['backendPort']}"
    return cfg


def save_config(cfg: dict) -> None:
    tmp = CONFIG_PATH.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)
    os.replace(tmp, CONFIG_PATH)

# ─────────────────────────────── Token 管理 ─────────────────────────────

def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _parse_iso(s: str) -> datetime:
    # 兼容 Python 3.10 不支持 `Z` 后缀
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _do_login(cfg: dict) -> dict:
    """POST /api/v1/auth/login → 返回 {accessToken, refreshToken}"""
    url = f"{cfg['baseUrl']}/api/v1/auth/login"
    resp = requests.post(url, json={
        "username": cfg["username"],
        "password": cfg["password"],
    }, timeout=30)
    if resp.status_code != 200:
        sys.stderr.write(f"[chub] login failed: {resp.status_code} {resp.text[:300]}\n")
        sys.exit(2)
    data = resp.json().get("data") or {}
    if not data.get("accessToken"):
        sys.stderr.write(f"[chub] login response missing accessToken: {resp.text[:300]}\n")
        sys.exit(2)
    return data


def _do_refresh(cfg: dict) -> dict | None:
    """POST /api/v1/auth/refresh → 返回 {accessToken}；refreshToken 失效返回 None"""
    if not cfg.get("refreshToken"):
        return None
    url = f"{cfg['baseUrl']}/api/v1/auth/refresh"
    resp = requests.post(url,
        headers={"Authorization": f"Bearer {cfg['refreshToken']}"},
        timeout=30)
    if resp.status_code == 401:
        return None
    if resp.status_code != 200:
        sys.stderr.write(f"[chub] refresh failed: {resp.status_code} {resp.text[:300]}\n")
        sys.exit(2)
    return resp.json().get("data") or {}


def ensure_token(cfg: dict, *, force: bool = False) -> str:
    """
    三级降级:
      1. accessToken 未过期 → 直接复用
      2. refreshToken 有效   → refresh 拿新 accessToken
      3. 都不行              → 重新 login
    force=True 跳过第 1 级，用于 401 重试。
    """
    now = _now_utc()
    expiry_str = cfg.get("accessTokenExpiry") or ""
    access = cfg.get("accessToken") or ""

    # 1) 复用未过期 access (预留 60s 缓冲)
    if not force and access and expiry_str:
        try:
            if _parse_iso(expiry_str) > now + timedelta(seconds=60):
                return access
        except ValueError:
            pass

    # 2) 用 refresh 换 access
    refreshed = _do_refresh(cfg)
    if refreshed and refreshed.get("accessToken"):
        cfg["accessToken"] = refreshed["accessToken"]
        cfg["accessTokenExpiry"] = (now + timedelta(minutes=15)).isoformat()
        # refresh 接口不返回新 refreshToken, 保持原值
        save_config(cfg)
        return cfg["accessToken"]

    # 3) 重新登录
    login_data = _do_login(cfg)
    cfg["accessToken"] = login_data["accessToken"]
    cfg["refreshToken"] = login_data.get("refreshToken") or cfg.get("refreshToken") or ""
    cfg["accessTokenExpiry"] = (now + timedelta(minutes=15)).isoformat()
    save_config(cfg)
    return cfg["accessToken"]


def api(cfg: dict, method: str, path: str, *, auth: bool = False, **kwargs) -> requests.Response:
    """
    统一 HTTP 调用，遇 401 自动降级重试（最多一次）。
    """
    url = f"{cfg['baseUrl']}{path}"
    headers = dict(kwargs.pop("headers", {}) or {})

    if auth:
        token = ensure_token(cfg)
        headers["Authorization"] = f"Bearer {token}"

    resp = requests.request(method, url, headers=headers, timeout=60, **kwargs)

    if auth and resp.status_code == 401:
        # 降级: 强制重新拿 token 再试一次
        token = ensure_token(cfg, force=True)
        headers["Authorization"] = f"Bearer {token}"
        resp = requests.request(method, url, headers=headers, timeout=60, **kwargs)

    return resp


def out(obj) -> None:
    """统一 JSON 输出，方便 Agent 解析"""
    print(json.dumps(obj, ensure_ascii=False, indent=2, default=str))


def ok(resp: requests.Response, *, expect_201: bool = False) -> dict:
    ok_codes = (200, 201) if expect_201 else (200,)
    if resp.status_code not in ok_codes:
        sys.stderr.write(f"[chub] HTTP {resp.status_code}: {resp.text[:500]}\n")
        sys.exit(2)
    try:
        return resp.json()
    except ValueError:
        return {"status": resp.status_code, "text": resp.text}

# ─────────────────────────────── 子命令实现 ─────────────────────────────

# ---- 配置 / 健康 ----
def cmd_ping(cfg, args):
    resp = requests.get(f"{cfg['baseUrl']}/mcp/health", timeout=10)
    out({"status": resp.status_code, "body": resp.text[:500]})


def cmd_whoami(cfg, args):
    out({
        "baseUrl": cfg.get("baseUrl"),
        "username": cfg.get("username"),
        "hasPassword": bool(cfg.get("password")),
        "hasAccessToken": bool(cfg.get("accessToken")),
        "hasRefreshToken": bool(cfg.get("refreshToken")),
        "accessTokenExpiry": cfg.get("accessTokenExpiry"),
    })


def cmd_login(cfg, args):
    token = ensure_token(cfg, force=True)
    out({"ok": True, "accessTokenExpiry": cfg.get("accessTokenExpiry"),
         "tokenPrefix": token[:12] + "..."})


# ---- 工具 ----
def cmd_tool_search(cfg, args):
    params = {
        "page": 0, "size": args.limit, "sortBy": "hot",
    }
    if args.query:
        params["keyword"] = args.query
    if args.category is not None:
        params["categoryId"] = args.category
    if args.tag:
        tags_resp = ok(requests.get(f"{cfg['baseUrl']}/api/v1/tags",
                                    params={"type": "TOOL"}))
        tag_list = tags_resp.get("data") or []
        matched = next((t for t in tag_list
                        if t.get("name", "").lower() == args.tag.lower()), None)
        if not matched:
            available = ", ".join(t.get("name", "") for t in tag_list)
            sys.stderr.write(f'[chub] tag not found: "{args.tag}" (available: {available})\n')
            sys.exit(2)
        params["tagId"] = matched["id"]
    out(ok(requests.get(f"{cfg['baseUrl']}/api/v1/tools", params=params)))


def cmd_tool_get(cfg, args):
    out(ok(requests.get(f"{cfg['baseUrl']}/api/v1/tools/{args.toolId}")))


def cmd_tool_files(cfg, args):
    out(ok(requests.get(f"{cfg['baseUrl']}/api/v1/tools/{args.toolId}/files")))


def cmd_tool_download(cfg, args):
    resp = requests.get(
        f"{cfg['baseUrl']}/api/v1/tools/{args.toolId}/files/{args.fileId}/download",
        stream=True, timeout=120)
    if resp.status_code != 200:
        sys.stderr.write(f"[chub] HTTP {resp.status_code}: {resp.text[:300]}\n")
        sys.exit(2)
    out_path = Path(args.outPath)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=65536):
            if chunk:
                f.write(chunk)
    out({"ok": True, "path": str(out_path), "bytes": out_path.stat().st_size})


def cmd_tool_create(cfg, args):
    body = {
        "name": args.name,
        "categoryId": args.category,
        "content": args.content,
        "version": args.version,
    }
    if args.desc is not None:
        body["description"] = args.desc
    if args.tags:
        body["tagIds"] = [int(x) for x in args.tags.split(",") if x]
    out(ok(api(cfg, "POST", "/api/v1/tools", auth=True, json=body), expect_201=True))


def cmd_tool_modify(cfg, args):
    body = {}
    for key, attr in (("name", "name"), ("categoryId", "category"),
                      ("content", "content"), ("version", "version"),
                      ("description", "desc")):
        v = getattr(args, attr, None)
        if v is not None:
            body[key] = v
    if args.tags:
        body["tagIds"] = [int(x) for x in args.tags.split(",") if x]
    if not body:
        sys.stderr.write("[chub] tool-modify: 未提供任何更新字段\n")
        sys.exit(1)
    out(ok(api(cfg, "PUT", f"/api/v1/tools/{args.toolId}", auth=True, json=body)))


def cmd_tool_file_upload(cfg, args):
    # 文件上传端点 permitAll, 但带 token 更稳妥; multipart 用 files= 参数
    files = [("files", (Path(p).name, open(p, "rb"))) for p in args.files]
    data = {}
    if args.readme:
        data["readme"] = args.readme
    try:
        resp = api(cfg, "POST", f"/api/v1/tools/{args.toolId}/files",
                   auth=False, files=files, data=data)
    finally:
        for _, f in files:
            f[1].close()
    out(ok(resp))


def cmd_tool_file_delete(cfg, args):
    out(ok(api(cfg, "DELETE",
               f"/api/v1/tools/{args.toolId}/files/{args.fileId}", auth=True)))


# ---- 帖子 ----
def cmd_post_search(cfg, args):
    params = {"page": 0, "size": args.limit}
    if args.query:
        params["keyword"] = args.query
    out(ok(requests.get(f"{cfg['baseUrl']}/api/forum/posts", params=params)))


def cmd_post_get(cfg, args):
    out(ok(requests.get(f"{cfg['baseUrl']}/api/forum/posts/{args.postId}")))


def cmd_post_create(cfg, args):
    body = {
        "title": args.title,
        "content": args.content,
        "categoryId": args.category,
    }
    if args.tags:
        body["tagIds"] = [int(x) for x in args.tags.split(",") if x]
    out(ok(api(cfg, "POST", "/api/forum/posts", auth=True, json=body), expect_201=True))


# ---- 知识库 ----
def cmd_kb_list(cfg, args):
    params = {"page": args.page, "size": args.size}
    out(ok(requests.get(f"{cfg['baseUrl']}/api/v1/knowledge", params=params)))


def cmd_kb_search(cfg, args):
    body = {"query": args.query, "topK": args.topK,
            "rerank": args.rerank, "expandContext": args.expand}
    out(ok(requests.post(f"{cfg['baseUrl']}/api/v1/knowledge/{args.kbId}/search",
                         json=body)))


def cmd_kb_create(cfg, args):
    body = {"name": args.name}
    if args.desc is not None:
        body["description"] = args.desc
    if args.chunkMode is not None:
        body["chunkMode"] = args.chunkMode
    if args.chunkSize is not None:
        body["chunkSize"] = args.chunkSize
    if args.chunkOverlap is not None:
        body["chunkOverlap"] = args.chunkOverlap
    out(ok(api(cfg, "POST", "/api/v1/knowledge", auth=True, json=body), expect_201=True))


def cmd_kb_update(cfg, args):
    body = {}
    if args.name is not None:
        body["name"] = args.name
    if args.desc is not None:
        body["description"] = args.desc
    if not body:
        sys.stderr.write("[chub] kb-update: 未提供任何更新字段\n")
        sys.exit(1)
    out(ok(api(cfg, "PUT", f"/api/v1/knowledge/{args.kbId}", auth=True, json=body)))


def cmd_kb_delete(cfg, args):
    out(ok(api(cfg, "DELETE", f"/api/v1/knowledge/{args.kbId}", auth=True)))


# ─────────────────────────────── 插件 (plugins) ───────────────────────────────

def cmd_plugin_search(cfg, args):
    params = {"page": 0, "size": args.limit, "sort": "new"}
    if args.query:
        params["keyword"] = args.query
    out(ok(api(cfg, "GET", "/api/v1/plugins", params=params)))


def cmd_plugin_create(cfg, args):
    # 两段式第一步: 创建草稿（需认证）
    body = {"name": args.name, "version": args.version}
    if args.desc is not None:
        body["description"] = args.desc
    if args.source is not None:
        body["source"] = args.source
    out(ok(api(cfg, "POST", "/api/v1/plugins/draft", auth=True, json=body), expect_201=True))


def cmd_plugin_file_upload(cfg, args):
    # 两段式第二步: 为草稿补全 zip（免认证，zip 内 name/version 须与草稿一致）
    f = open(args.zipPath, "rb")
    try:
        resp = api(cfg, "POST", f"/api/v1/plugins/{args.pluginId}/file",
                   auth=False, files=[("file", (Path(args.zipPath).name, f))])
    finally:
        f.close()
    out(ok(resp))


def cmd_plugin_update(cfg, args):
    # 覆盖更新（需认证），要求 zip 内版本较已发布版本递增
    f = open(args.zipPath, "rb")
    try:
        resp = api(cfg, "PUT", f"/api/v1/plugins/{args.pluginId}",
                   auth=True, files=[("file", (Path(args.zipPath).name, f))])
    finally:
        f.close()
    out(ok(resp))


# ─────────────────────────────── CLI 入口 ───────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="chub", description="CodingHub CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    def add(name, fn, **kwargs):
        sp = sub.add_parser(name, **kwargs)
        sp.set_defaults(func=fn)
        return sp

    # 配置
    add("ping", cmd_ping)
    add("login", cmd_login)
    add("whoami", cmd_whoami)

    # 工具
    sp = add("tool-search", cmd_tool_search)
    sp.add_argument("--query", "-q", default="")
    sp.add_argument("--category", type=int, default=None)
    sp.add_argument("--tag", default=None)
    sp.add_argument("--limit", type=int, default=20)

    sp = add("tool-get", cmd_tool_get); sp.add_argument("toolId", type=int)
    sp = add("tool-files", cmd_tool_files); sp.add_argument("toolId", type=int)

    sp = add("tool-download", cmd_tool_download)
    sp.add_argument("toolId", type=int); sp.add_argument("fileId", type=int)
    sp.add_argument("outPath")

    sp = add("tool-create", cmd_tool_create)
    sp.add_argument("--name", required=True); sp.add_argument("--category", type=int, required=True, dest="category")
    sp.add_argument("--content", required=True); sp.add_argument("--version", required=True)
    sp.add_argument("--desc", default=None); sp.add_argument("--tags", default=None)

    sp = add("tool-modify", cmd_tool_modify)
    sp.add_argument("toolId", type=int)
    sp.add_argument("--name", default=None); sp.add_argument("--category", type=int, default=None)
    sp.add_argument("--content", default=None); sp.add_argument("--version", default=None)
    sp.add_argument("--desc", default=None); sp.add_argument("--tags", default=None)

    sp = add("tool-file-upload", cmd_tool_file_upload)
    sp.add_argument("toolId", type=int); sp.add_argument("files", nargs="+")
    sp.add_argument("--readme", default=None)

    sp = add("tool-file-delete", cmd_tool_file_delete)
    sp.add_argument("toolId", type=int); sp.add_argument("fileId", type=int)

    # 帖子
    sp = add("post-search", cmd_post_search)
    sp.add_argument("--query", "-q", default=""); sp.add_argument("--limit", type=int, default=20)

    sp = add("post-get", cmd_post_get); sp.add_argument("postId", type=int)

    sp = add("post-create", cmd_post_create)
    sp.add_argument("--title", required=True); sp.add_argument("--content", required=True)
    sp.add_argument("--category", type=int, required=True); sp.add_argument("--tags", default=None)

    # 知识库
    sp = add("kb-list", cmd_kb_list)
    sp.add_argument("--page", type=int, default=0); sp.add_argument("--size", type=int, default=20)

    sp = add("kb-search", cmd_kb_search)
    sp.add_argument("kbId", type=int); sp.add_argument("query")
    sp.add_argument("--topK", type=int, default=5)
    sp.add_argument("--rerank", type=lambda s: s.lower() == "true", default=True)
    sp.add_argument("--expand", type=int, default=1)

    sp = add("kb-create", cmd_kb_create)
    sp.add_argument("--name", required=True); sp.add_argument("--desc", default=None)
    sp.add_argument("--chunkMode", default=None)
    sp.add_argument("--chunkSize", type=int, default=None)
    sp.add_argument("--chunkOverlap", type=int, default=None)

    sp = add("kb-update", cmd_kb_update)
    sp.add_argument("kbId", type=int)
    sp.add_argument("--name", default=None); sp.add_argument("--desc", default=None)

    sp = add("kb-delete", cmd_kb_delete); sp.add_argument("kbId", type=int)

    # 插件
    sp = add("plugin-search", cmd_plugin_search)
    sp.add_argument("--query", "-q", default=""); sp.add_argument("--limit", type=int, default=20)

    sp = add("plugin-create", cmd_plugin_create)
    sp.add_argument("--name", required=True); sp.add_argument("--version", required=True)
    sp.add_argument("--desc", default=None); sp.add_argument("--source", default=None)

    sp = add("plugin-file-upload", cmd_plugin_file_upload)
    sp.add_argument("pluginId", type=int); sp.add_argument("zipPath")

    sp = add("plugin-update", cmd_plugin_update)
    sp.add_argument("pluginId", type=int); sp.add_argument("zipPath")

    return p


def main() -> int:
    cfg = load_config()
    args = build_parser().parse_args()
    try:
        args.func(cfg, args)
    except requests.RequestException as e:
        sys.stderr.write(f"[chub] network error: {e}\n")
        return 2
    except KeyboardInterrupt:
        sys.stderr.write("[chub] interrupted\n")
        return 130
    return 0


if __name__ == "__main__":
    sys.exit(main())
