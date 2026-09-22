/**
 * 已发布技能清单（机器可读真值）
 * ---------------------------------------------------------------------------
 * inventory.md 是本文件的人类可读渲染。新增技能时**两处都要更新**，
 * 或直接跑 `skill-core inventory --check` 校验一致性。
 *
 * 平台标注说明：
 *   gogs   — 主 Gogs（git.fmode.cn/fmode/）
 *   github — GitHub 镜像（github.com/fmodecn/）
 *   npm    — npm 包（包名见 npmName 字段）
 *   skillhub — skillhub.cn 社区分发
 */

import { TIERS } from './platform.mjs';

/** @typedef {Object} SkillEntry */

/** @type {SkillEntry[]} */
export const INVENTORY = [
  // ============================================================
  // 系统层 / Infrastructure
  // ============================================================
  {
    name: 'skill-heterarchy',
    displayName: '内异层认知协同',
    tier: 'system',
    summary: '单一 Agent 主体内部多心智分化与自治协商。Delegate 是对外派活，Heterarchy 是对内分思。',
    platforms: ['gogs', 'github', 'npm', 'skillhub'],
    npmName: 'skill-heterarchy',
    skillhubSlug: 'fmode-skill-heterarchy',
    status: 'published',
    tags: ['heterarchy', 'cognitive-collaboration', 'hermes', 'claude-code', 'dispatch', 'paradigm'],
  },
  {
    name: 'skill-multi-branch',
    displayName: '多任务工作框架',
    tier: 'system',
    summary:
      'Hermes 负责沟通、专业任务派发执行层（Claude Code/Codex/Agent profile）。任务书落盘协议、四态状态上报、中断续跑、执行层纪律，内置 dispatch.sh 标准派发器。',
    platforms: ['gogs', 'github'],
    status: 'published',
    tags: ['dispatch', 'multi-task', 'hermes', 'claude-code', 'workflow'],
  },
  {
    name: 'skill-bypass-permission',
    displayName: 'YOLO 模式体检器',
    tier: 'system',
    summary:
      '校验并幂等修复 Agent 免确认自主执行配置（Hermes approvals.mode=off/yolo、Claude Code skip-permissions），改前自动备份，已合规则一行 OK 静默通过。',
    platforms: ['gogs', 'github'],
    status: 'published',
    tags: ['permission', 'yolo', 'self-check', 'idempotent', 'hermes'],
  },
  {
    name: 'skill-task-progress',
    displayName: '任务进度与成果上报',
    tier: 'system',
    summary:
      'Agent 干活进度与成果交付实时进 FmodeAgent 平台（App 四 Tab/看板可见）。init-tables 幂等建三表；progress 四态上报（ack→running→done/failed+30s 心跳）；deliver 交付链接入库。',
    platforms: ['gogs', 'github'],
    status: 'published',
    tags: ['progress', 'reporting', 'parse', 'dashboard', 'heartbeat'],
  },
  {
    name: 'plugin-wecom-fix',
    displayName: '企微通道自检修复',
    tier: 'system',
    summary:
      '修复官方 wecom 插件四项接收缺陷：大视频收不到、合并转发不识别、批量图片丢失、长文件名 Errno 36。幂等 patch.py（--check/--apply/--rollback）。',
    platforms: ['gogs', 'github'],
    status: 'published',
    kind: 'plugin',
    tags: ['wecom', 'plugin', 'patch', 'idempotent', 'channel-fix'],
  },
  {
    name: 'skill-agent-clone',
    displayName: '数字生命克隆',
    tier: 'system',
    summary:
      '把本地 Hermes 配置、SOUL、技能、记忆、会话记录按 L1-L4 重要程度分级同步到个人 Git 仓库，增量 push、一键恢复。密钥只记位置索引不入仓。',
    platforms: ['gogs', 'github'],
    status: 'published',
    tags: ['clone', 'backup', 'soul', 'memory', 'migration', 'disaster-recovery'],
  },

  // ============================================================
  // 服务层 / Platform Services
  // ============================================================
  {
    name: 'skill-storage',
    displayName: '对象存储与公开分享',
    tier: 'service',
    summary:
      '二进制大文件（图/音/视频/HTML 报告）上传对象存储（OBS/S3），本地零长期占用，上传即得公开分享链接。诚实 4 级凭据链。',
    platforms: ['gogs', 'github'],
    status: 'published',
    version: '0.3.0',
    tags: ['storage', 'obs', 's3', 'cdn', 'share-link', 'upload'],
  },
  {
    name: 'skill-image',
    displayName: 'Fmode 图像生成',
    tier: 'service',
    summary: 'Fmode API 图像生成，白底 PNG 场景图，约 ¥0.3-0.5/张。7 种模式（--app/--arch/--explode/--product/--scene/--slide）。',
    platforms: ['github', 'npm'],
    npmName: 'fmode-image',
    npmVersion: '0.2.0',
    status: 'published',
    tags: ['image', 'generation', 'ai', 'diagram', 'scene', 'product'],
  },
  {
    name: 'skill-vision',
    displayName: '视觉识别',
    tier: 'service',
    summary:
      '图片/视频结构化视觉分析。宿主多模态模型优先（零额外成本），否则回落 Fmode API 的 glm-5.3-flash；支持单轮/多轮聚焦分析与结构化 JSON 输出。',
    platforms: ['github', 'npm'],
    npmName: 'fmode-vision',
    npmVersion: '0.1.1',
    status: 'published',
    tags: ['vision', 'multimodal', 'image-analysis', 'video-frames'],
  },
  {
    name: 'skill-listen',
    displayName: '录音转写',
    tier: 'service',
    summary:
      '录音/视频音轨转文字（讯飞 LFASR × Fmode 网关 /api/listen/transcribe）。中英多语种+方言、说话人分离、服务端按音频时长计费、讯飞凭据零下放。',
    platforms: ['gogs', 'github', 'npm'],
    npmName: 'fmode-listen',
    npmVersion: '0.1.2',
    status: 'published',
    tags: ['asr', 'transcribe', 'iflytek', 'lfasr', 'speaker-diarization'],
  },
  {
    name: 'fmode-ffmpeg',
    displayName: 'FFmpeg 音视频处理',
    tier: 'service',
    summary: 'FFmpeg 音视频处理封装：抽音轨、转码、切片、截图。',
    platforms: ['npm'],
    npmName: 'fmode-ffmpeg',
    npmVersion: '0.1.1',
    status: 'published',
    tags: ['ffmpeg', 'audio', 'video', 'transcode', 'extract'],
  },
  {
    name: 'fmode-qiwei',
    displayName: '企微网关 SDK',
    tier: 'service',
    summary: '企业微信网关 SDK：消息收发、通讯录、应用管理封装。',
    platforms: ['npm'],
    npmName: 'fmode-qiwei',
    npmVersion: '0.5.2',
    status: 'published',
    tags: ['wecom', 'qiwei', 'sdk', 'gateway', 'messaging'],
  },

  // ============================================================
  // 应用层 / Business Applications
  // ============================================================
  {
    name: 'skill-study-report',
    displayName: '学习复盘报告',
    tier: 'application',
    summary:
      '一键生成学员 48h 学习复盘报告 PPT：多 Agent 采集工作痕迹 → 三问追问 → PPT 级 HTML（≥10 屏）→ Storage 主 + Gogs 降级双通道发布 + ZIP 分发。',
    platforms: ['gogs', 'github'],
    status: 'published',
    tags: ['report', 'review', 'ppt', 'html', 'multi-agent', 'education'],
  },
  {
    name: 'skill-present',
    displayName: 'HTML 演讲系统',
    tier: 'application',
    summary: '课程课件/报告 HTML 演讲系统，含 43 条 Claude 规则，数字动画与交付物墙 iframe 嵌套。',
    platforms: ['gogs'],
    status: 'published',
    tags: ['presentation', 'html', 'slides', 'deck', 'courseware'],
  },
  {
    name: 'fmode-product-lab',
    displayName: '新品研发实验室',
    tier: 'application',
    summary: '新品研发全流程：VOC 采集 + KANO 模型 + 市场分析 + 定位分析。',
    platforms: ['npm'],
    npmName: 'fmode-product-lab',
    npmVersion: '0.2.0',
    status: 'published',
    tags: ['product', 'voc', 'kano', 'market-analysis', 'positioning'],
  },

  // ============================================================
  // 母技能自身
  // ============================================================
  {
    name: 'skill-core-guide',
    displayName: 'Harness 平台母技能标准指南',
    tier: 'system',
    summary:
      'Fmode Harness 平台技能开发规范母技能：平台真值表、ESM-first 四端标准、四渠道分发、六项自动质检、一键凭证供给、新技能脚手架。',
    platforms: ['gogs', 'github', 'npm', 'skillhub'],
    npmName: 'skill-core-guide',
    skillhubSlug: 'fmode-skill-core-guide',
    status: 'published',
    isMeta: true,
    tags: ['meta', 'standard', 'spec', 'harness', 'scaffold', 'quality-check'],
  },
];

/** 按分层分组 */
export function byTier() {
  const out = {};
  for (const key of Object.keys(TIERS)) out[key] = [];
  for (const s of INVENTORY) {
    if (!out[s.tier]) out[s.tier] = [];
    out[s.tier].push(s);
  }
  return out;
}

/** 按渠道筛选 */
export function byPlatform(platform) {
  return INVENTORY.filter((s) => s.platforms.includes(platform));
}

/** 统计 */
export function stats() {
  const out = { total: INVENTORY.length, byTier: {}, byPlatform: {} };
  for (const key of Object.keys(TIERS)) out.byTier[key] = 0;
  for (const s of INVENTORY) {
    out.byTier[s.tier] = (out.byTier[s.tier] || 0) + 1;
    for (const p of s.platforms) out.byPlatform[p] = (out.byPlatform[p] || 0) + 1;
  }
  return out;
}

export default INVENTORY;
