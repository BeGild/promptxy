#!/usr/bin/env node
import { listSessions } from './commands/list-sessions.js';
import { listRequests } from './commands/list-requests.js';
import { getStructure } from './commands/structure.js';
import { diffRequests } from './commands/diff.js';
import { getValue } from './commands/get.js';
import { getTrace } from './commands/trace.js';

function printUsage() {
  console.log(`
records-query - 渐进式披露的记录查询工具

用法:
  records-query <command> [options]

命令:
  list sessions              列出会话
    --limit N               限制返回数量 (默认: 20)
    --filter "key=value"    过滤条件

  list requests              列出请求
    --conversation <id>     会话 ID (必需)
    --limit N               限制返回数量

  structure <request-id>     获取请求结构
    --part request|response|transform

  diff <id1> <id2>          对比两个请求
    --mode structure|field
    --field <path>

  get <request-id>          获取指定字段内容
    --path <json-path>     JSON 路径
    --truncate N           字符串截断长度 (默认: 500)
    --array-limit N        数组最大返回数量 (默认: 10)
    --format json|summary

  trace <request-id>        获取转换链追踪
`);
}

function printJson(data: unknown) {
  console.log(JSON.stringify(data, null, 2));
}

function getArgValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  const [command, subcommand, ...rest] = args;

  try {
    switch (command) {
      case 'list': {
        if (subcommand === 'sessions') {
          const limit = parseInt(getArgValue(rest, '--limit') || '20', 10);
          const filter = getArgValue(rest, '--filter');
          const result = listSessions({ limit, filter });
          printJson(result);
        } else if (subcommand === 'requests') {
          const conversationId = getArgValue(rest, '--conversation');
          if (!conversationId) {
            console.error('Error: --conversation is required');
            process.exit(1);
          }
          const limit = parseInt(getArgValue(rest, '--limit') || '100', 10);
          const result = listRequests({ conversationId, limit });
          printJson(result);
        } else {
          console.error('Error: Unknown list subcommand');
          process.exit(1);
        }
        break;
      }

      case 'structure': {
        const requestId = subcommand;
        if (!requestId) {
          console.error('Error: request-id is required');
          process.exit(1);
        }
        const part = (getArgValue(rest, '--part') || 'request') as 'request' | 'response' | 'transform';
        const result = getStructure(requestId, { part });
        printJson(result);
        break;
      }

      case 'diff': {
        const id1 = subcommand;
        const id2 = rest[0];
        if (!id1 || !id2) {
          console.error('Error: Two request IDs are required');
          process.exit(1);
        }
        const mode = (getArgValue(rest.slice(1), '--mode') || 'structure') as 'structure' | 'field';
        const field = getArgValue(rest.slice(1), '--field');
        const result = diffRequests(id1, id2, { mode, field });
        printJson(result);
        break;
      }

      case 'get': {
        const requestId = subcommand;
        if (!requestId) {
          console.error('Error: request-id is required');
          process.exit(1);
        }
        const path = getArgValue(rest, '--path');
        if (!path) {
          console.error('Error: --path is required');
          process.exit(1);
        }
        const truncate = parseInt(getArgValue(rest, '--truncate') || '500', 10);
        const arrayLimit = parseInt(getArgValue(rest, '--array-limit') || '10', 10);
        const format = (getArgValue(rest, '--format') || 'json') as 'json' | 'summary';
        const result = getValue(requestId, { path, truncate, arrayLimit, format });
        printJson(result);
        break;
      }

      case 'trace': {
        const requestId = subcommand;
        if (!requestId) {
          console.error('Error: request-id is required');
          process.exit(1);
        }
        const result = getTrace(requestId);
        printJson(result);
        break;
      }

      default: {
        console.error(`Error: Unknown command "${command}"`);
        printUsage();
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
