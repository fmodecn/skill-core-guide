#!/usr/bin/env node
/**
 * skill-core — Fmode Harness 平台母技能 CLI
 * ---------------------------------------------------------------------------
 * 命令：
 *   skill-core init [dir]        从 templates/skill-starter 脚手架创建新技能
 *   skill-core check [dir]       运行六项自动质检
 *   skill-core publish [dir]     生成四渠道发布计划（--dry-run 默认）
 *   skill-core verify [dir]      静态校验包结构 / package.json / SKILL.md
 *   skill-core inventory         输出技能清单（--json 机器可读）
 *   skill-core bootstrap         一键凭证供给（检查 ~/.fmode/）
 *   skill-core spec              输出平台规范摘要
 *   skill-core endpoints         输出端点真值表（含实测状态）
 *
 * 全局参数：
 *   --json          机器可读输出
 *   --offline       跳过所有网络检查
 *   --help, -h      帮助
 *   --version, -v   版本
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  VERSION,
  PLATFORM,
  ENDPOINTS,
  endpointsByStatus,
  CHECKS,
  runChecks,
  renderReport,
  publishPlan,
  CHANNELS,
  RUNTIMES,
  CREDENTIAL_CHAIN,
  TIERS,
  validatePackageJson,
  validateManifest,
  validateFrontmatter,
  validateName,
  INVENTORY,
  byTier,
  stats,
} from '../lib/index.mjs';

import {
  bootstrap,
  describeBootstrapStatus,
  resolveFmodeDir,
  resolveConfigPath,
} from '../lib/bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(__dirname, '..');
const TEMPLATE_DIR = path.join(PKG_ROOT, 'templates', 'skill-starter');

// ============================================================
// 参数解析（零依赖）
// ============================================================

function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') {
      positional.push(...argv.slice(i + 1));
      break;
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        flags[a.slice(2, eq)] = a.slice(eq + 1);
      } else {
        const key = a.slice(2);
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
          flags[key] = next;
          i++;
        } else {
          flags[key] = true;
        }
      }
    } else if (a.startsWith('-') && a.length > 1) {
      for (const c of a.slice(1)) flags[c] = true;
    } else {
      positional.push(a);
    }
  }
  return { flags, positional };
}

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `${code}${s}${C.reset}` : s);

// ============================================================
// 帮助
// ============================================================

function printHelp() {
  const out = `
${c(C.bold, 'skill-core')} · Fmode Harness 平台母技能 CLI  v${VERSION}

${c(C.bold, '用法')}
  skill-core <command> [dir] [options]

${c(C.bold, '命令')}
  ${c(C.cyan, 'init')} [dir]        从脚手架创建新技能（默认交互式询问技能名）
  ${c(C.cyan, 'check')} [dir]       运行六项自动质检（默认当前目录）
  ${c(C.cyan, 'publish')} [dir]     生成四渠道发布计划并预检
  ${c(C.cyan, 'verify')} [dir]      静态校验包结构 / package.json / SKILL.md / manifest
  ${c(C.cyan, 'inventory')}         输出已发布技能清单
  ${c(C.cyan, 'bootstrap')}         一键凭证供给：检查并初始化 ~/.fmode/
  ${c(C.cyan, 'spec')}              输出平台规范摘要（ESM-first / 四渠道 / 凭据链）
  ${c(C.cyan, 'endpoints')}         输出端点真值表（含 2026-09-22 实测状态）

${c(C.bold, '选项')}
  --json            机器可读 JSON 输出
  --offline         跳过网络检查（对应项标记为 skip）
  --deep            check/loop：真正执行 npx 拉取验证
  --only <ids>      仅运行指定检查项，逗号分隔
  --skip-exec       check/multiRuntime：只做静态校验不执行
  --name <n>        init：指定技能名（跳过交互）
  --dry-run         publish：只打印计划不执行（默认行为）
  --apply           publish：实际执行发布命令
  -h, --help        显示帮助
  -v, --version     显示版本

${c(C.bold, '示例')}
  skill-core init my-skill --name skill-my-skill
  skill-core check . --only functional,multiRuntime
  skill-core check . --offline
  skill-core publish . --apply
  skill-core bootstrap --json

${c(C.bold, '六项质检')}
${CHECKS.map((ch, i) => `  ${i + 1}. ${ch.title.padEnd(14)} ${c(C.dim, ch.id)}`).join('\n')}
`;
  console.log(out);
}

// ============================================================
// init —— 脚手架
// ============================================================

/** 递归复制模板目录，替换文件名与内容中的占位符 */
function copyTemplate(srcDir, destDir, replacements) {
  const written = [];
  // 占位符替换：skillName → __SKILL_NAME__，cliName → __CLI_NAME__，displayName → __DISPLAY_NAME__
  // （camelCase → SCREAMING_SNAKE_CASE）
  const subst = (s) => {
    let out = s;
    for (const [k, v] of Object.entries(replacements)) {
      const token = k.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();
      out = out.replace(new RegExp(`__${token}__`, 'g'), v);
    }
    return out;
  };

  const walk = (src, dest) => {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      const s = path.join(src, entry.name);
      const d = path.join(dest, subst(entry.name));
      if (entry.isDirectory()) {
        walk(s, d);
      } else {
        fs.writeFileSync(d, subst(fs.readFileSync(s, 'utf-8')));
        written.push(d);
      }
    }
  };
  walk(srcDir, destDir);
  return written;
}

