# PromptXY NPM 包发布指南

## 概述

`promptxy` 是一个 HTTP 请求代理网关，用于拦截和修改 AI 服务提供商（Claude、OpenAI、Gemini）的 HTTP 请求。

## 包结构

```
promptxy/
├── dist/                    # 构建产物
│   ├── index.js            # 主入口
│   ├── index.d.ts          # 类型声明
│   ├── main.js             # 服务器启动入口
│   └── promptxy/           # 核心模块
│       ├── gateway.js
│       ├── api-server.js
│       ├── config.js
│       ├── database.js
│       ├── rules/
│       └── types.js
├── src/                     # 源代码
├── package.json            # 包配置
├── LICENSE                 # MIT 许可证
└── README.md               # 使用说明
```

## 发布前检查清单

### 1. 更新版本号

```bash
cd backend
npm version patch  # 或 minor, major
```

### 2. 检查 package.json

- [ ] `name`: `promptxy`
- [ ] `version`: 最新版本
- [ ] `private`: 已移除或设为 `false`
- [ ] `license`: `MIT`
- [ ] `main`: `./dist/index.js`
- [ ] `types`: `./dist/index.d.ts`
- [ ] `files`: 包含 `dist`, `README.md`, `LICENSE`
- [ ] `exports`: 正确配置所有导出路径
- [ ] `engines`: 指定 Node.js 版本要求

### 3. 更新 README.md

确保 README 包含：

- 包的简介
- 安装说明
- 基本用法示例
- API 文档
- 配置说明

### 4. 构建项目

```bash
npm run build
```

确认 `dist/` 目录包含所有必要的文件。

### 5. 运行测试

```bash
npm test
```

## 发布流程

### 1. 登录 npm

```bash
npm login
```

### 2. 检查包名是否可用

```bash
npm view promptxy
```

如果返回错误，说明包名可用。

### 3. 发布到 npm

```bash
npm publish
```

首次发布可能需要添加 `--access public`：

```bash
npm publish --access public
```

### 4. 验证发布

```bash
npm view promptxy
```

## 发布后

### 1. 更新 Git 标签

```bash
git tag v2.0.0
git push origin v2.0.0
```

### 2. 创建 GitHub Release

在 GitHub 上创建对应的 Release。

## 使用示例

### 安装

```bash
npm install promptxy
```

### 基本用法

```typescript
import { createGateway } from 'promptxy';
import { PromptxyConfig } from 'promptxy';

const config: PromptxyConfig = {
  listen: { host: '127.0.0.1', port: 7070 },
  api: { host: '127.0.0.1', port: 7071 },
  suppliers: [
    {
      id: 'claude',
      name: 'Claude',
      baseUrl: 'https://api.anthropic.com',
      localPrefix: '/claude',
      enabled: true,
    },
  ],
  rules: [],
  storage: {
    maxHistory: 10000,
    autoCleanup: true,
    cleanupInterval: 24,
  },
  debug: false,
};

const server = createGateway(config);
server.listen(config.listen.port, config.listen.host);
```

### 单独使用规则引擎

```typescript
import { applyPromptRules, PromptxyRule } from 'promptxy/rules';

const rules: PromptxyRule[] = [
  {
    uuid: 'rule-1',
    name: '示例规则',
    when: { client: 'claude', field: 'system' },
    ops: [{ type: 'append', text: '\n请用中文回答。' }],
    enabled: true,
  },
];

const result = applyPromptRules(
  '你是一个助手',
  { client: 'claude', field: 'system', method: 'POST', path: '/v1/messages' },
  rules,
);

console.log(result.text); // "你是一个助手\n请用中文回答。"
console.log(result.matches); // [{ ruleId: 'rule-1', opType: 'append' }]
```

## 注意事项

1. **Node.js 版本**: 需要 Node.js >= 18.0.0
2. **ESM Only**: 此包仅支持 ESM 模块，不支持 CommonJS
3. **TypeScript**: 包含完整的 TypeScript 类型定义
4. **依赖**: 使用 `sqlite3` 进行数据持久化

## 故障排除

### 发布失败

如果发布失败，检查：

1. 是否已登录 npm
2. 包名是否已被占用
3. `package.json` 中的 `private` 字段是否已移除
4. 是否有权限发布包

### 版本冲突

如果遇到版本冲突：

```bash
npm view promptxy versions
```

查看已发布的版本，确保使用新版本号。

## 相关链接

- npm: https://www.npmjs.com/package/promptxy
- GitHub: https://github.com/yourusername/promptxy
- Issues: https://github.com/yourusername/promptxy/issues
