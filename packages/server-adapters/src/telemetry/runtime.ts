import { metrics, SpanStatusCode, trace } from "@opentelemetry/api";
import { PrometheusExporter } from "@opentelemetry/exporter-prometheus";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { z } from "zod";

import {
  METRIC_DEFINITIONS,
  TELEMETRY_SCHEMA_VERSION,
  TelemetryAttributesSchema,
  TelemetryResourceSchema,
  type MetricName,
  type TelemetryAttributes,
  type TelemetryResource,
} from "./contracts.js";
import { createActiveSeriesRegistry } from "./active-series.js";

const TelemetryRuntimeConfigSchema = z.strictObject({
  enabled: z.boolean(),
  metricsHost: z.enum(["127.0.0.1", "0.0.0.0"]),
  metricsPort: z.number().int().min(1).max(65_535),
  otlpTraceUrl: z
    .url()
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
    ),
  resource: TelemetryResourceSchema,
});

export type TelemetryRuntimeConfig = z.infer<
  typeof TelemetryRuntimeConfigSchema
>;

export type TelemetryTransportConfig = Omit<
  TelemetryRuntimeConfig,
  "resource"
> & {
  readonly configSchemaVersion: string;
  readonly contractBundleVersion: string;
  readonly environment: TelemetryResource["environment"];
  readonly releaseId: string;
  readonly serviceVersion: string;
};

export interface TelemetryRuntime {
  readonly beginSpan: (
    operationCode: TelemetryAttributes["operationCode"],
    attributes: TelemetryAttributes,
  ) => TelemetrySpan;
  readonly record: (
    name: MetricName,
    value: number,
    attributes: TelemetryAttributes,
  ) => void;
  readonly startSpan: <Result>(
    operationCode: TelemetryAttributes["operationCode"],
    attributes: TelemetryAttributes,
    run: () => Result,
  ) => Result;
  readonly shutdown: () => Promise<void>;
}

export interface TelemetrySpan {
  end(outcomeCode: TelemetryAttributes["outcomeCode"]): void;
}

export const NOOP_TELEMETRY_RUNTIME: TelemetryRuntime = Object.freeze({
  beginSpan: () => Object.freeze({ end() {} }),
  record(
    _name: MetricName,
    _value: number,
    _attributes: TelemetryAttributes,
  ): void {},
  shutdown: async () => undefined,
  startSpan<Result>(
    _operationCode: TelemetryAttributes["operationCode"],
    _attributes: TelemetryAttributes,
    run: () => Result,
  ): Result {
    return run();
  },
});

function otelAttributes(
  attributes: Readonly<Record<string, string | undefined>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter((entry): entry is [string, string] => entry[1] !== undefined)
      .map(([key, item]) => [
        key.replace(/[A-Z]/gu, (character) => `_${character.toLowerCase()}`),
        item,
      ]),
  );
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === "object" || typeof value === "function") &&
    value !== null &&
    "then" in value &&
    typeof value.then === "function"
  );
}

