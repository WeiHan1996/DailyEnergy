export const SYNTHETIC_FACTORY_VERSION = "synthetic-factory-v1";

function assertInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`SYNTHETIC_FACTORY_INVALID_${name}`);
  }
}

export function createDeterministicSources({ now, seed }) {
  const fixedNow = new Date(now);
  if (Number.isNaN(fixedNow.valueOf())) {
    throw new Error("SYNTHETIC_FACTORY_INVALID_CLOCK");
  }
  assertInteger(seed, "SEED");
  let state = seed || 1;

  return Object.freeze({
    now: () => new Date(fixedNow.valueOf()),
    random: () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return (state >>> 0) / 0x1_0000_0000;
    },
    seed,
  });
}

export function createSyntheticSubject(ordinal = 1) {
  assertInteger(ordinal, "ORDINAL");
  const suffix = String(ordinal).padStart(4, "0");
  return Object.freeze({
    account_ref: `synthetic-account-${suffix}`,
    command_ref: `synthetic-command-${suffix}`,
    preferred_name: `Synthetic Tester ${suffix}`,
    subject_ref: `synthetic-subject-${suffix}`,
    wechat_code: `synthetic-wechat-code-${suffix}`,
  });
}

export function createNetworkStub({ allowedOrigin, responses }) {
  const origin = new URL(allowedOrigin).origin;
  const calls = [];
  return Object.freeze({
    calls,
    request: async (path, options = {}) => {
      const target = new URL(path, origin);
      if (target.origin !== origin || !target.pathname.startsWith("/v1/")) {
        throw new Error("SYNTHETIC_NETWORK_TARGET_DENIED");
      }
      const key = `${options.method ?? "GET"} ${target.pathname}`;
      if (!Object.hasOwn(responses, key)) {
        throw new Error("SYNTHETIC_NETWORK_RESPONSE_UNSCRIPTED");
      }
      calls.push(Object.freeze({ key }));
      return structuredClone(responses[key]);
    },
  });
}

export function createProviderStub(script) {
  const outcomes = script.map((outcome) => structuredClone(outcome));
  const calls = [];
  return Object.freeze({
    calls,
    invoke: async ({ invocation_ref: invocationRef, role }) => {
      if (!isSyntheticRef(invocationRef)) {
        throw new Error("SYNTHETIC_PROVIDER_REF_REQUIRED");
      }
      const outcome = outcomes.shift();
      if (outcome === undefined) {
        throw new Error("SYNTHETIC_PROVIDER_SCRIPT_EXHAUSTED");
      }
      calls.push(Object.freeze({ invocation_ref: invocationRef, role }));
      return structuredClone(outcome);
    },
  });
}

export function createFaultController(faultCatalog) {
  const armed = new Map(
    faultCatalog.faults.map((fault) => [fault.fault_id, { ...fault, hits: 0 }]),
  );
  return Object.freeze({
    hit(faultId) {
      const fault = armed.get(faultId);
      if (!fault) {
        throw new Error("SYNTHETIC_FAULT_UNKNOWN");
      }
      fault.hits += 1;
      if (fault.mode === "THROW_ONCE" && fault.hits === 1) {
        throw new Error(fault.fault_id);
      }
      return Object.freeze({ fault_id: fault.fault_id, hit: fault.hits });
    },
  });
}

function isSyntheticRef(value) {
  return typeof value === "string" && value.startsWith("synthetic-");
}
