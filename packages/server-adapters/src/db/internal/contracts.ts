export type DatabaseProfile =
  | "api"
  | "api-restricted"
  | "worker-interactive"
  | "worker-background"
  | "worker-restricted"
  | "migration"
  | "testing";

export interface DatabaseFactoryConfig {
  readonly connectionString: string;
  readonly applicationName?: string;
  readonly connectionLimit?: number;
  readonly connectionTimeoutMillis?: number;
  readonly idleTimeoutMillis?: number;
}

export interface DatabaseConnection<
  Profile extends DatabaseProfile,
  Capability,
> {
  readonly profile: Profile;
  readonly capability: Capability;
  disconnect(): Promise<void>;
}

export interface DatabaseFactory<Profile extends DatabaseProfile, Capability> {
  readonly profile: Profile;
  connect(
    config: DatabaseFactoryConfig,
  ): Promise<DatabaseConnection<Profile, Capability>>;
}