export function startTelemetryRuntime(
  value: TelemetryRuntimeConfig,
): TelemetryRuntime {
  const config = TelemetryRuntimeConfigSchema.parse(value);
  if (!config.enabled) {
    return NOOP_TELEMETRY_RUNTIME;
  }
  const resource = resourceFromAttributes({
    "dailyenergy.config_schema_version": config.resource.configSchemaVersion,
    "dailyenergy.contract_bundle_version":
      config.resource.contractBundleVersion,
    "dailyenergy.release_id": config.resource.releaseId,
    "dailyenergy.runtime_profile": config.resource.runtimeProfile,
    "deployment.environment.name": config.resource.environment,
    "service.name": config.resource.service,
    "service.namespace": "dailyenergy",
    "service.version": config.resource.serviceVersion,
  });
  const prometheus = new PrometheusExporter({
    endpoint: "/metrics",
    host: config.metricsHost,
    port: config.metricsPort,
    preventServerStart: false,
    withResourceConstantLabels:
      /^(?:service\.(?:namespace|name)|deployment\.environment\.name|dailyenergy\.runtime_profile)$/u,
    withoutScopeInfo: true,
  });
  const sdk = new NodeSDK({
    autoDetectResources: false,
    metricReaders: [prometheus],
    resource,
    traceExporter: new OTLPTraceExporter({
      headers: {},
      url: config.otlpTraceUrl,
    }),
  });
  sdk.start();
  const meter = metrics.getMeter(
    "dailyenergy-runtime",
    TELEMETRY_SCHEMA_VERSION,
  );
  const instruments = new Map<
    MetricName,
    {
      add?: (value: number, attributes: Record<string, string>) => void;
      record?: (value: number, attributes: Record<string, string>) => void;
    }
  >();
  const activeSeries = createActiveSeriesRegistry();
  for (const [name, definition] of Object.entries(METRIC_DEFINITIONS) as [
    MetricName,
    (typeof METRIC_DEFINITIONS)[MetricName],
  ][]) {
    if (definition.kind === "counter") {
      instruments.set(
        name,
        meter.createCounter(name, { unit: definition.unit }),
      );
    } else if (definition.kind === "histogram") {
      instruments.set(
        name,
        meter.createHistogram(name, {
          advice: {
            explicitBucketBoundaries: [...definition.buckets],
          },
          unit: definition.unit,
        }),
      );
    } else {
      instruments.set(name, meter.createGauge(name, { unit: definition.unit }));
    }
  }
  const tracer = trace.getTracer(
    "dailyenergy-runtime",
    TELEMETRY_SCHEMA_VERSION,
  );
  const recordContractRejection = (): void => {
    instruments
      .get("dailyenergy_telemetry_contract_rejections_total")
      ?.add?.(1, {
        operation_code: "TELEMETRY_EXPORT",
        reason_code: "TELEMETRY_CONTRACT_REJECTED",
      });
  };

  const runtime: TelemetryRuntime = {
    beginSpan(
      operationCode: TelemetryAttributes["operationCode"],
      rawAttributes: TelemetryAttributes,
    ): TelemetrySpan {
      try {
        const attributes = TelemetryAttributesSchema.parse({
          ...rawAttributes,
          operationCode,
        });
        const span = tracer.startSpan(operationCode, {
          attributes: otelAttributes(attributes),
        });
        let ended = false;
        return Object.freeze({
          end(outcomeCode: TelemetryAttributes["outcomeCode"]): void {
            if (ended) {
              return;
            }
            ended = true;
            span.setAttribute("outcome_code", outcomeCode);
            span.setStatus({
              code:
                outcomeCode === "SUCCESS" || outcomeCode === "EXPECTED_REJECT"
                  ? SpanStatusCode.OK
                  : SpanStatusCode.ERROR,
            });
            span.end();
          },
        });
      } catch {
        recordContractRejection();
        return NOOP_TELEMETRY_RUNTIME.beginSpan(operationCode, rawAttributes);
      }
    },
    record(
      name: MetricName,
      amount: number,
      rawAttributes: TelemetryAttributes,
    ): void {
      try {
        if (!Number.isFinite(amount) || amount < 0) {
          throw new Error("TELEMETRY_VALUE_INVALID");
        }
        const attributes = TelemetryAttributesSchema.parse(rawAttributes);
        const definition = METRIC_DEFINITIONS[name];
        const projected = Object.fromEntries(
          definition.labels.map((label) => [label, attributes[label]]),
        );
        if (Object.values(projected).some((item) => item === undefined)) {
          throw new Error("TELEMETRY_ATTRIBUTE_MISSING");
        }
        const signature = JSON.stringify(projected);
        if (!activeSeries.accept(name, signature)) {
          throw new Error("TELEMETRY_CARDINALITY_LIMIT");
        }
        const instrument = instruments.get(name);
        const converted = otelAttributes(projected);
        if (definition.kind === "counter") {
          instrument?.add?.(amount, converted);
        } else {
          instrument?.record?.(amount, converted);
        }
      } catch {
        recordContractRejection();
      }
    },
    shutdown: async () => {
      clearInterval(heartbeatTimer);
      await sdk.shutdown();
    },
    startSpan<Result>(
      operationCode: TelemetryAttributes["operationCode"],
      rawAttributes: TelemetryAttributes,
      run: () => Result,
    ): Result {
      const parsed = TelemetryAttributesSchema.safeParse({
        ...rawAttributes,
        operationCode,
      });
      if (!parsed.success) {
        recordContractRejection();
        return run();
      }
      let callbackStarted = false;
      try {
        return tracer.startActiveSpan(operationCode, (span) => {
          callbackStarted = true;
          for (const [key, item] of Object.entries(
            otelAttributes(parsed.data),
          )) {
            span.setAttribute(key, item);
          }
          try {
            const result = run();
            if (isPromiseLike(result)) {
              return Promise.resolve(result)
                .then((resolved) => {
                  span.setStatus({ code: SpanStatusCode.OK });
                  return resolved;
                })
                .catch((error: unknown) => {
                  span.setStatus({ code: SpanStatusCode.ERROR });
                  throw error;
                })
                .finally(() => span.end()) as Result;
            }
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            return result;
          } catch (error) {
            span.setStatus({ code: SpanStatusCode.ERROR });
            span.end();
            throw error;
          }
        });
      } catch (error) {
        if (!callbackStarted) {
          recordContractRejection();
          return run();
        }
        throw error;
      }
    },
  };
  const recordHeartbeat = (): void => {
    runtime.record(
      "dailyenergy_telemetry_heartbeat_timestamp_seconds",
      Date.now() / 1_000,
      {
        operationCode: "TELEMETRY_EXPORT",
        outcomeCode: "SUCCESS",
      },
    );
  };
  recordHeartbeat();
  const heartbeatTimer = setInterval(recordHeartbeat, 60_000);
  heartbeatTimer.unref();
  return Object.freeze(runtime);
}

export function telemetryResource(
  resource: TelemetryResource,
): TelemetryResource {
  return TelemetryResourceSchema.parse(resource);
}
