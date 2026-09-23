# 运行身份与凭据自举机制（Agent Identity & Credential Bootstrapping）

> 本规范是 Fmode Harness 平台**所有技能**运行时自举的宪法。任何技能在调用需要鉴权的
> 平台 API / 云函数 / 对象存储之前，**必须先解决两个问题**：
>
> 1. **我是谁** —— 本容器 / 本 Agent 的身份（agentId），确保上报/查询定位到正确的 Agent。
> 2. **我凭什么** —— 本会话的凭据（sessionToken / apiToken），决定我能访问哪些资源（ACL）。
>
> 两者独立、都高兼容地解析，缺一不可。sessionToken 只控制 ACL，**不负责**告诉平台「是谁干活」。

---

## 一、Agent 身份（agentId）高兼容解析链

**唯一真相**：`FmodeAgent` 表的语义名 agentId（如 `agent-node`、`agent-node-xinting`），
**不是** Docker hostname（`6ec71e98949e` 这类随机 hash），也不是 PID。

按以下顺序解析（第一个命中即停）：

| 级 | 来源 | 示例 | 说明 |
|----|------|------|------|
| 1 | 环境变量 `FMODE_AGENT_ID` | `FMODE_AGENT_ID=agent-node` | 最显式的强制指定 |
| 2 | 环境变量 `AGENT_ID` | `AGENT_ID=agent-node` | 兼容 provision 脚本旧变量名 |
| 3 | `.fmode/config.json` → `agentId` | `{"agentId":"agent-node"}` | 用户级配置持久化 |
| 4 | `<cwd>/.fmode/config.json` → `agentId` | 同 | 项目级覆盖 |
| 5 | hames 文件 `.fmode-harness-agent/agent.json` → `agentId` | 同上 | 容器初始化时由生命周期写入 |
| 6 | 兜底：`hostname`（仅作显示，不可作业务键） | `6ec71e98949e` | 仅警告，不使用该值上报 |

> ⚠️ **陷阱**：容器重启后 `hostname` 会变（Docker 随机生成短 hash）。
> 上报云函数 `agentId` 参数若传了 hostname，会被判定「agent not found」。
> 所以 agentId 必须来自**持久化配置**（env / .fmode），绝不能用 hostname。

---

## 二、sessionToken 高兼容解析链（ACL）

sessionToken 只用于资源访问控制（ACL 判定、确认调用者身份），同样四级解析：

| 级 | 来源 | 说明 |
|----|------|------|
| 1 | 环境变量 `FMODE_SESSION_TOKEN` | 最直接 |
| 2 | `~/.fmode/config/user.json` → `sessionToken` | Hermes / FMODE Studio 保存位置 |
| 3 | `~/.fmode/config.json` → `sessionToken` | 旧兼容位置 |
| 4 | `<cwd>/.fmode/config.json` → `sessionToken` | 项目级 |

> ⚠️ **陷阱**：`FMODE_SESSION_TOKEN` **不会自动导出到进程环境**——它存在
> `~/.fmode/config/user.json` 里，但许多容器（尤其 Hermes）没把它写入 `.env` / 环境变量。
> 技能必须**主动读取配置文件**兜底，不能只信环境变量。

---

## 三、apiToken（sk-）解析链

（按 skill-core-guide 既有 §7 第 0-4 级，此处略，见主文档。）

---

## 四、全链枯竭时的兜底：验证码登录重新初始化

当 agentId 与 sessionToken 都无法从 env / 配置找到时，**不能假装成功**，必须触发
验证码登录自举（这是让技能能自主恢复的最后手段）：

```
POST https://server.fmode.cn/api/fmode/verifycode
  body: { "mobile": "<手机号>" }
  → 返回验证码请求结果

POST https://server.fmode.cn/api/fmode/verifycode/verify   # 或平台等价端点
  body: { "mobile": "<手机号>", "code": "<6位验证码>" }
  → 校验通过 → 返回并持久化 sessionToken

将 sessionToken 写入 ~/.fmode/config/user.json
将 agentId 写入 ~/.fmode/config.json（若云函数有注册接口则调之）
```

路径依赖端点是否上线；若端点未上线（404），则打印**清晰的初始化向导**并提供管理员邮箱，
**绝不伪造**一个 token 假装成功（诚实原则，见 §9.1 伪自举事故）。

---

## 五、上报封闭示例（skill-deliverable 类）

```
谁：  agentId = resolveAgentId()        # 第 1-5 级，绝不取 hostname
凭：  token   = resolveSessionToken()   # 第 1-4 级，env + 配置文件都试

上报：POST https://server.fmode.cn/api/functions
  body: {
    token,                                 # ACL 用
    id: "<deliverable 云函数 id>",
    params: { action:"report", agentId, title, summary, project, artifacts, tags }
  }
```

> **ACL 前置条件**：sessionToken 对应的用户必须是该 agentId 的 owner，或属于
> `FMODE_AGENT_SUPERADMIN` 系统超管角色，否则云函数返回
> `403 only owner or superadmin can report`。若报此错，属权限配置问题，不是本机制故障，
> 需平台侧把该用户加入超管角色。

---

## 六、为什么必须同时高兼容解析「身份 + 凭据」

| 场景 | 只解析身份 | 只解析凭据 |
|------|-----------|-----------|
| 容器重启（hostname 变） | ✅ 仍能定位 agent | ❌ 上报错目标/丢记录 |
| 凭据存配置文件未导 env | ❌ 该容器无法鉴权 | ✅ 但可能报错目标 |
| 新容器未初始化 | ❌ | ❌（触发验证码兜底） |

两者都要高兼容，缺一个都会让「自动上报」静默失效——这正是交付物上报此前「没生效」的根因。

---

## 七、更新记录

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-09-23 | 依交付物上报事故提炼；加入 agentId 解析链 + sessionToken 配置兜底 + 验证码兜底 |