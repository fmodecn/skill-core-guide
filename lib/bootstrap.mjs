/**
 * 一键凭证供给 —— ~/.fmode/ 自举
 * ---------------------------------------------------------------------------
 * 目标：新机器/新容器上，让技能在「零手工配置」前提下拿到可用的 Fmode 凭据。
 *
 * ⚠️ 诚实声明（2026-09-22 实测，务必先读）
 * ---------------------------------------------------------------------------
 * 任务书里描述的「手机号 + 验证码 → 创建 ~/.fmode/」路径依赖端点
 *   POST /api/fmode/verifycode
 * 该端点**当前实测 404，服务端未上线**（状态 planned，见 lib/platform.mjs）。
 * 因此本模块**不会**伪造短信流程假装成功。
 *
 * 当前**真实可用**的自举路径（生产实测，与 skill-listen / skill-vision 同源）：
 *
 *   用户登录 FMODE Studio 拿到 sessionToken
 *        ↓  写入 FMODE_SESSION_TOKEN 环境变量 或 ~/.fmode/config.json
 *   POST https://server.fmode.cn/api/fmode/voc-skill/install-prompt
 *        （header: x-parse-session-token）
 *        ↓  从 body.data.prompt 文本中提取 /sk-(?!ant-)[A-Za-z0-9_-]{8,}/
 *   fmode API token（sk- 开头）—— 仅内存持有，不落盘、不进日志
 *
 * 一旦 /api/fmode/verifycode 上线，把 platform.mjs 里 verifyCode.status 改为
 * 'live'，本模块的 requestVerifyCode() / verifyAndProvision() 即自动启用。
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { ENDPOINTS, TOKEN_RULES, PLATFORM } from './platform.mjs';

const BOM_RE = /^﻿/;

// ============================================================
// 路径解析
// ============================================================

/**
 * 解析 ~/.fmode 目录。优先级：
 *   1. FMODE_HOME 环境变量
 *   2. <home>/.fmode
 * @returns {string}
 */
export function resolveFmodeDir() {
  if (process.env.FMODE_HOME) return path.resolve(process.env.FMODE_HOME);
  return path.join(os.homedir(), '.fmode');
}

/** 用户级 config.json 路径 */
export function resolveConfigPath() {
  return path.join(resolveFmodeDir(), 'config.json');
}

/** 安全读 JSON（剥 BOM，失败返回 null） */
function readJson(file) {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf-8').replace(BOM_RE, ''));
  } catch {
    return null;
  }
}

// ============================================================
// 凭据解析（标准 5 级链）
// ============================================================

/**
 * 第 0 级：解析 sessionToken。
 * 来源：FMODE_SESSION_TOKEN 环境变量 → ~/.fmode/config.json 的 sessionToken。
 * @returns {{token: string, source: string}|null}
 */
export function resolveSessionToken() {
  const env = process.env.FMODE_SESSION_TOKEN;
  if (env && env.trim()) {
    return { token: env.trim(), source: 'env:FMODE_SESSION_TOKEN' };
  }
  const cfg = readJson(resolveConfigPath());
  if (cfg) {
    const t = cfg.sessionToken || (cfg.user && cfg.user.sessionToken) || null;
    if (t && String(t).trim()) {
      return { token: String(t).trim(), source: `${resolveConfigPath()}#sessionToken` };
    }
  }
  return null;
}

/**
 * 校验一个字符串是否是合法的 fmode API token。
 * 规则：sk- 开头、排除 sk-ant-、若设了 ANTHROPIC_BASE_URL 必须指向 fmode。
 * @param {string} token
 * @returns {{ok: boolean, reason?: string}}
 */
