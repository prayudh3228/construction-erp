FROM node:22-bookworm-slim AS build
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo
# Demo mode (fake data, one-click demo sign-in) is OFF unless asked for. docker-compose.yml passes
# VITE_DEMO_MODE=true for the local stack; any other build of this image gets it off.
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
COPY . .
RUN pnpm install --frozen-lockfile --filter "@erp/web..." \
 && pnpm --filter "@erp/web..." build

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
