---
slug: fmode-skill-core-guide
displayName: skill-core-guide
version: 1.0.5
summary: Fmode Harness 平台母技能标准指南 —— 平台端点真值表、ESM-first 四端标准、元数据规范、四渠道分发、六项自动质检、一键凭证供给、新技能脚手架。
description: "Fmode 技能生态的宪法级规范文档。定义平台端点真值表（live/planned/deprecated 三态）、ESM-first 四端等价打包标准、元数据与标签规范、Gogs/GitHub/npm/skillhub 四渠道分发、六项自动质检（skip≠pass）、5 级诚实凭据链与新技能脚手架。读它不需要先读任何别的文档。The constitution of the Fmode skill ecosystem — platform endpoint truth table, ESM-first packaging standard, metadata spec, four-channel distribution, six-point quality gate."
platform: HermesAgent
level: 系统级
category: 平台基础设施
icon: "emoji: 📐"
homepage: https://git.fmode.cn/fmode/skill-core-guide
license: MIT
author: Yuyang001 (FmodeAgent)
tags: [HermesAgent, FmodeAgent, 系统级, 平台基础设施, 规范, standard, spec, meta, scaffold, harness, esm, quality-check]
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
- [三、元数据规范](#三元数据规范)
- [四、ESM-first 多端可用打包标准](#四esm-first-多端可用打包标准)
- [五、多渠道分发机制](#五多渠道分发机制)
- [六、自动质检与看板机制](#六自动质检与看板机制)
- [七、一键凭证供给机制](#七一键凭证供给机制)
- [八、新技能开发 SOP](#八新技能开发-sop)
- [九、事故复盘：本规范为什么这么写](#九事故复盘本规范为什么这么写)
- [十、附录](#十附录)

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
| 7 | `server.fmode.cn/api/storage/credentials` | POST | ✗ **deprecated** | Bearer sessionToken | 从未上线（恒 404），见 §9.1 事故复盘 |
| 8 | `server.fmode.cn/api/image/generate` | POST | 🕓 planned | Bearer `sk-` | 网关侧图像生成（未上线，用 #2 代替） |
| 9 | `server.fmode.cn/api/vision/analyze` | POST | 🕓 planned | Bearer `sk-` | 网关侧视觉识别（未上线，用 #1 多模态代替） |
| 10 | `server.fmode.cn/api/fmode/verifycode` | POST | 🕓 planned | 无 | 手机号验证码（未上线，见 §7） |

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

## 三、元数据规范

技能元数据是**分发渠道的检索面**：skillhub.cn / npm / GitHub 的搜索排名、
Agent 的技能选择、看板页面的渲染，全部读同一份字段。字段缺失或写法随意，
技能就等于「发布即隐身」。

> 本规范是**母技能自持**的：本章定义的字段，`skill-core-guide` 自己必须满足。
> 全生态 17 个技能的当前取值见 [`inventory.md`](inventory.md) 与
> [`awesome.md`](awesome.md)。

### 3.1 每个技能的元数据字段

| 字段 | 必填 | 说明 | 举例 |
|------|------|------|------|
| **slug** | ✅ | 全网唯一标识（skillhub 主键） | `fmode-skill-heterarchy` |
| **displayName** | ✅ | 对外展示名（= 仓库名） | `skill-heterarchy` |
| **version** | ✅ | 语义化版本（小步迭代） | `0.0.11` |
| **summary** | ✅ | 一句话简介（中英文双语） | `内异层认知协同 — 单一Agent主体内部分化多心智并行…` |
| **description** | ✅ | 详细描述（3-5 句） | 讲清「是什么 / 解决什么问题 / 怎么用」 |
| **tags** | ✅ | 关键词标签数组 | `[HermesAgent, FmodeAgent, 系统级, cognition, parallel]` |
| **platform** | ✅ | 目标平台 | `HermesAgent` ｜ `FmodeCode/ClaudeCode` ｜ `Both` |
| **level** | ✅ | 能力层级 | `系统级` ｜ `服务级` ｜ `应用级` |
| **category** | ✅ | 应用类别 / 行业 | `工具效率` ｜ `内容创作` ｜ `图像视觉` ｜ `音频处理` ｜ `平台基础设施` |
| **icon** | ✅ | 图标标识 | `emoji: 🤖` |
| **homepage** | 可选 | 项目主页 | `https://git.fmode.cn/fmode/skill-xxx` |
| **license** | ✅ | 开源协议 | `MIT` |
| **author** | ✅ | 维护者 | `Yuyang001 (FmodeAgent)` |
| **changelog** | ✅ | 变更说明 | 每次发布必须更新 |

**与 §3.5 frontmatter 的关系**：上表是**逻辑字段全集**，§3.5 的三种 frontmatter
是它在各渠道的**物理落位**——Hermes 本地技能用 `name/description/version/tags`，
仓库根 `SKILL.md` 用 `slug/displayName/version/summary/license`，
看板/清单用 `level/category/icon/platform`。字段名可随渠道变化，**语义不可变**。

### 3.2 标签分类体系

`tags` 不是自由发挥的关键词堆，而是**三个正交维度**的组合。任意技能的 tags
都应能拆成「平台 + 层级 + 行业/类别」三类。

#### 平台标签

| 标签 | 含义 |
|------|------|
| `HermesAgent` | 运行在 Hermes Agent 上，利用其工具 / 通道 / 记忆 / 技能体系 |
| `FmodeAgent` | Fmode 品牌通用标签 |
| `FmodeCode` | 为 Claude Code / FmodeCode CLI 设计 |
| `ClaudeCode` | 兼容 Claude Code 执行端 |

#### 层级标签

| 标签 | 含义 | 代表技能 |
|------|------|----------|
| `系统级` | 底层运行、消息机制、基础功能 | `skill-heterarchy`、`skill-core-guide` |
| `服务级` | 云资源、模型、拓展能力 | `skill-vision`、`skill-image`、`skill-storage` |
| `应用级` | 具体业务场景、SOP、行业应用 | `skill-product-lab`、`skill-study-report` |

#### 行业 / 类别标签

`工具效率`、`内容创作`、`图像视觉`、`音频处理`、`平台基础设施`、
`数据管理`、`学习复盘`、`新品研发`

> 📌 层级标签与 §2 的三层分类体系（`system` / `service` / `application`）
> 是同一件事的两种写法：中文标签给人看，英文 `tier` 给机器读
> （见 `lib/inventory.mjs` 的 `TIERS`）。

### 3.3 SEO 优化原则（用于 skillhub.cn 等平台搜索排名）
### 3.4 GEO/SEO/品牌/开源协议综合规范（v1.0）

> 参考：fmode-studio website（站点地图/sitemap/llms.txt/Open Graph/Schema.org）、
> MPL-2.0 协议规范、ESM 超级技能打包标准

#### 3.4.1 README 标准结构（每个技能仓库必须遵守）

```
1. 项目标题 & 品牌 Slogan
   「未来飞马 — 让AI进化提前发生，让AI落地快人一步」
2. 简介：技能是什么；超级技能（ESM）特性说明
3. 核心定位：能力边界与相似技能区分
4. 核心能力 & 交付物说明
5. 理论背景（若有）/ 技术原理
6. 快速开始（ESM 代码示例，浏览器+Node 两种极简示例）
7. FAQ（SEO 关键词埋点：技术、开源协议、业务问题三块）
8. GEO 埋点说明（非强制采集，默认关闭，隐私声明）
9. License & Trademark Notice（MPL-2.0 协议 + 商标声明）
10. 贡献指南
11. 相关项目：Harness Loop、RSI、Hermes
```

#### 3.4.2 HTML 元数据标准（skillhub/网站发布用）

```
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="未来飞马技能：...">
<meta name="robots" content="index, follow">
<meta property="og:type" content="website">
<meta property="og:url" content="https://git.fmode.cn/fmode/skill-xxx">
<meta property="og:title" content="skill-xxx —— 未来飞马">
<meta property="og:description" content="...">
<meta property="og:image" content="https://app.fmode.cn/logo/feima.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:site_name" content="未来飞马 Fmode">
<meta property="og:locale" content="zh_CN">
<meta name="twitter:card" content="summary_large_image">
```

#### 3.4.3 package.json SEO 关键词规范

keywords 数组必须涵盖英文+中文术语。通用模板（各技能按自身特点增减）：

```json
"keywords": [
  "fmode", "hermes", "harness-loop", "rsi",
  "ai-agent", "agent-skill", "super-skill",
  "esm", "未来飞马", "智能体技能",
  "harness", "<技能特有英文关键词>", "<技能特有中文关键词>"
]
```

#### 3.4.4 开源协议规范

**强制使用 MPL-2.0**（Mozilla Public License 2.0），唯一例外：已发布的 MIT 技能保持 MIT。

- `LICENSE` 文件放 MPL-2.0 完整原文
- `package.json` 设 `"license": "MPL-2.0"`
- 每个 ESM 源文件头部加版权+商标注释模板（见 §3.4.5）
- README 设独立 `## License` 和 `## Trademark Notice` 小节

#### 3.4.5 源码头部注释模板

```javascript
// Copyright (c) 未来飞马
//
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// Trademark Notice:
// The MPL-2.0 license grants copyright permissions for source code only.
// It does NOT grant any rights to use trademarks including "未来飞马",
// "Harness Loop", "RSI", and associated slogan "让AI进化提前发生，让AI落地快人一步".
// Any use of these trademarks requires separate written permission.
```

#### 3.4.6 GEO 埋点规范（GEO Tracking）

- 默认关闭（`geoTracking: false`）；用户显式开启才上报
- 只采集地区级别信息（国家/大区），不采集城市、IP、设备ID、经纬度
- 埋点逻辑独立模块，可单独移除
- README/FAQ 必须说明用途+隐私声明
- 上报失败不阻塞主技能逻辑

#### 3.4.7 站点地图与 LLM 友好

每个 repo 根目录可放置：
- `llms.txt` —— 描述技能仓库结构，帮助 AI 快速理解
- GitHub About 字段填写简介 + 关键词 SEO 埋点

#### 3.4.8 商标声明（固定文案，所有仓库复用）

> MPL-2.0 governs copyright for source code only.
> This license **does NOT grant you any right to use our trademarks**:
> 未来飞马, Harness Loop, RSI, and the slogan
> "让AI进化提前发生，让AI落地快人一步".
>
> You may not use these trademarks in your product name, marketing,
> documentation, or public promotion unless you obtain separate written
> permission from 未来飞马.

---

### 3.5 发布前综合检查清单（13项）

每个技能仓库发布前必须逐项检查：

```
□ 1. LICENSE 文件：MPL-2.0 原文（已发布 MIT 的保持 MIT）
□ 2. README 完整结构：品牌+简介+定位+快速开始+FAQ+GEO+许可+商标
□ 3. README 首行/简介中固定品牌 Slogan
□ 4. 每个源文件头部已加版权+商标注释模板
□ 5. package.json: type=module, license=MPL-2.0, keywords 含英+中
□ 6. package.json exports 配好 ESM 多端兼容
□ 7. FAQ 三块：技术概念 + MPL-2.0 协议 + 业务用户搜索
□ 8. 元数据（skill manifest / SKILL.md frontmatter）：copyright、tags 含品牌词
□ 9. Open Graph 元数据（skillhub/GitHub 发布用）
□ 10. GEO 埋点：默认关闭、隐私声明、不阻塞
□ 11. 商标声明独立存在（不暗示 MPL 授予商标权）
□ 12. ESM 示例代码：浏览器原生 import + Node.js 双端验证
□ 13. HTML/markdown 中没有硬编码竞争对手/不相关品牌名

检查项分布对应到已有六项质检的哪个 slot（v2 升级时合并）
```

---

### 3.6 SEO 关键词总表（所有技能文档复用）

**英文**
`fmode, hermes, harness-loop, rsi, ai-agent, agent-skill, super-skill, esm, cognitive-collaboration, deliverables, large-language-model, agent-orchestration, future-feima`

**中文**
`未来飞马，Harness Loop，RSI，Hermes智能体，智能体技能，超级技能，内异层协同，AI心智协同，任务委派，AI交付物，大模型编排，AI工作流，ESM，驾驭工程`


平台搜索按「标题 / summary 命中 + 标签匹配 + 更新活跃度」排序。四条硬规则：

1. **summary 前 15 个字必须包含核心关键词** —— 搜索结果只截前 15 字，
   把「做什么」写在最前面，不要写「一款…」「基于…」这类铺垫。
2. **中英文双语描述** —— 中文为主体，英文辅助检索
   （`summary` 中文 + `description` 内附英文段落）。
3. **tags 至少包含三类各一个** —— 一个分类标签 + 一个平台标签 + 一个层级标签。
4. **每次发布必须更新 `version` + `changelog`** —— 活跃度是排名因子，
   版本不动的技能会持续掉权。

> ⚠️ **反面案例**：`summary: 一款基于大模型的技能` —— 前 15 字无关键词、
> 无平台、无层级、无行业标签，在 skillhub 搜索里等同于不存在。

---

## 四、ESM-first 多端可用打包标准

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

## 五、多渠道分发机制

### 5.1 四渠道定位

| 渠道 | 定位 | 同步方向 | 凭据位置 |
|------|------|----------|----------|
| **Gogs**（`git.fmode.cn/fmode/`） | **主仓**，内网日常迭代 | 源头 | URL 携带（内网） |
| **GitHub**（`github.com/fmodecn/`） | **公开镜像**，对外发布 | Gogs → GitHub | `~/.fmode/config.json` 的 `githubToken` |
| **npm**（`registry.npmjs.org`） | SDK/CLI 分发 | 从仓库发布 | `~/.npmrc`（账号 `fmode001`） |
| **skillhub.cn** | 社区分发（团队 `fmode` / `org-m8z913un`） | 从目录发布 | `sk-ent-...` |

**工作流**：日常迭代在 Gogs 进行 → 版本稳定后推 GitHub → 同时发 npm 与 skillhub。

### 5.2 发布清单

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

### 5.3 建仓注意事项（实测）

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

### 5.4 发布前检查清单

- [ ] `npm test` 通过
- [ ] `skill-core check .` 六项无失败
- [ ] 仓库内**无任何真实密钥**（`git grep -iE "sk-[a-z0-9]{20}|sk-ent-|ghp_|github_pat_"`）
- [ ] `package.json` 的 `files` 白名单覆盖 `skills/`
- [ ] 根 `SKILL.md` 的 frontmatter 是 skillhub 格式
- [ ] `README.md` 有各工具安装说明
- [ ] `LICENSE` 存在（MIT）
- [ ] `skill-package-manifest.json` 存在且 `version` 与 `package.json` 一致

---

## 六、自动质检与看板机制

### 6.1 十三项检查（v2 升级 · GEO/品牌/许可）

> 在原六项检查基础上，集成了 §3.4 的 GEO/SEO/品牌/许可规范检查，
> 形成发布前 13 项完全上架检查清单：

| # | 检查项 | key | 说明 |
|---|--------|-----|------|
| 1 | **npm 发布可达** | `npmPublishable` | `npm pack --dry-run` 通过，`package.json` 元数据完整 |
| 2 | **Fmode API 联通** | `apiConnectivity` | 探测 `api.fmode.cn` 与 `server.fmode.cn`（401=端点存在） |
| 3 | **LICENSE 文件** | `licenseFile` | MPL-2.0 原文（已发布 MIT 技能保持 MIT） |
| 4 | **源文件注释** | `sourceHeader` | 每个 ESM 源文件已有版权+商标注释模板 |
| 5 | **README 完整** | `readmeComplete` | 结构包含：品牌+简介+QuickStart双端+GEO+FAQ+许可+商标 |
| 6 | **package.json ESM** | `esmPackage` | `type:module` + `exports` 多端 + `keywords` 中英文 |
| 7 | **FAQ 三块齐全** | `faqComplete` | 技术概念 + MPL 协议 + 业务搜索各至少 3 条 |
| 8 | **元数据（skill manifest）** | `skillManifest` | frontmatter 含 copyright + tags 含品牌词 |
| 9 | **Open Graph 元数据** | `openGraph` | OG:title/desc/image/site_name/url |
| 10 | **SEO 关键词** | `seoKeywords` | README、GitHub About、npm keywords 统一 |
| 11 | **GEO 埋点规范** | `geoTracking` | 默认关闭 + 隐私声明 + 不阻塞主逻辑 |
| 12 | **商标声明** | `trademarkNotice` | README 有独立 `## Trademark Notice` 小节 |
| 13 | **ESM 示例双端** | `esmExamples` | README 有浏览器 + Node.js 两套示例代码 |

技能开发完成后**必须**跑六项质检。用 `skill-core check .` 一键执行。

| # | 检查项 | id | 验证方式 | 失败即 |
|---|--------|----|----------|--------|
| 1 | **功能完整性** | `functional` | 运行 `scripts.test` 或 `test/*.mjs` | 技能跑不起来 |
| 2 | **Fmode API 联通** | `apiConnectivity` | 探测 `api.fmode.cn` 与 `server.fmode.cn`（401=端点存在） | 上线后必然挂 |
| 3 | **基础 SOP 跑通** | `sop` | `skillhub publish --dry-run` + frontmatter 校验 | 发布失败 |
| 4 | **看板后台就绪** | `dashboard` | `skill-package-manifest.json` 存在且结构合法 | 看板索引不到 |
| 5 | **Loop 迭代能力** | `loop` | `npm view <name>`（轻量）/ `npx --yes <name>@latest`（`--deep`） | 用户装不上 |
| 6 | **多端可用性** | `multiRuntime` | 实测 ESM `import` + CLI `--help`，扫描 browser 的 `node:` 依赖 | 某端不可用 |

### 6.2 结果语义（关键设计）

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

### 6.3 常用命令

```bash
skill-core check .                              # 全量六项
skill-core check . --offline                    # 跳过网络项（离线开发）
skill-core check . --only functional,multiRuntime   # 只跑指定项
skill-core check . --deep                       # 真正 npx 拉取验证 Loop
skill-core check . --json                       # 机器可读（CI 集成）
skill-core check . --allow-skip                 # 有 skip 也返回 0（慎用）
```

### 6.4 看板机制

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

### 6.5 Loop 迭代能力

**定义**：技能必须能通过 `npx --yes <skill>@latest` 被拉到并运行，形成
「开发 → 发布 → 用户拉取 → 反馈 → 再开发」的闭环。

**为什么重要**：如果用户装不上，再好的功能也是零。

**验证**：
- 轻量（默认）：`npm view <name> version` —— 确认包在 registry 上可解析
- 深度（`--deep`）：真正执行 `npx --yes <name>@latest --help`，确认 bin 入口可运行

**常见失败原因**：bin 入口缺 shebang、bin 文件未包含在 `files` 白名单、
`bin` 字段指向了不存在的文件。

---

## 七、一键凭证供给机制

### 7.0 运行身份与凭据自举铁则（Agent Identity & Credential Bootstrapping）

> **所有需要鉴权的平台调用（云函数 / API / OBS / 上报）在动手前，必须先高兼容解析两件事**：

**① 我是谁（agentId）** —— 语义名 `agent-node` 等，**绝不回退到 docker hostname**（容器重启后 hash 会变）。
解析链：`FMODE_AGENT_ID` > `AGENT_ID` > `~/.fmode/config.json` > `<cwd>/.fmode/config.json`。

**② 我凭什么（sessionToken）** —— 只控制 ACL，不告知「是谁干活」。解析链：
`FMODE_SESSION_TOKEN`（env）> `~/.fmode/config.json` > `~/.fmode/config/user.json` > `<cwd>/.fmode`。
**坑**：HM 容器常不把 sessionToken 写入 env，技能必须主动读配置文件兜底。

**全链枯竭兜底**：触发验证码登录重新初始化（端点未上线则打向导，**绝不伪造 token 假装成功**）。

> 完整规范见 [`docs/agent-identity-bootstrap.md`](docs/agent-identity-bootstrap.md)。
> 事故背景：交付物上报静默失效 —— 容器重建后 agentId 变 hostname、sessionToken 未进 env，双缺失导致
> `404 agent not found` / `403 only owner or superadmin can report`。

### 7.1 诚实声明（先读这段）

任务书描述的「手机号 + 验证码 → 自动创建 `~/.fmode/`」路径依赖端点：

```
POST https://server.fmode.cn/api/fmode/verifycode
```

**该端点实测返回 404，服务端尚未上线**（真值表状态 `planned`）。
因此本技能的 `lib/bootstrap.mjs` **不会伪造短信流程假装成功** ——
它会探测端点，未上线时明确返回 `{ ok: false, planned: true }` 并给出可执行的替代路径。

### 7.2 当前真实可用的自举路径

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

### 7.3 标准 5 级凭据解析链

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

### 7.4 目录供给（幂等）

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

### 7.5 检查凭据状态

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

### 7.6 端点上线后的启用方式

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

## 八、新技能开发 SOP

### 8.1 完整流程

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

### 8.2 脚手架生成的结构

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

### 8.3 开发纪律（写给 Agent）

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

## 九、事故复盘：本规范为什么这么写

规范里的每条「⚠️」都对应一次真实事故。理解事故才能理解规范。

### 9.1 「伪自举」事故 —— skip ≠ pass 的由来

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
- 质检的 `skip` 状态**不算通过**，且导致 CI 失败（§6.2）
- 每项检查必须给出 evidence（§6.2）

### 9.2 「看不见 token」事故 —— 第 4 级凭据的由来

**问题**：用户按 Claude Code 的正常方式配好了 SK（写在 `~/.claude/settings.json` 的
`env.ANTHROPIC_AUTH_TOKEN`），但技能只读进程环境变量，**从不读这个文件** →
判缺 token → 掉进旧付费弹窗死循环。

**关键认知**：**fmode 的 newapi SK 默认就是 Claude Code 的 `ANTHROPIC_AUTH_TOKEN`**。

**沉淀为规范**：凭据链第 4 级必须读 Claude Code settings（§7.3），
且要覆盖 `.local` 与项目级文件。

### 9.3 「BOM 解析失败」事故

**问题**：用户手工保存的 `config.json` 带 UTF-8 BOM（`EF BB BF`），
`JSON.parse` 直接抛错，技能判为「配置损坏」。

**沉淀为规范**：解析任何用户可能手改的 JSON 前必须剥 BOM（§1.2）。

### 9.4 「假成功」事故 —— ESM 空日志

**问题**：spawn 子进程执行命令，日志为空、exit 0，被当成成功。
实际是 `command not found` 被 shell 吞掉，或用了相对路径而 cwd 不对。

**沉淀为规范**：用绝对路径调用可执行文件；判断成功要看**产物**（文件存在、
HTTP 200、内容非空），不看退出码 alone（§8.3）。

### 9.5 「双包危害」—— 为什么 ESM only

**问题**：同时提供 CJS 与 ESM 入口时，同一模块可能被加载两份，单例状态分裂。

**沉淀为规范**：ESM only，不提供 CJS 入口；CJS 场景用动态 `import()`（§4.3）。

---

## 十、附录

### 10.1 CLI 命令参考

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

### 10.2 SDK API 参考

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

### 10.3 浏览器端 API

```javascript
import { PLATFORM, ENDPOINTS, validatePackageJson, checkApiConnectivity } from 'skill-core-guide/browser';
```

### 10.4 相关技能

| 技能 | 关系 |
|------|------|
| `skill-heterarchy` | 认知协同范式（多心智并行开发） |
| `skill-multi-branch` | 任务派发框架（沟通层 → 执行层） |
| `skill-task-progress` | 进度与交付物上报（看板运行时数据） |
| `skill-storage` | 存储接入的权威参考实现 |
| `skill-listen` / `skill-vision` | 凭据链与自举的生产参考实现 |

### 10.5 变更记录

#### 1.0.0
- 首版：平台端点真值表（实测 2026-09-22）、技能分层清单、ESM-first 四端标准、
  四渠道分发、六项自动质检、诚实凭证供给、脚手架模板
- 端点真值修正：任务书描述的 `/api/storage/upload`、`/api/image/generate`、
  `/api/vision/analyze`、`/api/fmode/verifycode` 实测均为 404（planned），
  已在真值表中标注并给出替代路径
- 真实端点补充：`/v1/images/generations`（live）、`/api/apig/deploy/huaweicloud`（live）、
  `/api/fmode/voc-skill/install-prompt`（live，凭据自举唯一通道）

#### 1.0.2
- 新增 **§3 元数据规范**：14 个元数据字段、三维标签分类体系、SEO 四原则
- 章节重编号：原 §3-§9 → §4-§10，全文 `§x.y` 交叉引用同步更新
- 新增 [`awesome.md`](awesome.md)（全生态技能清单）与
  [`browser/awesome.html`](browser/awesome.html)（可发布 CDN 的技能看板）
- 版本号三处对齐：`package.json` / `lib/index.mjs` / `browser/index.mjs`

## License

MIT © 2026 Fmode (未来飞马)