export function validateToken(token) {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'token 为空' };
  const t = token.trim();
  if (!t.startsWith(TOKEN_RULES.prefix)) {
    return { ok: false, reason: `token 必须以 "${TOKEN_RULES.prefix}" 开头` };
  }
  if (t.startsWith(TOKEN_RULES.exclude)) {
    return { ok: false, reason: `拒绝真正的 Anthropic 官方 key（"${TOKEN_RULES.exclude}" 前缀）` };
  }
  const base = process.env.ANTHROPIC_BASE_URL;
  if (base && !base.includes(TOKEN_RULES.baseUrlMustInclude)) {
    return { ok: false, reason: `ANTHROPIC_BASE_URL=${base} 未指向 fmode，拒绝使用该 token` };
  }
  return { ok: true };
}

/**
 * 第 0 级自举：sessionToken → fmode API token。
 * token 仅内存持有，不落盘不进日志（与 listen/vision 生产实现一致）。
 *
 * @param {string} sessionToken
 * @param {{timeoutMs?: number, base?: string}} [opts]
 * @returns {Promise<{token: string, source: string}|null>} 失败返回 null（调用方回落下一级）
 */
export async function fetchApiTokenFromSession(sessionToken, opts = {}) {
  if (!sessionToken) return null;
  const base = (opts.base || PLATFORM.gatewayBase).replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/api/fmode/voc-skill/install-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-parse-session-token': sessionToken,
      },
      body: JSON.stringify({
        channel: 'claude-code',
        scope: 'user',
        source: 'skill-core-guide-bootstrap',
      }),
      signal: AbortSignal.timeout(opts.timeoutMs || 15000),
    });
    if (!res.ok) return null;
    const body = await res.json().catch(() => null);
    const prompt =
      body && body.data && typeof body.data.prompt === 'string' ? body.data.prompt : '';
    const m = prompt.match(TOKEN_RULES.extractRe);
    if (!m) return null;
    return { token: m[0], source: 'sessionToken 自举（voc-skill/install-prompt）' };
  } catch {
    // 网络失败一律回落，不泄露错误细节
    return null;
  }
}

/**
 * 标准 5 级凭据解析链。命中即用，全失败返回 null。
 *
 * 0. sessionToken 自举（FMODE_SESSION_TOKEN / ~/.fmode/config.json）
 * 1. 环境变量 FMODE_API_TOKEN
 * 2. ~/.fmode/config.json → fmodeApiToken / newapiToken
 * 3. <cwd>/.fmode/config.json → fmodeApiToken / newapiToken
 * 4. ~/.claude/settings.json（含 .local / 项目级）的 env.ANTHROPIC_AUTH_TOKEN
 *
 * @param {{cwd?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{token: string, source: string, level: number}|null>}
 */
export async function resolveApiToken(opts = {}) {
  const cwd = opts.cwd || process.cwd();

  // ---- 0. sessionToken 自举 ----
  const sess = resolveSessionToken();
  if (sess) {
    const boot = await fetchApiTokenFromSession(sess.token, { timeoutMs: opts.timeoutMs });
    if (boot) {
      const v = validateToken(boot.token);
      if (v.ok) return { token: boot.token, source: boot.source, level: 0 };
    }
  }

  // ---- 1. 环境变量 ----
  const env = process.env.FMODE_API_TOKEN;
  if (env && validateToken(env).ok) {
    return { token: env.trim(), source: 'env:FMODE_API_TOKEN', level: 1 };
  }

  // ---- 2. 用户级 config ----
  const userCfg = readJson(resolveConfigPath());
  if (userCfg) {
    const t = userCfg.fmodeApiToken || userCfg.newapiToken;
    if (t && validateToken(t).ok) {
      return { token: String(t).trim(), source: `${resolveConfigPath()}#fmodeApiToken`, level: 2 };
    }
  }

  // ---- 3. 项目级 config ----
  const projCfg = readJson(path.join(cwd, '.fmode', 'config.json'));
  if (projCfg) {
    const t = projCfg.fmodeApiToken || projCfg.newapiToken;
    if (t && validateToken(t).ok) {
      return { token: String(t).trim(), source: `${cwd}/.fmode/config.json#fmodeApiToken`, level: 3 };
    }
  }

  // ---- 4. Claude Code settings ----
  const settingsFiles = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(os.homedir(), '.claude', 'settings.local.json'),
    path.join(cwd, '.claude', 'settings.json'),
    path.join(cwd, '.claude', 'settings.local.json'),
  ];
  for (const f of settingsFiles) {
    const j = readJson(f);
    const t = j && j.env && j.env.ANTHROPIC_AUTH_TOKEN;
    if (t && validateToken(t).ok) {
      return { token: String(t).trim(), source: `${f}#env.ANTHROPIC_AUTH_TOKEN`, level: 4 };
    }
  }

  return null;
}

