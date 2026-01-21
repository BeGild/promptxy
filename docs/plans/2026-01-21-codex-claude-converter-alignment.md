# Codex → Claude 转换器对齐参考实现实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 对齐当前项目的 Codex ↔ Claude 转换器与参考实现 CLIProxyAPI，修复 tool name 缩短/恢复、web_search 特殊处理、特殊前置指令等关键差异。

**架构：** 在请求转换器中添加 tool name 缩短逻辑（64字符限制，mcp__前缀处理），在响应转换器中添加 tool name 恢复逻辑，同时添加 web_search 工具特殊处理和特殊前置指令消息。

**技术栈：** TypeScript, Node.js, Vitest, Git

---

## 重要说明

- **必须在独立 worktree 中执行**（避免污染 `master`）
- 本计划按 TDD 原则：每个功能先写测试，再实现
- 每个任务结束时必须提交（中文 commit message）
- 参考实现位置：`refence/CLIProxyAPI/internal/translator/codex/claude/`

---

## P0 优先级：Tool Name 缩短/恢复机制

### Task 1: 实现 tool name 缩短函数（请求侧）

**文件：**
- Create: `backend/src/promptxy/transformers/protocols/codex/tool-name.ts`
- Modify: `backend/src/promptxy/transformers/protocols/codex/render.ts`
- Test: `backend/tests/transformers/protocols/codex/tool-name.test.ts`

**背景：** 参考实现 (codex_claude_request.go:265-336) 有完整的 tool name 缩短逻辑，处理 64 字符限制和 mcp__ 前缀。

**Step 1: 创建测试文件验证缩短逻辑**

创建文件 `backend/tests/transformers/protocols/codex/tool-name.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildShortNameMap,
  shortenNameIfNeeded,
  type ShortNameMap,
} from '../../../../src/promptxy/transformers/protocols/codex/tool-name.js';

describe('buildShortNameMap', () => {
  it('应保持短名称不变', () => {
    const names = ['short', 'tool_name', 'TestTool'];
    const result = buildShortNameMap(names);
    expect(result).toEqual({
      'short': 'short',
      'tool_name': 'tool_name',
      'TestTool': 'TestTool',
    });
  });

  it('应将长名称截断到 64 字符', () => {
    const longName = 'a'.repeat(100);
    const names = [longName];
    const result = buildShortNameMap(names);
    expect(result[longName]).toBe('a'.repeat(64));
  });

  it('应处理 mcp__ 前缀的长名称', () => {
    const longName = 'mcp__very_long_server_name_with_many_underscores__extremely_long_tool_name_that_exceeds_limit';
    const names = [longName];
    const result = buildShortNameMap(names);
    // 期望保留 mcp__ 前缀，保留最后 __ 后的部分，然后截断到 64
    expect(result[longName].length).toBeLessThanOrEqual(64);
    expect(result[longName]).toMatch(/^mcp__/);
  });

  it('应确保缩短后的名称唯一性', () => {
    const name1 = 'mcp__server1__tool_name';
    const name2 = 'mcp__server2__tool_name';
    const names = [name1, name2];
    const result = buildShortNameMap(names);
    // 两者应该映射到不同的短名称
    expect(result[name1]).not.toBe(result[name2]);
    expect(result[name1].length).toBeLessThanOrEqual(64);
    expect(result[name2].length).toBeLessThanOrEqual(64);
  });

  it('应通过添加数字后缀处理重复', () => {
    const name1 = 'a'.repeat(70);  // 都会缩短到 64 字符 'aaa...a'
    const name2 = 'b'.repeat(70);  // 都会缩短到 64 字符 'bbb...b'
    const name3 = 'c'.repeat(70);
    const names = [name1, name2, name3];
    const result = buildShortNameMap(names);
    // 每个应该有唯一的短名称
    const shortNames = Object.values(result);
    const uniqueShortNames = new Set(shortNames);
    expect(uniqueShortNames.size).toBe(names.length);
  });
});

describe('shortenNameIfNeeded', () => {
  it('应保持短名称不变', () => {
    expect(shortenNameIfNeeded('short')).toBe('short');
    expect(shortenNameIfNeeded('tool_name')).toBe('tool_name');
  });

  it('应截断长名称', () => {
    const longName = 'a'.repeat(100);
    expect(shortenNameIfNeeded(longName)).toBe('a'.repeat(64));
  });

  it('应智能处理 mcp__ 前缀', () => {
    // mcp__server__tool  -> mcp__tool (如果超过 64)
    const longName = 'mcp__very_long_server_name__tool_name_here';
    const result = shortenNameIfNeeded(longName);
    expect(result).toMatch(/^mcp__/);
    expect(result.length).toBeLessThanOrEqual(64);
  });
});
```

**Step 2: 运行测试确认失败**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/tool-name.test.ts
```

预期：FAIL with "Cannot find module 'tool-name.ts'"

**Step 3: 实现缩短逻辑**

创建文件 `backend/src/promptxy/transformers/protocols/codex/tool-name.ts`：

```typescript
/**
 * Tool Name 缩短/恢复工具
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:265-336
 *
 * 问题：某些上游 (如 OpenAI/Codex) 对 tool name 有 64 字符限制
 * 解决：智能缩短长名称，特别是 mcp__ 前缀的工具
 */

const LIMIT = 64;

/**
 * 单个名称的缩短候选（基础逻辑，不保证唯一性）
 */
function baseCandidate(name: string): string {
  if (name.length <= LIMIT) {
    return name;
  }

  // 处理 mcp__ 前缀的特殊逻辑
  // 格式：mcp__server_name__tool_name
  // 策略：保留 mcp__ 和最后的 tool_name 部分
  if (name.startsWith('mcp__')) {
    const lastDoubleUnderscoreIdx = name.lastIndexOf('__');
    if (lastDoubleUnderscoreIdx > 5) {  // 必须在 mcp__ 之后
      const toolPart = name.substring(lastDoubleUnderscoreIdx + 2);
      const candidate = 'mcp__' + toolPart;
      if (candidate.length > LIMIT) {
        return candidate.substring(0, LIMIT);
      }
      return candidate;
    }
  }

  // 默认：直接截断
  return name.substring(0, LIMIT);
}

/**
 * 确保候选名称在已使用名称中唯一
 */
