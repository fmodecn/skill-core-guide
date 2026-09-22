/**
 * 自动质检引擎 —— 六项检查
 * ---------------------------------------------------------------------------
 * 在新技能开发完成后运行，逐项验证「能不能真的交付」。
 *
 * 设计原则（源自平台真实事故教训）：
 *   1. **不伪造结果** —— 每项检查必须给出可复核的证据（evidence），
 *      拿不到证据就是 fail 或 skip，绝不默认 pass。
 *   2. **网络检查显式降级** —— 离线环境下标 skip 而非 fail，但 skip 会
 *      汇总进「未验证项」并影响最终 exit code（除非 --allow-skip）。
 *   3. **planned 端点不算通过** —— 端点状态取自 lib/platform.mjs 真值表；
 *      对 404 的 planned 端点做联通检查，结果是 skip 而不是 pass。
 *
 * 六项检查：
 *   1. functional      功能完整性      —— 运行 demo/test 脚本
 *   2. apiConnectivity Fmode API 联通  —— 探测 api.fmode.cn / server.fmode.cn
 *   3. sop             基础 SOP 跑通   —— skillhub publish --dry-run
 *   4. dashboard       看板后台就绪    —— skill-package-manifest.json 存在且合法
 *   5. loop            Loop 迭代能力   —— npx --yes <skill>@latest 可解析
 *   6. multiRuntime    多端可用性      —— CLI + ESM import 双通道实测
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  ENDPOINTS,
  PLATFORM,
  validatePackageJson,
  validateManifest,
  validateFrontmatter,
  parseFrontmatter,
} from './index.mjs';

// ============================================================
// 结果原语
// ============================================================

/** @typedef {'pass'|'fail'|'skip'} CheckStatus */

/**
 * @typedef {Object} CheckResult
 * @property {string} id
 * @property {string} title
 * @property {CheckStatus} status
 * @property {string} detail
 * @property {string[]} evidence  可复核的证据（命令输出片段 / 文件路径 / HTTP 码）
 * @property {string} [fix]       失败时的修复建议
 */

function pass(id, title, detail, evidence = []) {
  return { id, title, status: 'pass', detail, evidence };
}
function fail(id, title, detail, evidence = [], fix = '') {
  return { id, title, status: 'fail', detail, evidence, fix };
}
function skip(id, title, detail, evidence = [], fix = '') {
  return { id, title, status: 'skip', detail, evidence, fix };
}

// ============================================================
// 工具
// ============================================================

/** 带超时的 fetch，永不抛异常 */
async function probe(url, { method = 'GET', headers = {}, body, timeoutMs = 12000 } = {}) {
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, error: err && err.message ? err.message : String(err) };
  }
}

/** 安全读 JSON */
function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8').replace(/^﻿/, ''));
  } catch {
    return null;
  }
}

/** 判断路径是否可执行文件 */
function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

/** 定位 npx / npm 可执行文件（跨环境候选） */
function which(bin) {
  const home = os.homedir();
  const candidates = [
    path.join(home, '.local', 'bin', bin),
    path.join(home, 'bin', bin),
    `/opt/data/npm-global/bin/${bin}`,
    `/usr/local/bin/${bin}`,
    `/usr/bin/${bin}`,
  ];
  for (const c of candidates) if (exists(c)) return c;
  const r = spawnSync('which', [bin], { encoding: 'utf-8' });
  if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  return null;
}

/** 运行命令并捕获输出 */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf-8',
    timeout: opts.timeoutMs || 120000,
    cwd: opts.cwd,
    env: { ...process.env, ...(opts.env || {}) },
  });
  return {
    status: r.status,
    stdout: (r.stdout || '').trim(),
    stderr: (r.stderr || '').trim(),
    error: r.error ? r.error.message : null,
  };
}

