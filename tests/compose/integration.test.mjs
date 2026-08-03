#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const integrationEnabled = process.env.COMPOSE_INTEGRATION === "1";

function control(...args) {
  const result = spawnSync(
    process.execPath,
    ["tooling/compose/control.mjs", ...args],
    { encoding: "utf8", stdio: "pipe" },
  );
  assert.equal(
    result.status,
    0,
    `${args.join(" ")} failed: ${(result.stderr ?? "").split("\n").slice(-5).join("\n")}`,
  );
  return result.stdout;
}

test(
  "T-COMPOSE-INTEGRATION-001 cold start, health, egress and shutdown",
  { skip: integrationEnabled ? false : "set COMPOSE_INTEGRATION=1" },
  async (t) => {
    control("clean", "--mode=test");
    t.after(() => control("clean", "--mode=test"));
    assert.match(control("up", "--mode=test"), /COMPOSE_UP_OK:test/u);
    assert.match(control("smoke", "--mode=test"), /COMPOSE_SMOKE_OK:test/u);
    assert.match(control("down", "--mode=test"), /COMPOSE_DOWN_OK:test/u);
  },
);

test(
  "T-COMPOSE-INTEGRATION-002 deterministic dependency fault matrix",
  { skip: integrationEnabled ? false : "set COMPOSE_INTEGRATION=1" },
  async (t) => {
    control("clean", "--mode=test", "--fault");
    t.after(() => control("clean", "--mode=test", "--fault"));
    assert.match(
      control("up", "--mode=test", "--fault"),
      /COMPOSE_UP_OK:test-fault/u,
    );
    assert.match(
      control("smoke", "--mode=test", "--fault"),
      /COMPOSE_SMOKE_OK:test-fault/u,
    );
    assert.match(
      control("down", "--mode=test", "--fault"),
      /COMPOSE_DOWN_OK:test-fault/u,
    );
  },
);