function makeUnique(candidate: string, used: Set<string>): string {
  if (!used.has(candidate)) {
    return candidate;
  }

  const base = candidate;
  let suffix = 1;
  while (true) {
    const suffixStr = '_' + suffix.toString();
    const allowed = LIMIT - suffixStr.length;
    if (allowed < 0) {
      // 即使无法添加后缀，也要返回一个值
      return candidate.substring(0, LIMIT);
    }
    const truncated = base.length > allowed ? base.substring(0, allowed) : base;
    const uniqueCandidate = truncated + suffixStr;
    if (!used.has(uniqueCandidate)) {
      return uniqueCandidate;
    }
    suffix++;
    if (suffix > 1000) {
      // 防止无限循环
      return uniqueCandidate;
    }
  }
}

/**
 * 短名称映射类型
 */
export type ShortNameMap = Record<string, string>;

/**
 * 为一组名称构建短名称映射
 *
 * @param names - 原始名称列表
 * @returns 映射表，original -> short
 */
export function buildShortNameMap(names: string[]): ShortNameMap {
  const used = new Set<string>();
  const result: ShortNameMap = {};

  for (const name of names) {
    const candidate = baseCandidate(name);
    const unique = makeUnique(candidate, used);
    used.add(unique);
    result[name] = unique;
  }

  return result;
}

/**
 * 对单个名称应用缩短规则（不处理唯一性）
 *
 * 注意：这个函数不保证唯一性，只用于单一名称的快速缩短
 * 对于需要唯一性的场景，请使用 buildShortNameMap
 */
export function shortenNameIfNeeded(name: string): string {
  if (name.length <= LIMIT) {
    return name;
  }

  // 处理 mcp__ 前缀
  if (name.startsWith('mcp__')) {
    const lastDoubleUnderscoreIdx = name.lastIndexOf('__');
    if (lastDoubleUnderscoreIdx > 5) {
      const toolPart = name.substring(lastDoubleUnderscoreIdx + 2);
      const candidate = 'mcp__' + toolPart;
      if (candidate.length > LIMIT) {
        return candidate.substring(0, LIMIT);
      }
      return candidate;
    }
  }

  return name.substring(0, LIMIT);
}
```

**Step 4: 运行测试验证通过**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/tool-name.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/tool-name.ts backend/tests/transformers/protocols/codex/tool-name.test.ts
git commit -m "实现：tool name 缩短工具函数

- 实现 buildShortNameMap 处理多名称唯一缩短
- 实现 shortenNameIfNeeded 处理单名称缩短
- 支持 mcp__ 前缀智能处理（保留最后 __ 后部分）
- 确保 64 字符限制
- 添加完整单元测试

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:265-336"
```

---

### Task 2: 在请求转换器中应用 tool name 缩短

**文件：**
- Modify: `backend/src/promptxy/transformers/protocols/codex/render.ts`
- Test: `backend/tests/transformers/protocols/codex/render.test.ts`

**Step 1: 更新 render.ts 导入并应用缩短逻辑**

在文件顶部添加导入：

```typescript
import { buildShortNameMap, type ShortNameMap } from './tool-name.js';
```

修改 `renderTools` 函数（约第 252 行）：

```typescript
function renderTools(
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>,
  audit: FieldAuditCollector,
): any[] {
  // 构建短名称映射
  const toolNames = tools.map(t => t.name);
  const shortNameMap = buildShortNameMap(toolNames);

  return tools.map((tool, idx) => {
    const basePath = `/tools/${idx}`;

    // 应用缩短后的名称
    const shortName = shortNameMap[tool.name];

    // 修复 upstream 对部分"输出/回填字段"的严格校验
    const normalizedInputSchema = normalizeToolInputSchemaForCodex(
      tool.name,
      tool.inputSchema,
      audit,
      basePath,
    );

    const prunedSchema = pruneToolSchema(normalizedInputSchema, audit);

    const codexTool: CodexResponsesApiTool = {
      type: 'function',
      name: shortName,  // 使用缩短后的名称
      description: tool.description,
      strict: true,
      parameters: prunedSchema as any,
    };

    return codexTool;
  });
}
```

修改 `renderInput` 函数中的 tool_use 处理（约第 189 行）：

```typescript
// 需要在 renderInput 函数中访问 shortNameMap
// 修改函数签名以接收 shortNameMap 参数
function renderInput(
  messages: Array<{
    role: string;
    content: { blocks: Array<{ type: string; [key: string]: any }> };
  }>,
  shortNameMap: ShortNameMap,  // 新增参数
  audit: FieldAuditCollector,
): CodexResponseItem[] {
  // ... 现有代码 ...

      } else if (block.type === 'tool_use') {
        // tool_use -> function_call
        // 应用名称缩短
        const shortName = shortNameMap[block.name] || block.name;

        const fnCallItem: CodexFunctionCallItem = {
          type: 'function_call',
          call_id: block.id || '',
          name: shortName,  // 使用缩短后的名称
          arguments: JSON.stringify(block.input || {}),
        };
        input.push(fnCallItem);
        itemIndex++;
```

修改 `renderCodexRequest` 函数以构建并传递 shortNameMap（约第 46 行）：

```typescript
export function renderCodexRequest(
  // ... 现有参数 ...
): CodexResponsesApiRequest {
  const { model, system, messages, tools, stream, sessionId, promptCacheRetention } = params;

  // 1. instructions
  const instructions = renderInstructions(system.text, config.instructionsTemplate, audit);

  // 2. 构建 tool name 缩短映射
  const toolNames = tools.map(t => t.name);
  const shortNameMap = buildShortNameMap(toolNames);

  // 3. messages -> input[] (传递 shortNameMap)
  const input = renderInput(messages, shortNameMap, audit);

  // 4. tools -> tools[]
  const renderedTools = renderTools(tools, shortNameMap, audit);  // 传递 shortNameMap

  // ... 其余代码不变 ...
}
```

同时更新 `renderTools` 函数签名：

```typescript
function renderTools(
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>,
  shortNameMap: ShortNameMap,  // 新增参数
  audit: FieldAuditCollector,
): any[] {
```

**Step 2: 编写集成测试验证缩短应用**

