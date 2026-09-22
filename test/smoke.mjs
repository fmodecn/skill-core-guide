// 自动质检冒烟测试
// ---------------------------------------------------------------------------
// 运行：npm test   或   node test/smoke.mjs
// 零依赖，仅用 node:assert 与 node:test。

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import * as core from '../lib/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ============================================================
// 1. ESM 入口导出完整性
// ============================================================

test('lib/index.mjs 导出全部公共接口', () => {
  const required = [
    'VERSION',
    'PLATFORM',
    'ENDPOINTS',
    'CREDENTIAL_CHAIN',
    'TIERS',
    'RUNTIMES',
    'CHECKS',
    'runChecks',
    'summarize',
    'validateName',
    'validatePackageJson',
    'validateManifest',
    'validateFrontmatter',
    'parseFrontmatter',
    'resolveApiToken',
    'bootstrap',
    'INVENTORY',
    'byTier',
    'stats',
    'publishPlan',
  ];
  for (const k of required) {
    assert.ok(k in core, `缺少导出：${k}`);
  }
  assert.equal(core.VERSION, '1.0.3');
});

test('ENDPOINTS 真值表结构合法', () => {
  for (const [key, e] of Object.entries(core.ENDPOINTS)) {
    assert.ok(e.url, `${key} 缺 url`);
    assert.ok(['live', 'planned', 'deprecated'].includes(e.status), `${key} status 非法：${e.status}`);
    assert.ok(e.auth, `${key} 缺 auth`);
    assert.ok(e.purpose, `${key} 缺 purpose`);
  }
  // 至少要有 live 端点，否则平台没得用
  assert.ok(core.endpointsByStatus('live').length >= 4, 'live 端点数量异常');
});

// ============================================================
// 2. 命名校验
// ============================================================

test('validateName 接受合法名、拒绝非法名', () => {
  assert.equal(core.validateName('skill-my-thing').ok, true);
  assert.equal(core.validateName('fmode-image').ok, true);
  assert.equal(core.validateName('my-thing').ok, false);
  assert.equal(core.validateName('skill-My_Thing').ok, false);
  assert.equal(core.validateName('').ok, false);
  assert.equal(core.validateName(null).ok, false);
});

// ============================================================
// 3. package.json 校验
// ============================================================

test('validatePackageJson 对合法包通过', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  const r = core.validatePackageJson(pkg);
  assert.equal(r.ok, true, `本仓库 package.json 应合法，实际错误：${r.errors.join('；')}`);
});

test('validatePackageJson 捕获缺失字段与 CJS 残留', () => {
  const bad = { name: 'skill-x', version: '1.0.0' };
  const r = core.validatePackageJson(bad);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('type')));
  assert.ok(r.errors.some((e) => e.includes('exports')));

  const cjs = {
    name: 'skill-x',
    version: '1.0.0',
    description: 'd',
    type: 'module',
    main: './lib/index.mjs',
    exports: { '.': { import: './lib/index.mjs', default: './lib/index.mjs' } },
    bin: { x: './bin/x.mjs' },
    files: [],
    license: 'MIT',
    require: './lib/index.cjs',
  };
  const r2 = core.validatePackageJson(cjs);
  assert.equal(r2.ok, false);
  assert.ok(r2.errors.some((e) => e.includes('require')));
});

// ============================================================
// 4. frontmatter 解析（三种格式）
// ============================================================

test('parseFrontmatter 解析标量与行内数组', () => {
  const text = [
    '---',
    'name: skill-demo',
    'description: "一段描述"',
    'version: 1.0.0',
    'tags: [a, b, c]',
    '---',
    '',
    '# 标题',
  ].join('\n');
  const { data, body, raw } = core.parseFrontmatter(text);
  assert.equal(data.name, 'skill-demo');
  assert.equal(data.description, '一段描述');
  assert.deepEqual(data.tags, ['a', 'b', 'c']);
  assert.ok(raw !== null);
  assert.ok(body.includes('# 标题'));
});

test('validateFrontmatter 校验 hermes 与 skillhub 两种格式', () => {
  const hermes = '---\nname: skill-demo\ndescription: d\nversion: 1.0.0\ntags: [x]\n---\nbody';
  const h = core.validateFrontmatter(hermes, 'hermes');
  assert.equal(h.ok, true, h.errors.join('；'));

  const skillhub = '---\nslug: fmode-skill-demo\ndisplayName: skill-demo\nversion: 1.0.0\nsummary: s\nlicense: MIT\n---\nbody';
  const s = core.validateFrontmatter(skillhub, 'skillhub');
  assert.equal(s.ok, true, s.errors.join('；'));

  // 缺字段应失败
  const broken = '---\nname: skill-demo\n---\nbody';
  assert.equal(core.validateFrontmatter(broken, 'skillhub').ok, false);
});

