import { describe, expect, it } from "vitest";

import {
  computeC015MetricGates,
  computeC015MetricReports,
  wilson95,
  type MetricSourceSnapshot,
} from "./metrics.js";

const D0 = "2026-08-20";

function emptySource(
  overrides: Partial<MetricSourceSnapshot> = {},
): MetricSourceSnapshot {
  return {
    checkins: [],
    clientSignalCounts: [],
    encounters: [],
    evenings: [],
    gatewayUsage: [],
    interactions: [],
    lights: [],
    newConsentOwners: [],
    onboardings: [],
    results: [],
    shareIntents: [],
    ...overrides,
  };
}

function reports(source: MetricSourceSnapshot) {
  return computeC015MetricReports({
    aggregationRevision: 3,
    finalizedProductDate: "2026-09-10",
    generatedAt: new Date("2026-09-10T06:00:00.000Z"),
    reportProductDate: D0,
    source,
    sourceContractVersion: "s25-metric-source-v1",
  });
}

function metric(source: MetricSourceSnapshot, id: string) {
  return reports(source).find(({ metric_id }) => metric_id === id)!;
}

function ownerFacts(count: number, productDate = D0, prefix = "owner") {
  return Array.from({ length: count }, (_, index) => ({
    ownerKey: `${prefix}-${index}`,
    productDate,
  }));
}

