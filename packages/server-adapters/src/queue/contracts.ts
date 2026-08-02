import { createHash } from "node:crypto";

import { z } from "zod";

export const WORKER_PROFILES = [
  "worker-interactive",
  "worker-background",
  "worker-restricted",
] as const;

export const QUEUE_FAMILIES = [
  "interactive",
  "background",
  "restricted",
] as const;

export type WorkerProfile = (typeof WORKER_PROFILES)[number];
export type QueueFamily = (typeof QUEUE_FAMILIES)[number];

const stableCodeSchema = z
  .string()
  .min(1)
  .max(96)
  .regex(/^[A-Za-z][A-Za-z0-9._-]*$/u);

export const versionedJobEnvelopeSchema = z
  .object({
    aggregateRef: z.uuid(),
    aggregateRevision: z.number().int().positive(),
    contract: z.literal("dailyenergy.job"),
    eventId: z.uuid(),
    eventType: stableCodeSchema,
    eventVersion: z
      .string()
      .min(1)
      .max(32)
      .regex(/^v[1-9][0-9]*$/u),
    guardEpochs: z
      .record(stableCodeSchema, z.string().regex(/^(0|[1-9][0-9]*)$/u))
      .refine((value) => Object.keys(value).length <= 8),
    occurredAt: z.iso.datetime({ offset: true }),
    queueVersion: z.literal(1),
  })
  .strict();

export type VersionedJobEnvelope = z.infer<typeof versionedJobEnvelopeSchema>;

export interface HandlerCapability {
  readonly consumerCode: string;
  readonly eventType: string;
  readonly eventVersion: `v${number}`;
}

export interface WorkerCapabilityManifest {
  readonly contractVersion: 1;
  readonly databaseRole: string;
  readonly egressAllowlist: readonly string[];
  readonly handlers: readonly HandlerCapability[];
  readonly profile: WorkerProfile;
  readonly queueFamily: QueueFamily;
  readonly queueName: string;
  readonly queueVersion: 1;
  readonly redisMajorVersion: 8;
}

export interface QueueTelemetryEvent {
  readonly operationCode:
    | "QUEUE_CONNECT"
    | "QUEUE_ENQUEUE"
    | "QUEUE_HANDLE"
    | "QUEUE_DRAIN"
    | "OUTBOX_RELAY"
    | "REDIS_REBUILD";
  readonly outcomeCode:
    "SUCCESS" | "DUPLICATE" | "EXPECTED_REJECT" | "RETRYABLE" | "TERMINAL";
  readonly profile: WorkerProfile;
  readonly queueFamily: QueueFamily;
  readonly reasonCode?: string;
  readonly retryOrdinal?: number;
}

export interface QueueTelemetrySink {
  record(event: QueueTelemetryEvent): void;
}

export const noopQueueTelemetrySink: QueueTelemetrySink = Object.freeze({
  record() {},
});

export interface QueueTransactionResult<
  Row extends Readonly<Record<string, unknown>>,
> {
  readonly rowCount: number;
  readonly rows: readonly Row[];
}

export interface QueueTransaction {
  execute<Row extends Readonly<Record<string, unknown>>>(
    statement: string,
    values?: readonly unknown[],
  ): Promise<QueueTransactionResult<Row>>;
}

export interface QueueJobHandler {
  readonly eventType: string;
  readonly eventVersion: `v${number}`;
  handle(
    envelope: VersionedJobEnvelope,
    transaction: QueueTransaction,
  ): Promise<string>;
}

export function handlerKey(eventType: string, eventVersion: string): string {
  return `${eventType}@${eventVersion}`;
}

export function parseVersionedJobEnvelope(
  value: unknown,
): VersionedJobEnvelope {
  const result = versionedJobEnvelopeSchema.safeParse(value);
  if (!result.success) {
    throw new QueueContractError("QUEUE_CONTRACT_INVALID");
  }
  return result.data;
}

export function fingerprintEnvelope(envelope: VersionedJobEnvelope): Buffer {
  return createHash("sha256").update(stableJson(envelope), "utf8").digest();
}

export function fingerprintCapabilityManifest(
  manifest: WorkerCapabilityManifest,
): string {
  return createHash("sha256")
    .update(stableJson(manifest), "utf8")
    .digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export class QueueContractError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "QueueContractError";
  }
}

export class QueueRetryableError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "QueueRetryableError";
  }
}

export class QueueTerminalError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "QueueTerminalError";
  }
}
