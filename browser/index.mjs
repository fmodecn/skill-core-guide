/**
 * skill-core-guide · Browser bundle（无 Node 依赖）
 * ---------------------------------------------------------------------------
 * 本文件**不得** import 任何 node: 内置模块 —— 只使用 Web 标准 API
 * （fetch / TextEncoder / URL / crypto.subtle 等），可直接被
 * <script type="module"> 加载或在浏览器打包器中消费。
 *
 * 导出能力：
 *   - 平台常量与端点真值表（纯数据）
 *   - 校验器（纯函数：package.json / manifest / frontmatter / 技能名）
 *   - 浏览器可跑的质检子集（network 类检查）
 *
 * 不导出：依赖 fs / child_process 的检查项（functional / sop / loop /
 * multiRuntime 的本地执行部分）—— 那些只能在 Node 侧运行。
 *
 * @example
 *   <script type="module">
 *     import { PLATFORM, checkApiConnectivity, validatePackageJson } from './browser/index.mjs';
 *     const r = await checkApiConnectivity();
 *     document.body.textContent = r.status + ' — ' + r.detail;
 *   </script>
 */

// ============================================================
// 平台常量（内联，保持浏览器 bundle 零依赖、可独立分发）
// ============================================================

export const VERSION = '1.0.3';
export const SKILL_NAME = 'skill-core-guide';

export const PLATFORM = {
  name: 'Fmode Harness',
  version: '1.0.0',
  apiBase: 'https://api.fmode.cn',
  gatewayBase: 'https://server.fmode.cn',
  cdnBase: 'https://fmode.cn',
  obsBase: 'https://fmode-s3.obs.cn-north-4.myhuaweicloud.com',
  gogsBase: 'https://git.fmode.cn',
  gogsOrg: 'fmode',
  githubOrg: 'fmodecn',
  npmRegistry: 'https://registry.npmjs.org',
  skillhub: {
    host: 'https://api.skillhub.cn',
    team: 'fmode',
    orgId: 'org-m8z913un',
  },
};

export const ENDPOINTS = {
  llmChat: {
    id: 'llmChat',
    method: 'POST',
    url: 'https://api.fmode.cn/v1/chat/completions',
    status: 'live',
    auth: 'Bearer <fmodeApiToken>',
    purpose: 'LLM 对话补全（OpenAI 兼容）',
  },
  imageGenerate: {
    id: 'imageGenerate',
    method: 'POST',
    url: 'https://api.fmode.cn/v1/images/generations',
    status: 'live',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '图像生成',
  },
  listenTranscribe: {
    id: 'listenTranscribe',
    method: 'POST',
    url: 'https://server.fmode.cn/api/listen/transcribe',
    status: 'live',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '录音转写（讯飞 LFASR）',
  },
  vocSkillBootstrap: {
    id: 'vocSkillBootstrap',
    method: 'POST',
    url: 'https://server.fmode.cn/api/fmode/voc-skill/install-prompt',
    status: 'live',
    auth: 'x-parse-session-token: <sessionToken>',
    purpose: 'sessionToken → fmode API token 自举',
  },
  deploySts: {
    id: 'deploySts',
    method: 'POST',
    url: 'https://server.fmode.cn/api/apig/deploy/huaweicloud',
    status: 'live',
    auth: 'Bearer <sessionToken>',
    purpose: '签发项目隔离 OBS STS',
  },
  verifyCode: {
    id: 'verifyCode',
    method: 'POST',
    url: 'https://server.fmode.cn/api/fmode/verifycode',
    status: 'planned',
    auth: '无',
    purpose: '手机号验证码（未上线）',
  },
};

export const RUNTIMES = {
  cli: { key: 'cli', label: 'CLI', entry: 'bin/<name>.mjs', usage: 'npx --yes <skill>@latest <command>', supported: true },
  sdk: { key: 'sdk', label: 'SDK (Node ESM)', entry: 'lib/index.mjs', usage: "import { ... } from '<skill>'", supported: true },
  browser: {
    key: 'browser',
    label: 'Browser',
    entry: 'browser/index.mjs',
    usage: '<script type="module" src="...">',
    supported: true,
    constraint: '禁止 import 任何 node: 内置模块',
  },
  server: {
    key: 'server',
    label: 'Server (CJS require)',
    entry: null,
    usage: "require('<skill>')",
    supported: false,
    constraint: 'ESM only —— 不提供 CJS 入口',
  },
};

export const TIERS = {
  system: { key: 'system', label: '系统层 / Infrastructure', desc: '平台基础设施与 Agent 运行时治理' },
  service: { key: 'service', label: '服务层 / Platform Services', desc: 'Fmode 基础服务封装' },
  application: { key: 'application', label: '应用层 / Business Applications', desc: '面向业务场景的端到端技能' },
};