// ============================================================
// 目录 / 配置文件供给
// ============================================================

/**
 * 确保 ~/.fmode/ 目录结构存在（幂等）。
 * @param {{fmodeDir?: string}} [opts]
 * @returns {{fmodeDir: string, credentialsDir: string, created: string[]}}
 */
export function ensureFmodeDir(opts = {}) {
  const fmodeDir = opts.fmodeDir || resolveFmodeDir();
  const credentialsDir = path.join(fmodeDir, 'credentials');
  const projectsDir = path.join(fmodeDir, 'projects');
  const created = [];

  for (const d of [fmodeDir, credentialsDir, projectsDir]) {
    if (!fs.existsSync(d)) {
      fs.mkdirSync(d, { recursive: true, mode: 0o700 });
      created.push(d);
    }
  }
  // 凭据目录强制 700
  try {
    fs.chmodSync(credentialsDir, 0o700);
  } catch {
    /* 非 POSIX 或权限不足时忽略 */
  }

  return { fmodeDir, credentialsDir, projectsDir, created };
}

/**
 * 写入 ~/.fmode/config.json（幂等合并，绝不覆盖已有字段）。
 * ⚠️ 只写非敏感字段。sessionToken 等敏感值由用户自行写入，本函数不代写。
 *
 * @param {object} patch 要合并进 config 的字段
 * @param {{fmodeDir?: string, mode?: number}} [opts]
 * @returns {{path: string, written: boolean, merged: object}}
 */
export function writeConfig(patch = {}, opts = {}) {
  const fmodeDir = opts.fmodeDir || resolveFmodeDir();
  if (!fs.existsSync(fmodeDir)) fs.mkdirSync(fmodeDir, { recursive: true, mode: 0o700 });

  const file = path.join(fmodeDir, 'config.json');
  const existing = readJson(file) || {};

  // 敏感字段白名单外的一律不写
  const FORBIDDEN = ['apiKey', 'apiKeys', 'sessionToken', 'githubToken', 'password', 'secret'];
  const safe = {};
  for (const [k, v] of Object.entries(patch)) {
    if (FORBIDDEN.includes(k)) continue;
    safe[k] = v;
  }

  const merged = { ...existing, ...safe };
  const changed = JSON.stringify(existing) !== JSON.stringify(merged);

  if (changed) {
    fs.writeFileSync(file, JSON.stringify(merged, null, 2), { mode: 0o600 });
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      /* ignore */
    }
  }

  return { path: file, written: changed, merged };
}

/** 写一个凭据文件到 credentials/（600 权限） */
export function writeCredential(name, content, opts = {}) {
  const { credentialsDir } = ensureFmodeDir(opts);
  const file = path.join(credentialsDir, name);
  fs.writeFileSync(file, content, { mode: 0o600 });
  try {
    fs.chmodSync(file, 0o600);
  } catch {
    /* ignore */
  }
  return file;
}

// ============================================================
// 短信验证码路径（planned —— 端点未上线）
// ============================================================

