import type {
  DatabaseConnection,
  DatabaseFactory,
  DatabaseFactoryConfig,
} from "@daily-energy/server-adapters/migration";
import { createMigrationDatabaseFactory } from "@daily-energy/server-adapters/migration";

export interface MigrationCommandRunner {
  run(): Promise<void>;
}

export interface MigrationEntrypoint {
  readonly profile: "migration";
  run(
    config: DatabaseFactoryConfig,
    command: MigrationCommandRunner,
  ): Promise<void>;
}

export function createMigrationEntrypoint(
  databaseFactory: DatabaseFactory<
    "migration",
    unknown
  > = createMigrationDatabaseFactory(),
): MigrationEntrypoint {
  return Object.freeze({
    profile: "migration",
    async run(
      config: DatabaseFactoryConfig,
      command: MigrationCommandRunner,
    ): Promise<void> {
      let connection: DatabaseConnection<"migration", unknown> | undefined;
      try {
        connection = await databaseFactory.connect(config);
        await command.run();
      } finally {
        await connection?.disconnect();
      }
    },
  });
}