async function cmdInit(flags, positional) {
  let targetDir = positional[0];
  let skillName = flags.name;

  if (!skillName) {
    if (!process.stdin.isTTY) {
      console.error(c(C.red, '✗ 非交互环境必须用 --name 指定技能名'));
      console.error('  例：skill-core init my-skill --name skill-my-skill');
      process.exit(2);
    }
    const rl = (await import('node:readline/promises')).createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    skillName = (await rl.question('技能名（如 skill-my-thing）: ')).trim();
    if (!targetDir) {
      targetDir = (await rl.question(`目标目录（回车默认 ./${skillName}）: `)).trim() || `./${skillName}`;
    }
    rl.close();
  }

  if (!targetDir) targetDir = `./${skillName}`;

  const nv = validateName(skillName);
  if (!nv.ok) {
    console.error(c(C.red, `✗ ${nv.reason}`));
    process.exit(2);
  }

  if (!fs.existsSync(TEMPLATE_DIR)) {
    console.error(c(C.red, `✗ 脚手架模板缺失：${TEMPLATE_DIR}`));
    console.error('  请重新安装：npm install skill-core-guide@latest');
    process.exit(2);
  }

  const abs = path.resolve(targetDir);
  if (fs.existsSync(abs) && fs.readdirSync(abs).length > 0) {
    console.error(c(C.red, `✗ 目标目录已存在且非空：${abs}`));
    console.error('  为安全起见不覆盖已有内容，请换一个目录。');
    process.exit(2);
  }

  const cliName = skillName.replace(/^skill-/, '');
  const written = copyTemplate(TEMPLATE_DIR, abs, {
    skillName,
    cliName,
    displayName: flags.display || skillName,
    summary: flags.summary || `${skillName} —— 由 skill-core-guide 脚手架生成`,
  });

  const rel = written.map((f) => path.relative(abs, f)).sort();

  if (flags.json) {
    console.log(JSON.stringify({ ok: true, dir: abs, skillName, files: rel }, null, 2));
    return 0;
  }

  console.log(`\n  ${c(C.green, '✅')} 技能脚手架已创建：${c(C.bold, abs)}`);
  console.log(`  技能名：${skillName}    CLI 名：${cliName}\n`);
  console.log(`  ${c(C.bold, '生成的文件')}`);
  for (const f of rel) console.log(`    ${f}`);
  console.log(`
  ${c(C.bold, '下一步')}
    cd ${targetDir}
    git init && git config user.email "liu@fmode.cn" && git config user.name "liuyuyang"
    ${c(C.dim, `# 1) 编辑 skills/${skillName}/SKILL.md —— 写清触发场景与用法`)}
    ${c(C.dim, '# 2) 实现 lib/index.mjs —— export 公共接口')}
    ${c(C.dim, `# 3) 实现 bin/${cliName}.mjs —— CLI 入口`)}
    npm test
    skill-core check .          ${c(C.dim, '# 六项质检')}
    skill-core publish . --apply
`);
  return 0;
}

// ============================================================
// check —— 六项质检
// ============================================================

async function cmdCheck(flags, positional) {
  const dir = path.resolve(positional[0] || '.');
  const only = flags.only ? String(flags.only).split(',').map((s) => s.trim()).filter(Boolean) : undefined;

  const opts = {
    offline: !!flags.offline,
    deep: !!flags.deep,
    skipExec: !!flags['skip-exec'],
    only,
    token: process.env.FMODE_API_TOKEN,
    onProgress: flags.json
      ? undefined
      : (id, st) => {
          if (st === 'start') process.stderr.write(c(C.dim, `  … ${id}\n`));
        },
  };

  let report;
  try {
    report = await runChecks(dir, opts);
  } catch (err) {
    console.error(c(C.red, `✗ ${err.message}`));
    process.exit(2);
  }

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderReport(report));
  }

  const s = report.summary;
  if (s.fail > 0) return 1;
  if (s.skip > 0 && !flags['allow-skip']) return 3; // 未验证项需显式放行
  return 0;
}

// ============================================================
// verify —— 静态校验
// ============================================================

function cmdVerify(flags, positional) {
  const dir = path.resolve(positional[0] || '.');
  const result = { dir, ok: true, checks: [] };

  const add = (name, v) => {
    result.checks.push({ name, ...v });
    if (!v.ok) result.ok = false;
  };

  // package.json
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    add('package.json', { ok: false, errors: ['文件不存在'], warnings: [] });
  } else {
    let pkg = null;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8').replace(/^﻿/, ''));
    } catch (e) {
      add('package.json', { ok: false, errors: [`JSON 解析失败：${e.message}`], warnings: [] });
    }
    if (pkg) add('package.json', validatePackageJson(pkg));
  }

  // manifest
  const mPath = path.join(dir, 'skill-package-manifest.json');
  if (!fs.existsSync(mPath)) {
    add('skill-package-manifest.json', { ok: false, errors: ['文件不存在'], warnings: [] });
  } else {
    try {
      const m = JSON.parse(fs.readFileSync(mPath, 'utf-8').replace(/^﻿/, ''));
      add('skill-package-manifest.json', validateManifest(m));
    } catch (e) {
      add('skill-package-manifest.json', { ok: false, errors: [`JSON 解析失败：${e.message}`], warnings: [] });
    }
  }

  // SKILL.md（根目录，skillhub 格式）
  const sPath = path.join(dir, 'SKILL.md');
  if (!fs.existsSync(sPath)) {
    add('SKILL.md', { ok: false, errors: ['文件不存在'], warnings: [] });
  } else {
    const text = fs.readFileSync(sPath, 'utf-8');
    const sh = validateFrontmatter(text, 'skillhub');
    const hm = validateFrontmatter(text, 'hermes');
    // 任一格式合法即算通过（两格式用途不同）
    add('SKILL.md', {
      ok: sh.ok || hm.ok,
      format: sh.ok ? 'skillhub' : hm.ok ? 'hermes' : null,
      errors: sh.ok || hm.ok ? [] : [...sh.errors],
      warnings: [...sh.warnings, ...hm.warnings],
    });
  }

  // 必需文件
  const required = ['lib/index.mjs', 'README.md', 'LICENSE'];
  const missing = required.filter((f) => !fs.existsSync(path.join(dir, f)));
  add('必需文件', { ok: missing.length === 0, errors: missing.map((f) => `缺少 ${f}`), warnings: [] });

  // bin 入口
  let pkgObj = null;
  try {
    pkgObj = JSON.parse(fs.readFileSync(pkgPath, 'utf-8').replace(/^﻿/, ''));
  } catch {
    /* handled above */
  }
  if (pkgObj && pkgObj.bin) {
    const binRel = typeof pkgObj.bin === 'string' ? pkgObj.bin : Object.values(pkgObj.bin)[0];
    const bp = path.join(dir, binRel);
    if (!fs.existsSync(bp)) {
      add('bin 入口', { ok: false, errors: [`${binRel} 不存在`], warnings: [] });
    } else {
      const head = fs.readFileSync(bp, 'utf-8').slice(0, 60);
      add('bin 入口', {
        ok: head.startsWith('#!/usr/bin/env node'),
        errors: head.startsWith('#!/usr/bin/env node') ? [] : ['缺少 #!/usr/bin/env node shebang'],
        warnings: [],
      });
    }
  }

  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n  ${c(C.bold, '静态校验')}  ${dir}\n  ${'─'.repeat(60)}`);
    for (const ch of result.checks) {
      const icon = ch.ok ? c(C.green, '✅') : c(C.red, '❌');
      const extra = ch.format ? c(C.dim, ` (${ch.format} frontmatter)`) : '';
      console.log(`  ${icon} ${ch.name}${extra}`);
      for (const e of ch.errors || []) console.log(`      ${c(C.red, '✗')} ${e}`);
      for (const w of ch.warnings || []) console.log(`      ${c(C.yellow, '!')} ${w}`);
    }
    console.log(`  ${'─'.repeat(60)}`);
    console.log(`  结论：${result.ok ? c(C.green, '✅ 通过') : c(C.red, '❌ 未通过')}\n`);
  }

  return result.ok ? 0 : 1;
}

