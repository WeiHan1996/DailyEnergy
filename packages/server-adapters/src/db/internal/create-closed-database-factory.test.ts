import { describe, expect, it, vi } from "vitest";

import type { DatabaseProfile } from "./contracts.js";
import { createClosedDatabaseFactory } from "./create-closed-database-factory.js";
import type {
  DatabaseRoleIdentity,
  PrismaClientLifecycle,
  PrismaRuntime,
} from "./prisma-runtime.types.js";

class FakeClient implements PrismaClientLifecycle {
  static instances: FakeClient[] = [];
  readonly connect = vi.fn(async () => undefined);
  readonly disconnect = vi.fn(async () => undefined);

  constructor(readonly options: { readonly adapter: unknown }) {
    FakeClient.instances.push(this);
  }

  $connect(): Promise<void> {
    return this.connect();
  }

  $disconnect(): Promise<void> {
    return this.disconnect();
  }

  $queryRawUnsafe<Result = unknown>(): Promise<Result> {
    return Promise.resolve(undefined as Result);
  }
}

const backgroundIdentity: DatabaseRoleIdentity = {
  currentUser: "daily_energy_background_prod",
  sessionUser: "daily_energy_background_prod",
  profileMemberships: ["daily_energy_background"],
  ownerMember: false,
  restrictedRead: false,
  schemaCreate: false,
  superuser: false,
  createDatabase: false,
  createRole: false,
  bypassRls: false,
};

function fakeRuntime(
  identity: DatabaseRoleIdentity = backgroundIdentity,
): PrismaRuntime<FakeClient> & {
  createAdapter: ReturnType<typeof vi.fn>;
  inspectRoleIdentity: ReturnType<typeof vi.fn>;
} {
  return {
    createAdapter: vi.fn((config: unknown) => ({ config })),
    createClient: vi.fn((adapter: unknown) => new FakeClient({ adapter })),
    inspectRoleIdentity: vi.fn(async () => identity),
  };
}

function factory(
  profile: DatabaseProfile,
  role: string,
  identity: DatabaseRoleIdentity = backgroundIdentity,
) {
  const runtime = fakeRuntime(identity);
  return {
    factory: createClosedDatabaseFactory(
      { databaseRole: role, defaultConnectionLimit: 3, profile },
      runtime,
    ),
    runtime,
  };
}

describe("closed database factory", () => {
  it("connects with a fixed role, profile and bounded pool configuration", async () => {
    FakeClient.instances = [];
    const setup = factory("worker-background", "daily_energy_background");
    const connection = await setup.factory.connect({
      connectionString:
        "postgresql://daily_energy_background_prod:secret@db.test/app",
    });

    expect(connection.profile).toBe("worker-background");
    expect(connection.capability).toEqual({
      databaseRole: "daily_energy_background",
      profile: "worker-background",
    });
    expect(setup.runtime.createAdapter).toHaveBeenCalledWith({
      applicationName: "daily-energy:worker-background",
      connectionLimit: 3,
      connectionString:
        "postgresql://daily_energy_background_prod:secret@db.test/app",
      connectionTimeoutMillis: undefined,
      idleTimeoutMillis: undefined,
    });
    expect(FakeClient.instances[0]?.connect).toHaveBeenCalledOnce();
  });

  it("fails closed when the login inherits another profile", async () => {
    FakeClient.instances = [];
    const setup = factory(
      "worker-restricted",
      "daily_energy_restricted",
      backgroundIdentity,
    );

    await expect(
      setup.factory.connect({
        connectionString: "postgresql://environment_login:secret@db.test/app",
      }),
    ).rejects.toThrow(
      "DB_ROLE_MISMATCH: worker-restricted requires daily_energy_restricted",
    );
    expect(setup.runtime.createAdapter).toHaveBeenCalledOnce();
    expect(FakeClient.instances[0]?.disconnect).toHaveBeenCalledOnce();
  });

  it("rejects non-PostgreSQL URLs without exposing them", async () => {
    const setup = factory("api", "daily_energy_api");

    await expect(
      setup.factory.connect({
        connectionString: "mysql://daily_energy_api:secret@db/app",
      }),
    ).rejects.toThrow("DB_CONFIG_INVALID: PostgreSQL connection required");
    expect(setup.runtime.createAdapter).not.toHaveBeenCalled();
  });

  it("rejects extra runtime membership and ordinary restricted capability", async () => {
    for (const identity of [
      {
        ...backgroundIdentity,
        profileMemberships: [
          "daily_energy_background",
          "daily_energy_restricted",
        ],
      },
      { ...backgroundIdentity, restrictedRead: true },
      { ...backgroundIdentity, ownerMember: true },
    ]) {
      const setup = factory(
        "worker-background",
        "daily_energy_background",
        identity,
      );
      await expect(
        setup.factory.connect({
          connectionString: "postgres://environment_login:secret@db.test/app",
        }),
      ).rejects.toThrow("DB_ROLE_MISMATCH");
    }
  });

  it("disconnects the private client exactly once", async () => {
    FakeClient.instances = [];
    const setup = factory("testing", "daily_energy_test", {
      ...backgroundIdentity,
      currentUser: "daily_energy_test_ci",
      sessionUser: "daily_energy_test_ci",
      profileMemberships: ["daily_energy_test"],
    });
    const connection = await setup.factory.connect({
      connectionString: "postgresql://daily_energy_test_ci:secret@db.test/app",
    });

    await connection.disconnect();
    await connection.disconnect();

    expect(FakeClient.instances[0]?.disconnect).toHaveBeenCalledOnce();
  });
});
