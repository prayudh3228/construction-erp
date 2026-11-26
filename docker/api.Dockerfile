# API image for local and CI runs. Production hardening (slim runtime stage) is Phase 34.
# The full (non-slim) image ships OpenSSL, which Prisma's migration engine needs.
FROM node:22-bookworm
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@erp/api..." \
 && pnpm --filter "@erp/api..." build
WORKDIR /repo/apps/api
EXPOSE 3000
# Apply migrations, load demo seeds (idempotent), then start.
CMD ["sh", "-c", "pnpm db:deploy && pnpm db:seed && node dist/main.js"]
