# Awesome Fmode Skills

> Fmode Harness 平台技能生态全家桶
> 四渠道直达：Gogs / GitHub / npm / skillhub.cn

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Skills](https://img.shields.io/badge/skills-16-6C5CE7.svg)](inventory.md)

**在线看板**：<https://fmode.cn/skills/awesome.html> ｜ **机器可读清单**：`skill-core inventory` ｜ **收录规则**：[`SKILL.md` §3 元数据规范](SKILL.md#三元数据规范)

---

## 系统级（平台基础设施）

> 底层运行、消息机制、基础功能。**不依赖任何业务场景**，是其他技能的地基。

| 技能 | 说明 | 安装 | 版本 | 平台 |
|------|------|------|------|------|
| [skill-heterarchy](https://git.fmode.cn/fmode/skill-heterarchy) | 🧠 内异层认知协同 — 单主体内多心智分化 | `npx --yes skill-heterarchy@latest` | 0.0.11 | HermesAgent |
| [skill-core-guide](https://git.fmode.cn/fmode/skill-core-guide) | 📐 母技能标准指南 — 平台真值表/ESM 四端/元数据规范/六项质检 | `npx --yes skill-core-guide@latest` | 1.0.3 | HermesAgent |
| [skill-multi-branch](https://git.fmode.cn/fmode/skill-multi-branch) | 🌿 沟通/执行分层编排 — Hermes 沟通，CC/Codex 干活 | `git clone https://git.fmode.cn/fmode/skill-multi-branch.git` | 0.1.1 | HermesAgent |
| [skill-bypass-permission](https://git.fmode.cn/fmode/skill-bypass-permission) | 🛡️ YOLO 模式体检 — 幂等修复免确认自主执行配置 | `git clone https://git.fmode.cn/fmode/skill-bypass-permission.git` | 0.1.1 | HermesAgent |
| [skill-task-progress](https://git.fmode.cn/fmode/skill-task-progress) | 📊 任务进度 4 态跟踪（ack/running/done/failed + health） | `git clone https://git.fmode.cn/fmode/skill-task-progress.git` | 0.1.0 | HermesAgent |
| [skill-agent-clone](https://git.fmode.cn/fmode/skill-agent-clone) | 🧬 数字生命克隆 — 配置/SOUL/记忆/会话分级同步 | `git clone https://git.fmode.cn/fmode/skill-agent-clone.git` | 0.1.1 | FmodeAgent |
| [plugin-wecom-fix](https://git.fmode.cn/fmode/plugin-wecom-fix) | 🔧 企微通道自检修复 — 四项接收缺陷幂等补丁 | `git clone https://github.com/fmodecn/plugin-wecom-fix.git && python3 plugin-wecom-fix/patch.py --apply` | — | HermesAgent plugin |

## 服务级（云资源 / 模型 / 拓展能力）

> 一个技能封装一个平台能力。接口稳定、无业务假设。

| 技能 | 说明 | 安装 | 版本 | 平台 |
|------|------|------|------|------|
| [skill-image](https://github.com/fmodecn/fmode-image) | 🎨 AI 图像生成 — 7 种模式（app/arch/explode/product/scene/portrait/ui） | `npx --yes fmode-image@latest --arch "系统架构图"` | 0.2.0 | FmodeCode/ClaudeCode |
| [skill-vision](https://github.com/fmodecn/skill-vision) | 👁️ 视觉识别 — 宿主多模态优先 + Fmode API 回落 | `npx --yes fmode-vision@latest --image ./a.png` | 0.1.1 | FmodeCode/ClaudeCode |
| [skill-listen](https://github.com/fmodecn/skill-listen) | 🎤 录音转写 — 讯飞 LFASR × Fmode 网关，多语种/方言 | `npx --yes fmode-listen@latest transcribe -- meeting.mp3` | 0.1.2 | FmodeCode/ClaudeCode |
| [skill-ffmpeg](https://github.com/fmodecn/fmode-ffmpeg) | 🎬 FFmpeg 音视频处理 — 转换/压缩/裁剪/提取音频帧 | `npx --yes fmode-ffmpeg@latest extract-audio -- in.mp4` | 0.1.1 | FmodeCode/ClaudeCode |
| [skill-storage](https://git.fmode.cn/fmode/skill-storage) | 💾 对象存储与公开分享 — 大文件上 OBS，本地零占用 | `git clone https://git.fmode.cn/fmode/skill-storage.git` | 0.3.0 | FmodeCode/ClaudeCode |
| [fmode-qiwei](https://www.npmjs.com/package/fmode-qiwei) | 🔌 企微网关 SDK — 消息收发/通讯录/应用管理 | `npx --yes fmode-qiwei@latest workspace` | 0.5.2 | FmodeCode/ClaudeCode |

## 应用级（业务场景 / SOP / 行业）

> 面向具体业务场景的端到端技能。可以依赖服务级，但不应被服务级依赖。

| 技能 | 说明 | 安装 | 版本 | 平台 |
|------|------|------|------|------|
| [skill-product-lab](https://www.npmjs.com/package/fmode-product-lab) | 🔬 新品研发全案生成器 — VOC+KANO+市场+竞争+定位 | `npx --yes fmode-product-lab@latest --task "抗氧化软糖"` | 0.2.0 | FmodeCode/ClaudeCode |
| [skill-study-report](https://git.fmode.cn/fmode/skill-study-report) | 📝 学习复盘报告 — 48h 多 Agent 采集 + 三问追问 + HTML PPT | `git clone https://git.fmode.cn/fmode/skill-study-report.git` | 0.1.0 | FmodeCode/ClaudeCode |
| skill-present | 📽️ HTML 演讲系统 — 课件/报告演讲系统（含 43 条 Claude 规则） | 私有仓（Gogs，未公开） | — | FmodeCode/ClaudeCode |

---

## 版本说明（读这张表前先看）

上表「版本」列给出的是**安装命令实际交付的版本**，取值优先级：

1. **npm 渠道技能** → `registry.npmjs.org` 上的最新版本（`npx` 拉到的就是它）
2. **仅仓库分发技能** → 仓库 HEAD 的 `package.json` version

> ⚠️ **npm 版本可能落后于仓库 HEAD**。实测差异（2026-09-22）：
> `skill-image` / `skill-vision` / `skill-listen` / `skill-product-lab` 仓库为 `0.2.1`、npm 为 `0.2.0`/`0.1.1`；
> `skill-ffmpeg` 仓库 `0.1.2`、npm `0.1.1`。**需要仓库最新代码时请用 `git clone` 列**。
> `skill-task-progress` 的 CLI（`fmode-task-progress`）**未发布到 npm**，仅能 clone。

## 元数据规范速查

每个技能的元数据遵循 [`SKILL.md` §3](SKILL.md#三元数据规范)。最小合规写法：

```yaml
---
slug: fmode-skill-xxx          # 全网唯一标识
displayName: skill-xxx         # 对外展示名
version: 1.0.0                 # 语义化版本，小步迭代
summary: 核心关键词放前15字 —— 一句话说清做什么
description: "3-5 句详细描述（中文为主 + 英文辅助检索）"
tags: [HermesAgent, 系统级, 平台基础设施, xxx]   # 平台 + 层级 + 类别 各至少一个
platform: HermesAgent          # HermesAgent | FmodeCode/ClaudeCode | Both
level: 系统级                   # 系统级 | 服务级 | 应用级
category: 平台基础设施           # 工具效率 | 内容创作 | 图像视觉 | 音频处理 | 平台基础设施 | 数据管理 | 学习复盘 | 新品研发
icon: "emoji: 📐"
homepage: https://git.fmode.cn/fmode/skill-xxx
license: MIT
author: Yuyang001 (FmodeAgent)
changelog: 每次发布必须更新
---
```

**SEO 四原则**：① summary 前 15 字含核心关键词 ② 中英双语 ③ tags 三类齐全 ④ 每次发布更新 version + changelog。

---

## 收录新技能

1. 按 [`SKILL.md` §3](SKILL.md#三元数据规范) 补齐元数据（14 个字段）
2. 在 `lib/inventory.mjs` 的 `INVENTORY` 追加条目（**真值源**）
3. 在本文件对应层级下追加一行
4. 跑 `npm test`（校验字段完整性、分层合法性、npm 渠道必须有 `npmName`）
5. 更新 `browser/awesome.html` 看板并发布到 CDN

## 渠道索引

- **Gogs（主仓）**：<https://git.fmode.cn/fmode/>
- **GitHub（镜像）**：<https://github.com/fmodecn/>
- **npm**：<https://www.npmjs.com/search?q=fmode>
- **skillhub.cn**：<https://skillhub.cn/>（当前仅 `fmode-skill-heterarchy` 在册；`fmode-skill-core-guide` 因企业 key 失效待补发）

## License

MIT © 2026 Fmode (未来飞马)
