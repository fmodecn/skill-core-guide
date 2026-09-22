---
name: __SKILL_NAME__
description: "__SUMMARY__"
version: 0.1.0
author: Yuyang001 (FmodeAgent)
license: MIT
tags: [fmode, skill]
---

# __SKILL_NAME__

> __SUMMARY__

<!--
本文件是技能在 Agent 会话中的行为契约：Agent 读到这里才知道何时该调用本技能。
frontmatter 用 Hermes 格式（name/description/version/tags）；
发布到 skillhub 时根目录的 SKILL.md 用 skillhub 格式（slug/displayName/summary/license）。
-->

## 何时使用（触发场景）

当用户出现以下诉求时，使用本技能：

1. ……
2. ……
3. ……

## 如何使用

```bash
npx --yes __SKILL_NAME__@latest greet world
```

## 能力边界

**能做**：
- ……

**不能做**：
- ……

## 凭据

Fmode 标准 5 级凭据链，命中即用：

```
第0级  FMODE_SESSION_TOKEN / ~/.fmode/config.json 的 sessionToken → 自举
第1级  环境变量 FMODE_API_TOKEN
第2级  ~/.fmode/config.json → fmodeApiToken
第3级  <cwd>/.fmode/config.json → fmodeApiToken
第4级  ~/.claude/settings.json → env.ANTHROPIC_AUTH_TOKEN
```

全失败时必须显式报错并给出配置指引，**不得伪装成功**。

## 平台端点

<!-- 只列真实用到的端点，并标注实测状态（live / planned / deprecated） -->

| 端点 | 状态 | 用途 |
|------|------|------|
| — | — | — |

> ⚠️ `planned` 端点调用前必须探测，404 时显式回落。

## 验证方法

```bash
npm test                  # 冒烟测试
skill-core check .        # 六项自动质检
```

## License

MIT
