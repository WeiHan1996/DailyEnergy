#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import http from "node:http";
import { pathToFileURL } from "node:url";

const LOOPBACK_HOST = "127.0.0.1";
const MAX_BODY_BYTES = 4 * 1024;
const OBJECT_PATH_PATTERN =
  /^\/dev-lite\/objects\/healthchecks\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const SYNTHETIC_BODY = Buffer.from(
  "dailyenergy-synthetic-local-object-smoke-v1\n",
);

function fail(ruleId) {
  throw new Error(ruleId);
}

function empty(response, status, headers = {}) {
  response.writeHead(status, {
    "cache-control": "no-store",
    "content-length": "0",
    ...headers,
  });
  response.end();
}

async function readBoundedBody(request) {
  const chunks = [];
  let size = 0;
  let tooLarge = false;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      tooLarge = true;
      continue;
    }
    chunks.push(chunk);
  }
  if (tooLarge) {
    fail("LOCAL_OBJECT_SMOKE_BODY_TOO_LARGE");
  }
  return Buffer.concat(chunks, size);
}

function targetStatus(request, objectPath) {
  const rawTarget = request.url ?? "";
  if (
    rawTarget.includes("?") ||
    rawTarget.includes("#") ||
    rawTarget.includes("\\") ||
    /%(?:2e|2f|5c)/iu.test(rawTarget) ||
    rawTarget.split("/").includes("..")
  ) {
    return 400;
  }
  if (rawTarget !== objectPath) {
    return 404;
  }
  if (request.headers.range !== undefined) {
    return 416;
  }
  if (!["DELETE", "GET", "HEAD", "PUT"].includes(request.method ?? "")) {
    return 405;
  }
  return undefined;
}

