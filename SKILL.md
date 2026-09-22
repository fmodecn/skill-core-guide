---
slug: fmode-skill-core-guide
displayName: skill-core-guide
version: 1.0.0
summary: Fmode Harness 平台母技能标准指南 —— 平台端点真值表、ESM-first 四端标准、四渠道分发、六项自动质检、一键凭证供给、新技能脚手架。
license: MIT
author: Yuyang001 (FmodeAgent)
tags: [fmode, harness, skill, standard, spec, esm, scaffold, meta]
---

# skill-core-guide · Fmode Harness 平台母技能标准指南

> 一份**可独立阅读**的技能开发规范。读它不需要先读任何别的文档。
> 它是 Fmode 技能生态的「宪法」——定义平台真值、包结构、分发渠道、质检标准。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**技能名**：`skill-core-guide` ｜ **npm**：`skill-core-guide` ｜ **skillhub**：`fmode-skill-core-guide`

---

## 目录

- [零、给 Agent 的 60 秒速览](#零给-agent-的-60-秒速览)
- [一、Fmode Harness 平台基础设施规范](#一fmode-harness-平台基础设施规范)
- [二、技能分类体系](#二技能分类体系)
- [三、ESM-first 多端可用打包标准](#三esm-first-多端可用打包标准)
- [四、多渠道分发机制](#四多渠道分发机制)
- [五、自动质检与看板机制](#五自动质检与看板机制)
- [六、一键凭证供给机制](#六一键凭证供给机制)
- [七、新技能开发 SOP](#七新技能开发-sop)
- [八、事故复盘：本规范为什么这么写](#八事故复盘本规范为什么这么写)
- [九、附录](#九附录)

---

## 零、给 Agent 的 60 秒速览

你要开发一个新技能？按这个顺序做，不要跳步：

```bash
# 1. 脚手架
npx --yes skill-core-guide@latest init my-skill --name skill-my-skill
cd skill-my-skill

# 2. 写三处：技能契约 / SDK 接口 / CLI 入口
#    skills/skill-my-skill/SKILL.md   ← 何时触发、怎么用
#    lib/index.mjs                    ← export 公共接口
#    bin/my-skill.mjs                 ← CLI 命令

# 3. 跑通
npm test

# 4. 六项质检（必须全绿或显式解释每个 skip）
npx --yes skill-core-guide@latest check .

# 5. 四渠道发布
npx --yes skill-core-guide@latest publish . --apply
```

**三条铁律**（违反其中任何一条，技能不算交付）：

1. **零密钥入库** —— 凭据只从环境变量/用户目录解析，仓库里永远不出现真实密钥。
2. **不伪造成功** —— 拿不到结果就显式报错并给出修复指引，绝不假装跑通。
3. **端点先探测再调用** —— 标注 `planned` 的端点调用前必须探测，404 时显式回落。

---

## 一、Fmode Harness 平台基础设施规范

### 1.1 平台基址

| 用途 | 基址 | 鉴权方式 |
|------|------|----------|
| **API 网关**（LLM / 图像） | `https://api.fmode.cn` | `Authorization: Bearer sk-...` |
| **业务网关**（转写 / 凭据自举 / deploy STS） | `https://server.fmode.cn` | `x-parse-session-token: r:...` 或 Bearer |
| **CDN**（OBS → fmode.cn 回源） | `https://fmode.cn` | 公开读 |
| **OBS 直链**（CDN 未生效时的降级通道） | `https://fmode-s3.obs.cn-north-4.myhuaweicloud.com` | 公开读 / AK-SK 写 |
| **主 Gogs**（内网日常迭代） | `https://git.fmode.cn/fmode/` | URL 携带凭据 |
| **GitHub 镜像**（公开发布） | `https://github.com/fmodecn/` | SSH key / PAT |
| **npm** | `https://registry.npmjs.org` | `~/.npmrc` token |
| **skillhub.cn** | `https://api.skillhub.cn` | `sk-ent-...`（团队 fmode / `org-m8z913un`） |

### 1.2 `.fmode/` 目录机制

```
~/.fmode/
├── config.json          # 全局配置（600 权限）
│                        #   非敏感：profiles / projects / obsBucket / storageProjectId
│                        #   敏感：sessionToken / fmodeApiToken / githubToken
├── credentials/         # 敏感凭据文件（700 目录 / 600 文件）
│   └── academic-identity.txt
└── projects/            # 项目认知文件映射
```

**项目级覆盖**：`<cwd>/.fmode/config.json` 优先级高于用户级（用于项目专属配置）。

**环境变量覆盖**：
- `FMODE_HOME` —— 覆盖 `~/.fmode` 根目录（测试/多身份隔离用）
- `FMODE_API_TOKEN` —— 直接指定 API token
- `FMODE_SESSION_TOKEN` —— 指定 sessionToken（触发自举）
- `FMODE_API_BASE` —— 覆盖业务网关基址

> ⚠️ **BOM 陷阱**：用户手工保存的 `config.json` 常带 UTF-8 BOM（`EF BB BF`），
> `JSON.parse` 会直接抛错。**解析前必须剥 BOM**：
> `JSON.parse(raw.replace(/^﻿/, ''))`。这是多个技能踩过的真实坑。

### 1.3 统一 API 接入

所有技能通过 Fmode 网关调用 LLM / 存储 / 图像 / 转写 / 视觉，**不在客户端直连第三方**。

#### 端点真值表（实测于 2026-09-22）

状态语义：
- **`live`** —— 实测返回 200 或 401（401 = 端点存在、需鉴权），可直接使用
- **`planned`** —— 实测 404，设计文档存在但服务端未上线；**调用前必须探测并回落**
- **`deprecated`** —— 曾经被文档描述、实测 404 且已确认不再维护；**不要使用**

| # | 端点 | 方法 | 状态 | 鉴权 | 用途 |
|---|------|------|------|------|------|
| 1 | `api.fmode.cn/v1/chat/completions` | POST | ✅ **live** | Bearer `sk-` | LLM 对话补全（OpenAI 兼容）——所有技能的统一模型出口 |
| 2 | `api.fmode.cn/v1/images/generations` | POST | ✅ **live** | Bearer `sk-` | 图像生成（fmode-image） |
| 3 | `server.fmode.cn/api/listen/transcribe` | POST | ✅ **live** | Bearer `sk-` | 录音转写（讯飞 LFASR） |
| 4 | `server.fmode.cn/api/fmode/voc-skill/install-prompt` | POST | ✅ **live** | `x-parse-session-token` | **凭据自举唯一通道**：sessionToken → API token |
| 5 | `server.fmode.cn/api/apig/deploy/huaweicloud` | POST | ✅ **live** | Bearer sessionToken | 签发项目隔离 OBS STS |
| 6 | `server.fmode.cn/api/storage/upload` | POST | 🕓 planned | Bearer `sk-` | 对象存储上传（未上线，走 obsutil 直传） |
| 7 | `server.fmode.cn/api/storage/credentials` | POST | ✗ **deprecated** | Bearer sessionToken | 从未上线（恒 404），见 §8.1 事故复盘 |
| 8 | `server.fmode.cn/api/image/generate` | POST | 🕓 planned | Bearer `sk-` | 网关侧图像生成（未上线，用 #2 代替） |
| 9 | `server.fmode.cn/api/vision/analyze` | POST | 🕓 planned | Bearer `sk-` | 网关侧视觉识别（未上线，用 #1 多模态代替） |
| 10 | `server.fmode.cn/api/fmode/verifycode` | POST | 🕓 planned | 无 | 手机号验证码（未上线，见 §6） |

**统计**：5 live ／ 4 planned ／ 1 deprecated。

> 📌 **真值源**：上表由 `lib/platform.mjs` 的 `ENDPOINTS` 常量驱动。
> 代码里请**引用 `ENDPOINTS.llmChat.url` 而不是硬编码 URL**——
> 平台迁移时只改一处。可用 `skill-core endpoints` 随时打印最新真值表。

#### 调用示例

```javascript
// LLM 调用
const res = await fetch('https://api.fmode.cn/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ model: 'glm-5.3-flash', messages: [...] }),
});

// 图像生成
await fetch('https://api.fmode.cn/v1/images/generations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ model: '...', prompt: '...' }),
});

// 录音转写
await fetch('https://server.fmode.cn/api/listen/transcribe', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ url: 'https://.../meeting.mp3', ... }),
});
```

#### 视觉识别：宿主优先策略

`skill-vision` 定义的**成本最优**策略，所有视觉类技能应遵循：

```
1. 探测宿主 Agent 配置的模型是否支持视觉（Claude Code / Codex settings）
   → 支持则直接用宿主模型读图（零额外成本、零网络往返）
2. 否则回落 Fmode API 的 /v1/chat/completions（多模态 messages），模型 glm-5.3-flash
```

#### 存储：4 级诚实凭据链

`skill-storage` 的凭据链是平台存储接入的权威参考：

```
第1级  环境变量 OBS_AK / OBS_SK（可选 OBS_ENDPOINT / OBS_BUCKET）
第2级  obsutil config 文件（OBSUTIL_CONFIG 或 ~/.obsutilconfig）
第3级  sessionToken + storageProjectId
        → POST /api/apig/deploy/huaweicloud  → 项目隔离 STS
          （obsPath = obs://nova-cloud/dev/<projectId>/，key 强制限定前缀）
          STS 仅内存持有，用完即删
第4级  项目级 ./.fmode/config.json（obsBucket / obsEndpoint / cdnDomain）
```

**全失败时必须打印初始化向导并退出码 2，绝不伪装成功。**

---

## 二、技能分类体系

技能按**职责边界**分三层。分层决定了它的发布渠道、依赖关系与质检重点。

### 2.1 系统层 / Infrastructure

平台基础设施与 Agent 运行时治理。**不依赖任何业务场景**，是其他技能的地基。

| 技能 | 作用 | 平台 |
|------|------|------|
| `skill-heterarchy` | 内异层认知协同范式（单主体内多心智分化） | Gogs/GitHub/npm/skillhub |
| `skill-multi-branch` | 沟通/执行分层编排（Hermes → CC/Codex） | GitHub |
| `skill-bypass-permission` | YOLO 模式权限自检（免确认自主执行） | GitHub |
| `skill-task-progress` | 4 态任务进度跟踪（ack/running/done/failed） | GitHub |
| `plugin-wecom-fix` | 企微通道自检修复（plugin 形态） | Hermes plugin |
| `skill-agent-clone` | 数字生命克隆（配置/SOUL/记忆/会话） | GitHub |
| **`skill-core-guide`** | **平台母技能标准指南（本技能）** | Gogs/GitHub/npm/skillhub |

### 2.2 服务层 / Platform Services

Fmode 基础服务的客户端封装。**一个技能封装一个平台能力**，接口稳定、无业务假设。

| 技能 | 作用 | npm 包 | 平台 |
|------|------|--------|------|
| `skill-storage` | OBS 对象存储与公开分享 | — | GitHub |
| `skill-image` | Fmode API 图像生成（白底 PNG，¥0.3-0.5/张） | `fmode-image@0.2.0` | GitHub/npm |
| `skill-vision` | 宿主多模态优先 + Fmode API 回落视觉识别 | `fmode-vision@0.1.1` | npm |
| `skill-listen` | 讯飞 LFASR × Fmode 网关录音转写 | `fmode-listen@0.1.2` | npm |
| `fmode-ffmpeg` | FFmpeg 音视频处理封装 | `fmode-ffmpeg@0.1.1` | npm |
| `fmode-qiwei` | 企微网关 SDK | `fmode-qiwei@0.5.2` | npm |

### 2.3 应用层 / Business Applications

面向具体业务场景的端到端技能。**可以依赖服务层**，但不应被服务层依赖。

| 技能 | 作用 | 平台 |
|------|------|------|
| `skill-study-report` | 学习复盘报告（多 Agent 采集 + PPT 级 HTML） | GitHub |
| `skill-present` | 课程课件/报告 HTML 演讲系统（含 43 条 Claude 规则） | Gogs |
| `fmode-product-lab` | 新品研发（VOC + KANO + 市场 + 定位分析） | npm |

> 📊 **完整清单（含标签、版本、渠道、状态）见 [`inventory.md`](inventory.md)**，
> 机器可读真值在 `lib/inventory.mjs`。用 `skill-core inventory` 随时查看。

### 2.4 命名规则

| 形态 | 规则 | 示例 |
|------|------|------|
| 仓库名 / Hermes 技能名 | `skill-<kebab-case>` | `skill-my-thing` |
| npm 包名（部分历史技能） | `fmode-<kebab-case>` | `fmode-image` |
| skillhub slug | `fmode-skill-<kebab-case>` | `fmode-skill-my-thing` |
| CLI 命令名 | 去前缀的 kebab-case | `my-thing` |

正则：`/^(skill|fmode)-[a-z0-9]+(-[a-z0-9]+)*$/`

---

## 三、ESM-first 多端可用打包标准

### 3.1 包结构模板

```
<skill-name>/
├── package.json                  # type: module; exports: "." → lib/index.mjs
├── lib/
│   ├── index.mjs                 # ESM 入口，export 所有公共接口
│   ├── platform.mjs              # （可选）平台常量与端点真值表
│   ├── check.mjs                 # （可选）质检引擎
│   └── bootstrap.mjs             # （可选）凭证供给
├── bin/
│   └── <name>.mjs                # CLI 入口（#!/usr/bin/env node）
├── browser/
│   └── index.mjs                 # 浏览器 bundle（无 Node 依赖）
├── skills/
│   └── <skill-name>/
│       └── SKILL.md              # 技能定义文档（Agent 读这个）
├── templates/                    # （可选）脚手架模板
├── test/
│   └── smoke.mjs                 # 冒烟测试
├── README.md                     # GitHub/Gogs 首页
├── LICENSE                       # MIT
└── skill-package-manifest.json   # 元数据清单（看板数据源）
```

### 3.2 package.json 关键字段

```json
{
  "name": "skill-my-thing",
  "version": "1.0.0",
  "description": "一句话描述",
  "type": "module",
  "main": "./lib/index.mjs",
  "exports": {
    ".": {
      "import": "./lib/index.mjs",
      "default": "./lib/index.mjs"
    }
  },
  "bin": {
    "my-thing": "./bin/my-thing.mjs"
  },
  "files": [
    "lib/",
    "bin/",
    "browser/",
    "skills/",
    "README.md",
    "LICENSE",
    "skill-package-manifest.json"
  ],
  "engines": { "node": ">=18" },
  "scripts": { "test": "node test/smoke.mjs" },
  "license": "MIT",
  "dependencies": {}
}
```

**硬性约束**（`validatePackageJson()` 会逐条检查）：

| 字段 | 要求 | 原因 |
|------|------|------|
| `type` | 必须 `"module"` | ESM only |
| `main` | 必须 `"./lib/index.mjs"` | 统一入口 |
| `exports["."]` | 必须同时有 `import` 与 `default` | 多端解析一致 |
| `bin` | 对象形式，指向 `.mjs` | CLI 端 |
| `files` | 白名单必须覆盖 `lib/ bin/ skills/ README.md LICENSE manifest` | 避免发布缺文件 |
| `license` | 必须（平台统一 MIT） | 合规 |
| `require` | **禁止出现** | 不提供 CJS 入口 |
| `dependencies` | 强烈建议为空 | 母技能/服务技能应零依赖 |

> 💡 **零依赖原则**：服务层技能应尽量零依赖。平台已有 `fetch`（Node ≥18 内置）、
> `AbortSignal.timeout`、`node:test`，绝大多数需求不需要第三方包。
> 零依赖 = 安装快 + 供应链风险低 + 不会因上游破坏性升级而挂掉。

### 3.3 四端等价性原则

| 端 | 入口 | 用法 | 状态 |
|----|------|------|------|
| **CLI** | `bin/<name>.mjs` | `npx --yes <skill>@latest <command>` | ✅ 必须可用 |
| **SDK** | `lib/index.mjs` | `import { ... } from '<skill>'` | ✅ 必须可用 |
| **Browser** | `browser/index.mjs` | `<script type="module" src="...">` | ✅ 按需提供 |
| **Server** | — | `require('<skill>')` | ❌ **不可用（ESM only，团队共识）** |

#### Browser 端的硬约束

`browser/index.mjs` **禁止 import 任何 `node:` 内置模块**。只能使用 Web 标准 API：

| 可用 | 不可用 |
|------|--------|
| `fetch` / `Request` / `Response` | `node:fs` / `node:path` / `node:os` |
| `URL` / `URLSearchParams` | `node:child_process` |
| `crypto.subtle` | `node:crypto` |
| `TextEncoder` / `TextDecoder` | `node:buffer` |
| `AbortSignal.timeout` | `node:process` |

**为什么**：浏览器 bundle 要能被 `<script type="module">` 直接加载，或在 Vite/webpack
中消费。引入 `node:` 会导致构建失败或运行时报错。

**怎么测**：`checkMultiRuntime` 会自动扫描 `browser/index.mjs` 的 `node:` import 并报告。

#### Server 端为何不支持 CJS

团队共识：**ESM only**。理由：
- Node 22+ 已原生支持 ESM 与顶层 await，CJS 无技术必要性
- 双入口（CJS + ESM）会导致「双包危害」（dual package hazard）：同一模块被加载两份，
  单例状态分裂，`instanceof` 失效
- 维护成本翻倍，收益为零

需要 CJS 场景请用动态 `import()`：
```javascript
const { greet } = await import('skill-my-thing');
```

### 3.4 ESM 编码纪律

```javascript
// ✅ 正确：顶层 import
import fs from 'node:fs';
import path from 'node:path';

// ❌ 错误：ESM 里没有 require
const fs = require('node:fs');   // ReferenceError

// ❌ 错误：ESM 里没有 __dirname / __filename
console.log(__dirname);          // ReferenceError

// ✅ 正确：用 import.meta.url 推导
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ 正确：JSON 导入用 readFile + parse（不要依赖 import assertions）
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));
```

> ⚠️ **常见坑**：`export { x } from './y.mjs'` 只转发、**不产生本地绑定**。
> 如果本文件内还要用 `x`，必须额外 `import { x } from './y.mjs'`。

### 3.5 SKILL.md 的三种 frontmatter

同一个技能在不同渠道需要不同格式的 frontmatter。

#### ① Hermes 本地技能格式（`skills/<name>/SKILL.md`）

```yaml
---
name: skill-xxx
description: "简短描述（写清触发场景）"
version: 1.0.0
author: Yuyang001 (FmodeAgent)
license: MIT
tags: [tag1, tag2]
---
```

必需：`name` / `description` / `version`

#### ② skillhub.cn 格式（仓库根 `SKILL.md`）

```yaml
---
slug: fmode-skill-xxx
displayName: skill-xxx
version: 1.0.0
summary: 简短描述
license: MIT
tags: [tag1, tag2]
---
```

必需：`slug` / `displayName` / `version` / `summary` / `license`

#### ③ GitHub/Gogs README 格式（`README.md`，无 frontmatter）

```markdown
# skill-xxx · 中文标题

> 一句话定位

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 这是什么
## 安装
## 用法
## 凭据
## License
```

> 📌 **注意**：YAML frontmatter **必须从文件第一行开始**。在 `---` 之前写任何注释或
> 空行都会导致解析失败。本仓库的 `templates/skill-starter/skills/.../SKILL.md`
> 就把说明写在了 frontmatter **之后**的 HTML 注释里。

---

## 四、多渠道分发机制

### 4.1 四渠道定位

| 渠道 | 定位 | 同步方向 | 凭据位置 |
|------|------|----------|----------|
| **Gogs**（`git.fmode.cn/fmode/`） | **主仓**，内网日常迭代 | 源头 | URL 携带（内网） |
| **GitHub**（`github.com/fmodecn/`） | **公开镜像**，对外发布 | Gogs → GitHub | `~/.fmode/config.json` 的 `githubToken` |
| **npm**（`registry.npmjs.org`） | SDK/CLI 分发 | 从仓库发布 | `~/.npmrc`（账号 `fmode001`） |
| **skillhub.cn** | 社区分发（团队 `fmode` / `org-m8z913un`） | 从目录发布 | `sk-ent-...` |

**工作流**：日常迭代在 Gogs 进行 → 版本稳定后推 GitHub → 同时发 npm 与 skillhub。

### 4.2 发布清单

```bash
# ---------- Gogs（主仓）----------
git remote add origin https://fmode:<PASSWORD>@git.fmode.cn/fmode/<skill>.git
git push origin master

# ---------- GitHub（镜像）----------
git remote add github git@github.com:fmodecn/<skill>.git
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_fmodecn -o StrictHostKeyChecking=no" \
  git push github master

# ---------- npm ----------
npm publish --access public

# ---------- skillhub.cn ----------
curl -fsSL https://skillhub.cn/install/install.sh | bash -s -- --cli-only
skillhub login --key <API_KEY> --host https://api.skillhub.cn
skillhub publish <dir> --changelog "<msg>"
```

> 💡 一条命令生成完整计划：`skill-core publish .`（加 `--apply` 实际执行）。

### 4.3 建仓注意事项（实测）

| 渠道 | 建仓方式 | 实测结论 |
|------|----------|----------|
| Gogs | **Web UI 手动建**，或已登录会话 | ⚠️ `git.fmode.cn/api/v1/*` 用 basic auth 返回 **401**，匿名 API 不可用；但 `git push` 到不存在的仓库**不会自动建仓**。建仓需走 Web UI。 |
| GitHub | REST API（PAT）或 Web UI | ✅ `GET /user` 用 `githubToken` 返回 200（实测账号 `ryanemax`）。建仓：`POST /orgs/fmodecn/repos` |
| npm | 首次 `npm publish` 自动创建 | ✅ `npm whoami` = `fmode001` |
| skillhub | 首次 `skillhub publish` 自动创建 | ✅ 需先 `skillhub login` |

**GitHub 建仓示例**：

```bash
GH_TOKEN=$(python3 -c "import json;print(json.load(open('$HOME/.fmode/config.json'))['githubToken'])")
curl -X POST -H "Authorization: Bearer $GH_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/orgs/fmodecn/repos \
     -d '{"name":"skill-my-thing","description":"...","private":false,"license_template":"mit"}'
```

### 4.4 发布前检查清单

- [ ] `npm test` 通过
- [ ] `skill-core check .` 六项无失败
- [ ] 仓库内**无任何真实密钥**（`git grep -iE "sk-[a-z0-9]{20}|sk-ent-|ghp_|github_pat_"`）
- [ ] `package.json` 的 `files` 白名单覆盖 `skills/`
- [ ] 根 `SKILL.md` 的 frontmatter 是 skillhub 格式
- [ ] `README.md` 有各工具安装说明
- [ ] `LICENSE` 存在（MIT）
- [ ] `skill-package-manifest.json` 存在且 `version` 与 `package.json` 一致

---

## 五、自动质检与看板机制

### 5.1 六项检查

技能开发完成后**必须**跑六项质检。用 `skill-core check .` 一键执行。

| # | 检查项 | id | 验证方式 | 失败即 |
|---|--------|----|----------|--------|
| 1 | **功能完整性** | `functional` | 运行 `scripts.test` 或 `test/*.mjs` | 技能跑不起来 |
| 2 | **Fmode API 联通** | `apiConnectivity` | 探测 `api.fmode.cn` 与 `server.fmode.cn`（401=端点存在） | 上线后必然挂 |
| 3 | **基础 SOP 跑通** | `sop` | `skillhub publish --dry-run` + frontmatter 校验 | 发布失败 |
| 4 | **看板后台就绪** | `dashboard` | `skill-package-manifest.json` 存在且结构合法 | 看板索引不到 |
| 5 | **Loop 迭代能力** | `loop` | `npm view <name>`（轻量）/ `npx --yes <name>@latest`（`--deep`） | 用户装不上 |
| 6 | **多端可用性** | `multiRuntime` | 实测 ESM `import` + CLI `--help`，扫描 browser 的 `node:` 依赖 | 某端不可用 |

### 5.2 结果语义（关键设计）

质检结果有三种状态，**语义严格区分**：

| 状态 | 含义 | 对结论的影响 |
|------|------|--------------|
| ✅ `pass` | 有可复核证据证明通过 | — |
| ❌ `fail` | 明确失败 | **必须修复**，exit code 1 |
| ⏭️ `skip` | 无法验证（离线 / 工具缺失 / 端点未上线 / 嵌套调用） | **不算通过**，exit code 3（除非 `--allow-skip`） |

> 🎯 **为什么 skip 不等于 pass**：平台最贵的一课是「伪自举」——
> 端点 404 但代码当成成功，结果「能跑通」只是历史遗留配置的假象。
> 所以**拿不到证据就是 skip**，且 skip 会让 CI 失败，逼迫开发者显式处理。

每项检查都会输出 **evidence**（可复核的证据：命令、退出码、HTTP 码、输出片段）。
没有 evidence 的 pass 是不允许的。

### 5.3 常用命令

```bash
skill-core check .                              # 全量六项
skill-core check . --offline                    # 跳过网络项（离线开发）
skill-core check . --only functional,multiRuntime   # 只跑指定项
skill-core check . --deep                       # 真正 npx 拉取验证 Loop
skill-core check . --json                       # 机器可读（CI 集成）
skill-core check . --allow-skip                 # 有 skip 也返回 0（慎用）
```

### 5.4 看板机制

**数据源**：`skill-package-manifest.json`（每仓库根目录一个）。

```json
{
  "name": "skill-my-thing",
  "version": "1.0.0",
  "description": "一句话描述",
  "skills": [{ "name": "skill-my-thing", "path": "skills/skill-my-thing/SKILL.md" }],
  "install": "npx --yes skill-my-thing@latest workspace",
  "tier": "service",
  "platforms": ["gogs", "github", "npm", "skillhub"]
}
```

看板通过扫描各仓库的 manifest 汇总技能状态。**manifest 缺失 = 看板上看不到这个技能**，
所以它是「看板后台就绪」检查项的核心。

配套的运行时上报能力见 `skill-task-progress`（四态上报 `ack→running→done/failed` +
30s 心跳 + 交付物入库）。

### 5.5 Loop 迭代能力

**定义**：技能必须能通过 `npx --yes <skill>@latest` 被拉到并运行，形成
「开发 → 发布 → 用户拉取 → 反馈 → 再开发」的闭环。

**为什么重要**：如果用户装不上，再好的功能也是零。

**验证**：
- 轻量（默认）：`npm view <name> version` —— 确认包在 registry 上可解析
- 深度（`--deep`）：真正执行 `npx --yes <name>@latest --help`，确认 bin 入口可运行

**常见失败原因**：bin 入口缺 shebang、bin 文件未包含在 `files` 白名单、
`bin` 字段指向了不存在的文件。

---

## 六、一键凭证供给机制

### 6.1 诚实声明（先读这段）

任务书描述的「手机号 + 验证码 → 自动创建 `~/.fmode/`」路径依赖端点：

```
POST https://server.fmode.cn/api/fmode/verifycode
```

**该端点实测返回 404，服务端尚未上线**（真值表状态 `planned`）。
因此本技能的 `lib/bootstrap.mjs` **不会伪造短信流程假装成功** ——
它会探测端点，未上线时明确返回 `{ ok: false, planned: true }` 并给出可执行的替代路径。

### 6.2 当前真实可用的自举路径

**sessionToken → API token 自举**（生产实测，与 `skill-listen` / `skill-vision` 同源）：

```
用户浏览器登录 FMODE Studio
    ↓  取得 sessionToken（形如 r:xxxxx）
写入 FMODE_SESSION_TOKEN 环境变量 或 ~/.fmode/config.json 的 "sessionToken"
    ↓
POST https://server.fmode.cn/api/fmode/voc-skill/install-prompt
     header: x-parse-session-token: <sessionToken>
     body:   { channel: "claude-code", scope: "user" }
    ↓
从 body.data.prompt 文本中提取  /sk-(?!ant-)[A-Za-z0-9_-]{8,}/
    ↓
fmode API token（sk- 开头）—— 仅内存持有，不落盘、不进日志
```

> ⚠️ 服务端**唯一**以 session 鉴权并返回 token 本体的端点是 `voc-skill/install-prompt`。
> token 内嵌在返回的 prompt 文本中，必须用正则提取。

### 6.3 标准 5 级凭据解析链

**所有技能必须实现这条链**（命中即用，逐级回落）：

| 级 | 来源 | 说明 |
|----|------|------|
| **0** | `FMODE_SESSION_TOKEN` / `~/.fmode/config.json` 的 `sessionToken` | 自举换 API token（仅内存持有） |
| **1** | 环境变量 `FMODE_API_TOKEN` | 最直接的显式配置 |
| **2** | `~/.fmode/config.json` → `fmodeApiToken` / `newapiToken` | FMODE Studio 保存写这里 |
| **3** | `<cwd>/.fmode/config.json` → `fmodeApiToken` / `newapiToken` | 项目级覆盖 |
| **4** | `~/.claude/settings.json`（含 `.local` / 项目级）→ `env.ANTHROPIC_AUTH_TOKEN` | **fmode 的 newapi SK 默认就是 Claude Code 的 token** |

**第 4 级为什么重要**：用户按 Claude Code 的正常方式配好了 SK，技能却「看不见」，
判缺 token → 掉进付费弹窗死循环。这是真实事故，所以必须读这个文件。

**token 校验规则**：
- 必须以 `sk-` 开头
- **必须排除** `sk-ant-`（真正的 Anthropic 官方 key）
- 若设置了 `ANTHROPIC_BASE_URL`，必须指向 `fmode`

**全链失败时**：打印初始化向导 + **退出码 2**。绝不伪装成功。

### 6.4 目录供给（幂等）

```javascript
import { ensureFmodeDir, writeConfig } from 'skill-core-guide';

// 创建 ~/.fmode/{,credentials,projects}（700 权限），已存在则跳过
ensureFmodeDir();

// 幂等合并写入 config.json（600 权限）
// ⚠️ 敏感字段（sessionToken / apiKey / githubToken / password / secret）会被拒绝写入
writeConfig({ storageProjectId: 'proj-xxx', obsBucket: 'my-bucket' });
```

> 🔒 **安全设计**：`writeConfig()` 内置敏感字段黑名单，**拒绝**写入
> `sessionToken` / `apiKey` / `apiKeys` / `githubToken` / `password` / `secret`。
> 这些值必须由用户自己写，避免技能代写导致泄露。

### 6.5 检查凭据状态

```bash
npx --yes skill-core-guide@latest bootstrap
```

输出示例：

```
  Fmode 凭证自举状态
  ────────────────────────────────────────────────────────────
  ~/.fmode 目录：/opt/data/home/.fmode
  ✅ ensure-fmode-dir：目录已存在（幂等）
  ✅ resolve-credential：第 0 级命中：env:FMODE_SESSION_TOKEN
  ✅ verify-credential：token 形态校验通过（sk- 前缀，非 sk-ant-）
  ────────────────────────────────────────────────────────────
  结果：✅ 凭据可用（sessionToken 自举，sk-abc...wxyz）
```

### 6.6 端点上线后的启用方式

`/api/fmode/verifycode` 上线后，**只需改一处**：

```javascript
// lib/platform.mjs
verifyCode: {
  ...
  status: 'planned',   // ← 改成 'live'
}
```

`requestVerifyCode()` / `verifyAndProvision()` 会自动启用短信路径，无需改其他代码。

---

## 七、新技能开发 SOP

### 7.1 完整流程

```bash
# ---------- 1. 从母技能创建脚手架 ----------
npx --yes skill-core-guide@latest init my-thing --name skill-my-thing
cd skill-my-thing

# ---------- 2. 初始化 git ----------
git init
git config user.email "liu@fmode.cn"
git config user.name "liuyuyang"

# ---------- 3. 写技能契约 ----------
# skills/skill-my-thing/SKILL.md
#   - frontmatter: name / description / version / tags（Hermes 格式）
#   - 「何时使用」写清触发场景（Agent 靠这个决定要不要调用）
#   - 「能力边界」写清能做/不能做

# ---------- 4. 实现 SDK ----------
# lib/index.mjs —— export 所有公共接口
#   - 零依赖优先
#   - 平台 URL 从常量取，不硬编码
#   - 凭据走 5 级链

# ---------- 5. 实现 CLI ----------
# bin/my-thing.mjs —— #!/usr/bin/env node
#   - 必须支持 --help / --version
#   - 必须有 workspace 子命令（npx 约定入口）

# ---------- 6. 补 README / 根 SKILL.md / LICENSE ----------
# README.md       —— GitHub/Gogs 首页，含各工具安装说明
# SKILL.md        —— skillhub 格式 frontmatter（发布必需）
# LICENSE         —— MIT

# ---------- 7. 跑通 ----------
npm test

# ---------- 8. 六项质检 ----------
npx --yes skill-core-guide@latest check .

# ---------- 9. 本地链接试用 ----------
npm link && my-thing --help

# ---------- 10. 建仓（Web UI / REST API）----------
# Gogs:   https://git.fmode.cn  → 新建 fmode/skill-my-thing
# GitHub: POST /orgs/fmodecn/repos

# ---------- 11. 四渠道发布 ----------
git remote add origin https://fmode:<PWD>@git.fmode.cn/fmode/skill-my-thing.git
git add -A && git commit -m "skill-my-thing v0.1.0: 首版"
git push origin master

git remote add github git@github.com:fmodecn/skill-my-thing.git
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_fmodecn" git push github master

npm publish --access public

skillhub login --key <API_KEY> --host https://api.skillhub.cn
skillhub publish . --changelog "首版"
```

### 7.2 脚手架生成的结构

```
skill-my-thing/
├── SKILL.md                       # skillhub 格式（根目录）
├── README.md                      # 各工具安装说明
├── LICENSE                        # MIT
├── package.json                   # __SKILL_NAME__ 占位符已替换
├── skill-package-manifest.json    # 看板数据源
├── lib/index.mjs                  # SDK 入口（含凭据链示例）
├── bin/my-thing.mjs               # CLI（greet/auth/workspace）
├── skills/skill-my-thing/SKILL.md # 技能契约（Hermes 格式）
└── test/smoke.mjs                 # 冒烟测试
```

### 7.3 开发纪律（写给 Agent）

| 纪律 | 说明 |
|------|------|
| **先写 SKILL.md 再写代码** | 「何时使用」写不清楚，说明技能定位没想清楚 |
| **端到端跑通再发布** | `npm test` + `check` 全绿；不允许「应该能跑」 |
| **不伪造任何结果** | 采集失败就说失败，发布失败就说失败 |
| **零密钥入库** | 提交前 `git grep` 扫一遍密钥模式 |
| **平台 URL 引用常量** | 平台迁移时只改一处 |
| **planned 端点先探测** | 404 时显式回落并告知用户 |
| **版本语义** | 破坏性变更 → major；新能力 → minor；修复 → patch |

---

## 八、事故复盘：本规范为什么这么写

规范里的每条「⚠️」都对应一次真实事故。理解事故才能理解规范。

### 8.1 「伪自举」事故 —— skip ≠ pass 的由来

**背景**：`skill-storage` 0.2.x 实现了「登录即可上传」：用 sessionToken 调
`POST /api/storage/credentials` 换 OBS STS。

**问题**：该端点**从未上线**（HEAD/GET 探测恒 404），设计文档里状态是「规划中」。

**为什么没被发现**：部分环境「能跑」，因为那些机器上有**历史遗留的手工
`~/.obsutilconfig`**，凭据链的第 1/2 级回落生效了。其他机器无此文件即全链死。
「能跑通」是假象。

**修复（0.3.0）**：
- 该路径降级为 `--experimental-sts`（探测 200 才启用）
- 第 3 级改用**真实上线**的 `/api/apig/deploy/huaweicloud`
- **全链失败时明确打印初始化向导并退出码 2，不再伪装成功**

**沉淀为规范**：
- 端点真值表区分 `live` / `planned` / `deprecated`（§1.3）
- 质检的 `skip` 状态**不算通过**，且导致 CI 失败（§5.2）
- 每项检查必须给出 evidence（§5.2）

### 8.2 「看不见 token」事故 —— 第 4 级凭据的由来

**问题**：用户按 Claude Code 的正常方式配好了 SK（写在 `~/.claude/settings.json` 的
`env.ANTHROPIC_AUTH_TOKEN`），但技能只读进程环境变量，**从不读这个文件** →
判缺 token → 掉进旧付费弹窗死循环。

**关键认知**：**fmode 的 newapi SK 默认就是 Claude Code 的 `ANTHROPIC_AUTH_TOKEN`**。

**沉淀为规范**：凭据链第 4 级必须读 Claude Code settings（§6.3），
且要覆盖 `.local` 与项目级文件。

### 8.3 「BOM 解析失败」事故

**问题**：用户手工保存的 `config.json` 带 UTF-8 BOM（`EF BB BF`），
`JSON.parse` 直接抛错，技能判为「配置损坏」。

**沉淀为规范**：解析任何用户可能手改的 JSON 前必须剥 BOM（§1.2）。

### 8.4 「假成功」事故 —— ESM 空日志

**问题**：spawn 子进程执行命令，日志为空、exit 0，被当成成功。
实际是 `command not found` 被 shell 吞掉，或用了相对路径而 cwd 不对。

**沉淀为规范**：用绝对路径调用可执行文件；判断成功要看**产物**（文件存在、
HTTP 200、内容非空），不看退出码 alone（§7.3）。

### 8.5 「双包危害」—— 为什么 ESM only

**问题**：同时提供 CJS 与 ESM 入口时，同一模块可能被加载两份，单例状态分裂。

**沉淀为规范**：ESM only，不提供 CJS 入口；CJS 场景用动态 `import()`（§3.3）。

---

## 九、附录

### 9.1 CLI 命令参考

```bash
skill-core --help                   # 帮助
skill-core --version                # 版本
skill-core init [dir] --name <n>    # 从脚手架创建新技能
skill-core check [dir]              # 六项自动质检
skill-core verify [dir]             # 静态校验（不执行代码）
skill-core publish [dir]            # 生成四渠道发布计划
skill-core inventory                # 技能清单
skill-core bootstrap                # 凭据自举状态
skill-core spec                     # 平台规范摘要
skill-core endpoints                # 端点真值表
```

### 9.2 SDK API 参考

```javascript
import {
  // 平台真值
  PLATFORM, ENDPOINTS, endpointsByStatus,
  CREDENTIAL_CHAIN, TOKEN_RULES, TIERS, RUNTIMES, CHANNELS,
  // 校验器
  validateName, validatePackageJson, validateManifest,
  validateFrontmatter, parseFrontmatter,
  // 质检
  CHECKS, runChecks, summarize, renderReport,
  checkFunctional, checkApiConnectivity, checkSop,
  checkDashboard, checkLoop, checkMultiRuntime,
  // 凭据
  bootstrap, resolveApiToken, resolveSessionToken,
  ensureFmodeDir, writeConfig, describeBootstrapStatus, maskToken,
  // 清单
  INVENTORY, byTier, byPlatform, stats,
  // 分发
  publishPlan,
} from 'skill-core-guide';
```

### 9.3 浏览器端 API

```javascript
import { PLATFORM, ENDPOINTS, validatePackageJson, checkApiConnectivity } from 'skill-core-guide/browser';
```

### 9.4 相关技能

| 技能 | 关系 |
|------|------|
| `skill-heterarchy` | 认知协同范式（多心智并行开发） |
| `skill-multi-branch` | 任务派发框架（沟通层 → 执行层） |
| `skill-task-progress` | 进度与交付物上报（看板运行时数据） |
| `skill-storage` | 存储接入的权威参考实现 |
| `skill-listen` / `skill-vision` | 凭据链与自举的生产参考实现 |

### 9.5 变更记录

#### 1.0.0
- 首版：平台端点真值表（实测 2026-09-22）、技能分层清单、ESM-first 四端标准、
  四渠道分发、六项自动质检、诚实凭证供给、脚手架模板
- 端点真值修正：任务书描述的 `/api/storage/upload`、`/api/image/generate`、
  `/api/vision/analyze`、`/api/fmode/verifycode` 实测均为 404（planned），
  已在真值表中标注并给出替代路径
- 真实端点补充：`/v1/images/generations`（live）、`/api/apig/deploy/huaweicloud`（live）、
  `/api/fmode/voc-skill/install-prompt`（live，凭据自举唯一通道）

## License

MIT © 2026 Fmode (未来飞马)