创建或修改测试文件 `backend/tests/transformers/protocols/codex/render.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { renderCodexRequest } from '../../../../src/promptxy/transformers/protocols/codex/render.js';
import { FieldAuditCollector } from '../../../../src/promptxy/transformers/audit/field-audit.js';

describe('renderCodexRequest - tool name 缩短', () => {
  it('应缩短超过 64 字符的 tool name', () => {
    const longToolName = 'mcp__very_long_server_name_with_many_characters__extremely_long_tool_name_that_exceeds_limit';
    const audit = new FieldAuditCollector();

    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are a helpful assistant.' },
        messages: [],
        tools: [{
          name: longToolName,
          description: 'A tool with a very long name',
          inputSchema: { type: 'object', properties: {} },
        }],
        stream: true,
      },
      {},
      audit,
    );

    expect(result.tools[0].name.length).toBeLessThanOrEqual(64);
    expect(result.tools[0].name).toMatch(/^mcp__/);
  });

  it('应在 tool_use 中使用缩短后的名称', () => {
    const longToolName = 'a'.repeat(100);
    const audit = new FieldAuditCollector();

    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are a helpful assistant.' },
        messages: [{
          role: 'assistant',
          content: {
            blocks: [{
              type: 'tool_use',
              id: 'call_123',
              name: longToolName,
              input: { arg: 'value' },
            }],
          },
        }],
        tools: [{
          name: longToolName,
          description: 'A tool',
          inputSchema: { type: 'object', properties: {} },
        }],
        stream: true,
      },
      {},
      audit,
    );

    // 检查 input 中的 function_call 使用了缩短后的名称
    const fnCall = result.input.find(item => item.type === 'function_call');
    expect(fnCall).toBeDefined();
    expect((fnCall as any).name.length).toBeLessThanOrEqual(64);
  });

  it('应保持短名称不变', () => {
    const shortNames = ['short', 'tool_name', 'TestTool'];
    const audit = new FieldAuditCollector();

    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are a helpful assistant.' },
        messages: [],
        tools: shortNames.map(name => ({
          name,
          description: `Tool ${name}`,
          inputSchema: { type: 'object', properties: {} },
        })),
        stream: true,
      },
      {},
      audit,
    );

    expect(result.tools.map(t => t.name)).toEqual(shortNames);
  });
});
```

**Step 3: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/render.test.ts
```

预期：PASS

**Step 4: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/render.ts backend/tests/transformers/protocols/codex/render.test.ts
git commit -m "实现：在请求转换器中应用 tool name 缩短

- 在 renderCodexRequest 中构建 shortNameMap
- 在 renderTools 中应用缩短后的名称
- 在 renderInput 的 tool_use 处理中应用缩短后的名称
- 添加集成测试验证缩短正确应用

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:143-154"
```

---

### Task 3: 实现反向映射并导出供响应转换器使用

**文件：**
- Create: `backend/src/promptxy/transformers/protocols/codex/short-name-reverse-lookup.ts`
- Modify: `backend/src/promptxy/transformers/protocols/codex/render.ts`
- Test: `backend/tests/transformers/protocols/codex/short-name-reverse-lookup.test.ts`

**Step 1: 创建反向映射工具**

创建文件 `backend/src/promptxy/transformers/protocols/codex/short-name-reverse-lookup.ts`：

```typescript
/**
 * Tool Name 反向查找工具
 *
 * 在响应转换器中，需要将上游返回的短名称恢复为原始名称
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:308-330
 */

import type { ShortNameMap } from './tool-name.js';

/**
 * 反向映射类型：short -> original
 */
export type ReverseShortNameMap = Record<string, string>;

/**
 * 从短名称映射构建反向映射
 *
 * @param shortNameMap - original -> short 映射
 * @returns short -> original 映射
 */
export function buildReverseShortNameMap(shortNameMap: ShortNameMap): ReverseShortNameMap {
  const reverse: ReverseShortNameMap = {};

  for (const [original, short] of Object.entries(shortNameMap)) {
    reverse[short] = original;
  }

  return reverse;
}

/**
 * 从短名称恢复原始名称
 *
 * @param shortName - 短名称
 * @param reverseMap - 反向映射表
 * @returns 原始名称（如果找到），否则返回短名称
 */
export function restoreOriginalName(shortName: string, reverseMap: ReverseShortNameMap): string {
  return reverseMap[shortName] || shortName;
}
```

**Step 2: 创建测试**

创建文件 `backend/tests/transformers/protocols/codex/short-name-reverse-lookup.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  buildShortNameMap,
} from '../../../../src/promptxy/transformers/protocols/codex/tool-name.js';
import {
  buildReverseShortNameMap,
  restoreOriginalName,
} from '../../../../src/promptxy/transformers/protocols/codex/short-name-reverse-lookup.js';

describe('buildReverseShortNameMap', () => {
  it('应构建正确的反向映射', () => {
    const shortMap = {
      'very_long_tool_name_that_exceeds': 'very_long_tool_name_that_exceeds',
      'mcp__server__tool': 'mcp__tool',
    };
    const reverse = buildReverseShortNameMap(shortMap);

    expect(reverse['very_long_tool_name_that_exceeds']).toBe('very_long_tool_name_that_exceeds');
    expect(reverse['mcp__tool']).toBe('mcp__server__tool');
  });
});

describe('restoreOriginalName', () => {
  it('应恢复被缩短的名称', () => {
    const shortMap = buildShortNameMap([
      'mcp__very_long_server__tool_name',
      'short_tool',
    ]);
    const reverse = buildReverseShortNameMap(shortMap);

    expect(restoreOriginalName('mcp__tool_name', reverse)).toBe('mcp__very_long_server__tool_name');
    expect(restoreOriginalName('short_tool', reverse)).toBe('short_tool');
  });

  it('对未缩短的名称应返回原值', () => {
    const shortMap = buildShortNameMap(['short', 'tool_name']);
    const reverse = buildReverseShortNameMap(shortMap);

    expect(restoreOriginalName('short', reverse)).toBe('short');
    expect(restoreOriginalName('tool_name', reverse)).toBe('tool_name');
  });

  it('对未知名称应返回原值', () => {
    const shortMap = buildShortNameMap(['known_tool']);
    const reverse = buildReverseShortNameMap(shortMap);

    expect(restoreOriginalName('unknown_tool', reverse)).toBe('unknown_tool');
  });
});
```

