#!/usr/bin/env node
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { format } from "prettier";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const sourceSetsPath = path.resolve(
  repositoryRoot,
  "tests/registry/source-sets.json",
);
const registryPath = path.resolve(
  repositoryRoot,
  "tests/registry/coverage-registry.json",
);

const allowedStatuses = new Set(["PLANNED", "COVERED", "NA_WITH_REASON"]);
const allowedLevels = new Set([
  "STATIC",
  "UNIT",
  "MODULE",
  "DB",
  "CONTRACT",
  "INTEGRATION",
  "E2E",
  "RESILIENCE",
  "AI_EVAL",
  "MANUAL_RC",
]);

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim() !== "";
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

async function readJson(filePath, ruleId) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    fail(ruleId, path.relative(repositoryRoot, filePath));
  }
}

function requirementsFor(sourceSet, sourceId) {
  const override = (sourceSet.requirement_overrides ?? []).find(({ pattern }) =>
    new RegExp(pattern, "u").test(sourceId),
  );
  return override?.requirements ?? sourceSet.requirements;
}

function validateRequirements(requirements, detail) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    fail("SOURCE_REGISTRY_REQUIREMENT_MISSING", detail);
  }
  for (const requirement of requirements) {
    if (
      !Array.isArray(requirement?.any_of) ||
      requirement.any_of.length === 0 ||
      requirement.any_of.some((level) => !allowedLevels.has(level))
    ) {
      fail("SOURCE_REGISTRY_REQUIREMENT_INVALID", detail);
    }
  }
}

function mergeRequirements(left, right) {
  const merged = new Map();
  for (const requirement of [...left, ...right]) {
    const normalized = uniqueSorted(requirement.any_of);
    merged.set(normalized.join("|"), { any_of: normalized });
  }
  return [...merged.values()].sort((a, b) =>
    a.any_of.join("|").localeCompare(b.any_of.join("|")),
  );
}

async function extractSourceIds(sourceSet) {
  const authorityPath = path.resolve(repositoryRoot, sourceSet.authority_path);
  const content = await readFile(authorityPath, "utf8");
  let sourceIds;

  if (sourceSet.extractor?.kind === "text-regex") {
    if (
      sourceSet.accepted_marker &&
      !new RegExp(sourceSet.accepted_marker, "u").test(content)
    ) {
      fail("SOURCE_REGISTRY_AUTHORITY_NOT_ACCEPTED", sourceSet.set_id);
    }
    sourceIds = uniqueSorted(
      content.match(new RegExp(sourceSet.extractor.pattern, "gu")) ?? [],
    );
  } else if (sourceSet.extractor?.kind === "json-cases") {
    const document = JSON.parse(content);
    if (document.status !== sourceSet.accepted_json_status) {
      fail("SOURCE_REGISTRY_AUTHORITY_NOT_ACCEPTED", sourceSet.set_id);
    }
    if (!Array.isArray(document.cases)) {
      fail("SOURCE_REGISTRY_SOURCE_INVALID", sourceSet.set_id);
    }
    const matchingCases = sourceSet.extractor.source_task
      ? document.cases.filter(
          ({ source_task: sourceTask }) =>
            sourceTask === sourceSet.extractor.source_task,
        )
      : document.cases;
    sourceIds = uniqueSorted(matchingCases.map(({ id }) => id));
    if (sourceIds.length !== matchingCases.length) {
      fail("SOURCE_REGISTRY_SOURCE_DUPLICATE", sourceSet.set_id);
    }
  } else {
    fail("SOURCE_REGISTRY_EXTRACTOR_INVALID", sourceSet.set_id);
  }

  if (sourceIds.length !== sourceSet.expected_count) {
    fail(
      "SOURCE_REGISTRY_SOURCE_COUNT",
      `${sourceSet.set_id}:${sourceIds.length}/${sourceSet.expected_count}`,
    );
  }
  validateRequirements(sourceSet.requirements, sourceSet.set_id);
  for (const override of sourceSet.requirement_overrides ?? []) {
    validateRequirements(
      override.requirements,
      `${sourceSet.set_id}:${override.pattern}`,
    );
  }
  if (!isNonEmpty(sourceSet.planned_owner)) {
    fail("SOURCE_REGISTRY_PLANNED_OWNER", sourceSet.set_id);
  }
  return sourceIds;
}