test('本仓库 SKILL.md 满足 skillhub 格式', () => {
  const text = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
  const r = core.validateFrontmatter(text, 'skillhub');
  assert.equal(r.ok, true, `SKILL.md frontmatter 不合法：${r.errors.join('；')}`);
});

// ============================================================
// 5. manifest 校验
// ============================================================

test('validateManifest 对本仓库清单通过', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'skill-package-manifest.json'), 'utf-8'));
  const r = core.validateManifest(m);
  assert.equal(r.ok, true, r.errors.join('；'));
});

// ============================================================
// 6. 清单数据完整性
// ============================================================

test('INVENTORY 覆盖三个分层且条目字段完整', () => {
  const s = core.stats();
  assert.ok(s.total >= 15, `清单条目过少：${s.total}`);
  assert.ok(s.byTier.system > 0 && s.byTier.service > 0 && s.byTier.application > 0);

  for (const sk of core.INVENTORY) {
    assert.ok(sk.name, '条目缺 name');
    assert.ok(sk.displayName, `${sk.name} 缺 displayName`);
    assert.ok(sk.summary, `${sk.name} 缺 summary`);
    assert.ok(Array.isArray(sk.platforms) && sk.platforms.length, `${sk.name} 缺 platforms`);
    assert.ok(core.TIERS[sk.tier], `${sk.name} tier 非法：${sk.tier}`);
    for (const p of sk.platforms) {
      assert.ok(core.CHANNELS[p], `${sk.name} 平台非法：${p}`);
    }
    // npm 渠道必须给出包名
    if (sk.platforms.includes('npm')) {
      assert.ok(sk.npmName, `${sk.name} 声明了 npm 渠道但缺 npmName`);
    }
  }
});

test('任务书点名的技能全部在清单中', () => {
  const expected = [
    'skill-heterarchy',
    'skill-multi-branch',
    'skill-bypass-permission',
    'skill-task-progress',
    'plugin-wecom-fix',
    'skill-agent-clone',
    'skill-storage',
    'skill-image',
    'skill-vision',
    'skill-listen',
    'fmode-ffmpeg',
    'fmode-qiwei',
    'skill-study-report',
    'skill-present',
    'fmode-product-lab',
  ];
  const names = core.INVENTORY.map((s) => s.name);
  for (const e of expected) {
    assert.ok(names.includes(e), `清单缺少任务书点名的技能：${e}`);
  }
});

// ============================================================
// 7. 分发计划
// ============================================================

test('publishPlan 覆盖四渠道且命令非空', () => {
  const plan = core.publishPlan('skill-demo', { dir: '.', changelog: 'test' });
  assert.equal(plan.length, 4);
  assert.deepEqual(plan.map((p) => p.channel), ['gogs', 'github', 'npm', 'skillhub']);
  for (const p of plan) {
    assert.ok(p.steps.length > 0, `${p.channel} 无步骤`);
    for (const s of p.steps) assert.equal(typeof s, 'string');
  }
});

// ============================================================
// 8. 六项检查注册表
// ============================================================

test('CHECKS 恰好六项且 id 唯一', () => {
  assert.equal(core.CHECKS.length, 6);
  const ids = core.CHECKS.map((c) => c.id);
  assert.equal(new Set(ids).size, 6);
  assert.deepEqual(ids, ['functional', 'apiConnectivity', 'sop', 'dashboard', 'loop', 'multiRuntime']);
});

test('summarize 正确聚合（含 skip 语义）', () => {
  const s = core.summarize([
    { id: 'a', status: 'pass' },
    { id: 'b', status: 'pass' },
    { id: 'c', status: 'skip' },
  ]);
  assert.equal(s.total, 3);
  assert.equal(s.pass, 2);
  assert.equal(s.skip, 1);
  assert.equal(s.ok, false, '有 skip 时不应判定为完全通过');
  assert.equal(s.partial, true);
  assert.deepEqual(s.unverified, ['c']);

  const allPass = core.summarize([{ id: 'a', status: 'pass' }, { id: 'b', status: 'pass' }]);
  assert.equal(allPass.ok, true);
  assert.equal(allPass.partial, false);
});