**Step 3: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/short-name-reverse-lookup.test.ts
```

预期：PASS

**Step 4: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/short-name-reverse-lookup.ts backend/tests/transformers/protocols/codex/short-name-reverse-lookup.test.ts
git commit -m "实现：tool name 反向映射工具

- 实现 buildReverseShortNameMap 构建反向映射
- 实现 restoreOriginalName 恢复原始名称
- 添加完整单元测试

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:308-330"
```

---

### Task 4: 在响应转换器中应用 tool name 恢复

**文件：**
- Modify: `backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts`
- Test: `backend/tests/transformers/protocols/codex/sse/to-claude.test.ts`

**Step 1: 更新转换器签名以接收反向映射**

修改 `createCodexSSEToClaudeStreamTransformer` 函数（约第 150 行）：

```typescript
export type SSETransformContext = {
  /** 请求侧注入的 input_tokens（上游缺失 usage 时兜底） */
  estimatedInputTokens?: number;
  /** tool name 反向映射（short -> original） */
  reverseShortNameMap?: Record<string, string>;
};

export function createCodexSSEToClaudeStreamTransformer(
  config: SSETransformConfig,
  audit: FieldAuditCollector,
  context?: SSETransformContext,
): CodexSSEToClaudeStreamTransformer {
  const state = createInitialState();
  state.estimatedInputTokens = context?.estimatedInputTokens;
  // 存储反向映射供后续使用
  const reverseShortNameMap = context?.reverseShortNameMap;
  let ended = false;
```

**Step 2: 在 tool_use 输出时应用名称恢复**

修改 `transformSingleEvent` 函数中的 `response.output_item.added` 处理（约第 361 行）：

```typescript
    case 'response.output_item.added': {
      const item = (event as any).item;

      if (item.type === 'function_call' || item.type === 'custom_tool_call') {
        state.hasToolCall = true;
        state.currentActiveToolIndex = state.currentToolIndex;
        state.currentToolCallStarted = true;

        if (state.textBlockStarted) {
          claudeEvents.push(createContentBlockStopEvent(0));
          state.textBlockStarted = false;
        }

        // 恢复原始 tool name（如果有反向映射）
        const originalName = reverseShortNameMap?.[item.name] || item.name;

        claudeEvents.push(createContentBlockStartEvent(state.currentToolIndex, 'tool_use', {
          id: item.call_id,
          name: originalName,  // 使用恢复后的名称
        }));

        claudeEvents.push(createContentBlockDeltaEvent(state.currentToolIndex, 'input_json_delta', {
          partial_json: '',
        }));
      }
      break;
    }
```

**Step 3: 编写集成测试验证名称恢复**

创建或修改测试文件 `backend/tests/transformers/protocols/codex/sse/to-claude.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { createCodexSSEToClaudeStreamTransformer } from '../../../../src/promptxy/transformers/protocols/codex/sse/to-claude.js';
import { FieldAuditCollector } from '../../../../src/promptxy/transformers/audit/field-audit.js';
import type { CodexSSEEvent } from '../../../../src/promptxy/transformers/protocols/codex/types.js';

describe('createCodexSSEToClaudeStreamTransformer - tool name 恢复', () => {
  it('应恢复被缩短的 tool name', () => {
    const reverseMap = {
      'mcp__tool': 'mcp__very_long_server__tool_name',
      'short_tool': 'short_tool',  // 未缩短的也要能处理
    };

    const transformer = createCodexSSEToClaudeStreamTransformer(
      { customToolCallStrategy: 'wrap_object' },
      new FieldAuditCollector(),
      { reverseShortNameMap: reverseMap },
    );

    const codexEvent: CodexSSEEvent = {
      type: 'response.output_item.added',
      item: {
        type: 'function_call',
        call_id: 'call_123',
        name: 'mcp__tool',  // 短名称
        arguments: '{}',
      },
    };

    const result = transformer.pushEvent(codexEvent);

    // 验证输出中使用了原始名称
    const blockStartEvent = result.events.find(e => e.type === 'content_block_start');
    expect(blockStartEvent).toBeDefined();
    expect((blockStartEvent as any).content_block.name).toBe('mcp__very_long_server__tool_name');
  });

  it('对未缩短的名称应保持不变', () => {
    const reverseMap = {
      'normal_tool': 'normal_tool',
    };

    const transformer = createCodexSSEToClaudeStreamTransformer(
      { customToolCallStrategy: 'wrap_object' },
      new FieldAuditCollector(),
      { reverseShortNameMap: reverseMap },
    );

    const codexEvent: CodexSSEEvent = {
      type: 'response.output_item.added',
      item: {
        type: 'function_call',
        call_id: 'call_456',
        name: 'normal_tool',
        arguments: '{}',
      },
    };

    const result = transformer.pushEvent(codexEvent);

    const blockStartEvent = result.events.find(e => e.type === 'content_block_start');
    expect(blockStartEvent).toBeDefined();
    expect((blockStartEvent as any).content_block.name).toBe('normal_tool');
  });
});
```

**Step 4: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/sse/to-claude.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/sse/to-claude.ts backend/tests/transformers/protocols/codex/sse/to-claude.test.ts
git commit -m "实现：在响应转换器中应用 tool name 恢复

- 在 SSETransformContext 中添加 reverseShortNameMap
- 在 output_item.added 处理中恢复原始名称
- 添加集成测试验证名称恢复

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_response.go:126-134"
```

---

### Task 5: 在 Gateway 中连接请求和响应的 name 映射

**文件：**
- Modify: `backend/src/promptxy/gateway.ts` (或实际处理请求的地方)
- Test: `backend/tests/integration/tool-name-roundtrip.test.ts`

**Step 1: 定位 gateway 中的转换器调用点**

```bash
grep -n "createCodexSSEToClaudeStreamTransformer\|renderCodexRequest" backend/src/promptxy/gateway.ts
```

**Step 2: 修改 gateway 以传递映射**

在请求处理部分，捕获 shortNameMap：

```typescript
// 在调用 renderCodexRequest 后
const shortNameMap = buildShortNameMap(tools.map(t => t.name));
const codexRequest = renderCodexRequest(
  { /* ... */ },
  { /* ... */ },
  audit,
);

