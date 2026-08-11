import { apiDeployConfigFingerprint } from "../../tooling/deployment/runtime-evidence.mjs";

const SHA = "a".repeat(64);

export function releaseManifestFixture(releaseId, options = {}) {
  const generation = options.generation ?? 1;
  const acceptedGenerations = options.acceptedGenerations ?? [generation];
  const value = {
    manifest_version: "ReleaseManifestV1",
    release_id: releaseId,
    source: {
      repository: "WeiHan1996/DailyEnergy",
      commit_sha: (options.commit ?? "b").repeat(40),
      lockfile_sha256: "c".repeat(64),
      ci_run_id: options.runId ?? "30892281313",
      ci_run_attempt: 1,
    },
    images: {
      admin: `ghcr.io/weihan1996/dailyenergy-admin@sha256:${"1".repeat(64)}`,
      migration: `ghcr.io/weihan1996/dailyenergy-migration@sha256:${"2".repeat(64)}`,
      proxy: `ghcr.io/weihan1996/dailyenergy-proxy@sha256:${"3".repeat(64)}`,
      server: `ghcr.io/weihan1996/dailyenergy-server@sha256:${"4".repeat(64)}`,
      stub: `ghcr.io/weihan1996/dailyenergy-stub@sha256:${"5".repeat(64)}`,
    },
    supply_chain: {
      gate_ref: `github-actions:run:${options.runId ?? "30892281313"}:attempt:1`,
      image_set_sha256: options.imageSetFingerprint ?? "8".repeat(64),
      provenance_sha256: "5".repeat(64),
      sbom_sha256: "6".repeat(64),
    },
    migrations: {
      catalog_fingerprint: "7".repeat(64),
      catalog_generation: options.catalogGeneration ?? generation,
      destructive: false,
      migration_head: "20260730000000_initial_application_schema",
      rollback_compatible_release_ids:
        options.rollbackCompatibleReleaseIds ?? [],
    },
    config: {
      config_schema_version: "api-runtime-config-v1",
      contract_bundle_version: "api-contract-v1",
      environment: "DEV",
      log_level: "INFO",
      product_date_policy_version: "product-date-v1",
      runtime_fingerprints: {
        api_capability: SHA,
        api_deploy_config: apiDeployConfigFingerprint(releaseId),
        object_config: options.objectConfigFingerprint ?? "f".repeat(64),
        worker_background: "c".repeat(64),
        worker_interactive: "d".repeat(64),
        worker_restricted: "e".repeat(64),
      },
      secret_ref_versions: {
        cos_secret_id: "dev-cos-credential-v1",
        cos_secret_key: "dev-cos-credential-v1",
        database_admin_url: "dev-secret-v1",
        database_api_url: "dev-secret-v1",
        database_background_url: "dev-secret-v1",
        database_interactive_url: "dev-secret-v1",
        database_migration_url: "dev-secret-v1",
        database_restricted_url: "dev-secret-v1",
        fault_control_token: "dev-secret-v1",
        postgres_password: "dev-secret-v1",
      },
    },
    topology: {
      object_config_ref: "dev-cos-config-v1",
      object_endpoint: "TENCENT_COS_PRIVATE_INTERNAL",
      object_prefix: "dev/objects/",
      object_region: "ap-shanghai",
      production_enabled: false,
      public_ingress: "LOOPBACK_TLS_UNTIL_ICP",
      stateful_topology: "DEV_COLOCATED_EXCEPTION",
    },
    compatibility: {
      accepted_generations: acceptedGenerations,
      generation,
      manifest_versions: ["ReleaseManifestV1"],
    },
    evidence: {
      required_gates: [
        "ci-full",
        "deletion",
        "migration",
        "owner",
        "safety",
        "synthetic-smoke",
      ],
      source_ids: ["S31-TEST-047", "S32-DEPLOY-010"],
      synthetic_only: true,
    },
  };
  options.mutate?.(value);
  return value;
}
