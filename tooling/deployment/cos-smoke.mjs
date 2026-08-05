#!/usr/bin/env node
import { createHash, createHmac, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const CONFIG_KEYS = ["COS_BUCKET", "COS_ENDPOINT", "COS_PREFIX", "COS_REGION"];
const SYNTHETIC_BODY = Buffer.from("dailyenergy-synthetic-cos-smoke-v1\n");

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function decodeValue(raw, key) {
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  if (raw.length === 0 || /[\0\r\n\s#'"`$\\]/u.test(raw)) {
    fail("COS_SMOKE_CONFIG_VALUE", key);
  }
  return raw;
}

function parseConfig(source) {
  const values = {};
  for (const line of source.split("\n")) {
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/u.exec(line);
    if (match === null || Object.hasOwn(values, match[1])) {
      fail("COS_SMOKE_CONFIG_SYNTAX", "line");
    }
    values[match[1]] = decodeValue(match[2], match[1]);
  }
  if (
    JSON.stringify(Object.keys(values).sort()) !==
    JSON.stringify([...CONFIG_KEYS].sort())
  ) {
    fail("COS_SMOKE_CONFIG_KEYS", "closed");
  }
  if (
    !/^[a-z0-9][a-z0-9-]{1,52}-[0-9]{5,12}$/u.test(values.COS_BUCKET) ||
    values.COS_REGION !== "ap-shanghai" ||
    values.COS_PREFIX !== "dev/objects/" ||
    values.COS_ENDPOINT !==
      `${values.COS_BUCKET}.cos-internal.${values.COS_REGION}.tencentcos.cn`
  ) {
    fail("COS_SMOKE_CONFIG_SCOPE", "private-dev");
  }
  return values;
}

function secretValue(source, role) {
  const value = source.endsWith("\n") ? source.slice(0, -1) : source;
  if (value.length < 1 || value.length > 4096 || /[\0\r\n]/u.test(value)) {
    fail("COS_SMOKE_SECRET_INVALID", role);
  }
  return value;
}

function isPrivateAddress(address) {
  if (address.includes(":")) {
    return address.toLowerCase().startsWith("fe80:");
  }
  const parts = address.split(".").map(Number);
  return (
    parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

function hmacSha1(key, value) {
  return createHmac("sha1", key).update(value).digest("hex");
}

function sha1(value) {
  return createHash("sha1").update(value).digest("hex");
}

function authorization(
  method,
  objectPath,
  host,
  secretId,
  secretKey,
  nowMs = Date.now(),
) {
  const start = Math.floor(nowMs / 1000) - 60;
  const keyTime = `${start};${start + 600}`;
  const canonicalHeaders = `host=${host.toLowerCase()}`;
  const httpString = `${method.toLowerCase()}\n/${objectPath}\n\n${canonicalHeaders}\n`;
  const stringToSign = `sha1\n${keyTime}\n${sha1(httpString)}\n`;
  const signKey = hmacSha1(secretKey, keyTime);
  const signature = hmacSha1(signKey, stringToSign);
  return [
    "q-sign-algorithm=sha1",
    `q-ak=${secretId}`,
    `q-sign-time=${keyTime}`,
    `q-key-time=${keyTime}`,
    "q-header-list=host",
    "q-url-param-list=",
    `q-signature=${signature}`,
  ].join("&");
}

async function request(method, config, objectPath, secretId, secretKey, body) {
  const response = await fetch(`https://${config.COS_ENDPOINT}/${objectPath}`, {
    body,
    headers: {
      Authorization: authorization(
        method,
        objectPath,
        config.COS_ENDPOINT,
        secretId,
        secretKey,
      ),
      Host: config.COS_ENDPOINT,
    },
    method,
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  });
  return response;
}

async function main() {
  const configPath = process.env.DAILYENERGY_COS_CONFIG_FILE;
  const secretIdPath = process.env.DAILYENERGY_COS_SECRET_ID_FILE;
  const secretKeyPath = process.env.DAILYENERGY_COS_SECRET_KEY_FILE;
  if (
    configPath !== "/run/dailyenergy/cos.env" ||
    secretIdPath !== "/run/secrets/cos_secret_id" ||
    secretKeyPath !== "/run/secrets/cos_secret_key"
  ) {
    fail("COS_SMOKE_FILE_PATH", "closed");
  }
  const [configSource, secretIdSource, secretKeySource] = await Promise.all([
    readFile(configPath, "utf8"),
    readFile(secretIdPath, "utf8"),
    readFile(secretKeyPath, "utf8"),
  ]);
  const config = parseConfig(configSource);
  const secretId = secretValue(secretIdSource, "secret-id");
  const secretKey = secretValue(secretKeySource, "secret-key");
  const addresses = await lookup(config.COS_ENDPOINT, { all: true });
  if (
    addresses.length === 0 ||
    addresses.some(({ address }) => !isPrivateAddress(address))
  ) {
    fail("COS_SMOKE_ENDPOINT_NOT_PRIVATE", "dns");
  }

  const objectPath = `${config.COS_PREFIX}healthchecks/${randomUUID()}`;
  let uploaded = false;
  try {
    const put = await request(
      "PUT",
      config,
      objectPath,
      secretId,
      secretKey,
      SYNTHETIC_BODY,
    );
    if (put.status !== 200) {
      fail("COS_SMOKE_PUT", `http-${put.status}`);
    }
    uploaded = true;
    const get = await request("GET", config, objectPath, secretId, secretKey);
    if (get.status !== 200) {
      fail("COS_SMOKE_GET", `http-${get.status}`);
    }
    const received = Buffer.from(await get.arrayBuffer());
    if (
      createHash("sha256").update(received).digest("hex") !==
      createHash("sha256").update(SYNTHETIC_BODY).digest("hex")
    ) {
      fail("COS_SMOKE_CONTENT", "sha256-mismatch");
    }
    const remove = await request(
      "DELETE",
      config,
      objectPath,
      secretId,
      secretKey,
    );
    if (remove.status !== 204) {
      fail("COS_SMOKE_DELETE", `http-${remove.status}`);
    }
    uploaded = false;
    const head = await request("HEAD", config, objectPath, secretId, secretKey);
    if (head.status !== 404) {
      fail("COS_SMOKE_DELETE_VERIFY", `http-${head.status}`);
    }
  } finally {
    if (uploaded) {
      await request("DELETE", config, objectPath, secretId, secretKey).catch(
        () => undefined,
      );
    }
  }
  process.stdout.write(
    "COS_SMOKE_OK:transport=private-internal:put=200:get=200:sha256=match:delete=204:head=404\n",
  );
}

export const cosSmokeTesting = Object.freeze({
  authorization,
  isPrivateAddress,
  parseConfig,
});

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const message =
      error instanceof Error &&
      /^[A-Z0-9_]+:[A-Za-z0-9._-]+$/u.test(error.message)
        ? error.message
        : "COS_SMOKE_FAILED:unexpected";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