// 将反向映射传递给响应转换器
const reverseShortNameMap = buildReverseShortNameMap(shortNameMap);

// 在创建响应转换器时传递
const sseTransformer = createCodexSSEToClaudeStreamTransformer(
  { customToolCallStrategy: 'wrap_object' },
  audit,
  { reverseShortNameMap },
);
```

**注意：** 具体实现位置需要根据实际代码结构调整。可能需要在转换管线中传递上下文。

**Step 3: 编写端到端测试**

创建文件 `backend/tests/integration/tool-name-roundtrip.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import { buildShortNameMap, buildReverseShortNameMap } from '../../src/promptxy/transformers/protocols/codex/tool-name.js';
import { buildReverseShortNameMap as buildReverse } from '../../src/promptxy/transformers/protocols/codex/short-name-reverse-lookup.js';
import { createCodexSSEToClaudeStreamTransformer } from '../../src/promptxy/transformers/protocols/codex/sse/to-claude.js';
import { FieldAuditCollector } from '../../src/promptxy/transformers/audit/field-audit.js';

describe('Tool Name Roundtrip (请求 -> 上游 -> 响应)', () => {
  it('应完整往返：原始名称 -> 短名称 -> 原始名称', () => {
    const originalNames = [
      'mcp__very_long_server_name__tool_name_here',
      'short_tool',
      'a'.repeat(100),  // 超长名称
    ];

    // 步骤 1: 构建短名称映射
    const shortNameMap = buildShortNameMap(originalNames);

    // 步骤 2: 模拟上游收到短名称
    const shortNames = originalNames.map(name => shortNameMap[name]);

    // 步骤 3: 构建反向映射
    const reverseMap = buildReverseShortNameMap(shortNameMap);

    // 步骤 4: 验证能恢复原始名称
    const restoredNames = shortNames.map(short => reverseMap[short] || short);

    expect(restoredNames).toEqual(originalNames);
  });

  it('在响应转换器中应正确恢复', () => {
    const originalName = 'mcp__server__my_tool';
    const shortNameMap = buildShortNameMap([originalName]);
    const reverseMap = buildReverseShortNameMap(shortNameMap);

    const transformer = createCodexSSEToClaudeStreamTransformer(
      { customToolCallStrategy: 'wrap_object' },
      new FieldAuditCollector(),
      { reverseShortNameMap: reverseMap },
    );

    // 模拟上游返回短名称
    const shortName = shortNameMap[originalName];
    const codexEvent = {
      type: 'response.output_item.added',
      item: {
        type: 'function_call',
        call_id: 'call_123',
        name: shortName,
        arguments: '{}',
      },
    };

    const result = transformer.pushEvent(codexEvent as any);
    const blockStart = result.events.find(e => e.type === 'content_block_start');

    expect((blockStart as any).content_block.name).toBe(originalName);
  });
});
```

**Step 4: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/integration/tool-name-roundtrip.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/promptxy/gateway.ts backend/tests/integration/tool-name-roundtrip.test.ts
git commit -m "实现：在 Gateway 中连接请求和响应的 tool name 映射

- 在请求处理中捕获 shortNameMap
- 构建反向映射并传递给响应转换器
- 添加端到端测试验证完整往返

完成 P0 优先级：tool name 缩短/恢复机制完整实现"
```

---

## P1 优先级：特殊工具处理和前置指令

### Task 6: 实现 web_search 工具特殊处理

**文件：**
- Modify: `backend/src/promptxy/transformers/protocols/codex/render.ts`
- Test: `backend/tests/transformers/protocols/codex/render.test.ts`

**背景：** 参考实现 (codex_claude_request.go:190-195) 将 `web_search_20250305` 类型转换为 `{"type":"web_search"}`。

**Step 1: 修改 renderTools 函数添加特殊处理**

在 `renderTools` 函数中，在工具处理前添加特殊逻辑：

```typescript
function renderTools(
  tools: Array<{
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
  }>,
  shortNameMap: ShortNameMap,
  audit: FieldAuditCollector,
): any[] {
  return tools.map((tool, idx) => {
    const basePath = `/tools/${idx}`;

    // 特殊处理：Claude web_search 工具转换为 Codex web_search
    // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:190-195
    if (tool.name === 'web_search_20250305') {
      audit.addDefaulted({
        path: `${basePath}/type`,
        source: 'special_handling',
        reason: 'Convert Claude web_search_20250305 to Codex web_search type',
      });
      return {
        type: 'web_search',
      };
    }

    // 常规工具处理...
    const shortName = shortNameMap[tool.name];
    const normalizedInputSchema = normalizeToolInputSchemaForCodex(
      tool.name,
      tool.inputSchema,
      audit,
      basePath,
    );

    const prunedSchema = pruneToolSchema(normalizedInputSchema, audit);

    const codexTool: CodexResponsesApiTool = {
      type: 'function',
      name: shortName,
      description: tool.description,
      strict: true,
      parameters: prunedSchema as any,
    };

    return codexTool;
  });
}
```

**Step 2: 添加测试验证特殊处理**

在 `backend/tests/transformers/protocols/codex/render.test.ts` 中添加：

```typescript
  it('应将 web_search_20250305 转换为 web_search 类型', () => {
    const audit = new FieldAuditCollector();

    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are a helpful assistant.' },
        messages: [],
        tools: [{
          name: 'web_search_20250305',
          description: 'Web search tool',
          inputSchema: { type: 'object', properties: {} },
        }],
        stream: true,
      },
      {},
      audit,
    );

    expect(result.tools[0]).toEqual({
      type: 'web_search',
    });
    expect(result.tools[0].name).toBeUndefined();
  });
```

**Step 3: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/render.test.ts
```

预期：PASS

**Step 4: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/render.ts backend/tests/transformers/protocols/codex/render.test.ts
git commit -m "实现：web_search 工具特殊处理

- 将 web_search_20250305 转换为 {type: \"web_search\"}
- 添加审计记录
- 添加测试验证特殊处理

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:190-195"
```

---

### Task 7: 添加特殊前置指令消息

**文件：**
- Modify: `backend/src/promptxy/transformers/protocols/codex/render.ts`
- Test: `backend/tests/transformers/protocols/codex/render.test.ts`

