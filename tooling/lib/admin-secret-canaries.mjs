import { readFile } from "node:fs/promises";

const sensitiveEnvironmentName =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|DATABASE_URL|REDIS_URL)/u;
const sensitiveFileEnvironmentName =
  /(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY)_FILE$/u;

function addCanary(canaries, value) {
  if (typeof value !== "string") {
    return;
  }

  for (const candidate of new Set([value, value.trim()])) {
    if (candidate.length >= 12) {
      canaries.add(candidate);
    }
  }
}

export async function collectAdminSecretCanaries(
  environment,
  readSecretFile = readFile,
) {
  const canaries = new Set();

  for (const [name, value] of Object.entries(environment)) {
    if (!sensitiveEnvironmentName.test(name) || value === undefined) {
      continue;
    }

    if (sensitiveFileEnvironmentName.test(name)) {
      try {
        addCanary(canaries, await readSecretFile(value, "utf8"));
      } catch (error) {
        throw new Error(`ADMIN_SECRET_CANARY_FILE_UNREADABLE: ${name}`, {
          cause: error,
        });
      }
      continue;
    }

    addCanary(canaries, value);
  }

  return [...canaries];
}