// ============================================================
// publish —— 四渠道发布
// ============================================================

async function cmdPublish(flags, positional) {
  const dir = path.resolve(positional[0] || '.');
  const pkgPath = path.join(dir, 'package.json');
  let name = path.basename(dir);
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8').replace(/^﻿/, ''));
    if (pkg.name) name = pkg.name;
  } catch {
    /* 用目录名兜底 */
  }

  const changelog = flags.changelog || `release ${name} v${flags.version || ''}`.trim();
  const plan = publishPlan(name, { dir, changelog });
  const apply = !!flags.apply;

  if (flags.json) {
    console.log(JSON.stringify({ name, dir, apply, plan }, null, 2));
  } else {
    console.log(`\n  ${c(C.bold, '四渠道发布计划')}  ${c(C.cyan, name)}\n  ${'─'.repeat(64)}`);
    plan.forEach((p, i) => {
      console.log(`  ${i + 1}. ${c(C.bold, p.label)}`);
      for (const s of p.steps) console.log(`     ${c(C.dim, '$')} ${s}`);
      if (p.note) console.log(`     ${c(C.dim, '↳ ' + p.note)}`);
      console.log('');
    });
    console.log(`  ${'─'.repeat(64)}`);
  }

  if (!apply) {
    if (!flags.json) {
      console.log(`  ${c(C.yellow, '⚠️  dry-run 模式')} —— 未执行任何发布命令。`);
      console.log(`  加 ${c(C.bold, '--apply')} 实际执行（需已配置各渠道凭据）。\n`);
    }
    return 0;
  }

  // 实际执行：仅执行「安全可重入」的步骤，建仓等不可逆操作交由用户
  const { spawnSync } = await import('node:child_process');
  const results = [];
  for (const step of plan[0].steps) {
    const r = spawnSync('bash', ['-c', step], { cwd: dir, encoding: 'utf-8', timeout: 300000 });
    results.push({ cmd: step, status: r.status, stderr: (r.stderr || '').slice(-300) });
  }
  console.log(JSON.stringify(results, null, 2));
  return results.some((r) => r.status !== 0) ? 1 : 0;
}

