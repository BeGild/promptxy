#!/usr/bin/env node

/**
 * Mock upstream service for performance testing
 * Simulates Claude, OpenAI, and Gemini APIs
 */

import * as http from 'node:http';

function createMockService(port, name, delayMs = 0) {
  const server = http.createServer((req, res) => {
    // 健康检查
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', service: name }));
      return;
    }

    // 模拟延迟
    if (delayMs > 0) {
      setTimeout(() => handleRequest(req, res, name), delayMs);
    } else {
      handleRequest(req, res, name);
    }
  });

  function handleRequest(req, res, serviceName) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      // 模拟不同的响应
      let responseData;

      if (serviceName === 'claude') {
        responseData = {
          id: `msg_${Date.now()}`,
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: `Mock Claude Response: Processed ${body.length} bytes. [${new Date().toISOString()}]`,
            },
          ],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          usage: {
            input_tokens: Math.floor(Math.random() * 100) + 50,
            output_tokens: Math.floor(Math.random() * 200) + 100,
          },
        };
      } else if (serviceName === 'openai') {
        responseData = {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: 'gpt-4-turbo-preview',
          choices: [
            {
              index: 0,
              message: {
                role: 'assistant',
                content: `Mock OpenAI Response: Processed ${body.length} bytes. [${new Date().toISOString()}]`,
              },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: Math.floor(Math.random() * 100) + 50,
            completion_tokens: Math.floor(Math.random() * 200) + 100,
            total_tokens: Math.floor(Math.random() * 300) + 150,
          },
        };
      } else if (serviceName === 'gemini') {
        responseData = {
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: `Mock Gemini Response: Processed ${body.length} bytes. [${new Date().toISOString()}]`,
                  },
                ],
                role: 'model',
              },
              finishReason: 'STOP',
              index: 0,
            },
          ],
          usageMetadata: {
            promptTokenCount: Math.floor(Math.random() * 100) + 50,
            candidatesTokenCount: Math.floor(Math.random() * 200) + 100,
            totalTokenCount: Math.floor(Math.random() * 300) + 150,
          },
        };
      }

      // SSE 流式响应
      if (req.headers['accept'] === 'text/event-stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        });

        // 发送多个事件
        let eventCount = 0;
        const maxEvents = 3;

        const sendEvent = () => {
          if (eventCount >= maxEvents) {
            res.end();
            return;
          }

          const chunk = {
            type:
              eventCount === 0
                ? 'content_block_start'
                : eventCount === maxEvents - 1
                  ? 'content_block_stop'
                  : 'content_block_delta',
            index: 0,
            delta: {
              type: 'text',
              text: `Chunk ${eventCount + 1} of ${maxEvents} `,
            },
          };

          res.write(`event: content_block_delta\ndata: ${JSON.stringify(chunk)}\n\n`);
          eventCount++;

          if (eventCount < maxEvents) {
            setTimeout(sendEvent, 50);
          } else {
            res.write(`event: message_stop\ndata: {"type": "message_stop"}\n\n`);
            res.end();
          }
        };

        setTimeout(sendEvent, 100);
        return;
      }

      // 普通 JSON 响应
      const responseStr = JSON.stringify(responseData);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(responseStr),
        'X-Mock-Service': name,
      });
      res.end(responseStr);
    });
  }

  server.listen(port, '127.0.0.1', () => {
    console.log(`[${name}] Mock service listening on http://127.0.0.1:${port}`);
  });

  return server;
}

// 启动三个模拟服务
const claudeServer = createMockService(8080, 'Claude', 10); // 10ms 延迟
const openaiServer = createMockService(8081, 'OpenAI', 15); // 15ms 延迟
const geminiServer = createMockService(8082, 'Gemini', 20); // 20ms 延迟

console.log('Mock upstream services started:');
console.log('- Claude: http://127.0.0.1:8080');
console.log('- OpenAI: http://127.0.0.1:8081');
console.log('- Gemini: http://127.0.0.1:8082');
console.log('Press Ctrl+C to stop all services');

// 优雅关闭
const shutdown = () => {
  console.log('\nShutting down mock services...');
  claudeServer.close();
  openaiServer.close();
  geminiServer.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