export async function discoverExpectedSources(configuration) {
  if (!Array.isArray(configuration?.source_sets)) {
    fail("SOURCE_REGISTRY_SOURCE_SETS", "missing");
  }
  const expected = new Map();
  const sourceSetIds = new Set();

  for (const sourceSet of configuration.source_sets) {
    if (!isNonEmpty(sourceSet.set_id) || sourceSetIds.has(sourceSet.set_id)) {
      fail(
        "SOURCE_REGISTRY_SOURCE_SET_DUPLICATE",
        sourceSet?.set_id ?? "missing",
      );
    }
    sourceSetIds.add(sourceSet.set_id);
    for (const sourceId of await extractSourceIds(sourceSet)) {
      if (!isNonEmpty(sourceId)) {
        fail("SOURCE_REGISTRY_SOURCE_ID", sourceSet.set_id);
      }
      const current = expected.get(sourceId) ?? {
        authority_paths: [],
        planned_owners: [],
        requirements: [],
        source_sets: [],
      };
      current.authority_paths = uniqueSorted([
        ...current.authority_paths,
        sourceSet.authority_path,
        ...(sourceSet.semantic_authority_paths ?? []),
      ]);
      current.planned_owners = uniqueSorted([
        ...current.planned_owners,
        sourceSet.planned_owner,
      ]);
      current.requirements = mergeRequirements(
        current.requirements,
        requirementsFor(sourceSet, sourceId),
      );
      current.source_sets = uniqueSorted([
        ...current.source_sets,
        sourceSet.set_id,
      ]);
      expected.set(sourceId, current);
    }
  }
  return expected;
}

function normalizeEvidence(evidence, origin, sourceId) {
  if (
    !isNonEmpty(evidence?.test_id) ||
    !isNonEmpty(evidence?.file) ||
    !isNonEmpty(evidence?.selector) ||
    !allowedLevels.has(evidence?.level)
  ) {
    fail("SOURCE_REGISTRY_EVIDENCE_INVALID", `${origin}:${sourceId}`);
  }
  if (
    !Array.isArray(evidence?.assertions) ||
    evidence.assertions.length === 0 ||
    evidence.assertions.some((assertion) => !isNonEmpty(assertion))
  ) {
    fail("SOURCE_REGISTRY_MISSING_ASSERTION", sourceId);
  }
  return {
    assertions: uniqueSorted(evidence.assertions),
    file: evidence.file,
    level: evidence.level,
    origin,
    selector: evidence.selector,
    test_id: evidence.test_id,
  };
}

function collectInlineEvidence(manifest, manifestPath) {
  const evidence = new Map();
  for (const entry of manifest.entries ?? []) {
    if (entry.status !== "COVERED") {
      continue;
    }
    if (evidence.has(entry.source_id)) {
      fail(
        "SOURCE_REGISTRY_EVIDENCE_DUPLICATE",
        `${manifestPath}:${entry.source_id}`,
      );
    }
    evidence.set(
      entry.source_id,
      (entry.evidence ?? []).map((proof) =>
        normalizeEvidence(proof, manifestPath, entry.source_id),
      ),
    );
  }
  return evidence;
}

function collectProofMapEvidence(manifest, manifestPath) {
  const evidence = new Map();
  for (const entry of manifest.entries ?? []) {
    if (entry.status !== "COVERED") {
      continue;
    }
    if (evidence.has(entry.source_id)) {
      fail(
        "SOURCE_REGISTRY_EVIDENCE_DUPLICATE",
        `${manifestPath}:${entry.source_id}`,
      );
    }
    if (!Array.isArray(entry.proof_ids) || entry.proof_ids.length === 0) {
      fail(
        "SOURCE_REGISTRY_EVIDENCE_MISSING",
        `${manifestPath}:${entry.source_id}`,
      );
    }
    evidence.set(
      entry.source_id,
      entry.proof_ids.map((proofId) => {
        const proof = manifest.proofs?.[proofId];
        if (!proof) {
          fail(
            "SOURCE_REGISTRY_EVIDENCE_UNKNOWN",
            `${manifestPath}:${entry.source_id}:${proofId}`,
          );
        }
        return normalizeEvidence(
          { ...proof, test_id: proofId },
          manifestPath,
          entry.source_id,
        );
      }),
    );
  }
  return evidence;
}

