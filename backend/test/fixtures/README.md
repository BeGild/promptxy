# Protocol Transformation Test Fixtures

此目录包含用于协议转换测试的样例请求 fixture 文件。

## 用途

这些 fixtures 基于 `docs/protocol-transformation-research.md` 第 8.5 节的参考请求样例整理而来，用于：

- 单元测试：测试单个转换步骤
- 集成测试：测试完整转换链
- 回归测试：确保转换行为不随版本变化而破坏

## 文件说明

| 文件 | 描述 | 场景 |
|------|------|------|
| `anthropic-simple-no-tools.json` | 简单 Anthropic 请求 | 无流式、无工具 |
| `anthropic-messages-stream-tools.json` | Anthropic Messages API | 流式 + 工具调用 |
| `openai-responses-stream-tools.json` | OpenAI Responses API | 流式 + 工具调用 |
| `gemini-stream-tools.json` | Gemini streamGenerateContent | 流式 + 系统指令 + 工具 |

## Fixtures 结构

每个 fixture 文件包含：

```json
{
  "description": "fixture 描述",
  "source": "来源客户端",
  "request": {
    "method": "HTTP 方法",
    "path": "请求路径",
    "headers": "请求头（已脱敏）",
    "body": "请求体"
  },
  "expected<TargetProtocol>": {
    "method": "转换后 HTTP 方法",
    "path": "转换后路径",
    "body": "转换后请求体（期望值）"
  }
}
```

## 脱敏策略

- 所有 token/secret 已移除或替换为占位符
- 请求头中不包含敏感信息
- 请求体中不包含真实的 API key 或认证信息

## 添加新 Fixture

如需添加新的测试 fixture，请遵循以下格式：

1. 文件命名：`{source}-{feature}.json`
2. 包含 `description` 说明用途
3. 包含 `request` 原始请求
4. 包含 `expected{Target}` 期望的转换结果
5. 确保脱敏所有敏感信息

## 使用示例

```typescript
import anthropicSimple from '../fixtures/anthropic-simple-no-tools.json';

describe('ProtocolTransformer', () => {
  it('should transform simple Anthropic request to OpenAI', async () => {
    const result = await transformer.transform({
      supplier: { ... },
      request: anthropicSimple.request
    });

    expect(result.request.body).toEqual(anthropicSimple.expectedOpenAI.body);
  });
});
```
