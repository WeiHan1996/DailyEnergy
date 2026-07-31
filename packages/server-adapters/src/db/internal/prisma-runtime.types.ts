export interface PrismaClientLifecycle {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $queryRawUnsafe<Result = unknown>(
    query: string,
    ...values: readonly unknown[]
  ): Promise<Result>;
}

export interface DatabaseRoleIdentity {
  readonly currentUser: string;
  readonly sessionUser: string;
  readonly profileMemberships: readonly string[];
  readonly ownerMember: boolean;
  readonly restrictedRead: boolean;
  readonly schemaCreate: boolean;
  readonly superuser: boolean;
  readonly createDatabase: boolean;
  readonly createRole: boolean;
  readonly bypassRls: boolean;
  readonly capabilityMismatch: boolean;
  readonly safetyWrite: boolean;
  readonly deletionTaskWrite: boolean;
  readonly subjectDelete: boolean;
  readonly evaluationAccess: boolean;
  readonly extraRoleMemberships: readonly string[];
  readonly immutableTableUpdate: boolean;
}

export interface PrismaRuntime<Client extends PrismaClientLifecycle> {
  createAdapter(config: {
    readonly connectionString: string;
    readonly applicationName: string;
    readonly connectionLimit?: number | undefined;
    readonly connectionTimeoutMillis?: number | undefined;
    readonly idleTimeoutMillis?: number | undefined;
  }): unknown;
  createClient(adapter: unknown): Client;
  inspectRoleIdentity(
    client: Client,
    expectedRole: string,
  ): Promise<DatabaseRoleIdentity>;
}
