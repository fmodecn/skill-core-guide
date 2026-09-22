---
name: skill-core-guide
description: "Fmode Harness 平台母技能标准指南。当你要（1）开发新技能、（2）检查技能质量、（3）发布技能到 Gogs/GitHub/npm/skillhub、（4）查平台端点是否可用、（5）配置 Fmode 凭据、（6）了解技能生态现状时使用本技能。它是 Fmode 技能生态的宪法：定义平台真值表、ESM-first 四端标准、四渠道分发、六项自动质检、诚实凭证供给。"
version: 1.0.0
author: Yuyang001 (FmodeAgent)
license: MIT
tags: [meta, standard, spec, harness, scaffold, quality-check, fmode, esm]
---

# skill-core-guide · Fmode Harness 平台母技能

> 完整规范文档在仓库根目录的 [`SKILL.md`](../../SKILL.md)（可独立阅读）。
> 本文件是 Agent 会话中的**行为契约**：说明何时该调用本技能、怎么调用。

---

## 何时使用（触发场景）

当用户出现以下诉求时，使用本技能：

1. **开发新技能** —— 「帮我做一个技能」「新建一个 skill 仓库」
   → `npx --yes skill-core-guide@latest init my-thing --name skill-my-thing`

2. **检查技能质量** —— 「这个技能能发布吗」「跑一下质检」
   → `npx --yes skill-core-guide@latest check .`

3. **发布技能** —— 「发布到 npm」「推到 GitHub」「上架 skillhub」
   → `npx --yes skill-core-guide@latest publish . --apply`

4. **查平台端点** —— 「api.fmode.cn 的转写接口是什么」「这个端点能调吗」
   → `npx --yes skill-core-guide@latest endpoints`

5. **配置凭据** —— 「技能说没 token」「怎么配 Fmode 凭据」
   → `npx --yes skill-core-guide@latest bootstrap`

6. **了解生态现状** —— 「平台有哪些技能」「skill-xxx 是干嘛的」
   → `npx --yes skill-core-guide@latest inventory` 或读 [`inventory.md`](../../inventory.md)

7. **写技能规范/包结构** —— 「package.json 该怎么写」「要支持哪些端」
   → 读 `SKILL.md` §3，或 `import { validatePackageJson } from 'skill-core-guide'`

---

## 核心能力

### CLI

```bash
skill-core init [dir]        从脚手架创建新技能
skill-core check [dir]       运行六项自动质检
skill-core verify [dir]      静态校验（不执行代码）
skill-core publish [dir]     生成四渠道发布计划
skill-core inventory         输出技能清单
skill-core bootstrap         一键凭证供给
skill-core spec              输出平台规范摘要
skill-core endpoints         输出端点真值表
```

### SDK

```javascript
import {
  // 平台真值
  PLATFORM, ENDPOINTS, endpointsByStatus, CREDENTIAL_CHAIN,
  // 校验器
  validateName, validatePackageJson, validateManifest,
  validateFrontmatter, parseFrontmatter,
  // 质检
  CHECKS, runChecks, summarize, renderReport,
  // 凭据
  bootstrap, resolveApiToken, ensureFmodeDir, writeConfig,
  // 清单与分发
  INVENTORY, byTier, stats, publishPlan,
} from 'skill-core-guide';
```

### 浏览器

```javascript
import { PLATFORM, checkApiConnectivity } from 'skill-core-guide/browser';
```

---

## 三条铁律（违反任一条，技能不算交付）

1. **零密钥入库** —— 凭据只从环境变量/用户目录解析，仓库里永远不出现真实密钥。
   提交前扫一遍：`git grep -iE "sk-[a-z0-9]{20}|sk-ent-|ghp_|github_pat_"`
2. **不伪造成功** —— 拿不到结果就显式报错并给出修复指引，绝不假装跑通。
   质检的 `skip` 状态**不算通过**，且导致 CI 失败。
3. **端点先探测再调用** —— 真值表里 `planned` / `deprecated` 的端点调用前必须探测，
   404 时显式回落。禁止把「文档写了」当成「已经能跑」。

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

真值源：`lib/platform.mjs` 的 `ENDPOINTS`。代码里**引用 `ENDPOINTS.llmChat.url`
而不是硬编码 URL**，平台迁移时只改一处。

---

## 凭据（标准 5 级链，命中即用）

```
第0级  FMODE_SESSION_TOKEN / ~/.fmode/config.json 的 sessionToken → 自举换 API token
第1级  环境变量 FMODE_API_TOKEN
第2级  ~/.fmode/config.json → fmodeApiToken
第3级  <cwd>/.fmode/config.json → fmodeApiToken
第4级  ~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN
```

> 💡 **关键认知**：fmode 的 newapi SK 默认就是 Claude Code 的 `ANTHROPIC_AUTH_TOKEN`。
> 用户按 Claude Code 正常方式配好 SK 后，技能必须能读到它，否则会误判「缺 token」。

**全链失败时**：打印初始化向导 + **退出码 2**，绝不伪装成功。

---

## 六项自动质检

| # | 检查项 | 验证方式 |
|---|--------|----------|
| 1 | 功能完整性 | 运行 `scripts.test` / `test/*.mjs` |
| 2 | Fmode API 联通 | 探测 `api.fmode.cn` 与 `server.fmode.cn` |
| 3 | 基础 SOP 跑通 | `skillhub publish --dry-run` + frontmatter 校验 |
| 4 | 看板后台就绪 | `skill-package-manifest.json` 存在且合法 |
| 5 | Loop 迭代能力 | `npm view`（轻量）/ `npx --yes`（`--deep`） |
| 6 | 多端可用性 | 实测 ESM `import` + CLI `--help` |

结果三态：`pass`（有证据通过）／ `fail`（exit 1）／ `skip`（**不算通过**，exit 3）。

---

## 能力边界

**能做**：
- 脚手架新技能（含完整可跑通结构）
- 六项自动质检（每项给出可复核 evidence）
- 生成/执行四渠道发布计划
- 查询平台端点真实状态
- 校验 package.json / manifest / SKILL.md frontmatter
- 检查并初始化 Fmode 凭据

**不能做**：
- 自动在 Gogs 建仓（`git.fmode.cn/api/v1` basic auth 返回 401，需 Web UI 手动建）
- 通过短信验证码开户（`/api/fmode/verifycode` 未上线）
- 替代人工判断技能的业务价值

---

## 验证方法

```bash
npm test                                     # 冒烟测试（23 项）
node bin/skill-core.mjs check . --offline    # 自检六项
node bin/skill-core.mjs verify .             # 静态校验
```

---

## License

MIT © 2026 Fmode (未来飞马)
