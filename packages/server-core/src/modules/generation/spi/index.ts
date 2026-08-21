import type { GenerationManifestRecord } from "../domain/manifest.js";

export interface GenerationManifestStore {
  close(): Promise<void>;
  findByVersion(
    resultVersion: string,
  ): Promise<GenerationManifestRecord | undefined>;
  selectActive(acceptedAt: Date): Promise<GenerationManifestRecord | undefined>;
}
