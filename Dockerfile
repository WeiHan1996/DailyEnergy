FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS build

ENV CI=true
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@11.17.0 --activate

COPY . .
RUN --mount=type=cache,id=dailyenergy-e009-pnpm,target=/pnpm/store \
  pnpm config set store-dir /pnpm/store \
  && pnpm install --frozen-lockfile
RUN pnpm run database:generate
RUN NEXT_TELEMETRY_DISABLED=1 TURBO_TELEMETRY_DISABLED=1 pnpm turbo run build \
  --filter=@daily-energy/app-api \
  --filter=@daily-energy/app-worker \
  --filter=@daily-energy/app-admin

FROM build AS server-deploy
RUN --mount=type=cache,id=dailyenergy-e009-pnpm,target=/pnpm/store \
  pnpm --offline --config.inject-workspace-packages=true \
    --filter @daily-energy/app-api deploy --prod /out/api \
  && pnpm --offline --config.inject-workspace-packages=true \
    --filter @daily-energy/app-worker deploy --prod /out/worker
RUN rm -rf \
  /out/api/.turbo \
  /out/api/src \
  /out/api/test-fixtures \
  /out/api/node_modules/.pnpm/@daily-energy+server-adapters@*/node_modules/@daily-energy/server-adapters/src \
  /out/api/node_modules/.pnpm/@daily-energy+server-adapters@*/node_modules/@daily-energy/server-adapters/dist/testing \
  /out/api/node_modules/.pnpm/@daily-energy+shared-schemas@*/node_modules/@daily-energy/shared-schemas/src \
  /out/worker/.turbo \
  /out/worker/src \
  /out/worker/node_modules/.pnpm/@daily-energy+server-adapters@*/node_modules/@daily-energy/server-adapters/src \
  /out/worker/node_modules/.pnpm/@daily-energy+server-adapters@*/node_modules/@daily-energy/server-adapters/dist/testing

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS e009-server

ENV NODE_ENV=production
WORKDIR /app
COPY --from=server-deploy --chown=node:node /out/api ./api
COPY --from=server-deploy --chown=node:node /out/worker ./worker
USER 1000:1000

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS e009-admin

ENV HOSTNAME=0.0.0.0
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/admin/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/admin/.next/static ./apps/admin/.next/static
USER 1000:1000
CMD ["node", "apps/admin/server.js"]

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS e009-migration

WORKDIR /workspace
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /workspace/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/package.json /workspace/prisma.config.ts ./
COPY --from=build --chown=node:node /workspace/prisma ./prisma
COPY --from=build --chown=node:node /workspace/tooling/compose/provision-database.mjs ./tooling/compose/
COPY --from=build --chown=node:node \
  /workspace/tooling/database/bootstrap.mjs \
  /workspace/tooling/database/catalog-fingerprint.mjs \
  /workspace/tooling/database/check-drift.mjs \
  /workspace/tooling/database/lib.mjs \
  /workspace/tooling/database/migrate.mjs \
  /workspace/tooling/database/seed.mjs \
  ./tooling/database/
COPY --from=build --chown=node:node /workspace/tooling/deployment/database-smoke.mjs ./tooling/deployment/
COPY --from=build --chown=node:node /workspace/tooling/lib/sensitive-redaction.mjs ./tooling/lib/
USER 1000:1000
CMD ["node", "tooling/compose/provision-database.mjs"]

FROM node:24.18.0-bookworm-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d AS e009-stub

WORKDIR /app
COPY --chown=node:node tooling/compose/stub-server.mjs tooling/compose/fault-proxy.mjs tooling/compose/host-ingress.mjs tooling/deployment/cos-smoke.mjs tooling/deployment/local-object-smoke.mjs ./
USER 1000:1000
CMD ["node", "stub-server.mjs"]

FROM caddy:2.11.4-alpine@sha256:5f5c8640aae01df9654968d946d8f1a56c497f1dd5c5cda4cf95ab7c14d58648 AS e012-proxy

RUN cp /usr/bin/caddy /usr/bin/caddy-unprivileged \
  && chown root:root /usr/bin/caddy-unprivileged \
  && chmod 0755 /usr/bin/caddy-unprivileged \
  && mv /usr/bin/caddy-unprivileged /usr/bin/caddy \
  && test -z "$(getcap /usr/bin/caddy)"
COPY --chown=1000:1000 docker/deployment/Caddyfile /etc/caddy/Caddyfile
USER 1000:1000
