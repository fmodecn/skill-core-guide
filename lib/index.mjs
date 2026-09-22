/**
 * skill-core-guide — Fmode Harness 平台母技能 · ESM 入口
 * ---------------------------------------------------------------------------
 * 导出平台常量、端点真值表、ESM-first 校验器、技能清单与六项质检引擎。
 *
 * 设计纪律：
 *   1. 零依赖（no dependencies）—— 母技能必须能在任何 Node ≥18 环境裸跑。
 *   2. 纯 ESM —— 无 CJS 入口（团队共识）。
 *   3. 浏览器安全子集在 browser/index.mjs；本文件允许 import node: 内置模块。
 *
 * @example
 *   import { PLATFORM, ENDPOINTS, validatePackage, CHECKS } from 'skill-core-guide';
 *   const r = await validatePackage('./my-skill');
 *   console.log(r.ok, r.errors);
 */

export const VERSION = '1.0.1';
export const SKILL_NAME = 'skill-core-guide';

// 本地绑定：供本文件内的 CHANNELS / publishPlan 等使用
// （注意：`export ... from` 只转发、不产生本地绑定，故需显式 import）
import { PLATFORM, PACKAGE_RULES } from './platform.mjs';

// ---------- 平台真值源 ----------
export {
  PLATFORM,
  ENDPOINTS,
  endpointsByStatus,
  CREDENTIAL_CHAIN,
  TOKEN_RULES,
  TIERS,
  RUNTIMES,
  REQUIRED_LAYOUT,
  PACKAGE_RULES,
} from './platform.mjs';

// ---------- 质检引擎 ----------
export {
  CHECKS,
  CHECKS_BY_ID,
  runChecks,
  checkFunctional,
  checkApiConnectivity,
  checkSop,
  checkDashboard,
  checkLoop,
  checkMultiRuntime,
  summarize,
  renderReport,
} from './check.mjs';

// ---------- 凭证供给 ----------
export {
  resolveSessionToken,
  resolveApiToken,
  resolveFmodeDir,
  resolveConfigPath,
  validateToken,
  fetchApiTokenFromSession,
  ensureFmodeDir,
  writeConfig,
  writeCredential,
  requestVerifyCode,
  verifyAndProvision,
  bootstrap,
  describeBootstrapStatus,
  maskToken,
} from './bootstrap.mjs';

// ---------- 技能清单 ----------
export { INVENTORY, byTier, byPlatform, stats } from './inventory.mjs';

// ============================================================
// 技能分类与命名规则
// ============================================================

/** 技能命名规则：必须以 skill- 前缀（平台约定） */
export const NAMING = {
  prefix: 'skill-',
  /** npm 上部分技能以 fmode- 前缀发布（历史兼容），两者均合法 */
  altPrefix: 'fmode-',
  pattern: /^(skill|fmode)-[a-z0-9]+(-[a-z0-9]+)*$/,
  /** skillhub.cn 上的 slug 规则 */
  slugPattern: /^fmode-skill-[a-z0-9]+(-[a-z0-9]+)*$/,
};

