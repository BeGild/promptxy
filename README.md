# promptxy - 本地提示词网关

> 🚀 **5分钟快速开始**：拦截并改写 Claude Code、Codex CLI、Gemini CLI 的系统提示词

`promptxy` 是一个本地 HTTP 网关服务，用于拦截和改写 AI CLI 工具的系统提示词（system prompt/instructions），无需修改 CLI 源码即可定制工具的默认行为。

## ✨ 核心功能

- **拦截改写**：对 Claude Code、Codex CLI、Gemini CLI 的请求体进行提示词改写
- **规则引擎**：支持替换、删除、追加、插入等 7 种 CRUD 操作
- **本地部署**：默认监听 `127.0.0.1`，不暴露公网
- **零侵入**：完全透传认证信息，不存储任何上游密钥
- **流式支持**：完整支持 SSE/stream 响应透传

> 原始动机与需求分析见：`docs/origin-and-requirements.md`

---

## ⚡ 5分钟快速开始

### 步骤 1：安装依赖

```bash
npm install
```

### 步骤 2：创建配置文件

```bash
# 复制示例配置
cp promptxy.config.example.json promptxy.config.json
```

### 步骤 3：启动服务

```bash
npm run dev
```

输出应显示：
```
promptxy listening on http://127.0.0.1:7070
```

### 步骤 4：验证服务

```bash
curl http://127.0.0.1:7070/_promptxy/health
# 预期输出：{"status":"ok"}
```

### 步骤 5：配置 CLI 使用网关

#### Claude Code
```bash
export ANTHROPIC_BASE_URL="http://127.0.0.1:7070"
# 然后正常使用 claude code
```

#### Codex CLI
```bash
export OPENAI_BASE_URL="http://127.0.0.1:7070/openai"
# 然后正常使用 codex cli
```

#### Gemini CLI
```bash
export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:7070/gemini"
# 然后正常使用 gemini cli
```

---

## 🎯 常见用例

### 用例 1：强制所有 CLI 使用中文

```json
{
  "rules": [
    {
      "id": "force-chinese-claude",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    },
    {
      "id": "force-chinese-codex",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [{ "type": "append", "text": "\nAlways respond in Chinese." }]
    }
  ]
}
```

### 用例 2：删除某些限制规则

```json
{
  "rules": [
    {
      "id": "remove-file-limit",
      "when": { "client": "claude", "field": "system" },
      "ops": [{ "type": "delete", "regex": "file size.*?\\d+MB", "flags": "i" }]
    }
  ]
}
```

### 用例 3：在特定位置插入自定义规则

```json
{
  "rules": [
    {
      "id": "insert-after-safety",
      "when": { "client": "codex", "field": "instructions" },
      "ops": [{ "type": "insert_after", "regex": "^You are", "text": " Always be helpful." }]
    }
  ]
}
```

---

## 🔍 故障排查

### 问题：服务启动失败

**检查端口占用**
```bash
lsof -i :7070
# 或
netstat -tlnp | grep 7070
```

**解决**：修改配置中的端口或终止占用进程

---

### 问题：CLI 请求未被拦截

**检查环境变量**
```bash
# Claude Code
echo $ANTHROPIC_BASE_URL

# Codex CLI
echo $OPENAI_BASE_URL

# Gemini CLI
echo $GOOGLE_GEMINI_BASE_URL
```

**验证网关日志**
启动服务时添加 `debug: true` 或设置 `PROMPTXY_DEBUG=1` 查看详细日志

---

### 问题：规则未生效

**检查规则匹配条件**
- `client` 必须匹配：`claude` / `codex` / `gemini`
- `field` 必须匹配：`system` (Claude/Gemini) / `instructions` (Codex)
- `pathRegex` / `modelRegex` 可选

**启用调试模式**
```bash
PROMPTXY_DEBUG=1 npm run dev
```

---

### 问题：认证失败

**检查认证头透传**
- `promptxy` 不存储密钥，完全依赖 CLI 自带的认证信息
- 确保 CLI 本身配置了正确的 API Key

---

## 📚 更多文档

- [完整使用指南](docs/usage.md) - 详细的 CLI 配置和规则语法
- [配置参考](docs/configuration.md) - 所有配置选项说明
- [origin-and-requirements.md](docs/origin-and-requirements.md) - 项目背景与设计决策

---

## 🧪 测试

```bash
# 运行所有测试
npm test
```

---

## 📄 许可证

MIT

---

## 💡 提示

- 首次使用建议启用 `PROMPTXY_DEBUG=1` 查看规则匹配情况
- 规则按数组顺序执行，注意顺序影响结果
- 使用健康检查端点 `/_promptxy/health` 监控服务状态
- 配置修改后需要重启服务生效
