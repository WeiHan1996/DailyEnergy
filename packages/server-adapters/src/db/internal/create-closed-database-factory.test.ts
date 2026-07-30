import { describe, expect, it, vi } from "vitest";

import type { DatabaseProfile } from "./contracts.js";
import { createClosedDatabaseFactory } from "./create-closed-database-factory.js";
import type {
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
}

function fakeRuntime(): PrismaRuntime<FakeClient> & {
  createAdapter: ReturnType<typeof vi.fn>;
} {
  return {
    createAdapter: vi.fn((config: unknown) => ({ config })),
    createClient: vi.fn((adapter: unknown) => new FakeClient({ adapter })),
  };
}

function factory(profile: DatabaseProfile, role: string) {
  const runtime = fakeRuntime();
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
        "postgresql://daily_energy_background:secret@db.test/app",
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
        "postgresql://daily_energy_background:secret@db.test/app",
      connectionTimeoutMillis: undefined,
      idleTimeoutMillis: undefined,
    });
    expect(FakeClient.instances[0]?.connect).toHaveBeenCalledOnce();
  });

  it("fails closed when credentials use another role", async () => {
    const setup = factory("worker-restricted", "daily_energy_restricted");

    await expect(
      setup.factory.connect({
        connectionString:
          "postgresql://daily_energy_background:secret@db.test/app",
      }),
    ).rejects.toThrow(
      "DB_ROLE_MISMATCH: worker-restricted requires daily_energy_restricted",
    );
    expect(setup.runtime.createAdapter).not.toHaveBeenCalled();
  });

  it("rejects non-PostgreSQL and role-less URLs without exposing them", async () => {
    const setup = factory("api", "daily_energy_api");

    await expect(
      setup.factory.connect({
        connectionString: "mysql://daily_energy_api:secret@db/app",
      }),
    ).rejects.toThrow("DB_CONFIG_INVALID: PostgreSQL connection required");
    await expect(
      setup.factory.connect({ connectionString: "postgresql://db.test/app" }),
    ).rejects.toThrow("DB_CONFIG_INVALID: database role is required");
  });

  it("disconnects the private client exactly once", async () => {
    FakeClient.instances = [];
    const setup = factory("testing", "daily_energy_test");
    const connection = await setup.factory.connect({
      connectionString: "postgresql://daily_energy_test:secret@db.test/app",
    });

    await connection.disconnect();
    await connection.disconnect();

    expect(FakeClient.instances[0]?.disconnect).toHaveBeenCalledOnce();
  });
});
