/**
 * Fmode Harness 平台常量与端点真值表
 * ---------------------------------------------------------------------------
 * 本文件是 skill-core-guide 的唯一真值源（single source of truth）。
 * 所有端点状态均于 2026-09-22 实测（curl 探针），并标注 verification 字段：
 *
 *   "live"       — 实测返回 200/401（401 = 端点存在、需鉴权），可直接使用
 *   "planned"    — 实测 404，设计文档存在但服务端未上线；调用方必须先探测再回落
 *   "deprecated" — 曾经存在或曾被文档描述，实测 404 且已确认不再维护
 *
 * ⚠️ 纪律：任何技能调用 planned/deprecated 端点前，必须做一次探测并显式回落，
 *    禁止把「文档写了」当成「已经能跑」——这是 Fmode 技能生态最贵的一课
 *    （见 skill-storage 0.3.0 的「伪自举」事故复盘）。
 */

// ============================================================
// 平台基址
// ============================================================

export const PLATFORM = {
  name: 'Fmode Harness',
  version: '1.0.0',
  author: 'Yuyang001 (FmodeAgent)',

  /** OpenAI 兼容网关：LLM / 图像生成。鉴权：Bearer sk-... */
  apiBase: 'https://api.fmode.cn',
  /** Parse 业务网关：转写 / 凭据自举 / deploy STS。鉴权：x-parse-session-token */
  gatewayBase: 'https://server.fmode.cn',
  /** CDN 映射域名（OBS → fmode.cn 回源） */
  cdnBase: 'https://fmode.cn',
  /** OBS 直链（CDN 未生效时的降级通道） */
  obsBase: 'https://fmode-s3.obs.cn-north-4.myhuaweicloud.com',

  /** 主 Gogs（内网日常迭代） */
  gogsBase: 'https://git.fmode.cn',
  gogsOrg: 'fmode',
  /** GitHub 镜像（公开发布） */
  githubOrg: 'fmodecn',
  npmRegistry: 'https://registry.npmjs.org',
  npmOwner: 'fmode001',

  /** skillhub.cn 分发渠道 */
  skillhub: {
    host: 'https://api.skillhub.cn',
    team: 'fmode',
    orgId: 'org-m8z913un',
    cliInstall: 'https://skillhub.cn/install/install.sh',
    cliPath: '~/.local/bin/skillhub',
  },
};

// ============================================================
// 端点真值表
// ============================================================

/**
 * @typedef {Object} Endpoint
 * @property {string} id          稳定标识（代码里引用这个，不要硬编码 URL）
 * @property {string} method
 * @property {string} url
 * @property {'api'|'gateway'|'oss'} host      归属基址
 * @property {'live'|'planned'|'deprecated'} status
 * @property {string} auth        鉴权方式
 * @property {string} purpose
 * @property {string} [note]
 */

