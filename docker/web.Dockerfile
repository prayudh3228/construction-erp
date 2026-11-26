FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
# The local stack shows fake demo data and a one-click demo sign-in. Real deployments must build
# with VITE_DEMO_MODE=false (the default for production builds outside Docker Compose).
ARG VITE_DEMO_MODE=true
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
COPY . .
RUN pnpm install --frozen-lockfile --filter "@erp/web..." \
 && pnpm --filter "@erp/web..." build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