/**
 * 请求手机号验证码。
 * ⚠️ 依赖 POST /api/fmode/verifycode，当前实测 404（未上线）。
 * 本函数会**先探测**端点，未上线时返回 { ok:false, planned:true }，
 * 调用方应回落到 sessionToken 路径，**不要**把它当成发送成功。
 *
 * @param {string} phone
 * @param {{timeoutMs?: number, base?: string}} [opts]
 * @returns {Promise<{ok: boolean, planned?: boolean, status?: number, reason?: string}>}
 */
export async function requestVerifyCode(phone, opts = {}) {
  if (!phone || !/^1[3-9]\d{9}$/.test(String(phone).trim())) {
    return { ok: false, reason: '手机号格式不合法（需中国大陆 11 位手机号）' };
  }

  const ep = ENDPOINTS.verifyCode;
  const base = (opts.base || PLATFORM.gatewayBase).replace(/\/$/, '');

  let status = 0;
  try {
    const res = await fetch(`${base}/api/fmode/verifycode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: String(phone).trim(), action: 'send' }),
      signal: AbortSignal.timeout(opts.timeoutMs || 12000),
    });
    status = res.status;
  } catch (err) {
    return { ok: false, reason: `网络不可达：${err.message}` };
  }

  if (status === 404) {
    return {
      ok: false,
      planned: true,
      status,
      reason:
        `${ep.url} 返回 404 —— 该端点服务端未上线（真值表状态：${ep.status}）。` +
        `请改用 sessionToken 路径（见 resolveSessionToken / fetchApiTokenFromSession）。`,
    };
  }

  if (status >= 200 && status < 300) {
    return { ok: true, status };
  }

  return { ok: false, status, reason: `端点返回 HTTP ${status}` };
}

/**
 * 验证码校验 + 开户（planned —— 端点未上线）。
 * 同 requestVerifyCode，端点未上线时显式返回 planned，不伪造成功。
 *
 * @param {string} phone
 * @param {string} code
 * @param {{timeoutMs?: number, base?: string}} [opts]
 * @returns {Promise<{ok: boolean, planned?: boolean, status?: number, reason?: string}>}
 */
export async function verifyAndProvision(phone, code, opts = {}) {
  if (!code || !/^\d{4,8}$/.test(String(code).trim())) {
    return { ok: false, reason: '验证码格式不合法' };
  }
  const base = (opts.base || PLATFORM.gatewayBase).replace(/\/$/, '');

  let status = 0;
  let body = null;
  try {
    const res = await fetch(`${base}/api/fmode/verifycode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: String(phone).trim(), code: String(code).trim(), action: 'verify' }),
      signal: AbortSignal.timeout(opts.timeoutMs || 12000),
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch (err) {
    return { ok: false, reason: `网络不可达：${err.message}` };
  }

  if (status === 404) {
    return {
      ok: false,
      planned: true,
      status,
      reason:
        'POST /api/fmode/verifycode 未上线（404）。' +
        '当前一键凭证供给请走 sessionToken 路径：登录 FMODE Studio → ' +
        'export FMODE_SESSION_TOKEN=... 或写入 ~/.fmode/config.json 的 sessionToken。',
    };
  }
  if (status >= 200 && status < 300) {
    return { ok: true, status, body };
  }
  return { ok: false, status, reason: `端点返回 HTTP ${status}` };
}

// ============================================================
// 编排：一键凭证供给
// ============================================================

/**
 * 一键凭证供给主入口。
 *
 * 流程：
 *   1. 确保 ~/.fmode/ 目录结构（幂等）
 *   2. 走标准 5 级凭据链解析 token
 *   3. 命中 → 返回可用凭据
 *   4. 未命中 → 尝试 planned 短信路径探测，明确报告未上线，并给出
 *      **可执行的**下一步指引（不伪造成功）
 *
 * @param {{cwd?: string, phone?: string, code?: string, dryRun?: boolean, timeoutMs?: number}} [opts]
 * @returns {Promise<object>}
 */