export const CHANNELS = {
  gogs: { key: 'gogs', label: 'Gogs（主仓）', url: (n) => `https://git.fmode.cn/fmode/${n}` },
  github: { key: 'github', label: 'GitHub（镜像）', url: (n) => `https://github.com/fmodecn/${n}` },
  npm: { key: 'npm', label: 'npm', url: (n) => `https://www.npmjs.com/package/${n}` },
  skillhub: { key: 'skillhub', label: 'skillhub.cn', url: (s) => `https://skillhub.cn/skill/${s}` },
};

export const CREDENTIAL_CHAIN = [
  { level: 0, source: 'sessionToken 自举', detail: 'FMODE_SESSION_TOKEN / ~/.fmode/config.json → voc-skill/install-prompt' },
  { level: 1, source: '环境变量', detail: 'FMODE_API_TOKEN' },
  { level: 2, source: '用户级 config', detail: '~/.fmode/config.json → fmodeApiToken' },
  { level: 3, source: '项目级 config', detail: '<cwd>/.fmode/config.json → fmodeApiToken' },
  { level: 4, source: 'Claude Code settings', detail: '~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN' },
];

// ============================================================
// 纯函数校验器（与 lib/index.mjs 同源逻辑，此处内联以保持零依赖）
// ============================================================

export const NAMING = {
  prefix: 'skill-',
  altPrefix: 'fmode-',
  pattern: /^(skill|fmode)-[a-z0-9]+(-[a-z0-9]+)*$/,
  slugPattern: /^fmode-skill-[a-z0-9]+(-[a-z0-9]+)*$/,
};

/** 校验技能名 */
export function validateName(name) {
  if (!name || typeof name !== 'string') return { ok: false, reason: '技能名不能为空' };
  if (!NAMING.pattern.test(name)) {
    return { ok: false, reason: `"${name}" 不符合 skill-<kebab-case> 规范` };
  }
  return { ok: true, slug: `fmode-${name}` };
}

/** 校验 package.json（纯函数） */
export function validatePackageJson(pkg) {
  const errors = [];
  const warnings = [];
  if (!pkg || typeof pkg !== 'object') return { ok: false, errors: ['不是对象'], warnings };

  for (const f of ['name', 'version', 'description', 'type', 'main', 'exports', 'bin', 'files', 'license']) {
    if (pkg[f] === undefined || pkg[f] === null || pkg[f] === '') errors.push(`缺少必需字段：${f}`);
  }
  if (pkg.type !== 'module') errors.push(`"type" 必须是 "module"（当前 ${JSON.stringify(pkg.type)}）`);
  if (pkg.main !== './lib/index.mjs') errors.push(`"main" 必须是 "./lib/index.mjs"`);

  const dot = pkg.exports && pkg.exports['.'];
  if (!dot) errors.push('"exports" 缺少 "." 入口');
  else if (typeof dot === 'string') warnings.push('建议 exports["."] 写成 { import, default }');
  else for (const cond of ['import', 'default']) if (!dot[cond]) errors.push(`exports["."] 缺少 "${cond}"`);

  if (pkg.require !== undefined) errors.push('不应出现 "require" 字段 —— ESM only');
  if (!pkg.license) errors.push('缺少 license（平台统一 MIT）');
  if (pkg.name && !NAMING.pattern.test(pkg.name)) warnings.push(`技能名 "${pkg.name}" 建议用 skill-/fmode- 前缀`);

  return { ok: errors.length === 0, errors, warnings };
}

/** 校验 skill-package-manifest.json（纯函数） */
export function validateManifest(manifest) {
  const errors = [];
  const warnings = [];
  if (!manifest || typeof manifest !== 'object') return { ok: false, errors: ['不是对象'], warnings };
  for (const f of ['name', 'version', 'description', 'skills']) {
    if (!manifest[f]) errors.push(`缺少必需字段：${f}`);
  }
  if (manifest.skills !== undefined && (!Array.isArray(manifest.skills) || !manifest.skills.length)) {
    errors.push('"skills" 必须是非空数组');
  }
  if (!manifest.install) warnings.push('建议声明 "install" 字段');
  return { ok: errors.length === 0, errors, warnings };
}

/** 极简 YAML frontmatter 解析（纯函数，无依赖） */
export function parseFrontmatter(text) {
  if (typeof text !== 'string') return { data: {}, body: '', raw: null };
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text, raw: null };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf(':');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      data[k] = v.slice(1, -1);
    } else if (v.startsWith('[') && v.endsWith(']')) {
      data[k] = v.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
    } else {
      data[k] = v;
    }
  }
  return { data, body: text.slice(m[0].length), raw: m[1] };
}