// ============================================================
// inventory
// ============================================================

function cmdInventory(flags) {
  if (flags.json) {
    console.log(JSON.stringify({ stats: stats(), skills: INVENTORY }, null, 2));
    return 0;
  }

  const grouped = byTier();
  const s = stats();
  console.log(`\n  ${c(C.bold, 'Fmode 技能清单')}  共 ${s.total} 个\n  ${'─'.repeat(76)}`);

  for (const [key, tier] of Object.entries(TIERS)) {
    const list = grouped[key] || [];
    console.log(`\n  ${c(C.bold, tier.label)}  ${c(C.dim, `(${list.length})`)}`);
    for (const sk of list) {
      const marks = sk.platforms.join('/');
      console.log(`    ${c(C.cyan, sk.name.padEnd(24))} ${sk.displayName}`);
      console.log(`      ${c(C.dim, marks.padEnd(26))} ${sk.summary.slice(0, 72)}${sk.summary.length > 72 ? '…' : ''}`);
      if (sk.npmName) console.log(`      ${c(C.dim, `npm: ${sk.npmName}@${sk.npmVersion || '?'}`)}`);
    }
  }

  console.log(`\n  ${'─'.repeat(76)}`);
  console.log(`  渠道分布：${Object.entries(s.byPlatform).map(([k, v]) => `${k}=${v}`).join('  ')}\n`);
  return 0;
}

// ============================================================
// bootstrap
// ============================================================

async function cmdBootstrap(flags) {
  const report = await bootstrap({
    phone: flags.phone,
    code: flags.code,
    cwd: process.cwd(),
  });

  if (flags.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(describeBootstrapStatus(report));
  }
  return report.ok ? 0 : 1;
}

// ============================================================
// spec
// ============================================================