/**
 * 校验技能名是否符合平台命名规范。
 * @param {string} name
 * @returns {{ok: boolean, reason?: string, slug?: string}}
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { ok: false, reason: '技能名不能为空' };
  }
  if (!NAMING.pattern.test(name)) {
    return {
      ok: false,
      reason: `技能名 "${name}" 不符合规范：须为 skill-<kebab-case> 或 fmode-<kebab-case>（仅小写字母、数字、连字符）`,
    };
  }
  return { ok: true, slug: `fmode-${name}` };
}

// ============================================================
// 包结构 / package.json 校验器
// ============================================================

/**
 * 校验 package.json 是否符合 ESM-first 多端标准。
 * 纯函数——不触碰文件系统，可在浏览器中运行。
 *
 * @param {object} pkg 已解析的 package.json 对象
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function validatePackageJson(pkg) {
  const errors = [];
  const warnings = [];

  if (!pkg || typeof pkg !== 'object') {
    return { ok: false, errors: ['package.json 无法解析或不是对象'], warnings };
  }

  for (const f of PACKAGE_RULES.requiredFields) {
    if (pkg[f] === undefined || pkg[f] === null || pkg[f] === '') {
      errors.push(`缺少必需字段：${f}`);
    }
  }

  if (pkg.type !== PACKAGE_RULES.type) {
    errors.push(`"type" 必须是 "${PACKAGE_RULES.type}"（当前：${JSON.stringify(pkg.type)}）—— ESM only`);
  }

  if (pkg.main !== PACKAGE_RULES.main) {
    errors.push(`"main" 必须是 "${PACKAGE_RULES.main}"（当前：${JSON.stringify(pkg.main)}）`);
  }

  // exports['.'] 必须同时提供 import 与 default
  const dot = pkg.exports && pkg.exports['.'];
  if (!dot) {
    errors.push('"exports" 缺少 "." 入口');
  } else if (typeof dot === 'string') {
    warnings.push('"exports[\".\"]" 是字符串简写；建议显式写成 { import, default } 以对齐四端标准');
  } else {
    for (const cond of PACKAGE_RULES.exportConditions) {
      if (!dot[cond]) errors.push(`"exports[\".\"]" 缺少 "${cond}" 条件`);
    }
  }

  // bin 必须是对象且指向 .mjs
  if (pkg.bin && typeof pkg.bin === 'object') {
    const entries = Object.entries(pkg.bin);
    if (entries.length === 0) errors.push('"bin" 为空对象');
    for (const [cmd, target] of entries) {
      if (!String(target).endsWith('.mjs')) {
        warnings.push(`bin["${cmd}"] 指向 ${target}，建议使用 .mjs 扩展名以对齐 ESM 标准`);
      }
    }
  } else if (pkg.bin) {
    warnings.push('"bin" 建议使用对象形式 { "<cmd>": "./bin/<name>.mjs" }');
  }

  // files 白名单覆盖度
  if (Array.isArray(pkg.files)) {
    for (const need of PACKAGE_RULES.filesMustInclude) {
      if (!pkg.files.some((f) => f === need || f === need.replace(/\/$/, ''))) {
        warnings.push(`"files" 白名单建议包含 "${need}"（避免发布缺文件）`);
      }
    }
  } else {
    warnings.push('建议声明 "files" 白名单，避免把 test/ 与临时文件发到 npm');
  }

  // ESM-only 纪律：不应有 require 字段
  for (const f of PACKAGE_RULES.forbiddenFields) {
    if (pkg[f] !== undefined) {
      errors.push(`不应出现 "${f}" 字段 —— 本平台 ESM only，不提供 CJS 入口`);
    }
  }

  // 命名规范
  if (pkg.name) {
    const n = validateName(pkg.name);
    if (!n.ok) warnings.push(n.reason);
  }

  if (!pkg.license) errors.push('缺少 "license"（平台统一 MIT）');

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * 校验 skill-package-manifest.json 的结构。
 * @param {object} manifest
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function validateManifest(manifest) {
  const errors = [];
  const warnings = [];

  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, errors: ['skill-package-manifest.json 无法解析'], warnings };
  }

  for (const f of ['name', 'version', 'description', 'skills']) {
    if (!manifest[f]) errors.push(`清单缺少必需字段：${f}`);
  }

  if (manifest.skills !== undefined) {
    if (!Array.isArray(manifest.skills) || manifest.skills.length === 0) {
      errors.push('"skills" 必须是非空数组');
    } else {
      manifest.skills.forEach((s, i) => {
        if (!s || typeof s !== 'object') {
          errors.push(`skills[${i}] 不是对象`);
          return;
        }
        for (const f of ['name', 'path']) {
          if (!s[f]) errors.push(`skills[${i}] 缺少 "${f}"`);
        }
        if (s.path && !String(s.path).endsWith('SKILL.md')) {
          warnings.push(`skills[${i}].path 建议指向 SKILL.md（当前：${s.path}）`);
        }
      });
    }
  }

  if (!manifest.install) {
    warnings.push('建议声明 "install" 字段（如 "npx --yes <skill>@latest workspace"）');
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ============================================================
// SKILL.md frontmatter 解析与校验（三种格式）
// ============================================================

/**
 * 极简 YAML frontmatter 解析器（零依赖）。
 * 仅支持平台技能用到的子集：标量、行内数组 [a, b]、引号字符串。
 *
 * @param {string} text SKILL.md 全文
 * @returns {{data: Record<string, unknown>, body: string, raw: string|null}}
 */
export function parseFrontmatter(text) {
  if (typeof text !== 'string') return { data: {}, body: '', raw: null };
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text, raw: null };

  const raw = m[1];
  const body = text.slice(m[0].length);
  const data = {};

  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const idx = t.indexOf(':');
    if (idx <= 0) continue;
    const key = t.slice(0, idx).trim();
    let val = t.slice(idx + 1).trim();

    // 去引号
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else if (val.startsWith('[') && val.endsWith(']')) {
      data[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
      continue;
    }
    data[key] = val;
  }

  return { data, body, raw };
}

/** 三种 frontmatter 格式的必需字段 */
export const FRONTMATTER_SCHEMAS = {
  /** Hermes 本地技能格式 */
  hermes: {
    key: 'hermes',
    label: 'Hermes 本地技能格式',
    required: ['name', 'description', 'version'],
    recommended: ['tags', 'license', 'author'],
  },
  /** skillhub.cn 格式 */
  skillhub: {
    key: 'skillhub',
    label: 'skillhub.cn 格式',
    required: ['slug', 'displayName', 'version', 'summary', 'license'],
    recommended: ['tags'],
  },
  /** GitHub/Gogs README 格式（无 frontmatter，用标题结构校验） */
  readme: {
    key: 'readme',
    label: 'GitHub/Gogs README 格式',
    required: [],
    recommended: [],
  },
};