async function closeServer(server) {
  if (!server.listening) {
    return;
  }
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function startLocalObjectStub(objectPath) {
  if (!OBJECT_PATH_PATTERN.test(objectPath)) {
    fail("LOCAL_OBJECT_SMOKE_PATH_INVALID");
  }
  const objects = new Map();
  const server = http.createServer(async (request, response) => {
    try {
      const rejectedStatus = targetStatus(request, objectPath);
      if (rejectedStatus !== undefined) {
        empty(response, rejectedStatus);
        return;
      }

      if (request.method === "PUT") {
        let body;
        try {
          body = await readBoundedBody(request);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message === "LOCAL_OBJECT_SMOKE_BODY_TOO_LARGE"
          ) {
            empty(response, 413);
            return;
          }
          throw error;
        }
        const created = !objects.has(objectPath);
        objects.set(objectPath, body);
        empty(response, created ? 201 : 204);
        return;
      }

      if (request.method === "DELETE") {
        objects.delete(objectPath);
        empty(response, 204);
        return;
      }

      const body = objects.get(objectPath);
      if (body === undefined) {
        empty(response, 404);
        return;
      }
      if (request.method === "HEAD") {
        empty(response, 200, { "content-length": String(body.length) });
        return;
      }
      response.writeHead(200, {
        "cache-control": "no-store",
        "content-length": String(body.length),
        "content-type": "application/octet-stream",
      });
      response.end(body);
    } catch {
      empty(response, 500);
    }
  });
  server.requestTimeout = 3_000;
  server.headersTimeout = 3_000;
  server.keepAliveTimeout = 1_000;
  server.maxHeadersCount = 32;

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen({ exclusive: true, host: LOOPBACK_HOST, port: 0 }, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (
    address === null ||
    typeof address === "string" ||
    address.address !== LOOPBACK_HOST ||
    address.port < 1
  ) {
    await closeServer(server);
    fail("LOCAL_OBJECT_SMOKE_LISTENER_INVALID");
  }
  return {
    address,
    close: () => closeServer(server),
    origin: `http://${LOOPBACK_HOST}:${address.port}`,
  };
}

async function request(origin, method, target, options = {}) {
  const response = await fetch(`${origin}${target}`, {
    body: options.body,
    headers: options.headers,
    method,
    redirect: "error",
    signal: AbortSignal.timeout(3_000),
  });
  return {
    body: Buffer.from(await response.arrayBuffer()),
    headers: response.headers,
    status: response.status,
  };
}

function requireStatus(response, expected, ruleId) {
  if (response.status !== expected) {
    fail(ruleId);
  }
}

async function runLocalObjectSmoke() {
  const objectPath = `/dev-lite/objects/healthchecks/${randomUUID()}`;
  const stub = await startLocalObjectStub(objectPath);
  try {
    requireStatus(
      await request(stub.origin, "PUT", `${objectPath}?copy=1`, {
        body: SYNTHETIC_BODY,
      }),
      400,
      "LOCAL_OBJECT_SMOKE_QUERY_ACCEPTED",
    );
    requireStatus(
      await request(stub.origin, "PUT", `${objectPath}%2F..%2Fescape`, {
        body: SYNTHETIC_BODY,
      }),
      400,
      "LOCAL_OBJECT_SMOKE_TRAVERSAL_ACCEPTED",
    );
    requireStatus(
      await request(stub.origin, "POST", objectPath, {
        body: SYNTHETIC_BODY,
      }),
      405,
      "LOCAL_OBJECT_SMOKE_METHOD_ACCEPTED",
    );
    requireStatus(
      await request(stub.origin, "PUT", objectPath, {
        body: Buffer.alloc(MAX_BODY_BYTES + 1, "x"),
      }),
      413,
      "LOCAL_OBJECT_SMOKE_OVERSIZE_ACCEPTED",
    );
    const redirect = await request(
      stub.origin,
      "GET",
      `${objectPath}/redirect`,
    );
    requireStatus(redirect, 404, "LOCAL_OBJECT_SMOKE_REDIRECT_ACCEPTED");
    if (
      redirect.status >= 300 &&
      redirect.status < 400 &&
      redirect.headers.has("location")
    ) {
      fail("LOCAL_OBJECT_SMOKE_REDIRECT_ACCEPTED");
    }

    requireStatus(
      await request(stub.origin, "PUT", objectPath, { body: SYNTHETIC_BODY }),
      201,
      "LOCAL_OBJECT_SMOKE_PUT_FAILED",
    );
    requireStatus(
      await request(stub.origin, "GET", objectPath, {
        headers: { Range: "bytes=0-1" },
      }),
      416,
      "LOCAL_OBJECT_SMOKE_RANGE_ACCEPTED",
    );
    const get = await request(stub.origin, "GET", objectPath);
    requireStatus(get, 200, "LOCAL_OBJECT_SMOKE_GET_FAILED");
    const expectedHash = createHash("sha256")
      .update(SYNTHETIC_BODY)
      .digest("hex");
    const actualHash = createHash("sha256").update(get.body).digest("hex");
    if (actualHash !== expectedHash) {
      fail("LOCAL_OBJECT_SMOKE_SHA256_MISMATCH");
    }
    requireStatus(
      await request(stub.origin, "DELETE", objectPath),
      204,
      "LOCAL_OBJECT_SMOKE_DELETE_FAILED",
    );
    requireStatus(
      await request(stub.origin, "HEAD", objectPath),
      404,
      "LOCAL_OBJECT_SMOKE_HEAD_AFTER_DELETE_FAILED",
    );
  } finally {
    await stub.close();
  }
  return Object.freeze({
    delete: 204,
    get: 200,
    head: 404,
    put: 201,
    sha256: "match",
    transport: "loopback-memory",
  });
}

export const localObjectSmokeTesting = Object.freeze({
  MAX_BODY_BYTES,
  OBJECT_PATH_PATTERN,
  request,
  startLocalObjectStub,
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runLocalObjectSmoke()
    .then((result) => {
      process.stdout.write(
        `LOCAL_OBJECT_SMOKE_OK:transport=${result.transport}:put=${result.put}:get=${result.get}:sha256=${result.sha256}:delete=${result.delete}:head=${result.head}\n`,
      );
    })
    .catch((error) => {
      const message =
        error instanceof Error &&
        /^LOCAL_OBJECT_SMOKE_[A-Z0-9_]+$/u.test(error.message)
          ? error.message
          : "LOCAL_OBJECT_SMOKE_FAILED";
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
