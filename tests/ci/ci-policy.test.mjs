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
  collectLockfilePackageCoordinates,
  findArtifactDiagnostics,
  findWorkflowDiagnostics,
  sha256,
  validateCiPolicy,
  validateLicenseInventory,
  validateManualMergeGate,
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

const [
  ciPolicy,
  telemetryPolicy,
  artifactPolicy,
  licensePolicy,
  turboPolicy,
  workflow,
  artifactContentCanaries,
  lockfileSource,
] = await Promise.all([
  readJson("tests/ci/policy.json"),
  readJson("tests/ci/telemetry-policy.json"),
  readJson("tests/artifacts/policy.json"),
  readJson("tests/ci/license-policy.json"),
  readJson("turbo.json"),
  readFile(path.resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8"),
  readJson("tests/ci/fixtures/artifact-content-canaries.json"),
  readFile(path.resolve(repositoryRoot, "pnpm-lock.yaml"), "utf8"),
]);
const lockfilePackageCoordinates =
  collectLockfilePackageCoordinates(lockfileSource);

function createLaneEvidence(laneId = "static") {
  const lane = ciPolicy.lanes.find(({ id }) => id === laneId);
  return {
    artifact_version: "e-011-ci-lane-evidence-v2",
    repository: "WeiHan1996/DailyEnergy",
    event_name: "pull_request",
    branch: "agent/e011-ci-supply-chain",
    pull_request: 119,
    head_sha: "a".repeat(40),
    base_sha: "b".repeat(40),
    tested_sha: "c".repeat(40),
    started_at_utc: "2026-08-04T01:02:03.000Z",
    ended_at_utc: "2026-08-04T01:02:04.000Z",
    duration_ms: 1000,
    failure_code: "NONE",
    next_action: "NONE",
    fixture_version: "synthetic-factory-v1",
    registry_version: "e-010-source-registry-v1",
    result: "PASS",
    runner_version: ciPolicy.runner,
    source_ids: lane.source_ids,
    lockfile_sha256: "d".repeat(64),
    toolchain_fingerprint: "e".repeat(64),
    tool_versions: {
      node: ciPolicy.node_version,
      pnpm: ciPolicy.pnpm_version,
      ci_policy: ciPolicy.policy_version,
      ci_runner: "e-011-ci-runner-v2",
      artifact_scanner: "e-011-artifact-scanner-v2",
      source_registry: "e-010-source-registry-v1",
    },
    lane_id: lane.id,
    command_count: lane.commands.length,
    completed_command_count: lane.commands.length,
    failed_command_ordinal: null,
  };
}

function laneEvidenceDiagnostics(value, laneId = "static") {
  const lane = ciPolicy.lanes.find(({ id }) => id === laneId);
  return findArtifactDiagnostics(value, artifactPolicy, {
    artifactName: "evidence.json",
    ciPolicy,
    lane,
    registryVersion: "e-010-source-registry-v1",
  });
}

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

test("T-E011-CI-POLICY-001 enforces the temporary manual merge gate", () => {
  const headSha = "a".repeat(40);
  const pullRequest = {
    baseRefName: "main",
    headRefOid: headSha,
    isDraft: false,
    mergeable: "MERGEABLE",
    mergeStateStatus: "CLEAN",
    number: 119,
    state: "OPEN",
    statusCheckRollup: ciPolicy.merge_gate.required_checks.map(
      (name, index) => ({
        conclusion: "SUCCESS",
        detailsUrl: `https://github.com/WeiHan1996/DailyEnergy/actions/runs/123456/job/${index + 1}`,
        name,
        status: "COMPLETED",
        workflowName: "CI",
      }),
    ),
  };

  assert.deepEqual(validateManualMergeGate(pullRequest, ciPolicy, headSha), {
    checks: 11,
    headSha,
    pullRequest: 119,
    runId: "123456",
  });

  const failedCheck = structuredClone(pullRequest);
  failedCheck.statusCheckRollup[0].conclusion = "FAILURE";
  assert.throws(
    () => validateManualMergeGate(failedCheck, ciPolicy, headSha),
    /CI_MANUAL_MERGE_GATE_CHECK_NOT_SUCCESSFUL/u,
  );

  const changedHead = structuredClone(pullRequest);
  changedHead.headRefOid = "b".repeat(40);
  assert.throws(
    () => validateManualMergeGate(changedHead, ciPolicy, headSha),
    /CI_MANUAL_MERGE_GATE_HEAD_CHANGED/u,
  );

  const mixedRun = structuredClone(pullRequest);
  mixedRun.statusCheckRollup[0].detailsUrl =
    "https://github.com/WeiHan1996/DailyEnergy/actions/runs/654321/job/1";
  assert.throws(
    () => validateManualMergeGate(mixedRun, ciPolicy, headSha),
    /CI_MANUAL_MERGE_GATE_RUN_MISMATCH/u,
  );

  const driftedPolicy = structuredClone(ciPolicy);
  driftedPolicy.merge_gate.required_checks.pop();
  assert.throws(
    () => validateManualMergeGate(pullRequest, driftedPolicy, headSha),
    /CI_POLICY_MERGE_GATE_INVALID/u,
  );
});

const workflowFixtures = [
  ["mutable-action.yml", "CI_WORKFLOW_ACTION_MUTABLE"],
  ["excessive-permission.yml", "CI_WORKFLOW_PERMISSION_PROHIBITED"],
  ["fork-secret.yml", "CI_WORKFLOW_SECRET_REFERENCE"],
  ["fork-secret-bracket.yml", "CI_WORKFLOW_SECRET_REFERENCE"],
  ["fork-secret-wrapped.yml", "CI_WORKFLOW_SECRET_REFERENCE"],
  ["artifact-ttl.yml", "CI_WORKFLOW_ARTIFACT_TTL_INVALID"],
  ["remote-cache.yml", "CI_WORKFLOW_REMOTE_CACHE_ENABLED"],
  ["shallow-checkout.yml", "CI_WORKFLOW_CHECKOUT_DEPTH_INVALID"],
  [
    "persisted-checkout-credentials.yml",
    "CI_WORKFLOW_CHECKOUT_CREDENTIALS_PERSISTED",
  ],
  [
    "unsafe-artifact-upload.yml",
    "CI_WORKFLOW_ARTIFACT_UPLOAD_WITHOUT_SCAN_PASS",
  ],
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

test("T-E011-CI-POLICY-001 rejects a removed mandatory lane command", () => {
  const altered = structuredClone(ciPolicy);
  const lane = altered.lanes.find(({ id }) => id === "unit-contract");
  lane.commands = lane.commands.filter(
    (command) =>
      JSON.stringify(command) !==
      JSON.stringify(["pnpm", "run", "testing:playwright-policy"]),
  );
  assert.throws(
    () => validateCiPolicy(altered),
    /CI_POLICY_REQUIRED_COMMAND_MISSING:unit-contract/u,
  );
});

test("T-E013-CI-POLICY-001 requires the observability contract Gate", () => {
  for (const requiredCommand of [
    ["pnpm", "run", "observability:validate"],
    ["pnpm", "run", "observability:runtime"],
  ]) {
    const altered = structuredClone(ciPolicy);
    const lane = altered.lanes.find(({ id }) => id === "unit-contract");
    lane.commands = lane.commands.filter(
      (command) => JSON.stringify(command) !== JSON.stringify(requiredCommand),
    );
    assert.throws(
      () => validateCiPolicy(altered),
      /CI_POLICY_REQUIRED_COMMAND_MISSING:unit-contract/u,
    );
  }
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
  const validEvidence = createLaneEvidence();
  assert.deepEqual(laneEvidenceDiagnostics(validEvidence), []);
  assert.equal(validEvidence.lockfile_sha256.length, 64);
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
  assert.ok(
    findArtifactDiagnostics(
      { artifact_version: "v1", result: "PASS", arbitrary: "metadata" },
      artifactPolicy,
    ).some((diagnostic) =>
      diagnostic.startsWith("CI_ARTIFACT_METADATA_NOT_ALLOWED"),
    ),
  );
  for (const canary of artifactContentCanaries) {
    const evidence = { ...validEvidence, ...canary.payload };
    const diagnostics = laneEvidenceDiagnostics(evidence);
    assert.ok(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.startsWith("CI_ARTIFACT_METADATA_NOT_ALLOWED") ||
          diagnostic.startsWith("CI_ARTIFACT_FORBIDDEN_KEY"),
      ),
      `${canary.name} must fail the closed artifact schema`,
    );
  }
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
  assert.deepEqual(
    validateLicenseInventory(
      {
        "LGPL-3.0-or-later": [
          {
            name: "@img/sharp-libvips-linux-x64",
            versions: ["1.3.2"],
          },
        ],
      },
      licensePolicy,
    ),
    [
      {
        license: "LGPL-3.0-or-later",
        name: "@img/sharp-libvips-linux-x64",
        version: "1.3.2",
      },
    ],
  );
  assert.throws(
    () =>
      validateLicenseInventory(
        {
          "LGPL-3.0-or-later": [
            { name: "unexpected-package", versions: ["1.3.2"] },
          ],
        },
        licensePolicy,
      ),
    /CI_LICENSE_PACKAGE_DENIED/u,
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
      manifest_version: "e-011-build-digest-v2",
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
      manifest_version: "e-011-build-digest-v2",
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
        manifest_version: "e-011-build-digest-v2",
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
  const createdAt = "2026-08-04T01:02:03.000Z";
  const digestManifest = {
    manifest_version: "e-011-build-digest-v2",
    head_sha: "b".repeat(40),
    base_sha: "c".repeat(40),
    tested_sha: "d".repeat(40),
    lockfile_sha256: "a".repeat(64),
    entries: [{ path: "artifact.txt", sha256: "c".repeat(64) }],
  };
  const sbom = {
    spdxVersion: "SPDX-2.3",
    dataLicense: "CC0-1.0",
    SPDXID: "SPDXRef-DOCUMENT",
    name: `dailyenergy-${digestManifest.head_sha.slice(0, 12)}`,
    documentNamespace: `https://dailyenergy.invalid/spdx/${digestManifest.head_sha}/${digestManifest.tested_sha}/${digestManifest.lockfile_sha256}`,
    creationInfo: {
      created: createdAt,
      creators: ["Tool: DailyEnergy-E011-SBOM-v1"],
    },
    packages: [
      {
        SPDXID: "SPDXRef-DailyEnergy",
        name: "daily-energy",
        versionInfo: "0.1.0",
        downloadLocation: "NOASSERTION",
        filesAnalyzed: false,
        licenseConcluded: "NOASSERTION",
        licenseDeclared: "NOASSERTION",
        copyrightText: "NOASSERTION",
        externalRefs: [
          {
            referenceCategory: "OTHER",
            referenceType: "pnpm-lock-sha256",
            referenceLocator: digestManifest.lockfile_sha256,
          },
        ],
      },
    ],
    relationships: [],
  };
  const provenance = {
    _type: "https://in-toto.io/Statement/v1",
    predicateType: "https://slsa.dev/provenance/v1",
    subject: [
      {
        name: "build-output-digests.json",
        digest: {
          sha256: sha256(`${JSON.stringify(digestManifest, null, 2)}\n`),
        },
      },
    ],
    predicate: {
      buildDefinition: {
        buildType: "https://dailyenergy.invalid/build-types/pnpm-turbo/v1",
        externalParameters: {
          head_sha: digestManifest.head_sha,
          base_sha: digestManifest.base_sha,
          tested_sha: digestManifest.tested_sha,
          branch: "agent/e011-ci-supply-chain",
          event_name: "pull_request",
          pull_request: 119,
          lockfile_sha256: digestManifest.lockfile_sha256,
          workflow: ".github/workflows/ci.yml",
        },
        internalParameters: {
          node_version: "24.18.0",
          pnpm_version: "11.17.0",
          runner: "ubuntu-24.04",
        },
        resolvedDependencies: [
          {
            uri: "git+https://github.com/WeiHan1996/DailyEnergy",
            digest: { gitCommit: digestManifest.tested_sha },
          },
          {
            uri: "file:pnpm-lock.yaml",
            digest: { sha256: digestManifest.lockfile_sha256 },
          },
        ],
      },
      runDetails: {
        builder: {
          id: "https://github.com/WeiHan1996/DailyEnergy/actions",
        },
        metadata: {
          invocationId: "123456",
          startedOn: createdAt,
          finishedOn: "2026-08-04T01:02:04.000Z",
        },
        byproducts: [],
      },
    },
    attestation_status:
      "PENDING_REPOSITORY_CAPABILITY_AND_EXPLICIT_RELEASE_AUTHORIZATION",
    signature_status: "UNSIGNED",
    promotion_status: "PROHIBITED_UNTIL_ATTESTED_AND_RELEASE_GATES_PASS",
  };
  for (const [artifactName, document] of [
    ["build-output-digests.json", digestManifest],
    ["sbom.spdx.json", sbom],
    ["provenance.intoto.json", provenance],
    [
      "vulnerability-summary.json",
      {
        artifact_version: "e-011-vulnerability-summary-v1",
        policy_version: "e-011-vulnerability-policy-v1",
        scope: "production",
        result: "PASS",
        counts: { critical: 0, high: 0 },
        advisories: [],
      },
    ],
  ]) {
    const artifactOptions = {
      artifactName,
      ciPolicy,
      ...(artifactName === "sbom.spdx.json"
        ? { lockfilePackageCoordinates }
        : {}),
    };
    assert.deepEqual(
      findArtifactDiagnostics(document, artifactPolicy, artifactOptions),
      [],
      `${artifactName} must match its closed artifact schema`,
    );
    const withNote = { ...structuredClone(document), note: "private matter" };
    assert.ok(
      findArtifactDiagnostics(withNote, artifactPolicy, artifactOptions).some(
        (diagnostic) =>
          diagnostic.startsWith("CI_ARTIFACT_METADATA_NOT_ALLOWED") ||
          diagnostic.startsWith("CI_ARTIFACT_FORBIDDEN_KEY"),
      ),
      `${artifactName} must reject additional user-content metadata`,
    );
  }
  const preferredNameInPackage = structuredClone(sbom);
  preferredNameInPackage.packages.push({
    SPDXID: "SPDXRef-Package-synthetic",
    name: "alice",
    versionInfo: "1.0.0",
    downloadLocation: "NOASSERTION",
    filesAnalyzed: false,
    licenseConcluded: "NOASSERTION",
    licenseDeclared: "NOASSERTION",
    copyrightText: "NOASSERTION",
  });
  assert.ok(
    findArtifactDiagnostics(preferredNameInPackage, artifactPolicy, {
      artifactName: "sbom.spdx.json",
      lockfilePackageCoordinates,
    }).some((diagnostic) =>
      diagnostic.startsWith("CI_ARTIFACT_SPDX_PACKAGE_NOT_IN_LOCKFILE"),
    ),
  );
  assert.deepEqual(
    validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    { packages: 1 },
  );
  provenance.signature_status = "SIGNED";
  assert.throws(
    () => validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    /CI_PROVENANCE_INVALID/u,
  );
  provenance.signature_status = "UNSIGNED";
  provenance.subject[0].digest.sha256 = "d".repeat(64);
  assert.throws(
    () => validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    /CI_PROVENANCE_INVALID/u,
  );
  provenance.subject[0].digest.sha256 = sha256(
    `${JSON.stringify(digestManifest, null, 2)}\n`,
  );
  provenance.predicate.buildDefinition.externalParameters.head_sha = "f".repeat(
    40,
  );
  assert.throws(
    () => validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    /CI_PROVENANCE_INVALID/u,
  );
  provenance.predicate.buildDefinition.externalParameters.head_sha =
    digestManifest.head_sha;
  sbom.packages[0].externalRefs[0].referenceLocator = "e".repeat(64);
  assert.throws(
    () => validateSupplyChainDocuments({ digestManifest, provenance, sbom }),
    /CI_SUPPLY_CHAIN_BINDING_MISMATCH/u,
  );
});