/** 截断长输出用于 evidence */
function clip(s, n = 300) {
  if (!s) return '';
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

// ============================================================
// 检查 1：功能完整性
// ============================================================

/**
 * 运行 demo/test 脚本，验证技能功能真的跑得起来。
 * 探测顺序：package.json scripts.test → scripts.demo → test/ 下的 .mjs
 * @param {string} dir
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<CheckResult>}
 */
export async function checkFunctional(dir, opts = {}) {
  const id = 'functional';
  const title = '功能完整性';

  // 递归护栏：若本进程是被上层质检 spawn 出来的（npm test → runChecks → 本函数），
  // 再跑一次 npm test 会无限递归。此时直接跳过，由最外层负责结论。
  // 注意：护栏只看**本进程**的环境变量——由 checkFunctional 在 spawn 子进程时注入，
  // 不会污染调用方进程（早期实现在 runChecks 里设置该变量，导致父进程自身被误跳）。
  if (process.env.SKILL_CORE_CHECKING === '1') {
    return skip(
      id,
      title,
      '检测到嵌套质检调用（SKILL_CORE_CHECKING=1），跳过以避免无限递归',
      ['本项已由最外层质检运行'],
      '如需独立验证功能，直接运行 npm test 或在项目根跑 skill-core check',
    );
  }

  const pkg = readJson(path.join(dir, 'package.json'));

  if (!pkg) {
    return fail(id, title, 'package.json 不存在或无法解析，无法定位测试入口', [`${dir}/package.json`],
      '补一个合法的 package.json（type: module）');
  }

  const scripts = pkg.scripts || {};
  const evidence = [];

  // 优先 npm test
  if (scripts.test) {
    const npm = which('npm');
    if (!npm) {
      return skip(id, title, '检测到 scripts.test 但环境无 npm 可执行文件', ['scripts.test = ' + scripts.test],
        '安装 Node.js / npm 后重跑');
    }
    const r = run(npm, ['test', '--silent'], {
      cwd: dir,
      timeoutMs: opts.timeoutMs || 180000,
      env: { SKILL_CORE_CHECKING: '1' },
    });
    evidence.push(`$ npm test → exit ${r.status}`);
    if (r.stdout) evidence.push(clip(r.stdout));
    if (r.stderr) evidence.push(clip(r.stderr));
    if (r.status === 0) return pass(id, title, 'npm test 通过', evidence);
    return fail(id, title, `npm test 退出码 ${r.status}`, evidence,
      '先本地跑通 npm test 再发布；测试失败不得标记完成');
  }

  // 回落到 test/ 下的 .mjs
  const testDir = path.join(dir, 'test');
  if (exists(testDir)) {
    const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.mjs'));
    if (files.length) {
      let allOk = true;
      for (const f of files) {
        const r = run(process.execPath, [path.join('test', f)], { cwd: dir, timeoutMs: 120000 });
        evidence.push(`$ node test/${f} → exit ${r.status}`);
        if (r.status !== 0) {
          allOk = false;
          evidence.push(clip(r.stderr || r.stdout));
        }
      }
      if (allOk) return pass(id, title, `test/ 下 ${files.length} 个测试脚本全部通过`, evidence);
      return fail(id, title, 'test/ 下有脚本执行失败', evidence, '修复失败用例后重跑');
    }
  }

  return skip(id, title, '未发现测试入口（无 scripts.test，test/ 下无 .mjs）', [`${dir}/test`],
    '添加 test/smoke.mjs 并声明 scripts.test');
}

// ============================================================
// 检查 2：Fmode API 联通
// ============================================================

/**
 * 探测 Fmode 平台端点。区分 live（401/200 均算联通）与 planned（404 → skip）。
 * @param {{token?: string, offline?: boolean}} [opts]
 * @returns {Promise<CheckResult>}
 */
export async function checkApiConnectivity(opts = {}) {
  const id = 'apiConnectivity';
  const title = 'Fmode API 联通';
  const evidence = [];

  if (opts.offline) {
    return skip(id, title, '--offline 指定跳过网络检查', [], '联网后重跑以验证 API 联通');
  }

  const token = opts.token || process.env.FMODE_API_TOKEN || '';
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // 2a. LLM 网关：无 token 期望 401，有 token 期望 200
  // ⚠️ 必须用 POST 探测：该端点是 POST-only，GET 会返回 404（method not allowed），
  //    误判成「端点不存在」。这是实测踩过的坑。
  const llm = await probe(ENDPOINTS.llmChat.url, { method: 'POST', headers, body: {} });
  evidence.push(`POST ${ENDPOINTS.llmChat.url} → HTTP ${llm.status}${llm.error ? ` (${llm.error})` : ''}`);

  if (!llm.ok) {
    return skip(id, title, `无法访问 ${PLATFORM.apiBase}（网络不可达）`, evidence,
      '检查网络/DNS，或加 --offline 跳过本项');
  }

  const llmReachable = llm.status === 200 || llm.status === 401;
  if (!llmReachable) {
    return fail(id, title, `LLM 网关返回意外状态 ${llm.status}`, evidence,
      `确认 ${ENDPOINTS.llmChat.url} 可用；若平台迁移请更新 lib/platform.mjs`);
  }

  // 2b. 网关存活
  const gw = await probe(ENDPOINTS.listenTranscribe.url, {
    method: 'POST',
    headers,
    body: {},
  });
  evidence.push(`POST ${ENDPOINTS.listenTranscribe.url} → HTTP ${gw.status}${gw.error ? ` (${gw.error})` : ''}`);

  // 2c. planned 端点：探测但结论为 skip（不算通过）
  const planned = Object.values(ENDPOINTS).filter((e) => e.status !== 'live');
  const plannedNotes = [];
  for (const e of planned) {
    const p = await probe(e.url, { method: 'POST', headers, body: {} });
    plannedNotes.push(`${e.id}=${p.status}`);
  }
  evidence.push(`planned 端点探测：${plannedNotes.join(', ')}`);

  const detail = token
    ? 'LLM 网关与业务网关均可达（带 token）'
    : 'LLM 网关与业务网关均可达（匿名，401=端点存在需鉴权）';

  if (!gw.ok || (gw.status !== 401 && gw.status !== 200)) {
    evidence.push(`网关 ${ENDPOINTS.listenTranscribe.url} 状态异常：${gw.status}`);
    return fail(id, title, `业务网关返回 ${gw.status}`, evidence,
      '确认 server.fmode.cn 可用；planned 端点（storage/vision/image/verifycode）404 属预期');
  }

  return pass(id, title, detail, evidence);
}

// ============================================================
// 检查 3：基础 SOP 跑通
// ============================================================

/**
 * 校验 skillhub 发布前置条件，并在 CLI 可用时执行 --dry-run。
 * @param {string} dir
 * @returns {Promise<CheckResult>}
 */
export async function checkSop(dir) {
  const id = 'sop';
  const title = '基础 SOP 跑通';
  const evidence = [];

  // 3a. SKILL.md 存在
  const skillMd = path.join(dir, 'SKILL.md');
  if (!exists(skillMd)) {
    return fail(id, title, '根目录缺少 SKILL.md —— skillhub 发布硬性要求', [skillMd],
      '创建 SKILL.md 并使用 skillhub frontmatter（slug/displayName/version/summary/license）');
  }

  const text = fs.readFileSync(skillMd, 'utf-8');
  const { data } = parseFrontmatter(text);
  evidence.push(`SKILL.md frontmatter keys: ${Object.keys(data).join(', ') || '(无)'}`);

  // 3b. 必须满足 skillhub 格式
  const sh = validateFrontmatter(text, 'skillhub');
  if (!sh.ok) {
    // 允许 Hermes 格式 + slug 字段混用：若 hermes 格式通过则降级为 warning
    const hermes = validateFrontmatter(text, 'hermes');
    if (hermes.ok) {
      evidence.push('检测到 Hermes 格式 frontmatter（skillhub 必需字段缺失，仅作警告）');
    } else {
      return fail(id, title, `SKILL.md frontmatter 不合法：${sh.errors.join('；')}`, evidence,
        '补全 slug / displayName / version / summary / license 五个字段');
    }
  }

  // 3c. skillhub CLI 可用则跑 dry-run
  const cli = exists(PLATFORM.skillhub.cliPath.replace('~', os.homedir()))
    ? PLATFORM.skillhub.cliPath.replace('~', os.homedir())
    : which('skillhub');

  if (!cli) {
    return skip(id, title, 'skillhub CLI 未安装，无法执行 --dry-run', evidence,
      `安装：curl -fsSL ${PLATFORM.skillhub.cliInstall} | bash -s -- --cli-only`);
  }

  const r = run(cli, ['publish', dir, '--dry-run', '--json'], { timeoutMs: 120000 });
  evidence.push(`$ skillhub publish ${dir} --dry-run --json → exit ${r.status}`);
  if (r.stdout) evidence.push(clip(r.stdout, 400));
  if (r.stderr) evidence.push(clip(r.stderr, 400));

  if (r.status === 0) return pass(id, title, 'skillhub publish --dry-run 预检通过', evidence);

  // 区分「预检失败」与「CLI 环境问题」
  const combined = `${r.stdout} ${r.stderr}`;
  if (/not logged in|未登录|api key|401|unauthor/i.test(combined)) {
    return skip(id, title, 'skillhub CLI 未登录，无法完成预检', evidence,
      `登录：skillhub login --key <API_KEY> --host ${PLATFORM.skillhub.host}`);
  }

  return fail(id, title, `skillhub 预检退出码 ${r.status}`, evidence,
    '按上面的输出修正 SKILL.md / 打包内容后重跑');
}

// ============================================================
// 检查 4：看板后台就绪
// ============================================================

/**
 * 校验 skill-package-manifest.json（看板数据源）存在且结构合法。
 * @param {string} dir
 * @returns {Promise<CheckResult>}
 */
export async function checkDashboard(dir) {
  const id = 'dashboard';
  const title = '看板后台就绪';
  const file = path.join(dir, 'skill-package-manifest.json');

  if (!exists(file)) {
    return fail(id, title, '缺少 skill-package-manifest.json —— 看板无法索引本技能', [file],
      '添加 skill-package-manifest.json（name/version/description/skills[]/install）');
  }

  const m = readJson(file);
  const v = validateManifest(m);
  const evidence = [`${file} 已存在`];

  if (!v.ok) {
    evidence.push(...v.errors);
    return fail(id, title, `清单结构不合法：${v.errors.join('；')}`, evidence,
      '修正清单字段后重跑');
  }

  evidence.push(`name=${m.name} version=${m.version} skills=${m.skills.length}`);
  if (v.warnings.length) evidence.push(...v.warnings.map((w) => `warning: ${w}`));

  return pass(id, title, 'skill-package-manifest.json 存在且结构合法', evidence);
}

// ============================================================
// 检查 5：Loop 迭代能力
// ============================================================

/**
 * 验证技能可通过 npx 拉取运行（迭代闭环的前提）。
 * 默认只做「包可解析」的轻量验证（npm view），加 --deep 才真正执行 npx。
 * @param {string} dir
 * @param {{deep?: boolean, offline?: boolean}} [opts]
 * @returns {Promise<CheckResult>}
 */
export async function checkLoop(dir, opts = {}) {
  const id = 'loop';
  const title = 'Loop 迭代能力';
  const pkg = readJson(path.join(dir, 'package.json'));

  if (!pkg || !pkg.name) {
    return fail(id, title, 'package.json 缺少 name，无法验证 npx 可运行性', [], '补 name 字段');
  }

  const evidence = [`包名：${pkg.name}@${pkg.version || '0.0.0'}`];

  if (opts.offline) {
    return skip(id, title, '--offline 指定跳过', evidence, '联网后重跑');
  }

  const npm = which('npm');
  if (!npm) {
    return skip(id, title, '环境无 npm，无法验证 npx 可运行性', evidence, '安装 Node.js / npm');
  }

  // 5a. 轻量：包是否已在 registry 上（未发布属正常，标 skip）
  const view = run(npm, ['view', pkg.name, 'version'], { timeoutMs: 60000 });
  if (view.status === 0) {
    evidence.push(`npm view ${pkg.name} version → ${view.stdout}`);
  } else {
    evidence.push(`npm view ${pkg.name} version → 未找到（尚未发布到 npm）`);
  }

  if (!opts.deep) {
    if (view.status === 0) {
      return pass(id, title, `包 ${pkg.name} 已在 npm 可解析，npx 可拉取`, evidence);
    }
    return skip(id, title, `包 ${pkg.name} 尚未发布到 npm，npx 通道未验证`, evidence,
      `发布后重跑：npm publish --access public`);
  }

  // 5b. 深度：真正 npx 执行 --help
  const npx = which('npx');
  if (!npx) return skip(id, title, '环境无 npx', evidence, '安装 Node.js / npm');

  const r = run(npx, ['--yes', `${pkg.name}@latest`, '--help'], { cwd: dir, timeoutMs: 180000 });
  evidence.push(`$ npx --yes ${pkg.name}@latest --help → exit ${r.status}`);
  if (r.stdout) evidence.push(clip(r.stdout));
  if (r.stderr) evidence.push(clip(r.stderr));

  if (r.status === 0) return pass(id, title, 'npx 拉取并执行成功，迭代闭环可用', evidence);
  return fail(id, title, `npx 执行退出码 ${r.status}`, evidence,
    '确认 bin 入口有 shebang（#!/usr/bin/env node）且文件已包含在 files 白名单中');
}

// ============================================================
// 检查 6：多端可用性
// ============================================================

/**
 * 验证 CLI 与 ESM import 双通道可用。
 * @param {string} dir
 * @param {{skipExec?: boolean}} [opts]
 * @returns {Promise<CheckResult>}
 */
export async function checkMultiRuntime(dir, opts = {}) {
  const id = 'multiRuntime';
  const title = '多端可用性';
  const evidence = [];
  const pkg = readJson(path.join(dir, 'package.json'));

  if (!pkg) {
    return fail(id, title, 'package.json 无法解析', [], '修正 package.json');
  }

  // ---- 6a. ESM import ----
  const mainEntry = path.join(dir, 'lib', 'index.mjs');
  if (!exists(mainEntry)) {
    return fail(id, title, '缺少 lib/index.mjs —— SDK 端不可用', [mainEntry],
      '创建 lib/index.mjs 并 export 公共接口');
  }

  const importScript = [
    `import * as m from ${JSON.stringify(mainEntry)};`,
    `const keys = Object.keys(m);`,
    `if (!keys.length) { console.error('lib/index.mjs 没有 export 任何东西'); process.exit(1); }`,
    `console.log('ESM_OK exports=' + keys.length + ' names=' + keys.slice(0, 8).join(','));`,
  ].join('\n');

  const importRes = run(process.execPath, ['--input-type=module', '-e', importScript], {
    cwd: dir,
    timeoutMs: 60000,
  });
  evidence.push(`$ node --input-type=module -e "import(...)" → exit ${importRes.status}`);
  if (importRes.stdout) evidence.push(clip(importRes.stdout));
  if (importRes.stderr) evidence.push(clip(importRes.stderr));

  const esmOk = importRes.status === 0;

  // ---- 6b. CLI 可执行 ----
  const binField = pkg.bin;
  let binPath = null;
  if (binField && typeof binField === 'object') {
    binPath = path.join(dir, Object.values(binField)[0]);
  } else if (typeof binField === 'string') {
    binPath = path.join(dir, binField);
  }

  let cliOk = false;
  if (!binPath || !exists(binPath)) {
    evidence.push(`bin 入口不存在：${binPath || '(package.json 未声明 bin)'}`);
  } else {
    const head = fs.readFileSync(binPath, 'utf-8').slice(0, 200);
    const hasShebang = head.startsWith('#!/usr/bin/env node');
    evidence.push(`bin 入口 ${path.relative(dir, binPath)} shebang=${hasShebang ? 'ok' : '缺失'}`);

    if (opts.skipExec) {
      cliOk = hasShebang;
      evidence.push('（--skip-exec：仅静态校验，未执行）');
    } else {
      const r = run(process.execPath, [binPath, '--help'], { cwd: dir, timeoutMs: 60000 });
      evidence.push(`$ node ${path.relative(dir, binPath)} --help → exit ${r.status}`);
      if (r.stdout) evidence.push(clip(r.stdout));
      if (r.stderr) evidence.push(clip(r.stderr));
      cliOk = r.status === 0;
    }
  }

  // ---- 6c. 浏览器 bundle（可选但推荐）----
  const browserEntry = path.join(dir, 'browser', 'index.mjs');
  if (exists(browserEntry)) {
    const src = fs.readFileSync(browserEntry, 'utf-8');
    const nodeImports = [...src.matchAll(/from\s+['"]node:([a-z_]+)['"]/g)].map((m) => m[1]);
    if (nodeImports.length) {
      evidence.push(`browser/index.mjs 违规 import node: ${[...new Set(nodeImports)].join(', ')}`);
    } else {
      evidence.push('browser/index.mjs 无 node: 内置模块依赖 ✅');
    }
  } else {
    evidence.push('browser/index.mjs 不存在（浏览器端未提供，非必需）');
  }

  // ---- 6d. CJS 入口存在性（ESM only 纪律）----
  // 说明：Node 22+ 的 require(ESM) 已解禁，因此「require 能加载」不再等于「提供了 CJS 入口」。
  // 真正要检查的是：包内**没有** .cjs 文件、package.json 里**没有** require 字段。
  const cjsFiles = [];
  const scanCjs = (d, depth = 0) => {
    if (depth > 2 || !exists(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) scanCjs(p, depth + 1);
      else if (e.name.endsWith('.cjs')) cjsFiles.push(path.relative(dir, p));
    }
  };
  scanCjs(dir);
  if (cjsFiles.length) {
    evidence.push(`发现 .cjs 文件：${cjsFiles.join(', ')} —— 本平台 ESM only，不应提供 CJS 入口`);
  } else {
    evidence.push('无 .cjs 文件，符合 ESM only 约定 ✅');
  }

  if (esmOk && cliOk) {
    return pass(id, title, 'CLI + SDK(ESM) 双通道实测可用', evidence);
  }

  const failedParts = [];
  if (!esmOk) failedParts.push('SDK(ESM) import 失败');
  if (!cliOk) failedParts.push('CLI --help 执行失败');

  return fail(id, title, failedParts.join('；'), evidence,
    '修复后重跑；bin 入口需 shebang + 包含在 files 白名单，lib/index.mjs 需有 export');
}

// ============================================================
// 编排
// ============================================================

/**
 * 六项检查注册表。
 * @type {Array<{id: string, title: string, weight: number, run: (dir: string, opts: object) => Promise<CheckResult>}>}
 */
export const CHECKS = [
  { id: 'functional', title: '功能完整性', weight: 1, run: (dir, o) => checkFunctional(dir, o) },
  { id: 'apiConnectivity', title: 'Fmode API 联通', weight: 1, run: (dir, o) => checkApiConnectivity(o) },
  { id: 'sop', title: '基础 SOP 跑通', weight: 1, run: (dir, o) => checkSop(dir, o) },
  { id: 'dashboard', title: '看板后台就绪', weight: 1, run: (dir, o) => checkDashboard(dir, o) },
  { id: 'loop', title: 'Loop 迭代能力', weight: 1, run: (dir, o) => checkLoop(dir, o) },
  { id: 'multiRuntime', title: '多端可用性', weight: 1, run: (dir, o) => checkMultiRuntime(dir, o) },
];

/** 按 id 索引 */
export const CHECKS_BY_ID = Object.fromEntries(CHECKS.map((c) => [c.id, c]));

/**
 * 依次运行六项检查。
 * @param {string} dir 技能根目录
 * @param {{only?: string[], offline?: boolean, deep?: boolean, skipExec?: boolean, token?: string, onProgress?: Function}} [opts]
 * @returns {Promise<{dir: string, results: CheckResult[], summary: object}>}
 */
export async function runChecks(dir, opts = {}) {
  const abs = path.resolve(dir);
  if (!exists(abs)) {
    throw new Error(`目录不存在：${abs}`);
  }

  const selected = opts.only && opts.only.length
    ? CHECKS.filter((c) => opts.only.includes(c.id))
    : CHECKS;

  if (opts.only && opts.only.length && selected.length !== opts.only.length) {
    const known = CHECKS.map((c) => c.id).join(', ');
    const bad = opts.only.filter((o) => !CHECKS_BY_ID[o]);
    throw new Error(`未知检查项：${bad.join(', ')}（可选：${known}）`);
  }

  const results = [];
  for (const c of selected) {
    if (opts.onProgress) opts.onProgress(c.id, 'start');
    let r;
    try {
      r = await c.run(abs, opts);
    } catch (err) {
      r = fail(c.id, c.title, `检查执行异常：${err.message}`, [String(err.stack || '')].slice(0, 3),
        '这是检查器自身的异常，请上报 skill-core-guide');
    }
    results.push(r);
    if (opts.onProgress) opts.onProgress(c.id, r.status);
  }

  return { dir: abs, results, summary: summarize(results) };
}

/**
 * 汇总检查结果。
 * @param {CheckResult[]} results
 * @returns {{total: number, pass: number, fail: number, skip: number, ok: boolean, unverified: string[]}}
 */
export function summarize(results) {
  const total = results.length;
  const p = results.filter((r) => r.status === 'pass').length;
  const f = results.filter((r) => r.status === 'fail').length;
  const s = results.filter((r) => r.status === 'skip').length;
  return {
    total,
    pass: p,
    fail: f,
    skip: s,
    /** 只有「无 fail 且无 skip」才算完全通过 */
    ok: f === 0 && s === 0,
    /** 通过但存在未验证项 */
    partial: f === 0 && s > 0,
    unverified: results.filter((r) => r.status === 'skip').map((r) => r.id),
  };
}

/** 渲染人类可读报告 */
export function renderReport(report) {
  const icon = { pass: '✅', fail: '❌', skip: '⏭️ ' };
  const lines = [];
  lines.push(`\n  skill-core-guide · 自动质检报告`);
  lines.push(`  目标：${report.dir}`);
  lines.push('  ' + '─'.repeat(64));
  report.results.forEach((r, i) => {
    lines.push(`  ${icon[r.status]} ${i + 1}. ${r.title}  [${r.id}]`);
    lines.push(`      ${r.detail}`);
    for (const e of r.evidence) lines.push(`      · ${e}`);
    if (r.fix) lines.push(`      ↳ 修复：${r.fix}`);
    lines.push('');
  });
  const s = report.summary;
  lines.push('  ' + '─'.repeat(64));
  lines.push(`  结果：${s.pass} 通过 / ${s.fail} 失败 / ${s.skip} 未验证（共 ${s.total} 项）`);
  if (s.unverified.length) lines.push(`  未验证项：${s.unverified.join(', ')}`);
  lines.push(`  结论：${s.ok ? '✅ 全部通过' : s.partial ? '⚠️  通过但有未验证项' : '❌ 存在失败项'}`);
  lines.push('');
  return lines.join('\n');
}

export default { CHECKS, runChecks, summarize, renderReport };
