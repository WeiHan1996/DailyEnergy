import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { collectBuildOutputFiles } from "../../tooling/ci/build-output.mjs";
import {
  findArtifactDiagnostics,
  findWorkflowDiagnostics,
  sha256,
  validateCiPolicy,
  validateLicenseInventory,
  validateSupplyChainDocuments,
  validateTelemetryPolicy,
  validateTurboPolicy,
  verifyDigestManifest,
} from "../../tooling/ci/policy.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");

async function linkDirectory(target, link) {
  await symlink(
    target,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
}

async function readJson(relativePath) {
  return JSON.parse(
    await readFile(path.resolve(repositoryRoot, relativePath), "utf8"),
  );
}

const [ciPolicy, telemetryPolicy, artifactPolicy, turboPolicy, workflow] =
  await Promise.all([
    readJson("tests/ci/policy.json"),
    readJson("tests/ci/telemetry-policy.json"),
    readJson("tests/artifacts/policy.json"),
    readJson("turbo.json"),
    readFile(path.resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
  ]);

test("T-E011-CI-POLICY-001 accepts the minimum-permission pinned workflow", () => {
  assert.deepEqual(validateCiPolicy(ciPolicy), {
    automated: 9,
    external: 3,
    lanes: 12,
  });
  assert.deepEqual(
    findWorkflowDiagnostics(workflow, ciPolicy, { complete: true }),
    [],
  );
});

const workflowFixtures = [
  ["mutable-action.yml", "CI_WORKFLOW_ACTION_MUTABLE"],
  ["excessive-permission.yml", "CI_WORKFLOW_PERMISSION_PROHIBITED"],
  ["fork-secret.yml", "CI_WORKFLOW_SECRET_REFERENCE"],
  ["artifact-ttl.yml", "CI_WORKFLOW_ARTIFACT_TTL_INVALID"],
  ["remote-cache.yml", "CI_WORKFLOW_REMOTE_CACHE_ENABLED"],
];
for (const [fixture, expectedRule] of workflowFixtures) {
  test(`T-E011-CI-POLICY-001 rejects ${fixture}`, async () => {
    const source = await readFile(
      path.resolve(repositoryRoot, "tests/ci/fixtures", fixture),
      "utf8",
    );
    assert.ok(
      findWorkflowDiagnostics(source, ciPolicy).some((diagnostic) =>
        diagnostic.startsWith(expectedRule),
      ),
    );
  });
}

test("T-E011-CI-POLICY-001 keeps external lanes pending", () => {
  const altered = structuredClone(ciPolicy);
  altered.lanes.find(({ id }) => id === "manual-rc").execution =
    "AUTOMATED_REQUIRED";
  assert.throws(
    () => validateCiPolicy(altered),
    /CI_POLICY_EXTERNAL_LANE_FALSE_PASS/u,
  );
});

test("T-E011-CI-CACHE-001 rejects sensitive and critical task caching", () => {
  assert.deepEqual(validateTurboPolicy(turboPolicy), { tasks: 5 });
  const sensitive = structuredClone(turboPolicy);
  sensitive.tasks.build.inputs = ["$TURBO_DEFAULT$"];
  assert.throws(
    () => validateTurboPolicy(sensitive),
    /CI_CACHE_SENSITIVE_INPUT/u,
  );
  const migration = structuredClone(turboPolicy);
  migration.tasks.migrate = { cache: true, outputs: [] };
  assert.throws(
    () => validateTurboPolicy(migration),
    /CI_CACHE_CRITICAL_TASK_PROHIBITED/u,
  );
});

test("T-E011-CI-TELEMETRY-001 enforces declared low-cardinality fields", () => {
  assert.deepEqual(validateTelemetryPolicy(telemetryPolicy), {
    metrics: 1,
    totalSeries: 160,
  });
  const forbidden = structuredClone(telemetryPolicy);
  forbidden.labels.account_ref = structuredClone(forbidden.labels.lane);
  assert.throws(
    () => validateTelemetryPolicy(forbidden),
    /CI_TELEMETRY_FORBIDDEN_LABEL/u,
  );
  const undeclared = structuredClone(telemetryPolicy);
  undeclared.metrics[0].labels.push("trace_id");
  assert.throws(
    () => validateTelemetryPolicy(undeclared),
    /CI_TELEMETRY_LABEL_UNDECLARED/u,
  );
});

test("T-E011-CI-ARTIFACT-001 rejects raw content and credential canaries", () => {
  assert.deepEqual(
    findArtifactDiagnostics(
      {
        artifact_version: "v1",
        result: "PASS",
        sha256: `a1${"3".repeat(10)}${"b".repeat(52)}`,
        source_ids: ["S31-TEST-047"],
      },
      artifactPolicy,
    ),
    [],
  );
  assert.ok(
    findArtifactDiagnostics(
      { prompt: "forbidden", result: "FAIL" },
      artifactPolicy,
    ).some((diagnostic) => diagnostic.startsWith("CI_ARTIFACT_FORBIDDEN_KEY")),
  );
  assert.ok(
    findArtifactDiagnostics(
      { result: "Bearer synthetic-token-canary" },
      artifactPolicy,
    ).some((diagnostic) =>
      diagnostic.startsWith("CI_ARTIFACT_FORBIDDEN_VALUE"),
    ),
  );
});

test("T-E011-CI-LICENSE-001 fails closed on unknown license expressions", () => {
  const policy = {
    policy_version: "e-011-license-policy-v1",
    allowed_expressions: ["MIT"],
    denied_patterns: ["^GPL"],
    unknown_license: "FAIL_CLOSED",
  };
  assert.deepEqual(
    validateLicenseInventory(
      { MIT: [{ name: "a", versions: ["1.0.0"] }] },
      policy,
    ),
    [{ license: "MIT", name: "a", version: "1.0.0" }],
  );
  assert.throws(
    () =>
      validateLicenseInventory(
        { UNKNOWN: [{ name: "a", versions: ["1.0.0"] }] },
        policy,
      ),
    /CI_LICENSE_EXPRESSION_DENIED/u,
  );
});

test("T-E011-CI-SUPPLY-001 detects artifact digest mismatch", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "dailyenergy-e011-digest-"),
  );
  try {
    const filePath = path.resolve(directory, "artifact.txt");
    await writeFile(filePath, "first", "utf8");
    const manifest = {
      manifest_version: "e-011-build-digest-v1",
      entries: [{ path: "artifact.txt", sha256: sha256("first") }],
    };
    assert.deepEqual(await verifyDigestManifest(directory, manifest), {
      entries: 1,
    });
    await writeFile(filePath, "changed", "utf8");
    await assert.rejects(
      verifyDigestManifest(directory, manifest),
      /CI_DIGEST_MISMATCH/u,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("T-E011-CI-SUPPLY-001 follows build links contained by the repository", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "dailyenergy-e011-contained-link-"),
  );
  try {
    const output = path.resolve(directory, "output");
    const dependency = path.resolve(directory, "dependency");
    await Promise.all([
      mkdir(output, { recursive: true }),
      mkdir(dependency, { recursive: true }),
    ]);
    await writeFile(path.resolve(dependency, "artifact.txt"), "linked", "utf8");
    await linkDirectory(dependency, path.resolve(output, "dependency"));

    const files = await collectBuildOutputFiles(directory, ["output"]);
    assert.deepEqual(
      files.map((file) => path.relative(directory, file).replaceAll("\\", "/")),
      ["output/dependency/artifact.txt"],
    );
    const manifest = {
      manifest_version: "e-011-build-digest-v1",
      entries: [
        {
          path: "output/dependency/artifact.txt",
          sha256: sha256("linked"),
        },
      ],
    };
    assert.deepEqual(await verifyDigestManifest(directory, manifest), {
      entries: 1,
    });
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("T-E011-CI-SUPPLY-001 rejects build links outside the repository", async () => {
  const [directory, external] = await Promise.all([
    mkdtemp(path.join(tmpdir(), "dailyenergy-e011-external-link-root-")),
    mkdtemp(path.join(tmpdir(), "dailyenergy-e011-external-link-target-")),
  ]);
  try {
    const output = path.resolve(directory, "output");
    await mkdir(output, { recursive: true });
    await writeFile(path.resolve(external, "artifact.txt"), "external", "utf8");
    await linkDirectory(external, path.resolve(output, "dependency"));

    await assert.rejects(
      collectBuildOutputFiles(directory, ["output"]),
      /CI_BUILD_OUTPUT_LINK_OUTSIDE_REPOSITORY/u,
    );
    await assert.rejects(
      verifyDigestManifest(directory, {
        manifest_version: "e-011-build-digest-v1",
        entries: [
          {
            path: "output/dependency/artifact.txt",
            sha256: sha256("external"),
          },
        ],
      }),
      /CI_DIGEST_ARTIFACT_OUTSIDE_ROOT/u,
    );
  } finally {
    await Promise.all([
      rm(directory, { force: true, recursive: true }),
      rm(external, { force: true, recursive: true }),
    ]);
  }
});

test("T-E011-CI-SUPPLY-001 rejects build link cycles", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "dailyenergy-e011-link-cycle-"),
  );
  try {
    const output = path.resolve(directory, "output");
    await mkdir(output, { recursive: true });
    await linkDirectory(output, path.resolve(output, "cycle"));
    await assert.rejects(
      collectBuildOutputFiles(directory, ["output"]),
      /CI_BUILD_OUTPUT_LINK_CYCLE/u,
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});

test("T-E011-CI-SUPPLY-001 requires honest unsigned provenance metadata", () => {
  const digestManifest = { lockfile_sha256: "a".repeat(64) };
  const sbom = { spdxVersion: "SPDX-2.3", packages: [{ name: "synthetic" }] };
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    predicate: {
      buildDefinition: {
        externalParameters: { lockfile_sha256: "a".repeat(64) },
      },
    },
    attestation_status:
      "PENDING_REPOSITORY_CAPABILITY_AND_EXPLICIT_RELEASE_AUTHORIZATION",
    signature_status: "UNSIGNED",
  };
  assert.deepEqual(
    validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    { packages: 1 },
  );
  provenance.signature_status = "SIGNED";
  assert.throws(
    () => validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    /CI_PROVENANCE_INVALID/u,
  );
});
