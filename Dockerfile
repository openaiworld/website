# Build
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .

# 采集最新数据后构建
RUN node scripts/fetch-trending.mjs && npx astro build

# Production — Nginx 静态托管
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

# 自定义 Nginx 配置（SPA 路由 + 压缩）
RUN echo 'server { \
    listen 80; \
    root /usr/share/nginx/html; \
    index index.html; \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
