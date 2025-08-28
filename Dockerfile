FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
COPY . /app
WORKDIR /app

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

WORKDIR /app/packages/web
RUN pnpm build

WORKDIR /app/packages/backend
EXPOSE 5200
CMD [ "node", "--import", "jiti/register", "main.ts" ]