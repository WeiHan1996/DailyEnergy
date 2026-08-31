export {
  PRODUCT_DATE_POLICY_V1,
  resolveProductDate,
} from "@daily-energy/server-core/product-time";
export type { ProductDateResolution } from "@daily-energy/server-core/product-time";

export interface ProductDateClock {
  now(): Date;
}

export const SYSTEM_PRODUCT_DATE_CLOCK: ProductDateClock = Object.freeze({
  now: () => new Date(),
});