/** @type {Record<string, Endpoint>} */
export const ENDPOINTS = {
  // ---------- 已上线（实测 200/401）----------
  llmChat: {
    id: 'llmChat',
    method: 'POST',
    url: 'https://api.fmode.cn/v1/chat/completions',
    host: 'api',
    status: 'live',
    auth: 'Bearer <fmodeApiToken>',
    purpose: 'LLM 对话补全（OpenAI 兼容）。所有技能的统一模型出口。',
    note: '实测无 token 返回 401（端点存在）。模型如 glm-5.3-flash / deepseek 系列。',
  },
  imageGenerate: {
    id: 'imageGenerate',
    method: 'POST',
    url: 'https://api.fmode.cn/v1/images/generations',
    host: 'api',
    status: 'live',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '图像生成（fmode-image 使用）。白底 PNG 场景图，约 ¥0.3-0.5/张。',
    note: '实测无 token 返回 401（端点存在）。注意是 /v1/images/generations，不是 /api/image/generate。',
  },
  listenTranscribe: {
    id: 'listenTranscribe',
    method: 'POST',
    url: 'https://server.fmode.cn/api/listen/transcribe',
    host: 'gateway',
    status: 'live',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '录音转写（讯飞 LFASR）。fmode-listen 使用，服务端按音频真实时长计费。',
    note: '实测无 token 返回 401。讯飞凭据仅服务端持有，客户端零下放。',
  },
  vocSkillBootstrap: {
    id: 'vocSkillBootstrap',
    method: 'POST',
    url: 'https://server.fmode.cn/api/fmode/voc-skill/install-prompt',
    host: 'gateway',
    status: 'live',
    auth: 'x-parse-session-token: <sessionToken>',
    purpose: '【凭据自举唯一通道】sessionToken → fmode API token（sk- 开头）。',
    note:
      '实测无 token 返回 401。token 内嵌在返回 body.data.prompt 文本中，' +
      '用 /sk-(?!ant-)[A-Za-z0-9_-]{8,}/ 提取。token 仅内存持有，禁止落盘进日志。',
  },
  deploySts: {
    id: 'deploySts',
    method: 'POST',
    url: 'https://server.fmode.cn/api/apig/deploy/huaweicloud',
    host: 'gateway',
    status: 'live',
    auth: 'Bearer <sessionToken>',
    purpose: '签发项目隔离 OBS STS 临时凭证（skill-storage 第 3 级凭据）。',
    note: '实测匿名 POST 返回 200（权威端点）。入参 {token, projectId}，返回 {accessKey, secretKey, securityToken, obsPath}。',
  },

  // ---------- 未上线（实测 404）——调用前必须探测 ----------
  storageUpload: {
    id: 'storageUpload',
    method: 'POST',
    url: 'https://server.fmode.cn/api/storage/upload',
    host: 'gateway',
    status: 'planned',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '对象存储上传（规划中）。',
    note: '⚠️ 实测 404。当前上传走 obsutil 直传 OBS 或 deploySts 换 STS，不要依赖本端点。',
  },
  storageCredentials: {
    id: 'storageCredentials',
    method: 'POST',
    url: 'https://server.fmode.cn/api/storage/credentials',
    host: 'gateway',
    status: 'deprecated',
    auth: 'Bearer <sessionToken>',
    purpose: '（历史）sessionToken 直接换 OBS STS。',
    note:
      '⚠️ 从未上线（HEAD/GET 探测恒 404）。skill-storage 0.2.x 的「登录即可上传」' +
      '即因依赖本端点而成为「伪自举」事故。0.3.0 已降级为 --experimental-sts。',
  },
  imageGenerateLegacy: {
    id: 'imageGenerateLegacy',
    method: 'POST',
    url: 'https://server.fmode.cn/api/image/generate',
    host: 'gateway',
    status: 'planned',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '（规划）网关侧图像生成。',
    note: '⚠️ 实测 404。图像生成请用 imageGenerate（/v1/images/generations）。',
  },
  visionAnalyze: {
    id: 'visionAnalyze',
    method: 'POST',
    url: 'https://server.fmode.cn/api/vision/analyze',
    host: 'gateway',
    status: 'planned',
    auth: 'Bearer <fmodeApiToken>',
    purpose: '（规划）网关侧视觉识别。',
    note: '⚠️ 实测 404。视觉识别请用 llmChat（多模态 messages）或宿主多模态模型优先。',
  },
  verifyCode: {
    id: 'verifyCode',
    method: 'POST',
    url: 'https://server.fmode.cn/api/fmode/verifycode',
    host: 'gateway',
    status: 'planned',
    auth: '无（公开）',
    purpose: '（规划）手机号验证码下发，用于一键开户。',
    note:
      '⚠️ 实测 404。当前一键凭证供给走「登录 FMODE Studio 取 sessionToken」路径，' +
      '见 lib/bootstrap.mjs 的 resolveSessionToken()。端点上线后本文件状态改 live 即可启用短信路径。',
  },
};

/** 便捷查询：按状态筛选端点 */
export function endpointsByStatus(status) {
  return Object.values(ENDPOINTS).filter((e) => e.status === status);
}

// ============================================================
// 凭据解析链（实测自 skill-listen / skill-vision / skill-storage 生产实现）
// ============================================================

/**
 * 标准 5 级凭据解析链。命中即用，全失败必须显式报错，绝不伪装成功。
 * 各级返回 { token, source, level } 或 null。
 */
