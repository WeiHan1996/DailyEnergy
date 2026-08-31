export const PRODUCT_DATE_TIMEZONE = "Asia/Shanghai";
export const PRODUCT_DATE_BOUNDARY_HOUR = 4;

export interface ProductDateResolution {
  readonly now: Date;
  readonly productDate: string;
}

export interface ProductDateClock {
  now(): Date;
}

export const SYSTEM_PRODUCT_DATE_CLOCK: ProductDateClock = Object.freeze({
  now: () => new Date(),
});

export function resolveProductDate(now: Date): ProductDateResolution {
  if (!Number.isFinite(now.getTime())) {
    throw new Error("PRODUCT_DATE_CLOCK_INVALID");
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    month: "2-digit",
    timeZone: PRODUCT_DATE_TIMEZONE,
    year: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => ["day", "hour", "month", "year"].includes(type))
      .map(({ type, value }) => [type, Number(value)]),
  ) as Partial<Record<"day" | "hour" | "month" | "year", number>>;
  const { day, hour, month, year } = values;
  if (
    day === undefined ||
    hour === undefined ||
    month === undefined ||
    year === undefined
  ) {
    throw new Error("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
  }
  const civil =
    hour >= PRODUCT_DATE_BOUNDARY_HOUR
      ? { day, month, year }
      : previousCivilDate(year, month, day);
  return Object.freeze({
    now: new Date(now.getTime()),
    productDate: `${String(civil.year).padStart(4, "0")}-${String(
      civil.month,
    ).padStart(2, "0")}-${String(civil.day).padStart(2, "0")}`,
  });
}

function previousCivilDate(year: number, month: number, day: number) {
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  return {
    day: previous.getUTCDate(),
    month: previous.getUTCMonth() + 1,
    year: previous.getUTCFullYear(),
  };
}
