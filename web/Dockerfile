FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY web/package.json web/package.json
COPY server/package.json server/package.json
RUN npm ci --workspace @airoad/web --include-workspace-root
COPY web ./web
RUN npm run build -w web

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 80
