FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN npm ci --no-audit --no-fund
COPY scripts scripts
COPY packages packages
RUN npm test
FROM node:24-bookworm-slim
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
WORKDIR /app
RUN mkdir /data && chown node:node /data
COPY --from=build /app/release ./release
COPY scripts/backup.cjs ./scripts/backup.cjs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","release/server.cjs"]
