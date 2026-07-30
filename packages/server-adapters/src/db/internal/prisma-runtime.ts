import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";
import type {
  PrismaClientLifecycle,
  PrismaRuntime,
} from "./prisma-runtime.types.js";

export const prismaRuntime: PrismaRuntime<PrismaClientLifecycle> = {
  createClient(adapter) {
    type ClientOptions = ConstructorParameters<typeof PrismaClient>[0];
    type Adapter = Exclude<ClientOptions["adapter"], undefined>;
    return new PrismaClient({ adapter: adapter as Adapter });
  },
  createAdapter(config) {
    return new PrismaPg({
      application_name: config.applicationName,
      connectionString: config.connectionString,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
      idleTimeoutMillis: config.idleTimeoutMillis,
      max: config.connectionLimit,
    });
  },
};