async function collectEvidence(configuration, expected) {
  const evidenceBySource = new Map();

  for (const descriptor of configuration.evidence_manifests ?? []) {
    const manifest = await readJson(
      path.resolve(repositoryRoot, descriptor.path),
      "SOURCE_REGISTRY_EVIDENCE_READ",
    );
    const collected =
      descriptor.kind === "inline-evidence"
        ? collectInlineEvidence(manifest, descriptor.path)
        : descriptor.kind === "proof-map"
          ? collectProofMapEvidence(manifest, descriptor.path)
          : fail("SOURCE_REGISTRY_EVIDENCE_KIND", descriptor.kind ?? "missing");
    for (const [sourceId, evidence] of collected) {
      if (!expected.has(sourceId)) {
        fail("SOURCE_REGISTRY_EVIDENCE_UNKNOWN_SOURCE", sourceId);
      }
      evidenceBySource.set(sourceId, [
        ...(evidenceBySource.get(sourceId) ?? []),
        ...evidence,
      ]);
    }
  }

  for (const automatic of configuration.automatic_evidence ?? []) {
    const matchingSources = [...expected].filter(([, metadata]) =>
      metadata.source_sets.includes(automatic.source_set),
    );
    if (matchingSources.length === 0) {
      fail("SOURCE_REGISTRY_AUTOMATIC_SET_EMPTY", automatic.source_set);
    }
    for (const [sourceId] of matchingSources) {
      const proof = normalizeEvidence(
        {
          assertions: [
            automatic.assertion_template.replaceAll("{source_id}", sourceId),
          ],
          file: automatic.file,
          level: automatic.level,
          selector: automatic.selector,
          test_id: automatic.test_id,
        },
        "tests/registry/source-sets.json",
        sourceId,
      );
      evidenceBySource.set(sourceId, [
        ...(evidenceBySource.get(sourceId) ?? []),
        proof,
      ]);
    }
  }
  return evidenceBySource;
}

function evidenceSatisfiesRequirements(evidence, requirements) {
  const levels = new Set(evidence.map(({ level }) => level));
  return requirements.every(({ any_of: choices }) =>
    choices.some((choice) => levels.has(choice)),
  );
}

function evidenceKey(evidence) {
  return [
    evidence.origin,
    evidence.test_id,
    evidence.level,
    evidence.file,
    evidence.selector,
  ].join(":");
}

export function validateCoverageRegistry(registry, expected) {
  if (registry?.registry_version !== "e-010-source-registry-v1") {
    fail("SOURCE_REGISTRY_VERSION", registry?.registry_version ?? "missing");
  }
  if (!Array.isArray(registry.entries)) {
    fail("SOURCE_REGISTRY_ENTRIES", "missing");
  }
  const entries = new Map();
  for (const entry of registry.entries) {
    if (!isNonEmpty(entry?.source_id)) {
      fail("SOURCE_REGISTRY_SOURCE_ID", "missing");
    }
    if (entries.has(entry.source_id)) {
      fail("SOURCE_REGISTRY_DUPLICATE", entry.source_id);
    }
    if (!allowedStatuses.has(entry.status)) {
      fail("SOURCE_REGISTRY_STATUS", `${entry.source_id}:${entry.status}`);
    }
    const expectedMetadata = expected.get(entry.source_id);
    if (!expectedMetadata) {
      fail("SOURCE_REGISTRY_UNKNOWN_SOURCE", entry.source_id);
    }
    if (
      JSON.stringify(entry.source_sets) !==
        JSON.stringify(expectedMetadata.source_sets) ||
      JSON.stringify(entry.authority_paths) !==
        JSON.stringify(expectedMetadata.authority_paths) ||
      JSON.stringify(entry.required_evidence) !==
        JSON.stringify(expectedMetadata.requirements)
    ) {
      fail("SOURCE_REGISTRY_SOURCE_METADATA", entry.source_id);
    }

    if (entry.status === "COVERED") {
      if (!Array.isArray(entry.evidence) || entry.evidence.length === 0) {
        fail("SOURCE_REGISTRY_MISSING_ASSERTION", entry.source_id);
      }
      const keys = new Set();
      for (const evidence of entry.evidence) {
        normalizeEvidence(evidence, evidence.origin, entry.source_id);
        const key = evidenceKey(evidence);
        if (keys.has(key)) {
          fail(
            "SOURCE_REGISTRY_EVIDENCE_DUPLICATE",
            `${entry.source_id}:${key}`,
          );
        }
        keys.add(key);
      }
      if (
        !evidenceSatisfiesRequirements(entry.evidence, entry.required_evidence)
      ) {
        fail("SOURCE_REGISTRY_LEVEL_INSUFFICIENT", entry.source_id);
      }
      if (entry.planned !== undefined || entry.na !== undefined) {
        fail("SOURCE_REGISTRY_STATUS_CONFLICT", entry.source_id);
      }
    } else if (entry.status === "PLANNED") {
      if (
        entry.evidence !== undefined ||
        !isNonEmpty(entry.planned?.owner) ||
        !isNonEmpty(entry.planned?.reason)
      ) {
        fail("SOURCE_REGISTRY_PLANNED_INVALID", entry.source_id);
      }
    } else {
      if (
        entry.evidence !== undefined ||
        !isNonEmpty(entry.na?.reason) ||
        !isNonEmpty(entry.na?.approved_by) ||
        !/^\d{4}-\d{2}-\d{2}$/u.test(entry.na?.approved_on ?? "")
      ) {
        fail("SOURCE_REGISTRY_NA_APPROVAL", entry.source_id);
      }
    }
    entries.set(entry.source_id, entry);
  }

  for (const sourceId of expected.keys()) {
    if (!entries.has(sourceId)) {
      fail("SOURCE_REGISTRY_UNMAPPED", sourceId);
    }
  }
  if (entries.size !== expected.size) {
    fail("SOURCE_REGISTRY_COUNT", `${entries.size}/${expected.size}`);
  }
  const actualCounts = { COVERED: 0, NA_WITH_REASON: 0, PLANNED: 0 };
  for (const entry of entries.values()) {
    actualCounts[entry.status] += 1;
  }
  if (JSON.stringify(registry.counts) !== JSON.stringify(actualCounts)) {
    fail("SOURCE_REGISTRY_COUNT_METADATA", JSON.stringify(actualCounts));
  }
  return Object.freeze({ counts: actualCounts, total: entries.size });
}