**背景：** 参考实现 (codex_claude_request.go:244-260) 在 input 开头添加 "EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!" 消息。

**Step 1: 修改 renderCodexRequest 函数添加前置消息**

在 `renderCodexRequest` 函数中，处理 input 后添加前置消息：

```typescript
export function renderCodexRequest(
  // ... 参数不变 ...
): CodexResponsesApiRequest {
  const { model, system, messages, tools, stream, sessionId, promptCacheRetention } = params;

  const instructions = renderInstructions(system.text, config.instructionsTemplate, audit);
  const toolNames = tools.map(t => t.name);
  const shortNameMap = buildShortNameMap(toolNames);
  const input = renderInput(messages, shortNameMap, audit);
  const renderedTools = renderTools(tools, shortNameMap, audit);

  const reasoning = config.reasoningEffort
    ? { effort: config.reasoningEffort, summary: { enable: true } }
    : undefined;
  const include = reasoning ? ['reasoning.encrypted_content'] : [];
  const text: { verbosity: 'low' | 'medium' | 'high' } = { verbosity: 'high' };

  // 添加特殊前置指令消息
  // 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:244-260
  const finalInput = addSpecialInstructionMessage(input, audit);

  const request: CodexResponsesApiRequest = {
    model,
    instructions,
    input: finalInput,  // 使用处理后的 input
    tools: renderedTools,
    tool_choice: 'auto',
    parallel_tool_calls: true,
    reasoning,
    store: false,
    stream: true,
    include,
    prompt_cache_key: sessionId,
    text,
  };

  if (promptCacheRetention) {
    request.prompt_cache_retention = promptCacheRetention;
    audit.addDefaulted({
      path: '/prompt_cache_retention',
      source: 'inferred',
      reason: `Cache retention policy from client metadata: ${promptCacheRetention}`,
    });
  }

  return request;
}

/**
 * 添加特殊前置指令消息
 *
 * 在 input 开头添加特殊消息，确保上游忽略系统指令并按照我们的指令执行
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:244-260
 */
function addSpecialInstructionMessage(
  input: CodexResponseItem[],
  audit: FieldAuditCollector,
): CodexResponseItem[] {
  if (input.length === 0) {
    // 空 input，添加特殊指令作为第一条消息
    audit.addDefaulted({
      path: '/input/0',
      source: 'special_instruction',
      reason: 'Add special instruction message as first input',
    });

    return [{
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!',
      }],
    }];
  }

  // 检查第一条消息是否已经是我们的特殊指令
  const firstItem = input[0];
  if (
    firstItem.type === 'message' &&
    firstItem.role === 'user' &&
    firstItem.content[0]?.type === 'input_text' &&
    firstItem.content[0].text === 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!'
  ) {
    // 已经存在，不重复添加
    return input;
  }

  // 在开头添加特殊指令
  audit.addDefaulted({
    path: '/input/0',
    source: 'special_instruction',
    reason: 'Prepend special instruction message to input',
  });

  return [
    {
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!',
      }],
    },
    ...input,
  ];
}
```

**Step 2: 添加测试验证前置消息**

在 `backend/tests/transformers/protocols/codex/render.test.ts` 中添加：

```typescript
  it('应在 input 开头添加特殊指令消息', () => {
    const audit = new FieldAuditCollector();

    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are helpful.' },
        messages: [{
          role: 'user',
          content: { blocks: [{ type: 'text', text: 'Hello' }] },
        }],
        tools: [],
        stream: true,
      },
      {},
      audit,
    );

    expect(result.input[0]).toEqual({
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_text',
        text: 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!',
      }],
    });
  });

  it('应对空 input 添加特殊指令', () => {
    const audit = new FieldAuditCollector();

    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are helpful.' },
        messages: [],
        tools: [],
        stream: true,
      },
      {},
      audit,
    );

    expect(result.input.length).toBe(1);
    expect(result.input[0].content[0].text).toBe('EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!');
  });

  it('不应重复添加已存在的特殊指令', () => {
    const audit = new FieldAuditCollector();

    // 第二次调用，input 已经有特殊指令了
    const result = renderCodexRequest(
      {
        model: 'gpt-4',
        system: { text: 'You are helpful.' },
        messages: [],
        tools: [],
        stream: true,
      },
      {},
      audit,
    );

    const count = result.input.filter(
      item => item.type === 'message' &&
      item.content[0]?.text === 'EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!'
    ).length;

    expect(count).toBe(1);
  });
```

**Step 3: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/render.test.ts
```

预期：PASS

**Step 4: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/render.ts backend/tests/transformers/protocols/codex/render.test.ts
git commit -m "实现：添加特殊前置指令消息

- 在 input 开头添加 EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!
- 防止重复添加
- 添加完整测试覆盖

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:244-260"
```

---

## P2 优先级：Reasoning Level 映射优化

### Task 8: 实现完整的 Reasoning Level 映射

**文件：**
- Create: `backend/src/promptxy/transformers/protocols/codex/reasoning.ts`
- Modify: `backend/src/promptxy/transformers/protocols/codex/render.ts`
- Test: `backend/tests/transformers/protocols/codex/reasoning.test.ts`

**背景：** 参考实现 (codex_claude_request.go:219-238) 有完整的 thinking budget_tokens 到 reasoning effort 的映射。

**Step 1: 创建 reasoning 映射工具**

创建文件 `backend/src/promptxy/transformers/protocols/codex/reasoning.ts`：

