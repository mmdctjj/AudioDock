# ==========================================
# Stage 1: Base
# ==========================================
FROM node:22-bullseye AS base

RUN apt-get update \
  && apt-get install -y openssl \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm
WORKDIR /app

# ==========================================
# Stage 2: Builder（安装依赖 + 构建所有项目 + Prisma generate）
# ==========================================
FROM base AS builder

# 1. 复制 lock + workspace 配置，触发 Docker 缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 2. 复制所有子包 package.json
COPY packages/db/package.json ./packages/db/
COPY packages/utils/package.json ./packages/utils/
COPY packages/ws/package.json ./packages/ws/
COPY packages/services/package.json ./packages/services/
COPY services/api/package.json ./services/api/
COPY apps/desktop/package.json ./apps/desktop/

# 3. 安装依赖
RUN pnpm install --frozen-lockfile

# 4. 复制完整源码
COPY . .

# 5. 构建所有 workspace (修改部分开始)
# 构建 @soundx/utils
RUN cd packages/utils && pnpm run build
# 构建 @soundx/ws
RUN cd packages/ws && pnpm run build
# 构建 @soundx/db
RUN cd packages/db && pnpm run build
# 构建 @soundx/services
RUN cd packages/services && pnpm run build
# 6. Prisma generate（确保生成到 packages/db/generated/client）
# 确保在 db 目录下运行 generate
RUN cd packages/db && pnpm run generate
# 构建 @soundx/api
RUN cd services/api && pnpm run build
# 构建 @soundx/desktop (Web)
RUN cd apps/desktop && pnpm run build:web

# ==========================================
# Stage 3: Backend Runner（只放生产依赖 + dist + prisma client）
# ==========================================
FROM node:22-slim AS backend_runner
WORKDIR /app

ENV NODE_ENV=production

# 1. 复制必要文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/db/package.json      ./packages/db/
COPY packages/utils/package.json   ./packages/utils/
COPY packages/services/package.json   ./packages/services/
COPY services/api/package.json     ./services/api/

# 2. 安装生产依赖 + 全局安装 prisma (用于 db push)
RUN apt-get update -y && apt-get install -y openssl
RUN npm i -g pnpm prisma@6.6.0 && pnpm install --prod --frozen-lockfile --ignore-scripts

# 3. 复制构建产物 + prisma client + prisma schema
COPY --from=builder /app/packages/db/dist       ./packages/db/dist
COPY --from=builder /app/packages/db/prisma     ./packages/db/prisma
COPY --from=builder /app/packages/utils/dist    ./packages/utils/dist
COPY --from=builder /app/packages/services/dist    ./packages/services/dist
COPY --from=builder /app/services/api/dist      ./services/api/dist
COPY --from=builder /app/apps/desktop/dist      ./apps/desktop/dist

RUN cd packages/db && npx prisma generate

EXPOSE 3000

CMD ["sh", "-c", "cd packages/db && npx prisma db push && cd ../../services/api && node dist/main.js"]

# ==========================================
# Stage 4: Frontend Runner（Nginx 承载 web）
# ==========================================
FROM nginx:alpine AS frontend_runner

# 拷贝 Nginx 配置
COPY nginx.conf /etc/nginx/nginx.conf

# 拷贝前端构建产物
COPY --from=builder /app/apps/desktop/dist /usr/share/nginx/html

EXPOSE 9958
CMD ["nginx", "-g", "daemon off;"]
