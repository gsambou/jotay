# Image API : multi-stage, non-root, runtime distroless Node 22.
# Build depuis la racine du monorepo : docker build -f apps/api/Dockerfile .
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY packages/ledger-core/package.json packages/ledger-core/tsconfig.json ./packages/ledger-core/
COPY packages/protocol/package.json packages/protocol/tsconfig.json ./packages/protocol/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/card-crypto/package.json packages/card-crypto/tsconfig.json ./packages/card-crypto/
RUN pnpm install --frozen-lockfile
COPY packages ./packages
COPY apps/api ./apps/api

FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
USER nonroot
# tsx (devDependency de @jotay/api) exécute le TS NodeNext sans étape de compilation.
CMD ["apps/api/node_modules/tsx/dist/cli.mjs", "apps/api/src/main.ts"]
