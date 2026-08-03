#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";

const token = (
  await readFile(process.env.DAILYENERGY_FAULT_CONTROL_TOKEN_FILE, "utf8")
).trim();
const modes = new Map([
  ["postgres", "pass"],
  ["redis", "pass"],
]);
const sockets = new Map([
  ["postgres", new Set()],
  ["redis", new Set()],
]);

function target(value) {
  const [host, port] = value.split(":");
  if (!host || !/^\d{1,5}$/u.test(port)) {
    throw new Error("FAULT_PROXY_TARGET_INVALID");
  }
  return { host, port: Number(port) };
}

function authorized(request) {
  const supplied =
    request.headers.authorization?.replace(/^Bearer /u, "") ?? "";
  const actual = Buffer.from(supplied);
  const expected = Buffer.from(token);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function createProxy(name, listenPort, targetValue) {
  const destination = target(targetValue);
  const server = net.createServer((incoming) => {
    sockets.get(name).add(incoming);
    incoming.once("close", () => sockets.get(name).delete(incoming));
    const mode = modes.get(name);
    if (mode === "drop") {
      incoming.destroy();
      return;
    }
    const connect = () => {
      const outgoing = net.createConnection(destination);
      sockets.get(name).add(outgoing);
      outgoing.once("close", () => sockets.get(name).delete(outgoing));
      incoming.pipe(outgoing).pipe(incoming);
      outgoing.once("error", () => incoming.destroy());
      incoming.once("error", () => outgoing.destroy());
    };
    if (mode === "latency") {
      setTimeout(connect, 2_000);
    } else {
      connect();
    }
  });
  server.listen(listenPort, "0.0.0.0");
  return server;
}

const proxyServers = [
  createProxy(
    "postgres",
    15_432,
    process.env.DAILYENERGY_FAULT_POSTGRES_TARGET,
  ),
  createProxy("redis", 16_379, process.env.DAILYENERGY_FAULT_REDIS_TARGET),
];

const control = http.createServer(async (request, response) => {
  if (request.url === "/health") {
    response.writeHead(200).end("UP\n");
    return;
  }
  if (request.url !== "/control" || request.method !== "POST") {
    response.writeHead(404).end();
    return;
  }
  if (!authorized(request)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const value = await body(request);
    if (
      !modes.has(value.target) ||
      !["pass", "drop", "latency"].includes(value.mode)
    ) {
      throw new Error("FAULT_PROXY_MODE_INVALID");
    }
    modes.set(value.target, value.mode);
    if (value.mode !== "pass") {
      for (const socket of sockets.get(value.target)) {
        socket.destroy();
      }
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(
      `${JSON.stringify({ mode: value.mode, status: "UPDATED", target: value.target })}\n`,
    );
  } catch {
    response.writeHead(400).end();
  }
});
control.listen(Number(process.env.DAILYENERGY_FAULT_CONTROL_PORT), "0.0.0.0");

function shutdown() {
  control.close();
  for (const server of proxyServers) {
    server.close();
  }
  for (const group of sockets.values()) {
    for (const socket of group) {
      socket.destroy();
    }
  }
  process.exit(0);
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
