#!/usr/bin/env node
/**
 * CodingHub CLI (Node.js) — 绕过 MCP 直接调用 CodingHub REST API。
 * 当 MCP 通道不可用时，由 Agent 自动降级调用本脚本（与 chub.py 功能等价）。
 *
 * 运行时要求: Node.js >= 18.13 (内置 fetch / File / FormData / AbortSignal.timeout)
 * 零第三方依赖。
 *
 * 用法:
 *   node chub.cjs <subcommand> [args...]
 *
 * 子命令 (与 chub.py 完全一致):
 *   认证 / 配置
 *     ping                                       健康检查 GET /mcp/health
 *     login                                      强制重新登录
 *     whoami                                     查看当前配置（脱敏）
 *
 *   工具 (tools)
 *     tool-search [--query Q] [--category ID] [--tag T] [--limit N]
 *     tool-get <toolId>
 *     tool-files <toolId>
 *     tool-download <toolId> <fileId> <outPath>
 *     tool-create --name N --category ID --content C --version V [--desc D] [--tags t1,t2]
 *     tool-modify <toolId> [--name N] [--category ID] [--content C] [--version V] [--desc D] [--tags t1,t2]
 *     tool-file-upload <toolId> <file> [<file2> ...] [--readme R]
 *     tool-file-delete <toolId> <fileId>
 *
 *   帖子 (forum)
 *     post-search [--query Q] [--limit N]
 *     post-get <postId>
 *     post-create --title T --content C --category ID [--tags t1,t2]
 *
 *   知识库 (knowledge)
 *     kb-list [--page N] [--size N]
 *     kb-search <kbId> <query> [--topK K] [--rerank true|false] [--expand N]
 *     kb-create --name N [--desc D] [--chunkMode M] [--chunkSize N] [--chunkOverlap N]
 *     kb-update <kbId> [--name N] [--desc D]
 *     kb-delete <kbId>
 *
 *   插件 (plugins)
 *     plugin-search [--query Q] [--limit N]
 *     plugin-create --name N --version V [--desc D] [--source S]
 *     plugin-file-upload <pluginId> <zipPath>
 *     plugin-update <pluginId> <zipPath>
 *
 * 退出码:
 *   0 成功 / 1 参数错误 / 2 HTTP 或业务错误 / 3 配置或 IO 异常
 */
'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');

const SCRIPT_DIR = __dirname;
// chub.cjs 位于 scripts/ 子目录，config.json 在父目录（与 chub.py 同级）
const CONFIG_PATH = path.join(path.dirname(SCRIPT_DIR), 'config.json');

// ─────────────────────────────── 输出 / 日志 ────────────────────────────

const log = (...args) => process.stderr.write(`[chub] ${args.join(' ')}\n`);

const out = (obj) =>
  process.stdout.write(
    JSON.stringify(obj, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2) + '\n'
  );

const exitErr = (msg, code = 2) => {
  log(msg);
  process.exit(code);
};

// ─────────────────────────────── 配置 I/O ───────────────────────────────

const loadConfig = async () => {
  try {
    const text = await fsp.readFile(CONFIG_PATH, 'utf8');
    const cfg = JSON.parse(text);
    cfg.baseUrl = `${cfg.host}:${cfg.backendPort}`;
    return cfg;
  } catch (err) {
    exitErr(`config not found or invalid: ${CONFIG_PATH}`, 3);
  }
};

const saveConfig = async (cfg) => {
  const tmp = CONFIG_PATH + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(cfg, null, 2), 'utf8');
  await fsp.rename(tmp, CONFIG_PATH);
};

// ─────────────────────────────── Token 管理 ─────────────────────────────

const nowIso = () => new Date().toISOString();
const addMinutes = (iso, m) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();
const addSeconds = (iso, s) => new Date(new Date(iso).getTime() + s * 1000).toISOString();

