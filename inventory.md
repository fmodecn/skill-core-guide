# Fmode 技能清单 · Inventory

> 收录 Fmode Harness 平台已发布技能，按**职责分层**归类，标注**分发渠道**与**状态**。
> 机器可读真值：`lib/inventory.mjs` ｜ 命令行查看：`skill-core inventory`
>
> 最后更新：2026-09-22 ｜ 共 **17** 个技能

---

## 统计总览

| 分层 | 数量 |
|------|------|
| 系统层 / Infrastructure | 7 |
| 服务层 / Platform Services | 6 |
| 应用层 / Business Applications | 3 |
| **合计** | **17**（含母技能自身） |

| 渠道 | 数量 |
|------|------|
| Gogs | 11 |
| GitHub | 12 |
| npm | 8 |
| skillhub.cn | 1 |

> ⚠️ **skillhub.cn 渠道现状（2026-09-22 实测）**：企业 key（`sk-ent-...`）调用
> `POST /api/v1/community/skills/publish` 返回 **401 `invalid or expired token`**，
> 即 key 已在服务端失效/过期。当前仅 `fmode-skill-heterarchy` 一个 slug 在册。
> `skill-core-guide` 的打包与 `--dry-run` 预检均已通过
> （`slug=fmode-skill-core-guide`），**待重新签发 key 后补发**。
> 补发命令：`skillhub login --key <新KEY> --host https://api.skillhub.cn && skillhub publish . --changelog "首版"`

---

## 一、系统层 / Infrastructure

> 平台基础设施与 Agent 运行时治理。不依赖业务场景，是其他技能的地基。

### 1. `skill-heterarchy` · 内异层认知协同

> 单一 Agent 主体内部多心智分化与自治协商。**Delegate 是对外派活，Heterarchy 是对内分思。**

