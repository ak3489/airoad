FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci --workspace @airoad/server --include-workspace-root

FROM deps AS build
COPY server ./server
RUN npm run build -w server

FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci --omit=dev --workspace @airoad/server --include-workspace-root \
    && npm cache clean --force
COPY --from=build /app/server/dist ./server/dist
USER node
EXPOSE 8787
CMD ["node", "server/dist/index.js"]
