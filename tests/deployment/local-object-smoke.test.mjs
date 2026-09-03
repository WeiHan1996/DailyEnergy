import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import { localObjectSmokeTesting } from "../../tooling/deployment/local-object-smoke.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const smokePath = path.join(
  repositoryRoot,
  "tooling/deployment/local-object-smoke.mjs",
);
const objectPath =
  "/dev-lite/objects/healthchecks/00000000-0000-4000-8000-000000000000";

async function withStub(callback) {
  const stub = await localObjectSmokeTesting.startLocalObjectStub(objectPath);
  try {
    return await callback(stub);
  } finally {
    await stub.close();
  }
}

test("T-E017-LOCAL-OBJECT-001 runs one redacted loopback-memory smoke", () => {
  const result = spawnSync(process.execPath, [smokePath], {
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(
    result.stdout,
    "LOCAL_OBJECT_SMOKE_OK:transport=loopback-memory:put=201:get=200:sha256=match:delete=204:head=404\n",
  );
  assert.equal(result.stdout.includes("dev-lite/objects"), false);
  assert.equal(result.stdout.includes("healthchecks"), false);
  assert.equal(result.stdout.includes("dailyenergy-synthetic"), false);
  assert.doesNotMatch(
    result.stdout,
    /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/u,
  );
});

test("T-E017-LOCAL-OBJECT-001 binds only a random loopback port and deletes the object", async () => {
  await withStub(async (stub) => {
    assert.equal(stub.address.address, "127.0.0.1");
    assert.equal(stub.address.port > 0, true);
    assert.equal(stub.origin, `http://127.0.0.1:${stub.address.port}`);

    const put = await localObjectSmokeTesting.request(
      stub.origin,
      "PUT",
      objectPath,
      { body: Buffer.from("synthetic") },
    );
    assert.equal(put.status, 201);
    const get = await localObjectSmokeTesting.request(
      stub.origin,
      "GET",
      objectPath,
    );
    assert.equal(get.status, 200);
    assert.equal(get.body.toString("utf8"), "synthetic");
    assert.equal(
      (await localObjectSmokeTesting.request(stub.origin, "DELETE", objectPath))
        .status,
      204,
    );
    assert.equal(
      (await localObjectSmokeTesting.request(stub.origin, "HEAD", objectPath))
        .status,
      404,
    );
  });
});

test("T-E017-LOCAL-OBJECT-001 rejects query, range, redirect, traversal and unknown methods", async () => {
  await withStub(async (stub) => {
    const cases = [
      ["GET", `${objectPath}?copy=1`, {}, 400],
      ["GET", objectPath, { headers: { Range: "bytes=0-1" } }, 416],
      ["GET", `${objectPath}/redirect`, {}, 404],
      [
        "PUT",
        `${objectPath}%2F..%2Fescape`,
        { body: Buffer.from("synthetic") },
        400,
      ],
      ["POST", objectPath, { body: Buffer.from("synthetic") }, 405],
    ];
    for (const [method, target, options, status] of cases) {
      const response = await localObjectSmokeTesting.request(
        stub.origin,
        method,
        target,
        options,
      );
      assert.equal(response.status, status, `${method} ${target}`);
      assert.equal(response.headers.has("location"), false);
    }
  });
});

test("T-E017-LOCAL-OBJECT-001 accepts 4 KiB and rejects larger bodies without replacing the object", async () => {
  await withStub(async (stub) => {
    const accepted = Buffer.alloc(localObjectSmokeTesting.MAX_BODY_BYTES, "a");
    assert.equal(
      (
        await localObjectSmokeTesting.request(stub.origin, "PUT", objectPath, {
          body: accepted,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await localObjectSmokeTesting.request(stub.origin, "PUT", objectPath, {
          body: Buffer.alloc(localObjectSmokeTesting.MAX_BODY_BYTES + 1, "b"),
        })
      ).status,
      413,
    );
    const get = await localObjectSmokeTesting.request(
      stub.origin,
      "GET",
      objectPath,
    );
    assert.equal(get.status, 200);
    assert.deepEqual(get.body, accepted);
  });
});

test("T-E017-LOCAL-OBJECT-001 rejects every object path outside the closed UUID namespace", async () => {
  for (const invalid of [
    "/dev-lite/objects/healthchecks/not-a-uuid",
    "/dev/objects/healthchecks/00000000-0000-4000-8000-000000000000",
    "/dev-lite/objects/healthchecks/00000000-0000-1000-8000-000000000000",
  ]) {
    await assert.rejects(
      localObjectSmokeTesting.startLocalObjectStub(invalid),
      /LOCAL_OBJECT_SMOKE_PATH_INVALID/u,
    );
  }
});
