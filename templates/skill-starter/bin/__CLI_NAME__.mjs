#!/usr/bin/env node
/**
 * __CLI_NAME__ — __SKILL_NAME__ 的命令行入口
 * ---------------------------------------------------------------------------
 * 用法：npx --yes __SKILL_NAME__@latest <command> [args]
 */

import { VERSION, SKILL_NAME, greet, resolveToken } from '../lib/index.mjs';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
};
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `${code}${s}${C.reset}` : s);

function printHelp() {
  console.log(`
${c(C.bold, '__CLI_NAME__')} · __SUMMARY__  v${VERSION}

${c(C.bold, '用法')}
  __CLI_NAME__ <command> [args]

${c(C.bold, '命令')}
  ${c(C.cyan, 'greet')} [name]     示例命令
  ${c(C.cyan, 'auth')}             检查 Fmode 凭据是否可用
  ${c(C.cyan, 'workspace')}        安装到当前工作区（npx 约定入口）
  ${c(C.cyan, '--help')}           显示帮助
  ${c(C.cyan, '--version')}        显示版本
`);
}

async function cmdGreet(args) {
  console.log(greet(args[0] || 'world'));
  return 0;
}

async function cmdAuth() {
  const r = await resolveToken();
  if (r) {
    const masked = r.token.length > 12 ? `${r.token.slice(0, 6)}...${r.token.slice(-4)}` : '***';
    console.log(`${c(C.green, '✅')} 凭据可用：${r.source}（${masked}）`);
    return 0;
  }
  console.log(`${c(C.red, '❌')} 未找到可用凭据。`);
  console.log(`
  请任选一种方式配置：
    1) export FMODE_API_TOKEN='sk-...'
    2) export FMODE_SESSION_TOKEN='r:...'   ${c(C.dim, '# 登录 FMODE Studio 取得，将自动换取 API token')}
    3) 在 ~/.fmode/config.json 写入 { "fmodeApiToken": "sk-..." }
`);
  return 1;
}

async function cmdWorkspace() {
  console.log(`${c(C.green, '✅')} ${SKILL_NAME} 已就绪（v${VERSION}）。`);
  console.log(`  在 Agent 会话中直接描述你的任务即可触发本技能。`);
  return 0;
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];

  if (!cmd || cmd === '--help' || cmd === '-h') {
    printHelp();
    return 0;
  }
  if (cmd === '--version' || cmd === '-v') {
    console.log(VERSION);
    return 0;
  }

  switch (cmd) {
    case 'greet':
      return cmdGreet(argv.slice(1));
    case 'auth':
      return cmdAuth();
    case 'workspace':
      return cmdWorkspace();
    default:
      console.error(`${c(C.red, '✗')} 未知命令：${cmd}`);
      console.error(`  运行 ${c(C.bold, '__CLI_NAME__ --help')} 查看可用命令。`);
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`${c(C.red, '✗')} ${err?.stack || err}`);
    process.exit(1);
  });
