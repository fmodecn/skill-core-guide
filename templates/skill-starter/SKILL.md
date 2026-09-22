---
slug: fmode-__SKILL_NAME__
displayName: __SKILL_NAME__
version: 0.1.0
summary: __SUMMARY__
license: MIT
tags: [fmode, skill]
---

# __SKILL_NAME__

> __SUMMARY__

## 何时使用本技能

<!-- 写清楚触发场景：用户在什么情况下应该用到这个技能 -->

- 场景一：……
- 场景二：……

## 快速开始

```bash
# CLI
npx --yes __SKILL_NAME__@latest greet world

# SDK
node -e "import('__SKILL_NAME__').then(m => console.log(m.greet('world')))"
```

## 能力清单

| 能力 | CLI | SDK |
|------|-----|-----|
| 示例能力 | `__CLI_NAME__ greet` | `greet()` |

## 凭据

本技能使用 Fmode 标准 5 级凭据链（命中即用）：

0. `FMODE_SESSION_TOKEN` / `~/.fmode/config.json` 的 `sessionToken` → 自举换 API token
1. 环境变量 `FMODE_API_TOKEN`
2. `~/.fmode/config.json` → `fmodeApiToken`
3. `<cwd>/.fmode/config.json` → `fmodeApiToken`
4. `~/.claude/settings.json` → `env.ANTHROPIC_AUTH_TOKEN`

检查：`__CLI_NAME__ auth`

## 平台服务

<!-- 如需调用 Fmode 平台服务，列出用到的端点并标注实测状态 -->

| 端点 | 状态 | 用途 |
|------|------|------|
| `POST /v1/chat/completions` | live | LLM 调用 |
| `POST /api/listen/transcribe` | live | 录音转写 |

> ⚠️ 调用任何 `planned` 状态端点前必须先探测，404 时显式回落，不得当作已上线。

## 开发

```bash
npm test                        # 冒烟测试
skill-core check .              # 六项自动质检
skill-core publish . --apply    # 四渠道发布
```

## License

MIT
