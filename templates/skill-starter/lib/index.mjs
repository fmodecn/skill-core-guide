/**
 * __SKILL_NAME__ · ESM 入口
 * ---------------------------------------------------------------------------
 * 这里是技能的 SDK 端。所有公共能力都从本文件 export。
 * 纪律：ESM only、零依赖优先、不在此文件读文件系统（除非确有需要）。
 *
 * @example
 *   import { greet, VERSION } from '__SKILL_NAME__';
 *   console.log(greet('world'));
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export const VERSION = '0.1.0';
export const SKILL_NAME = '__SKILL_NAME__';

/** Fmode 平台基址（如需调用平台服务，从这里取） */
export const FMODE_API_BASE = 'https://api.fmode.cn';
export const FMODE_GATEWAY_BASE = 'https://server.fmode.cn';

/**
 * 示例函数 —— 替换成你技能的真实能力。
 * @param {string} name
 * @returns {string}
 */
export function greet(name = 'world') {
  return `Hello, ${name}! 来自 __SKILL_NAME__ v${VERSION}`;
}

/**
 * 示例：解析 Fmode 凭据（5 级链的精简版）。
 * 生产实现请直接复用 skill-core-guide 的 lib/bootstrap.mjs。
 *
 * @param {{cwd?: string}} [opts]
 * @returns {Promise<{token: string, source: string}|null>}
 */
export async function resolveToken(opts = {}) {
  // 第 1 级：环境变量
  if (process.env.FMODE_API_TOKEN) {
    return { token: process.env.FMODE_API_TOKEN, source: 'env:FMODE_API_TOKEN' };
  }

  // 第 0 级：sessionToken 自举
  const sessionToken =
    process.env.FMODE_SESSION_TOKEN || readConfigToken(opts.cwd);
  if (sessionToken) {
    try {
      const res = await fetch(`${FMODE_GATEWAY_BASE}/api/fmode/voc-skill/install-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-parse-session-token': sessionToken },
        body: JSON.stringify({ channel: 'claude-code', scope: 'user' }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const body = await res.json().catch(() => null);
        const prompt = body?.data?.prompt || '';
        const m = prompt.match(/sk-(?!ant-)[A-Za-z0-9_-]{8,}/);
        // ⚠️ token 仅内存持有，不落盘不进日志
        if (m) return { token: m[0], source: 'sessionToken 自举' };
      }
    } catch {
      /* 回落 */
    }
  }

  return null;
}

/** 从 ~/.fmode/config.json 读 sessionToken（ESM：用顶层 import，不用 require） */
function readConfigToken(cwd) {
  try {
    const p = path.join(os.homedir(), '.fmode', 'config.json');
    if (!fs.existsSync(p)) return null;
    const cfg = JSON.parse(fs.readFileSync(p, 'utf-8').replace(/^﻿/, ''));
    return cfg.sessionToken || (cfg.user && cfg.user.sessionToken) || null;
  } catch {
    return null;
  }
}

export default { VERSION, SKILL_NAME, greet, resolveToken };
