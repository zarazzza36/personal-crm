# The app's production image, built by CI. The same image runs the app and,
# in a one-off container before every deploy, the database migrations.

FROM node:24-alpine AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The build loads the database module but sends no queries, so any address will
# do; a query at build time would fail here instead of baking data into pages.
RUN BUILD_STANDALONE=1 DATABASE_URL=postgres://build@127.0.0.1:1/build pnpm build
# Migrations need only drizzle-orm and postgres, which have no dependencies of
# their own: copy them as plain folders out of pnpm's linked node_modules.
RUN mkdir -p migrate/node_modules \
  && cp -RL node_modules/drizzle-orm node_modules/postgres migrate/node_modules/ \
  && cp -R drizzle src/db/migrate.mts migrate/

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/migrate ./migrate
USER node
EXPOSE 3000
CMD ["node", "server.js"]
