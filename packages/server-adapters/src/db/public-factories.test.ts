import { describe, expect, it } from "vitest";

import { createApiRestrictedDatabaseFactory } from "../api-restricted/index.js";
import { createApiDatabaseFactory } from "../api/index.js";
import { createMigrationDatabaseFactory } from "../migration/index.js";
import { createTestingDatabaseFactory } from "../testing/index.js";
import { createWorkerBackgroundDatabaseFactory } from "../worker-background/index.js";
import { createWorkerInteractiveDatabaseFactory } from "../worker-interactive/index.js";
import { createWorkerRestrictedDatabaseFactory } from "../worker-restricted/index.js";

describe("role-specific public database factories", () => {
  it("exposes only fixed profile factories", () => {
    expect(createApiDatabaseFactory().profile).toBe("api");
    expect(createApiRestrictedDatabaseFactory().profile).toBe("api-restricted");
    expect(createWorkerInteractiveDatabaseFactory().profile).toBe(
      "worker-interactive",
    );
    expect(createWorkerBackgroundDatabaseFactory().profile).toBe(
      "worker-background",
    );
    expect(createWorkerRestrictedDatabaseFactory().profile).toBe(
      "worker-restricted",
    );
    expect(createMigrationDatabaseFactory().profile).toBe("migration");
    expect(createTestingDatabaseFactory().profile).toBe("testing");
  });
});
