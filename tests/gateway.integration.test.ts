import assert from "node:assert/strict";
import { once } from "node:events";
import http from "node:http";
import test from "node:test";
import { createGateway } from "../src/promptxy/gateway.js";
import { PromptxyConfig } from "../src/promptxy/types.js";

async function listen(server: http.Server): Promise<{ port: number; close: () => Promise<void> }> {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("unexpected server address");
  }
  return {
    port: address.port,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function readJsonBody(req: http.IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? JSON.parse(raw) : null;
}

test("gateway: forwards auth header and rewrites Codex instructions", async () => {
  let capturedAuth: string | undefined;
  let capturedBody: any;

  const upstream = http.createServer(async (req, res) => {
    capturedAuth = req.headers.authorization;
    capturedBody = await readJsonBody(req);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });

  const upstreamListen = await listen(upstream);
  const upstreamBase = `http://127.0.0.1:${upstreamListen.port}`;

  const config: PromptxyConfig = {
    listen: { host: "127.0.0.1", port: 0 },
    upstreams: { anthropic: upstreamBase, openai: upstreamBase, gemini: upstreamBase },
    debug: false,
    rules: [
      {
        id: "append",
        when: { client: "codex", field: "instructions" },
        ops: [{ type: "append", text: "\nX" }],
      },
    ],
  };

  const gateway = createGateway(config);
  const gatewayListen = await listen(gateway);

  const resp = await fetch(`http://127.0.0.1:${gatewayListen.port}/openai/v1/responses`, {
    method: "POST",
    headers: {
      authorization: "Bearer TEST_TOKEN",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-codex",
      instructions: "hello",
      input: [{ role: "user", content: "ping" }],
    }),
  });

  assert.equal(resp.status, 200);
  await resp.json();

  assert.equal(capturedAuth, "Bearer TEST_TOKEN");
  assert.equal(capturedBody.instructions, "hello\nX");

  await gatewayListen.close();
  await upstreamListen.close();
});

test("gateway: proxies streaming response bytes", async () => {
  const upstream = http.createServer(async (_req, res) => {
    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream");
    res.write("event: message\ndata: {\"x\":1}\n\n");
    res.end();
  });

  const upstreamListen = await listen(upstream);
  const upstreamBase = `http://127.0.0.1:${upstreamListen.port}`;

  const config: PromptxyConfig = {
    listen: { host: "127.0.0.1", port: 0 },
    upstreams: { anthropic: upstreamBase, openai: upstreamBase, gemini: upstreamBase },
    debug: false,
    rules: [],
  };

  const gateway = createGateway(config);
  const gatewayListen = await listen(gateway);

  const resp = await fetch(`http://127.0.0.1:${gatewayListen.port}/openai/v1/responses`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "gpt-5-codex", instructions: "hello", input: [] }),
  });

  assert.equal(resp.status, 200);
  const text = await resp.text();
  assert.match(text, /event:\s*message/);
  assert.match(text, /data:\s*\{"x":1\}/);

  await gatewayListen.close();
  await upstreamListen.close();
});

test("gateway: rewrites Claude system text blocks and preserves non-text blocks", async () => {
  let capturedBody: any;

  const upstream = http.createServer(async (req, res) => {
    capturedBody = await readJsonBody(req);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });

  const upstreamListen = await listen(upstream);
  const upstreamBase = `http://127.0.0.1:${upstreamListen.port}`;

  const config: PromptxyConfig = {
    listen: { host: "127.0.0.1", port: 0 },
    upstreams: { anthropic: upstreamBase, openai: upstreamBase, gemini: upstreamBase },
    debug: false,
    rules: [
      {
        id: "replace-foo",
        when: { client: "claude", field: "system" },
        ops: [{ type: "replace", match: "foo", replacement: "bar" }],
      },
    ],
  };

  const gateway = createGateway(config);
  const gatewayListen = await listen(gateway);

  const resp = await fetch(`http://127.0.0.1:${gatewayListen.port}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-3-5-sonnet",
      system: [
        { type: "text", text: "foo" },
        { type: "image", source: { type: "base64", media_type: "image/png", data: "AA==" } },
      ],
      messages: [{ role: "user", content: "hi" }],
    }),
  });

  assert.equal(resp.status, 200);
  await resp.json();

  assert.equal(capturedBody.system[0].text, "bar");
  assert.equal(capturedBody.system[1].type, "image");

  await gatewayListen.close();
  await upstreamListen.close();
});

test("gateway: rewrites Gemini system_instruction (Gemini API Key mode)", async () => {
  let capturedBody: any;

  const upstream = http.createServer(async (req, res) => {
    capturedBody = await readJsonBody(req);
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });

  const upstreamListen = await listen(upstream);
  const upstreamBase = `http://127.0.0.1:${upstreamListen.port}`;

  const config: PromptxyConfig = {
    listen: { host: "127.0.0.1", port: 0 },
    upstreams: { anthropic: upstreamBase, openai: upstreamBase, gemini: upstreamBase },
    debug: false,
    rules: [
      {
        id: "append-g",
        when: { client: "gemini", field: "system" },
        ops: [{ type: "append", text: "\nG" }],
      },
    ],
  };

  const gateway = createGateway(config);
  const gatewayListen = await listen(gateway);

  const resp = await fetch(
    `http://127.0.0.1:${gatewayListen.port}/gemini/v1beta/models/gemini-2.5-pro:generateContent`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": "XYZ" },
      body: JSON.stringify({
        system_instruction: "hello",
        contents: [{ role: "user", parts: [{ text: "hi" }] }],
      }),
    }
  );

  assert.equal(resp.status, 200);
  await resp.json();

  assert.equal(capturedBody.system_instruction, "hello\nG");

  await gatewayListen.close();
  await upstreamListen.close();
});

