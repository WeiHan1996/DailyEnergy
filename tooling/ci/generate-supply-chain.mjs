#!/usr/bin/env node
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { collectBuildOutputFiles } from "./build-output.mjs";
import {
  sha256,
  validateLicenseInventory,
  validateSupplyChainDocuments,
} from "./policy.mjs";
import { repositoryRoot, runBounded } from "./runtime.mjs";

const outputDirectory = path.resolve(
  repositoryRoot,
  ".artifacts/ci/supply-chain",
);
const buildRoots = [
  "apps/admin/.next",
  "apps/api/dist",
  "apps/miniapp/dist",
  "apps/worker/dist",
  "packages/api-client/dist",
  "packages/server-adapters/dist",
  "packages/server-core/dist",
  "packages/shared-schemas/dist",
];

async function collectBuildFiles() {
  const files = await collectBuildOutputFiles(repositoryRoot, buildRoots);
  if (files.length === 0) {
    throw new Error("CI_BUILD_OUTPUT_MISSING:run-pnpm-build-first");
  }
  return files;
}

function spdxId(name, version) {
  const suffix = createHash("sha256")
    .update(`${name}@${version}`)
    .digest("hex")
    .slice(0, 12);
  return `SPDXRef-Package-${suffix}`;
}

function normalizeLicense(expression) {
  return expression === "Apache 2.0"
    ? "Apache-2.0"
    : expression === "MIT and ISC"
      ? "MIT AND ISC"
      : expression;
}

await mkdir(outputDirectory, { recursive: true, mode: 0o700 });
const [
  lockfile,
  buildFiles,
  licensePolicy,
  licenseExecution,
  gitExecution,
  baseExecution,
  branchExecution,
] = await Promise.all([
  readFile(path.resolve(repositoryRoot, "pnpm-lock.yaml")),
  collectBuildFiles(),
  readFile(
    path.resolve(repositoryRoot, "tests/ci/license-policy.json"),
    "utf8",
  ).then(JSON.parse),
  runBounded("pnpm", ["licenses", "list", "--json"], {
    maximumBytes: 16 * 1024 * 1024,
  }),
  runBounded("git", ["rev-parse", "HEAD"]),
  runBounded("git", ["merge-base", "HEAD", "origin/main"]),
  runBounded("git", ["branch", "--show-current"]),
]);
if (licenseExecution.code !== 0) {
  throw new Error("CI_LICENSE_INVENTORY_COMMAND_FAILED:pnpm");
}
let licenseInventory;
try {
  licenseInventory = JSON.parse(licenseExecution.stdout);
} catch {
  throw new Error("CI_LICENSE_INVENTORY_INVALID:pnpm-json");
}
const packages = validateLicenseInventory(licenseInventory, licensePolicy);
const lockfileSha256 = sha256(lockfile);
const localSha = gitExecution.stdout.trim();
const testedSha =
  process.env.CI_TESTED_SHA || process.env.GITHUB_SHA || localSha;
const headSha = process.env.CI_HEAD_SHA || testedSha;
const baseSha = process.env.CI_BASE_SHA || baseExecution.stdout.trim();
const branch =
  process.env.CI_BRANCH ||
  process.env.GITHUB_HEAD_REF ||
  process.env.GITHUB_REF_NAME ||
  branchExecution.stdout.trim() ||
  "detached";
const eventName =
  process.env.CI_EVENT_NAME ?? process.env.GITHUB_EVENT_NAME ?? "local";
const pullRequestText = process.env.CI_PULL_REQUEST_NUMBER ?? "";
const pullRequest = pullRequestText === "" ? null : Number(pullRequestText);
if (
  ![localSha, testedSha, headSha, baseSha].every((value) =>
    /^[a-f0-9]{40}$/u.test(value),
  ) ||
  testedSha !== localSha
) {
  throw new Error("CI_PROVENANCE_GIT_BINDING_INVALID:git");
}

const entries = [];
for (const filePath of buildFiles) {
  // In-repository links contribute their resolved file bytes under the logical
  // build path; machine-specific absolute link targets never enter evidence.
  entries.push({
    path: path.relative(repositoryRoot, filePath).replaceAll("\\", "/"),
    sha256: sha256(await readFile(filePath)),
  });
}
const digestManifest = {
  manifest_version: "e-011-build-digest-v2",
  head_sha: headSha,
  base_sha: baseSha,
  tested_sha: testedSha,
  lockfile_sha256: lockfileSha256,
  entries,
};
const digestManifestContents = `${JSON.stringify(digestManifest, null, 2)}\n`;