// ============================================================
// 9. 离线质检自跑（本仓库对自己做质检）
// ============================================================

test('runChecks --offline 在本仓库上可运行且无失败项', async () => {
  const report = await core.runChecks(ROOT, { offline: true, skipExec: false });
  assert.equal(report.results.length, 6);
  const failed = report.results.filter((r) => r.status === 'fail');
  assert.equal(
    failed.length,
    0,
    `本仓库质检不应有失败项，实际：\n${failed.map((f) => `${f.id}: ${f.detail}`).join('\n')}`,
  );
});

test('runChecks 拒绝未知检查项', async () => {
  await assert.rejects(
    () => core.runChecks(ROOT, { only: ['nope'] }),
    /未知检查项/,
  );
});

// ============================================================
// 10. 凭据解析（不联网，只验证形态与回落行为）
// ============================================================

test('validateToken 拒绝 sk-ant- 与非法形态', async () => {
  const { validateToken } = await import('../lib/bootstrap.mjs');
  assert.equal(validateToken('sk-ant-api03-xxxx').ok, false);
  assert.equal(validateToken('not-a-key').ok, false);
  assert.equal(validateToken('').ok, false);
  assert.equal(validateToken(null).ok, false);
  assert.equal(validateToken('sk-abcdefgh12345678').ok, true);
});

test('resolveFmodeDir 尊重 FMODE_HOME 覆盖', async () => {
  const { resolveFmodeDir } = await import('../lib/bootstrap.mjs');
  const prev = process.env.FMODE_HOME;
  process.env.FMODE_HOME = '/tmp/fmode-test-home';
  try {
    assert.equal(resolveFmodeDir(), '/tmp/fmode-test-home');
  } finally {
    if (prev === undefined) delete process.env.FMODE_HOME;
    else process.env.FMODE_HOME = prev;
  }
});

// ============================================================
// 11. 浏览器 bundle 无 Node 依赖
// ============================================================

test('browser/index.mjs 不 import 任何 node: 内置模块', () => {
  const src = fs.readFileSync(path.join(ROOT, 'browser', 'index.mjs'), 'utf-8');
  const nodeImports = [...src.matchAll(/from\s+['"]node:[a-z_]+['"]/g)];
  assert.equal(nodeImports.length, 0, `browser bundle 违规引入：${nodeImports.map((m) => m[0]).join(', ')}`);
});

test('browser bundle 可独立 import 且导出核心常量', async () => {
  const b = await import('../browser/index.mjs');
  assert.equal(b.VERSION, '1.0.3');
  assert.ok(b.PLATFORM.apiBase.includes('fmode.cn'));
  assert.ok(Object.keys(b.ENDPOINTS).length > 0);
  assert.equal(typeof b.validatePackageJson, 'function');
  assert.equal(typeof b.checkApiConnectivity, 'function');
});

// ============================================================
// 12. 脚手架模板完整性
// ============================================================

test('templates/skill-starter 脚手架文件齐全', () => {
  const tpl = path.join(ROOT, 'templates', 'skill-starter');
  assert.ok(fs.existsSync(tpl), '脚手架模板目录不存在');
  const required = [
    'SKILL.md',
    'package.json',
    'lib/index.mjs',
    'skill-package-manifest.json',
    'README.md',
    'LICENSE',
  ];
  for (const f of required) {
    assert.ok(fs.existsSync(path.join(tpl, f)), `脚手架缺少 ${f}`);
  }
  const binDir = path.join(tpl, 'bin');
  assert.ok(fs.existsSync(binDir), '脚手架缺少 bin/');
  const bins = fs.readdirSync(binDir).filter((f) => f.endsWith('.mjs'));
  assert.ok(bins.length > 0, '脚手架 bin/ 下无 .mjs 入口');

  const testDir = path.join(tpl, 'test');
  assert.ok(fs.existsSync(testDir), '脚手架缺少 test/');
});

test('脚手架占位符齐全（可被 init 替换）', () => {
  const tpl = path.join(ROOT, 'templates', 'skill-starter');
  const pkg = JSON.parse(fs.readFileSync(path.join(tpl, 'package.json'), 'utf-8'));
  assert.equal(pkg.name, '__SKILL_NAME__', 'package.json 应使用 __SKILL_NAME__ 占位符');
  assert.ok(pkg.type === 'module');
  assert.equal(pkg.main, './lib/index.mjs');
  assert.ok(pkg.bin['__CLI_NAME__'], 'bin 应使用 __CLI_NAME__ 占位符');
});
