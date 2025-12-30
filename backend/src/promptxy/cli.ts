import { parseArgs } from 'node:util';

export interface CliOptions {
  port?: number;
  help?: boolean;
}

export function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      port: { type: 'string', short: 'p' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) return { help: true };
  if (values.port) {
    const port = parseInt(values.port as string, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('错误: 端口必须是1-65535之间的数字');
      process.exit(1);
    }
    return { port };
  }
  return {};
}

export function printHelp(): void {
  console.log(`
PromptXY - HTTP请求代理网关

用法: node dist/main.js [选项]

选项:
  -p, --port <端口>    指定服务端口（Gateway + API统一端口）
  -h, --help           显示帮助信息

路由说明:
  /_promptxy/* - 管理API端点
  /claude/*    - Claude API代理
  /openai/*    - OpenAI API代理
  /gemini/*    - Gemini API代理
  `);
}