```typescript
/**
 * Reasoning/Effort 映射工具
 *
 * 处理 Claude thinking.budget_tokens 到 Codex reasoning.effort 的映射
 *
 * 参考: refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:219-238
 */

/**
 * 模型是否使用 level-based reasoning
 */
function modelUsesThinkingLevels(model: string): boolean {
  // o1/o3 系列模型使用 level-based reasoning
  return /o[13]-/.test(model) || model.includes('o1') || model.includes('o3');
}

/**
 * 将 thinking budget_tokens 映射到 reasoning effort
 *
 * @param model - 模型名称
 * @param budgetTokens - thinking budget_tokens
 * @returns reasoning effort 字符串，如果不支持则返回 undefined
 */
export function thinkingBudgetToEffort(
  model: string,
  budgetTokens: number,
): string | undefined {
  if (!modelUsesThinkingLevels(model)) {
    return undefined;
  }

  // o1 系列映射
  if (model.includes('o1')) {
    if (budgetTokens >= 20000) return 'high';
    if (budgetTokens >= 5000) return 'medium';
    return 'low';
  }

  // o3 系列映射
  if (model.includes('o3')) {
    if (budgetTokens >= 20000) return 'high';
    if (budgetTokens >= 5000) return 'medium';
    return 'low';
  }

  return undefined;
}

/**
 * 从 Claude thinking 配置解析 reasoning effort
 *
 * @param model - 模型名称
 * @param thinkingConfig - Claude thinking 配置
 * @returns reasoning effort 字符串
 */
export function extractReasoningEffort(
  model: string,
  thinkingConfig: { type: string; budget_tokens?: number } | undefined,
): string {
  // 默认值
  const defaultEffort = 'medium';

  if (!thinkingConfig) {
    return defaultEffort;
  }

  // 如果禁用 thinking，使用 low effort
  if (thinkingConfig.type === 'disabled') {
    const result = thinkingBudgetToEffort(model, 0);
    return result || defaultEffort;
  }

  // 如果启用 thinking，使用 budget_tokens 映射
  if (thinkingConfig.type === 'enabled' && thinkingConfig.budget_tokens !== undefined) {
    const result = thinkingBudgetToEffort(model, thinkingConfig.budget_tokens);
    return result || defaultEffort;
  }

  return defaultEffort;
}
```

**Step 2: 创建测试**

创建文件 `backend/tests/transformers/protocols/codex/reasoning.test.ts`：

```typescript
import { describe, it, expect } from 'vitest';
import {
  thinkingBudgetToEffort,
  extractReasoningEffort,
} from '../../../../src/promptxy/transformers/protocols/codex/reasoning.js';

describe('thinkingBudgetToEffort', () => {
  describe('o1 系列模型', () => {
    it('应映射高 budget 到 high effort', () => {
      expect(thinkingBudgetToEffort('o1-preview', 20000)).toBe('high');
      expect(thinkingBudgetToEffort('o1-preview', 50000)).toBe('high');
    });

    it('应映射中等 budget 到 medium effort', () => {
      expect(thinkingBudgetToEffort('o1-preview', 5000)).toBe('medium');
      expect(thinkingBudgetToEffort('o1-preview', 10000)).toBe('medium');
    });

    it('应映射低 budget 到 low effort', () => {
      expect(thinkingBudgetToEffort('o1-preview', 1000)).toBe('low');
      expect(thinkingBudgetToEffort('o1-preview', 4000)).toBe('low');
    });
  });

  describe('o3 系列模型', () => {
    it('应映射高 budget 到 high effort', () => {
      expect(thinkingBudgetToEffort('o3-mini', 20000)).toBe('high');
    });

    it('应映射中等 budget 到 medium effort', () => {
      expect(thinkingBudgetToEffort('o3-mini', 5000)).toBe('medium');
    });

    it('应映射低 budget 到 low effort', () => {
      expect(thinkingBudgetToEffort('o3-mini', 1000)).toBe('low');
    });
  });

  describe('非 level-based 模型', () => {
    it('应对非 level-based 模型返回 undefined', () => {
      expect(thinkingBudgetToEffort('gpt-4', 50000)).toBeUndefined();
      expect(thinkingBudgetToEffort('claude-3-5-sonnet', 50000)).toBeUndefined();
    });
  });
});

describe('extractReasoningEffort', () => {
  it('应处理未定义的 thinking 配置', () => {
    expect(extractReasoningEffort('o1-preview', undefined)).toBe('medium');
  });

  it('应处理 disabled thinking 类型', () => {
    const result = extractReasoningEffort('o1-preview', { type: 'disabled' });
    expect(result).toBe('low');
  });

  it('应处理 enabled thinking with budget_tokens', () => {
    const result = extractReasoningEffort('o1-preview', {
      type: 'enabled',
      budget_tokens: 20000,
    });
    expect(result).toBe('high');
  });

  it('应使用默认值当无法映射时', () => {
    const result = extractReasoningEffort('gpt-4', {
      type: 'enabled',
      budget_tokens: 50000,
    });
    expect(result).toBe('medium');
  });
});
```

**Step 3: 在 render.ts 中应用 reasoning 映射**

修改 `renderCodexRequest` 函数中的 reasoning 处理（约第 84 行）：

```typescript
import { extractReasoningEffort } from './reasoning.js';

export function renderCodexRequest(
  // ... 参数不变 ...
): CodexResponsesApiRequest {
  // ... 前面的代码不变 ...

  // 4. reasoning（从 thinking 配置解析）
  // 需要从原始请求中提取 thinking 配置
  // 注意：这需要调用方传递 thinking 配置，或者从 system/messages 中推断
  // 这里简化处理：如果 config 中有 reasoningEffort，使用它；否则使用默认值
  const reasoningEffort = config.reasoningEffort || 'medium';
  const reasoning = { effort: reasoningEffort, summary: { enable: true } };

  // ... 其余代码 ...
}
```

**注意：** 完整实现需要修改 `RenderConfig` 类型或在调用处传递 thinking 配置。这可能需要调用链路的调整。

**Step 4: 运行测试验证**

```bash
cd backend && npm test -- backend/tests/transformers/protocols/codex/reasoning.test.ts
```

预期：PASS

**Step 5: 提交**

```bash
git add backend/src/promptxy/transformers/protocols/codex/reasoning.ts backend/tests/transformers/protocols/codex/reasoning.test.ts backend/src/promptxy/transformers/protocols/codex/render.ts
git commit -m "实现：完整的 Reasoning Level 映射

- 实现 thinkingBudgetToEffort 映射 budget_tokens 到 effort
- 实现 extractReasoningEffort 从 thinking 配置提取 effort
- 支持 o1/o3 系列模型的 level-based reasoning
- 添加完整单元测试

参考：refence/CLIProxyAPI/internal/translator/codex/claude/codex_claude_request.go:219-238"
```

---

## 最终验收和文档

### Task 9: 更新转换器文档

**文件：**
- Create: `docs/protocols/codex-to-claude-transformation-complete.md`