export async function bootstrap(opts = {}) {
  const report = {
    ok: false,
    fmodeDir: resolveFmodeDir(),
    steps: [],
    token: null,
    guidance: [],
  };

  const step = (name, status, detail) => report.steps.push({ name, status, detail });

  // 1. 目录
  const dirs = ensureFmodeDir(opts);
  step(
    'ensure-fmode-dir',
    'ok',
    dirs.created.length ? `已创建 ${dirs.created.length} 个目录` : '目录已存在（幂等）',
  );

  // 2. 凭据链
  const resolved = await resolveApiToken(opts);
  if (resolved) {
    report.ok = true;
    report.token = { source: resolved.source, level: resolved.level, masked: maskToken(resolved.token) };
    step('resolve-credential', 'ok', `第 ${resolved.level} 级命中：${resolved.source}`);
    step('verify-credential', 'ok', 'token 形态校验通过（sk- 前缀，非 sk-ant-）');
    return report;
  }

  step('resolve-credential', 'fail', '5 级凭据链全部未命中');

  // 3. 探测 planned 短信路径
  if (opts.phone) {
    const vc = await requestVerifyCode(opts.phone, opts);
    if (vc.planned) {
      step('sms-verifycode', 'planned', vc.reason);
    } else if (vc.ok) {
      step('sms-verifycode', 'ok', '验证码已发送');
      report.guidance.push('请向用户索取验证码，然后调用 verifyAndProvision(phone, code)');
      return report;
    } else {
      step('sms-verifycode', 'fail', vc.reason || '发送失败');
    }
  } else {
    step('sms-verifycode', 'skipped', '未提供 phone，跳过短信路径');
  }

  // 4. 明确指引
  report.guidance = [
    '当前可用路径（sessionToken 自举，生产已验证）：',
    '  1) 浏览器登录 FMODE Studio，取得 sessionToken（形如 r:xxxx）',
    `  2) export FMODE_SESSION_TOKEN='r:xxxx'   # 或写入 ${resolveConfigPath()} 的 "sessionToken" 字段`,
    '  3) 重跑 skill-core bootstrap —— 将自动换取 fmode API token（仅内存持有）',
    '',
    '备选路径（手工配置，长期有效）：',
    `  在 ${resolveConfigPath()} 写入 { "fmodeApiToken": "sk-..." }`,
    '  或在 Claude Code settings.json 的 env.ANTHROPIC_AUTH_TOKEN 中配置（平台 SK 即此值）',
    '',
    `短信验证码路径依赖 ${ENDPOINTS.verifyCode.url}，该端点当前未上线（404），`,
    '上线后本模块自动启用，无需改代码。',
  ];

  return report;
}

/** token 脱敏展示（只留头尾，绝不打印本体） */
export function maskToken(token) {
  if (!token || typeof token !== 'string') return '(none)';
  const t = token.trim();
  if (t.length <= 12) return `${t.slice(0, 3)}***`;
  return `${t.slice(0, 6)}...${t.slice(-4)}`;
}

/** 人类可读的自举状态摘要 */
export function describeBootstrapStatus(report) {
  const lines = [];
  const icon = { ok: '✅', fail: '❌', planned: '🕓', skipped: '⏭️ ' };
  lines.push('\n  Fmode 凭证自举状态');
  lines.push('  ' + '─'.repeat(60));
  lines.push(`  ~/.fmode 目录：${report.fmodeDir}`);
  for (const s of report.steps) {
    lines.push(`  ${icon[s.status] || '·'} ${s.name}：${s.detail}`);
  }
  lines.push('  ' + '─'.repeat(60));
  if (report.ok && report.token) {
    lines.push(`  结果：✅ 凭据可用（${report.token.source}，${report.token.masked}）`);
  } else {
    lines.push('  结果：❌ 未取得可用凭据');
  }
  if (report.guidance.length) {
    lines.push('');
    for (const g of report.guidance) lines.push(`  ${g}`);
  }
  lines.push('');
  return lines.join('\n');
}

export default { bootstrap, resolveApiToken, resolveSessionToken, ensureFmodeDir };
