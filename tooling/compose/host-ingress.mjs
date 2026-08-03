#!/usr/bin/env node
import http from "node:http";

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function headersWithoutHopByHop(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([name]) => !hopByHopHeaders.has(name)),
  );
}

function targetFromEnvironment(name) {
  const target = new URL(process.env[name]);
  if (target.protocol !== "http:") {
    throw new Error(`HOST_INGRESS_TARGET_INVALID:${name}`);
  }
  return target;
}

function createProxy(port, target) {
  const server = http.createServer((request, response) => {
    const incomingUrl = new URL(
      request.url ?? "/",
      "http://host-ingress.internal",
    );
    const upstream = http.request(
      {
        headers: {
          ...headersWithoutHopByHop(request.headers),
          host: target.host,
        },
        hostname: target.hostname,
        method: request.method,
        path: `${incomingUrl.pathname}${incomingUrl.search}`,
        port: target.port,
      },
      (upstreamResponse) => {
        response.writeHead(
          upstreamResponse.statusCode ?? 502,
          headersWithoutHopByHop(upstreamResponse.headers),
        );
        upstreamResponse.pipe(response);
      },
    );
    upstream.setTimeout(5_000, () => upstream.destroy());
    upstream.once("error", () => {
      if (!response.headersSent) {
        response.writeHead(502, { "content-type": "text/plain" });
      }
      response.end("UPSTREAM_UNAVAILABLE\n");
    });
    request.pipe(upstream);
  });
  server.listen(port, "0.0.0.0");
  return server;
}

const servers = [
  createProxy(
    13_000,
    targetFromEnvironment("DAILYENERGY_HOST_INGRESS_API_TARGET"),
  ),
  createProxy(
    13_001,
    targetFromEnvironment("DAILYENERGY_HOST_INGRESS_ADMIN_TARGET"),
  ),
  createProxy(
    13_090,
    targetFromEnvironment("DAILYENERGY_HOST_INGRESS_STUB_TARGET"),
  ),
  createProxy(
    13_091,
    targetFromEnvironment("DAILYENERGY_HOST_INGRESS_PROXY_TARGET"),
  ),
];

function shutdown() {
  let remaining = servers.length;
  const complete = () => {
    remaining -= 1;
    if (remaining === 0) {
      process.exit(0);
    }
  };
  for (const server of servers) {
    server.close(complete);
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