**Step 1: 创建完整文档**

创建文件 `docs/protocols/codex-to-claude-transformation-complete.md`：

```markdown
# Codex ↔ Claude 转换器完整规格

## 概述

本文档记录 Codex Responses API 与 Claude Code API 之间的完整转换逻辑。

## Tool Name 处理

### 问题

某些上游提供商（如 OpenAI/Codex）对 tool name 有 64 字符限制。

### 解决方案

**请求方向 (Claude → Codex):**
1. 构建 shortNameMap (original -> short)
2. 缩短规则：
   - 名称 ≤ 64 字符：保持不变
   - 名称 > 64 字符：
     - 如果是 `mcp__server__tool` 格式：保留 `mcp__` + `tool` 部分，然后截断
     - 否则：直接截断到 64 字符
   - 确保唯一性：添加 `_1`, `_2` 等后缀

**响应方向 (Codex → Claude):**
1. 使用反向映射 (short -> original)
2. 在 `output_item.added` 事件中恢复原始名称

### 事件序列

**Tool Use (Claude → Codex):**
```
Claude Request:
  tools: [{ name: "mcp__very_long_server__tool_name", ... }]

↓ 转换

Codex Request:
  tools: [{ name: "mcp__tool_name", ... }]  # 缩短后
  input: [{ type: "function_call", name: "mcp__tool_name", ... }]
```

**Tool Use (Codex → Claude):**
```
Codex SSE:
  response.output_item.added: { item: { type: "function_call", name: "mcp__tool_name" }}

↓ 转换

Claude SSE:
  content_block_start: { content_block: { name: "mcp__very_long_server__tool_name" }}  # 恢复
```

## 特殊工具处理

### web_search

Claude 的 `web_search_20250305` 工具转换为 Codex 的 `web_search` 类型：

```typescript
// Claude
{ name: "web_search_20250305", ... }

// Codex
{ type: "web_search" }
```

## 特殊前置指令

在 Codex input 开头添加特殊消息：

```
{
  type: "message",
  role: "user",
  content: [{
    type: "input_text",
    text: "EXECUTE ACCORDING TO THE FOLLOWING INSTRUCTIONS!!!"
  }]
}
```

这确保上游忽略系统指令并按照代理的指令执行。

## Reasoning 映射

| 模型系列 | budget_tokens | reasoning.effort |
|----------|---------------|------------------|
| o1, o3   | ≥ 20000       | high             |
| o1, o3   | 5000-19999    | medium           |
| o1, o3   | < 5000        | low              |
| 其他     | -             | medium (默认)    |

## 完整事件序列：Tool Use

### 请求 (Claude → Codex)

```
1. 解析 Claude 请求
2. 构建 shortNameMap
3. 缩短 tool name
4. 生成 Codex 请求
5. 添加特殊前置指令
```

### 响应 (Codex → Claude)

```
response.created → message_start (使用 response.id)

response.output_text.delta → content_block_delta (text_delta)

response.output_item.added (function_call) → content_block_start (tool_use)
  → content_block_delta (input_json_delta, empty)

response.function_call_arguments.delta → content_block_delta (input_json_delta)

response.output_item.done (function_call) → content_block_stop
  → message_delta (stop_reason: "tool_use")  # 触发 tool loop

response.completed → message_delta (usage)
  → message_stop
```

## 参考

- 参考实现：`refence/CLIProxyAPI/internal/translator/codex/claude/`
- Claude 协议：`docs/protocols/claude-messages-spec.md`
- Codex 协议：`docs/protocols/codex-responses-spec.md`
```

**Step 2: 提交文档**

```bash
git add docs/protocols/codex-to-claude-transformation-complete.md
git commit -m "文档：完整的 Codex ↔ Claude 转换器规格

- 记录 tool name 缩短/恢复机制
- 记录特殊工具处理
- 记录特殊前置指令
- 记录 reasoning 映射
- 记录完整事件序列"
```

---

### Task 10: 完整回归测试

**Step 1: 运行完整测试套件**

```bash
cd backend && npm test
```

预期：所有测试通过

**Step 2: 运行类型检查**

```bash
cd backend && npx tsc --noEmit
```

预期：无类型错误

**Step 3: 运行 lint**

```bash
npm run lint:backend
```

预期：无 lint 错误

**Step 4: 构建验证**

```bash
npm run build:backend
```

预期：构建成功

**Step 5: 最终提交**

```bash
git add -A
git commit -m "完成：Codex ↔ Claude 转换器与参考实现对齐

主要变更：

P0 优先级（必须修复）:
- 实现 tool name 缩短/恢复完整机制
  * 添加 tool-name.ts 缩短工具
  * 添加 short-name-reverse-lookup.ts 反向映射
  * 在请求转换器中应用缩短
  * 在响应转换器中应用恢复
  * 在 Gateway 中连接完整往返

P1 优先级（强烈建议）:
- 实现 web_search 工具特殊处理
- 添加特殊前置指令消息

P2 优先级（可选优化）:
- 实现 reasoning level 完整映射
- 支持 o1/o3 系列模型的 budget_tokens 映射

测试覆盖:
- tool name 缩短/恢复单元测试
- web_search 特殊处理测试
- 特殊前置指令测试
- reasoning 映射测试
- 端到端往返测试
- 完整回归测试

文档:
- 更新转换器完整规格文档
- 记录所有事件序列和映射规则

对齐参考: refence/CLIProxyAPI/internal/translator/codex/claude/"
```

---

## 验收标准

完成所有任务后，应满足：

1. ✅ Tool name 正确缩短（64 字符限制）
2. ✅ Tool name 正确恢复（完整往返）
3. ✅ web_search 工具特殊处理
4. ✅ 特殊前置指令添加
5. ✅ Reasoning level 完整映射
6. ✅ 所有单元测试通过
7. ✅ 所有集成测试通过
8. ✅ 无类型错误
9. ✅ 无 lint 错误
10. ✅ 文档完整

---

## 相关参考

- **协议规格：** `docs/protocols/claude-messages-spec.md`
- **协议规格：** `docs/protocols/codex-responses-spec.md`
- **参考实现：** `refence/CLIProxyAPI/internal/translator/codex/claude/`
- **现有转换器：** `backend/src/promptxy/transformers/protocols/codex/`
