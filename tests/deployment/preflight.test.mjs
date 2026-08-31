import assert from "node:assert/strict";
import test from "node:test";

import {
  createCosConfigEvidence,
  validateDevelopmentPreflightEvidence,
} from "../../tooling/deployment/preflight.mjs";
import { devImageSetDigest } from "../../tooling/deployment/image-set.mjs";
import { devRuntimeEvidenceDigest } from "../../tooling/deployment/runtime-evidence.mjs";
import { validateReleaseManifest } from "../../tooling/deployment/release-contract.mjs";
import { releaseManifestFixture } from "./release-fixture.mjs";

const COS_CONFIG = [
  "COS_BUCKET=dailyenergy-dev-1250000000",
  "COS_ENDPOINT=dailyenergy-dev-1250000000.cos-internal.ap-shanghai.tencentcos.cn",
  "COS_PREFIX=dev/objects/",
  "COS_REGION=ap-shanghai",
  "",
].join("\n");

function evidence(options = {}) {
  const config = createCosConfigEvidence(COS_CONFIG);
  const releaseId = `dev-${"b".repeat(12)}-50000000001-1`;
  const manifest = releaseManifestFixture(releaseId, {
    objectConfigFingerprint: config.config_sha256,
  });
  options.mutateManifest?.(manifest);
  const runtimeEvidence = {
    evidence_version: "DevRuntimeEvidenceV1",
    fingerprints: {
      api_capability: manifest.config.runtime_fingerprints.api_capability,
      api_deploy_config: manifest.config.runtime_fingerprints.api_deploy_config,
      worker_background: manifest.config.runtime_fingerprints.worker_background,
      worker_interactive:
        manifest.config.runtime_fingerprints.worker_interactive,
      worker_restricted: manifest.config.runtime_fingerprints.worker_restricted,
    },
    release_id: manifest.release_id,
    server_image: manifest.images.server,
    tzdb_release: "2026b",
  };
  const imageSet = {
    created_at_utc: "2026-08-05T02:03:04.000Z",
    evidence: {
      build_platform: "linux/amd64",
      catalog_fingerprint: manifest.migrations.catalog_fingerprint,
      ci_provenance_sha256: manifest.supply_chain.provenance_sha256,
      ci_sbom_sha256: manifest.supply_chain.sbom_sha256,
      lockfile_sha256: manifest.source.lockfile_sha256,
      migration_head: manifest.migrations.migration_head,
      production_eligible: false,
      provenance_status: "BUILDKIT_MAX_UNSIGNED_DEV_ONLY",
      runtime_evidence_sha256: devRuntimeEvidenceDigest(runtimeEvidence),
      sbom_status: "BUILDKIT_ATTACHED",
    },
    image_set_id: `dev-${manifest.source.commit_sha.slice(0, 12)}-50000000001-1`,
    image_set_version: "DevImageSetV1",
    images: Object.fromEntries(
      Object.entries(manifest.images).map(([role, reference]) => [
        role,
        {
          digest: reference.slice(reference.indexOf("@") + 1),
          reference,
          target:
            role === "proxy"
              ? "e012-proxy"
              : role === "server"
                ? "e009-server"
                : `e009-${role}`,
        },
      ]),
    ),
    source: {
      ci_run_attempt: manifest.source.ci_run_attempt,
      ci_run_id: manifest.source.ci_run_id,
      commit_sha: manifest.source.commit_sha,
      publication_run_attempt: 1,
      publication_run_id: "50000000001",
      repository: manifest.source.repository,
    },
  };
  manifest.supply_chain.image_set_sha256 = devImageSetDigest(imageSet);
  const secretRoles = Object.keys(manifest.config.secret_ref_versions);
  const value = {
    files: {
      config: {
        ...config,
        protection: "ROOT_0600_REGULAR",
        role: "object_config",
      },
      directories: [
        "root",
        "config",
        "secrets",
        ...[...new Set(Object.values(manifest.config.secret_ref_versions))].map(
          (version) => `secret-version:${version}`,
        ),
      ].map((role) => ({
        protection: "ROOT_NOT_WRITABLE_BY_OTHERS",
        role,
      })),
      secrets: secretRoles.map((role) => ({
        content_status: "PRESENT_SINGLE_LINE",
        protection: "ROOT_0600_REGULAR",
        role,
      })),
    },
    host: {
      architecture: "x86_64",
      compose_version: "2.40.3",
      cpu_count: 4,
      deployment_node_version: "24.18.0",
      disk_free_bytes: 165 * 1024 ** 3,
      docker_version: "29.1.3",
      non_loopback_protected_ports: [],
      ntp_synchronized: true,
      os_id: "ubuntu",
      os_version: "24.04",
      run_uid: 0,
      timezone: "Asia/Shanghai",
      total_memory_bytes: 7.5 * 1024 ** 3,
    },
    imageSet,
    manifest,
    revokedSecretVersions: [],
    runtimeEvidence,
  };
  options.mutateEvidence?.(value);
  return value;
}