- **渠道**：Gogs · GitHub · npm · skillhub
- **npm**：`skill-heterarchy@1.0.0`
- **skillhub**：`fmode-skill-heterarchy`
- **标签**：`heterarchy` `cognitive-collaboration` `hermes` `claude-code` `dispatch` `paradigm`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-heterarchy) · [GitHub](https://github.com/fmodecn/skill-heterarchy) · [npm](https://www.npmjs.com/package/skill-heterarchy)
- **要点**：一体内生多个半自治认知子单元并行思考、互相协商校验；60s 健康检查防阻塞；恢复矩阵处理 503/401/假成功/连败。是本平台**唯一关注「单一主体内部心智效率」**的技能。

---

### 2. `skill-multi-branch` · 多任务工作框架

> Hermes 负责沟通，专业任务派发执行层（Claude Code / Codex / Agent profile）。

- **渠道**：Gogs · GitHub
- **标签**：`dispatch` `multi-task` `hermes` `claude-code` `workflow`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-multi-branch) · [GitHub](https://github.com/fmodecn/skill-multi-branch)
- **要点**：任务书落盘协议、四态状态上报（`ack→running→done/failed`+心跳）、中断续跑、执行层纪律（含真实违规案例沉淀与验收方法）。内置 `dispatch.sh` 标准派发器。

---

### 3. `skill-bypass-permission` · YOLO 模式体检器

> 校验并幂等修复 Agent 免确认自主执行配置。

- **渠道**：Gogs · GitHub
- **标签**：`permission` `yolo` `self-check` `idempotent` `hermes`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-bypass-permission) · [GitHub](https://github.com/fmodecn/skill-bypass-permission)
- **要点**：覆盖 Hermes `approvals.mode=off/yolo` 与 Claude Code skip-permissions；改前自动备份；**已合规则一行 OK 静默通过**（幂等）。

---

### 4. `skill-task-progress` · 任务进度与成果上报

> Agent 干活进度与成果交付实时进 FmodeAgent 平台（App 四 Tab / 看板可见）。

- **渠道**：Gogs · GitHub
- **标签**：`progress` `reporting` `parse` `dashboard` `heartbeat`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-task-progress) · [GitHub](https://github.com/fmodecn/skill-task-progress)
- **要点**：`init-tables` 幂等初始化 FmodeAgent / AgentTaskStatus / AgentDeliverable 三表；`progress` 四态上报 + 30s 心跳；`deliver` 交付链接入库（幂等覆盖，漏报即补）。
- ⚠️ **关键坑**：Parse Date 字段必须用 `{"__type":"Date","iso":...}` 包装，裸字符串报 schema 111（实测双向验证）。

---

### 5. `plugin-wecom-fix` · 企微通道自检修复

> 修复官方 wecom 插件四项接收缺陷。

- **渠道**：Gogs · GitHub
- **形态**：Hermes plugin
- **标签**：`wecom` `plugin` `patch` `idempotent` `channel-fix`
- **链接**：[Gogs](https://git.fmode.cn/fmode/plugin-wecom-fix) · [GitHub](https://github.com/fmodecn/plugin-wecom-fix)
- **要点**：①大视频收不到（入站 512MB 上限）②合并转发不识别（chatrecord 提取）③批量图片丢失（重试+限流退避）④长文件名 Errno 36（200 字节截断）。幂等 `patch.py --check/--apply/--rollback` + 全集群批量安装脚本。
- **安装**：`git clone https://github.com/fmodecn/plugin-wecom-fix.git && python3 plugin-wecom-fix/patch.py --apply`

---

### 6. `skill-agent-clone` · 数字生命克隆

> 把本地 Hermes 配置、SOUL、技能、记忆、会话记录分级同步到个人 Git 仓库。

- **渠道**：Gogs · GitHub
- **标签**：`clone` `backup` `soul` `memory` `migration` `disaster-recovery`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-agent-clone) · [GitHub](https://github.com/fmodecn/skill-agent-clone)
- **要点**：按 **L1-L4 重要程度分级**；自动建仓（`agent-<拼音>`）；增量 push；一键恢复。**密钥只记位置索引不入仓**。换机/容器重建时数字生命快速复活。

---

### 7. `skill-core-guide` · Harness 平台母技能标准指南 ★

> **本清单所属的技能**。Fmode Harness 平台技能开发规范母技能。

- **渠道**：Gogs · GitHub · npm　（skillhub 待补发，见上方渠道现状）
- **npm**：`skill-core-guide@1.0.0`
- **skillhub**：`fmode-skill-core-guide`（预检通过，key 失效待补发）
- **标签**：`meta` `standard` `spec` `harness` `scaffold` `quality-check`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-core-guide) · [GitHub](https://github.com/fmodecn/skill-core-guide) · [npm](https://www.npmjs.com/package/skill-core-guide)
- **要点**：平台端点真值表（实测状态）、ESM-first 四端标准、四渠道分发、六项自动质检、诚实凭证供给、新技能脚手架。
- **安装**：`npx --yes skill-core-guide@latest init my-skill --name skill-my-skill`
- **自检**：六项质检全部通过（含 `--deep` 真 npx 拉取验证）

---

## 二、服务层 / Platform Services

> Fmode 基础服务的客户端封装。一个技能封装一个平台能力，接口稳定、无业务假设。

### 8. `skill-storage` · 对象存储与公开分享

> AI Agent 的「仓库管理员」——二进制大文件上云，本地零占用，一键生成公开分享链接。

- **渠道**：Gogs · GitHub
- **版本**：`0.3.0`
- **标签**：`storage` `obs` `s3` `cdn` `share-link` `upload`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-storage) · [GitHub](https://github.com/fmodecn/skill-storage)
- **要点**：华为云 OBS / S3 协议；报告/课件 HTML 发布即分享；`test` 命令上传→删除探针文件全链自检。
- ⚠️ **凭据链权威参考**：诚实 4 级（env → obsutil config → deploy STS → 项目 config）。0.3.0 修复了 0.2.x 的「伪自举」事故——详见母技能 SKILL.md §8.1。

---

### 9. `skill-image` · Fmode 图像生成

> Fmode API 图像生成，白底 PNG 场景图。

- **渠道**：GitHub · npm
- **npm**：`fmode-image@0.2.0`
- **标签**：`image` `generation` `ai` `diagram` `scene` `product`
- **链接**：[GitHub](https://github.com/fmodecn/fmode-image) · [npm](https://www.npmjs.com/package/fmode-image)
- **要点**：7 种模式（`--app` / `--arch` / `--explode` / `--product` / `--scene` / `--slide`）；零依赖纯 ESM；自动读 API Key。约 **¥0.3-0.5/张**。
- **端点**：`POST https://api.fmode.cn/v1/images/generations`（✅ live）

---

### 10. `skill-vision` · 视觉识别

> 图片/视频结构化视觉分析。**宿主多模态模型优先**，零额外成本。

- **渠道**：GitHub · npm
- **npm**：`fmode-vision@0.1.1`
- **标签**：`vision` `multimodal` `image-analysis` `video-frames`
- **链接**：[GitHub](https://github.com/fmodecn/skill-vision) · [npm](https://www.npmjs.com/package/fmode-vision)
- **要点**：自动探测宿主 Claude Code / Codex 配置的模型是否支持视觉 → 支持则直接用（零成本）；否则回落 Fmode API 的 `glm-5.3-flash`。支持单轮/多轮聚焦分析与结构化 JSON 输出。
- **端点**：`POST https://api.fmode.cn/v1/chat/completions`（✅ live）

---

### 11. `skill-listen` · 录音转写

> AI 的耳朵 —— 录音/视频音轨转文字（讯飞 LFASR）。

- **渠道**：Gogs · GitHub · npm
- **npm**：`fmode-listen@0.1.2`
- **标签**：`asr` `transcribe` `iflytek` `lfasr` `speaker-diarization`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-listen) · [GitHub](https://github.com/fmodecn/skill-listen) · [npm](https://www.npmjs.com/package/fmode-listen)
- **要点**：中英多语种 + 方言；说话人分离；**讯飞凭据仅服务端持有**（客户端零下放）；服务端按音频真实时长计费。
- **端点**：`POST https://server.fmode.cn/api/listen/transcribe`（✅ live）
- **直用**：`npx --yes fmode-listen@latest transcribe -- meeting.mp3`

---

### 12. `fmode-ffmpeg` · FFmpeg 音视频处理

> FFmpeg 音视频处理封装。

- **渠道**：npm
- **npm**：`fmode-ffmpeg@0.1.1`
- **标签**：`ffmpeg` `audio` `video` `transcode` `extract`
- **链接**：[npm](https://www.npmjs.com/package/fmode-ffmpeg)
- **要点**：抽音轨、转码、切片、截图。常与 `skill-listen` 配合（视频先抽音轨再转写）。

---

### 13. `fmode-qiwei` · 企微网关 SDK

> 企业微信网关 SDK。

- **渠道**：npm
- **npm**：`fmode-qiwei@0.5.2`
- **标签**：`wecom` `qiwei` `sdk` `gateway` `messaging`
- **链接**：[npm](https://www.npmjs.com/package/fmode-qiwei)
- **要点**：消息收发、通讯录、应用管理封装。与 `plugin-wecom-fix` 互补（前者是 SDK，后者是官方插件的接收缺陷补丁）。

---

## 三、应用层 / Business Applications

> 面向具体业务场景的端到端技能。可以依赖服务层，但不应被服务层依赖。

### 14. `skill-study-report` · 学习复盘报告

> 一键生成学员 48h 学习复盘报告 PPT。

- **渠道**：Gogs · GitHub
- **标签**：`report` `review` `ppt` `html` `multi-agent` `education`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-study-report) · [GitHub](https://github.com/fmodecn/skill-study-report)
- **ZIP**：`https://fmode-s3.obs.cn-north-4.myhuaweicloud.com/downloads/skill-study-report.zip`
- **要点**：自动采集近 48h 全部 Agent 工作痕迹（Claude Code / Codex / Trae / WorkBuddy / OpenClaw / 元宝 / Hermes / 工作区，**探测存在才扫**）→ 三问追问 → PPT 级 HTML（≥10 屏）→ **Storage 主 + Gogs 降级/并行双通道发布** + ZIP 分发。
- **纪律**：凭据零暴露、状态门禁分别报告、**不伪造任何采集/发布结果**。

---

### 15. `skill-present` · HTML 演讲系统

> 课程课件/报告 HTML 演讲系统。

- **渠道**：Gogs
- **标签**：`presentation` `html` `slides` `deck` `courseware`
- **链接**：[Gogs](https://git.fmode.cn/fmode/skill-present)
- **要点**：含 **43 条 Claude 规则**；数字动画 + 交付物墙 iframe 嵌套；全套 lib 独立复制（可离线演示）。

---

### 16. `fmode-product-lab` · 新品研发实验室

> 新品研发全流程分析。

- **渠道**：npm
- **npm**：`fmode-product-lab@0.2.0`
- **标签**：`product` `voc` `kano` `market-analysis` `positioning`
- **链接**：[npm](https://www.npmjs.com/package/fmode-product-lab)
- **要点**：VOC 采集 + KANO 模型 + 市场分析 + 定位分析。

---

## 四、按渠道索引

### Gogs（`git.fmode.cn/fmode/`）— 11 个
`skill-heterarchy` · `skill-multi-branch` · `skill-bypass-permission` · `skill-task-progress` · `plugin-wecom-fix` · `skill-agent-clone` · `skill-core-guide` · `skill-storage` · `skill-listen` · `skill-study-report` · `skill-present`

### GitHub（`github.com/fmodecn/`）— 12 个
`skill-heterarchy` · `skill-multi-branch` · `skill-bypass-permission` · `skill-task-progress` · `plugin-wecom-fix` · `skill-agent-clone` · `skill-core-guide` · `skill-storage` · `skill-image` · `skill-vision` · `skill-listen` · `skill-study-report`

### npm — 8 个
`skill-heterarchy` · `skill-core-guide` · `fmode-image` · `fmode-vision` · `fmode-listen` · `fmode-ffmpeg` · `fmode-qiwei` · `fmode-product-lab`

### skillhub.cn — 1 个
`fmode-skill-heterarchy`　（`fmode-skill-core-guide` 预检通过待补发）

---

## 五、新增技能登记流程

1. 在 `lib/inventory.mjs` 的 `INVENTORY` 数组追加条目（**真值源**）
2. 在本文件对应分层下追加小节
3. 校验一致性：`npm test`（测试会检查字段完整性、分层合法性、
   渠道合法性、npm 渠道必须有 `npmName`）
4. 若引入新技能名到任务书/规范中，同步更新母技能 `SKILL.md` §2

**条目字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| `name` | ✅ | 仓库名 / Hermes 技能名 |
| `displayName` | ✅ | 中文显示名 |
| `tier` | ✅ | `system` / `service` / `application` |
| `summary` | ✅ | 一句话作用说明 |
| `platforms` | ✅ | 渠道数组，取值 `gogs` / `github` / `npm` / `skillhub` |
| `status` | ✅ | `published` / `draft` / `deprecated` |
| `tags` | ✅ | 标签数组 |
| `npmName` | npm 渠道必填 | npm 包名（可能与仓库名不同） |
| `npmVersion` | 建议 | 当前 npm 版本 |
| `skillhubSlug` | skillhub 渠道必填 | `fmode-skill-<name>` |
| `version` | 建议 | 仓库当前版本 |
| `kind` | 可选 | `plugin` 等特殊形态 |
| `isMeta` | 可选 | 是否为母技能 |

---

## License

MIT © 2026 Fmode (未来飞马)