/**
 * 校验 frontmatter 是否符合指定格式。
 * @param {string} text
 * @param {'hermes'|'skillhub'} format
 * @returns {{ok: boolean, data: object, errors: string[], warnings: string[]}}
 */
export function validateFrontmatter(text, format = 'hermes') {
  const schema = FRONTMATTER_SCHEMAS[format];
  const errors = [];
  const warnings = [];

  if (!schema) {
    return { ok: false, data: {}, errors: [`未知的 frontmatter 格式：${format}`], warnings };
  }

  const { data, raw } = parseFrontmatter(text);
  if (raw === null) {
    return { ok: false, data: {}, errors: [`未找到 YAML frontmatter（文件须以 --- 开头）`], warnings };
  }

  for (const f of schema.required) {
    if (data[f] === undefined || data[f] === '') errors.push(`frontmatter 缺少必需字段：${f}`);
  }
  for (const f of schema.recommended) {
    if (data[f] === undefined) warnings.push(`frontmatter 建议补充：${f}`);
  }

  if (format === 'skillhub' && data.slug) {
    if (!NAMING.slugPattern.test(String(data.slug))) {
      warnings.push(`slug "${data.slug}" 建议符合 fmode-skill-<kebab-case>（当前团队 slug 规范）`);
    }
  }
  if (format === 'hermes' && data.name) {
    const n = validateName(String(data.name));
    if (!n.ok) warnings.push(n.reason);
  }

  return { ok: errors.length === 0, data, errors, warnings };
}

// ============================================================
// 分发渠道
// ============================================================

export const CHANNELS = {
  gogs: {
    key: 'gogs',
    label: 'Gogs（主仓 · 内网日常迭代）',
    remote: 'origin',
    url: (name) => `${PLATFORM.gogsBase}/${PLATFORM.gogsOrg}/${name}.git`,
    addRemote: (name) =>
      `git remote add origin ${PLATFORM.gogsBase}/${PLATFORM.gogsOrg}/${name}.git`,
    push: 'git push origin master',
    note: '凭据通过 URL 携带（内网 Gogs 的 /api/v1 未开放匿名访问，建仓需走 Web UI 或已登录会话）。',
  },
  github: {
    key: 'github',
    label: 'GitHub（公开镜像）',
    remote: 'github',
    url: (name) => `git@github.com:${PLATFORM.githubOrg}/${name}.git`,
    addRemote: (name) => `git remote add github git@github.com:${PLATFORM.githubOrg}/${name}.git`,
    push: 'GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_fmodecn" git push github master',
    note: 'SSH key: ~/.ssh/id_ed25519_fmodecn。GitHub 建仓可用 ~/.fmode/config.json 的 githubToken 调 REST API。',
  },
  npm: {
    key: 'npm',
    label: 'npm（SDK 分发）',
    url: (name) => `${PLATFORM.npmRegistry}/package/${name}`,
    publish: 'npm publish --access public',
    note: '账号 fmode001（凭据在 ~/.npmrc）。npm 上部分技能用 fmode- 前缀发布。',
  },
  skillhub: {
    key: 'skillhub',
    label: 'skillhub.cn（社区分发）',
    url: (slug) => `https://skillhub.cn/skill/${slug}`,
    installCli: `curl -fsSL ${PLATFORM.skillhub.cliInstall} | bash -s -- --cli-only`,
    login: `skillhub login --key <API_KEY> --host ${PLATFORM.skillhub.host}`,
    publish: (dir, changelog) =>
      `skillhub publish ${dir} --changelog "${changelog}"`,
    dryRun: (dir) => `skillhub publish ${dir} --dry-run`,
    note: 'CLI 位于 ~/.local/bin/skillhub。发布目录内必须含 SKILL.md，且 frontmatter 用 skillhub 格式（slug/displayName/summary）。',
  },
};

/** 按顺序返回四渠道发布步骤 */
export function publishPlan(name, { dir = '.', changelog = '' } = {}) {
  return [
    { channel: 'gogs', ...CHANNELS.gogs, steps: [CHANNELS.gogs.addRemote(name), CHANNELS.gogs.push] },
    { channel: 'github', ...CHANNELS.github, steps: [CHANNELS.github.addRemote(name), CHANNELS.github.push] },
    { channel: 'npm', ...CHANNELS.npm, steps: [CHANNELS.npm.publish] },
    {
      channel: 'skillhub',
      ...CHANNELS.skillhub,
      steps: [CHANNELS.skillhub.dryRun(dir), CHANNELS.skillhub.publish(dir, changelog || `release ${name}`)],
    },
  ];
}
