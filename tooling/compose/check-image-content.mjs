#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const imageRoots = Object.freeze({
  admin: "/app",
  migration: "/workspace",
  server: "/app",
  stub: "/app",
});

function fail(ruleId, detail) {
  throw new Error(`${ruleId}:${detail}`);
}

function docker(args, detail) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: "pipe",
  });
  if (result.status !== 0) {
    throw new Error(`COMPOSE_IMAGE_SCAN_COMMAND_FAILED:${detail}`);
  }
  return (result.stdout ?? "").trim();
}

function lines(value) {
  return value === "" ? [] : value.split("\n");
}

function imagePaths(name, image, root) {
  const projectPaths = docker(
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--entrypoint",
      "find",
      image,
      root,
      "-xdev",
      "-path",
      "*/node_modules",
      "-prune",
      "-o",
      "-print",
    ],
    `${name}:project-paths`,
  );
  const workspacePackagePaths = docker(
    [
      "run",
      "--rm",
      "--network",
      "none",
      "--read-only",
      "--entrypoint",
      "find",
      image,
      root,
      "-xdev",
      "-path",
      "*/node_modules/.pnpm/@daily-energy+*",
      "-print",
    ],
    `${name}:workspace-paths`,
  );
  return [
    ...new Set([...lines(projectPaths), ...lines(workspacePackagePaths)]),
  ];
}

function isForbiddenProjectPath(value) {
  const path = value.replaceAll("\\", "/");
  if (/\/(?:\.env(?:[./]|$)|compose\.env$)/u.test(path)) {
    return true;
  }
  if (
    /\/(?:database-(?:admin|api|background|interactive|migration|restricted)-url|fault-control-token|postgres-password)$/u.test(
      path,
    )
  ) {
    return true;
  }
  if (
    /\/(?:packages\/prompt-library|@daily-energy\/prompt-library)(?:\/|$)/u.test(
      path,
    )
  ) {
    return true;
  }
  if (
    /\/@daily-energy\/[^/]+\/(?:src|test|tests|test-fixtures)(?:\/|$)/u.test(
      path,
    ) ||
    /\/@daily-energy\/server-adapters\/dist\/testing(?:\/|$)/u.test(path)
  ) {
    return true;
  }
  if (path.includes("/node_modules/")) {
    return false;
  }
  return /\/(?:\.git|\.turbo|coverage|docs|playwright-report|prototype|test|test-fixtures|test-results|tests)(?:\/|$)/u.test(
    path,
  );
}

export function validateComposeImageInventory(inventory) {
  const names = Object.keys(inventory).sort();
  if (
    JSON.stringify(names) !== JSON.stringify(Object.keys(imageRoots).sort())
  ) {
    fail("COMPOSE_IMAGE_SET", names.join(","));
  }
  for (const [name, image] of Object.entries(inventory)) {
    for (const value of image.paths) {
      if (isForbiddenProjectPath(value)) {
        fail("COMPOSE_IMAGE_CONTENT", `${name}:${value}`);
      }
    }
    for (const value of image.environment) {
      const separator = value.indexOf("=");
      const key = separator === -1 ? value : value.slice(0, separator);
      const content = separator === -1 ? "" : value.slice(separator + 1);
      if (
        /(?:DATABASE_URL|PASSWORD|SECRET|TOKEN)$/u.test(key) ||
        /:\/\/[^/\s]+:[^/@\s]+@/u.test(content)
      ) {
        fail("COMPOSE_IMAGE_INLINE_SECRET", `${name}:${key}`);
      }
    }
  }
  return Object.freeze({ images: names.length });
}

export function scanComposeImages(images) {
  const inventory = {};
  for (const [name, root] of Object.entries(imageRoots)) {
    const image = images[name];
    if (typeof image !== "string" || image.length === 0) {
      fail("COMPOSE_IMAGE_REFERENCE", name);
    }
    const paths = imagePaths(name, image, root);
    const environment = JSON.parse(
      docker(
        ["image", "inspect", image, "--format", "{{json .Config.Env}}"],
        `${name}:environment`,
      ),
    );
    inventory[name] = {
      environment: environment ?? [],
      paths,
    };
  }
  return validateComposeImageInventory(inventory);
}
