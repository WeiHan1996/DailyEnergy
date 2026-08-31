import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const bannedDependency =
  /(?:segment|mixpanel|amplitude|posthog|fullstory|hotjar|growingio|sensorsdata|firebase-analytics|google-analytics|matomo|appsflyer|adjust-sdk|session-replay)/iu;
const bannedSourceImport =
  /(?:from\s+|import\s*\(|require\s*\()\s*["'](?:@segment\/|analytics-node|mixpanel|amplitude|posthog|fullstory|hotjar|growingio|sensorsdata|firebase-analytics|google-analytics|matomo|appsflyer|adjust-sdk|session-replay)/iu;

async function filesUnder(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["dist", "node_modules", ".turbo", ".next"].includes(entry.name)) {
      continue;
    }
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      output.push(...(await filesUnder(target)));
    } else {
      output.push(target);
    }
  }
  return output;
}

test("C-015 keeps third-party analytics, replay and individual assignment disabled", async () => {
  const manifests = (
    await Promise.all(
      ["apps", "packages"].map((directory) =>
        filesUnder(path.join(root, directory)),
      ),
    )
  )
    .flat()
    .filter((file) => file.endsWith("package.json"));
  for (const manifest of manifests) {
    const value = JSON.parse(await readFile(manifest, "utf8"));
    const dependencies = {
      ...(value.dependencies ?? {}),
      ...(value.devDependencies ?? {}),
      ...(value.optionalDependencies ?? {}),
    };
    assert.deepEqual(
      Object.keys(dependencies).filter((name) => bannedDependency.test(name)),
      [],
      path.relative(root, manifest),
    );
  }

  const productionFiles = (
    await Promise.all(
      ["apps", "packages"].map((directory) =>
        filesUnder(path.join(root, directory)),
      ),
    )
  )
    .flat()
    .filter((file) => /\.(?:ts|mts|js|mjs)$/u.test(file));
  for (const file of productionFiles) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, bannedSourceImport, path.relative(root, file));
  }
});

test("C-015 persists only named T4 aggregate and metric tables", async () => {
  const schema = await readFile(
    path.join(root, "prisma/schema.prisma"),
    "utf8",
  );
  const analyticsModels = [...schema.matchAll(/^model (Analytics\w+)/gmu)].map(
    (match) => match[1],
  );
  assert.deepEqual(analyticsModels, [
    "AnalyticsProductDailyAggregate",
    "AnalyticsRuntimeDailyAggregate",
    "AnalyticsGovernanceDailyAggregate",
    "AnalyticsSafetyDailyAggregate",
    "AnalyticsProductMetricSnapshot",
    "AnalyticsGateSnapshot",
  ]);
  assert.doesNotMatch(
    schema,
    /^model Analytics\w*(?:Event|Subject|Session|Assignment|Attribution)\w*/gmu,
  );
  const migration = await readFile(
    path.join(
      root,
      "prisma/migrations/20260830000000_c015_core_analytics/migration.sql",
    ),
    "utf8",
  );
  assert.doesNotMatch(
    migration,
    /CREATE TABLE "analytics_[^"]*(?:raw|event_store|subject|session|assignment|attribution)/iu,
  );
});
