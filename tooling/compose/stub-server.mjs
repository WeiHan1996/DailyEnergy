#!/usr/bin/env node
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import http from "node:http";

const port = Number(process.env.DAILYENERGY_STUB_PORT ?? "8080");
const token = (
  await readFile(process.env.DAILYENERGY_FAULT_CONTROL_TOKEN_FILE, "utf8")
).trim();
const modes = new Map([
  ["clock", "pass"],
  ["network", "pass"],
  ["provider", "pass"],
  ["telemetry", "pass"],
]);
let clockOffsetMs = 0;

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
  if (chunks.reduce((total, chunk) => total + chunk.length, 0) > 4096) {
    throw new Error("STUB_CONTROL_BODY_TOO_LARGE");
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function json(response, status, value) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(`${JSON.stringify(value)}\n`);
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", "http://stub.internal");
  if (url.pathname === "/health") {
    json(response, 200, { status: "UP" });
    return;
  }
  if (url.pathname === "/control" && request.method === "POST") {
    if (!authorized(request)) {
      json(response, 403, { reason_code: "FAULT_CONTROL_UNAUTHORIZED" });
      return;
    }
    try {
      const value = await body(request);
      if (
        !modes.has(value.target) ||
        !["pass", "failure", "timeout", "reset", "skew"].includes(value.mode)
      ) {
        throw new Error("STUB_FAULT_MODE_INVALID");
      }
      modes.set(value.target, value.mode);
      if (value.target === "clock") {
        clockOffsetMs = value.mode === "skew" ? 86_400_000 : 0;
      }
      json(response, 200, {
        mode: value.mode,
        status: "UPDATED",
        target: value.target,
      });
    } catch {
      json(response, 400, { reason_code: "FAULT_CONTROL_INVALID" });
    }
    return;
  }

  const target =
    url.pathname === "/v1/clock"
      ? "clock"
      : url.pathname === "/v1/telemetry"
        ? "telemetry"
        : url.pathname.startsWith("/v1/")
          ? "provider"
          : "network";
  const networkMode = modes.get("network");
  const mode = networkMode === "pass" ? modes.get(target) : networkMode;
  if (mode === "reset") {
    request.socket.destroy();
    return;
  }
  if (mode === "timeout") {
    setTimeout(
      () => json(response, 504, { reason_code: "STUB_TIMEOUT" }),
      10_000,
    );
    return;
  }
  if (mode === "failure") {
    json(response, 503, {
      reason_code: `STUB_${target.toUpperCase()}_FAILURE`,
    });
    return;
  }
  if (target === "clock") {
    json(response, 200, {
      now: new Date(Date.now() + clockOffsetMs).toISOString(),
      offset_ms: clockOffsetMs,
    });
    return;
  }
  json(response, 200, {
    fixture: "synthetic-v1",
    status: "OK",
    target,
  });
});

server.listen(port, "0.0.0.0");

function shutdown() {
  server.close(() => process.exit(0));
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
