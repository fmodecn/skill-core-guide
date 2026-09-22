# skill-core-guide · Fmode Harness 平台母技能标准指南

> 一份**可独立阅读**的 Fmode 技能开发规范。读它不需要先读任何别的文档。
> 它是 Fmode 技能生态的「宪法」——定义平台真值、包结构、分发渠道、质检标准。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm](https://img.shields.io/badge/npm-skill--core--guide-blue.svg)](https://www.npmjs.com/package/skill-core-guide)
[![ESM](https://img.shields.io/badge/module-ESM--only-orange.svg)](#四端可用性)

---

## 这是什么

`skill-core-guide` 是 Fmode Harness 平台的**母技能**。它同时是：

1. **一份规范文档** —— [`SKILL.md`](SKILL.md) 是完整的平台开发标准，可独立阅读
2. **一套可执行工具** —— CLI + SDK 帮你脚手架、质检、发布新技能
3. **一个真值源** —— 平台端点实测状态表，代码可 import，避免硬编码与「文档说能跑」的假象

**解决的问题**：Fmode 技能生态过去没有统一标准 —— 端点状态靠口口相传、
包结构各写各的、发布流程记在脑子里、质检靠人工、凭据配置踩坑反复。
本技能把这一切固化成**可执行、可验证、可复用**的规范。

---

## 三分钟上手

```bash
# 创建一个新技能（脚手架）
npx --yes skill-core-guide@latest init my-thing --name skill-my-thing

# 检查你的技能（六项自动质检）
npx --yes skill-core-guide@latest check .

# 生成四渠道发布计划
npx --yes skill-core-guide@latest publish .

# 查看平台端点真值表（哪些真的能调）
npx --yes skill-core-guide@latest endpoints

# 检查/初始化 Fmode 凭据
npx --yes skill-core-guide@latest bootstrap
```

---

## 核心内容

| 章节 | 内容 | 位置 |
|------|------|------|
| **平台基础设施规范** | 基址、`.fmode/` 机制、**端点真值表（实测状态）** | [SKILL.md §1](SKILL.md#一fmode-harness-平台基础设施规范) |
| **技能分类体系** | 系统层 / 服务层 / 应用层 + 命名规则 | [SKILL.md §2](SKILL.md#二技能分类体系) ｜ [`inventory.md`](inventory.md) |
| **ESM-first 打包标准** | 包结构、package.json 约束、**四端等价性** | [SKILL.md §3](SKILL.md#三esm-first-多端可用打包标准) |
| **多渠道分发** | Gogs / GitHub / npm / skillhub.cn | [SKILL.md §4](SKILL.md#四多渠道分发机制) |
| **自动质检与看板** | 六项检查、`skip≠pass` 语义、看板 manifest | [SKILL.md §5](SKILL.md#五自动质检与看板机制) |
| **一键凭证供给** | 5 级凭据链、诚实自举 | [SKILL.md §6](SKILL.md#六一键凭证供给机制) |
| **新技能开发 SOP** | 11 步完整流程 + 开发纪律 | [SKILL.md §7](SKILL.md#七新技能开发-sop) |
| **事故复盘** | 规范里每条 ⚠️ 背后的真实事故 | [SKILL.md §8](SKILL.md#八事故复盘本规范为什么这么写) |

---

## 六项自动质检

```bash
skill-core check .
```

| # | 检查项 | 验证方式 |
|---|--------|----------|
| 1 | 功能完整性 | 运行 `scripts.test` / `test/*.mjs` |
| 2 | Fmode API 联通 | 探测 `api.fmode.cn` 与 `server.fmode.cn` |
| 3 | 基础 SOP 跑通 | `skillhub publish --dry-run` + frontmatter 校验 |
| 4 | 看板后台就绪 | `skill-package-manifest.json` 存在且合法 |
| 5 | Loop 迭代能力 | `npm view`（轻量）/ `npx --yes`（`--deep`） |
| 6 | 多端可用性 | 实测 ESM `import` + CLI `--help` |

**结果语义**：`pass`（有证据通过）／ `fail`（明确失败，exit 1）／ `skip`（无法验证，**不算通过**，exit 3）。

> 🎯 `skip ≠ pass` 是本平台最贵的一课：端点 404 却被当成成功，
> 「能跑通」只是历史遗留配置的假象。详见 [SKILL.md §8.1](SKILL.md#81-伪自举事故--skip--pass-的由来)。

---

## 平台端点真值表（实测 2026-09-22）

| 端点 | 状态 | 用途 |
|------|------|------|
| `api.fmode.cn/v1/chat/completions` | ✅ live | LLM 调用（统一出口） |
| `api.fmode.cn/v1/images/generations` | ✅ live | 图像生成 |
| `server.fmode.cn/api/listen/transcribe` | ✅ live | 录音转写 |
| `server.fmode.cn/api/fmode/voc-skill/install-prompt` | ✅ live | 凭据自举（唯一通道） |
| `server.fmode.cn/api/apig/deploy/huaweicloud` | ✅ live | 项目隔离 OBS STS |
| `server.fmode.cn/api/storage/upload` | 🕓 planned | 未上线，走 obsutil 直传 |
| `server.fmode.cn/api/storage/credentials` | ✗ deprecated | 从未上线（伪自举事故源） |
| `server.fmode.cn/api/image/generate` | 🕓 planned | 未上线，用 `/v1/images/generations` |
| `server.fmode.cn/api/vision/analyze` | 🕓 planned | 未上线，用多模态 chat |
| `server.fmode.cn/api/fmode/verifycode` | 🕓 planned | 未上线，用 sessionToken 路径 |

> ⚠️ **`planned` / `deprecated` 端点调用前必须探测并回落**，禁止当作已上线。
> 完整说明：`npx --yes skill-core-guide@latest endpoints`

---

## 四端可用性

| 端 | 入口 | 用法 | 状态 |
|----|------|------|------|
| **CLI** | `bin/skill-core.mjs` | `npx --yes skill-core-guide@latest <cmd>` | ✅ |
| **SDK** | `lib/index.mjs` | `import { ... } from 'skill-core-guide'` | ✅ |
| **Browser** | `browser/index.mjs` | `<script type="module">`（无 Node 依赖） | ✅ |
| **Server** | — | `require('skill-core-guide')` | ❌ ESM only |

```javascript
// SDK
import { PLATFORM, ENDPOINTS, runChecks, bootstrap, INVENTORY } from 'skill-core-guide';

// 浏览器
import { PLATFORM, checkApiConnectivity } from 'skill-core-guide/browser';
```

---

## 各工具安装

### Claude Code
```bash
npx --yes skill-core-guide@latest workspace
```

### 任意 Agent（读 README 自行安装）
```bash
git clone https://github.com/fmodecn/skill-core-guide.git
cp -r skill-core-guide/skills/skill-core-guide <你的工具技能目录>/skill-core-guide
```

### Codex / Gemini CLI
把 `skills/skill-core-guide/SKILL.md` 的内容并入 `AGENTS.md`（Codex）
或 `~/.gemini/commands/`（Gemini CLI）。

### npm / skillhub
```bash
npm install skill-core-guide
skillhub install fmode-skill-core-guide   # ⚠️ 待 key 补发，见下方渠道现状
```

> ⚠️ **skillhub.cn 渠道现状（2026-09-22 实测）**：企业 key（`sk-ent-...`）调用发布接口
> 返回 **401 `invalid or expired token`**。本技能的打包与 `--dry-run` 预检均已通过
> （`slug=fmode-skill-core-guide`），**待重新签发 key 后补发**。

---

## 技能清单

完整清单（16 个技能，含标签、版本、渠道、状态）见 **[`inventory.md`](inventory.md)**。

```bash
npx --yes skill-core-guide@latest inventory
```

| 分层 | 技能 |
|------|------|
| **系统层**（7） | `skill-heterarchy` · `skill-multi-branch` · `skill-bypass-permission` · `skill-task-progress` · `plugin-wecom-fix` · `skill-agent-clone` · `skill-core-guide` |
| **服务层**（6） | `skill-storage` · `skill-image` · `skill-vision` · `skill-listen` · `fmode-ffmpeg` · `fmode-qiwei` |
| **应用层**（3） | `skill-study-report` · `skill-present` · `fmode-product-lab` |

---

## 交付状态（2026-09-22 实测）

| 渠道 | 状态 | 验证方式 |
|------|------|----------|
| Gogs | ✅ 已发布 | `git.fmode.cn/api/v1/repos/search?q=skill-core-guide` → 200 |
| GitHub | ✅ 已发布 | `api.github.com/repos/fmodecn/skill-core-guide` → 13 项内容 |
| npm | ✅ 已发布 | `npm view skill-core-guide version` → `1.0.0` |
| skillhub.cn | ⚠️ **受阻** | 企业 key 服务端 401 `invalid or expired token`（预检已通过，待补发） |

六项自动质检：**6 通过 / 0 失败 / 0 未验证**（含 `--deep` 真实 `npx` 拉取验证）。

---

## 凭据（零密钥入库）

Fmode 标准 5 级凭据链，命中即用，全失败显式报错（**绝不伪装成功**）：

```
第0级  FMODE_SESSION_TOKEN / ~/.fmode/config.json 的 sessionToken → 自举换 API token
第1级  环境变量 FMODE_API_TOKEN
第2级  ~/.fmode/config.json → fmodeApiToken
第3级  <cwd>/.fmode/config.json → fmodeApiToken
第4级  ~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN
```

检查：`npx --yes skill-core-guide@latest bootstrap`

> ⚠️ 任务书描述的「手机号+验证码」开户路径依赖 `/api/fmode/verifycode`，
> 该端点**当前实测 404（未上线）**。本技能不伪造短信流程，
> 真实可用路径是 sessionToken 自举。详见 [SKILL.md §6](SKILL.md#六一键凭证供给机制)。

---

## CLI 命令

```
skill-core init [dir]        从脚手架创建新技能
skill-core check [dir]       运行六项自动质检
skill-core verify [dir]      静态校验（不执行代码）
skill-core publish [dir]     生成四渠道发布计划
skill-core inventory         输出技能清单
skill-core bootstrap         一键凭证供给
skill-core spec              输出平台规范摘要
skill-core endpoints         输出端点真值表
```

---

## 仓库结构

```
skill-core-guide/
├── SKILL.md                      # ★ 完整规范文档（可独立阅读）
├── README.md                     # 本文件
├── inventory.md                  # 完整技能清单
├── package.json                  # ESM, zero-dependency
├── lib/
│   ├── index.mjs                 # ESM 入口（平台常量 + 校验器 + 分发计划）
│   ├── platform.mjs              # ★ 端点真值表（single source of truth）
│   ├── check.mjs                 # ★ 六项质检引擎
│   ├── bootstrap.mjs             # ★ 诚实凭证供给
│   └── inventory.mjs             # 技能清单真值
├── bin/
│   └── skill-core.mjs            # CLI
├── browser/
│   └── index.mjs                 # 浏览器 bundle（无 Node 依赖）
├── templates/
│   └── skill-starter/            # ★ 新技能脚手架（可跑通）
├── test/
│   └── smoke.mjs                 # 冒烟测试
├── LICENSE                       # MIT
└── skill-package-manifest.json   # 看板数据源
```

---

## 开发

```bash
npm test                              # 冒烟测试
node bin/skill-core.mjs check . --offline   # 自检（离线）
node bin/skill-core.mjs verify .            # 静态校验
```

---

## Changelog

### 1.0.0
- 首版：平台端点真值表（实测 2026-09-22）、技能三层清单（17 个）、
  ESM-first 四端标准、四渠道分发、六项自动质检、诚实凭证供给、脚手架模板
- **端点真值修正**：任务书描述的 `/api/storage/upload`、`/api/image/generate`、
  `/api/vision/analyze`、`/api/fmode/verifycode` 实测均为 **404（planned）**，
  已在真值表中标注并给出替代路径
- **真实端点补充**：`/v1/images/generations`（live）、`/api/apig/deploy/huaweicloud`（live）、
  `/api/fmode/voc-skill/install-prompt`（live，凭据自举唯一通道）

---

## License

MIT © 2026 Fmode (未来飞马)
