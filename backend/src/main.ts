import { loadConfig, getConfigDir } from './promptxy/config.js';
import { createGateway } from './promptxy/gateway.js';
import { initializeDatabase } from './promptxy/database.js';
import { createLogger } from './promptxy/logger.js';
import { mkdir } from 'node:fs/promises';
import { parseCliArgs, printHelp } from './promptxy/cli.js';

async function main() {
  const cliOptions = parseCliArgs();

  if (cliOptions.help) {
    printHelp();
    process.exit(0);
  }

  const config = await loadConfig(cliOptions);
  const logger = createLogger({ debug: config.debug });

  // 确保配置目录存在
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });

  // 初始化数据库
  logger.info(`[PromptXY] 初始化数据库...`);
  const db = await initializeDatabase();

  // 创建统一服务器（Gateway + API）
  const server = createGateway(config, db, config.rules);

  // 启动服务器
  server.listen(config.listen.port, config.listen.host, () => {
    logger.info(`[PromptXY] 服务启动: http://${config.listen.host}:${config.listen.port}`);
    logger.info(`[PromptXY] API路由: /_promptxy/*`);
    logger.info(`[PromptXY] 代理路由: /claude/*, /openai/*, /gemini/*`);
  });

  // 优雅关闭处理
  const shutdown = () => {
    logger.info(`[PromptXY] 正在关闭服务器...`);
    server.close(() => {
      logger.info(`[PromptXY] 服务器已关闭`);
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // 输出配置信息
  logger.info(`[PromptXY] 配置目录: ${configDir}`);
  logger.info(`[PromptXY] 存储限制: 最近 ${config.storage.maxHistory} 条请求`);
  logger.info(`[PromptXY] 规则数量: ${config.rules.length}`);
  logger.info(`[PromptXY] 调试模式: ${config.debug ? '开启' : '关闭'}`);
}

void main();