export const FRONTMATTER_SCHEMAS = {
  hermes: { key: 'hermes', label: 'Hermes 本地技能格式', required: ['name', 'description', 'version'], recommended: ['tags', 'license', 'author'] },
  skillhub: { key: 'skillhub', label: 'skillhub.cn 格式', required: ['slug', 'displayName', 'version', 'summary', 'license'], recommended: ['tags'] },
};

/** 校验 frontmatter */
export function validateFrontmatter(text, format = 'hermes') {
  const schema = FRONTMATTER_SCHEMAS[format];
  const errors = [];
  const warnings = [];
  if (!schema) return { ok: false, data: {}, errors: [`未知格式：${format}`], warnings };
  const { data, raw } = parseFrontmatter(text);
  if (raw === null) return { ok: false, data: {}, errors: ['未找到 YAML frontmatter'], warnings };
  for (const f of schema.required) if (data[f] === undefined || data[f] === '') errors.push(`缺少必需字段：${f}`);
  for (const f of schema.recommended) if (data[f] === undefined) warnings.push(`建议补充：${f}`);
  return { ok: errors.length === 0, data, errors, warnings };
}

// ============================================================
// 浏览器可跑的质检子集
// ============================================================

/**
 * 浏览器版 API 联通检查（只用 fetch，无 Node 依赖）。
 * @param {{token?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<{id: string, title: string, status: 'pass'|'fail'|'skip', detail: string, evidence: string[]}>}
 */
export async function checkApiConnectivity(opts = {}) {
  const evidence = [];
  const headers = opts.token ? { Authorization: `Bearer ${opts.token}` } : {};

  const probe = async (url, method = 'GET') => {
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: method === 'POST' ? '{}' : undefined,
        signal: AbortSignal.timeout(opts.timeoutMs || 12000),
      });
      return { ok: true, status: res.status };
    } catch (err) {
      return { ok: false, status: 0, error: err.message };
    }
  };

  const llm = await probe(ENDPOINTS.llmChat.url, 'POST');
  evidence.push(`POST ${ENDPOINTS.llmChat.url} → HTTP ${llm.status}`);

  if (!llm.ok) {
    return { id: 'apiConnectivity', title: 'Fmode API 联通', status: 'skip', detail: '网络不可达（可能是 CORS 或离线）', evidence };
  }
  if (llm.status !== 200 && llm.status !== 401) {
    return { id: 'apiConnectivity', title: 'Fmode API 联通', status: 'fail', detail: `LLM 网关返回 ${llm.status}`, evidence };
  }

  const gw = await probe(ENDPOINTS.listenTranscribe.url, 'POST');
  evidence.push(`POST ${ENDPOINTS.listenTranscribe.url} → HTTP ${gw.status}`);
  if (!gw.ok) {
    return { id: 'apiConnectivity', title: 'Fmode API 联通', status: 'skip', detail: '业务网关不可达（浏览器端可能被 CORS 拦截，属正常）', evidence };
  }

  return {
    id: 'apiConnectivity',
    title: 'Fmode API 联通',
    status: 'pass',
    detail: 'LLM 网关与业务网关均可达（401=端点存在需鉴权）',
    evidence,
  };
}

/**
 * 浏览器可跑的全量检查（当前仅网络类）。
 * @param {object} [opts]
 */
export async function runBrowserChecks(opts = {}) {
  const results = [await checkApiConnectivity(opts)];
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const skip = results.filter((r) => r.status === 'skip').length;
  return {
    results,
    summary: { total: results.length, pass, fail, skip, ok: fail === 0 && skip === 0, partial: fail === 0 && skip > 0 },
  };
}

/** 供浏览器端展示的技能清单摘要（不依赖 Node） */
export const INVENTORY_SUMMARY = {
  total: 16,
  byTier: { system: 7, service: 6, application: 3 },
  byPlatform: { gogs: 11, github: 12, npm: 8, skillhub: 1 },
  note: '完整清单见仓库 inventory.md 或 lib/inventory.mjs；skillhub 渠道企业 key 失效待补发',
};

export default {
  VERSION,
  PLATFORM,
  ENDPOINTS,
  RUNTIMES,
  TIERS,
  CHANNELS,
  CREDENTIAL_CHAIN,
  validateName,
  validatePackageJson,
  validateManifest,
  validateFrontmatter,
  parseFrontmatter,
  checkApiConnectivity,
  runBrowserChecks,
};
