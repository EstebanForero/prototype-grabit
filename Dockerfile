FROM oven/bun:1.4.2 AS consola
WORKDIR /web
COPY web/package.json web/bun.lock ./
RUN bun install --frozen-lockfile
COPY web/ ./
RUN bun run build

FROM oven/bun:1.4.2
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY fixtures ./fixtures
COPY migrations ./migrations
COPY --from=consola /public ./public

RUN mkdir -p /data && chown bun:bun /data
ENV GRABIT_DB=/data/seguimiento.sqlite \
    MAILBOX_FILE=/data/mailbox.json \
    PORT=8787 \
    AGGREGATOR_SECRET=dev-secret
USER bun
EXPOSE 8787
VOLUME /data
CMD ["bun", "src/http/server.ts"]