const doLogin = async (cfg) => {
  let resp;
  try {
    resp = await fetch(`${cfg.baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: cfg.username, password: cfg.password }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    exitErr(`login network error: ${err.message}`, 2);
  }
  if (resp.status !== 200) {
    const text = await resp.text();
    exitErr(`login failed: ${resp.status} ${text.slice(0, 300)}`, 2);
  }
  const body = await resp.json();
  const data = body?.data || {};
  if (!data.accessToken) {
    const text = JSON.stringify(body);
    exitErr(`login response missing accessToken: ${text.slice(0, 300)}`, 2);
  }
  return data;
};

const doRefresh = async (cfg) => {
  if (!cfg.refreshToken) return null;
  let resp;
  try {
    resp = await fetch(`${cfg.baseUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.refreshToken}` },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    exitErr(`refresh network error: ${err.message}`, 2);
  }
  if (resp.status === 401) return null;
  if (resp.status !== 200) {
    const text = await resp.text();
    exitErr(`refresh failed: ${resp.status} ${text.slice(0, 300)}`, 2);
  }
  const body = await resp.json();
  return body?.data || {};
};

/**
 * 三级降级:
 *   1. accessToken 未过期 → 直接复用
 *   2. refreshToken 有效   → refresh 拿新 accessToken
 *   3. 都不行              → 重新 login
 * force=true 跳过第 1 级，用于 401 重试。
 */
const ensureToken = async (cfg, { force = false } = {}) => {
  const now = nowIso();
  const access = cfg.accessToken || '';
  const expiry = cfg.accessTokenExpiry || '';

  if (!force && access && expiry && expiry > addSeconds(now, 60)) {
    return access;
  }

  const refreshed = await doRefresh(cfg);
  if (refreshed?.accessToken) {
    cfg.accessToken = refreshed.accessToken;
    cfg.accessTokenExpiry = addMinutes(now, 15);
    await saveConfig(cfg);
    return cfg.accessToken;
  }

  const loginData = await doLogin(cfg);
  cfg.accessToken = loginData.accessToken;
  cfg.refreshToken = loginData.refreshToken || cfg.refreshToken || '';
  cfg.accessTokenExpiry = addMinutes(now, 15);
  await saveConfig(cfg);
  return cfg.accessToken;
};

// ─────────────────────────────── HTTP 调用封装 ───────────────────────────

/**
 * 统一 HTTP 调用，遇 401 自动降级重试（最多一次）。
 * @param {object} cfg
 * @param {string} method
 * @param {string} apiPath
 * @param {object} opts
 * @param {boolean} [opts.auth=false]
 * @param {object} [opts.headers]
 * @param {object|null} [opts.json]       JSON body (与 body/formData 互斥)
 * @param {object} [opts.query]           URL 查询参数
 * @param {FormData} [opts.formData]      multipart body
 * @param {number} [opts.timeoutMs=60000] 超时
 */
const api = async (cfg, method, apiPath, opts = {}) => {
  const url = new URL(`${cfg.baseUrl}${apiPath}`);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }

  const headers = { ...(opts.headers || {}) };
  if (opts.auth) {
    const token = await ensureToken(cfg);
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchOpts = {
    method,
    headers,
    signal: AbortSignal.timeout(opts.timeoutMs || 60_000),
  };
  if (opts.json !== undefined) {
    fetchOpts.body = JSON.stringify(opts.json);
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  } else if (opts.formData) {
    fetchOpts.body = opts.formData;
    // 不要手动设置 Content-Type，让 fetch 自动注入 boundary
  } else if (opts.body !== undefined) {
    fetchOpts.body = opts.body;
  }

  let resp;
  try {
    resp = await fetch(url, fetchOpts);
  } catch (err) {
    exitErr(`network error: ${err.message}`, 2);
  }

  if (opts.auth && resp.status === 401) {
    const token = await ensureToken(cfg, { force: true });
    headers.Authorization = `Bearer ${token}`;
    try {
      resp = await fetch(url, { ...fetchOpts, headers });
    } catch (err) {
      exitErr(`network error (retry): ${err.message}`, 2);
    }
  }

  return resp;
};

const ok = async (resp, { expect201 = false } = {}) => {
  const okCodes = expect201 ? [200, 201] : [200];
  if (!okCodes.includes(resp.status)) {
    const text = await resp.text();
    exitErr(`HTTP ${resp.status}: ${text.slice(0, 500)}`, 2);
  }
  const text = await resp.text();
  try {
    return JSON.parse(text);
  } catch {
    return { status: resp.status, text };
  }
};

// ─────────────────────────────── 子命令实现 ─────────────────────────────

// ---- 配置 / 健康 ----
const cmd_ping = async (cfg, args) => {
  let resp;
  try {
    resp = await fetch(`${cfg.baseUrl}/mcp/health`, { signal: AbortSignal.timeout(10_000) });
  } catch (err) {
    exitErr(`ping network error: ${err.message}`, 2);
  }
  const text = await resp.text();
  out({ status: resp.status, body: text.slice(0, 500) });
};

const cmd_whoami = async (cfg) => {
  out({
    baseUrl: cfg.baseUrl,
    username: cfg.username,
    hasPassword: Boolean(cfg.password),
    hasAccessToken: Boolean(cfg.accessToken),
    hasRefreshToken: Boolean(cfg.refreshToken),
    accessTokenExpiry: cfg.accessTokenExpiry,
  });
};

const cmd_login = async (cfg) => {
  const token = await ensureToken(cfg, { force: true });
  out({
    ok: true,
    accessTokenExpiry: cfg.accessTokenExpiry,
    tokenPrefix: token.slice(0, 12) + '...',
  });
};

// ---- 工具 ----
const cmd_tool_search = async (cfg, args) => {
  const query = { page: 0, size: args.limit, sortBy: 'hot' };
  if (args.query) query.keyword = args.query;
  if (args.category != null) query.categoryId = args.category;
  if (args.tag) {
    const tagsResp = await api(cfg, 'GET', '/api/v1/tags', { query: { type: 'TOOL' } });
    const tagsData = await ok(tagsResp);
    const tagList = tagsData.data || [];
    const matched = tagList.find(t => t.name && t.name.toLowerCase() === args.tag.toLowerCase());
    if (!matched) {
      exitErr(`tag not found: "${args.tag}" (available: ${tagList.map(t => t.name).join(', ')})`, 2);
    }
    query.tagId = matched.id;
  }
  const resp = await api(cfg, 'GET', '/api/v1/tools', { query });
  out(await ok(resp));
};

const cmd_tool_get = async (cfg, args) => {
  const resp = await api(cfg, 'GET', `/api/v1/tools/${args.toolId}`);
  out(await ok(resp));
};

const cmd_tool_files = async (cfg, args) => {
  const resp = await api(cfg, 'GET', `/api/v1/tools/${args.toolId}/files`);
  out(await ok(resp));
};

const cmd_tool_download = async (cfg, args) => {
  const resp = await api(cfg, 'GET',
    `/api/v1/tools/${args.toolId}/files/${args.fileId}/download`,
    { timeoutMs: 120_000 });
  if (resp.status !== 200) {
    const text = await resp.text();
    exitErr(`HTTP ${resp.status}: ${text.slice(0, 300)}`, 2);
  }
  const outPath = path.resolve(args.outPath);
  await fsp.mkdir(path.dirname(outPath), { recursive: true });
  await pipeline(Readable.fromWeb(resp.body), fs.createWriteStream(outPath));
  const stat = await fsp.stat(outPath);
  out({ ok: true, path: outPath, bytes: stat.size });
};

const cmd_tool_create = async (cfg, args) => {
  const body = {
    name: args.name,
    categoryId: args.category,
    content: args.content,
    version: args.version,
  };
  if (args.desc != null) body.description = args.desc;
  if (args.tags) body.tagIds = args.tags.split(',').filter(Boolean).map(Number);
  const resp = await api(cfg, 'POST', '/api/v1/tools', { auth: true, json: body });
  out(await ok(resp, { expect201: true }));
};

const cmd_tool_modify = async (cfg, args) => {
  const body = {};
  const mapping = [
    ['name', 'name'],
    ['categoryId', 'category'],
    ['content', 'content'],
    ['version', 'version'],
    ['description', 'desc'],
  ];
  for (const [key, attr] of mapping) {
    if (args[attr] != null) body[key] = args[attr];
  }
  if (args.tags) body.tagIds = args.tags.split(',').filter(Boolean).map(Number);
  if (Object.keys(body).length === 0) {
    exitErr('tool-modify: 未提供任何更新字段', 1);
  }
  const resp = await api(cfg, 'PUT', `/api/v1/tools/${args.toolId}`, { auth: true, json: body });
  out(await ok(resp));
};

const cmd_tool_file_upload = async (cfg, args) => {
  const fd = new FormData();
  for (const p of args.files) {
    const abs = path.resolve(p);
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat) exitErr(`file not found: ${abs}`, 1);
    const buf = await fsp.readFile(abs);
    fd.append('files', new File([buf], path.basename(abs)));
  }
  if (args.readme) fd.append('readme', args.readme);
  // 文件上传端点 permitAll，auth=false
  const resp = await api(cfg, 'POST', `/api/v1/tools/${args.toolId}/files`, {
    auth: false,
    formData: fd,
    timeoutMs: 300_000,
  });
  out(await ok(resp));
};

const cmd_tool_file_delete = async (cfg, args) => {
  const resp = await api(cfg, 'DELETE',
    `/api/v1/tools/${args.toolId}/files/${args.fileId}`,
    { auth: true });
  out(await ok(resp));
};

// ---- 帖子 ----
const cmd_post_search = async (cfg, args) => {
  const query = { page: 0, size: args.limit };
  if (args.query) query.keyword = args.query;
  const resp = await api(cfg, 'GET', '/api/forum/posts', { query });
  out(await ok(resp));
};

const cmd_post_get = async (cfg, args) => {
  const resp = await api(cfg, 'GET', `/api/forum/posts/${args.postId}`);
  out(await ok(resp));
};

const cmd_post_create = async (cfg, args) => {
  const body = {
    title: args.title,
    content: args.content,
    categoryId: args.category,
  };
  if (args.tags) body.tagIds = args.tags.split(',').filter(Boolean).map(Number);
  const resp = await api(cfg, 'POST', '/api/forum/posts', { auth: true, json: body });
  out(await ok(resp, { expect201: true }));
};

// ---- 知识库 ----
const cmd_kb_list = async (cfg, args) => {
  const resp = await api(cfg, 'GET', '/api/v1/knowledge', {
    query: { page: args.page, size: args.size },
  });
  out(await ok(resp));
};

const cmd_kb_search = async (cfg, args) => {
  const body = {
    query: args.query,
    topK: args.topK,
    rerank: args.rerank,
    expandContext: args.expand,
  };
  const resp = await api(cfg, 'POST', `/api/v1/knowledge/${args.kbId}/search`, { json: body });
  out(await ok(resp));
};

const cmd_kb_create = async (cfg, args) => {
  const body = { name: args.name };
  if (args.desc != null) body.description = args.desc;
  if (args.chunkMode != null) body.chunkMode = args.chunkMode;
  if (args.chunkSize != null) body.chunkSize = args.chunkSize;
  if (args.chunkOverlap != null) body.chunkOverlap = args.chunkOverlap;
  const resp = await api(cfg, 'POST', '/api/v1/knowledge', { auth: true, json: body });
  out(await ok(resp, { expect201: true }));
};

const cmd_kb_update = async (cfg, args) => {
  const body = {};
  if (args.name != null) body.name = args.name;
  if (args.desc != null) body.description = args.desc;
  if (Object.keys(body).length === 0) {
    exitErr('kb-update: 未提供任何更新字段', 1);
  }
  const resp = await api(cfg, 'PUT', `/api/v1/knowledge/${args.kbId}`, { auth: true, json: body });
  out(await ok(resp));
};

const cmd_kb_delete = async (cfg, args) => {
  const resp = await api(cfg, 'DELETE', `/api/v1/knowledge/${args.kbId}`, { auth: true });
  out(await ok(resp));
};

// ---- 插件 ----
const cmd_plugin_search = async (cfg, args) => {
  const query = { page: 0, size: args.limit, sort: 'new' };
  if (args.query) query.keyword = args.query;
  const resp = await api(cfg, 'GET', '/api/v1/plugins', { query });
  out(await ok(resp));
};

const cmd_plugin_create = async (cfg, args) => {
  // 两段式第一步: 创建草稿（需认证）
  const body = { name: args.name, version: args.version };
  if (args.desc != null) body.description = args.desc;
  if (args.source != null) body.source = args.source;
  const resp = await api(cfg, 'POST', '/api/v1/plugins/draft', { auth: true, json: body });
  out(await ok(resp, { expect201: true }));
};

const cmd_plugin_file_upload = async (cfg, args) => {
  // 两段式第二步: 为草稿补全 zip（免认证，zip 内 name/version 须与草稿一致）
  const abs = path.resolve(args.zipPath);
  const stat = await fsp.stat(abs).catch(() => null);
  if (!stat) exitErr(`file not found: ${abs}`, 1);
  const buf = await fsp.readFile(abs);
  const fd = new FormData();
  fd.append('file', new File([buf], path.basename(abs)));
  const resp = await api(cfg, 'POST', `/api/v1/plugins/${args.pluginId}/file`, {
    auth: false,
    formData: fd,
    timeoutMs: 300_000,
  });
  out(await ok(resp));
};

const cmd_plugin_update = async (cfg, args) => {
  // 覆盖更新（需认证），要求 zip 内版本较已发布版本递增
  const abs = path.resolve(args.zipPath);
  const stat = await fsp.stat(abs).catch(() => null);
  if (!stat) exitErr(`file not found: ${abs}`, 1);
  const buf = await fsp.readFile(abs);
  const fd = new FormData();
  fd.append('file', new File([buf], path.basename(abs)));
  const resp = await api(cfg, 'PUT', `/api/v1/plugins/${args.pluginId}`, {
    auth: true,
    formData: fd,
    timeoutMs: 300_000,
  });
  out(await ok(resp));
};

// ─────────────────────────────── CLI 解析 ───────────────────────────────

/**
 * 命令规格:
 *   positional: 位置参数名 (按顺序)
 *   flags: { name: { type: 'int'|'string', required, default, alias, nargs? } }
 *           type='int' 自动 parseInt；nargs='+' 收集剩余非 flag 值到数组
 */
const COMMANDS = {
  ping:         { fn: cmd_ping },
  login:        { fn: cmd_login },
  whoami:       { fn: cmd_whoami },

  'tool-search': {
    fn: cmd_tool_search,
    flags: {
      query:    { type: 'string', default: '', alias: '-q', nargs: 1 },
      category: { type: 'int',    default: null,             nargs: 1 },
      tag:      { type: 'string', default: null,             nargs: 1 },
      limit:    { type: 'int',    default: 20,               nargs: 1 },
    },
  },
  'tool-get':    { fn: cmd_tool_get,    positional: ['toolId'],            flagTypes: { toolId: 'int' } },
  'tool-files':  { fn: cmd_tool_files,  positional: ['toolId'],            flagTypes: { toolId: 'int' } },
  'tool-download': {
    fn: cmd_tool_download,
    positional: ['toolId', 'fileId', 'outPath'],
    flagTypes: { toolId: 'int', fileId: 'int' },
  },
  'tool-create': {
    fn: cmd_tool_create,
    flags: {
      name:     { type: 'string', required: true, nargs: 1 },
      category: { type: 'int',    required: true, nargs: 1 },
      content:  { type: 'string', required: true, nargs: 1 },
      version:  { type: 'string', required: true, nargs: 1 },
      desc:     { type: 'string', default: null,  nargs: 1 },
      tags:     { type: 'string', default: null,  nargs: 1 },
    },
  },
  'tool-modify': {
    fn: cmd_tool_modify,
    positional: ['toolId'],
    flagTypes: { toolId: 'int' },
    flags: {
      name:     { type: 'string', default: null, nargs: 1 },
      category: { type: 'int',    default: null, nargs: 1 },
      content:  { type: 'string', default: null, nargs: 1 },
      version:  { type: 'string', default: null, nargs: 1 },
      desc:     { type: 'string', default: null, nargs: 1 },
      tags:     { type: 'string', default: null, nargs: 1 },
    },
  },
  'tool-file-upload': {
    fn: cmd_tool_file_upload,
    positional: ['toolId', 'files'],
    positionalNargs: { files: '+' },
    flagTypes: { toolId: 'int' },
    flags: {
      readme: { type: 'string', default: null, nargs: 1 },
    },
  },
  'tool-file-delete': {
    fn: cmd_tool_file_delete,
    positional: ['toolId', 'fileId'],
    flagTypes: { toolId: 'int', fileId: 'int' },
  },

  'post-search': {
    fn: cmd_post_search,
    flags: {
      query: { type: 'string', default: '', alias: '-q', nargs: 1 },
      limit: { type: 'int',    default: 20,               nargs: 1 },
    },
  },
  'post-get':    { fn: cmd_post_get,    positional: ['postId'],          flagTypes: { postId: 'int' } },
  'post-create': {
    fn: cmd_post_create,
    flags: {
      title:    { type: 'string', required: true, nargs: 1 },
      content:  { type: 'string', required: true, nargs: 1 },
      category: { type: 'int',    required: true, nargs: 1 },
      tags:     { type: 'string', default: null,  nargs: 1 },
    },
  },

  'kb-list': {
    fn: cmd_kb_list,
    flags: {
      page: { type: 'int', default: 0,  nargs: 1 },
      size: { type: 'int', default: 20, nargs: 1 },
    },
  },
  'kb-search': {
    fn: cmd_kb_search,
    positional: ['kbId', 'query'],
    flagTypes: { kbId: 'int' },
    flags: {
      topK:   { type: 'int',    default: 5,      nargs: 1 },
      rerank: { type: 'string', default: 'true', nargs: 1 },
      expand: { type: 'int',    default: 1,      nargs: 1 },
    },
  },
  'kb-create': {
    fn: cmd_kb_create,
    flags: {
      name:         { type: 'string', required: true, nargs: 1 },
      desc:         { type: 'string', default: null,  nargs: 1 },
      chunkMode:    { type: 'string', default: null,  nargs: 1 },
      chunkSize:    { type: 'int',    default: null,  nargs: 1 },
      chunkOverlap: { type: 'int',    default: null,  nargs: 1 },
    },
  },
  'kb-update': {
    fn: cmd_kb_update,
    positional: ['kbId'],
    flagTypes: { kbId: 'int' },
    flags: {
      name: { type: 'string', default: null, nargs: 1 },
      desc: { type: 'string', default: null, nargs: 1 },
    },
  },
  'kb-delete': {
    fn: cmd_kb_delete,
    positional: ['kbId'],
    flagTypes: { kbId: 'int' },
  },
  'plugin-search': {
    fn: cmd_plugin_search,
    flags: {
      query: { type: 'string', alias: '-q', default: '', nargs: 1 },
      limit: { type: 'int', default: 20, nargs: 1 },
    },
  },
  'plugin-create': {
    fn: cmd_plugin_create,
    flags: {
      name: { type: 'string', required: true, nargs: 1 },
      version: { type: 'string', required: true, nargs: 1 },
      desc: { type: 'string', default: null, nargs: 1 },
      source: { type: 'string', default: null, nargs: 1 },
    },
  },
  'plugin-file-upload': {
    fn: cmd_plugin_file_upload,
    positional: ['pluginId', 'zipPath'],
    flagTypes: { pluginId: 'int' },
  },
  'plugin-update': {
    fn: cmd_plugin_update,
    positional: ['pluginId', 'zipPath'],
    flagTypes: { pluginId: 'int' },
  },
};

const castValue = (v, type) => {
  if (type === 'int')    return Number.parseInt(v, 10);
  if (type === 'bool')   return String(v).toLowerCase() === 'true';
  return v;
};

const parseArgs = (spec, argv) => {
  const args = {};
  const flagMap = {};
  for (const [name, def] of Object.entries(spec.flags || {})) {
    args[name] = def.default;
    flagMap[`--${name}`] = name;
    if (def.alias) flagMap[def.alias] = name;
  }

  // 第一遍：扫描所有 flag（允许与 positional 任意交错），收集 leftover
  const positional = spec.positional || [];
  const leftover = [];
  let i = 0;
  while (i < argv.length) {
    const a = argv[i];
    if (flagMap[a] !== undefined) {
      const name = flagMap[a];
      const def = spec.flags[name];
      if (def.nargs === '+') {
        const values = [];
        i++;
        while (i < argv.length && !argv[i].startsWith('-')) values.push(argv[i++]);
        args[name] = values;
        continue;
      }
      // nargs: 1 或默认 → 恰好消费一个值
      i++;
      if (i >= argv.length) exitErr(`flag ${a} requires a value`, 1);
      args[name] = castValue(argv[i], def.type);
    } else if (a === '--') {
      // 显式分隔符：后续全部当 positional
      leftover.push(...argv.slice(i + 1));
      break;
    } else {
      leftover.push(a);
    }
    i++;
  }

  // 第二遍：leftover 按顺序填入 positional（支持 positionalNargs: { name: '+' }）
  const variadic = spec.positionalNargs || {};
  const fixedCount = positional.filter((p) => variadic[p] !== '+').length;
  const hasVariadic = positional.some((p) => variadic[p] === '+');

  if (!hasVariadic && leftover.length > positional.length) {
    exitErr(`unexpected arguments: ${leftover.slice(positional.length).join(', ')}`, 1);
  }
  if (leftover.length < fixedCount) {
    exitErr(`missing positional arguments: ${positional.slice(leftover.length).join(', ')}`, 1);
  }

  let li = 0;
  for (let j = 0; j < positional.length; j++) {
    const name = positional[j];
    const type = spec.flagTypes?.[name] || 'string';
    if (variadic[name] === '+') {
      // 变长 positional：吃掉剩余所有 leftover
      const rest = leftover.slice(li).map((v) => castValue(v, type));
      args[name] = rest;
      li = leftover.length;
    } else {
      args[name] = li < leftover.length ? castValue(leftover[li++], type) : undefined;
    }
  }

  // 验证 required
  for (const [name, def] of Object.entries(spec.flags || {})) {
    if (def.required && (args[name] === undefined || args[name] === null)) {
      exitErr(`missing required flag: --${name}`, 1);
    }
  }
  // 变长 positional 至少要有一个值
  for (const name of positional) {
    if (variadic[name] === '+' && (!Array.isArray(args[name]) || args[name].length === 0)) {
      exitErr(`missing positional argument: ${name} (requires at least one value)`, 1);
    }
  }
  for (const [name, def] of Object.entries(spec.flags || {})) {
    if (def.nargs === '+' && (!Array.isArray(args[name]) || args[name].length === 0)) {
      exitErr(`--${name} requires at least one value`, 1);
    }
  }
  return args;
};

// ─────────────────────────────── 入口 ───────────────────────────────────

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || cmd === '-h' || cmd === '--help') {
    log('用法: node chub.cjs <subcommand> [args...]');
    log('子命令: ping | login | whoami | tool-* | post-* | kb-*');
    log('详情见 SKILL.md 或 chub.cjs 文件头注释');
    process.exit(cmd ? 0 : 1);
  }
  const spec = COMMANDS[cmd];
  if (!spec) exitErr(`unknown subcommand: ${cmd}`, 1);

  const args = parseArgs(spec, rest);
  const cfg = await loadConfig();
  try {
    await spec.fn(cfg, args);
  } catch (err) {
    exitErr(`unhandled error: ${err?.message || err}`, 2);
  }
};

main().catch((err) => {
  log(`fatal: ${err?.message || err}`);
  process.exit(3);
});
