import { loadConfig, getConfigDir } from './promptxy/config.js';
import { createGateway } from './promptxy/gateway.js';
import { initializeDatabase } from './promptxy/database.js';
import { createApiServer } from './promptxy/api-server.js';
import { createLogger } from './promptxy/logger.js';
import { mkdir } from 'node:fs/promises';

async function main() {
  const config = await loadConfig();
  const logger = createLogger({ debug: config.debug });

  // 确保配置目录存在
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });

  // 初始化数据库
  logger.info(`[PromptXY] 初始化数据库...`);
  const db = await initializeDatabase();

  // 创建主代理服务器（端口 7070）
  const gatewayServer = createGateway(config);

  // 创建 API 服务器（端口 7071）
  // 注意：需要传递 config.rules 的引用，以便 API 可以更新它
  const apiServer = createApiServer(db, config, config.rules);

  // 启动网关服务器
  gatewayServer.listen(config.listen.port, config.listen.host, () => {
    logger.info(
      `[PromptXY] Gateway listening on http://${config.listen.host}:${config.listen.port}`,
    );
  });

  // 启动 API 服务器
  apiServer.listen(config.api.port, config.api.host, () => {
    logger.info(`[PromptXY] API Server listening on http://${config.api.host}:${config.api.port}`);
  });

  // 优雅关闭处理
  const shutdown = () => {
    logger.info(`[PromptXY] 正在关闭服务器...`);
    gatewayServer.close(() => {
      apiServer.close(() => {
        logger.info(`[PromptXY] 服务器已关闭`);
        process.exit(0);
      });
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
