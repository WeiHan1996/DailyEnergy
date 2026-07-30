export interface PrismaClientLifecycle {
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
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
}