test("T-E012-PREFLIGHT-001 accepts the authorized root-only DEV host evidence", () => {
  assert.deepEqual(validateDevelopmentPreflightEvidence(evidence()), {
    checks: {
      capacity: "PASS",
      cos_config: "PASS",
      host_baseline: "PASS",
      network_exposure: "PASS",
      secret_files: "PASS",
    },
    gate: "E012_DEV_PREFLIGHT",
    release_id: `dev-${"b".repeat(12)}-50000000001-1`,
    status: "PASS",
  });
});

test("T-E012-PREFLIGHT-001 rejects object config drift and unsafe secret files", () => {
  assert.throws(
    () =>
      validateDevelopmentPreflightEvidence(
        evidence({
          mutateEvidence: (value) => {
            value.files.config.config_sha256 = "0".repeat(64);
          },
        }),
      ),
    /PREFLIGHT_COS_CONFIG_DRIFT/u,
  );
  assert.throws(
    () =>
      validateDevelopmentPreflightEvidence(
        evidence({
          mutateEvidence: (value) => {
            value.files.secrets[0].protection = "WORLD_READABLE";
          },
        }),
      ),
    /PREFLIGHT_SECRET_FILE_INVALID/u,
  );
  assert.throws(
    () =>
      validateDevelopmentPreflightEvidence(
        evidence({
          mutateManifest: (manifest) => {
            manifest.config.secret_ref_versions.cos_secret_key =
              "dev-cos-credential-v2";
          },
        }),
      ),
    /PREFLIGHT_COS_SECRET_VERSION_SPLIT/u,
  );
});

test("T-E012-PREFLIGHT-001 fails closed on host drift and public stateful ports", () => {
  for (const mutateEvidence of [
    (value) => {
      value.host.ntp_synchronized = false;
    },
    (value) => {
      value.host.total_memory_bytes = 4 * 1024 ** 3;
    },
    (value) => {
      value.host.docker_version = "28.0.0";
    },
    (value) => {
      value.host.non_loopback_protected_ports = [5432];
    },
  ]) {
    assert.throws(
      () => validateDevelopmentPreflightEvidence(evidence({ mutateEvidence })),
      /PREFLIGHT_/u,
    );
  }
});

test("T-E012-PREFLIGHT-001 validates a closed private COS config without returning values", () => {
  const result = createCosConfigEvidence(COS_CONFIG);
  assert.deepEqual(Object.keys(result).sort(), [
    "config_sha256",
    "endpoint_class",
    "keys",
    "prefix",
    "region",
  ]);
  assert.equal(JSON.stringify(result).includes("1250000000"), false);
  for (const invalid of [
    COS_CONFIG.replace("COS_REGION=ap-shanghai", "COS_REGION=ap-guangzhou"),
    COS_CONFIG.replace("cos-internal", "cos"),
    `${COS_CONFIG}COS_SECRET_KEY=not-a-real-secret\n`,
  ]) {
    assert.throws(() => createCosConfigEvidence(invalid), /PREFLIGHT_COS_/u);
  }
});

test("T-E012-PREFLIGHT-001 rejects path-capable config and secret version refs", () => {
  for (const mutate of [
    (manifest) => {
      manifest.topology.object_config_ref = "../dev-cos-config-v1";
    },
    (manifest) => {
      manifest.config.secret_ref_versions.cos_secret_id = "dev/credential-v1";
    },
  ]) {
    assert.throws(
      () =>
        validateReleaseManifest(
          releaseManifestFixture("e012-path", { mutate }),
        ),
      /RELEASE_MANIFEST_(?:OBJECT_CONFIG_REF|SECRET_REF_VERSION)/u,
    );
  }
});
