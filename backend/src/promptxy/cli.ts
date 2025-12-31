import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = getVersion();

function getVersion(): string {
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgPath = join(__dirname, '../../../package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '2.0.1';
  } catch {
    return '2.0.1';
  }
}

export interface CliOptions {
  port?: number;
  help?: boolean;
  version?: boolean;
}

export function parseCliArgs(): CliOptions {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      port: { type: 'string', short: 'p' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    strict: false,
  });

  if (values.help) return { help: true };
  if (values.version) return { version: true };

  const result: CliOptions = {};
  if (values.port) {
    const port = parseInt(values.port as string, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('错误: 端口必须是1-65535之间的数字');
      process.exit(1);
    }
    result.port = port;
  }
  return result;
}

export function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                           PromptXY v${VERSION}                                    ║
║                    AI 工具本地 HTTP 代理规则管理器                              ║
╚══════════════════════════════════════════════════════════════════════════════╝

用法:
  promptxy [选项]
  promptxy -h|--help
  promptxy -v|--version

选项:
  -p, --port <端口>         指定服务端口 (默认: 自动分配可用端口 8000-9000)
  -h, --help                显示此帮助信息
  -v, --version             显示版本信息

环境变量:
  PROMPTXY_HOST              监听地址 (默认: 127.0.0.1)
  PROMPTXY_PORT              监听端口 (优先级低于 --port)
  PROMPTXY_DEBUG             启用调试模式 (true/false, 默认: false)
  PROMPTXY_MAX_HISTORY       最大请求历史记录数 (默认: 1000)
  PROMPTXY_CONFIG            配置文件路径 (默认: ~/.config/promptxy/config.json)

配置文件:
  项目配置    ./promptxy.config.json     (优先级较高，向上查找3级目录)
  全局配置    ~/.config/promptxy/config.json
  环境变量    PROMPTXY_CONFIG             (覆盖默认配置路径)

代理路由:
  /_promptxy/*              Web 管理界面和 API 端点
  /claude/*                 Claude API 代理 (Anthropic)
  /openai/*                 OpenAI API 代理
  /gemini/*                 Gemini API 代理 (Google)

使用示例:
  promptxy                                  # 使用默认配置启动
  promptxy --port 7070                      # 指定端口启动
  promptxy -p 8080                          # 简写形式
  PROMPTXY_DEBUG=true promptxy              # 启用调试模式
  PROMPTXY_PORT=7070 promptxy               # 通过环境变量指定端口

CLI 工具配置:
  # Claude Code
  export ANTHROPIC_BASE_URL="http://127.0.0.1:7070/claude"

  # OpenAI Codex
  export OPENAI_BASE_URL="http://127.0.0.1:7070/openai"

  # Gemini CLI
  export GOOGLE_GEMINI_BASE_URL="http://127.0.0.1:7070/gemini"

更多文档:
  GitHub: https://github.com/BeGild/promptxy
  文档:   https://github.com/BeGild/promptxy#readme
`);
}

export function printVersion(): void {
  console.log(`PromptXY v${VERSION}`);
}