export async function buildCoverageRegistry(configuration) {
  const expected = await discoverExpectedSources(configuration);
  const evidenceBySource = await collectEvidence(configuration, expected);
  const entries = [];

  for (const [sourceId, metadata] of [...expected].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const evidence = (evidenceBySource.get(sourceId) ?? []).sort(
      (left, right) => evidenceKey(left).localeCompare(evidenceKey(right)),
    );
    const covered =
      evidence.length > 0 &&
      evidenceSatisfiesRequirements(evidence, metadata.requirements);
    entries.push({
      authority_paths: metadata.authority_paths,
      ...(covered
        ? { evidence, status: "COVERED" }
        : {
            planned: {
              owner: metadata.planned_owners.join("; "),
              reason:
                evidence.length === 0
                  ? "No executable evidence is registered at the mandatory layer yet."
                  : "Existing evidence does not satisfy every mandatory evidence layer.",
            },
            status: "PLANNED",
          }),
      required_evidence: metadata.requirements,
      source_id: sourceId,
      source_sets: metadata.source_sets,
    });
  }
  const counts = { COVERED: 0, NA_WITH_REASON: 0, PLANNED: 0 };
  for (const entry of entries) {
    counts[entry.status] += 1;
  }
  const registry = {
    registry_version: configuration.registry_version,
    generated_from: "tests/registry/source-sets.json",
    counts,
    entries,
  };
  validateCoverageRegistry(registry, expected);
  return registry;
}

export async function loadRegistryConfiguration() {
  return readJson(sourceSetsPath, "SOURCE_REGISTRY_CONFIG_READ");
}

export async function loadCoverageRegistryDocument() {
  return readJson(registryPath, "SOURCE_REGISTRY_READ");
}

export async function loadAndValidateCoverageRegistry() {
  const configuration = await loadRegistryConfiguration();
  const expected = await discoverExpectedSources(configuration);
  const registry = await readJson(registryPath, "SOURCE_REGISTRY_READ");
  const result = validateCoverageRegistry(registry, expected);
  await Promise.all(
    registry.entries
      .flatMap((entry) => entry.evidence ?? [])
      .map((evidence) => access(path.resolve(repositoryRoot, evidence.file))),
  );
  return result;
}

async function serialize(registry) {
  return format(JSON.stringify(registry), { parser: "json" });
}

async function main() {
  const option = process.argv[2] ?? "--check";
  const configuration = await loadRegistryConfiguration();
  const built = await buildCoverageRegistry(configuration);
  const expectedContent = await serialize(built);

  if (option === "--write") {
    await writeFile(registryPath, expectedContent, "utf8");
  } else if (option === "--check") {
    let actualContent;
    try {
      actualContent = await readFile(registryPath, "utf8");
    } catch {
      fail(
        "SOURCE_REGISTRY_GENERATED_MISSING",
        "tests/registry/coverage-registry.json",
      );
    }
    if (actualContent !== expectedContent) {
      fail("SOURCE_REGISTRY_GENERATED_DRIFT", "run pnpm registry:write");
    }
  } else {
    fail("SOURCE_REGISTRY_ARGUMENT", option);
  }

  const result = await loadAndValidateCoverageRegistry();
  console.log(
    `SOURCE_REGISTRY_OK:total=${result.total}:covered=${result.counts.COVERED}:planned=${result.counts.PLANNED}:na_with_reason=${result.counts.NA_WITH_REASON}`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
