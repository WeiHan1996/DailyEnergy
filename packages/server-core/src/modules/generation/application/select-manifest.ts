import type { GenerationManifestStore } from "../spi/index.js";
import { DeterministicGenerationError } from "../domain/deterministic-error.js";
import {
  verifyGenerationManifestRecord,
  type FrozenGenerationManifest,
} from "../domain/manifest.js";

export async function selectFrozenGenerationManifest(
  store: GenerationManifestStore,
  input: {
    readonly acceptedAt: Date;
    readonly existing?: {
      readonly fingerprintHex: string;
      readonly manifestRef: string;
      readonly resultVersion: string;
    };
  },
): Promise<FrozenGenerationManifest> {
  const record =
    input.existing === undefined
      ? await store.selectActive(input.acceptedAt)
      : await store.findByVersion(input.existing.resultVersion);
  if (record === undefined) {
    throw new DeterministicGenerationError("MANIFEST_NOT_FOUND");
  }
  const frozen = verifyGenerationManifestRecord(record);
  if (
    input.existing !== undefined &&
    (frozen.resultVersion !== input.existing.resultVersion ||
      frozen.manifestRef !== input.existing.manifestRef ||
      frozen.fingerprintHex !== input.existing.fingerprintHex)
  ) {
    throw new DeterministicGenerationError("MANIFEST_FINGERPRINT_MISMATCH");
  }
  return frozen;
}