const createdAt = new Date().toISOString();
const rootSpdxId = "SPDXRef-DailyEnergy";
const sbomPackages = packages.map((entry) => ({
  SPDXID: spdxId(entry.name, entry.version),
  name: entry.name,
  versionInfo: entry.version,
  downloadLocation: "NOASSERTION",
  filesAnalyzed: false,
  licenseConcluded: normalizeLicense(entry.license),
  licenseDeclared: normalizeLicense(entry.license),
  copyrightText: "NOASSERTION",
}));
const sbom = {
  spdxVersion: "SPDX-2.3",
  dataLicense: "CC0-1.0",
  SPDXID: "SPDXRef-DOCUMENT",
  name: `dailyenergy-${headSha.slice(0, 12)}`,
  documentNamespace: `https://dailyenergy.invalid/spdx/${headSha}/${testedSha}/${lockfileSha256}`,
  creationInfo: {
    created: createdAt,
    creators: ["Tool: DailyEnergy-E011-SBOM-v1"],
  },
  packages: [
    {
      SPDXID: rootSpdxId,
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
          referenceLocator: lockfileSha256,
        },
      ],
    },
    ...sbomPackages,
  ],
  relationships: sbomPackages.map((entry) => ({
    spdxElementId: rootSpdxId,
    relationshipType: "DEPENDS_ON",
    relatedSpdxElement: entry.SPDXID,
  })),
};

const provenance = {
  _type: "https://in-toto.io/Statement/v1",
  subject: [
    {
      name: "build-output-digests.json",
      digest: { sha256: sha256(digestManifestContents) },
    },
  ],
  predicateType: "https://slsa.dev/provenance/v1",
  predicate: {
    buildDefinition: {
      buildType: "https://dailyenergy.invalid/build-types/pnpm-turbo/v1",
      externalParameters: {
        head_sha: headSha,
        base_sha: baseSha,
        tested_sha: testedSha,
        branch,
        event_name: eventName,
        pull_request: pullRequest,
        lockfile_sha256: lockfileSha256,
        workflow: ".github/workflows/ci.yml",
      },
      internalParameters: {
        node_version: process.versions.node,
        pnpm_version: "11.17.0",
        runner: process.env.RUNNER_OS ? "ubuntu-24.04" : "local-untrusted",
      },
      resolvedDependencies: [
        {
          uri: "git+https://github.com/WeiHan1996/DailyEnergy",
          digest: { gitCommit: testedSha },
        },
        {
          uri: "file:pnpm-lock.yaml",
          digest: { sha256: lockfileSha256 },
        },
      ],
    },
    runDetails: {
      builder: { id: "https://github.com/WeiHan1996/DailyEnergy/actions" },
      metadata: {
        invocationId: process.env.GITHUB_RUN_ID ?? "local-untrusted",
        startedOn: createdAt,
        finishedOn: new Date().toISOString(),
      },
      byproducts: [],
    },
  },
  attestation_status:
    "PENDING_REPOSITORY_CAPABILITY_AND_EXPLICIT_RELEASE_AUTHORIZATION",
  signature_status: "UNSIGNED",
  promotion_status: "PROHIBITED_UNTIL_ATTESTED_AND_RELEASE_GATES_PASS",
};
validateSupplyChainDocuments({ digestManifest, provenance, sbom });

await Promise.all([
  writeFile(
    path.resolve(outputDirectory, "build-output-digests.json"),
    digestManifestContents,
    { encoding: "utf8", mode: 0o600 },
  ),
  writeFile(
    path.resolve(outputDirectory, "sbom.spdx.json"),
    `${JSON.stringify(sbom, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  ),
  writeFile(
    path.resolve(outputDirectory, "provenance.intoto.json"),
    `${JSON.stringify(provenance, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 },
  ),
]);
console.log(
  `CI_SUPPLY_CHAIN_OK:build_files=${entries.length}:packages=${packages.length}:attestation=PENDING:signature=UNSIGNED`,
);
