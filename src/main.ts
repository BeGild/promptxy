#!/usr/bin/env node
import { loadConfig } from './promptxy/config.js';
import { createGateway } from './promptxy/gateway.js';

async function main() {
  const config = await loadConfig();
  const server = createGateway(config);

  const { host, port } = config.listen;
  server.listen(port, host, () => {
    // Intentionally minimal: avoid logging request data by default.
    // eslint-disable-next-line no-console
    console.log(`promptxy listening on http://${host}:${port}`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

void main();
