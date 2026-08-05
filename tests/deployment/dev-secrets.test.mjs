import assert from "node:assert/strict";
import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  developmentSecretFileNames,
  provisionDevelopmentSecrets,
} from "../../tooling/deployment/provision-dev-secrets.mjs";

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "dailyenergy-e012-secrets-"));
  await mkdir(path.join(root, "secrets"), { mode: 0o700 });
  t.after(async () => {
    await rm(root, { force: true, recursive: true });
  });
  return root;
}

test("T-E012-SECRET-001 creates and revalidates one closed root-equivalent DEV secret version", async (t) => {
  const root = await temporaryRoot(t);
  const expectedUid = process.getuid();
  const expectedGid = process.getgid();
  const options = { expectedGid, expectedUid, root };
  assert.deepEqual(await provisionDevelopmentSecrets(options), {
    files: 8,
    status: "CREATED",
  });
  assert.deepEqual(await provisionDevelopmentSecrets(options), {
    files: 8,
    status: "UNCHANGED",
  });
  const directory = path.join(root, "secrets", "dev-secret-v1");
  const files = await readdir(directory);
  assert.deepEqual(files.sort(), developmentSecretFileNames);
  const postgresPassword = (
    await readFile(path.join(directory, "postgres-password"), "utf8")
  ).trim();
  const adminUrl = new URL(
    (await readFile(path.join(directory, "database-admin-url"), "utf8")).trim(),
  );
  assert.equal(adminUrl.password, postgresPassword);
  assert.equal(adminUrl.hostname, "postgres");
  assert.equal(adminUrl.pathname, "/daily_energy");
});

test("T-E012-SECRET-001 fails closed on partial or unsafe existing state", async (t) => {
  const expectedUid = process.getuid();
  const expectedGid = process.getgid();
  const root = await temporaryRoot(t);
  const options = { expectedGid, expectedUid, root };
  await provisionDevelopmentSecrets(options);
  const directory = path.join(root, "secrets", "dev-secret-v1");
  await writeFile(path.join(directory, "unexpected"), "not-a-secret\n", {
    mode: 0o600,
  });
  await assert.rejects(
    provisionDevelopmentSecrets(options),
    /E012_DEV_SECRET_SET_INCOMPLETE/u,
  );

  const secondRoot = await temporaryRoot(t);
  const secondOptions = { expectedGid, expectedUid, root: secondRoot };
  await provisionDevelopmentSecrets(secondOptions);
  await chmod(
    path.join(secondRoot, "secrets", "dev-secret-v1", "postgres-password"),
    0o644,
  );
  await assert.rejects(
    provisionDevelopmentSecrets(secondOptions),
    /E012_DEV_SECRET_FILE_INVALID/u,
  );
});
