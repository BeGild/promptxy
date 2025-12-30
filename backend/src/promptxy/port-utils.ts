import * as os from 'node:os';
import * as net from 'node:net';

const PORT_RANGE_START = 8000;
const PORT_RANGE_END = 9000;

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

export function calculateDefaultPort(): number {
  const username = os.userInfo().username;
  const hash = simpleHash(username);
  return PORT_RANGE_START + (hash % (PORT_RANGE_END - PORT_RANGE_START + 1));
}

export async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.once('close', () => resolve(true));
      server.close();
    });
    server.on('error', () => resolve(false));
  });
}

export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  while (!(await isPortAvailable(port))) {
    port++;
    if (port > 65535) throw new Error('无法找到可用端口');
  }
  return port;
}
