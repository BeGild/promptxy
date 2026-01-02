<!-- OPENSPEC:START -->

# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:

- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:

- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# 0. 至高原则

1. 始终使用中文回复
2. 任何代码修改前 MUST 获得方案review通过

# 1. 版本管理(git)

1. 必须使用中文commit message
2. 禁止使用简单的一行命令，必须详细描述 改动
3. 鼓励使用图表来描述架构改动

# 2. 开发调试

1. 使用 `./scripts/dev.sh &` 来一键启动开发服务器，注意后台运行避免阻塞工具，验证完毕后及时关闭
