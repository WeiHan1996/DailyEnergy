export const PRODUCT_DATE_POLICY_V1 = Object.freeze({
  boundaryLocalTime: "04:00:00",
  calendar: "ISO-8601-Gregorian",
  generationCompletionMinutes: 15,
  policyVersion: "product-date-v1",
  timezoneId: "Asia/Shanghai",
  viewContinuationMinutes: 30,
  weeklyWindowDays: 7,
} as const);

export type ProductDate = string & { readonly __productDate: unique symbol };

export type ProductTimeErrorCode =
  | "PRODUCT_DATE_INVALID"
  | "PRODUCT_DATE_POLICY_UNSUPPORTED"
  | "PRODUCT_DATE_TIMEZONE_UNAVAILABLE";

export class ProductTimeError extends Error {
  public constructor(public readonly code: ProductTimeErrorCode) {
    super(code);
    this.name = "ProductTimeError";
  }
}

export interface ProductDateResolution {
  readonly boundaryAt: Date;
  readonly nextBoundaryAt: Date;
  readonly now: Date;
  readonly policyVersion: "product-date-v1";
  readonly productDate: ProductDate;
  readonly timezoneId: "Asia/Shanghai";
  readonly tzdbRelease: string;
}

interface CivilDate {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

interface ZonedParts extends CivilDate {
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
}

const PRODUCT_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const TZDB_RELEASE_PATTERN = /^\d{4}[a-z]$/u;

export function parseProductDate(value: string): ProductDate {
  const match = PRODUCT_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new ProductTimeError("PRODUCT_DATE_INVALID");
  }
  const civil = {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
  const check = new Date(Date.UTC(civil.year, civil.month - 1, civil.day));
  if (
    check.getUTCFullYear() !== civil.year ||
    check.getUTCMonth() + 1 !== civil.month ||
    check.getUTCDate() !== civil.day
  ) {
    throw new ProductTimeError("PRODUCT_DATE_INVALID");
  }
  return value as ProductDate;
}

export function resolveProductDate(now: Date): ProductDateResolution {
  assertInstant(now);
  const tzdbRelease = systemTzdbRelease();
  const local = zonedParts(now, PRODUCT_DATE_POLICY_V1.timezoneId);
  const productCivil =
    local.hour >= 4
      ? { day: local.day, month: local.month, year: local.year }
      : addCivilDays(
          { day: local.day, month: local.month, year: local.year },
          -1,
        );
  const productDate = productDateFromCivil(productCivil);
  const boundaryAt = localBoundaryInstant(productCivil);
  const nextBoundaryAt = localBoundaryInstant(addCivilDays(productCivil, 1));
  return Object.freeze({
    boundaryAt,
    nextBoundaryAt,
    now: new Date(now.getTime()),
    policyVersion: PRODUCT_DATE_POLICY_V1.policyVersion,
    productDate,
    timezoneId: PRODUCT_DATE_POLICY_V1.timezoneId,
    tzdbRelease,
  });
}

export function productDateBounds(productDate: ProductDate): {
  readonly boundaryAt: Date;
  readonly nextBoundaryAt: Date;
} {
  const civil = civilFromProductDate(productDate);
  return Object.freeze({
    boundaryAt: localBoundaryInstant(civil),
    nextBoundaryAt: localBoundaryInstant(addCivilDays(civil, 1)),
  });
}

export function addProductDateDays(
  productDate: ProductDate,
  days: number,
): ProductDate {
  if (!Number.isSafeInteger(days)) {
    throw new ProductTimeError("PRODUCT_DATE_INVALID");
  }
  return productDateFromCivil(
    addCivilDays(civilFromProductDate(productDate), days),
  );
}

export function weeklyProductDates(
  windowEndDate: ProductDate,
): readonly ProductDate[] {
  return Object.freeze(
    Array.from(
      { length: PRODUCT_DATE_POLICY_V1.weeklyWindowDays },
      (_value, index) =>
        addProductDateDays(
          windowEndDate,
          index - (PRODUCT_DATE_POLICY_V1.weeklyWindowDays - 1),
        ),
    ),
  );
}

function assertInstant(value: Date): void {
  if (!Number.isFinite(value.getTime())) {
    throw new ProductTimeError("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
  }
}

function systemTzdbRelease(): string {
  const tzdbRelease = process.versions.tz;
  if (tzdbRelease === undefined) {
    throw new ProductTimeError("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
  }
  return parseTzdbRelease(tzdbRelease);
}

function parseTzdbRelease(value: string): string {
  if (!TZDB_RELEASE_PATTERN.test(value)) {
    throw new ProductTimeError("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
  }
  return value;
}

function civilFromProductDate(value: ProductDate): CivilDate {
  const match = PRODUCT_DATE_PATTERN.exec(value);
  if (match === null) {
    throw new ProductTimeError("PRODUCT_DATE_INVALID");
  }
  return {
    day: Number(match[3]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function productDateFromCivil(civil: CivilDate): ProductDate {
  return parseProductDate(
    `${String(civil.year).padStart(4, "0")}-${String(civil.month).padStart(
      2,
      "0",
    )}-${String(civil.day).padStart(2, "0")}`,
  );
}

function addCivilDays(civil: CivilDate, days: number): CivilDate {
  const date = new Date(
    Date.UTC(civil.year, civil.month - 1, civil.day + days),
  );
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth() + 1,
    year: date.getUTCFullYear(),
  };
}

function zonedParts(now: Date, timezoneId: string): ZonedParts {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone: timezoneId,
      year: "numeric",
    }).formatToParts(now);
  } catch {
    throw new ProductTimeError("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
  }
  const values = Object.fromEntries(
    parts
      .filter(({ type }) =>
        ["day", "hour", "minute", "month", "second", "year"].includes(type),
      )
      .map(({ type, value }) => [type, Number(value)]),
  ) as Partial<Record<keyof ZonedParts, number>>;
  const { day, hour, minute, month, second, year } = values;
  if (
    day === undefined ||
    hour === undefined ||
    minute === undefined ||
    month === undefined ||
    second === undefined ||
    year === undefined
  ) {
    throw new ProductTimeError("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
  }
  return { day, hour, minute, month, second, year };
}

function localBoundaryInstant(civil: CivilDate): Date {
  const targetAsUtc = Date.UTC(civil.year, civil.month - 1, civil.day, 4, 0, 0);
  let candidate = targetAsUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(
      new Date(candidate),
      PRODUCT_DATE_POLICY_V1.timezoneId,
    );
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const adjustment = targetAsUtc - actualAsUtc;
    candidate += adjustment;
    if (adjustment === 0) {
      const result = new Date(candidate);
      assertInstant(result);
      return result;
    }
  }
  throw new ProductTimeError("PRODUCT_DATE_TIMEZONE_UNAVAILABLE");
}
