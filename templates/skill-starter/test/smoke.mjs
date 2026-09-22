// __SKILL_NAME__ 冒烟测试
// 运行：npm test   或   node test/smoke.mjs

import test from 'node:test';
import assert from 'node:assert/strict';

import { greet, VERSION, SKILL_NAME } from '../lib/index.mjs';

test('导出核心常量', () => {
  assert.equal(VERSION, '0.1.0');
  assert.equal(SKILL_NAME, '__SKILL_NAME__');
});

test('greet 返回预期文本', () => {
  assert.equal(greet('world'), `Hello, world! 来自 __SKILL_NAME__ v${VERSION}`);
  assert.equal(greet(), 'Hello, world! 来自 __SKILL_NAME__ v0.1.0');
});

test('greet 接受自定义名字', () => {
  assert.ok(greet('Fmode').includes('Fmode'));
});