function cmdSpec(flags) {
  const spec = {
    platform: PLATFORM,
    runtimes: RUNTIMES,
    credentialChain: CREDENTIAL_CHAIN,
    channels: Object.keys(CHANNELS),
    checks: CHECKS.map((c) => ({ id: c.id, title: c.title })),
    tiers: TIERS,
  };
  if (flags.json) {
    console.log(JSON.stringify(spec, null, 2));
    return 0;
  }

  console.log(`\n  ${c(C.bold, 'Fmode Harness 平台规范摘要')}\n  ${'─'.repeat(68)}`);
  console.log(`\n  ${c(C.bold, '① 四端可用性（ESM-first）')}`);
  for (const r of Object.values(RUNTIMES)) {
    const icon = r.supported ? c(C.green, '✅') : c(C.red, '❌');
    console.log(`    ${icon} ${r.label.padEnd(20)} ${r.usage}`);
    if (r.constraint) console.log(`        ${c(C.dim, r.constraint)}`);
  }
  console.log(`\n  ${c(C.bold, '② 凭据解析链（5 级，命中即用）')}`);
  for (const l of CREDENTIAL_CHAIN) {
    console.log(`    ${l.level}. ${l.source.padEnd(20)} ${c(C.dim, l.detail.slice(0, 60))}${l.detail.length > 60 ? '…' : ''}`);
  }
  console.log(`\n  ${c(C.bold, '③ 四渠道分发')}`);
  for (const [k, v] of Object.entries(CHANNELS)) {
    console.log(`    ${c(C.cyan, k.padEnd(10))} ${v.label}`);
  }
  console.log(`\n  ${c(C.bold, '④ 六项自动质检')}`);
  CHECKS.forEach((ch, i) => console.log(`    ${i + 1}. ${ch.title.padEnd(16)} ${c(C.dim, ch.id)}`));
  console.log(`\n  ${c(C.bold, '⑤ 技能分层')}`);
  for (const t of Object.values(TIERS)) console.log(`    ${c(C.cyan, t.key.padEnd(12))} ${t.label}`);
  console.log(`\n  ${c(C.dim, '完整规范见 SKILL.md（可独立阅读）')}\n`);
  return 0;
}

// ============================================================
// endpoints
// ============================================================

function cmdEndpoints(flags) {
  if (flags.json) {
    console.log(JSON.stringify(ENDPOINTS, null, 2));
    return 0;
  }
  const badge = {
    live: c(C.green, '● live'),
    planned: c(C.yellow, '○ planned'),
    deprecated: c(C.red, '✗ deprecated'),
  };
  console.log(`\n  ${c(C.bold, 'Fmode 端点真值表')}   ${c(C.dim, '实测于 2026-09-22')}\n  ${'─'.repeat(78)}`);
  for (const [key, e] of Object.entries(ENDPOINTS)) {
    console.log(`\n  ${badge[e.status]}  ${c(C.bold, key)}`);
    console.log(`     ${e.method} ${e.url}`);
    console.log(`     ${c(C.dim, `鉴权：${e.auth}`)}`);
    console.log(`     ${e.purpose}`);
    if (e.note) console.log(`     ${c(C.dim, e.note)}`);
  }
  const live = endpointsByStatus('live').length;
  const planned = endpointsByStatus('planned').length;
  const dep = endpointsByStatus('deprecated').length;
  console.log(`\n  ${'─'.repeat(78)}`);
  console.log(`  统计：${c(C.green, `${live} live`)}  ${c(C.yellow, `${planned} planned`)}  ${c(C.red, `${dep} deprecated`)}`);
  console.log(`  ${c(C.yellow, '⚠️ ')} planned/deprecated 端点调用前必须探测并回落，禁止当作已上线。\n`);
  return 0;
}

// ============================================================
// main
// ============================================================

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));

  if (flags.help || flags.h) {
    printHelp();
    return 0;
  }
  if (flags.version || flags.v) {
    console.log(`${VERSION}`);
    return 0;
  }

  const cmd = positional.shift() || (flags.help ? 'help' : null);

  if (!cmd) {
    printHelp();
    return 0;
  }

  switch (cmd) {
    case 'init':
      return cmdInit(flags, positional);
    case 'check':
      return cmdCheck(flags, positional);
    case 'verify':
      return cmdVerify(flags, positional);
    case 'publish':
      return cmdPublish(flags, positional);
    case 'inventory':
      return cmdInventory(flags);
    case 'bootstrap':
      return cmdBootstrap(flags);
    case 'spec':
      return cmdSpec(flags);
    case 'endpoints':
      return cmdEndpoints(flags);
    case 'help':
      printHelp();
      return 0;
    default:
      console.error(c(C.red, `✗ 未知命令：${cmd}`));
      console.error(`  运行 ${c(C.bold, 'skill-core --help')} 查看可用命令。`);
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(c(C.red, `✗ 未捕获异常：${err && err.stack ? err.stack : err}`));
    process.exit(1);
  });
