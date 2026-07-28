export interface LoginResult {
  readonly code: string;
}

export interface LoginPort {
  login(): Promise<LoginResult>;
}

export type StorageScalar = boolean | number | string | null;
export type StorageValue =
  | StorageScalar
  | readonly StorageValue[]
  | { readonly [key: string]: StorageValue };

export interface StoragePort {
  get(key: string): Promise<StorageValue | undefined>;
  remove(key: string): Promise<void>;
  set(key: string, value: StorageValue): Promise<void>;
}

export type NetworkMethod = "DELETE" | "GET" | "PATCH" | "POST" | "PUT";

export interface NetworkRequest {
  readonly body?: StorageValue;
  readonly headers?: Readonly<Record<string, string>>;
  readonly method: NetworkMethod;
  readonly path: string;
  readonly timeoutMs?: number;
}

export interface NetworkResponse<T = unknown> {
  readonly data: T;
  readonly headers: Readonly<Record<string, string>>;
  readonly statusCode: number;
}

export interface NetworkPort {
  request<T = unknown>(request: NetworkRequest): Promise<NetworkResponse<T>>;
}

export interface ShareAppMessageInput {
  readonly imageUrl?: string;
  readonly path: string;
  readonly title: string;
}

export interface ShareAppMessage {
  readonly imageUrl?: string;
  readonly path: string;
  readonly title: string;
}

export interface SharePort {
  createAppMessage(input: ShareAppMessageInput): ShareAppMessage;
}

export type SubscriptionDecision =
  "accept" | "ban" | "filter" | "reject" | "unknown";

export interface SubscriptionResult {
  readonly decisions: Readonly<Record<string, SubscriptionDecision>>;
}

export interface SubscriptionPort {
  request(templateIds: readonly string[]): Promise<SubscriptionResult>;
}

export interface MiniappPlatform {
  readonly login: LoginPort;
  readonly network: NetworkPort;
  readonly share: SharePort;
  readonly storage: StoragePort;
  readonly subscription: SubscriptionPort;
}
