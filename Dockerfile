# Build
FROM node:24-alpine AS build

# 设置工作目录
WORKDIR /app

# [重要] 替换 Alpine 官方源为阿里云镜像源，加速 apk 包下载
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# [重要] 替换 npm 源为阿里云镜像源，加速 npm install
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm

COPY package.json pnpm-lock.yaml* ./

# 3. 让 pnpm 也使用国内源，并开始安装依赖
RUN pnpm config set registry https://registry.npmmirror.com/ && \
    pnpm install --frozen-lockfile

COPY . .

# 采集最新数据后构建
RUN node scripts/fetch-trending.mjs && npx astro build

# Production — Nginx 静态托管
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80 443
CMD ["nginx", "-g", "daemon off;"]