export const CREDENTIAL_CHAIN = [
  {
    level: 0,
    source: 'sessionToken 自举',
    detail:
      'FMODE_SESSION_TOKEN 环境变量 或 ~/.fmode/config.json 的 sessionToken' +
      ' → POST /api/fmode/voc-skill/install-prompt → 提取 sk- token（仅内存持有）',
    endpoint: 'vocSkillBootstrap',
  },
  {
    level: 1,
    source: '环境变量',
    detail: 'FMODE_API_TOKEN',
  },
  {
    level: 2,
    source: '用户级 config',
    detail: '~/.fmode/config.json → fmodeApiToken / newapiToken',
  },
  {
    level: 3,
    source: '项目级 config',
    detail: '<cwd>/.fmode/config.json → fmodeApiToken / newapiToken',
  },
  {
    level: 4,
    source: 'Claude Code settings',
    detail:
      '~/.claude/settings.json（含 settings.local.json / 项目级 .claude/）' +
      ' 的 env.ANTHROPIC_AUTH_TOKEN —— fmode 的 newapi SK 默认就是它',
  },
];

/** 校验规则：合法的 fmode token 形态 */
export const TOKEN_RULES = {
  /** 必须以 sk- 开头 */
  prefix: 'sk-',
  /** 必须排除真正的 Anthropic 官方 key */
  exclude: 'sk-ant-',
  /** 若设置了 ANTHROPIC_BASE_URL，必须指向 fmode */
  baseUrlMustInclude: 'fmode',
  /** 从自举返回文本中提取 token 的正则（与 listen/vision 生产实现一致） */
  extractRe: /sk-(?!ant-)[A-Za-z0-9_-]{8,}/,
};

// ============================================================
// 技能分类体系
// ============================================================

export const TIERS = {
  system: {
    key: 'system',
    label: '系统层 / Infrastructure',
    desc: '平台基础设施与 Agent 运行时治理：认知协同、任务编排、权限、进度、克隆备份。',
  },
  service: {
    key: 'service',
    label: '服务层 / Platform Services',
    desc: 'Fmode 基础服务封装：存储、图像、视觉、语音、音视频、企微网关。',
  },
  application: {
    key: 'application',
    label: '应用层 / Business Applications',
    desc: '面向业务场景的端到端技能：报告、课件、产品研发。',
  },
};

// ============================================================
// ESM-first 四端矩阵
// ============================================================

export const RUNTIMES = {
  cli: {
    key: 'cli',
    label: 'CLI',
    entry: 'bin/<name>.mjs',
    usage: 'npx --yes <skill>@latest <command>',
    supported: true,
  },
  sdk: {
    key: 'sdk',
    label: 'SDK (Node ESM)',
    entry: 'lib/index.mjs',
    usage: "import { ... } from '<skill>'",
    supported: true,
  },
  browser: {
    key: 'browser',
    label: 'Browser',
    entry: 'browser/index.mjs',
    usage: '<script type="module" src="...">',
    supported: true,
    constraint: '禁止 import 任何 node: 内置模块；仅可用 fetch / Web Crypto / URL 等 Web 标准 API。',
  },
  server: {
    key: 'server',
    label: 'Server (CJS require)',
    entry: null,
    usage: "require('<skill>')",
    supported: false,
    constraint: 'ESM only —— 团队共识，不提供 CJS 入口。Node 侧请用 import() 动态导入。',
  },
};

/** 必需的文件清单（包结构模板） */
export const REQUIRED_LAYOUT = [
  'package.json',
  'lib/index.mjs',
  'bin/<name>.mjs',
  'skills/<skill-name>/SKILL.md',
  'README.md',
  'LICENSE',
  'skill-package-manifest.json',
];

/** package.json 必须满足的字段约束 */
export const PACKAGE_RULES = {
  requiredFields: ['name', 'version', 'description', 'type', 'main', 'exports', 'bin', 'files', 'license'],
  type: 'module',
  main: './lib/index.mjs',
  /** exports['.'] 必须同时提供 import 与 default */
  exportConditions: ['import', 'default'],
  /** files 白名单必须覆盖的目录 */
  filesMustInclude: ['lib/', 'bin/', 'skills/', 'README.md', 'LICENSE', 'skill-package-manifest.json'],
  /** 禁止出现的字段（ESM only 纪律） */
  forbiddenFields: ['require'],
};