describe("C-015 S-25 metric contract and ten fixed fixtures", () => {
  it("computes FX-01 and FX-02 same-day authority funnels", () => {
    const owners = ownerFacts(20);
    const source = emptySource({
      checkins: owners.slice(0, 13),
      newConsentOwners: owners,
      onboardings: owners.slice(0, 15),
    });
    expect(metric(source, "S25-M02")).toMatchObject({
      denominator: 20,
      numerator: 15,
      value: 0.75,
    });
    expect(metric(source, "S25-M03")).toMatchObject({
      denominator: 15,
      numerator: 13,
    });
  });

  it("computes FX-03 result availability and template degradation", () => {
    const owners = ownerFacts(13);
    const source = emptySource({
      checkins: owners,
      results: owners.map((owner, index) => ({
        ...owner,
        generationMode: index === 0 ? "CONTROLLED_TEMPLATE" : "AI",
        latencyBucket: "1_2_99S",
      })),
    });
    expect(metric(source, "S25-M04")).toMatchObject({
      denominator: 13,
      numerator: 13,
      value: 1,
    });
    expect(metric(source, "S25-M21")).toMatchObject({
      denominator: 13,
      numerator: 1,
    });
  });

  it("uses all first-result owners for M05, including owners who did not light", () => {
    const owners = ownerFacts(20);
    const source = emptySource({
      encounters: owners.slice(0, 7).map((owner, index) => ({
        ...owner,
        cycleKey: `cycle-${index}`,
      })),
      lights: owners.slice(0, 7),
      results: owners.map((owner) => ({
        ...owner,
        generationMode: "AI" as const,
        latencyBucket: "1_2_99S" as const,
      })),
    });
    expect(metric(source, "S25-M05")).toMatchObject({
      denominator: 20,
      numerator: 7,
      value: 0.35,
    });
  });

  it("computes FX-04 exact mature D1/D3/D7 retention", () => {
    const encounters = ownerFacts(20).flatMap((owner, index) => [
      { ...owner, cycleKey: `cycle-${index}` },
      ...(index < 7
        ? [{ ...owner, cycleKey: `cycle-${index}`, productDate: "2026-08-21" }]
        : []),
      ...(index < 4
        ? [{ ...owner, cycleKey: `cycle-${index}`, productDate: "2026-08-23" }]
        : []),
      ...(index < 3
        ? [{ ...owner, cycleKey: `cycle-${index}`, productDate: "2026-08-27" }]
        : []),
    ]);
    const source = emptySource({ encounters });
    expect(metric(source, "S25-M07")).toMatchObject({
      denominator: 20,
      numerator: 7,
      value: 0.35,
    });
    expect(metric(source, "S25-M08")).toMatchObject({
      denominator: 20,
      numerator: 4,
      value: 0.2,
    });
    expect(metric(source, "S25-M09")).toMatchObject({
      denominator: 20,
      numerator: 3,
      value: 0.15,
    });
  });

  it("computes FX-05 first-week evening coverage from authority facts", () => {
    const owners = ownerFacts(20);
    const source = emptySource({
      encounters: owners.map((owner, index) => ({
        ...owner,
        cycleKey: `cycle-${index}`,
      })),
      evenings: owners.slice(0, 8).map((owner) => ({
        ...owner,
        productDate: "2026-08-24",
      })),
    });
    expect(metric(source, "S25-M13")).toMatchObject({
      denominator: 20,
      numerator: 8,
      value: 0.4,
    });
  });

  it("computes FX-06 final helpfulness coverage and substantive ratio", () => {
    const ratings = [
      ...Array(6).fill("HELPFUL"),
      ...Array(2).fill("NEUTRAL"),
      ...Array(2).fill("NOT_HELPFUL"),
      ...Array(4).fill("NOT_USED"),
      ...Array(6).fill(undefined),
    ] as const;
    const source = emptySource({
      interactions: ownerFacts(20).map((owner, index) => ({
        ...owner,
        evaluable: true,
        hasTask: true,
        ...(ratings[index] === undefined
          ? {}
          : { helpfulness: ratings[index] }),
        taskStatus: "UNMARKED" as const,
      })),
    });
    expect(metric(source, "S25-M14")).toMatchObject({
      denominator: 20,
      numerator: 14,
      value: 0.7,
    });
    expect(metric(source, "S25-M15")).toMatchObject({
      denominator: 10,
      numerator: 6,
      value: 0.6,
    });
  });

  it("computes FX-07 task participation from final state, not updates", () => {
    const statuses = [
      ...Array(4).fill("COMPLETED"),
      ...Array(6).fill("INTERESTED"),
      ...Array(5).fill("SKIPPED"),
      ...Array(5).fill("UNMARKED"),
    ] as const;
    const source = emptySource({
      interactions: ownerFacts(20).map((owner, index) => ({
        ...owner,
        evaluable: true,
        hasTask: true,
        taskStatus: statuses[index]!,
      })),
    });
    expect(metric(source, "S25-M16")).toMatchObject({
      denominator: 20,
      numerator: 10,
      value: 0.5,
    });
    expect(metric(source, "S25-M17")).toMatchObject({
      denominator: 10,
      numerator: 4,
      value: 0.4,
    });
  });

  it("computes FX-08 bucketed AI latency without exact timings", () => {
    const source = emptySource({
      results: ownerFacts(100).map((owner, index) => ({
        ...owner,
        generationMode: "AI" as const,
        latencyBucket: index < 94 ? "3_7_99S" : "8_14_99S",
      })),
    });
    expect(metric(source, "S25-M20")).toMatchObject({
      denominator: 100,
      numerator: 94,
      value: 0.94,
    });
  });

  it("computes FX-09 cost per CoreActiveUserDay and never fills UNKNOWN with zero", () => {
    const source = emptySource({
      checkins: ownerFacts(80),
      gatewayUsage: [
        {
          costMicros: 6_000_000,
          generationMode: "AI",
          productDate: D0,
          terminal: true,
          usageOutcome: "KNOWN",
          workload: "DAILY",
        },
      ],
    });
    expect(metric(source, "S25-M22")).toMatchObject({
      denominator: 80,
      numerator: 6_000_000,
      value: 0.075,
    });
  });

  it("blocks M22 when cost completeness is below 99 percent", () => {
    const source = emptySource({
      checkins: ownerFacts(100),
      gatewayUsage: Array.from({ length: 100 }, (_, index) => ({
        ...(index < 98 ? { costMicros: 10_000 } : {}),
        generationMode: "AI" as const,
        productDate: D0,
        terminal: true,
        usageOutcome: index < 98 ? ("KNOWN" as const) : ("UNKNOWN" as const),
        workload: "DAILY" as const,
      })),
    });
    expect(metric(source, "S25-M22")).toMatchObject({
      notes_code: expect.arrayContaining(["SOURCE_INCOMPLETE"]),
      status: "BLOCKED",
    });
    expect(metric(source, "S25-M22")).not.toHaveProperty("value");
  });

  it("limits M19 share intents to CoreActiveUserDay owners", () => {
    const active = ownerFacts(10);
    const source = emptySource({
      checkins: active,
      shareIntents: [...active.slice(0, 5), ...ownerFacts(10, D0, "outside")],
    });
    expect(metric(source, "S25-M19")).toMatchObject({
      denominator: 10,
      numerator: 5,
      value: 0.5,
    });
  });

  it("computes FX-10 by suppressing denominator nine with no exact values", () => {
    const output = metric(
      emptySource({
        newConsentOwners: ownerFacts(9),
        onboardings: ownerFacts(7),
      }),
      "S25-M02",
    );
    expect(output).toMatchObject({ status: "SUPPRESSED" });
    expect(output).not.toHaveProperty("numerator");
    expect(output).not.toHaveProperty("denominator");
    expect(output).not.toHaveProperty("value");
  });

  it("returns all 23 versioned reports and the shared Wilson interval", () => {
    const output = reports(emptySource());
    expect(output).toHaveLength(23);
    expect(new Set(output.map(({ metric_id }) => metric_id)).size).toBe(23);
    expect(wilson95(6, 10)).toMatchObject({
      low: expect.any(Number),
      high: expect.any(Number),
    });
  });

  it("keeps the four hard Gates count-free and isolated", () => {
    const output = computeC015MetricGates({
      aggregationRevision: 3,
      contractFailureCount: 0,
      deletionOrTtlBreachCount: 1,
      generatedAt: new Date("2026-09-10T06:00:00.000Z"),
      rawContentMatchCount: 0,
      smallCellOrJoinPathFailureCount: 0,
    });
    expect(output).toHaveLength(4);
    expect(output.find(({ gate_id }) => gate_id === "S25-G04")).toMatchObject({
      reason_codes: ["DELETION_OR_TTL_BREACH"],
      status: "BLOCKED",
    });
    expect(JSON.stringify(output)).not.toMatch(/count|owner|cycle/iu);
  });

  it("recomputes D0 from remaining encounter links after deletion", () => {
    const encounters = ownerFacts(10).flatMap((owner, index) => [
      { ...owner, cycleKey: `cycle-${index}`, productDate: "2026-08-21" },
      { ...owner, cycleKey: `cycle-${index}`, productDate: "2026-08-22" },
    ]);
    const shifted = computeC015MetricReports({
      aggregationRevision: 4,
      finalizedProductDate: "2026-09-10",
      generatedAt: new Date("2026-09-10T06:00:00.000Z"),
      reportProductDate: "2026-08-21",
      source: emptySource({ encounters }),
      sourceContractVersion: "s25-metric-source-v1",
    });
    expect(
      shifted.find(({ metric_id }) => metric_id === "S25-M07"),
    ).toMatchObject({
      denominator: 10,
      numerator: 10,
    });
  });
});
