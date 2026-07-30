import { describe, expect, it } from "vitest";

import type {
  DatabaseConnection,
  DatabaseFactory,
} from "./internal/contracts.js";
import type { DatabaseCapability } from "./internal/create-closed-database-factory.js";

type ApiDatabaseCapability = DatabaseCapability<"api">;
type ApiRestrictedDatabaseCapability = DatabaseCapability<"api-restricted">;
type InteractiveDatabaseCapability = DatabaseCapability<"worker-interactive">;
type BackgroundDatabaseCapability = DatabaseCapability<"worker-background">;
type RestrictedDatabaseCapability = DatabaseCapability<"worker-restricted">;
type MigrationDatabaseCapability = DatabaseCapability<"migration">;

function assertPublicContractTypes() {
  const apiFactory = undefined as unknown as DatabaseFactory<
    "api",
    ApiDatabaseCapability
  >;
  const apiConnection = undefined as unknown as DatabaseConnection<
    "api",
    ApiDatabaseCapability
  >;
  const restrictedApiFactory = undefined as unknown as DatabaseFactory<
    "api-restricted",
    ApiRestrictedDatabaseCapability
  >;
  const interactiveCapability =
    undefined as unknown as InteractiveDatabaseCapability;
  const backgroundCapability =
    undefined as unknown as BackgroundDatabaseCapability;
  const restrictedCapability =
    undefined as unknown as RestrictedDatabaseCapability;
  const migrationCapability =
    undefined as unknown as MigrationDatabaseCapability;

  apiFactory.profile satisfies "api";
  apiConnection.profile satisfies "api";
  restrictedApiFactory.profile satisfies "api-restricted";
  interactiveCapability.profile satisfies "worker-interactive";
  backgroundCapability.profile satisfies "worker-background";
  restrictedCapability.profile satisfies "worker-restricted";
  migrationCapability.profile satisfies "migration";

  // @ts-expect-error ordinary API has no generated Prisma delegate
  apiConnection.userAccount;
  // @ts-expect-error ordinary API has no unrestricted raw query capability
  apiConnection.$queryRawUnsafe;
  // @ts-expect-error ordinary API capability is not restricted
  apiConnection.capability satisfies ApiRestrictedDatabaseCapability;
  // @ts-expect-error ordinary API factory cannot masquerade as restricted API
  const restrictedFromOrdinary: DatabaseFactory<
    "api-restricted",
    ApiRestrictedDatabaseCapability
  > = apiFactory;

  void restrictedFromOrdinary;
}

void assertPublicContractTypes;

describe("public database contract types", () => {
  it("keeps compile-time capability assertions available", () => {
    expect(assertPublicContractTypes).toBeTypeOf("function");
  });
});
