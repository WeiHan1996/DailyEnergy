import { metricActiveSeriesLimit, type MetricName } from "./contracts.js";

export interface ActiveSeriesRegistry {
  accept(name: MetricName, signature: string): boolean;
}

export function createActiveSeriesRegistry(): ActiveSeriesRegistry {
  const activeSeries = new Map<MetricName, Set<string>>();

  return Object.freeze({
    accept(name: MetricName, signature: string): boolean {
      const knownSeries = activeSeries.get(name) ?? new Set<string>();
      if (
        !knownSeries.has(signature) &&
        knownSeries.size >= metricActiveSeriesLimit(name)
      ) {
        return false;
      }
      knownSeries.add(signature);
      activeSeries.set(name, knownSeries);
      return true;
    },
  });
}
