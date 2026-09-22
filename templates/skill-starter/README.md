# __SKILL_NAME__ · __SUMMARY__

> 一句话定位（替换本行）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么

<!-- 2-3 句话说明技能解决什么问题、给谁用 -->

## 安装

### Claude Code
```bash
npx --yes __SKILL_NAME__@latest workspace
```

### 任意 Agent（读 README 自行安装）
```bash
git clone https://github.com/fmodecn/__SKILL_NAME__.git
cp -r __SKILL_NAME__/skills/__SKILL_NAME__ <你的工具技能目录>/__SKILL_NAME__
```

### npm / skillhub
```bash
npm install __SKILL_NAME__
skillhub install fmode-__SKILL_NAME__
```

## 用法

```bash
# CLI
npx --yes __SKILL_NAME__@latest greet world

# SDK (ESM)
import { greet } from '__SKILL_NAME__';
console.log(greet('world'));
```

## 凭据

走 Fmode 标准 5 级凭据链（零密钥入库，命中即用，全失败显式报错）：

```
第0级  FMODE_SESSION_TOKEN / ~/.fmode/config.json 的 sessionToken → 自举换 API token
第1级  环境变量 FMODE_API_TOKEN
第2级  ~/.fmode/config.json → fmodeApiToken
第3级  <cwd>/.fmode/config.json → fmodeApiToken
第4级  ~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN
```

检查凭据：`npx --yes __SKILL_NAME__@latest auth`

## 四端可用性

| 端 | 入口 | 状态 |
|----|------|------|
| CLI | `bin/__CLI_NAME__.mjs` | ✅ |
| SDK (ESM) | `lib/index.mjs` | ✅ |
| Browser | `browser/index.mjs` | ⬜ 按需 |
| Server (CJS) | — | ❌ ESM only（团队共识） |

## 开发与发布

```bash
npm test                         # 冒烟测试
skill-core check .               # 六项自动质检
skill-core publish . --apply     # 四渠道发布
```

## Changelog

### 0.1.0
- 首版

## License

MIT
